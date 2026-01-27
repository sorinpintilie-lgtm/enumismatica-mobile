import {
  collection,
  addDoc,
  query,
  orderBy,
  getDocs,
  Timestamp,
  serverTimestamp,
  limit,
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import { PriceHistory } from './types';

/**
 * Add a price history entry for a product
 */
export async function addProductPriceHistory(
  productId: string,
  price: number,
  source: PriceHistory['source'],
  note?: string
): Promise<string> {
  if (!db) throw new Error('Firestore not initialized');

  const historyRef = collection(db, 'products', productId, 'priceHistory');
  
  const data = {
    price,
    source,
    note: note || undefined,
    timestamp: serverTimestamp(),
  };

  const docRef = await addDoc(historyRef, data);
  return docRef.id;
}

/**
 * Add a price history entry for an auction (from bids)
 */
export async function addAuctionPriceHistory(
  auctionId: string,
  price: number,
  source: PriceHistory['source'] = 'auction_bid',
  note?: string
): Promise<string> {
  if (!db) throw new Error('Firestore not initialized');

  const historyRef = collection(db, 'auctions', auctionId, 'priceHistory');
  
  const data = {
    price,
    source,
    note: note || undefined,
    timestamp: serverTimestamp(),
  };

  const docRef = await addDoc(historyRef, data);
  return docRef.id;
}

/**
 * Get price history for a product
 */
export async function getProductPriceHistory(
  productId: string,
  limitCount: number = 100
): Promise<PriceHistory[]> {
  if (!db) throw new Error('Firestore not initialized');

  const historyRef = collection(db, 'products', productId, 'priceHistory');
  const q = query(historyRef, orderBy('timestamp', 'asc'), limit(limitCount));
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    timestamp: doc.data().timestamp?.toDate() || new Date(),
  })) as PriceHistory[];
}

/**
 * Get price history for an auction (bid evolution)
 */
export async function getAuctionPriceHistory(
  auctionId: string,
  limitCount: number = 100
): Promise<PriceHistory[]> {
  if (!db) throw new Error('Firestore not initialized');

  const historyRef = collection(db, 'auctions', auctionId, 'priceHistory');
  const q = query(historyRef, orderBy('timestamp', 'asc'), limit(limitCount));
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    timestamp: doc.data().timestamp?.toDate() || new Date(),
  })) as PriceHistory[];
}

/**
 * Get price statistics for a product
 */
export async function getProductPriceStats(productId: string): Promise<{
  currentPrice: number;
  highestPrice: number;
  lowestPrice: number;
  averagePrice: number;
  priceChange: number;
  priceChangePercent: number;
}> {
  const history = await getProductPriceHistory(productId);
  
  if (history.length === 0) {
    return {
      currentPrice: 0,
      highestPrice: 0,
      lowestPrice: 0,
      averagePrice: 0,
      priceChange: 0,
      priceChangePercent: 0,
    };
  }

  const prices = history.map(h => h.price);
  const currentPrice = prices[prices.length - 1];
  const firstPrice = prices[0];
  const highestPrice = Math.max(...prices);
  const lowestPrice = Math.min(...prices);
  const averagePrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
  const priceChange = currentPrice - firstPrice;
  const priceChangePercent = firstPrice > 0 ? (priceChange / firstPrice) * 100 : 0;

  return {
    currentPrice,
    highestPrice,
    lowestPrice,
    averagePrice,
    priceChange,
    priceChangePercent,
  };
}