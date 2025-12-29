'use client';

// hooks/useUnifiedStrategyViewModel.ts
// Unified Strategy View Model Hook
//
// CONSOLIDATION: This hook replaces both useStrategyViewModel and useStrategyOrchestration
// All strategy views (Builder, Blueprint, Command, Orchestration) should use this single hook.
//
// Provides:
// - Full strategy view model from /view-model endpoint
// - All data needed for any view mode
// - Draft management helpers
// - AI proposal actions
// - Multi-strategy support

import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import type { StrategyViewModel } from '@/lib/os/strategy/strategyViewModel';
import type { HydratedStrategyFrame } from '@/lib/os/strategy/strategyHydration';
import type { StrategyReadiness, StrategyInputs } from '@/lib/os/strategy/strategyInputsHelpers';
import type { MappingReport } from '@/lib/os/strategy/contextLoader';
import type { StrategyDraft } from '@/lib/os/strategy/drafts';
import type { StrategyHashes, StalenessIndicators } from '@/lib/os/strategy/hashes';
import type { StrategyObjective, StrategyPillar, StrategyPlay } from '@/lib/types/strategy';

// ============================================================================
// Types
// ============================================================================

export type StrategyView = 'builder' | 'blueprint' | 'command' | 'orchestration';

export interface StrategyListItem {
  id: string;
  title: string;
  isActive: boolean;
  status: string;
  updatedAt: string;
}

export interface UnifiedStrategyViewModelData {
  // Core view model (for V2/V4 UI)
  viewModel: StrategyViewModel;

  // Raw strategy fields (for views that need direct access)
  strategy: {
    id: string | null;
    title: string;
    summary: string;
    objectives: StrategyObjective[];
    pillars: StrategyPillar[];
    plays: StrategyPlay[];
    tradeoffs?: {
      optimizesFor?: string[];
      sacrifices?: string[];
      risks?: string[];
    };
    /** Goal statement for AI alignment (strategy-scoped) */
    goalStatement?: string;
  };

  // Multi-strategy support
  strategies: StrategyListItem[];
  activeStrategyId: string | null;

  // Hydrated frame with provenance
  hydratedFrame: HydratedStrategyFrame;
  frameSummary: {
    fromUser: string[];
    fromContext: string[];
    missing: string[];
  };

  // Context-derived frame values
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

  // Strategy readiness
  readiness: StrategyReadiness;
  inputs: StrategyInputs | null;

  // Context status
  contextStatus: {
    loaded: boolean;
    source: string;
    updatedAt: string | null;
    error: string | null;
  };

  // Hashes for staleness
  hashes: StrategyHashes;
  staleness: StalenessIndicators;

  // Server-side drafts
  drafts: StrategyDraft[];
  draftsRecord: Record<string, StrategyDraft>;

  // Metadata
  meta: {
    strategyId: string | null;
    hasStrategy: boolean;
    isActive: boolean;
    contextLoaded: boolean;
    resolvedAt: string;
    prioritiesSource?: 'ai_generated' | 'user_created' | 'empty';
  };
}

// Computed helpers for all views
export interface UnifiedStrategyHelpers {
  // Derived data for easier access
  objectives: StrategyObjective[];
  priorities: StrategyPillar[];
  tactics: StrategyPlay[];

  // Readiness indicators
  canGenerateStrategy: boolean;
  canGenerateTactics: boolean;
  blockedReason: string | null;

  // Frame status
  isFrameComplete: boolean;
  frameCompletionPercent: number;

  // AI readiness
  isReadyForAI: boolean;
}

/** Fields that can be updated via updateStrategy */
export interface StrategyUpdatePayload {
  objectives?: StrategyObjective[];
  pillars?: StrategyPillar[];
  plays?: StrategyPlay[];
  goalStatement?: string;
  title?: string;
  summary?: string;
}

export interface UseUnifiedStrategyViewModelResult {
  // Data
  data: UnifiedStrategyViewModelData | null;
  helpers: UnifiedStrategyHelpers | null;

  // Loading states
  loading: boolean;
  error: string | null;

