'use client';

// hooks/useStrategyOrchestration.ts
// Hook for Strategy Orchestration API
//
// Provides state management and API calls for the AI-first strategy workflow

import { useState, useCallback, useEffect } from 'react';
import type {
  StrategyOrchestrationViewModel,
  AIProposalAction,
  AIProposalResponse,
  ObjectiveDraft,
  StrategyDraft,
  TacticDraft,
  OrchestrationObjective,
} from '@/lib/types/strategyOrchestration';

// ============================================================================
// Types
// ============================================================================

interface UseStrategyOrchestrationOptions {
  companyId: string;
  strategyId?: string;
  autoLoad?: boolean;
}

interface DraftState {
  type: 'objectives' | 'strategy' | 'tactics' | 'field' | null;
  data: ObjectiveDraft[] | StrategyDraft | TacticDraft[] | FieldDraftData | null;
  inputHashes: AIProposalResponse['inputHashes'] | null;
}

interface FieldDraftData {
  fieldPath: string;
  originalValue: unknown;
  improvedValue: unknown;
  rationale: string;
}

interface OrchestrationState {
  viewModel: StrategyOrchestrationViewModel | null;
  isLoading: boolean;
  error: string | null;
  draft: DraftState;
  isProposing: boolean;
  isApplying: boolean;
  refreshing: {
    strategy: boolean;
    tactics: boolean;
    context: boolean;
  };
}

// ============================================================================
// Hook
// ============================================================================

