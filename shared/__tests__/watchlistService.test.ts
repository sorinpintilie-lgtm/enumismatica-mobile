declare const jest: any;
declare const describe: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;

jest.mock('../firebaseConfig', () => ({
  db: {},
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  addDoc: jest.fn(),
  deleteDoc: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  updateDoc: jest.fn(),
  onSnapshot: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  serverTimestamp: jest.fn(),
  Timestamp: {
    fromDate: jest.fn(),
  },
}));

import * as watchlistService from '../watchlistService';

describe('Watchlist Service', () => {
  const mockUserId = 'test-user-id';
  const mockItemId = 'test-item-id';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('addToWatchlist', () => {
    it('should add item to watchlist successfully', async () => {
      // Mock the Firebase functions
      const mockCollection = jest.fn().mockReturnValue('watchlist-collection');
      const mockAddDoc = jest.fn().mockResolvedValue({ id: 'new-watchlist-id' });

      jest.mock('firebase/firestore', () => ({
        collection: mockCollection,
        addDoc: mockAddDoc,
        serverTimestamp: jest.fn().mockReturnValue(new Date()),
      }));

      const result = await watchlistService.addToWatchlist(
        mockUserId,
        'product',
        mockItemId,
        'Test notes'
      );

      expect(result.success).toBe(true);
      expect(result.itemId).toBe('new-watchlist-id');
    });

    it('should return error for invalid parameters', async () => {
      const result = await watchlistService.addToWatchlist('', 'product', '');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid parameters');
    });
  });

  describe('removeFromWatchlist', () => {
    it('should remove item from watchlist successfully', async () => {
      // Mock the Firebase functions
      const mockCollection = jest.fn().mockReturnValue('watchlist-collection');
      const mockQuery = jest.fn().mockReturnValue('watchlist-query');
      const mockGetDocs = jest.fn().mockResolvedValue({
        empty: false,
        docs: [{ ref: 'doc-ref' }],
      });
      const mockDeleteDoc = jest.fn().mockResolvedValue(undefined);

      jest.mock('firebase/firestore', () => ({
        collection: mockCollection,
        query: mockQuery,
        where: jest.fn(),
        getDocs: mockGetDocs,
        deleteDoc: mockDeleteDoc,
      }));

      const result = await watchlistService.removeFromWatchlist(
        mockUserId,
        mockItemId
      );

      expect(result.success).toBe(true);
    });
  });

  describe('getUserWatchlist', () => {
    it('should get user watchlist successfully', async () => {
      // Mock the Firebase functions
      const mockCollection = jest.fn().mockReturnValue('watchlist-collection');
      const mockQuery = jest.fn().mockReturnValue('watchlist-query');
      const mockGetDocs = jest.fn().mockResolvedValue({
        empty: false,
        docs: [
          {
            id: 'item1',
            data: () => ({
              userId: mockUserId,
              itemType: 'product',
              itemId: mockItemId,
              addedAt: new Date(),
            }),
          },
        ],
      });

      jest.mock('firebase/firestore', () => ({
        collection: mockCollection,
        query: mockQuery,
        orderBy: jest.fn(),
        getDocs: mockGetDocs,
      }));

      const result = await watchlistService.getUserWatchlist(mockUserId);

      expect(result.success).toBe(true);
      expect(result.items).toHaveLength(1);
    });
  });

  describe('checkWatchlistStatus', () => {
    it('should return true when item exists in watchlist', async () => {
      // Mock the Firebase functions
      const mockCollection = jest.fn().mockReturnValue('watchlist-collection');
      const mockQuery = jest.fn().mockReturnValue('watchlist-query');
      const mockGetDocs = jest.fn().mockResolvedValue({
        empty: false,
        docs: [
          {
            id: 'item1',
            data: () => ({
              userId: mockUserId,
              itemType: 'product',
              itemId: mockItemId,
              addedAt: new Date(),
            }),
          },
        ],
      });

      jest.mock('firebase/firestore', () => ({
        collection: mockCollection,
        query: mockQuery,
        where: jest.fn(),
        getDocs: mockGetDocs,
      }));

      const result = await watchlistService.checkWatchlistStatus(
        mockUserId,
        mockItemId
      );

      expect(result.exists).toBe(true);
    });
  });
});