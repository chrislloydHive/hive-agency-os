'use client';

// components/os/blueprint/BlueprintPanel.tsx
// Self-contained panel that fetches and displays a Blueprint
// Use this for sidebar/tab contexts where you want loading states and caching handled

import { useState, useEffect, useCallback } from 'react';
import type { Blueprint, BlueprintSourceType } from '@/lib/os/analytics/blueprint';
import { BlueprintLayout } from './BlueprintLayout';
import { getCachedInsights, setCachedInsights, invalidateInsightsCache, type InsightsCacheContext } from '@/lib/ai/insightsCache';

interface BlueprintPanelProps {
  /** Source type for Blueprint generation */
  sourceType: BlueprintSourceType;
  /** Company ID (required for company/gap sources) */
  companyId?: string;
  /** Display name for the source (e.g., company name) */
  sourceName?: string;
  /** Date range period */
  period?: '7d' | '30d' | '90d';
  /** API endpoint (defaults to /api/os/blueprint) */
  apiEndpoint?: string;
  /** Auto-fetch on mount */
  autoFetch?: boolean;
  /** Callback when work item is created */
  onCreateWorkItem?: (
    title: string,
    description: string,
    priority: 'high' | 'medium' | 'low'
  ) => Promise<void>;
  /** Callback when experiment is created */
  onCreateExperiment?: (
    name: string,
    hypothesis: string,
    successMetric: string
  ) => Promise<void>;
  /** Custom class name */
  className?: string;
}

export function BlueprintPanel({
  sourceType,
  companyId,
  sourceName,
  period = '30d',
  apiEndpoint = '/api/os/blueprint',
  autoFetch = false,
  onCreateWorkItem,
  onCreateExperiment,
  className = '',
}: BlueprintPanelProps) {
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate cache key - map source type to valid cache context
  const getCacheContext = (): InsightsCacheContext => {
    switch (sourceType) {
      case 'dma': return 'blueprint-dma';
      case 'company': return 'blueprint-company';
      case 'workspace': return 'blueprint-workspace';
      default: return 'blueprint-dma';
    }
  };
  const cacheContext = getCacheContext();
  const cacheKey = `${companyId || 'default'}_${period}`;

  const fetchBlueprint = useCallback(async (regenerate = false) => {
    // Check cache first
    if (!regenerate) {
      const cached = getCachedInsights<Blueprint>(cacheContext, cacheKey);
      if (cached) {
        setBlueprint(cached);
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        sourceType,
        period,
        ...(companyId && { companyId }),
        ...(regenerate && { regenerate: 'true' }),
      });

      const response = await fetch(`${apiEndpoint}?${params}`);
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Failed to generate blueprint');
      }

      setBlueprint(data.blueprint);
      // Cache for 24 hours
      setCachedInsights(cacheContext, cacheKey, data.blueprint, 24);
    } catch (err) {
      console.error('[BlueprintPanel] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load blueprint');
    } finally {
      setLoading(false);
    }
  }, [sourceType, companyId, period, apiEndpoint, cacheContext, cacheKey]);

  const handleRefresh = useCallback(() => {
    invalidateInsightsCache(cacheContext, cacheKey);
    setBlueprint(null);
    fetchBlueprint(true);
  }, [fetchBlueprint, cacheContext, cacheKey]);

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (autoFetch && !blueprint && !loading) {
      fetchBlueprint();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFetch]);

  return (
    <div
      className={`bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl p-4 sm:p-6 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
        <h2 className="text-lg font-semibold text-amber-100">
          {sourceName ? `${sourceName} Blueprint` : 'Strategic Blueprint'}
        </h2>
      </div>
      <p className="text-xs text-amber-300/70 mb-4">AI-powered strategic planning • Cached for 24h</p>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
          <p className="text-amber-200 text-sm mt-3">Generating blueprint...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={() => fetchBlueprint()}
            className="mt-2 text-xs text-red-300 hover:text-red-200"
          >
            Try again
          </button>
        </div>
      )}

      {/* Empty State - Prompt to Generate */}
      {!blueprint && !loading && !error && (
        <div className="text-center py-8">
          <p className="text-amber-200/70 text-sm mb-4">
            Generate an AI-powered blueprint to get strategic recommendations.
          </p>
          <button
            onClick={() => fetchBlueprint()}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium rounded-lg transition-colors text-sm"
          >
            Generate Blueprint
          </button>
        </div>
      )}

      {/* Blueprint Content */}
      {blueprint && !loading && (
        <BlueprintLayout
          blueprint={blueprint}
          onCreateWorkItem={onCreateWorkItem}
          onCreateExperiment={onCreateExperiment}
          onRefresh={handleRefresh}
        />
      )}
    </div>
  );
}
