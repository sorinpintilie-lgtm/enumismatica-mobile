/**
 * Simple in-memory cache for preloaded app data
 * This allows the splashscreen to load data that can be reused by hooks
 */

import { Product, Auction } from './types';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class AppDataCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Set a value in the cache
   */
  set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttl,
    });
  }

  /**
   * Get a value from the cache
   * Returns null if not found or expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Delete a specific key
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Export singleton instance
export const appDataCache = new AppDataCache();

// Cache keys
export const CACHE_KEYS = {
  FEATURED_PRODUCTS: 'featured_products',
  ACTIVE_AUCTIONS: 'active_auctions',
  USER_PROFILE: (userId: string) => `user_profile_${userId}`,
  USER_NOTIFICATIONS: (userId: string) => `user_notifications_${userId}`,
  USER_CART: (userId: string) => `user_cart_${userId}`,
  USER_WATCHLIST: (userId: string) => `user_watchlist_${userId}`,
} as const;
