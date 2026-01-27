import {
  doc,
  getDoc,
  updateDoc,
  Timestamp,
  serverTimestamp,
  runTransaction,
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import { Product, Auction } from './types';
import { addCollectionItem } from './collectionService';
import { sendPullbackConfirmationEmail } from './emailService';
import { logActivity } from './activityLogService';

/**
 * Perform immediate pullback for a product
 */
export async function pullbackProduct(
  productId: string,
  userId: string
): Promise<void> {
  if (!db) throw new Error('Firestore not initialized');

  const productRef = doc(db, 'products', productId);
  
  await runTransaction(db, async (transaction) => {
    const productSnap = await transaction.get(productRef);
    if (!productSnap.exists()) {
      throw new Error('Produsul nu a fost găsit');
    }

    const product = {
      id: productSnap.id,
      ...productSnap.data(),
    } as Product;

    // Validate that the user owns the product
    if (product.ownerId !== userId) {
      throw new Error('Nu deții acest produs');
    }

    // Validate that the product is unsold
    if (product.isSold) {
      throw new Error('Produsul a fost deja vândut');
    }

    // Validate that there are no active offers
    // For immediate pullback, we'll allow it even with offers since it's the owner's decision

    // Update the product with pullback status
    transaction.update(productRef, {
      isPulledBack: true,
      pulledBackAt: Timestamp.fromDate(new Date()),
      updatedAt: serverTimestamp(),
    });

    // Add the product back to the user's collection
    await addCollectionItem(userId, {
      name: product.name || 'Articol returnat',
      description: product.description || '',
      images: product.images || [],
      country: product.country || undefined,
      year: product.year || undefined,
      era: product.era || undefined,
      denomination: product.denomination || undefined,
      metal: product.metal || undefined,
      grade: product.grade || undefined,
      rarity: product.rarity || undefined,
      weight: product.weight || undefined,
      diameter: product.diameter || undefined,
      category: product.category || undefined,
      acquisitionPrice: product.price,
      currentValue: product.price,
      notes: `Returnat în colecție din produsul ${productId}`,
      tags: ['pullback', 'returned'],
    }, transaction);
  });

  // Log the pullback activity
  try {
    await logActivity(
      userId,
      'product_update',
      {
        action: 'pullback',
        productId,
        message: `Produsul ${productId} a fost returnat în colecție`
      }
    );
  } catch (logError) {
    console.error('Eroare la înregistrarea activității de retragere:', logError);
  }

  // Send confirmation email to user
  try {
    await sendPullbackConfirmationEmail(
      productId,
      userId,
      'product'
    );
  } catch (error) {
    console.error('Failed to send pullback confirmation email:', error);
  }
}

/**
 * Perform immediate pullback for an auction
 */
export async function pullbackAuction(
  auctionId: string,
  userId: string
): Promise<void> {
  if (!db) throw new Error('Firestore not initialized');

  const auctionRef = doc(db, 'auctions', auctionId);
  
  await runTransaction(db, async (transaction) => {
    const auctionSnap = await transaction.get(auctionRef);
    if (!auctionSnap.exists()) {
      throw new Error('Licitația nu a fost găsită');
    }

    const auction = {
      id: auctionSnap.id,
      ...auctionSnap.data(),
    } as Auction;

    // Validate that the user owns the auction
    if (auction.ownerId !== userId) {
      throw new Error('Nu deții această licitație');
    }

    // Validate that the auction is ended and unsold
    if (auction.status !== 'ended' || auction.winnerId) {
      throw new Error('Licitația nu este eligibilă pentru retragere');
    }

    // Update the auction with pullback status
    transaction.update(auctionRef, {
      isPulledBack: true,
      pulledBackAt: Timestamp.fromDate(new Date()),
      updatedAt: serverTimestamp(),
    });

    // Get the associated product and add it back to collection
    if (auction.productId) {
      const productRef = doc(db, 'products', auction.productId);
      const productSnap = await transaction.get(productRef);
      
      if (productSnap.exists()) {
        const product = productSnap.data() as Product;
        
        await addCollectionItem(userId, {
          name: product.name || 'Articol licitație returnat',
          description: product.description || '',
          images: product.images || [],
          country: product.country || undefined,
          year: product.year || undefined,
          era: product.era || undefined,
          denomination: product.denomination || undefined,
          metal: product.metal || undefined,
          grade: product.grade || undefined,
          rarity: product.rarity || undefined,
          weight: product.weight || undefined,
          diameter: product.diameter || undefined,
          category: product.category || undefined,
          acquisitionPrice: product.price,
          currentValue: product.price,
          notes: `Returnat în colecție din licitația ${auctionId}`,
          tags: ['pullback', 'auction-returned'],
        }, transaction);
      }
    }
  });

  // Log the pullback activity
  try {
    await logActivity(
      userId,
      'auction_end',
      {
        action: 'pullback',
        auctionId,
        message: `Licitația ${auctionId} a fost returnată în colecție`
      }
    );
  } catch (logError) {
    console.error('Eroare la înregistrarea activității de retragere:', logError);
  }

  // Send confirmation email to user
  try {
    await sendPullbackConfirmationEmail(
      auctionId,
      userId,
      'auction'
    );
  } catch (error) {
    console.error('Eroare la trimiterea emailului de confirmare:', error);
  }
}

/**
 * Check if a product is eligible for pullback
 */
export async function isProductEligibleForPullback(
  productId: string,
  userId: string
): Promise<boolean> {
  if (!db) throw new Error('Firestore not initialized');

  const productRef = doc(db, 'products', productId);
  const productSnap = await getDoc(productRef);

  if (!productSnap.exists()) {
    return false;
  }

  const product = productSnap.data() as Product;

  // Must be owned by user, unsold, and not already pulled back
  return (
    product.ownerId === userId &&
    !product.isSold &&
    !product.isPulledBack
  );
}

/**
 * Check if an auction is eligible for pullback
 */
export async function isAuctionEligibleForPullback(
  auctionId: string,
  userId: string
): Promise<boolean> {
  if (!db) throw new Error('Firestore not initialized');

  const auctionRef = doc(db, 'auctions', auctionId);
  const auctionSnap = await getDoc(auctionRef);

  if (!auctionSnap.exists()) {
    return false;
  }

  const auction = auctionSnap.data() as Auction;

  // Must be owned by user, ended, unsold, and not already pulled back
  return (
    auction.ownerId === userId &&
    auction.status === 'ended' &&
    !auction.winnerId &&
    !auction.isPulledBack
  );
}

export {
  isProductEligibleForPullbackData,
  isAuctionEligibleForPullbackData,
} from './pullbackEligibility';
