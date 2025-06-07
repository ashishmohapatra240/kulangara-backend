import redis from '../config/redis';

// Default cache duration (1 hour)
const DEFAULT_CACHE_DURATION = 3600;

/**
 * Get data from cache
 * @param key Cache key
 * @returns Cached data or null
 */
export const getCache = async <T>(key: string): Promise<T | null> => {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
};

/**
 * Set data in cache
 * @param key Cache key
 * @param data Data to cache
 * @param duration Cache duration in seconds
 */
export const setCache = async <T>(
    key: string,
    data: T,
    duration: number = DEFAULT_CACHE_DURATION
): Promise<void> => {
    await redis.set(key, JSON.stringify(data), 'EX', duration);
};

/**
 * Delete data from cache
 * @param key Cache key
 */
export const deleteCache = async (key: string): Promise<void> => {
    await redis.del(key);
};

/**
 * Delete multiple keys from cache using pattern
 * @param pattern Pattern to match keys
 */
export const deleteCachePattern = async (pattern: string): Promise<void> => {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
        await redis.del(keys);
    }
};

/**
 * Cache wrapper for async functions
 * @param key Cache key
 * @param fn Function to cache
 * @param duration Cache duration in seconds
 * @returns Function result
 */
export const cacheWrapper = async <T>(
    key: string,
    fn: () => Promise<T>,
    duration: number = DEFAULT_CACHE_DURATION
): Promise<T> => {
    const cached = await getCache<T>(key);
    if (cached) {
        return cached;
    }

    const data = await fn();
    await setCache(key, data, duration);
    return data;
};