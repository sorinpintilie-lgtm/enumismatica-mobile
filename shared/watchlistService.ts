/**
 * Watchlist Service for eNumismatica.ro
 * Provides functionality for users to bookmark and track products/auctions
 */

import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  onSnapshot,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import { WatchlistItem } from './types';
import { getAuth } from 'firebase/auth';

/**
 * Add an item to user's watchlist
 */
export async function addToWatchlist(
  userId: string,
  itemType: 'product' | 'auction',
  itemId: string,
  notes?: string
): Promise<{ success: boolean; itemId?: string; error?: string }> {
  try {
    // Validate input
    if (!userId || !itemType || !itemId) {
      return { success: false, error: 'Invalid parameters' };
    }

    // Check if item already exists in watchlist
    const existingItem = await checkWatchlistStatus(userId, itemId);
    if (existingItem.exists) {
      return { success: false, error: 'Item already in watchlist' };
    }

    // Create watchlist item
    const watchlistRef = collection(db, 'users', userId, 'watchlist');
    const docRef = await addDoc(watchlistRef, {
      userId,
      itemType,
      itemId,
      addedAt: serverTimestamp(),
      notes: notes || '',
      notificationPreferences: {
        priceChanges: true,
        auctionUpdates: true,
        bidActivity: true
      }
    });

    return { success: true, itemId: docRef.id };
  } catch (error) {
    console.error('Error adding to watchlist:', error);
    return { success: false, error: 'Failed to add item to watchlist' };
  }
}

/**
 * Remove an item from user's watchlist
 */
export async function removeFromWatchlist(
  userId: string,
  itemId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate input
    if (!userId || !itemId) {
      return { success: false, error: 'Invalid parameters' };
    }

    // Find the watchlist item
    const watchlistRef = collection(db, 'users', userId, 'watchlist');
    const q = query(watchlistRef, where('itemId', '==', itemId));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return { success: false, error: 'Item not found in watchlist' };
    }

    // Delete the item
    const batchDeletes = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(batchDeletes);

    return { success: true };
  } catch (error) {
    console.error('Error removing from watchlist:', error);
    return { success: false, error: 'Failed to remove item from watchlist' };
  }
}

/**
 * Get user's complete watchlist
 */
export async function getUserWatchlist(
  userId: string
): Promise<{ success: boolean; items?: WatchlistItem[]; error?: string }> {
  try {
    if (!userId) {
      return { success: false, error: 'Invalid user ID' };
    }

    const watchlistRef = collection(db, 'users', userId, 'watchlist');
    const q = query(watchlistRef, orderBy('addedAt', 'desc'));
    const snapshot = await getDocs(q);

    const items = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId,
        itemType: data.itemType,
        itemId: data.itemId,
        addedAt: data.addedAt?.toDate ? data.addedAt.toDate() : new Date(data.addedAt),
        notes: data.notes || '',
        notificationPreferences: data.notificationPreferences || {
          priceChanges: true,
          auctionUpdates: true,
          bidActivity: true
        }
      };
    }) as WatchlistItem[];

    return { success: true, items };
  } catch (error) {
    console.error('Error getting watchlist:', error);
    return { success: false, error: 'Failed to retrieve watchlist' };
  }
}

/**
 * Check if an item is in user's watchlist
 */
export async function checkWatchlistStatus(
  userId: string,
  itemId: string
): Promise<{ exists: boolean; item?: WatchlistItem; error?: string }> {
  try {
    if (!userId || !itemId) {
      return { exists: false, error: 'Invalid parameters' };
    }

    const watchlistRef = collection(db, 'users', userId, 'watchlist');
    const q = query(watchlistRef, where('itemId', '==', itemId));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return { exists: false };
    }

    const item = {
      id: snapshot.docs[0].id,
      ...snapshot.docs[0].data()
    } as WatchlistItem;

    return { exists: true, item };
  } catch (error) {
    console.error('Error checking watchlist status:', error);
    return { exists: false, error: 'Failed to check watchlist status' };
  }
}

