'use client';

// app/c/[companyId]/brain/explorer/ExplorerClientWrapper.tsx
// Client wrapper that shows cached map during server loading
//
// Uses the cache provider to immediately render cached data,
// then seamlessly transitions to fresh server data when available.

import { useEffect, useState, useRef } from 'react';
import { useStrategicMapCache } from '@/components/providers/StrategicMapCacheProvider';
import { StrategicMapClient } from '../map/StrategicMapClient';
import type { StrategicMapGraph } from '@/lib/contextGraph/strategicMap';
import type { ContextHealthScore } from '@/lib/contextGraph/health';
import type { ClientInsight } from '@/lib/types/clientBrain';

// ============================================================================
// Types
// ============================================================================

interface ExplorerClientWrapperProps {
  companyId: string;
  companyName: string;
  mapGraph: StrategicMapGraph;
  healthScore: ContextHealthScore;
  isNewGraph: boolean;
  focusNodeId?: string;
  globalInsights: ClientInsight[];
}

// ============================================================================
// Component
// ============================================================================

/**
 * ExplorerClientWrapper
 *
 * Provides smooth cache-to-fresh transition:
 * 1. Immediately shows cached data if available (prevents flash)
 * 2. Transitions to fresh server data without jarring re-render
 * 3. Caches fresh data for next navigation
 */
export function ExplorerClientWrapper({
  companyId,
  companyName,
  mapGraph,
  healthScore,
  isNewGraph,
  focusNodeId,
  globalInsights,
}: ExplorerClientWrapperProps) {
  const { getCache, setCache } = useStrategicMapCache();
  const [showingCached, setShowingCached] = useState(false);
  const hasInitialized = useRef(false);

  // On mount, cache the server-provided data
  useEffect(() => {
    if (!hasInitialized.current && mapGraph && healthScore && !isNewGraph) {
      hasInitialized.current = true;

      // Cache the fresh data from server
      setCache(companyId, {
        mapGraph,
        healthScore,
        globalInsights,
        companyName,
      });
    }
  }, [companyId, mapGraph, healthScore, globalInsights, companyName, isNewGraph, setCache]);

  // Server always provides fresh data, so just render it
  // The cache is maintained for future navigations
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
