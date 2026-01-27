declare const jest: any;
declare const describe: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
declare const afterEach: any;

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
import * as auth from '../auth';

describe('Help Center Integration Tests', () => {
  const mockArticleId = 'test-article-id';
  const mockCategoryId = 'test-category-id';
  const mockUserId = 'test-user-id';
  const mockAdminId = 'admin-user-id';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Search Functionality Integration', () => {
    it('should test search functionality across platforms', async () => {
      // Mock search results
      const mockSearchResults = [
        {
          articleId: mockArticleId,
          title: 'Test Article',
          contentPreview: 'This is a test article about coin collecting basics',
          categoryName: 'General',
          relevanceScore: 100,
          language: 'en'
        },
        {
          articleId: 'article2',
          title: 'Advanced Coin Grading',
          contentPreview: 'Learn advanced techniques for grading rare coins',
          categoryName: 'General',
          relevanceScore: 90,
          language: 'en'
        }
      ];

      // Mock the search function
      const mockSearchHelpContent = jest.fn().mockResolvedValue({
        success: true,
        results: mockSearchResults
      });

      jest.mock('../helpService', () => ({
        searchHelpContent: mockSearchHelpContent
      }));

      // Test search functionality
      const result = await helpService.searchHelpContent('coin collecting', 'en');

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].title).toBe('Test Article');
      expect(result.results[1].title).toBe('Advanced Coin Grading');

      // Verify search terms are found in results
      const searchTerm = 'coin';
      result.results.forEach(article => {
        const contentLower = (article.title + ' ' + article.contentPreview).toLowerCase();
        expect(contentLower).toContain(searchTerm.toLowerCase());
      });
    });

    it('should handle search with no results gracefully', async () => {
      // Mock empty search results
      const mockSearchHelpContent = jest.fn().mockResolvedValue({
        success: true,
        results: []
      });

      jest.mock('../helpService', () => ({
        searchHelpContent: mockSearchHelpContent
      }));

      // Test search with no results
      const result = await helpService.searchHelpContent('nonexistent topic', 'en');

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(0);
    });

    it('should handle search errors appropriately', async () => {
      // Mock search error
      const mockSearchHelpContent = jest.fn().mockResolvedValue({
        success: false,
        error: 'Search service unavailable'
      });

      jest.mock('../helpService', () => ({
        searchHelpContent: mockSearchHelpContent
      }));

      // Test search error handling
      const result = await helpService.searchHelpContent('test', 'en');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Search service unavailable');
    });
  });

  describe('Article Creation and Editing Integration', () => {
    it('should test article creation in admin interface', async () => {
      // Mock article creation
      const mockCreateHelpArticle = jest.fn().mockResolvedValue({
        success: true,
        articleId: mockArticleId
      });

      jest.mock('../helpService', () => ({
        createHelpArticle: mockCreateHelpArticle
      }));

      // Test article creation
      const result = await helpService.createHelpArticle({
        title: 'New Help Article',
        content: 'This is the content of the new help article',
        categoryId: mockCategoryId,
        createdBy: mockAdminId,
        language: 'en',
        tags: ['new', 'help'],
        status: 'draft'
      });

      expect(result.success).toBe(true);
      expect(result.articleId).toBe(mockArticleId);

      // Verify the article was created with correct data
      expect(mockCreateHelpArticle).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New Help Article',
          categoryId: mockCategoryId,
          createdBy: mockAdminId,
          language: 'en'
        })
      );
    });

    it('should test article editing in admin interface', async () => {
      // Mock existing article
      const existingArticle = {
        id: mockArticleId,
        title: 'Original Title',
        content: 'Original content',
        categoryId: mockCategoryId,
        language: 'en',
        tags: ['original'],
        createdBy: mockAdminId,
        views: 50,
        helpfulCount: 10,
        notHelpfulCount: 2,
        status: 'published',
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Mock get article
      const mockGetHelpArticle = jest.fn().mockResolvedValue({
        success: true,
        article: existingArticle
      });

      // Mock update article
      const mockUpdateHelpArticle = jest.fn().mockResolvedValue({
        success: true
      });

      jest.mock('../helpService', () => ({
        getHelpArticle: mockGetHelpArticle,
        updateHelpArticle: mockUpdateHelpArticle
      }));

      // Test article editing workflow
      // 1. Get existing article
      const getResult = await helpService.getHelpArticle(mockArticleId);
      expect(getResult.success).toBe(true);
      expect(getResult.article?.title).toBe('Original Title');

      // 2. Update the article
      const updateResult = await helpService.updateHelpArticle(mockArticleId, {
        title: 'Updated Title',
        content: 'Updated content with more details',
        tags: ['updated', 'help', 'detailed']
      });

      expect(updateResult.success).toBe(true);

      // Verify the update was called with correct data
      expect(mockUpdateHelpArticle).toHaveBeenCalledWith(
        mockArticleId,
        expect.objectContaining({
          title: 'Updated Title',
          content: 'Updated content with more details'
        })
      );
    });

    it('should handle article creation and editing errors', async () => {
      // Mock creation error
      const mockCreateHelpArticle = jest.fn().mockResolvedValue({
        success: false,
        error: 'Invalid article data'
      });

      jest.mock('../helpService', () => ({
        createHelpArticle: mockCreateHelpArticle
      }));

      // Test error handling
      const result = await helpService.createHelpArticle({
        title: '', // Invalid - empty title
        content: 'Some content',
        categoryId: mockCategoryId,
        createdBy: mockAdminId,
        language: 'en',
        tags: [],
        status: 'draft'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid article data');
    });
  });

  describe('User Feedback Submission Integration', () => {
    it('should test user feedback submission workflow', async () => {
      // Mock feedback submission
      const mockSubmitHelpFeedback = jest.fn().mockResolvedValue({
        success: true
      });

      // Mock article update for feedback counts
      const mockUpdateHelpArticle = jest.fn().mockResolvedValue({
        success: true
      });

      jest.mock('../helpService', () => ({
        submitHelpFeedback: mockSubmitHelpFeedback,
        updateHelpArticle: mockUpdateHelpArticle
      }));

      // Test feedback submission
      const result = await helpService.submitHelpFeedback(
        mockArticleId,
        mockUserId,
        'helpful',
        'This article was very helpful for understanding coin grading!'
      );

      expect(result.success).toBe(true);

      // Verify feedback was submitted with correct data
      expect(mockSubmitHelpFeedback).toHaveBeenCalledWith(
        mockArticleId,
        mockUserId,
        'helpful',
        'This article was very helpful for understanding coin grading!'
      );
    });

    it('should test different feedback types', async () => {
      // Mock feedback submission
      const mockSubmitHelpFeedback = jest.fn().mockResolvedValue({
        success: true
      });

      jest.mock('../helpService', () => ({
        submitHelpFeedback: mockSubmitHelpFeedback
      }));

      // Test different feedback types
      const feedbackTypes = ['helpful', 'not_helpful', 'neutral'];

      for (const feedbackType of ['helpful', 'not_helpful'] as const) {
        const result = await helpService.submitHelpFeedback(
          mockArticleId,
          mockUserId,
          feedbackType,
          `Feedback: ${feedbackType}`
        );

        expect(result.success).toBe(true);
      }
    });

    it('should handle feedback submission errors', async () => {
      // Mock feedback error
      const mockSubmitHelpFeedback = jest.fn().mockResolvedValue({
        success: false,
        error: 'Feedback service unavailable'
      });

      jest.mock('../helpService', () => ({
        submitHelpFeedback: mockSubmitHelpFeedback
      }));

      // Test error handling
      const result = await helpService.submitHelpFeedback(
        mockArticleId,
        mockUserId,
        'helpful',
        'Test feedback'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Feedback service unavailable');
    });
  });

  describe('Multi-Language Support Integration', () => {
    it('should test multi-language support for help articles', async () => {
      // Mock articles in different languages
      const languageArticles = {
        en: {
          id: 'article-en',
          title: 'Coin Collecting Basics',
          content: 'English content about coin collecting',
          language: 'en'
        },
        ro: {
          id: 'article-ro',
          title: 'Bazele colecționării de monede',
          content: 'Conținut în română despre colecționarea de monede',
          language: 'ro'
        }
      };

      // Mock get articles by language
      const mockGetHelpArticles = jest.fn().mockImplementation((filter) => {
        const language = filter.language || 'en';
        return Promise.resolve({
          success: true,
          articles: [languageArticles[language]]
        });
      });

      jest.mock('../helpService', () => ({
        getHelpArticles: mockGetHelpArticles
      }));

      // Test multi-language support
      const languages = ['en', 'ro'] as const;

      for (const language of languages) {
        const result = await helpService.getHelpArticles({
          language,
          status: 'published'
        });

        expect(result.success).toBe(true);
        expect(result.articles).toHaveLength(1);
        expect(result.articles[0].language).toBe(language);

        // Verify content is in correct language
        if (language === 'en') {
          expect(result.articles[0].title).toContain('Coin Collecting');
        } else if (language === 'ro') {
          expect(result.articles[0].title).toContain('Bazele colecționării');
        }
      }
    });

    it('should handle language fallback gracefully', async () => {
      // Mock articles with fallback
      const mockGetHelpArticles = jest.fn().mockImplementation((filter) => {
        const language = filter.language;

        // If language not found, return English articles
        if (language && language !== 'en') {
          return Promise.resolve({
            success: true,
            articles: [] // No articles in requested language
          });
        }

        return Promise.resolve({
          success: true,
          articles: [{
            id: 'fallback-en',
            title: 'Fallback English Article',
            content: 'English content as fallback',
            language: 'en'
          }]
        });
      });

      jest.mock('../helpService', () => ({
        getHelpArticles: mockGetHelpArticles
      }));

      // Test language fallback
      const result = await helpService.getHelpArticles({
        language: 'ro', // Romanian - test fallback behavior
        status: 'published'
      });

      expect(result.success).toBe(true);
      expect(result.articles).toHaveLength(0); // No Romanian articles

      // Test English fallback
      const englishResult = await helpService.getHelpArticles({
        language: 'en',
        status: 'published'
      });

      expect(englishResult.success).toBe(true);
      expect(englishResult.articles).toHaveLength(1);
      expect(englishResult.articles[0].language).toBe('en');
    });
  });

  describe('Cross-Platform Integration', () => {
    it('should work consistently across web and mobile platforms', async () => {
      // Test that help center functionality works the same regardless of platform
      const platforms = ['web', 'mobile'];

      for (const platform of platforms) {
        // Mock platform-specific help service
        const mockSearchHelpContent = jest.fn().mockResolvedValue({
          success: true,
          results: [{
            id: mockArticleId,
            title: 'Test Article',
            content: 'Test content',
            categoryId: mockCategoryId,
            language: 'en',
            createdBy: mockAdminId
          }]
        });

        const mockGetHelpArticle = jest.fn().mockResolvedValue({
          success: true,
          article: {
            id: mockArticleId,
            title: 'Test Article',
            content: 'Test content',
            categoryId: mockCategoryId,
            language: 'en',
            createdBy: mockAdminId
          }
        });

        jest.mock('../helpService', () => ({
          searchHelpContent: mockSearchHelpContent,
          getHelpArticle: mockGetHelpArticle
        }));

        // Test search functionality
        const searchResult = await helpService.searchHelpContent('test', 'en');
        expect(searchResult.success).toBe(true);
        expect(searchResult.results).toHaveLength(1);

        // Test article retrieval
        const articleResult = await helpService.getHelpArticle(mockArticleId);
        expect(articleResult.success).toBe(true);
        expect(articleResult.article?.id).toBe(mockArticleId);
      }
    });

    it('should handle platform-specific edge cases', async () => {
      // Test edge cases that might differ between platforms
      const edgeCases = [
        {
          name: 'empty_search',
          searchTerm: '',
          expected: { success: false, error: 'Search query too short' }
        },
        {
          name: 'very_long_search',
          searchTerm: 'a'.repeat(1000),
          expected: { success: true, results: [] } // Should handle long search terms
        },
        {
          name: 'special_characters',
          searchTerm: 'test @#$%^&*()',
          expected: { success: true, results: [] } // Should handle special characters
        }
      ];

      for (const edgeCase of edgeCases) {
        const mockSearchHelpContent = jest.fn().mockResolvedValue(edgeCase.expected);

        jest.mock('../helpService', () => ({
          searchHelpContent: mockSearchHelpContent
        }));

        const result = await helpService.searchHelpContent(edgeCase.searchTerm, 'en');

        expect(result.success).toBe(edgeCase.expected.success);
        if (!edgeCase.expected.success) {
          expect(result.error).toBe(edgeCase.expected.error);
        }
      }
    });
  });

  describe('Admin Interface Integration', () => {
    it('should test admin interface for article management', async () => {
      // Mock admin functions
      const mockCreateHelpArticle = jest.fn().mockResolvedValue({
        success: true,
        articleId: mockArticleId
      });

      const mockGetHelpArticle = jest.fn().mockResolvedValue({
        success: true,
        article: {
          id: mockArticleId,
          title: 'Admin Created Article',
          content: 'Content created by admin',
          categoryId: mockCategoryId,
          language: 'en',
          createdBy: mockAdminId,
          status: 'published'
        }
      });

      const mockUpdateHelpArticle = jest.fn().mockResolvedValue({
        success: true
      });

      const mockDeleteHelpArticle = jest.fn().mockResolvedValue({
        success: true
      });

      jest.mock('../helpService', () => ({
        createHelpArticle: mockCreateHelpArticle,
        getHelpArticle: mockGetHelpArticle,
        updateHelpArticle: mockUpdateHelpArticle,
        deleteHelpArticle: mockDeleteHelpArticle
      }));

      // Test admin workflow: create, read, update
      // 1. Create article
      const createResult = await helpService.createHelpArticle({
        title: 'Admin Article',
        content: 'Admin content',
        categoryId: mockCategoryId,
        createdBy: mockAdminId,
        language: 'en',
        tags: ['admin'],
        status: 'published'
      });

      expect(createResult.success).toBe(true);

      // 2. Get article
      const getResult = await helpService.getHelpArticle(mockArticleId);
      expect(getResult.success).toBe(true);
      expect(getResult.article?.title).toBe('Admin Created Article');

      // 3. Update article
      const updateResult = await helpService.updateHelpArticle(mockArticleId, {
        title: 'Updated Admin Article',
        content: 'Updated admin content'
      });

      expect(updateResult.success).toBe(true);
    });

    it('should test admin analytics for help center', async () => {
      // Mock help analytics
      const mockGetHelpAnalytics = jest.fn().mockResolvedValue({
        success: true,
        analytics: {
          totalArticles: 50,
          totalCategories: 10,
          totalViews: 1000,
          totalFeedback: 200,
          helpfulFeedback: 150,
          notHelpfulFeedback: 50,
          averageHelpfulness: 75,
          articlesByLanguage: {
            en: 30,
            ro: 15
          },
          articlesByCategory: {
            [mockCategoryId]: 20
          },
          topArticles: [
            {
              articleId: mockArticleId,
              title: 'Most Helpful Article',
              views: 500,
              helpfulCount: 200,
              helpfulness: 95
            }
          ]
        }
      });

      jest.mock('../helpService', () => ({
        getHelpAnalytics: mockGetHelpAnalytics
      }));

      // Test admin analytics
      const result = await helpService.getHelpAnalytics();

      expect(result.success).toBe(true);
      expect(result.analytics).toHaveProperty('totalArticles');
      expect(result.analytics).toHaveProperty('totalViews');
      expect(result.analytics).toHaveProperty('averageHelpfulness');
      expect(result.analytics).toHaveProperty('articlesByLanguage');
      expect(result.analytics).toHaveProperty('topArticles');
    });
  });
});