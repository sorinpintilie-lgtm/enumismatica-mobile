import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { WatchlistItem } from '@shared/types';
import {
  getUserWatchlist as getUserWatchlistService,
  checkWatchlistStatus as checkWatchlistStatusService,
  addToWatchlist as addToWatchlistService,
  removeFromWatchlist as removeFromWatchlistService,
  clearWatchlist as clearWatchlistService,
} from '@shared/watchlistService';

export function useWatchlist() {
  const { user } = useAuth();
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [watchlistCount, setWatchlistCount] = useState<number>(0);

  /**
   * Fetch user's watchlist
   */
  const fetchWatchlist = useCallback(async () => {
    if (!user) {
      setWatchlist([]);
      setWatchlistCount(0);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const result = await getUserWatchlistService(user.uid);
      if (!result.success) {
        throw new Error(result.error || 'Nu s-a putut încărca lista de urmărire');
      }

      setWatchlist(result.items || []);
      setWatchlistCount(result.items?.length || 0);
    } catch (err) {
      console.error('Error fetching watchlist:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Nu s-a putut încărca lista de urmărire'
      );
      setWatchlist([]);
      setWatchlistCount(0);
    } finally {
      setLoading(false);
    }
  }, [user]);

  /**
   * Check if item is in watchlist
   */
  const checkWatchlistStatus = useCallback(async (itemId: string) => {
    if (!user) return { exists: false, item: null };

    try {
      const result = await checkWatchlistStatusService(user.uid, itemId);
      return {
        exists: result.exists || false,
        item: result.item || null,
      };
    } catch (err) {
      console.error('Error checking watchlist status:', err);
      return { exists: false, item: null };
    }
  }, [user]);

  /**
   * Add item to watchlist
   */
  const addToWatchlist = useCallback(
    async (itemType: 'product' | 'auction', itemId: string, notes?: string) => {
      if (!user) {
        return { success: false, error: 'Utilizator neautentificat' };
      }

      try {
        const result = await addToWatchlistService(user.uid, itemType, itemId, notes);

        if (!result.success) {
          throw new Error(result.error || 'Nu s-a putut adăuga la lista de urmărire');
        }

        // Reîncarcă lista după adăugare
        await fetchWatchlist();
        return { success: true };
      } catch (err) {
        console.error('Error adding to watchlist:', err);
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Nu s-a putut adăuga la lista de urmărire',
        };
      }
    },
    [user, fetchWatchlist]
  );

  /**
   * Remove item from watchlist
   */
  const removeFromWatchlist = useCallback(
    async (itemId: string) => {
      if (!user) {
        return { success: false, error: 'Utilizator neautentificat' };
      }

      try {
        const result = await removeFromWatchlistService(user.uid, itemId);

        if (!result.success) {
          throw new Error(result.error || 'Nu s-a putut elimina din lista de urmărire');
        }

        // Reîncarcă lista după eliminare
        await fetchWatchlist();
        return { success: true };
      } catch (err) {
        console.error('Error removing from watchlist:', err);
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Nu s-a putut elimina din lista de urmărire',
        };
      }
    },
    [user, fetchWatchlist]
  );

  /**
   * Clear entire watchlist
   */
  const clearWatchlist = useCallback(
    async () => {
      if (!user) {
        return { success: false, error: 'Utilizator neautentificat' };
      }

      try {
        const result = await clearWatchlistService(user.uid);

        if (!result.success) {
          throw new Error(result.error || 'Nu s-a putut goli lista de urmărire');
        }

        // Reîncarcă lista după golire
        await fetchWatchlist();
        return { success: true };
      } catch (err) {
        console.error('Error clearing watchlist:', err);
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Nu s-a putut goli lista de urmărire',
        };
      }
    },
    [user, fetchWatchlist]
  );

  // Initial fetch
  useEffect(() => {
    fetchWatchlist();
  }, [fetchWatchlist]);

  return {
    watchlist,
    loading,
    error,
    watchlistCount,
    fetchWatchlist,
    checkWatchlistStatus,
    addToWatchlist,
    removeFromWatchlist,
    clearWatchlist
  };
}