  // Actions
  refresh: () => Promise<void>;
  setStrategyId: (id: string | null) => void;

  // Update strategy content (persists to backend)
  updateStrategy: (updates: StrategyUpdatePayload) => Promise<boolean>;

  // Draft actions
  applyDraft: (draft: StrategyDraft) => Promise<boolean>;
  discardDraft: (draftId: string) => Promise<boolean>;

  // AI actions
  proposeObjectives: () => Promise<void>;
  proposeStrategy: () => Promise<void>;
  proposeTactics: () => Promise<void>;
  improveField: (fieldPath: string, currentValue: string) => Promise<void>;

  // State
  isProposing: boolean;
  isApplying: boolean;
}

// ============================================================================
// Hook
// ============================================================================

export function useUnifiedStrategyViewModel(
  companyId: string,
  initialStrategyId?: string | null
): UseUnifiedStrategyViewModelResult {
  const [data, setData] = useState<UnifiedStrategyViewModelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [strategyId, setStrategyId] = useState<string | null>(initialStrategyId ?? null);
  const [isProposing, setIsProposing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [_isRefreshing, setIsRefreshing] = useState(false);

  // Fetch view model from unified endpoint
  const fetchViewModel = useCallback(async (isRefresh = false) => {
    if (!companyId) return;

    // Only show full loading state on initial load, not refresh
    if (!isRefresh) {
      setLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setError(null);

    try {
      const url = new URL(`/api/os/companies/${companyId}/strategy/view-model`, window.location.origin);
      if (strategyId) {
        url.searchParams.set('strategyId', strategyId);
      }

      const response = await fetch(url.toString(), { cache: 'no-store' });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || `Failed to fetch: ${response.statusText}`);
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('[useUnifiedStrategyViewModel] Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [companyId, strategyId]);

  // Track pathname to detect navigation
  const pathname = usePathname();

  // Initial fetch - runs on mount AND when pathname changes (navigation)
  // This ensures fresh data is fetched when navigating to the strategy page
  useEffect(() => {
    fetchViewModel(false);
  }, [fetchViewModel, pathname]);

  // Refresh handler - doesn't show full loading state
  const refresh = useCallback(async () => {
    await fetchViewModel(true);
  }, [fetchViewModel]);

  // =========================================================================
  // Computed Helpers
  // =========================================================================

  const helpers = useMemo<UnifiedStrategyHelpers | null>(() => {
    if (!data) return null;

    const strategy = data.strategy;
    const objectives = strategy.objectives || [];
    const priorities = strategy.pillars || [];
    const tactics = strategy.plays || [];

    // Frame completion
    const frameSummary = data.frameSummary;
    const totalFields = frameSummary.fromUser.length + frameSummary.fromContext.length + frameSummary.missing.length;
    const filledFields = frameSummary.fromUser.length + frameSummary.fromContext.length;
    const frameCompletionPercent = totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;

    // AI readiness
    const canGenerateStrategy = data.readiness.isReady || (objectives.length > 0 && frameCompletionPercent >= 60);
    const canGenerateTactics = priorities.length > 0;
    const blockedReason = data.readiness.synthesizeBlockReason || null;

    return {
      objectives,
      priorities,
      tactics,
      canGenerateStrategy,
      canGenerateTactics,
      blockedReason,
      isFrameComplete: frameSummary.missing.length === 0,
      frameCompletionPercent,
      isReadyForAI: data.readiness.isReady,
    };
  }, [data]);

  // =========================================================================
  // Draft Actions
  // =========================================================================

  const applyDraft = useCallback(async (draft: StrategyDraft): Promise<boolean> => {
    if (!data?.activeStrategyId) return false;

    setIsApplying(true);
    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/strategy/apply-draft`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            strategyId: data.activeStrategyId,
            scopeType: draft.scopeType,
            fieldKey: draft.fieldKey,
            entityId: draft.entityId,
            // Auto-force apply since user explicitly clicked Apply
            // Staleness warnings can be shown in UI before this point if needed
            forceApply: true,
          }),
        }
      );

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || errorBody.message || 'Failed to apply draft');
      }

      // Refresh to get updated data (don't show loading spinner)
      await fetchViewModel(true);
      return true;
    } catch (err) {
      console.error('[applyDraft] Error:', err);
      return false;
    } finally {
      setIsApplying(false);
    }
  }, [companyId, data?.activeStrategyId, fetchViewModel]);

  const discardDraft = useCallback(async (draftId: string): Promise<boolean> => {
    if (!data?.activeStrategyId) return false;

    try {
      const draft = data.drafts.find(d => d.id === draftId);
      if (!draft) return false;

      const params = new URLSearchParams({
        strategyId: data.activeStrategyId,
        scopeType: draft.scopeType,
        fieldKey: draft.fieldKey,
      });
      if (draft.entityId) params.set('entityId', draft.entityId);

      const response = await fetch(
        `/api/os/companies/${companyId}/strategy/apply-draft?${params}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        throw new Error('Failed to discard draft');
      }

      await fetchViewModel(true);
      return true;
    } catch (err) {
      console.error('[discardDraft] Error:', err);
      return false;
    }
  }, [companyId, data?.activeStrategyId, data?.drafts, fetchViewModel]);

  // =========================================================================
  // AI Actions
  // =========================================================================

  const proposeObjectives = useCallback(async () => {
    if (!data?.activeStrategyId) return;

    setIsProposing(true);
    try {
      await fetch(`/api/os/companies/${companyId}/strategy/ai-propose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'propose_objectives',
          strategyId: data.activeStrategyId,
        }),
      });
      await fetchViewModel(true);
    } finally {
      setIsProposing(false);
    }
  }, [companyId, data?.activeStrategyId, fetchViewModel]);

  const proposeStrategy = useCallback(async () => {
    if (!data?.activeStrategyId) return;

    setIsProposing(true);
    try {
      await fetch(`/api/os/companies/${companyId}/strategy/ai-propose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'propose_strategy',
          strategyId: data.activeStrategyId,
        }),
      });
      await fetchViewModel(true);
    } finally {
      setIsProposing(false);
    }
  }, [companyId, data?.activeStrategyId, fetchViewModel]);

  const proposeTactics = useCallback(async () => {
    if (!data?.activeStrategyId) return;

    setIsProposing(true);
    try {
      await fetch(`/api/os/companies/${companyId}/strategy/ai-propose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'propose_tactics',
          strategyId: data.activeStrategyId,
        }),
      });
      await fetchViewModel(true);
    } finally {
      setIsProposing(false);
    }
  }, [companyId, data?.activeStrategyId, fetchViewModel]);

  const improveField = useCallback(async (fieldPath: string, currentValue: string) => {
    if (!data?.activeStrategyId) return;

    setIsProposing(true);
    try {
      await fetch(`/api/os/companies/${companyId}/strategy/ai-propose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'improve_field',
          strategyId: data.activeStrategyId,
          fieldPath,
          currentValue,
        }),
      });
      await fetchViewModel(true);
    } finally {
      setIsProposing(false);
    }
  }, [companyId, data?.activeStrategyId, fetchViewModel]);

  // Update strategy content (pillars, plays, objectives, etc.)
  const updateStrategy = useCallback(async (updates: StrategyUpdatePayload): Promise<boolean> => {
    if (!data?.activeStrategyId) {
      console.warn('[updateStrategy] No active strategy ID');
      return false;
    }

    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/strategy/${data.activeStrategyId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[updateStrategy] Failed:', errorData);
        return false;
      }

      // Optionally refresh to sync state (but for optimistic updates, caller may skip this)
      // await fetchViewModel(true);
      return true;
    } catch (error) {
      console.error('[updateStrategy] Error:', error);
      return false;
    }
  }, [companyId, data?.activeStrategyId]);

  return {
    data,
    helpers,
    loading,
    error,
    refresh,
    setStrategyId,
    updateStrategy,
    applyDraft,
    discardDraft,
    proposeObjectives,
    proposeStrategy,
    proposeTactics,
    improveField,
    isProposing,
    isApplying,
  };
}

export default useUnifiedStrategyViewModel;
