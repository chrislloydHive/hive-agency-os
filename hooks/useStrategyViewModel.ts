'use client';

// hooks/useStrategyViewModel.ts
// React hook for fetching and managing the Strategy View Model
//
// Provides:
// - Fully-hydrated strategy view model
// - Strategic Frame with provenance
// - Strategy readiness
// - Mapping report for debugging
// - Refresh and mutation helpers

import { useState, useEffect, useCallback } from 'react';
import type { StrategyViewModel } from '@/lib/os/strategy/strategyViewModel';
import type { HydratedStrategyFrame } from '@/lib/os/strategy/strategyHydration';
import type { StrategyReadiness, StrategyInputs } from '@/lib/os/strategy/strategyInputsHelpers';
import type { MappingReport } from '@/lib/os/strategy/contextLoader';
import type { StrategyDraft } from '@/lib/os/strategy/drafts';
import type { StrategyHashes, StalenessIndicators } from '@/lib/os/strategy/hashes';

// ============================================================================
// Types
// ============================================================================

export interface StrategyListItem {
  id: string;
  title: string;
  isActive: boolean;
  status: string;
  updatedAt: string;
}

export interface StrategyViewModelData {
  viewModel: StrategyViewModel;
  hydratedFrame: HydratedStrategyFrame;
  frameSummary: {
    fromUser: string[];
    fromContext: string[];
    missing: string[];
  };
  // Context-derived frame (explicit values from Context)
  derivedFrame: {
    audience: string | null;
    offering: string | null;
    valueProp: string | null;
    positioning: string | null;
    constraints: string | null;
  };
  // Full context snapshot for AI
  contextSnapshot: unknown;
  // Mapping report for debugging
  mappingReport: MappingReport;
  readiness: StrategyReadiness;
  inputs: StrategyInputs | null;
  // Context load status
  contextStatus: {
    loaded: boolean;
    source: string;
    updatedAt: string | null;
    error: string | null;
  };
  // Multi-strategy support
  strategies: StrategyListItem[];
  activeStrategyId: string | null;
  // Hashes for staleness detection
  hashes: StrategyHashes;
  staleness: StalenessIndicators;
  // Server-side drafts
  drafts: StrategyDraft[];
  draftsRecord: Record<string, StrategyDraft>;
  meta: {
    strategyId: string | null;
    hasStrategy: boolean;
    isActive: boolean;
    contextLoaded: boolean;
    resolvedAt: string;
    // Dev indicator for priorities source
    prioritiesSource?: 'ai_generated' | 'user_created' | 'empty';
  };
}

export interface UseStrategyViewModelResult {
  data: StrategyViewModelData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setStrategyId: (id: string | null) => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useStrategyViewModel(
  companyId: string,
  initialStrategyId?: string | null
): UseStrategyViewModelResult {
  const [data, setData] = useState<StrategyViewModelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [strategyId, setStrategyId] = useState<string | null>(initialStrategyId ?? null);

  const fetchViewModel = useCallback(async () => {
    if (!companyId) return;

    setLoading(true);
    setError(null);

    try {
      const url = new URL(`/api/os/companies/${companyId}/strategy/view-model`, window.location.origin);
      if (strategyId) {
        url.searchParams.set('strategyId', strategyId);
      }

      const response = await fetch(url.toString(), { cache: 'no-store' });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        console.error('[useStrategyViewModel] API error:', errorBody);
        throw new Error(
          errorBody.error || `Failed to fetch strategy view model: ${response.statusText}`
        );
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('[useStrategyViewModel] Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [companyId, strategyId]);

  // Initial fetch
  useEffect(() => {
    fetchViewModel();
  }, [fetchViewModel]);

  // Refresh handler
  const refresh = useCallback(async () => {
    await fetchViewModel();
  }, [fetchViewModel]);

  return {
    data,
    loading,
    error,
    refresh,
    setStrategyId,
  };
}

// ============================================================================
// Derived Helpers
// ============================================================================

/**
 * Check if the strategy frame has all required fields filled
 */
export function isFrameComplete(frameSummary: StrategyViewModelData['frameSummary']): boolean {
  return frameSummary.missing.length === 0;
}

/**
 * Get the completion percentage of the frame
 */
export function getFrameCompletion(frameSummary: StrategyViewModelData['frameSummary']): number {
  const total = frameSummary.fromUser.length + frameSummary.fromContext.length + frameSummary.missing.length;
  if (total === 0) return 0;
  const filled = frameSummary.fromUser.length + frameSummary.fromContext.length;
  return Math.round((filled / total) * 100);
}

/**
 * Check if the strategy is ready for AI proposal
 */
export function isReadyForAI(data: StrategyViewModelData | null): boolean {
  if (!data) return false;
  return data.readiness.isReady;
}

export default useStrategyViewModel;
