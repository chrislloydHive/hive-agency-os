// components/competition/useCompetitionV4.ts
// React hook for fetching Competition Lab V4 data directly (no V3 conversion)
//
// AUTHORITATIVE MODE:
// - NO user toggles for competitor inclusion/exclusion
// - System determines placement based on signals
// - runDiscovery() triggers analysis without user input on modality
//
// Preserves the full richness of V4 data:
// - Tiered competitor buckets (primary, contextual, alternatives, excluded)
// - Modality inference with confidence and explanation
// - Overlap scores and classification reasoning
// - Signals used for each competitor

'use client';

import { useState, useEffect, useCallback } from 'react';
import type {
  CompetitionV4Result,
  CustomerComparisonMode,
} from '@/lib/competition-v4/types';

export interface DiscoveryOptionsV4 {
  customerComparisonModes?: CustomerComparisonMode[];
  hasInstallation?: boolean;
  geographicScope?: 'local' | 'regional' | 'national';
}

interface UseCompetitionV4Result {
  data: CompetitionV4Result | null;
  isLoading: boolean;
  isRunning: boolean;
  error: string | null;
  runError: string | null;
  refetch: () => Promise<void>;
  runDiscovery: (options?: DiscoveryOptionsV4) => Promise<void>;
}

export function useCompetitionV4(companyId: string): UseCompetitionV4Result {
  const [data, setData] = useState<CompetitionV4Result | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  // Fetch latest V4 data directly
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Check sessionStorage for fresh run data first (avoids Airtable eventual consistency)
      const cachedKey = `competition-run-${companyId}`;
      const cached = typeof window !== 'undefined' ? sessionStorage.getItem(cachedKey) : null;
      if (cached) {
        try {
          const { run: cachedRun, timestamp } = JSON.parse(cached);
          // Use cached data if less than 60 seconds old
          if (Date.now() - timestamp < 60000 && cachedRun && cachedRun.version === 4) {
            sessionStorage.removeItem(cachedKey);
            setData(cachedRun as CompetitionV4Result);
            setIsLoading(false);
            return;
          }
        } catch {
          // Ignore cache parse errors
        }
      }

      // Fetch V4 data from API
      const response = await fetch(`/api/os/companies/${companyId}/competition/latest-v4`);
      const json = await response.json();

      if (response.ok && json.success && json.run) {
        setData(json.run as CompetitionV4Result);
      } else if (!json.run) {
        // No run exists yet
        setData(null);
      } else {
        throw new Error(json.error || 'Failed to load competition data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  // Run discovery with V4 options (system determines modality, no user override)
  const runDiscovery = useCallback(async (options?: DiscoveryOptionsV4) => {
    setIsRunning(true);
    setRunError(null);

    try {
      const response = await fetch(`/api/os/companies/${companyId}/competition/run-v4`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options || {}),
      });

      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.error || 'Competition analysis failed');
      }

      // Use the result returned directly from the API
      if (json.run && json.run.version === 4) {
        setData(json.run as CompetitionV4Result);
      } else {
        // Fallback to refetch
        await fetchData();
      }
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsRunning(false);
    }
  }, [companyId, fetchData]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    isLoading,
    isRunning,
    error,
    runError,
    refetch: fetchData,
    runDiscovery,
  };
}

// ============================================================================
// Helper Functions for V4 Data
// ============================================================================

/**
 * Get counts by tier from V4 result
 */
export function getCompetitorCounts(data: CompetitionV4Result | null) {
  if (!data?.scoredCompetitors) {
    return { primary: 0, contextual: 0, alternatives: 0, excluded: 0, total: 0 };
  }
  const sc = data.scoredCompetitors;
  return {
    primary: sc.primary?.length || 0,
    contextual: sc.contextual?.length || 0,
    alternatives: sc.alternatives?.length || 0,
    excluded: sc.excluded?.length || 0,
    total: (sc.primary?.length || 0) + (sc.contextual?.length || 0) + (sc.alternatives?.length || 0),
  };
}

/**
 * Check if data includes retail-hybrid competitors
 */
export function hasRetailHybridCompetitors(data: CompetitionV4Result | null): boolean {
  if (!data?.scoredCompetitors) return false;
  const sc = data.scoredCompetitors;

  const allCompetitors = [
    ...(sc.primary || []),
    ...(sc.contextual || []),
  ];

  return allCompetitors.some(c =>
    c.isMajorRetailer && (c.hasInstallation || c.signalsUsed?.serviceOverlap)
  );
}
