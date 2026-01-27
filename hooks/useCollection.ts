import { useState, useEffect, useCallback } from 'react';
import {
  subscribeToUserCollection,
  addCollectionItem,
  updateCollectionItem,
  deleteCollectionItem,
  getCollectionStats,
  searchCollectionItems,
} from '@shared/collectionService';
import { CollectionItem } from '@shared/types';

/**
 * Hook for managing user collection in mobile app
 */
export function useCollection(userId: string | null) {
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{
    totalItems: number;
    totalValue: number;
    totalInvestment: number;
    byCountry: { [country: string]: number };
    byMetal: { [metal: string]: number };
    byRarity: { [rarity: string]: number };
  } | null>(null);

  useEffect(() => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToUserCollection(userId, (newItems) => {
      setItems(newItems);
      setLoading(false);
    });

    // Load stats
    getCollectionStats(userId)
      .then(setStats)
      .catch(console.error);

    return () => unsubscribe();
  }, [userId]);

  const addItem = useCallback(
    async (itemData: Omit<CollectionItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
      if (!userId) throw new Error('User not authenticated');

      try {
        const itemId = await addCollectionItem(userId, itemData);
        // Refresh stats
        const newStats = await getCollectionStats(userId);
        setStats(newStats);
        return itemId;
      } catch (err: any) {
        setError(err.message || 'Failed to add item');
        throw err;
      }
    },
    [userId]
  );

  const updateItem = useCallback(
    async (itemId: string, updates: Partial<Omit<CollectionItem, 'id' | 'userId' | 'createdAt'>>) => {
      if (!userId) throw new Error('User not authenticated');

      try {
        await updateCollectionItem(userId, itemId, updates);
        // Refresh stats
        const newStats = await getCollectionStats(userId);
        setStats(newStats);
      } catch (err: any) {
        setError(err.message || 'Failed to update item');
        throw err;
      }
    },
    [userId]
  );

  const deleteItem = useCallback(
    async (itemId: string) => {
      if (!userId) throw new Error('User not authenticated');

      try {
        await deleteCollectionItem(userId, itemId);
        // Refresh stats
        const newStats = await getCollectionStats(userId);
        setStats(newStats);
      } catch (err: any) {
        setError(err.message || 'Failed to delete item');
        throw err;
      }
    },
    [userId]
  );

  const searchItems = useCallback(
    async (searchTerm: string): Promise<CollectionItem[]> => {
      if (!userId) return [];

      try {
        return await searchCollectionItems(userId, searchTerm);
      } catch (err: any) {
        setError(err.message || 'Failed to search items');
        return [];
      }
    },
    [userId]
  );

  return {
    items,
    loading,
    error,
    stats,
    addItem,
    updateItem,
    deleteItem,
    searchItems,
  };
}

