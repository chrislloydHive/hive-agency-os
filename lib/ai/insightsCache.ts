// lib/ai/insightsCache.ts
// Global client-side cache for AI-generated insights
//
// This provides a unified caching mechanism for AI insights across all pages.
// Insights are stored in localStorage with TTL validation.

// ============================================================================
// Types
// ============================================================================

export type InsightsCacheContext =
  | 'dma-funnel' // DMA Funnel page
  | 'company-analytics' // Company analytics tab
  | 'pipeline-dashboard' // Pipeline dashboard
  | 'os-dashboard'; // OS Dashboard

export interface CachedInsightsEntry<T = unknown> {
  insights: T;
  context: InsightsCacheContext;
  contextKey: string; // Additional context key (e.g., companyId, dateRange)
  timestamp: number;
  ttlHours: number;
}

interface InsightsCacheStorage {
  version: number;
  entries: Record<string, CachedInsightsEntry>;
}

// ============================================================================
// Configuration
// ============================================================================

const STORAGE_KEY = 'hive-ai-insights-cache';
const CACHE_VERSION = 1;
const DEFAULT_TTL_HOURS = 24;
const MAX_ENTRIES = 50; // Maximum number of cached insights

// ============================================================================
// Cache Key Generation
// ============================================================================

/**
 * Generate a unique cache key for an insights entry
 */
export function generateInsightsCacheKey(
  context: InsightsCacheContext,
  contextKey: string
): string {
  return `${context}:${contextKey}`;
}

// ============================================================================
// Storage Access
// ============================================================================

function loadStorage(): InsightsCacheStorage {
  if (typeof window === 'undefined') {
    return { version: CACHE_VERSION, entries: {} };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { version: CACHE_VERSION, entries: {} };
    }

    const data = JSON.parse(raw) as InsightsCacheStorage;

    // Check version - clear cache if outdated
    if (data.version !== CACHE_VERSION) {
      localStorage.removeItem(STORAGE_KEY);
      return { version: CACHE_VERSION, entries: {} };
    }

    return data;
  } catch {
    return { version: CACHE_VERSION, entries: {} };
  }
}

function saveStorage(storage: InsightsCacheStorage): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
  } catch {
    // Storage quota exceeded - try to prune old entries
    pruneOldEntries(storage, Math.floor(MAX_ENTRIES / 2));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
    } catch {
      // Still failed - clear everything
      localStorage.removeItem(STORAGE_KEY);
    }
  }
}

// ============================================================================
// Cache Operations
// ============================================================================

/**
 * Get cached insights by key
 */
export function getCachedInsights<T>(
  context: InsightsCacheContext,
  contextKey: string
): T | null {
  const storage = loadStorage();
  const key = generateInsightsCacheKey(context, contextKey);
  const entry = storage.entries[key];

  if (!entry) {
    return null;
  }

  // Check if expired
  const now = Date.now();
  const ageHours = (now - entry.timestamp) / (1000 * 60 * 60);

  if (ageHours >= entry.ttlHours) {
    // Expired - remove entry
    delete storage.entries[key];
    saveStorage(storage);
    return null;
  }

  console.log(`[AI Cache] Hit for ${context}:${contextKey}`);
  return entry.insights as T;
}

/**
 * Save insights to cache
 */
export function setCachedInsights<T>(
  context: InsightsCacheContext,
  contextKey: string,
  insights: T,
  ttlHours: number = DEFAULT_TTL_HOURS
): void {
  const storage = loadStorage();
  const key = generateInsightsCacheKey(context, contextKey);

  // Prune if at capacity
  const entryCount = Object.keys(storage.entries).length;
  if (entryCount >= MAX_ENTRIES) {
    pruneOldEntries(storage, Math.floor(MAX_ENTRIES * 0.3));
  }

  storage.entries[key] = {
    insights,
    context,
    contextKey,
    timestamp: Date.now(),
    ttlHours,
  };

  saveStorage(storage);
  console.log(`[AI Cache] Saved ${context}:${contextKey}`);
}