export function useStrategyOrchestration({
  companyId,
  strategyId,
  autoLoad = true,
}: UseStrategyOrchestrationOptions) {
  const [state, setState] = useState<OrchestrationState>({
    viewModel: null,
    isLoading: false,
    error: null,
    draft: { type: null, data: null, inputHashes: null },
    isProposing: false,
    isApplying: false,
    refreshing: { strategy: false, tactics: false, context: false },
  });

  // ============================================================================
  // Load View Model
  // ============================================================================

  const loadViewModel = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const url = strategyId
        ? `/api/os/companies/${companyId}/strategy/orchestration?strategyId=${strategyId}`
        : `/api/os/companies/${companyId}/strategy/orchestration`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to load strategy view model');
      }

      const viewModel = await response.json();
      setState((prev) => ({ ...prev, viewModel, isLoading: false }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'An error occurred',
        isLoading: false,
      }));
    }
  }, [companyId, strategyId]);

  // Auto-load on mount
  useEffect(() => {
    if (autoLoad) {
      loadViewModel();
    }
  }, [autoLoad, loadViewModel]);

  // ============================================================================
  // AI Proposals
  // ============================================================================

  const propose = useCallback(
    async (
      action: AIProposalAction,
      options?: { fieldPath?: string; currentValue?: unknown; instructions?: string }
    ) => {
      setState((prev) => ({ ...prev, isProposing: true }));

      try {
        const response = await fetch(
          `/api/os/companies/${companyId}/strategy/ai-propose`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action,
              strategyId: strategyId || state.viewModel?.activeStrategyId,
              ...options,
            }),
          }
        );

        if (!response.ok) {
          throw new Error('Failed to generate proposal');
        }

        const proposal: AIProposalResponse = await response.json();

        // Set draft based on action type
        let draftState: DraftState = { type: null, data: null, inputHashes: null };

        switch (action) {
          case 'propose_objectives':
            draftState = {
              type: 'objectives',
              data: proposal.objectiveDrafts || [],
              inputHashes: proposal.inputHashes,
            };
            break;
          case 'propose_strategy':
            draftState = {
              type: 'strategy',
              data: proposal.strategyDraft || null,
              inputHashes: proposal.inputHashes,
            };
            break;
          case 'propose_tactics':
            draftState = {
              type: 'tactics',
              data: proposal.tacticDrafts || [],
              inputHashes: proposal.inputHashes,
            };
            break;
          case 'improve_field':
            if (proposal.fieldImprovement) {
              draftState = {
                type: 'field',
                data: proposal.fieldImprovement as FieldDraftData,
                inputHashes: proposal.inputHashes,
              };
            }
            break;
        }

        setState((prev) => ({ ...prev, draft: draftState, isProposing: false }));
        return proposal;
      } catch (err) {
        setState((prev) => ({ ...prev, isProposing: false }));
        throw err;
      }
    },
    [companyId, strategyId, state.viewModel?.activeStrategyId]
  );

  // ============================================================================
  // Apply Drafts
  // ============================================================================

  const applyDraft = useCallback(async () => {
    if (!state.draft.type || !state.draft.data) return;

    setState((prev) => ({ ...prev, isApplying: true }));

    try {
      const actionMap = {
        objectives: 'apply_objectives',
        strategy: 'apply_strategy',
        tactics: 'apply_tactics',
        field: 'apply_field',
      };

      const bodyMap = {
        objectives: { objectiveDrafts: state.draft.data },
        strategy: { strategyDraft: state.draft.data },
        tactics: { tacticDrafts: state.draft.data },
        field: {
          fieldPath: (state.draft.data as FieldDraftData).fieldPath,
          newValue: (state.draft.data as FieldDraftData).improvedValue,
        },
      };

      const response = await fetch(
        `/api/os/companies/${companyId}/strategy/apply`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: actionMap[state.draft.type],
            strategyId: strategyId || state.viewModel?.activeStrategyId,
            inputHashes: state.draft.inputHashes,
            ...bodyMap[state.draft.type],
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to apply draft');
      }

      // Clear draft and reload
      setState((prev) => ({
        ...prev,
        draft: { type: null, data: null, inputHashes: null },
        isApplying: false,
      }));

      await loadViewModel();
    } catch (err) {
      setState((prev) => ({ ...prev, isApplying: false }));
      throw err;
    }
  }, [companyId, strategyId, state.draft, state.viewModel?.activeStrategyId, loadViewModel]);

  const dismissDraft = useCallback(() => {
    setState((prev) => ({
      ...prev,
      draft: { type: null, data: null, inputHashes: null },
    }));
  }, []);

  // ============================================================================
  // Refresh Actions (for staleness)
  // ============================================================================

  const refreshStrategy = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      refreshing: { ...prev.refreshing, strategy: true },
    }));
    await propose('propose_strategy');
    setState((prev) => ({
      ...prev,
      refreshing: { ...prev.refreshing, strategy: false },
    }));
  }, [propose]);

  const refreshTactics = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      refreshing: { ...prev.refreshing, tactics: true },
    }));
    await propose('propose_tactics');
    setState((prev) => ({
      ...prev,
      refreshing: { ...prev.refreshing, tactics: false },
    }));
  }, [propose]);

  const refreshContext = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      refreshing: { ...prev.refreshing, context: true },
    }));
    await loadViewModel();
    setState((prev) => ({
      ...prev,
      refreshing: { ...prev.refreshing, context: false },
    }));
  }, [loadViewModel]);

  // ============================================================================
  // Update Objectives Locally
  // ============================================================================

  const updateObjectives = useCallback((objectives: OrchestrationObjective[]) => {
    setState((prev) => {
      if (!prev.viewModel) return prev;
      return {
        ...prev,
        viewModel: {
          ...prev.viewModel,
          objectives,
        },
      };
    });
  }, []);

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // State
    viewModel: state.viewModel,
    isLoading: state.isLoading,
    error: state.error,
    draft: state.draft,
    isProposing: state.isProposing,
    isApplying: state.isApplying,
    refreshing: state.refreshing,

    // Actions
    loadViewModel,
    propose,
    applyDraft,
    dismissDraft,
    refreshStrategy,
    refreshTactics,
    refreshContext,
    updateObjectives,

    // Convenience getters
    hasActiveDraft: state.draft.type !== null,
    staleness: state.viewModel?.staleness || {
      strategyStale: false,
      strategyStaleReason: null,
      tacticsStale: false,
      tacticsStaleReason: null,
      contextChanged: false,
      contextChangedReason: null,
    },
    readiness: state.viewModel?.readiness || {
      completenessPercent: 0,
      missingInputs: [],
      canGenerateStrategy: false,
      canGenerateTactics: false,
      blockedReason: null,
    },
  };
}
