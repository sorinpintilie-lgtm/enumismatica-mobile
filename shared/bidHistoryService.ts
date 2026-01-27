import {
  collection,
  query,
  orderBy,
  getDocs,
  where,
  limit,
  startAfter,
  getDoc,
  doc,
  Timestamp,
  QueryDocumentSnapshot,
  DocumentData
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import { Bid, AutoBid, BidHistory, BidHistoryStats, User } from './types';

/**
 * Bid History Service for comprehensive bid history visualization and analysis
 */

// Maximum number of bids to fetch for visualization
const MAX_BIDS_FOR_VISUALIZATION = 200;

/**
 * Get comprehensive bid history for an auction with enriched data for visualization
 */
export async function getBidHistoryForAuction(
  auctionId: string,
  limitCount: number = 100
): Promise<{ bids: BidHistory[]; stats: BidHistoryStats }> {
  if (!db) throw new Error('Firestore not initialized');

  // Get all bids for the auction
  const bidsRef = collection(db, 'auctions', auctionId, 'bids');
  const q = query(bidsRef, orderBy('timestamp', 'asc'), limit(limitCount));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return {
      bids: [],
      stats: {
        totalBids: 0,
        totalBidders: 0,
        highestBid: 0,
        lowestBid: 0,
        averageBid: 0,
        totalValue: 0,
        bidFrequency: 0,
        competitionIndex: 0,
        priceTrend: 'stable'
      }
    };
  }

  // Get bids data
  const bids: Bid[] = snapshot.docs.map(docSnap => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      auctionId: data.auctionId,
      userId: data.userId,
      amount: data.amount,
      timestamp: data.timestamp?.toDate() || new Date(),
    };
  });

  // Get user data for bid enrichment
  const userIds = [...new Set(bids.map(bid => bid.userId))];
  const userDataMap = await getUserDataForIds(userIds);

  // Enrich bids with additional data for visualization
  const enrichedBids: BidHistory[] = bids.map((bid, index, array) => {
    const userData = userDataMap.get(bid.userId);

    // Calculate time since previous bid (for bids after the first)
    let timeSincePreviousBid = 0;
    if (index > 0) {
      const previousBidTime = array[index - 1].timestamp.getTime();
      const currentBidTime = bid.timestamp.getTime();
      timeSincePreviousBid = currentBidTime - previousBidTime;
    }

    // Calculate price change (for bids after the first)
    let priceChange = 0;
    let priceChangePercent = 0;
    if (index > 0) {
      const previousAmount = array[index - 1].amount;
      priceChange = bid.amount - previousAmount;
      priceChangePercent = previousAmount > 0 ? (priceChange / previousAmount) * 100 : 0;
    }

    const rawName = userData?.name || `User ${bid.userId.slice(-6)}`;

    return {
      ...bid,
      // Public auction bid history is anonymized: first 3 characters, rest as stars.
      userName: anonymizeUserName(rawName),
      userAvatar: getDefaultAvatar(bid.userId),
      isAutoBid: false, // Will be updated when we check auto-bids
      bidPosition: index + 1,
      timeSincePreviousBid,
      priceChange,
      priceChangePercent
    };
  });

  // Check for auto-bids and mark corresponding bids
  const autoBids = await getAutoBids(auctionId);
  const autoBidUserIds = new Set(autoBids.map(autoBid => autoBid.userId));

  // Mark bids that were placed by users with active auto-bids
  const finalBids = enrichedBids.map(bid => ({
    ...bid,
    isAutoBid: autoBidUserIds.has(bid.userId)
  }));

  // Calculate statistics
  const stats = calculateBidStats(finalBids);

  return { bids: finalBids, stats };
}

/**
 * Get bid history with pagination support
 */
