/**
 * Help Center Service for eNumismatica.ro
 * Provides comprehensive help content management and retrieval
 */

import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  onSnapshot,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  increment,
  startAt,
  endAt,
  or,
  and
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import {
  HelpArticle,
  HelpCategory,
  HelpSearchResult,
  HelpFeedback,
  HelpAnalytics
} from './types';
import { getAuth } from 'firebase/auth';

/**
 * Create a new help article
 */
export async function createHelpArticle(
  articleData: Omit<HelpArticle, 'id' | 'createdAt' | 'updatedAt' | 'views' | 'helpfulCount' | 'notHelpfulCount' | 'version'> & {
    createdBy: string;
  } & Partial<Pick<HelpArticle, 'language' | 'tags' | 'status'>>
): Promise<{ success: boolean; articleId?: string; error?: string }> {
  try {
    // Validate input
    if (!articleData.title || !articleData.content || !articleData.categoryId || !articleData.createdBy) {
      return { success: false, error: 'Missing required fields' };
    }

    // Sanitize content to prevent XSS
    const sanitizedContent = sanitizeHtml(articleData.content);
    const sanitizedTitle = sanitizeHtml(articleData.title);

    // Create help article
    const helpArticlesRef = collection(db, 'helpArticles');
    const docRef = await addDoc(helpArticlesRef, {
      title: sanitizedTitle,
      content: sanitizedContent,
      categoryId: articleData.categoryId,
      language: articleData.language || 'en',
      tags: articleData.tags || [],
      createdBy: articleData.createdBy,
      views: 0,
      helpfulCount: 0,
      notHelpfulCount: 0,
      status: articleData.status || 'draft',
      version: 1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    return { success: true, articleId: docRef.id };
  } catch (error) {
    console.error('Error creating help article:', error);
    return { success: false, error: 'Failed to create help article' };
  }
}

/**
 * Update an existing help article
 */
export async function updateHelpArticle(
  articleId: string,
  updateData: Partial<Omit<HelpArticle, 'id' | 'createdAt' | 'updatedAt' | 'views' | 'helpfulCount' | 'notHelpfulCount' | 'version'>>
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate input
    if (!articleId) {
      return { success: false, error: 'Invalid article ID' };
    }

    // Get current article to increment version
    const articleRef = doc(db, 'helpArticles', articleId);
    const articleSnap = await getDoc(articleRef);

    if (!articleSnap.exists()) {
      return { success: false, error: 'Article not found' };
    }

    const currentData = articleSnap.data() as HelpArticle;

    // Sanitize content
    const sanitizedContent = updateData.content ? sanitizeHtml(updateData.content) : undefined;
    const sanitizedTitle = updateData.title ? sanitizeHtml(updateData.title) : undefined;

    // Update article
    await updateDoc(articleRef, {
      title: sanitizedTitle || currentData.title,
      content: sanitizedContent || currentData.content,
      categoryId: updateData.categoryId || currentData.categoryId,
      language: updateData.language || currentData.language,
      tags: updateData.tags || currentData.tags,
      status: updateData.status || currentData.status,
      version: increment(1),
      updatedAt: serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    console.error('Error updating help article:', error);
    return { success: false, error: 'Failed to update help article' };
  }
}

/**
 * Get a specific help article by ID
 */
export async function getHelpArticle(
  articleId: string
): Promise<{ success: boolean; article?: HelpArticle; error?: string }> {
  try {
    if (!articleId) {
      return { success: false, error: 'Invalid article ID' };
    }

    const articleRef = doc(db, 'helpArticles', articleId);
    const articleSnap = await getDoc(articleRef);

    if (!articleSnap.exists()) {
      return { success: false, error: 'Article not found' };
    }

    const article = {
      id: articleSnap.id,
      ...articleSnap.data()
    } as HelpArticle;

    // Increment view count
    await updateDoc(articleRef, {
      views: increment(1)
    });

    return { success: true, article };
  } catch (error) {
    console.error('Error getting help article:', error);
    return { success: false, error: 'Failed to retrieve help article' };
  }
}

/**
 * Get help articles with filtering options
 */
export async function getHelpArticles(
  options: {
    categoryId?: string;
    language?: 'ro' | 'en';
    status?: 'published' | 'draft' | 'archived';
    limitCount?: number;
    tags?: string[];
    searchQuery?: string;
  } = {}
): Promise<{ success: boolean; articles?: HelpArticle[]; error?: string }> {
  try {
    let helpArticlesRef = collection(db, 'helpArticles');

    // Build query
    let queryConstraints = [];

    // Filter by status (default to published)
    if (options.status) {
      queryConstraints.push(where('status', '==', options.status));
    } else {
      queryConstraints.push(where('status', '==', 'published'));
    }

    // Filter by category if provided
    if (options.categoryId) {
      queryConstraints.push(where('categoryId', '==', options.categoryId));
    }

    // Filter by language if provided
    if (options.language) {
      queryConstraints.push(where('language', '==', options.language));
    }

    // Add ordering
    queryConstraints.push(orderBy('updatedAt', 'desc'));

    // Add limit if provided
    if (options.limitCount) {
      queryConstraints.push(limit(options.limitCount));
    }

    const q = query(helpArticlesRef, ...queryConstraints);
    const snapshot = await getDocs(q);

    const articles = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as HelpArticle[];

    return { success: true, articles };
  } catch (error) {
    console.error('Error getting help articles:', error);
    return { success: false, error: 'Failed to retrieve help articles' };
  }
}

/**
 * Search help content with natural language processing
 */
export async function searchHelpContent(
  searchQuery: string,
  language: 'ro' | 'en' = 'en'
): Promise<{ success: boolean; results?: HelpSearchResult[]; error?: string }> {
  try {
    if (!searchQuery || searchQuery.trim().length < 2) {
      return { success: false, error: 'Search query too short' };
    }

    // Simple search implementation - in production would use more advanced NLP
    const helpArticlesRef = collection(db, 'helpArticles');

    // Search in titles and content
    const titleQuery = query(
      helpArticlesRef,
      where('language', '==', language),
      where('status', '==', 'published'),
      orderBy('title'),
      startAt(searchQuery),
      endAt(searchQuery + '\uf8ff')
    );

    const contentQuery = query(
      helpArticlesRef,
      where('language', '==', language),
      where('status', '==', 'published'),
      orderBy('content'),
      startAt(searchQuery),
      endAt(searchQuery + '\uf8ff')
    );

    const [titleResults, contentResults] = await Promise.all([
      getDocs(titleQuery),
      getDocs(contentQuery)
    ]);

    // Combine and deduplicate results
    const allResults = [...titleResults.docs, ...contentResults.docs];
    const uniqueResults = Array.from(new Map(allResults.map(item => [item.id, item])).values());

    // Get category names for results
    const categoryIds = [...new Set(uniqueResults.map(doc => doc.data().categoryId))];
    const categories = await getHelpCategories();
    const categoryMap = new Map(categories.categories?.map(cat => [cat.id, cat.name]));

    const results = uniqueResults.map(doc => {
      const data = doc.data() as HelpArticle;
      return {
        articleId: doc.id,
        title: data.title,
        contentPreview: data.content.substring(0, 150) + '...',
        categoryName: categoryMap.get(data.categoryId) || 'General',
        relevanceScore: calculateRelevanceScore(searchQuery, data),
        language: data.language
      };
    });

    // Sort by relevance
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return { success: true, results };
  } catch (error) {
    console.error('Error searching help content:', error);
    return { success: false, error: 'Failed to search help content' };
  }
}

/**
 * Calculate relevance score for search results
 */
function calculateRelevanceScore(query: string, article: HelpArticle): number {
  const queryLower = query.toLowerCase();
  const titleLower = article.title.toLowerCase();
  const contentLower = article.content.toLowerCase();

  let score = 0;

  // Title match is most important
  if (titleLower.includes(queryLower)) {
    score += 100;
  }

  // Content match
  if (contentLower.includes(queryLower)) {
    score += 50;
  }

  // Tag matches
  article.tags?.forEach(tag => {
    if (tag.toLowerCase().includes(queryLower)) {
      score += 20;
    }
  });

  // View count (popularity)
  score += article.views * 0.1;

  // Helpful ratings
  score += article.helpfulCount * 0.5;

  return score;
}

/**
 * Create a new help category
 */
export async function createHelpCategory(
  categoryData: Omit<HelpCategory, 'id'>
): Promise<{ success: boolean; categoryId?: string; error?: string }> {
  try {
    // Validate input
    if (!categoryData.name) {
      return { success: false, error: 'Category name is required' };
    }

    // Create help category
    const helpCategoriesRef = collection(db, 'helpCategories');
    const docRef = await addDoc(helpCategoriesRef, {
      name: categoryData.name,
      description: categoryData.description || '',
      order: categoryData.order || 0,
      parentCategoryId: categoryData.parentCategoryId,
      icon: categoryData.icon,
      language: categoryData.language || 'en'
    });

    return { success: true, categoryId: docRef.id };
  } catch (error) {
    console.error('Error creating help category:', error);
    return { success: false, error: 'Failed to create help category' };
  }
}

/**
 * Get all help categories
 */
export async function getHelpCategories(): Promise<{
  success: boolean;
  categories?: HelpCategory[];
  error?: string;
}> {
  try {
    const helpCategoriesRef = collection(db, 'helpCategories');
    const q = query(helpCategoriesRef, orderBy('order', 'asc'));
    const snapshot = await getDocs(q);

    const categories = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as HelpCategory[];

    return { success: true, categories };
  } catch (error) {
    console.error('Error getting help categories:', error);
    return { success: false, error: 'Failed to retrieve help categories' };
  }
}

/**
 * Submit feedback on a help article
 */
export async function submitHelpFeedback(
  articleId: string,
  userId: string,
  rating: 'helpful' | 'not_helpful',
  feedback?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate input
    if (!articleId || !userId || !rating) {
      return { success: false, error: 'Missing required fields' };
    }

    // Sanitize feedback
    const sanitizedFeedback = feedback ? sanitizeHtml(feedback) : undefined;

    // Create feedback document
    const feedbackRef = collection(db, 'helpArticles', articleId, 'feedback');
    await addDoc(feedbackRef, {
      userId,
      rating,
      feedback: sanitizedFeedback,
      createdAt: serverTimestamp()
    });

    // Update article counters
    const articleRef = doc(db, 'helpArticles', articleId);
    const updateField = rating === 'helpful' ? 'helpfulCount' : 'notHelpfulCount';
    await updateDoc(articleRef, {
      [updateField]: increment(1)
    });

    return { success: true };
  } catch (error) {
    console.error('Error submitting help feedback:', error);
    return { success: false, error: 'Failed to submit feedback' };
  }
}

/**
 * Get help analytics data
 */
export async function getHelpAnalytics(): Promise<{
  success: boolean;
  analytics?: HelpAnalytics;
  error?: string;
}> {
  try {
    const helpArticlesRef = collection(db, 'helpArticles');
    const q = query(helpArticlesRef, where('status', '==', 'published'));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return {
        success: true,
        analytics: {
          totalArticles: 0,
          totalViews: 0,
          helpfulRatingPercentage: 0,
          mostViewedArticles: [],
          mostHelpfulArticles: []
        }
      };
    }

    const articles = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as HelpArticle[];

    // Calculate analytics
    const totalViews = articles.reduce((sum, article) => sum + article.views, 0);
    const totalHelpful = articles.reduce((sum, article) => sum + article.helpfulCount, 0);
    const totalNotHelpful = articles.reduce((sum, article) => sum + article.notHelpfulCount, 0);
    const helpfulRatingPercentage = totalHelpful + totalNotHelpful > 0
      ? (totalHelpful / (totalHelpful + totalNotHelpful)) * 100
      : 0;

    // Get most viewed articles (top 5)
    const mostViewedArticles = [...articles]
      .sort((a, b) => b.views - a.views)
      .slice(0, 5);

    // Get most helpful articles (top 5 by helpful rating)
    const mostHelpfulArticles = [...articles]
      .sort((a, b) => b.helpfulCount - a.helpfulCount)
      .slice(0, 5);

    const analytics: HelpAnalytics = {
      totalArticles: articles.length,
      totalViews,
      helpfulRatingPercentage,
      mostViewedArticles,
      mostHelpfulArticles
    };

    return { success: true, analytics };
  } catch (error) {
    console.error('Error getting help analytics:', error);
    return { success: false, error: 'Failed to retrieve help analytics' };
  }
}

/**
 * Get popular help articles
 */
export async function getPopularHelpArticles(
  limitCount: number = 5
): Promise<{ success: boolean; articles?: HelpArticle[]; error?: string }> {
  try {
    const helpArticlesRef = collection(db, 'helpArticles');
    const q = query(
      helpArticlesRef,
      where('status', '==', 'published'),
      orderBy('views', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);

    const articles = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as HelpArticle[];

    return { success: true, articles };
  } catch (error) {
    console.error('Error getting popular help articles:', error);
    return { success: false, error: 'Failed to retrieve popular help articles' };
  }
}

/**
 * Subscribe to real-time help article updates
 */
export function subscribeToHelpArticle(
  articleId: string,
  callback: (article: HelpArticle | null) => void,
  onError?: (error: Error) => void
): () => void {
  if (!articleId) {
    onError?.(new Error('Invalid article ID'));
    return () => {};
  }

  const articleRef = doc(db, 'helpArticles', articleId);
  const unsubscribe = onSnapshot(
    articleRef,
    (doc) => {
      if (doc.exists()) {
        const article = {
          id: doc.id,
          ...doc.data()
        } as HelpArticle;
        callback(article);
      } else {
        callback(null);
      }
    },
    (error) => {
      console.error('Help article subscription error:', error);
      onError?.(error);
    }
  );

  return unsubscribe;
}

/**
 * Subscribe to real-time help articles by category
 */
export function subscribeToHelpArticlesByCategory(
  categoryId: string,
  language: 'ro' | 'en' = 'en',
  callback: (articles: HelpArticle[]) => void,
  onError?: (error: Error) => void
): () => void {
  if (!categoryId) {
    onError?.(new Error('Invalid category ID'));
    return () => {};
  }

  const helpArticlesRef = collection(db, 'helpArticles');
  const q = query(
    helpArticlesRef,
    where('categoryId', '==', categoryId),
    where('language', '==', language),
    where('status', '==', 'published'),
    orderBy('updatedAt', 'desc')
  );

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const articles = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as HelpArticle[];
      callback(articles);
    },
    (error) => {
      console.error('Help articles subscription error:', error);
      onError?.(error);
    }
  );

  return unsubscribe;
}

/**
 * Simple HTML sanitizer to prevent XSS
 */
function sanitizeHtml(html: string): string {
  // Basic sanitization - in production would use a proper library like DOMPurify
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '');
}