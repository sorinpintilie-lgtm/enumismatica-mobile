import { useState, useEffect } from 'react';
import {
  collection,
  query,
  orderBy,
  where,
  limit,
  getDocs,
  doc,
  getDoc,
} from '@shared/firebaseConfig';
import { db } from '@shared/firebaseConfig';
import { Auction } from '@shared/types';
import { Cache } from '../utils/cache';

// Default fields for auction list view - optimize for performance
const DEFAULT_AUCTION_FIELDS = ['productId', 'startTime', 'endTime', 'reservePrice', 'currentBid', 'currentBidderId', 'status', 'createdAt', 'updatedAt'];

export function useCachedAuctions(status?: 'active' | 'ended' | 'cancelled', pageSize: number = 20, fields: string[] = DEFAULT_AUCTION_FIELDS) {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cacheKey = `auctions_${status || 'all'}_${pageSize}_${fields.sort().join('_')}`;

    const fetchAuctions = async () => {
      try {
        // Try to get from cache first
        const cached = await Cache.get<Auction[]>(cacheKey);
        if (cached) {
          setAuctions(cached);
          setLoading(false);
          return;
        }

        // Fetch from Firestore
        let q = query(collection(db, 'auctions'), orderBy('createdAt', 'desc'), limit(pageSize));

        if (status) {
          q = query(q, where('status', '==', status));
        }

        const querySnapshot = await getDocs(q);
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

        // Cache the result (shorter TTL for auctions since they change more frequently)
        await Cache.set(cacheKey, auctionsData, { ttl: 2 * 60 * 1000 }); // 2 minutes

        setAuctions(auctionsData);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        setLoading(false);
      }
    };

    fetchAuctions();
  }, [status, pageSize, fields]);

  return { auctions, loading, error };
}

export function useCachedAuction(id: string, fields: string[] = DEFAULT_AUCTION_FIELDS) {
  const [auction, setAuction] = useState<Auction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const cacheKey = `auction_${id}_${fields.sort().join('_')}`;

    const fetchAuction = async () => {
      try {
        // Try to get from cache first
        const cached = await Cache.get<Auction>(cacheKey);
        if (cached) {
          setAuction(cached);
          setLoading(false);
          return;
        }

        // Fetch from Firestore
        const docRef = doc(db, 'auctions', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          const auctionData: any = { id: docSnap.id };

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

          const auction = auctionData as Auction;

          // Cache the result (very short TTL for auction details)
          await Cache.set(cacheKey, auction, { ttl: 30 * 1000 }); // 30 seconds

          setAuction(auction);
        } else {
          setAuction(null);
        }
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        setLoading(false);
      }
    };

    fetchAuction();
  }, [id, fields]);

  return { auction, loading, error };
}