export async function getPaginatedBidHistory(
  auctionId: string,
  pageSize: number = 50,
  lastVisible?: QueryDocumentSnapshot<DocumentData>
): Promise<{
  bids: BidHistory[];
  stats: BidHistoryStats;
  lastVisible: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}> {
  if (!db) throw new Error('Firestore not initialized');

  const bidsRef = collection(db, 'auctions', auctionId, 'bids');

  let q;
  if (lastVisible) {
    q = query(
      bidsRef,
      orderBy('timestamp', 'asc'),
      limit(pageSize),
      startAfter(lastVisible)
    );
  } else {
    q = query(bidsRef, orderBy('timestamp', 'asc'), limit(pageSize));
  }

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return {
      bids: [],
      stats: getEmptyStats(),
      lastVisible: null,
      hasMore: false
    };
  }

  // Get bids data
  const bids: Bid[] = snapshot.docs.map(docSnap => {
    const data = docSnap.data() as any;
    return {
      id: docSnap.id,
      auctionId: data.auctionId,
      userId: data.userId,
      amount: data.amount,
      timestamp: data.timestamp?.toDate() || new Date(),
    };
  });

  // Get user data for bid enrichment
  const userIds = [...new Set(bids.map(bid => bid.userId))];
  const userDataMap = await getUserDataForIds(userIds);

  // Enrich bids
  const enrichedBids: BidHistory[] = bids.map((bid, index, array) => {
    const userData = userDataMap.get(bid.userId);

    let timeSincePreviousBid = 0;
    if (index > 0) {
      const previousBidTime = array[index - 1].timestamp.getTime();
      const currentBidTime = bid.timestamp.getTime();
      timeSincePreviousBid = currentBidTime - previousBidTime;
    }

    let priceChange = 0;
    let priceChangePercent = 0;
    if (index > 0) {
      const previousAmount = array[index - 1].amount;
      priceChange = bid.amount - previousAmount;
      priceChangePercent = previousAmount > 0 ? (priceChange / previousAmount) * 100 : 0;
    }

    const rawName = userData?.name || `User ${bid.userId.slice(-6)}`;

    return {
      ...bid,
      // Public auction bid history (including paginated) is anonymized.
      userName: anonymizeUserName(rawName),
      userAvatar: getDefaultAvatar(bid.userId),
      isAutoBid: false,
      bidPosition: index + 1,
      timeSincePreviousBid,
      priceChange,
      priceChangePercent
    };
  });

  // Check for auto-bids
  const autoBids = await getAutoBids(auctionId);
  const autoBidUserIds = new Set(autoBids.map(autoBid => autoBid.userId));

  const finalBids = enrichedBids.map(bid => ({
    ...bid,
    isAutoBid: autoBidUserIds.has(bid.userId)
  }));

  // Calculate statistics (only for the current page)
  const stats = calculateBidStats(finalBids);

  return {
    bids: finalBids,
    stats,
    lastVisible: snapshot.docs[snapshot.docs.length - 1],
    hasMore: snapshot.docs.length === pageSize
  };
}

/**
 * Get user's bid history across all auctions
 */
