// hooks/useContextV4Health.ts
// Unified React hook for Context V4 Health
//
// Consolidates health fetch logic from:
// - ReviewQueueClient
// - ProgramsClient
// - StrategySurface

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { V4HealthResponse } from '@/lib/types/contextV4Health';

// ============================================================================
// Types
// ============================================================================

export interface UseContextV4HealthOptions {
  /** Whether to fetch on mount (default: true) */
  autoFetch?: boolean;
}

export interface UseContextV4HealthReturn {
  /** The V4 health data, or null if not yet loaded */
  health: V4HealthResponse | null;
  /** True while fetching health data */
  loading: boolean;
  /** Error message if fetch failed, null otherwise */
  error: string | null;
  /** Re-fetch health data */
  refresh: () => Promise<void>;
  /** ISO timestamp of last successful fetch, null if never fetched */
  lastFetchedAt: string | null;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Unified hook for fetching and managing Context V4 health state.
 *
 * Usage:
 * ```tsx
 * const { health, loading, error, refresh } = useContextV4Health(companyId);
 * ```
 *
 * Features:
 * - Fetches on mount when companyId is truthy
 * - Uses AbortController to prevent state updates after unmount
 * - Graceful error handling (sets error state, doesn't throw)
 * - refresh() to manually re-fetch
 * - lastFetchedAt for debugging/freshness indicators
 */
export function useContextV4Health(
  companyId: string,
  options: UseContextV4HealthOptions = {}
): UseContextV4HealthReturn {
  const { autoFetch = true } = options;

  const [health, setHealth] = useState<V4HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);

  // Track mounted state to prevent state updates after unmount
  const mountedRef = useRef(true);

  const fetchHealth = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    // Create abort controller for this fetch
    const abortController = new AbortController();

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/context/v4/health`,
        {
          cache: 'no-store',
          signal: abortController.signal,
        }
      );

      // Check if component is still mounted
      if (!mountedRef.current) return;

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      const data = await response.json();

      // Validate response structure
      if (!data.healthVersion) {
        throw new Error('Invalid health response: missing healthVersion');
      }

      setHealth(data);
      setLastFetchedAt(new Date().toISOString());
      setError(null);
    } catch (err) {
      // Ignore abort errors (component unmounted)
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      // Only set error if still mounted
      if (mountedRef.current) {
        const message = err instanceof Error ? err.message : 'Failed to fetch V4 health';
        setError(message);
        // Don't clear health on error - keep stale data visible
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }

    return () => {
      abortController.abort();
    };
  }, [companyId]);

  // Auto-fetch on mount
  useEffect(() => {
    mountedRef.current = true;

    if (autoFetch && companyId) {
      fetchHealth();
    } else {
      setLoading(false);
    }

    return () => {
      mountedRef.current = false;
    };
  }, [autoFetch, companyId, fetchHealth]);

  // Stable refresh function that can be called from outside
  const refresh = useCallback(async () => {
    await fetchHealth();
  }, [fetchHealth]);

  return {
    health,
    loading,
    error,
    refresh,
    lastFetchedAt,
  };
}

export default useContextV4Health;
