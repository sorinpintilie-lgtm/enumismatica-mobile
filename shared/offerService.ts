import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
  runTransaction,
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import { Offer } from './types';

/**
 * Create an offer notification
 */
async function createOfferNotification(
  userId: string,
  type: 'new_offer',
  senderId: string,
  senderName: string,
  message: string,
  offerId: string,
  itemType: 'product' | 'auction',
  itemId: string
): Promise<void> {
  if (!db) throw new Error('Firestore not initialized');

  const notificationsRef = collection(db, 'users', userId, 'notifications');

  const notificationData = {
    userId,
    type,
    senderId,
    senderName,
    message,
    read: false,
    pushed: false,
    createdAt: serverTimestamp(),
    offerId,
    itemType,
    itemId,
  };

  const docRef = await addDoc(notificationsRef, notificationData);

  // Send browser notification if permission granted
  try {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(`Ofertă nouă de la ${senderName}`, {
        body: message,
        icon: '/icon.png',
        badge: '/badge.png',
        data: { offerId, itemType, itemId },
        tag: `offer-${offerId}`,
        requireInteraction: false,
      });
    }
  } catch (error) {
    console.error('Failed to send browser notification:', error);
  }
}

/**
 * Create a new offer on a product or auction
 */
export async function createOffer(
  itemType: 'product' | 'auction',
  itemId: string,
  buyerId: string,
  offerAmount: number,
  message?: string
): Promise<string> {
  // Get the item to find the seller
  const itemRef = doc(db, itemType === 'product' ? 'products' : 'auctions', itemId);
  const itemSnap = await getDoc(itemRef);

  if (!itemSnap.exists()) {
    throw new Error('Item not found');
  }

  const itemData = itemSnap.data();
  const sellerId = itemData.ownerId;

  if (sellerId === buyerId) {
    throw new Error('Cannot make offer on your own item');
  }

  // Check if seller accepts offers for this item
  if (itemType === 'product') {
    if (itemData.acceptsOffers === false) {
      throw new Error('Seller does not accept offers for this product');
    }
  } else if (itemType === 'auction') {
    // For auctions, check the underlying product
    const productSnap = await getDoc(doc(db, 'products', itemData.productId));
    if (productSnap.exists()) {
      const productData = productSnap.data();
      if (productData.acceptsOffers === false) {
        throw new Error('Seller does not accept offers for this auction');
      }
    }
  }

  // Create the offer
  const offerData: any = {
    itemType,
    itemId,
    buyerId,
    sellerId,
    offerAmount,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)), // 7 days
  };

  if (message !== undefined) {
    offerData.message = message;
  }

  const offerRef = await addDoc(collection(db, 'offers'), offerData);

  // Get buyer name for notification
  const buyerDoc = await getDoc(doc(db, 'users', buyerId));
  const buyerName = buyerDoc.exists() ? buyerDoc.data().displayName || 'Un utilizator' : 'Un utilizator';

  // Create notification for seller
  await createOfferNotification(
    sellerId,
    'new_offer',
    buyerId,
    buyerName,
    `Ai primit o ofertă de ${offerAmount} EUR pentru ${itemType === 'product' ? 'produsul' : 'licitația'} tău.`,
    offerRef.id,
    itemType,
    itemId
  );

  return offerRef.id;
}

/**
 * Get offers for a seller
 */
export async function getOffersForSeller(sellerId: string, status?: Offer['status']): Promise<Offer[]> {
  let q = query(
    collection(db, 'offers'),
    where('sellerId', '==', sellerId),
    orderBy('createdAt', 'desc')
  );

  if (status) {
    q = query(q, where('status', '==', status));
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate() || new Date(),
    updatedAt: doc.data().updatedAt?.toDate() || new Date(),
    expiresAt: doc.data().expiresAt?.toDate(),
  })) as Offer[];
}

/**
 * Get offers made by a buyer
 */
export async function getOffersByBuyer(buyerId: string, status?: Offer['status']): Promise<Offer[]> {
  let q = query(
    collection(db, 'offers'),
    where('buyerId', '==', buyerId),
    orderBy('createdAt', 'desc')
  );

  if (status) {
    q = query(q, where('status', '==', status));
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate() || new Date(),
    updatedAt: doc.data().updatedAt?.toDate() || new Date(),
    expiresAt: doc.data().expiresAt?.toDate(),
  })) as Offer[];
}

/**
 * Accept an offer
 */