export async function getUserBidHistory(
  userId: string,
  limitCount: number = 50
): Promise<BidHistory[]> {
  if (!db) throw new Error('Firestore not initialized');

  // Get all auctions where this user has placed bids
  const auctionsSnapshot = await getDocs(collection(db, 'auctions'));
  const userBids: BidHistory[] = [];

  for (const auctionDoc of auctionsSnapshot.docs) {
    const auctionId = auctionDoc.id;
    const bidsRef = collection(db, 'auctions', auctionId, 'bids');
    const q = query(
      bidsRef,
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(limitCount - userBids.length)
    );

    const bidsSnapshot = await getDocs(q);

    for (const bidDoc of bidsSnapshot.docs) {
      const bidData = bidDoc.data();
      userBids.push({
        id: bidDoc.id,
        auctionId,
        userId: bidData.userId,
        amount: bidData.amount,
        timestamp: bidData.timestamp?.toDate() || new Date(),
        userName: 'You', // Since it's the current user's bids
        userAvatar: getDefaultAvatar(userId),
        isAutoBid: false, // Will check below
        bidPosition: 0, // Will be calculated
        timeSincePreviousBid: 0,
        priceChange: 0,
        priceChangePercent: 0
      });
    }

    // Check if user has auto-bids on this auction
    const autoBidsRef = collection(db, 'auctions', auctionId, 'autoBids');
    const autoBidsQ = query(autoBidsRef, where('userId', '==', userId));
    const autoBidsSnapshot = await getDocs(autoBidsQ);

    if (!autoBidsSnapshot.empty) {
      // Mark the most recent bid as auto-bid if it exists
      if (userBids.length > 0) {
        const lastBidIndex = userBids.length - 1;
        userBids[lastBidIndex] = {
          ...userBids[lastBidIndex],
          isAutoBid: true
        };
      }
    }

    if (userBids.length >= limitCount) break;
  }

  // Sort by timestamp descending (most recent first)
  return userBids.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

/**
 * Get auto-bids for an auction
 */
export async function getAutoBids(auctionId: string): Promise<AutoBid[]> {
  if (!db) throw new Error('Firestore not initialized');

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
 * Get user data for multiple user IDs
 */
async function getUserDataForIds(userIds: string[]): Promise<Map<string, User>> {
  const userDataMap = new Map<string, User>();

  for (const userId of userIds) {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data() as any;
        userDataMap.set(userId, {
          id: userId,
          email: userData.email || '',
          name: userData.name || userData.displayName || `User ${userId.slice(-6)}`,
          role: userData.role || 'user',
          createdAt: userData.createdAt?.toDate() || new Date(),
          lastLogin: userData.lastLogin?.toDate() || new Date()
        });
      }
    } catch (error) {
      console.error(`Failed to fetch user data for ${userId}:`, error);
    }
  }

  return userDataMap;
}

/**
 * Calculate bid statistics
 */
export function calculateBidStats(bids: BidHistory[]): BidHistoryStats {
  if (bids.length === 0) {
    return getEmptyStats();
  }

  const amounts = bids.map(bid => bid.amount);
  const userIds = [...new Set(bids.map(bid => bid.userId))];

  // Calculate time range for bid frequency
  const firstBidTime = bids[0].timestamp.getTime();
  const lastBidTime = bids[bids.length - 1].timestamp.getTime();
  const timeRangeHours = (lastBidTime - firstBidTime) / (1000 * 60 * 60) || 1; // Avoid division by zero

  // Calculate trend (simple linear regression)
  let priceTrend: 'up' | 'down' | 'stable' = 'stable';
  if (bids.length > 1) {
    const firstAmount = bids[0].amount;
    const lastAmount = bids[bids.length - 1].amount;
    const changePercent = ((lastAmount - firstAmount) / firstAmount) * 100;

    if (changePercent > 5) {
      priceTrend = 'up';
    } else if (changePercent < -5) {
      priceTrend = 'down';
    }
  }

  return {
    totalBids: bids.length,
    totalBidders: userIds.length,
    highestBid: Math.max(...amounts),
    lowestBid: Math.min(...amounts),
    averageBid: amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length,
    totalValue: amounts.reduce((sum, amount) => sum + amount, 0),
    bidFrequency: bids.length / timeRangeHours,
    competitionIndex: userIds.length / bids.length,
    priceTrend
  };
}

/**
 * Get empty statistics object
 */
function getEmptyStats(): BidHistoryStats {
  return {
    totalBids: 0,
    totalBidders: 0,
    highestBid: 0,
    lowestBid: 0,
    averageBid: 0,
    totalValue: 0,
    bidFrequency: 0,
    competitionIndex: 0,
    priceTrend: 'stable'
  };
}

/**
 * Generate default avatar URL based on user ID
 */
function getDefaultAvatar(userId: string): string {
  // Use a simple avatar service with user ID for consistent avatars
  const color = Math.abs(hashCode(userId)) % 360; // Hue value 0-359
  return `https://i.pravatar.cc/150?img=${Math.abs(hashCode(userId)) % 70}`;
}

/**
 * Anonymize a user name for public auction bid history:
 * - Keep first 3 visible characters
 * - Replace the rest with '*'
 * - If the name is shorter, keep 1–2 chars and star the rest.
 */
