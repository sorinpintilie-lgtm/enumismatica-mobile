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
  increment: jest.fn(),
  startAt: jest.fn(),
  endAt: jest.fn(),
}));

import * as helpService from '../helpService';

describe('Help Service', () => {
  const mockArticleId = 'test-article-id';
  const mockCategoryId = 'test-category-id';
  const mockUserId = 'test-user-id';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createHelpArticle', () => {
    it('should create a help article successfully', async () => {
      // Mock the Firebase functions
      const mockCollection = jest.fn().mockReturnValue('helpArticles-collection');
      const mockAddDoc = jest.fn().mockResolvedValue({ id: mockArticleId });

      jest.mock('firebase/firestore', () => ({
        collection: mockCollection,
        addDoc: mockAddDoc,
        serverTimestamp: jest.fn().mockReturnValue(new Date()),
      }));

      const result = await helpService.createHelpArticle({
        title: 'Test Article',
        content: 'Test content',
        categoryId: mockCategoryId,
        createdBy: mockUserId,
        language: 'en',
        tags: ['test', 'article'],
        status: 'draft'
      });

      expect(result.success).toBe(true);
      expect(result.articleId).toBe(mockArticleId);
    });

    it('should return error for invalid input', async () => {
      const result = await helpService.createHelpArticle({
        title: '',
        content: '',
        categoryId: '',
        createdBy: '',
        language: 'en',
        tags: [],
        status: 'draft'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing required fields');
    });
  });

  describe('getHelpArticle', () => {
    it('should get help article successfully', async () => {
      // Mock the Firebase functions
      const mockDoc = jest.fn().mockReturnValue('article-doc');
      const mockGetDoc = jest.fn().mockResolvedValue({
        exists: () => true,
        id: mockArticleId,
        data: () => ({
          title: 'Test Article',
          content: 'Test content',
          categoryId: mockCategoryId,
          language: 'en',
          tags: ['test'],
          createdBy: mockUserId,
          views: 0,
          helpfulCount: 0,
          notHelpfulCount: 0,
          status: 'published',
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date()
        })
      });
      const mockUpdateDoc = jest.fn().mockResolvedValue(undefined);

      jest.mock('firebase/firestore', () => ({
        doc: mockDoc,
        getDoc: mockGetDoc,
        updateDoc: mockUpdateDoc,
        increment: jest.fn().mockReturnValue(1)
      }));

      const result = await helpService.getHelpArticle(mockArticleId);

      expect(result.success).toBe(true);
      expect(result.article).toBeDefined();
      expect(result.article?.id).toBe(mockArticleId);
    });

    it('should return error for invalid article ID', async () => {
      const result = await helpService.getHelpArticle('');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid article ID');
    });
  });

  describe('getHelpArticles', () => {
    it('should get help articles successfully', async () => {
      // Mock the Firebase functions
      const mockCollection = jest.fn().mockReturnValue('helpArticles-collection');
      const mockQuery = jest.fn().mockReturnValue('helpArticles-query');
      const mockGetDocs = jest.fn().mockResolvedValue({
        docs: [
          {
            id: mockArticleId,
            data: () => ({
              title: 'Test Article',
              content: 'Test content',
              categoryId: mockCategoryId,
              language: 'en',
              tags: ['test'],
              createdBy: mockUserId,
              views: 0,
              helpfulCount: 0,
              notHelpfulCount: 0,
              status: 'published',
              version: 1,
              createdAt: new Date(),
              updatedAt: new Date()
            })
          }
        ]
      });

      jest.mock('firebase/firestore', () => ({
        collection: mockCollection,
        query: mockQuery,
        where: jest.fn(),
        orderBy: jest.fn(),
        limit: jest.fn(),
        getDocs: mockGetDocs
      }));

      const result = await helpService.getHelpArticles({
        categoryId: mockCategoryId,
        language: 'en',
        status: 'published'
      });

      expect(result.success).toBe(true);
      expect(result.articles).toBeDefined();
      expect(result.articles?.length).toBe(1);
    });
  });

  describe('searchHelpContent', () => {
    it('should search help content successfully', async () => {
      // Mock the Firebase functions
      const mockCollection = jest.fn().mockReturnValue('helpArticles-collection');
      const mockQuery = jest.fn().mockReturnValue('helpArticles-query');
      const mockGetDocs = jest.fn().mockResolvedValue({
        docs: [
          {
            id: mockArticleId,
            data: () => ({
              title: 'Test Article',
              content: 'Test content with search query',
              categoryId: mockCategoryId,
              language: 'en',
              tags: ['test'],
              createdBy: mockUserId,
              views: 0,
              helpfulCount: 0,
              notHelpfulCount: 0,
              status: 'published',
              version: 1,
              createdAt: new Date(),
              updatedAt: new Date()
            })
          }
        ]
      });

      jest.mock('firebase/firestore', () => ({
        collection: mockCollection,
        query: mockQuery,
        where: jest.fn(),
        orderBy: jest.fn(),
        startAt: jest.fn(),
        endAt: jest.fn(),
        getDocs: mockGetDocs
      }));

      const result = await helpService.searchHelpContent('search query', 'en');

      expect(result.success).toBe(true);
      expect(result.results).toBeDefined();
      expect(result.results?.length).toBe(1);
    });

    it('should return error for short search query', async () => {
      const result = await helpService.searchHelpContent('a', 'en');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Search query too short');
    });
  });

  describe('submitHelpFeedback', () => {
    it('should submit help feedback successfully', async () => {
      // Mock the Firebase functions
      const mockCollection = jest.fn().mockReturnValue('feedback-collection');
      const mockAddDoc = jest.fn().mockResolvedValue(undefined);
      const mockDoc = jest.fn().mockReturnValue('article-doc');
      const mockUpdateDoc = jest.fn().mockResolvedValue(undefined);

      jest.mock('firebase/firestore', () => ({
        collection: mockCollection,
        addDoc: mockAddDoc,
        doc: mockDoc,
        updateDoc: mockUpdateDoc,
        serverTimestamp: jest.fn().mockReturnValue(new Date()),
        increment: jest.fn().mockReturnValue(1)
      }));

      const result = await helpService.submitHelpFeedback(
        mockArticleId,
        mockUserId,
        'helpful',
        'Great article!'
      );

      expect(result.success).toBe(true);
    });

    it('should return error for invalid input', async () => {
      const result = await helpService.submitHelpFeedback('', '', 'helpful');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing required fields');
    });
  });

  describe('getHelpAnalytics', () => {
    it('should get help analytics successfully', async () => {
      // Mock the Firebase functions
      const mockCollection = jest.fn().mockReturnValue('helpArticles-collection');
      const mockQuery = jest.fn().mockReturnValue('helpArticles-query');
      const mockGetDocs = jest.fn().mockResolvedValue({
        docs: [
          {
            id: mockArticleId,
            data: () => ({
              title: 'Test Article',
              content: 'Test content',
              categoryId: mockCategoryId,
              language: 'en',
              tags: ['test'],
              createdBy: mockUserId,
              views: 100,
              helpfulCount: 50,
              notHelpfulCount: 10,
              status: 'published',
              version: 1,
              createdAt: new Date(),
              updatedAt: new Date()
            })
          }
        ]
      });

      jest.mock('firebase/firestore', () => ({
        collection: mockCollection,
        query: mockQuery,
        where: jest.fn(),
        getDocs: mockGetDocs
      }));

      const result = await helpService.getHelpAnalytics();

      expect(result.success).toBe(true);
      expect(result.analytics).toBeDefined();
      expect(result.analytics?.totalArticles).toBe(1);
    });
  });
});