import {
  doc,
  getDoc,
  runTransaction,
  collection,
  serverTimestamp,
  updateDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import type { Product, Order } from './types';
import { addCollectionItem } from './collectionService';
import { sendPurchaseConfirmationEmail, sendProductSoldEmail } from './emailService';
import { createOrGetConversation } from './chatService';

/**
 * Parse Romanian RON string to number
 * Handles Romanian number format: "1.234,56 Lei" -> 1234.56
 * @param ronString - String like "1.234,56 Lei" or "100.50 RON"
 * @returns Parsed number
 */
function parseRON(ronString: string): number {
  // Remove "Lei", "RON", and other non-numeric characters except digits, dots, and commas
  let cleaned = ronString.replace(/[^\d.,]/g, '');
  
  // Handle Romanian number format: thousands separated by ".", decimals by ","
  // If there's both a dot and comma, assume dot is thousands separator and comma is decimal
  if (cleaned.includes('.') && cleaned.includes(',')) {
    // Remove thousands separators (dots) and replace decimal separator (comma) with dot
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes('.') && !cleaned.includes(',')) {
    // Only dots present - could be either thousands separator or decimal
    // If there are multiple dots, they're thousands separators
    const dotCount = (cleaned.match(/\./g) || []).length;
    if (dotCount > 1) {
      // Multiple dots = thousands separators
      cleaned = cleaned.replace(/\./g, '');
    }
    // If single dot and reasonable decimal position, keep as decimal
  }
  
  return parseFloat(cleaned) || 0;
}

/**
 * Basic order / purchase helpers for direct product buys (shop).
 *
 * For now, orders are created as PAID immediately (no external payment),
 * but the structure is ready to plug in Netopia later by:
 *  - creating the order with status "pending" and paymentProvider "netopia"
 *  - redirecting to Netopia
 *  - updating the order + product from a secure callback when Netopia confirms.
 */

/**
 * Normalize a Firestore order document into the shared Order type.
 */
function mapOrderSnapshot(orderDoc: any): Order {
  const data = orderDoc.data();

  return {
    id: orderDoc.id,
    productId: data.productId,
    buyerId: data.buyerId,
    sellerId: data.sellerId,
    buyerName: typeof data.buyerName === 'string' ? data.buyerName : undefined,
    sellerName: typeof data.sellerName === 'string' ? data.sellerName : undefined,
    conversationId: typeof data.conversationId === 'string' ? data.conversationId : undefined,
    price: data.price,
    currency: data.currency,
    status: data.status,
    paymentProvider: data.paymentProvider,
    paymentReference:
      typeof data.paymentReference === 'string' || data.paymentReference === null
        ? data.paymentReference
        : null,
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
  };
}

export async function createDirectOrderForProduct(
  productId: string,
  buyerId: string,
  isMintProduct?: boolean,
  mintProductData?: any,
): Promise<string> {
  if (!db) {
    throw new Error('Firestore not initialized');
  }

  const productRef = doc(db, 'products', productId);
  const ordersCol = collection(db, 'orders');

  let createdOrderId = '';
  let sellerId: string | null = null;

  await runTransaction(db, async (tx) => {
    let price: number;
    let productData: any;

    // Create order document reference first
    const orderDocRef = doc(ordersCol);

      if (isMintProduct && mintProductData) {
      // For mint products, use provided data
       price = parseRON(mintProductData.price);
       sellerId = 'monetaria-statului'; // Special seller for mint products
      productData = mintProductData;
    } else {
      // For regular products, fetch from Firebase
      const productSnap = await tx.get(productRef);
      if (!productSnap.exists()) {
        throw new Error('Produsul nu există');
      }

      const data = productSnap.data() as any;

      const product: Product = {
        id: productSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt || new Date(),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt || new Date(),
      };

      if (product.status !== 'approved') {
        throw new Error('Produsul nu este disponibil pentru cumpărare.');
      }

      if ((data as any).isSold) {
        throw new Error('Produsul a fost deja vândut.');
      }

      if (product.ownerId === buyerId) {
        throw new Error('Nu poți cumpăra propriul produs.');
      }

       price = product.price;
       sellerId = product.ownerId;
      productData = data;

      // Mark product as sold and link the order.
      tx.update(productRef, {
        isSold: true,
        soldAt: serverTimestamp(),
        buyerId,
        orderId: orderDocRef.id,
        updatedAt: serverTimestamp(),
      });
    }

    if (typeof price !== 'number' || price <= 0) {
      throw new Error('Produsul nu are un preț valid.');
    }

       const orderData = {
      productId,
      buyerId,
      sellerId,
      price,
      currency: 'RON',
      status: 'paid',
      paymentProvider: 'manual',
      paymentReference: null,
      isMintProduct: isMintProduct || false,
      mintProductData: isMintProduct ? mintProductData : null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    tx.set(orderDocRef, orderData);

    createdOrderId = orderDocRef.id;
  });

  // Add the bought product into buyer's personal collection, send emails, and ensure chat exists
  try {
    // Defaults ensure we never use uninitialized variables if a best-effort fetch fails.
    let productName: string = 'Produs';
    let productPrice: number = 0;
    let productImages: string[] = [];

    const orderRef = doc(db, 'orders', createdOrderId);

    // Fetch buyer data (email + name) once
    const buyerDoc = await getDoc(doc(db, 'users', buyerId));
    const buyerEmail = buyerDoc.exists() ? buyerDoc.data().email : null;
    const buyerName = buyerDoc.exists()
      ? (buyerDoc.data().displayName || buyerDoc.data().name || buyerDoc.data().email || 'Cumpărător')
      : 'Cumpărător';

    let sellerEmail: string | null = null;
    let sellerName: string | undefined = undefined;
    let conversationId: string | undefined = undefined;

    if (isMintProduct && mintProductData) {
      // For mint products
      productName = mintProductData.title || 'Produs Monetaria Statului';
      productPrice = parseRON(mintProductData.price);
      productImages = [`/Monetaria_statului/romanian_mint_products/${mintProductData.category_slug}/${mintProductData.image_files}`];

      sellerName = 'Monetaria Statului';

      // Add to collection
      await addCollectionItem(buyerId, {
        name: productName,
        description: mintProductData.full_description || '',
        images: productImages,
        category: mintProductData.category || 'Monetaria Statului',
        acquisitionPrice: productPrice,
        currentValue: productPrice,
        notes: `Cumpărat de la Monetaria Statului (produs ${productId})`,
        tags: ['monetaria-statului', 'mint-product'],
      });
    } else {
      // For regular products
      const productSnap = await getDoc(doc(db, 'products', productId));
      if (productSnap.exists()) {
        const data = productSnap.data() as any;

        // Add to collection
        await addCollectionItem(buyerId, {
          name: data.name || 'Articol cumpărat',
          description: data.description || '',
          images: data.images || [],
          country: data.country || undefined,
          year: data.year || undefined,
          era: data.era || undefined,
          denomination: data.denomination || undefined,
          metal: data.metal || undefined,
          grade: data.grade || undefined,
          rarity: data.rarity || undefined,
          weight: data.weight || undefined,
          diameter: data.diameter || undefined,
          category: data.category || undefined,
          acquisitionPrice: data.price,
          currentValue: data.price,
          notes: `Cumpărat direct din magazin (produs ${productId})`,
          tags: ['shop-purchase'],
        });

        productName = data.name || 'Produs';
        productPrice = data.price || 0;
        productImages = data.images || [];

        // Resolve seller
        if (data.ownerId) {
          const sellerDoc = await getDoc(doc(db, 'users', data.ownerId));
          if (sellerDoc.exists()) {
            sellerEmail = sellerDoc.data().email;
            sellerName = sellerDoc.data().displayName || sellerDoc.data().name || sellerDoc.data().email || 'Vânzător';
          }

          // Ensure a private conversation exists between buyer and seller for this product
          try {
            conversationId = await createOrGetConversation(
              buyerId,
              data.ownerId,
              undefined,
              productId,
              false,
            );
          } catch (err) {
            console.error('Failed to create conversation after direct product purchase:', err);
          }
        }
      }
    }

    // Persist conversation + names on the order for dashboard clarity
    try {
      const patch: any = {
        buyerName,
        sellerName: sellerName || (isMintProduct ? 'Monetaria Statului' : undefined),
        updatedAt: serverTimestamp(),
      };
      if (conversationId) patch.conversationId = conversationId;
      await updateDoc(orderRef, patch);
    } catch (err) {
      console.error('Failed to update order with conversationId/names:', err);
    }

    // Send email to buyer (non-blocking) - skip for mint products
    if (buyerEmail && !isMintProduct) {
      sendPurchaseConfirmationEmail(
        buyerEmail,
        productName,
        productPrice,
        createdOrderId,
        {
          sellerName: sellerName || (isMintProduct ? 'Monetaria Statului' : 'Vânzător'),
          conversationId,
        },
      ).catch((error) => {
        console.error('Failed to send purchase confirmation email:', error);
      });
    }

    // Send email to seller (non-blocking) - skip for mint products
    if (!isMintProduct && sellerEmail) {
      sendProductSoldEmail(
        sellerEmail,
        productName,
        productPrice,
        buyerName,
        {
          conversationId,
          orderId: createdOrderId,
        },
      ).catch((error) => {
        console.error('Failed to send product sold email:', error);
      });
    }
  } catch (err) {
    // Non-critical: log and continue.
    console.error('Failed to add bought product to collection:', err);
  }

  return createdOrderId;
}

/**
 * Fetch all orders where the given user is the buyer, ordered by creation date (newest first).
 * Used for "Comenzile mele" / order history in the dashboard.
 */
export async function getOrdersForBuyer(userId: string): Promise<Order[]> {
  if (!db) {
    throw new Error('Firestore not initialized');
  }

  const ordersRef = collection(db, 'orders');
  const q = query(
    ordersRef,
    where('buyerId', '==', userId),
    orderBy('createdAt', 'desc'),
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(mapOrderSnapshot);
}

/**
 * Fetch all orders where the given user is the seller, ordered by creation date (newest first).
 * Used for "Vânzările mele" / seller sales overview.
 */
export async function getSalesForSeller(userId: string): Promise<Order[]> {
  if (!db) {
    throw new Error('Firestore not initialized');
  }

  const ordersRef = collection(db, 'orders');
  const q = query(
    ordersRef,
    where('sellerId', '==', userId),
    orderBy('createdAt', 'desc'),
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(mapOrderSnapshot);
}

/**
 * Fetch order by conversationId.
 * Used to find the order associated with a chat conversation.
 */
export async function getOrderByConversationId(conversationId: string): Promise<Order | null> {
  if (!db) {
    throw new Error('Firestore not initialized');
  }

  const ordersRef = collection(db, 'orders');
  const q = query(
    ordersRef,
    where('conversationId', '==', conversationId),
    limit(1),
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    return null;
  }

  return mapOrderSnapshot(snapshot.docs[0]);
}

/**
 * Fetch order by ID.
 * Used to get detailed information about a specific order.
 */
export async function getOrderById(orderId: string): Promise<Order> {
  if (!db) {
    throw new Error('Firestore not initialized');
  }

  const orderRef = doc(db, 'orders', orderId);
  const orderSnap = await getDoc(orderRef);

  if (!orderSnap.exists()) {
    throw new Error('Order not found');
  }

  return mapOrderSnapshot(orderSnap);
}
