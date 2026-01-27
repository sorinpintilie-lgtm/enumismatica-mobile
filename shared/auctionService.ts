import {
  doc,
  collection,
  collectionGroup,
  addDoc,
  updateDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  runTransaction,
  getDoc,
  Transaction,
  DocumentSnapshot,
  QueryDocumentSnapshot,
  deleteDoc,
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import { Auction, Bid, AutoBid, Product } from './types';
import { createOrGetConversation } from './chatService';
import { addAuctionPriceHistory } from './priceHistoryService';
import { createAuctionNotification } from './auctionNotificationService';
import { addCollectionItem } from './collectionService';
import { sendOutbidEmail, sendAuctionWonEmail, sendAuctionSoldEmail } from './emailService';

/**
 * Helper function to calculate the next bid amount based on percentage
 * and round up to the nearest whole number
 */
export function calculateNextBidAmount(currentBid: number, basePercentage: number = 0.05): number {
  // Calculate the next bid amount as current bid + percentage
  const nextBid = currentBid * (1 + basePercentage);
  // Round up to the nearest whole number
  return Math.ceil(nextBid);
}

/**
 * Validates if a bid is valid for an auction
 */
export function validateBid(auction: Auction, bidAmount: number, userId: string): { valid: boolean; error?: string } {
  if (auction.status !== 'active') {
    return { valid: false, error: 'Auction is not active' };
  }

  if (new Date() > auction.endTime) {
    return { valid: false, error: 'Auction has ended' };
  }

  if (auction.ownerId && auction.ownerId === userId) {
    return { valid: false, error: 'Nu poți licita pe propria ta licitație.' };
  }

  if (userId === auction.currentBidderId) {
    return { valid: false, error: 'You are already the highest bidder' };
  }

  const currentBid = auction.currentBid || 0;
  
  // Calculate minimum bid based on percentage of current bid
  // Base percentage is 5%, and we add 5% for each subsequent bid
  // For now, we'll use a fixed 5% increment from current bid
  const basePercentage = 0.05; // 5% base increment
  const minBidFromCurrent = calculateNextBidAmount(currentBid, basePercentage);
  
  // Minimum bid must be at least the reserve price
  const minBid = Math.max(minBidFromCurrent, auction.reservePrice);

  if (bidAmount < minBid) {
    return { valid: false, error: `Licitația trebuie să fie cel puțin ${minBid} EUR (increment minim ${basePercentage * 100}% din valoarea curentă)` };
  }

  return { valid: true };
}

/**
 * Places a bid on an auction and handles auto-bidding
 */
export async function placeBid(auctionId: string, bidAmount: number, userId: string): Promise<void> {
  const auctionRef = doc(db, 'auctions', auctionId);
  const bidsRef = collection(db, 'auctions', auctionId, 'bids');

  let previousBidderId: string | undefined;
  let auctionTitle: string | undefined;

  await runTransaction(db, async (transaction) => {
    const auctionDoc = await transaction.get(auctionRef);
    if (!auctionDoc.exists()) {
      throw new Error('Auction not found');
    }

    const auction = {
      id: auctionDoc.id,
      ...auctionDoc.data(),
      startTime: auctionDoc.data().startTime?.toDate() || new Date(),
      endTime: auctionDoc.data().endTime?.toDate() || new Date(),
    } as Auction;

    const validation = validateBid(auction, bidAmount, userId);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Store previous bidder for notification
    previousBidderId = auction.currentBidderId;

    // Get auction title from product (simplified - in real app might need to fetch product)
    auctionTitle = `Auction ${auctionId}`;

    // Add the bid
    const bidData: Omit<Bid, 'id'> = {
      auctionId,
      userId,
      amount: bidAmount,
      timestamp: new Date(),
    };
    const newBidRef = doc(bidsRef);
    transaction.set(newBidRef, {
      ...bidData,
      timestamp: Timestamp.fromDate(bidData.timestamp),
    });

    // Update auction current bid and bidder
    transaction.update(auctionRef, {
      currentBid: bidAmount,
      currentBidderId: userId,
      updatedAt: Timestamp.fromDate(new Date()),
    });

    // Process auto-bids
    await processAutoBidsInTransaction(transaction, auctionId, bidAmount, userId);
  });

  // Send notification to previous bidder if they were outbid
  if (previousBidderId && previousBidderId !== userId) {
    try {
      await createAuctionNotification(
        previousBidderId,
        'outbid',
        auctionId,
        `Ai fost depășit în licitația ${auctionTitle}. Oferta curentă: ${bidAmount.toFixed(2)} RON`,
        auctionTitle,
        bidAmount
      );

      // Send email notification (non-blocking)
      const userDoc = await getDoc(doc(db, 'users', previousBidderId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        sendOutbidEmail(
          userData.email,
          auctionTitle || `Licitație ${auctionId}`,
          bidAmount,
          auctionId
        ).catch(error => {
          console.error('Failed to send outbid email:', error);
        });
      }
    } catch (error) {
      console.error('Failed to send outbid notification:', error);
    }
  }

  // Track price history (outside transaction)
  try {
    await addAuctionPriceHistory(auctionId, bidAmount, 'auction_bid', `Bid by user ${userId.slice(-6)}`);
  } catch (error) {
    console.error('Failed to track price history:', error);
  }
}

/**
 * Sets up an auto-bid for a user on an auction
 */
export async function setAutoBid(auctionId: string, maxAmount: number, userId: string): Promise<void> {
  const autoBidsRef = collection(db, 'auctions', auctionId, 'autoBids');

  // Check if user already has an auto-bid
  const q = query(autoBidsRef, where('userId', '==', userId));
  const existingAutoBids = await getDocs(q);

  const autoBidData = {
    auctionId,
    userId,
    maxAmount,
    createdAt: Timestamp.fromDate(new Date()),
    updatedAt: Timestamp.fromDate(new Date()),
  };

  if (!existingAutoBids.empty) {
    // Update existing
    const existingId = existingAutoBids.docs[0].id;
    await updateDoc(doc(autoBidsRef, existingId), autoBidData);
  } else {
    // Create new
    await addDoc(autoBidsRef, autoBidData);
  }
}

/**
 * Cancels the auto-bid for a user on a specific auction
 */
export async function cancelAutoBid(auctionId: string, userId: string): Promise<void> {
  const autoBidsRef = collection(db, 'auctions', auctionId, 'autoBids');
  const q = query(autoBidsRef, where('userId', '==', userId));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return;
  }

  for (const docSnap of snapshot.docs) {
    await deleteDoc(docSnap.ref);
  }
}

/**
 * Gets the current user's auto-bid for a specific auction (if any)
 */
export async function getUserAutoBid(auctionId: string, userId: string): Promise<AutoBid | null> {
  const autoBidsRef = collection(db, 'auctions', auctionId, 'autoBids');
  const q = query(autoBidsRef, where('userId', '==', userId));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return null;
  }

  const docSnap = snapshot.docs[0];
  const data = docSnap.data();

  return {
    id: docSnap.id,
    ...data,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
  } as AutoBid;
}

