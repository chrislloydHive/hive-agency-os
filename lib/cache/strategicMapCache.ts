// lib/cache/strategicMapCache.ts
// Client-side cache for Strategic Map graph data
//
// Persists the computed graph to sessionStorage so users don't see
// a loading state when navigating back to the map.
//
// Cache strategy:
// - Store graph data keyed by companyId
// - Cache expires after 5 minutes (configurable)
// - Server data always takes precedence (stale-while-revalidate)

import type { StrategicMapGraph } from '@/lib/contextGraph/strategicMap';
import type { ContextHealthScore } from '@/lib/contextGraph/health';
import type { ClientInsight } from '@/lib/types/clientBrain';

// ============================================================================
// Types
// ============================================================================

export interface CachedMapData {
  mapGraph: StrategicMapGraph;
  healthScore: ContextHealthScore;
  globalInsights: ClientInsight[];
  companyName: string;
  cachedAt: number;
}

interface CacheEntry {
  data: CachedMapData;
  version: number;
}

// ============================================================================
// Constants
// ============================================================================

const CACHE_KEY_PREFIX = 'hive-map-cache-';
const CACHE_VERSION = 1;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ============================================================================
// Cache Functions
// ============================================================================

/**
 * Get the cache key for a company
 */
function getCacheKey(companyId: string): string {
  return `${CACHE_KEY_PREFIX}${companyId}`;
}

/**
 * Check if cache entry is still valid
 */
function isCacheValid(entry: CacheEntry): boolean {
  if (entry.version !== CACHE_VERSION) {
    return false;
  }
  const age = Date.now() - entry.data.cachedAt;
  return age < CACHE_TTL_MS;
}

/**
 * Get cached map data for a company
 */
export function getCachedMapData(companyId: string): CachedMapData | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const key = getCacheKey(companyId);
    const stored = sessionStorage.getItem(key);
    if (!stored) {
      return null;
    }

    const entry: CacheEntry = JSON.parse(stored);
    if (!isCacheValid(entry)) {
      sessionStorage.removeItem(key);
      return null;
    }

    return entry.data;
  } catch (error) {
    console.warn('[strategicMapCache] Failed to read cache:', error);
    return null;
  }
}

/**
 * Store map data in cache
 */
export function setCachedMapData(
  companyId: string,
  data: Omit<CachedMapData, 'cachedAt'>
): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const key = getCacheKey(companyId);
    const entry: CacheEntry = {
      data: {
        ...data,
        cachedAt: Date.now(),
      },
      version: CACHE_VERSION,
    };
    sessionStorage.setItem(key, JSON.stringify(entry));
  } catch (error) {
    console.warn('[strategicMapCache] Failed to write cache:', error);
    // Storage might be full - try to clear old entries
    clearOldCacheEntries();
  }
}

/**
 * Invalidate cache for a company
 */
export function invalidateMapCache(companyId: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const key = getCacheKey(companyId);
    sessionStorage.removeItem(key);
  } catch (error) {
    console.warn('[strategicMapCache] Failed to invalidate cache:', error);
  }
}

/**
 * Clear all old cache entries
 */
function clearOldCacheEntries(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const keysToRemove: string[] = [];

    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(CACHE_KEY_PREFIX)) {
        const stored = sessionStorage.getItem(key);
        if (stored) {
          try {
            const entry: CacheEntry = JSON.parse(stored);
            if (!isCacheValid(entry)) {
              keysToRemove.push(key);
            }
          } catch {
            keysToRemove.push(key);
          }
        }
      }
    }

    for (const key of keysToRemove) {
      sessionStorage.removeItem(key);
    }
  } catch (error) {
    console.warn('[strategicMapCache] Failed to clear old entries:', error);
  }
}

/**
 * Get cache age in human-readable format
 */
export function getCacheAge(cachedAt: number): string {
  const ageMs = Date.now() - cachedAt;
  const seconds = Math.floor(ageMs / 1000);

  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}
