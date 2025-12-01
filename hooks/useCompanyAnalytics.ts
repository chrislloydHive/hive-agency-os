// hooks/useCompanyAnalytics.ts
// React hook for fetching company analytics snapshot from the unified v2 API
//
// This hook provides a single data source for all company analytics subtabs,
// replacing direct GA4/GSC API calls in individual components.

'use client';

import { useState, useEffect, useCallback } from 'react';
import type {
  CompanyAnalyticsSnapshot,
  AnalyticsDateRangePreset,
  AnalyticsAiInsights,
} from '@/lib/analytics/types';

export interface UseCompanyAnalyticsOptions {
  // Optionally skip the initial fetch (useful for SSR or controlled fetching)
  skip?: boolean;
}

export interface UseCompanyAnalyticsResult {
  // Data
  snapshot: CompanyAnalyticsSnapshot | null;
  insights: AnalyticsAiInsights | null;

  // Loading & error states
  isLoading: boolean;
  isLoadingInsights: boolean;
  error: string | null;
  insightsError: string | null;

  // Actions
  refresh: () => Promise<void>;
  fetchInsights: () => Promise<void>;
}

/**
 * Hook to fetch unified company analytics snapshot
 *
 * Usage:
 * ```tsx
 * const { snapshot, isLoading, error, refresh } = useCompanyAnalytics(companyId, '30d');
 *
 * // Pass snapshot to subtabs:
 * <OverviewSection snapshot={snapshot} isLoading={isLoading} />
 * <TrafficSection snapshot={snapshot} isLoading={isLoading} />
 * ```
 */
export function useCompanyAnalytics(
  companyId: string,
  range: AnalyticsDateRangePreset = '30d',
  options: UseCompanyAnalyticsOptions = {}
): UseCompanyAnalyticsResult {
  const { skip = false } = options;

  const [snapshot, setSnapshot] = useState<CompanyAnalyticsSnapshot | null>(null);
  const [insights, setInsights] = useState<AnalyticsAiInsights | null>(null);
  const [isLoading, setIsLoading] = useState(!skip);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  // Fetch analytics snapshot
  const fetchSnapshot = useCallback(async () => {
    if (!companyId) {
      setError('No company ID provided');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/analytics/v2/company/${companyId}?range=${range}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch analytics (${response.status})`);
      }

      const data = await response.json();

      if (!data.ok) {
        throw new Error(data.error || 'Failed to fetch analytics');
      }

      setSnapshot(data.snapshot);
    } catch (err) {
      console.error('[useCompanyAnalytics] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
      setSnapshot(null);
    } finally {
      setIsLoading(false);
    }
  }, [companyId, range]);

  // Fetch AI insights
  const fetchInsights = useCallback(async () => {
    if (!companyId) return;

    setIsLoadingInsights(true);
    setInsightsError(null);

    try {
      const response = await fetch(
        `/api/analytics/v2/company/${companyId}/insights?range=${range}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch insights');
      }

      const data = await response.json();

      if (!data.ok) {
        throw new Error(data.error || 'Failed to generate insights');
      }

      setInsights(data.insights);
    } catch (err) {
      console.error('[useCompanyAnalytics] Insights error:', err);
      setInsightsError(err instanceof Error ? err.message : 'Failed to load insights');
    } finally {
      setIsLoadingInsights(false);
    }
  }, [companyId, range]);

  // Refresh function - refetch both snapshot and insights
  const refresh = useCallback(async () => {
    await fetchSnapshot();
  }, [fetchSnapshot]);

  // Initial fetch on mount or when companyId/range changes
  useEffect(() => {
    if (!skip) {
      fetchSnapshot();
    }
  }, [fetchSnapshot, skip]);

  return {
    snapshot,
    insights,
    isLoading,
    isLoadingInsights,
    error,
    insightsError,
    refresh,
    fetchInsights,
  };
}

// Re-export types for convenience
export type { CompanyAnalyticsSnapshot, AnalyticsDateRangePreset, AnalyticsAiInsights };