/**
 * Gets all auto-bids for an auction
 */
export async function getAutoBids(auctionId: string): Promise<AutoBid[]> {
  const autoBidsRef = collection(db, 'auctions', auctionId, 'autoBids');
  const q = query(autoBidsRef, orderBy('maxAmount', 'desc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate() || new Date(),
    updatedAt: doc.data().updatedAt?.toDate() || new Date(),
  })) as AutoBid[];
}

/**
 * Gets all auto-bids for a user across all auctions,
 * along with basic auction information if available.
 */
export async function getUserAutoBidsForUser(
  userId: string,
): Promise<{ autoBid: AutoBid; auction: Auction | null }[]> {
  const autoBidsRef = collectionGroup(db, 'autoBids');
  const q = query(autoBidsRef, where('userId', '==', userId));
  const snapshot = await getDocs(q);

  const results: { autoBid: AutoBid; auction: Auction | null }[] = [];

  for (const autoBidDoc of snapshot.docs) {
    const data = autoBidDoc.data() as any;
    const auctionId: string | undefined = data.auctionId;

    const autoBid: AutoBid = {
      id: autoBidDoc.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    };

    let auction: Auction | null = null;

    if (auctionId) {
      try {
        const auctionRef = doc(db, 'auctions', auctionId);
        const auctionSnap = await getDoc(auctionRef);
        if (auctionSnap.exists()) {
          const aData = auctionSnap.data() as any;
          auction = {
            id: auctionSnap.id,
            ...aData,
            startTime: aData.startTime?.toDate() || new Date(),
            endTime: aData.endTime?.toDate() || new Date(),
            createdAt: aData.createdAt?.toDate() || new Date(),
            updatedAt: aData.updatedAt?.toDate() || new Date(),
          } as Auction;
        }
      } catch (err) {
        console.error('Failed to load auction for auto-bid', err);
      }
    }

    results.push({ autoBid, auction });
  }

  return results;
}