function anonymizeUserName(name: string): string {
  if (!name) return '***';
  const trimmed = name.trim();
  if (trimmed.length <= 1) {
    return trimmed[0] + '**';
  }
  if (trimmed.length <= 3) {
    return trimmed[0] + '*'.repeat(trimmed.length - 1);
  }
  const visible = trimmed.slice(0, 3);
  const stars = '*'.repeat(trimmed.length - 3);
  return visible + stars;
}

/**
 * Simple hash function for consistent avatar generation
 */
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
}

/**
 * Get bid history trends and patterns for analysis
 */
export async function getBidHistoryTrends(
  auctionId: string
): Promise<{
  trendAnalysis: {
    overallTrend: 'up' | 'down' | 'stable';
    volatility: 'low' | 'medium' | 'high';
    biddingIntensity: 'low' | 'medium' | 'high';
  };
  patternAnalysis: {
    hasBidWars: boolean;
    hasSniping: boolean;
    hasEarlyBidding: boolean;
    hasLateBidding: boolean;
  };
}> {
  const { bids } = await getBidHistoryForAuction(auctionId, MAX_BIDS_FOR_VISUALIZATION);

  if (bids.length < 2) {
    return {
      trendAnalysis: {
        overallTrend: 'stable',
        volatility: 'low',
        biddingIntensity: 'low'
      },
      patternAnalysis: {
        hasBidWars: false,
        hasSniping: false,
        hasEarlyBidding: false,
        hasLateBidding: false
      }
    };
  }

  // Calculate trend analysis
  const amounts = bids.map(bid => bid.amount);
  const firstAmount = amounts[0];
  const lastAmount = amounts[amounts.length - 1];
  const totalChange = lastAmount - firstAmount;
  const percentChange = (totalChange / firstAmount) * 100;

  // Calculate volatility (standard deviation of price changes)
  const priceChanges = amounts.slice(1).map((amount, i) => amount - amounts[i]);
  const avgChange = priceChanges.reduce((sum, change) => sum + change, 0) / priceChanges.length;
  const variance = priceChanges.reduce((sum, change) => sum + Math.pow(change - avgChange, 2), 0) / priceChanges.length;
  const stdDev = Math.sqrt(variance);

  // Calculate time analysis
  const firstBidTime = bids[0].timestamp.getTime();
  const lastBidTime = bids[bids.length - 1].timestamp.getTime();
  const totalDuration = lastBidTime - firstBidTime;

  // Check for late bidding (last 10% of auction time)
  const lateBiddingThreshold = firstBidTime + totalDuration * 0.9;
  const lateBids = bids.filter(bid => bid.timestamp.getTime() > lateBiddingThreshold);

  // Check for early bidding (first 10% of auction time)
  const earlyBiddingThreshold = firstBidTime + totalDuration * 0.1;
  const earlyBids = bids.filter(bid => bid.timestamp.getTime() < earlyBiddingThreshold);

  // Calculate time between bids to detect bid wars
  const timeDifferences = bids.slice(1).map((bid, i) =>
    bid.timestamp.getTime() - bids[i].timestamp.getTime()
  );
  const avgTimeBetweenBids = timeDifferences.reduce((sum, diff) => sum + diff, 0) / timeDifferences.length;
  const hasBidWars = timeDifferences.some(diff => diff < 60000); // Bids within 1 minute

  return {
    trendAnalysis: {
      overallTrend: percentChange > 10 ? 'up' : percentChange < -10 ? 'down' : 'stable',
      volatility: stdDev > 50 ? 'high' : stdDev > 20 ? 'medium' : 'low',
      biddingIntensity: avgTimeBetweenBids < 300000 ? 'high' : avgTimeBetweenBids < 1800000 ? 'medium' : 'low'
    },
    patternAnalysis: {
      hasBidWars,
      hasSniping: lateBids.length > 2 && lateBids.length / bids.length > 0.3,
      hasEarlyBidding: earlyBids.length > 0,
      hasLateBidding: lateBids.length > 0
    }
  };
}