export async function acceptOffer(offerId: string): Promise<void> {
  if (!db) throw new Error('Firestore not initialized');

  const offerRef = doc(db, 'offers', offerId);

  // Capture values for post-transaction cleanup.
  let acceptedItemType: 'product' | 'auction' | null = null;
  let acceptedItemId: string | null = null;
  let buyerId: string | null = null;
  let sellerId: string | null = null;
  let offerAmount: number | null = null;

  await runTransaction(db, async (tx) => {
    // READ PHASE – all reads must happen before any writes
    const offerSnap = await tx.get(offerRef);
    if (!offerSnap.exists()) {
      throw new Error('Oferta nu există.');
    }

    const offer = offerSnap.data() as any;
    const itemType: 'product' | 'auction' = offer.itemType;
    const itemId: string = offer.itemId;
    buyerId = offer.buyerId;
    sellerId = offer.sellerId;
    offerAmount = offer.offerAmount;

    acceptedItemType = itemType;
    acceptedItemId = itemId;

    if (offer.status && offer.status !== 'pending') {
      throw new Error('Oferta nu mai este în așteptare.');
    }

    let productRef: ReturnType<typeof doc> | null = null;
    let product: any = null;
    let auctionRef: ReturnType<typeof doc> | null = null;
    let auction: any = null;

    if (itemType === 'product') {
      productRef = doc(db, 'products', itemId);
      const productSnap = await tx.get(productRef);
      if (!productSnap.exists()) {
        throw new Error('Produsul nu există.');
      }

      product = productSnap.data() as any;
      if (product.ownerId && sellerId && product.ownerId !== sellerId) {
        throw new Error('Oferta nu aparține acestui vânzător.');
      }

      if (product.isSold) {
        throw new Error('Produsul a fost deja vândut.');
      }
    } else if (itemType === 'auction') {
      auctionRef = doc(db, 'auctions', itemId);
      const auctionSnap = await tx.get(auctionRef);
      if (!auctionSnap.exists()) {
        throw new Error('Licitația nu există.');
      }

      auction = auctionSnap.data() as any;
      if (auction.ownerId && sellerId && auction.ownerId !== sellerId) {
        throw new Error('Oferta nu aparține acestui vânzător.');
      }

      if (auction.status !== 'active') {
        throw new Error('Licitația nu este activă.');
      }
    }

    // WRITE PHASE – all updates after reads
    tx.update(offerRef, {
      status: 'accepted',
      updatedAt: serverTimestamp(),
    });

    if (itemType === 'product' && productRef) {
      tx.update(productRef, {
        isSold: true,
        soldAt: serverTimestamp(),
        buyerId,
        updatedAt: serverTimestamp(),
      });
    } else if (itemType === 'auction' && auctionRef) {
      tx.update(auctionRef, {
        status: 'ended',
        winnerId: buyerId,
        didMeetMinimum: true,
        currentBid: offerAmount,
        currentBidderId: buyerId,
        updatedAt: serverTimestamp(),
      });
    }
  });

  // Best-effort: reject other pending offers for the same item.
  // (Not part of the transaction to avoid a query inside the transaction.)
  try {
    if (acceptedItemType === 'product' && acceptedItemId) {
      const q = query(
        collection(db, 'offers'),
        where('itemType', '==', 'product'),
        where('itemId', '==', acceptedItemId),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc'),
        limit(50),
      );
      const snapshot = await getDocs(q);
      await Promise.all(
        snapshot.docs.map((d) =>
          updateDoc(d.ref, {
            status: 'rejected',
            updatedAt: serverTimestamp(),
          }),
        ),
      );
    }
  } catch (err) {
    console.error('Failed to reject other pending offers after acceptOffer:', err);
  }
}

/**
 * Reject an offer
 */
export async function rejectOffer(offerId: string): Promise<void> {
  const offerRef = doc(db, 'offers', offerId);
  await updateDoc(offerRef, {
    status: 'rejected',
    updatedAt: serverTimestamp(),
  });
}

/**
 * Get a single offer by ID
 */
export async function getOffer(offerId: string): Promise<Offer | null> {
  const offerRef = doc(db, 'offers', offerId);
  const offerSnap = await getDoc(offerRef);

  if (!offerSnap.exists()) {
    return null;
  }

  const data = offerSnap.data();
  return {
    id: offerSnap.id,
    ...data,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
    expiresAt: data.expiresAt?.toDate(),
  } as Offer;
}

/**
 * Get offers for a specific item
 */
export async function getOffersForItem(itemType: 'product' | 'auction', itemId: string): Promise<Offer[]> {
  const q = query(
    collection(db, 'offers'),
    where('itemType', '==', itemType),
    where('itemId', '==', itemId),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate() || new Date(),
    updatedAt: doc.data().updatedAt?.toDate() || new Date(),
    expiresAt: doc.data().expiresAt?.toDate(),
  })) as Offer[];
}