/**
 * Gets all won auctions for a user
 */
export async function getWonAuctionsForUser(userId: string): Promise<Auction[]> {
  const auctionsRef = collection(db, 'auctions');
  const q = query(
    auctionsRef,
    where('status', '==', 'ended'),
    where('winnerId', '==', userId),
    where('didMeetMinimum', '==', true)
  );
  const snapshot = await getDocs(q);

  const auctions: Auction[] = [];
  for (const auctionDoc of snapshot.docs) {
    const data = auctionDoc.data() as any;
    auctions.push({
      id: auctionDoc.id,
      ...data,
      startTime: data.startTime?.toDate() || new Date(),
      endTime: data.endTime?.toDate() || new Date(),
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as Auction);
  }

  return auctions;
}

/**
 * Processes auto-bids when a new bid is placed
 */
async function processAutoBidsInTransaction(
  transaction: Transaction,
  auctionId: string,
  newBidAmount: number,
  bidderId: string
): Promise<void> {
  const autoBidsRef = collection(db, 'auctions', auctionId, 'autoBids');
  const auctionRef = doc(db, 'auctions', auctionId);
  const bidsRef = collection(db, 'auctions', auctionId, 'bids');

  // Get auto-bids higher than current bid
  const q = query(autoBidsRef, where('maxAmount', '>', newBidAmount), orderBy('maxAmount', 'asc'));
  const autoBidsSnapshot = await getDocs(q);

  for (const autoBidDoc of autoBidsSnapshot.docs) {
    const autoBid = {
      id: autoBidDoc.id,
      ...autoBidDoc.data(),
    } as AutoBid;

    if (autoBid.userId === bidderId) continue; // Don't auto-bid against yourself

    const increment = 0.01; // Minimum increment
    const autoBidAmount = Math.min(autoBid.maxAmount, newBidAmount + increment);

    if (autoBidAmount > newBidAmount) {
      // Place auto-bid
      const bidData: Omit<Bid, 'id'> = {
        auctionId,
        userId: autoBid.userId,
        amount: autoBidAmount,
        timestamp: new Date(),
      };
      const newBidRef = doc(bidsRef);
      transaction.set(newBidRef, {
        ...bidData,
        timestamp: Timestamp.fromDate(bidData.timestamp),
      });

      // Update auction
      transaction.update(auctionRef, {
        currentBid: autoBidAmount,
        currentBidderId: autoBid.userId,
        updatedAt: Timestamp.fromDate(new Date()),
      });

      // Recursively process next auto-bids
      await processAutoBidsInTransaction(transaction, auctionId, autoBidAmount, autoBid.userId);
      break; // Only process the highest eligible auto-bid
    }
  }
}

/**
 * Helper: after an auction is won (normal end or "Cumpără acum"),
 * add the underlying product into the winner's personal collection.
 */
async function addWonProductToCollection(winnerId: string, productId: string): Promise<void> {
  if (!db) return;

  try {
    const productRef = doc(db, 'products', productId);
    const productSnap = await getDoc(productRef);
    if (!productSnap.exists()) {
      return;
    }

    const data = productSnap.data() as any as Product;

    await addCollectionItem(winnerId, {
      name: data.name || 'Articol licitație',
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
      notes: `Câștigat prin licitație / cumpărare imediată din produsul ${productId}`,
      tags: ['auction-win'],
    });
  } catch (err) {
    console.error('Failed to add won product to collection:', err);
  }
}

/**
 * Ends an auction and determines the winner
 *
 * Uses the hidden minimum accepted price (minAcceptPrice) if set; otherwise
 * falls back to reservePrice:
 *   - if currentBid < minAcceptPrice/reservePrice → no winner (auction_ended_no_win)
 *   - else → winner is currentBidderId (auction_won)
 */
export async function endAuction(auctionId: string): Promise<void> {
  const auctionRef = doc(db, 'auctions', auctionId);

  let winnerId: string | null = null;
  let auctionTitle: string | undefined;
  let winningBidAmount: number | undefined = undefined;
  let winnerProductId: string | null = null;
  let winnerSellerId: string | null = null;

  await runTransaction(db, async (transaction) => {
    const auctionDoc = await transaction.get(auctionRef);
    if (!auctionDoc.exists()) {
      throw new Error('Auction not found');
    }

    const raw = auctionDoc.data() as any;
    const auction = {
      id: auctionDoc.id,
      ...raw,
    } as Auction;

    if (auction.status !== 'active') {
      return; // Already ended
    }

    const currentBidAmount = auction.currentBid || 0;
    const minAccept =
      typeof raw.minAcceptPrice === 'number' ? raw.minAcceptPrice : auction.reservePrice;

    const didMeetMinimum = currentBidAmount >= minAccept;

    if (didMeetMinimum && auction.currentBidderId) {
      winnerId = auction.currentBidderId;
      winningBidAmount = currentBidAmount;
      winnerProductId = auction.productId;
      winnerSellerId = (raw as any).ownerId || null;
    } else {
      winnerId = null;
      winningBidAmount = undefined;
      winnerProductId = null;
      winnerSellerId = null;
    }

    auctionTitle = `Auction ${auctionId}`;

    transaction.update(auctionRef, {
      status: 'ended',
      updatedAt: Timestamp.fromDate(new Date()),
      winnerId: winnerId,
      didMeetMinimum,
    });
  });

  // Build a better title (prefer product name)
  try {
    if (winnerProductId) {
      const productSnap = await getDoc(doc(db, 'products', winnerProductId));
      if (productSnap.exists()) {
        const p = productSnap.data() as any;
        auctionTitle = p.name || auctionTitle;
      }
    }
  } catch (err) {
    console.error('Failed to resolve auction title from product:', err);
  }

  // Send notification to winner or notify no winner
  if (winnerId) {
    try {
      await createAuctionNotification(
        winnerId,
        'auction_won',
        auctionId,
        winningBidAmount != undefined
          ? `Felicitări! Ai câștigat licitația ${auctionTitle} cu oferta de ${(winningBidAmount as number).toFixed(2)} RON`
          : `Felicitări! Ai câștigat licitația ${auctionTitle}`,
        auctionTitle,
        winningBidAmount,
      );

      // Send email notification to winner (non-blocking)
      const winnerDoc = await getDoc(doc(db, 'users', winnerId));
      if (winnerDoc.exists() && winningBidAmount != undefined) {
        const winnerData = winnerDoc.data();
        // Ensure a private conversation exists between winner and seller and persist it for deep links
        let conversationId: string | undefined = undefined;
        let sellerName: string | undefined = undefined;

        try {
          const auctionDoc = await getDoc(doc(db, 'auctions', auctionId));
          if (auctionDoc.exists()) {
            const auctionData = auctionDoc.data() as any;
            if (auctionData.ownerId) {
              const ownerDoc = await getDoc(doc(db, 'users', auctionData.ownerId));
              sellerName = ownerDoc.exists()
                ? (ownerDoc.data().displayName || ownerDoc.data().name || ownerDoc.data().email || 'Vânzător')
                : 'Vânzător';

              try {
                conversationId = await createOrGetConversation(
                  winnerId as string,
                  auctionData.ownerId,
                  auctionId,
                  auctionData.productId,
                  false,
                );
              } catch (err) {
                console.error('Failed to create conversation after auction win:', err);
              }

              // Persist conversation id + seller name for dashboard clarity
              if (conversationId) {
                await updateDoc(doc(db, 'auctions', auctionId), {
                  winnerConversationId: conversationId,
                  winnerName: winnerData.displayName || winnerData.name || winnerData.email || 'Cumpărător',
                  sellerName,
                  updatedAt: Timestamp.fromDate(new Date()),
                });
              }

              // Email seller as well (sold)
              if (ownerDoc.exists()) {
                const ownerData = ownerDoc.data();
                const winnerName = winnerDoc.exists()
                  ? (winnerDoc.data().displayName || winnerDoc.data().name || 'Cumpărător')
                  : 'Cumpărător';

                sendAuctionSoldEmail(
                  ownerData.email,
                  auctionTitle || `Licitație ${auctionId}`,
                  winningBidAmount,
                  winnerName,
                  auctionId,
                  { conversationId },
                ).catch((error) => {
                  console.error('Failed to send auction sold email:', error);
                });
              }
            }
          }
        } catch (err) {
          console.error('Failed to prepare seller conversation/email for auction win:', err);
        }

        sendAuctionWonEmail(
          winnerData.email,
          auctionTitle || `Licitație ${auctionId}`,
          winningBidAmount,
          auctionId,
          { sellerName, conversationId },
        ).catch((error) => {
          console.error('Failed to send auction won email:', error);
        });
      }
    } catch (error) {
      console.error('Failed to send auction won notification:', error);
    }

    // Add won product into winner's personal collection
    if (winnerProductId) {
      await addWonProductToCollection(winnerId, winnerProductId);
    }
  } else {
    // Notify all bidders that auction ended without winner
    try {
      // Get all bidders from the auction
      const bidsRef = collection(db, 'auctions', auctionId, 'bids');
      const bidsSnapshot = await getDocs(bidsRef);
      const bidderIds = [...new Set(bidsSnapshot.docs.map(doc => doc.data().userId))];

      for (const bidderId of bidderIds) {
        await createAuctionNotification(
          bidderId,
          'auction_ended_no_win',
          auctionId,
          `Licitația ${auctionTitle} s-a încheiat fără câștigător`,
          auctionTitle
        );
      }
    } catch (error) {
      console.error('Failed to send auction ended notifications:', error);
    }
  }
}

/**
 * "Cumpără acum" (Buy Now) – instantly ends the auction and assigns
 * the item to the buyer at the configured buyNowPrice.
 *
 * Rules:
 * - Auction must exist and be 'active'
 * - Auction must have a buyNowPrice configured and not already used
 * - Optionally prevents owners from buying their own auction if ownerId is set
 */
export async function buyNowAuction(auctionId: string, buyerId: string): Promise<void> {
  if (!db) throw new Error('Firestore not initialized');

  const auctionRef = doc(db, 'auctions', auctionId);

  let finalPrice: number | null = null;
  let auctionTitle: string | undefined;
  let boughtProductId: string | null = null;
  let sellerId: string | null = null;

  await runTransaction(db, async (tx) => {
    const auctionDoc = await tx.get(auctionRef);
    if (!auctionDoc.exists()) {
      throw new Error('Licitația nu există');
    }

    const raw = auctionDoc.data() as any;
    const auction = {
      id: auctionDoc.id,
      ...raw,
    } as Auction;

    if (auction.status !== 'active') {
      throw new Error('Licitația nu este activă');
    }

    if (auction.buyNowUsed) {
      throw new Error('Opțiunea "Cumpără acum" a fost deja folosită pentru această licitație.');
    }

    if (typeof auction.buyNowPrice !== 'number' || auction.buyNowPrice <= 0) {
      throw new Error('Această licitație nu are configurată o opțiune "Cumpără acum".');
    }

    if (auction.ownerId && auction.ownerId === buyerId) {
      throw new Error('Nu poți folosi "Cumpără acum" pentru propria ta licitație.');
    }

    finalPrice = auction.buyNowPrice;
    auctionTitle = `Auction ${auctionId}`;
    boughtProductId = auction.productId;
    sellerId = (raw as any).ownerId || null;

    tx.update(auctionRef, {
      status: 'ended',
      currentBid: finalPrice,
      currentBidderId: buyerId,
      buyNowUsed: true,
      winnerId: buyerId,
      didMeetMinimum: true,
      updatedAt: Timestamp.fromDate(new Date()),
    });
  });

  if (finalPrice == null || !auctionTitle) {
    return;
  }

  // Resolve auction title from product if possible
  try {
    if (boughtProductId) {
      const productSnap = await getDoc(doc(db, 'products', boughtProductId));
      if (productSnap.exists()) {
        const p = productSnap.data() as any;
        auctionTitle = p.name || auctionTitle;
      }
    }
  } catch (err) {
    console.error('Failed to resolve buy-now auction title from product:', err);
  }

  // Notify the buyer that they have won instantly via Buy Now
  try {
    await createAuctionNotification(
      buyerId,
      'auction_won',
      auctionId,
      `Ai cumpărat imediat prin "Cumpără acum" licitația ${auctionTitle} pentru ${(finalPrice as number).toFixed(2)} RON`,
      auctionTitle,
      finalPrice,
    );

    // Send email notification to buyer (non-blocking) + ensure conversation exists and deep link works
    const buyerDoc = await getDoc(doc(db, 'users', buyerId));
    if (buyerDoc.exists()) {
      const buyerData = buyerDoc.data();
      let conversationId: string | undefined = undefined;
      let sellerName: string | undefined = undefined;

      // Send email notification to seller (non-blocking)
      const auctionDoc = await getDoc(doc(db, 'auctions', auctionId));
      if (auctionDoc.exists()) {
        const auctionData = auctionDoc.data() as any;
        if (auctionData.ownerId) {
          const ownerDoc = await getDoc(doc(db, 'users', auctionData.ownerId));
          sellerName = ownerDoc.exists()
            ? (ownerDoc.data().displayName || ownerDoc.data().name || ownerDoc.data().email || 'Vânzător')
            : 'Vânzător';

          try {
            conversationId = await createOrGetConversation(
              buyerId,
              auctionData.ownerId,
              auctionId,
              auctionData.productId,
              false,
            );
          } catch (err) {
            console.error('Failed to create conversation after buy-now:', err);
          }

          // Persist conversation id + names
          if (conversationId) {
            await updateDoc(doc(db, 'auctions', auctionId), {
              winnerConversationId: conversationId,
              winnerName: buyerData.displayName || buyerData.name || buyerData.email || 'Cumpărător',
              sellerName,
              updatedAt: Timestamp.fromDate(new Date()),
            });
          }

          if (ownerDoc.exists()) {
            const ownerData = ownerDoc.data();
            const buyerName = buyerDoc.exists()
              ? (buyerDoc.data().displayName || buyerDoc.data().name || 'Cumpărător')
              : 'Cumpărător';
            sendAuctionSoldEmail(
              ownerData.email,
              auctionTitle || `Licitație ${auctionId}`,
              finalPrice,
              buyerName,
              auctionId,
              { conversationId },
            ).catch((error) => {
              console.error('Failed to send buy-now sold email:', error);
            });
          }
        }
      }

      sendAuctionWonEmail(
        buyerData.email,
        auctionTitle || `Licitație ${auctionId}`,
        finalPrice,
        auctionId,
        { sellerName, conversationId },
      ).catch((error) => {
        console.error('Failed to send buy-now won email:', error);
      });
    }
  } catch (error) {
    console.error('Failed to send buy-now auction won notification:', error);
  }

  // Add bought product into buyer's personal collection
  if (boughtProductId) {
    await addWonProductToCollection(buyerId, boughtProductId);
  }

  // Track price history for the final price as a system event
  try {
    await addAuctionPriceHistory(
      auctionId,
      finalPrice,
      'system',
      'Cumpără acum - preț final',
    );
  } catch (error) {
    console.error('Failed to track price history for buy-now:', error);
  }
}
