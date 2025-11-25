// lib/analytics/cache.ts
// In-memory caching for analytics metric data
//
// Provides a simple TTL-based cache to avoid redundant API calls
// when fetching the same metrics for the same company and date range.

import type { AnalyticsMetricData } from './blueprintTypes';

// ============================================================================
// Types
// ============================================================================

interface CacheEntry {
  data: AnalyticsMetricData;
  expiresAt: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
}

// ============================================================================
// Cache Configuration
// ============================================================================

/** Default TTL in milliseconds (5 minutes) */
const DEFAULT_TTL_MS = 5 * 60 * 1000;

/** Maximum cache entries before pruning */
const MAX_CACHE_SIZE = 1000;

// ============================================================================
// Cache Storage
// ============================================================================

const cache = new Map<string, CacheEntry>();
const stats: CacheStats = { hits: 0, misses: 0, size: 0 };

// ============================================================================
// Cache Key Generation
// ============================================================================

/**
 * Generate a unique cache key for a metric request
 */
export function generateCacheKey(
  companyId: string,
  metricId: string,
  startDate: string,
  endDate: string
): string {
  return `${companyId}:${metricId}:${startDate}:${endDate}`;
}

/**
 * Generate a cache key for a batch of metrics
 */
export function generateBatchCacheKey(
  companyId: string,
  metricIds: string[],
  startDate: string,
  endDate: string
): string {
  const sortedIds = [...metricIds].sort().join(',');
  return `batch:${companyId}:${sortedIds}:${startDate}:${endDate}`;
}

// ============================================================================
// Cache Operations
// ============================================================================

/**
 * Get a cached metric data entry
 */
export function getCached(key: string): AnalyticsMetricData | null {
  const entry = cache.get(key);

  if (!entry) {
    stats.misses++;
    return null;
  }

  // Check if expired
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    stats.misses++;
    stats.size = cache.size;
    return null;
  }

  stats.hits++;
  return entry.data;
}

/**
 * Set a cache entry with optional TTL
 */
export function setCache(
  key: string,
  data: AnalyticsMetricData,
  ttlMs: number = DEFAULT_TTL_MS
): void {
  // Prune cache if it's getting too large
  if (cache.size >= MAX_CACHE_SIZE) {
    pruneExpired();
    // If still too large, remove oldest entries
    if (cache.size >= MAX_CACHE_SIZE) {
      pruneOldest(Math.floor(MAX_CACHE_SIZE * 0.2)); // Remove 20%
    }
  }

  cache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  });

  stats.size = cache.size;
}

/**
 * Get multiple cached entries at once
 */
export function getCachedBatch(keys: string[]): Map<string, AnalyticsMetricData | null> {
  const results = new Map<string, AnalyticsMetricData | null>();

  for (const key of keys) {
    results.set(key, getCached(key));
  }

  return results;
}

/**
 * Set multiple cache entries at once
 */
export function setCacheBatch(
  entries: Array<{ key: string; data: AnalyticsMetricData }>,
  ttlMs: number = DEFAULT_TTL_MS
): void {
  for (const { key, data } of entries) {
    setCache(key, data, ttlMs);
  }
}

/**
 * Invalidate a specific cache entry
 */
export function invalidateCache(key: string): boolean {
  const deleted = cache.delete(key);
  stats.size = cache.size;
  return deleted;
}

/**
 * Invalidate all cache entries for a company
 */
export function invalidateCacheForCompany(companyId: string): number {
  let count = 0;

  for (const key of cache.keys()) {
    if (key.startsWith(`${companyId}:`) || key.includes(`:${companyId}:`)) {
      cache.delete(key);
      count++;
    }
  }

  stats.size = cache.size;
  return count;
}

/**
 * Clear the entire cache
 */
export function clearCache(): void {
  cache.clear();
  stats.size = 0;
}

/**
 * Get cache statistics
 */
export function getCacheStats(): CacheStats & { hitRate: number } {
  const total = stats.hits + stats.misses;
  return {
    ...stats,
    hitRate: total > 0 ? stats.hits / total : 0,
  };
}

// ============================================================================
// Cache Maintenance
// ============================================================================

/**
 * Remove all expired entries
 */
export function pruneExpired(): number {
  const now = Date.now();
  let pruned = 0;

  for (const [key, entry] of cache.entries()) {
    if (now > entry.expiresAt) {
      cache.delete(key);
      pruned++;
    }
  }

  stats.size = cache.size;
  return pruned;
}

/**
 * Remove oldest entries (by expiration time)
 */
function pruneOldest(count: number): void {
  // Sort entries by expiration time
  const sorted = Array.from(cache.entries()).sort(
    (a, b) => a[1].expiresAt - b[1].expiresAt
  );

  // Remove the oldest ones
  for (let i = 0; i < Math.min(count, sorted.length); i++) {
    cache.delete(sorted[i][0]);
  }

  stats.size = cache.size;
}

// ============================================================================
// Higher-Level Cache Helpers
// ============================================================================

/**
 * Get or fetch a metric - returns cached value if available,
 * otherwise calls the fetcher and caches the result
 */
export async function getOrFetch(
  key: string,
  fetcher: () => Promise<AnalyticsMetricData>,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<AnalyticsMetricData> {
  const cached = getCached(key);

  if (cached) {
    return cached;
  }

  const data = await fetcher();
  setCache(key, data, ttlMs);
  return data;
}

/**
 * Wrapper to cache-enable any async fetch function
 */
export function withCache<T extends AnalyticsMetricData>(
  keyGenerator: (...args: any[]) => string,
  fetcher: (...args: any[]) => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS
): (...args: any[]) => Promise<T> {
  return async (...args: any[]): Promise<T> => {
    const key = keyGenerator(...args);
    const cached = getCached(key);

    if (cached) {
      return cached as T;
    }

    const data = await fetcher(...args);
    setCache(key, data, ttlMs);
    return data;
  };
}
