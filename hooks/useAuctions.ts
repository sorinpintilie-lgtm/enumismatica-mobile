import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  where,
  doc,
  limit,
  startAfter,
  type QueryDocumentSnapshot,
  type DocumentData,
} from '@shared/firebaseConfig';
import { db } from '@shared/firebaseConfig';
import { Auction } from '@shared/types';

// Default fields for auction list view - optimize for performance
const DEFAULT_AUCTION_FIELDS = ['productId', 'startTime', 'endTime', 'reservePrice', 'currentBid', 'currentBidderId', 'status', 'createdAt', 'updatedAt', 'ownerId', 'buyNowPrice', 'buyNowUsed', 'isPulledBack'];

export function useAuctions(status?: 'active' | 'ended' | 'cancelled', pageSize: number = 20, fields: string[] = DEFAULT_AUCTION_FIELDS) {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);

  useEffect(() => {
    setLoading(true);
    let q = query(collection(db, 'auctions'), orderBy('createdAt', 'desc'), limit(pageSize));

    if (status) {
      q = query(q, where('status', '==', status));
    }

    // Set timeout for loading state
    const timeoutId = setTimeout(() => {
      setError('Timeout: Unable to load auctions. Please check your connection.');
      setLoading(false);
    }, 15000); // 15 second timeout

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        clearTimeout(timeoutId);
        const auctionsData: Auction[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const auctionData: any = { id: doc.id };

          // Only include requested fields for performance
          fields.forEach(field => {
            if (data[field] !== undefined) {
              auctionData[field] = data[field];
            }
          });

          // Always include dates for proper typing
          if (fields.includes('startTime')) {
            auctionData.startTime = data.startTime?.toDate() || new Date();
          }
          if (fields.includes('endTime')) {
            auctionData.endTime = data.endTime?.toDate() || new Date();
          }
          if (fields.includes('createdAt')) {
            auctionData.createdAt = data.createdAt?.toDate() || new Date();
          }
          if (fields.includes('updatedAt')) {
            auctionData.updatedAt = data.updatedAt?.toDate() || new Date();
          }

          auctionsData.push(auctionData as Auction);
        });

        setAuctions(auctionsData);
        setHasMore(auctionsData.length === pageSize);
        if (auctionsData.length > 0) {
          setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]);
        }
        setLoading(false);
      },
      (err) => {
        clearTimeout(timeoutId);
        console.error('[useAuctions] snapshot error', {
          message: err?.message,
          code: (err as any)?.code,
          name: (err as any)?.name,
          stack: (err as any)?.stack,
        });
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [status, pageSize, fields]);

  const loadMore = useCallback(() => {
    if (hasMore && lastVisible && !loading) {
      // Implement pagination if needed
    }
  }, [hasMore, lastVisible, loading]);

  return { auctions, loading, error, hasMore, loadMore };
}

export function useAuction(id: string) {
  const [auction, setAuction] = useState<Auction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const unsubscribe = onSnapshot(
      doc(db, 'auctions', id),
      (doc) => {
        if (doc.exists()) {
          setAuction({
            id: doc.id,
            ...doc.data(),
            startTime: doc.data().startTime?.toDate() || new Date(),
            endTime: doc.data().endTime?.toDate() || new Date(),
            createdAt: doc.data().createdAt?.toDate() || new Date(),
            updatedAt: doc.data().updatedAt?.toDate() || new Date(),
          } as Auction);
        } else {
          setAuction(null);
        }
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [id]);

  return { auction, loading, error };
}
