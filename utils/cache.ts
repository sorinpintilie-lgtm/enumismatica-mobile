import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = 'numismatica_cache_';
const CACHE_EXPIRY_PREFIX = 'numismatica_cache_expiry_';

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
}

export class Cache {
  static async get<T>(key: string): Promise<T | null> {
    try {
      const expiryKey = CACHE_EXPIRY_PREFIX + key;
      const expiry = await AsyncStorage.getItem(expiryKey);

      if (expiry && Date.now() > parseInt(expiry)) {
        // Cache expired, remove it
        await this.delete(key);
        return null;
      }

      const data = await AsyncStorage.getItem(CACHE_PREFIX + key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  static async set<T>(key: string, data: T, options: CacheOptions = {}): Promise<void> {
    try {
      const { ttl = 5 * 60 * 1000 } = options; // Default 5 minutes

      await AsyncStorage.setItem(CACHE_PREFIX + key, JSON.stringify(data));

      if (ttl > 0) {
        const expiry = Date.now() + ttl;
        await AsyncStorage.setItem(CACHE_EXPIRY_PREFIX + key, expiry.toString());
      }
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  static async delete(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(CACHE_PREFIX + key);
      await AsyncStorage.removeItem(CACHE_EXPIRY_PREFIX + key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  static async clear(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key =>
        key.startsWith(CACHE_PREFIX) || key.startsWith(CACHE_EXPIRY_PREFIX)
      );
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }
}