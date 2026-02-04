/**
 * Stats Cache
 * 
 * Simple in-memory cache for expensive stats calculations.
 * Uses TTL-based expiration to ensure data freshness.
 */

const statsCache = new Map();
const CACHE_TTL = 60000; // 1 minute TTL

/**
 * Get cached stats or null if expired/not found
 * @param {string} key - Cache key
 * @returns {Object|null} Cached data or null
 */
function getCachedStats(key) {
    const cached = statsCache.get(key);
    if (!cached) return null;

    if (Date.now() > cached.expiresAt) {
        statsCache.delete(key);
        return null;
    }

    console.log(`[Cache] Hit for key: ${key}`);
    return cached.data;
}

/**
 * Set cache data with TTL
 * @param {string} key - Cache key
 * @param {Object} data - Data to cache
 * @param {number} ttl - Time to live in ms (default: CACHE_TTL)
 */
function setCachedStats(key, data, ttl = CACHE_TTL) {
    statsCache.set(key, {
        data,
        expiresAt: Date.now() + ttl,
        createdAt: Date.now()
    });
    console.log(`[Cache] Set for key: ${key}, TTL: ${ttl}ms`);
}

/**
 * Invalidate cache entries matching a pattern
 * @param {string} pattern - Substring to match in keys
 */
function invalidateCache(pattern = '') {
    let count = 0;
    for (const key of statsCache.keys()) {
        if (!pattern || key.includes(pattern)) {
            statsCache.delete(key);
            count++;
        }
    }
    if (count > 0) {
        console.log(`[Cache] Invalidated ${count} entries matching pattern: ${pattern || '*'}`);
    }
}

/**
 * Get cache stats for monitoring
 */
function getCacheInfo() {
    return {
        size: statsCache.size,
        keys: Array.from(statsCache.keys()),
        ttlMs: CACHE_TTL
    };
}

module.exports = {
    getCachedStats,
    setCachedStats,
    invalidateCache,
    getCacheInfo,
    CACHE_TTL
};
