import { collection, getDocs, query, where, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { Product, Auction } from './types';

export interface AppDataLoadProgress {
  step: string;
  progress: number; // 0-100
}

export interface AppDataLoadResult {
  success: boolean;
  error?: string;
}

/**
 * Preload essential app data during splashscreen
 * This improves app performance by loading critical data upfront
 */
export async function preloadAppData(
  userId: string | null,
  onProgress?: (progress: AppDataLoadProgress) => void
): Promise<AppDataLoadResult> {
  try {
    // Step 1: Load featured products (20%)
    onProgress?.({ step: 'Se încarcă produsele...', progress: 20 });
    await loadFeaturedProducts();

    // Step 2: Load active auctions (40%)
    onProgress?.({ step: 'Se încarcă licitațiile...', progress: 40 });
    await loadActiveAuctions();

    // Step 3: Load user-specific data if authenticated (60-80%)
    if (userId) {
      onProgress?.({ step: 'Se încarcă profilul...', progress: 60 });
      await loadUserProfile(userId);

      onProgress?.({ step: 'Se încarcă notificările...', progress: 70 });
      await loadUserNotifications(userId);

      onProgress?.({ step: 'Se încarcă coșul...', progress: 80 });
      await loadUserCart(userId);

      onProgress?.({ step: 'Se încarcă lista de dorințe...', progress: 90 });
      await loadUserWatchlist(userId);
    }

    // Step 4: Complete (100%)
    onProgress?.({ step: 'Se finalizează...', progress: 100 });

    return { success: true };
  } catch (error) {
    console.error('[AppDataLoader] Error preloading app data:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to preload app data',
    };
  }
}

/**
 * Load featured products for the home screen
 */
async function loadFeaturedProducts(): Promise<void> {
  const productsRef = collection(db, 'products');
  const q = query(
    productsRef,
    where('isSold', '==', false),
    orderBy('createdAt', 'desc'),
    limit(20)
  );
  await getDocs(q);
}

/**
 * Load active auctions
 */
async function loadActiveAuctions(): Promise<void> {
  const auctionsRef = collection(db, 'auctions');
  const q = query(
    auctionsRef,
    where('status', '==', 'active'),
    orderBy('endTime', 'asc'),
    limit(20)
  );
  await getDocs(q);
}

/**
 * Load user profile data
 */
async function loadUserProfile(userId: string): Promise<void> {
  const userDoc = await getDoc(doc(db, 'users', userId));
  if (userDoc.exists()) {
    // Cache user data in memory (could be enhanced with a proper cache)
    const userData = userDoc.data();
    console.log('[AppDataLoader] User profile loaded:', userData?.displayName);
  }
}

/**
 * Load user notifications
 */
async function loadUserNotifications(userId: string): Promise<void> {
  const notificationsRef = collection(db, 'users', userId, 'notifications');
  const q = query(
    notificationsRef,
    orderBy('createdAt', 'desc'),
    limit(20)
  );
  await getDocs(q);
}

/**
 * Load user cart
 */
async function loadUserCart(userId: string): Promise<void> {
  const cartRef = collection(db, 'users', userId, 'cart');
  const q = query(cartRef, orderBy('addedAt', 'desc'));
  await getDocs(q);
}

/**
 * Load user watchlist
 */
async function loadUserWatchlist(userId: string): Promise<void> {
  const watchlistRef = collection(db, 'users', userId, 'watchlist');
  const q = query(watchlistRef, orderBy('addedAt', 'desc'));
  await getDocs(q);
}
