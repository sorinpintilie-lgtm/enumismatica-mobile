declare const jest: any;
declare const describe: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;

jest.mock('../firebaseConfig', () => ({
  db: {
    collection: jest.fn(),
  },
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  query: jest.fn(),
  orderBy: jest.fn(),
  getDocs: jest.fn(),
  where: jest.fn(),
  limit: jest.fn(),
  startAfter: jest.fn(),
  getDoc: jest.fn(),
  doc: jest.fn(),
  Timestamp: {
    fromDate: jest.fn(),
  },
}));

import { calculateBidStats } from '../bidHistoryService';
import { BidHistory, BidHistoryStats } from '../types';

describe('Bid History Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateBidStats', () => {
    it('should calculate correct statistics for empty bid history', () => {
      const result = calculateBidStats([]);
      const expected: BidHistoryStats = {
        totalBids: 0,
        totalBidders: 0,
        highestBid: 0,
        lowestBid: 0,
        averageBid: 0,
        totalValue: 0,
        bidFrequency: 0,
        competitionIndex: 0,
        priceTrend: 'stable',
      };

      expect(result).toEqual(expected);
    });

    it('should calculate correct statistics for single bid', () => {
      const bids: BidHistory[] = [
        {
          id: 'bid1',
          auctionId: 'auction1',
          userId: 'user1',
          amount: 100,
          timestamp: new Date('2023-01-01T10:00:00Z'),
          userName: 'User 1',
          userAvatar: 'avatar1.jpg',
          isAutoBid: false,
          bidPosition: 1,
          timeSincePreviousBid: 0,
          priceChange: 0,
          priceChangePercent: 0,
        },
      ];

      const result = calculateBidStats(bids);
      expect(result.totalBids).toBe(1);
      expect(result.totalBidders).toBe(1);
      expect(result.highestBid).toBe(100);
      expect(result.lowestBid).toBe(100);
      expect(result.averageBid).toBe(100);
      expect(result.totalValue).toBe(100);
      expect(result.priceTrend).toBe('stable');
    });

    it('should calculate correct statistics for multiple bids with upward trend', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const bids: BidHistory[] = [
        {
          id: 'bid1',
          auctionId: 'auction1',
          userId: 'user1',
          amount: 100,
          timestamp: oneHourAgo,
          userName: 'User 1',
          userAvatar: 'avatar1.jpg',
          isAutoBid: false,
          bidPosition: 1,
          timeSincePreviousBid: 0,
          priceChange: 0,
          priceChangePercent: 0,
        },
        {
          id: 'bid2',
          auctionId: 'auction1',
          userId: 'user2',
          amount: 150,
          timestamp: now,
          userName: 'User 2',
          userAvatar: 'avatar2.jpg',
          isAutoBid: false,
          bidPosition: 2,
          timeSincePreviousBid: 60 * 60 * 1000,
          priceChange: 50,
          priceChangePercent: 50,
        },
      ];

      const result = calculateBidStats(bids);
      expect(result.totalBids).toBe(2);
      expect(result.totalBidders).toBe(2);
      expect(result.highestBid).toBe(150);
      expect(result.lowestBid).toBe(100);
      expect(result.averageBid).toBe(125);
      expect(result.totalValue).toBe(250);
      expect(result.bidFrequency).toBeCloseTo(2); // 2 bids per hour
      expect(result.competitionIndex).toBe(1); // 2 bidders / 2 bids
      expect(result.priceTrend).toBe('up'); // 50% increase
    });

    it('should calculate correct statistics for multiple bids with downward trend', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const bids: BidHistory[] = [
        {
          id: 'bid1',
          auctionId: 'auction1',
          userId: 'user1',
          amount: 200,
          timestamp: oneHourAgo,
          userName: 'User 1',
          userAvatar: 'avatar1.jpg',
          isAutoBid: false,
          bidPosition: 1,
          timeSincePreviousBid: 0,
          priceChange: 0,
          priceChangePercent: 0,
        },
        {
          id: 'bid2',
          auctionId: 'auction1',
          userId: 'user2',
          amount: 150,
          timestamp: now,
          userName: 'User 2',
          userAvatar: 'avatar2.jpg',
          isAutoBid: false,
          bidPosition: 2,
          timeSincePreviousBid: 60 * 60 * 1000,
          priceChange: -50,
          priceChangePercent: -25,
        },
      ];

      const result = calculateBidStats(bids);
      expect(result.totalBids).toBe(2);
      expect(result.totalBidders).toBe(2);
      expect(result.highestBid).toBe(200);
      expect(result.lowestBid).toBe(150);
      expect(result.averageBid).toBe(175);
      expect(result.totalValue).toBe(350);
      expect(result.priceTrend).toBe('down'); // -25% decrease
    });

    it('should handle edge cases with zero amounts', () => {
      const bids: BidHistory[] = [
        {
          id: 'bid1',
          auctionId: 'auction1',
          userId: 'user1',
          amount: 0,
          timestamp: new Date(),
          userName: 'User 1',
          userAvatar: 'avatar1.jpg',
          isAutoBid: false,
          bidPosition: 1,
          timeSincePreviousBid: 0,
          priceChange: 0,
          priceChangePercent: 0,
        },
      ];

      const result = calculateBidStats(bids);
      expect(result.totalBids).toBe(1);
      expect(result.highestBid).toBe(0);
      expect(result.lowestBid).toBe(0);
      expect(result.averageBid).toBe(0);
      expect(result.priceTrend).toBe('stable');
    });
  });
});