/**
 * Invalidate a specific cache entry
 */
export function invalidateInsightsCache(
  context: InsightsCacheContext,
  contextKey: string
): boolean {
  const storage = loadStorage();
  const key = generateInsightsCacheKey(context, contextKey);

  if (storage.entries[key]) {
    delete storage.entries[key];
    saveStorage(storage);
    console.log(`[AI Cache] Invalidated ${context}:${contextKey}`);
    return true;
  }

  return false;
}

/**
 * Invalidate all entries for a given context
 */
export function invalidateContextCache(context: InsightsCacheContext): number {
  const storage = loadStorage();
  let count = 0;

  for (const key of Object.keys(storage.entries)) {
    if (key.startsWith(`${context}:`)) {
      delete storage.entries[key];
      count++;
    }
  }

  if (count > 0) {
    saveStorage(storage);
    console.log(`[AI Cache] Invalidated ${count} entries for ${context}`);
  }

  return count;
}

/**
 * Clear all cached insights
 */
export function clearInsightsCache(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  console.log('[AI Cache] Cleared all entries');
}

/**
 * Get cache statistics
 */
export function getInsightsCacheStats(): {
  entryCount: number;
  byContext: Record<InsightsCacheContext, number>;
  oldestTimestamp: number | null;
  newestTimestamp: number | null;
} {
  const storage = loadStorage();
  const entries = Object.values(storage.entries);

  const byContext: Record<InsightsCacheContext, number> = {
    'dma-funnel': 0,
    'company-analytics': 0,
    'pipeline-dashboard': 0,
    'os-dashboard': 0,
  };

  let oldest: number | null = null;
  let newest: number | null = null;

  for (const entry of entries) {
    byContext[entry.context] = (byContext[entry.context] || 0) + 1;

    if (oldest === null || entry.timestamp < oldest) {
      oldest = entry.timestamp;
    }
    if (newest === null || entry.timestamp > newest) {
      newest = entry.timestamp;
    }
  }

  return {
    entryCount: entries.length,
    byContext,
    oldestTimestamp: oldest,
    newestTimestamp: newest,
  };
}

// ============================================================================
// Cache Maintenance
// ============================================================================

/**
 * Remove expired entries from cache
 */
export function pruneExpiredInsights(): number {
  const storage = loadStorage();
  const now = Date.now();
  let pruned = 0;

  for (const [key, entry] of Object.entries(storage.entries)) {
    const ageHours = (now - entry.timestamp) / (1000 * 60 * 60);
    if (ageHours >= entry.ttlHours) {
      delete storage.entries[key];
      pruned++;
    }
  }

  if (pruned > 0) {
    saveStorage(storage);
    console.log(`[AI Cache] Pruned ${pruned} expired entries`);
  }

  return pruned;
}

/**
 * Remove oldest entries to make room
 */
function pruneOldEntries(storage: InsightsCacheStorage, count: number): void {
  const entries = Object.entries(storage.entries).sort(
    (a, b) => a[1].timestamp - b[1].timestamp
  );

  for (let i = 0; i < Math.min(count, entries.length); i++) {
    delete storage.entries[entries[i][0]];
  }
}

// ============================================================================
// React Hook Helper
// ============================================================================

/**
 * Helper function for components to use cached insights with automatic fetching
 */
export async function getOrFetchInsights<T>(
  context: InsightsCacheContext,
  contextKey: string,
  fetcher: () => Promise<T>,
  ttlHours: number = DEFAULT_TTL_HOURS
): Promise<{ insights: T; fromCache: boolean }> {
  // Check cache first
  const cached = getCachedInsights<T>(context, contextKey);
  if (cached) {
    return { insights: cached, fromCache: true };
  }

  // Fetch fresh insights
  const insights = await fetcher();

  // Cache the result
  setCachedInsights(context, contextKey, insights, ttlHours);

  return { insights, fromCache: false };
}
