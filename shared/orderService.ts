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
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import type { Product, Order } from './types';
import { addCollectionItem } from './collectionService';
import { sendPurchaseConfirmationEmail, sendProductSoldEmail } from './emailService';
import { createOrGetConversation } from './chatService';
import { createUserNotification } from './userNotificationService';

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

  const toDateOrUndefined = (value: any): Date | undefined =>
    value?.toDate ? value.toDate() : undefined;

  const toDateOrNull = (value: any): Date | null | undefined => {
    if (!value) return value === null ? null : undefined;
    return value?.toDate ? value.toDate() : value;
  };

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
    buyerMarkedPaidAt: toDateOrUndefined(data.buyerMarkedPaidAt),
    sellerConfirmedPaidAt: toDateOrUndefined(data.sellerConfirmedPaidAt),
    paymentFlaggedForAdmin: !!data.paymentFlaggedForAdmin,
    paymentFlaggedAt: toDateOrUndefined(data.paymentFlaggedAt),
    autoPaidBySystem: !!data.autoPaidBySystem,
    // Payment details
    paymentDate: toDateOrUndefined(data.paymentDate),
    paymentProofUrl: data.paymentProofUrl ?? null,
    // Seller payment confirmation
    sellerConfirmedPayment: !!data.sellerConfirmedPayment,
    paymentConfirmationDate: toDateOrUndefined(data.paymentConfirmationDate),
    // Shipping information
    awbNumber: data.awbNumber ?? null,
    shippingDate: toDateOrNull(data.shippingDate),
    courierName: data.courierName ?? null,
    // Shipping address sharing
    shippingAddressShared: !!data.shippingAddressShared,
    shippingAddressSharedAt: toDateOrNull(data.shippingAddressSharedAt),
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
      status: 'pending',
      paymentProvider: 'manual',
      paymentReference: null,
      buyerMarkedPaidAt: null,
      sellerConfirmedPaidAt: null,
      paymentFlaggedForAdmin: false,
      paymentFlaggedAt: null,
      autoPaidBySystem: false,
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

    // Create in-app notifications for buyer/seller
    try {
      await createUserNotification({
        userId: buyerId,
        type: 'system',
        title: 'Comandă creată',
        message: `Comanda ta pentru „${productName}” a fost creată cu succes.`,
        preferenceKey: 'orderUpdates',
        data: {
          orderId: createdOrderId,
        },
      });
    } catch (notificationError) {
      console.error('Failed to create buyer order notification:', notificationError);
    }

    try {
      if (!isMintProduct && sellerId && sellerId !== 'monetaria-statului') {
        await createUserNotification({
          userId: sellerId,
          type: 'system',
          title: 'Produs vândut',
          message: `Produsul „${productName}” a fost cumpărat de ${buyerName}.`,
          preferenceKey: 'orderUpdates',
          data: {
            orderId: createdOrderId,
          },
        });
      }
    } catch (notificationError) {
      console.error('Failed to create seller order notification:', notificationError);
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

/**
 * Buyer marks manual payment as completed.
 * Order moves from pending -> payment_marked_by_buyer.
 */
export async function markOrderPaymentByBuyer(orderId: string, buyerId: string): Promise<void> {
  if (!db) throw new Error('Firestore not initialized');

  const orderRef = doc(db, 'orders', orderId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(orderRef);
    if (!snap.exists()) throw new Error('Order not found');
    const data = snap.data() as any;

    if (data.buyerId !== buyerId) throw new Error('Only buyer can mark payment');
    if (data.status !== 'pending') throw new Error('Order is not pending payment');

    tx.update(orderRef, {
      status: 'payment_marked_by_buyer',
      buyerMarkedPaidAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

/**
 * Seller confirms payment after buyer mark.
 * Order moves from payment_marked_by_buyer -> paid.
 */
export async function confirmOrderPaymentBySeller(orderId: string, sellerId: string): Promise<void> {
  if (!db) throw new Error('Firestore not initialized');

  const orderRef = doc(db, 'orders', orderId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(orderRef);
    if (!snap.exists()) throw new Error('Order not found');
    const data = snap.data() as any;

    if (data.sellerId !== sellerId) throw new Error('Only seller can confirm payment');
    if (data.status !== 'payment_marked_by_buyer') {
      throw new Error('Order is not waiting for seller confirmation');
    }

    tx.update(orderRef, {
      status: 'paid',
      sellerConfirmedPaidAt: serverTimestamp(),
      autoPaidBySystem: false,
      updatedAt: serverTimestamp(),
    });
  });
}

/**
 * System task: auto-complete orders that stayed unconfirmed by seller >10 days.
 * Also flags to admin for verification.
 */
export async function processOverduePaymentConfirmations(): Promise<number> {
  if (!db) throw new Error('Firestore not initialized');

  const cutoff = Timestamp.fromDate(new Date(Date.now() - 10 * 24 * 60 * 60 * 1000));
  const ordersRef = collection(db, 'orders');
  const q = query(
    ordersRef,
    where('status', '==', 'payment_marked_by_buyer'),
    where('buyerMarkedPaidAt', '<=', cutoff),
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) return 0;

  let updatedCount = 0;
  await Promise.all(
    snapshot.docs.map(async (orderDoc) => {
      const orderData = orderDoc.data() as any;
      const batchId = `${orderDoc.id}_${Date.now()}`;
      const adminFlagRef = doc(collection(db, 'adminPaymentFlags'));

      await runTransaction(db, async (tx) => {
        const fresh = await tx.get(orderDoc.ref);
        if (!fresh.exists()) return;
        const current = fresh.data() as any;
        if (current.status !== 'payment_marked_by_buyer') return;

        tx.update(orderDoc.ref, {
          status: 'paid',
          paymentFlaggedForAdmin: true,
          paymentFlaggedAt: serverTimestamp(),
          autoPaidBySystem: true,
          updatedAt: serverTimestamp(),
        });

        tx.set(adminFlagRef, {
          type: 'order_payment_timeout_auto_paid',
          orderId: orderDoc.id,
          buyerId: orderData.buyerId || null,
          sellerId: orderData.sellerId || null,
          buyerMarkedPaidAt: orderData.buyerMarkedPaidAt || null,
          note: 'Seller did not confirm payment within 10 days; order auto-marked paid.',
          status: 'open',
          dedupeKey: batchId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        updatedCount += 1;
      });
    }),
  );

  return updatedCount;
}

/**
 * Get banking details for an order (buyer view).
 * Returns seller's bank account info for payment.
 */
export async function getBankingDetailsForOrder(orderId: string, buyerId: string): Promise<{ bankAccount: string; accountName: string | null } | null> {
  if (!db) throw new Error('Firestore not initialized');

  const orderRef = doc(db, 'orders', orderId);
  const orderSnap = await getDoc(orderRef);

  if (!orderSnap.exists()) {
    throw new Error('Comanda nu există');
  }

  const orderData = orderSnap.data() as any;

  // Verify the user is the buyer
  if (orderData.buyerId !== buyerId) {
    throw new Error('Doar cumpărătorul poate vedea detaliile bancare');
  }

  // Get seller's banking details
  const sellerId = orderData.sellerId;
  if (!sellerId) {
    throw new Error('Vânzătorul nu este specificat');
  }

  // Special case for Monetaria Statului
  if (sellerId === 'monetaria-statului') {
    return {
      bankAccount: 'RO00BANK0000000000000000', // Placeholder - should be configured
      accountName: 'Monetaria Statului',
    };
  }

  const sellerDoc = await getDoc(doc(db, 'users', sellerId));
  if (!sellerDoc.exists()) {
    throw new Error('Vânzătorul nu a fost găsit');
  }

  const sellerData = sellerDoc.data();
  const personalDetails = sellerData.personalDetails || {};

  if (!personalDetails.bankAccount) {
    return null;
  }

  return {
    bankAccount: personalDetails.bankAccount,
    accountName: personalDetails.firstName && personalDetails.lastName
      ? `${personalDetails.firstName} ${personalDetails.lastName}`
      : null,
  };
}

/**
 * Get shipping address for an order (seller view).
 * Returns buyer's shipping address if shared.
 */
export async function getShippingAddressForOrder(orderId: string, sellerId: string): Promise<{
  address?: string;
  county?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
} | null> {
  if (!db) throw new Error('Firestore not initialized');

  const orderRef = doc(db, 'orders', orderId);
  const orderSnap = await getDoc(orderRef);

  if (!orderSnap.exists()) {
    throw new Error('Comanda nu există');
  }

  const orderData = orderSnap.data() as any;

  // Verify the user is the seller
  if (orderData.sellerId !== sellerId) {
    throw new Error('Doar vânzătorul poate vedea adresa de expediere');
  }

  // Check if shipping address was shared
  if (!orderData.shippingAddressShared) {
    return null;
  }

  // Get buyer's shipping address
  const buyerId = orderData.buyerId;
  if (!buyerId) {
    throw new Error('Cumpărătorul nu este specificat');
  }

  const buyerDoc = await getDoc(doc(db, 'users', buyerId));
  if (!buyerDoc.exists()) {
    throw new Error('Cumpărătorul nu a fost găsit');
  }

  const buyerData = buyerDoc.data();
  const personalDetails = buyerData.personalDetails || {};

  return {
    address: personalDetails.address,
    county: personalDetails.county,
    postalCode: personalDetails.postalCode,
    country: personalDetails.country,
    phone: personalDetails.phone,
  };
}

/**
 * Buyer shares shipping address with seller.
 */
export async function shareShippingAddress(orderId: string, buyerId: string): Promise<void> {
  if (!db) throw new Error('Firestore not initialized');

  const orderRef = doc(db, 'orders', orderId);
  const orderSnap = await getDoc(orderRef);

  if (!orderSnap.exists()) {
    throw new Error('Comanda nu există');
  }

  const orderData = orderSnap.data() as any;

  // Verify the user is the buyer
  if (orderData.buyerId !== buyerId) {
    throw new Error('Doar cumpărătorul poate partaja adresa');
  }

  // Check if buyer has personal details set
  const buyerDoc = await getDoc(doc(db, 'users', buyerId));
  if (!buyerDoc.exists()) {
    throw new Error('Cumpărătorul nu a fost găsit');
  }

  const buyerData = buyerDoc.data();
  const personalDetails = buyerData.personalDetails || {};

  if (!personalDetails.address) {
    throw new Error('Te rugăm să completezi adresa de livrare în profilul tău înainte de a o partaja');
  }

  await updateDoc(orderRef, {
    shippingAddressShared: true,
    shippingAddressSharedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Seller saves shipping information (AWB, courier, date).
 */
export async function saveShippingInfo(
  orderId: string,
  sellerId: string,
  data: { awbNumber: string; shippingDate: Date; courierName: string }
): Promise<void> {
  if (!db) throw new Error('Firestore not initialized');

  const orderRef = doc(db, 'orders', orderId);
  const orderSnap = await getDoc(orderRef);

  if (!orderSnap.exists()) {
    throw new Error('Comanda nu există');
  }

  const orderData = orderSnap.data() as any;

  // Verify the user is the seller
  if (orderData.sellerId !== sellerId) {
    throw new Error('Doar vânzătorul poate adăuga informații de expediere');
  }

  // Verify order is paid
  if (orderData.status !== 'paid') {
    throw new Error('Comanda trebuie să fie plătită înainte de a adăuga informații de expediere');
  }

  await updateDoc(orderRef, {
    awbNumber: data.awbNumber,
    shippingDate: data.shippingDate,
    courierName: data.courierName,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Seller confirms payment received.
 * Updates sellerConfirmedPayment flag.
 */
export async function confirmPaymentReceived(orderId: string, sellerId: string): Promise<void> {
  if (!db) throw new Error('Firestore not initialized');

  const orderRef = doc(db, 'orders', orderId);
  const orderSnap = await getDoc(orderRef);

  if (!orderSnap.exists()) {
    throw new Error('Comanda nu există');
  }

  const orderData = orderSnap.data() as any;

  // Verify the user is the seller
  if (orderData.sellerId !== sellerId) {
    throw new Error('Doar vânzătorul poate confirma primirea plății');
  }

  // Verify order is in payment_marked_by_buyer status
  if (orderData.status !== 'payment_marked_by_buyer') {
    throw new Error('Comanda nu este în așteptarea confirmării plății');
  }

  await updateDoc(orderRef, {
    status: 'paid',
    sellerConfirmedPayment: true,
    paymentConfirmationDate: serverTimestamp(),
    sellerConfirmedPaidAt: serverTimestamp(),
    autoPaidBySystem: false,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Buyer marks payment as made with optional payment proof.
 */
export async function markPaymentMadeWithDetails(
  orderId: string,
  buyerId: string,
  paymentDate: Date,
  paymentProofUrl?: string | null
): Promise<void> {
  if (!db) throw new Error('Firestore not initialized');

  const orderRef = doc(db, 'orders', orderId);
  const orderSnap = await getDoc(orderRef);

  if (!orderSnap.exists()) {
    throw new Error('Comanda nu există');
  }

  const orderData = orderSnap.data() as any;

  // Verify the user is the buyer
  if (orderData.buyerId !== buyerId) {
    throw new Error('Doar cumpărătorul poate marca plata');
  }

  // Verify order is pending
  if (orderData.status !== 'pending') {
    throw new Error('Comanda nu este în așteptarea plății');
  }

  const updateData: any = {
    status: 'payment_marked_by_buyer',
    buyerMarkedPaidAt: serverTimestamp(),
    paymentDate: paymentDate,
    updatedAt: serverTimestamp(),
  };

  if (paymentProofUrl) {
    updateData.paymentProofUrl = paymentProofUrl;
  }

  await updateDoc(orderRef, updateData);
}