/**
 * Clear user's entire watchlist
 */
export async function clearWatchlist(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!userId) {
      return { success: false, error: 'Invalid user ID' };
    }

    const watchlistRef = collection(db, 'users', userId, 'watchlist');
    const snapshot = await getDocs(watchlistRef);

    if (snapshot.empty) {
      return { success: true }; // Nothing to clear
    }

    // Delete all items
    const batchDeletes = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(batchDeletes);

    return { success: true };
  } catch (error) {
    console.error('Error clearing watchlist:', error);
    return { success: false, error: 'Failed to clear watchlist' };
  }
}

/**
 * Update watchlist item notes
 */
export async function updateWatchlistItemNotes(
  userId: string,
  itemId: string,
  notes: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!userId || !itemId) {
      return { success: false, error: 'Invalid parameters' };
    }

    // Find the watchlist item
    const watchlistRef = collection(db, 'users', userId, 'watchlist');
    const q = query(watchlistRef, where('itemId', '==', itemId));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return { success: false, error: 'Item not found in watchlist' };
    }

    // Update the item
    await updateDoc(snapshot.docs[0].ref, {
      notes,
      updatedAt: serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    console.error('Error updating watchlist item notes:', error);
    return { success: false, error: 'Failed to update watchlist item notes' };
  }
}

/**
 * Subscribe to real-time watchlist updates
 */
export function subscribeToWatchlist(
  userId: string,
  callback: (items: WatchlistItem[]) => void,
  onError?: (error: Error) => void
): () => void {
  if (!userId) {
    onError?.(new Error('Invalid user ID'));
    return () => {}; // Return empty unsubscribe function
  }

  const watchlistRef = collection(db, 'users', userId, 'watchlist');
  const q = query(watchlistRef, orderBy('addedAt', 'desc'));

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          userId: data.userId,
          itemType: data.itemType,
          itemId: data.itemId,
          addedAt: data.addedAt?.toDate ? data.addedAt.toDate() : new Date(data.addedAt),
          notes: data.notes || '',
          notificationPreferences: data.notificationPreferences || {
            priceChanges: true,
            auctionUpdates: true,
            bidActivity: true
          }
        };
      }) as WatchlistItem[];
      callback(items);
    },
    (error) => {
      console.error('Watchlist subscription error:', error);
      onError?.(error);
    }
  );

  return unsubscribe;
}

/**
 * Get watchlist count for user
 */
export async function getWatchlistCount(
  userId: string
): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    if (!userId) {
      return { success: false, error: 'Invalid user ID' };
    }

    const watchlistRef = collection(db, 'users', userId, 'watchlist');
    const snapshot = await getDocs(watchlistRef);

    return { success: true, count: snapshot.size };
  } catch (error) {
    console.error('Error getting watchlist count:', error);
    return { success: false, error: 'Failed to retrieve watchlist count' };
  }
}

/**
 * Update notification preferences for a watchlist item
 */
export async function updateWatchlistNotificationPreferences(
  userId: string,
  itemId: string,
  preferences: {
    priceChanges?: boolean;
    auctionUpdates?: boolean;
    bidActivity?: boolean;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!userId || !itemId) {
      return { success: false, error: 'Invalid parameters' };
    }

    // Find the watchlist item
    const watchlistRef = collection(db, 'users', userId, 'watchlist');
    const q = query(watchlistRef, where('itemId', '==', itemId));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return { success: false, error: 'Item not found in watchlist' };
    }

    // Update notification preferences
    await updateDoc(snapshot.docs[0].ref, {
      notificationPreferences: {
        priceChanges: preferences.priceChanges ?? true,
        auctionUpdates: preferences.auctionUpdates ?? true,
        bidActivity: preferences.bidActivity ?? true
      },
      updatedAt: serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    console.error('Error updating watchlist notification preferences:', error);
    return { success: false, error: 'Failed to update notification preferences' };
  }
}