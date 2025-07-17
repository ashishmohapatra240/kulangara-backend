import redis from '../config/redis';

// Default cache duration (1 hour)
const DEFAULT_CACHE_DURATION = 3600;

/**
 * Get data from cache
 * @param key Cache key
 * @returns Cached data or null
 */
export const getCache = async <T>(key: string): Promise<T | null> => {
    console.log('Getting cache for key:', key);
    try {
        const data = await redis.get(key);
        console.log('Cache result:', data ? 'HIT' : 'MISS');
        return data ? JSON.parse(data) : null;
    } catch (error: unknown) {
        console.warn('Cache get failed:', error instanceof Error ? error.message : 'Unknown error');
        return null;
    }
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
    console.log('Setting cache for key:', key, 'duration:', duration);
    try {
        await redis.set(key, JSON.stringify(data), 'EX', duration);
        console.log('Cache set successfully');
    } catch (error: unknown) {
        console.warn('Cache set failed:', error instanceof Error ? error.message : 'Unknown error');
    }
};

/**
 * Delete data from cache
 * @param key Cache key
 */
export const deleteCache = async (key: string): Promise<void> => {
    console.log('Deleting cache for key:', key);
    await redis.del(key);
    console.log('Cache deleted successfully');
};

/**
 * Delete multiple keys from cache using pattern
 * @param pattern Pattern to match keys
 */
export const deleteCachePattern = async (pattern: string): Promise<void> => {
    console.log('Deleting cache pattern:', pattern);
    const keys = await redis.keys(pattern);
    console.log('Found keys:', keys);
    if (keys.length > 0) {
        await redis.del(keys);
        console.log('Deleted keys successfully');
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
    console.log('Cache wrapper called for key:', key);
    
    try {
        const cached = await getCache<T>(key);
        if (cached) {
            console.log('Returning cached data');
            return cached;
        }
    } catch (error: any) {
        console.warn('Cache read failed, proceeding without cache:', error.message);
    }

    console.log('Cache miss or error, executing function');
    const data = await fn();
    
    try {
        await setCache(key, data, duration);
        console.log('New data cached successfully');
    } catch (error: any) {
        console.warn('Cache write failed, data still returned:', error.message);
    }
    
    return data;
};