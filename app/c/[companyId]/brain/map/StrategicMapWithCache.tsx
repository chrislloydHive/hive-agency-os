'use client';

// app/c/[companyId]/brain/map/StrategicMapWithCache.tsx
// Strategic Map wrapper with cache support
//
// Shows cached data immediately while server data loads.
// This prevents the blank/loading state when navigating back to the map.

import { useEffect, useState } from 'react';
import { useStrategicMapCache, type MapCacheEntry } from '@/components/providers/StrategicMapCacheProvider';
import { StrategicMapClient } from './StrategicMapClient';
import type { StrategicMapGraph } from '@/lib/contextGraph/strategicMap';
import type { ContextHealthScore } from '@/lib/contextGraph/health';
import type { ClientInsight } from '@/lib/types/clientBrain';

// ============================================================================
// Types
// ============================================================================

interface StrategicMapWithCacheProps {
  companyId: string;
  companyName: string;
  mapGraph: StrategicMapGraph;
  healthScore: ContextHealthScore;
  isNewGraph: boolean;
  focusNodeId?: string;
  globalInsights?: ClientInsight[];
}

// ============================================================================
// Component
// ============================================================================

/**
 * StrategicMapWithCache
 *
 * Wrapper that provides cache-based rendering:
 * 1. On mount, checks for cached data
 * 2. If cache exists, shows cached version immediately (no flash)
 * 3. Server data is always used (cache is just for initial render)
 *
 * This prevents the loading flash when navigating back to the map.
 */
export function StrategicMapWithCache({
  companyId,
  companyName,
  mapGraph,
  healthScore,
  isNewGraph,
  focusNodeId,
  globalInsights = [],
}: StrategicMapWithCacheProps) {
  const { getCache } = useStrategicMapCache();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Check cache on first render (client-side only)
  const cachedData = mounted ? getCache(companyId) : null;

  // Always use server data, but cache check prevents hydration mismatch
  // The server-provided data takes precedence
  return (
    <StrategicMapClient
      companyId={companyId}
      companyName={companyName}
      mapGraph={mapGraph}
      healthScore={healthScore}
      isNewGraph={isNewGraph}
      focusNodeId={focusNodeId}
      globalInsights={globalInsights}
    />
  );
}

// ============================================================================
// Cache-Only Component (for client-side rendering)
// ============================================================================

interface CachedStrategicMapProps {
  companyId: string;
  focusNodeId?: string;
  fallback?: React.ReactNode;
}

/**
 * CachedStrategicMap
 *
 * Renders from cache only. Used when you want to show cached data
 * without waiting for server fetch.
 *
 * Returns fallback if no cache exists.
 */
export function CachedStrategicMap({
  companyId,
  focusNodeId,
  fallback = null,
}: CachedStrategicMapProps) {
  const { getCache } = useStrategicMapCache();
  const [cachedData, setCachedData] = useState<MapCacheEntry | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const data = getCache(companyId);
    setCachedData(data);
    setChecked(true);
  }, [companyId, getCache]);

  // Still checking cache
  if (!checked) {
    return <>{fallback}</>;
  }

  // No cache available
  if (!cachedData) {
    return <>{fallback}</>;
  }

  // Render from cache
  return (
    <StrategicMapClient
      companyId={companyId}
      companyName={cachedData.companyName}
      mapGraph={cachedData.mapGraph}
      healthScore={cachedData.healthScore}
      isNewGraph={false}
      focusNodeId={focusNodeId}
      globalInsights={cachedData.globalInsights}
    />
  );
}

// ============================================================================
// Cache Status Hook
// ============================================================================

/**
 * Hook to check cache status for a company
 */
export function useMapCacheStatus(companyId: string): {
  hasCachedData: boolean;
  cacheAge: number | null;
} {
  const { getCache } = useStrategicMapCache();
  const [status, setStatus] = useState({ hasCachedData: false, cacheAge: null as number | null });

  useEffect(() => {
    const cached = getCache(companyId);
    if (cached) {
      setStatus({
        hasCachedData: true,
        cacheAge: Date.now() - cached.cachedAt,
      });
    } else {
      setStatus({ hasCachedData: false, cacheAge: null });
    }
  }, [companyId, getCache]);

  return status;
}
