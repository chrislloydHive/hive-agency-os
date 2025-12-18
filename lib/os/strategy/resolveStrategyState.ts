// lib/os/strategy/resolveStrategyState.ts
// Strategy State Resolver
//
// WHY: Server-side resolution of which Strategy UI to render.
// Centralizes all the "what state am I in?" logic so page.tsx stays simple.
//
// Determines rendering mode for the Strategy Workspace page.
// NO SILENT FALLBACKS - every path is explicit.
//
// Canonical component: app/c/[companyId]/strategy/StrategyWorkspaceV4Client.tsx
// This is the AI-first, 3-column layout with artifact management.

import { getActiveStrategy } from '@/lib/os/strategy';
import { getArtifactsForCompany } from './artifacts';
import { toStrategyViewModel, createEmptyStrategyViewModel, type StrategyViewModel } from './strategyViewModel';
import { getStrategyInputs, type StrategyInputs, computeStrategyReadiness, type StrategyReadiness } from './strategyInputs';
import type { CompanyStrategy } from '@/lib/types/strategy';
import type { StrategyArtifact } from '@/lib/types/strategyArtifact';

// ============================================================================
// Types
// ============================================================================

/**
 * Fine-grained strategy editing states
 */
export type StrategyEditState =
  | 'ai_draft'        // Fresh AI-generated draft, not yet reviewed
  | 'saved'           // Saved but not finalized
  | 'user_modified'   // User has edited canonical fields
  | 'finalized';      // Locked and finalized

/**
 * Strategy State View Model - all data needed to render the canonical Strategy workspace
 */
export interface StrategyStateViewModel {
  strategy: CompanyStrategy;
  strategyViewModel: StrategyViewModel;
  artifacts: StrategyArtifact[];
  inputs: StrategyInputs;
  readiness: StrategyReadiness;
  /** Whether user has unsaved edits to canonical fields */
  hasUnsavedCanonicalEdits: boolean;
  /** Whether a new AI draft is available that differs from canonical */
  hasNewAiDraft: boolean;
}

/**
 * Strategy State - explicit rendering modes
 */
export type StrategyState =
  | {
      mode: 'ready';
      state: StrategyEditState;
      viewModel: StrategyStateViewModel;
    }
  | { mode: 'empty'; reason: 'no_strategy' | 'no_company' }
  | { mode: 'error'; errorCode: string; message: string; details?: string }
  | { mode: 'legacy'; reason: string };

/**
 * Resolver options
 */
export interface ResolveStrategyOptions {
  companyId: string;
  /** Force legacy mode (explicit opt-in only) */
  forceLegacy?: boolean;
}

// ============================================================================
// Resolver
// ============================================================================

/**
 * Resolve the Strategy state for a company.
 * NO SILENT FALLBACKS - every code path is explicit.
 */
export async function resolveStrategyState(
  options: ResolveStrategyOptions
): Promise<StrategyState> {
  const { companyId, forceLegacy } = options;
  const startTime = Date.now();

  // 1. Check for explicit legacy opt-in
  if (forceLegacy) {
    console.log('[STRATEGY_MODE]', {
      companyId,
      mode: 'legacy',
      reason: 'explicit_opt_in',
      ts: new Date().toISOString(),
    });
    return { mode: 'legacy', reason: 'Explicit legacy mode requested' };
  }

  try {
    // 2. Fetch all data in parallel with explicit error handling
    const [strategyResult, artifactsResult, inputsResult] = await Promise.allSettled([
      getActiveStrategy(companyId).catch((err: Error) => {
        console.error('[STRATEGY_STATE] strategy load error:', err);
        throw new Error(`Failed to load strategy: ${err.message}`);
      }),
      getArtifactsForCompany(companyId).catch((err: Error) => {
        console.error('[STRATEGY_STATE] artifacts load error:', err);
        throw new Error(`Failed to load artifacts: ${err.message}`);
      }),
      getStrategyInputs(companyId).catch((err: Error) => {
        console.error('[STRATEGY_STATE] inputs load error:', err);
        throw new Error(`Failed to load inputs: ${err.message}`);
      }),
    ]);

    // 3. Check for critical failures
    if (strategyResult.status === 'rejected') {
      const errorMessage = strategyResult.reason?.message || 'Strategy load failed';
      console.log('[STRATEGY_MODE]', {
        companyId,
        mode: 'error',
        errorCode: 'STRATEGY_LOAD_FAILED',
        message: errorMessage,
        ts: new Date().toISOString(),
      });
      return {
        mode: 'error',
        errorCode: 'STRATEGY_LOAD_FAILED',
        message: errorMessage,
        details: strategyResult.reason?.stack,
      };
    }

    if (inputsResult.status === 'rejected') {
      const errorMessage = inputsResult.reason?.message || 'Inputs load failed';
      console.log('[STRATEGY_MODE]', {
        companyId,
        mode: 'error',
        errorCode: 'INPUTS_LOAD_FAILED',
        message: errorMessage,
        ts: new Date().toISOString(),
      });
      return {
        mode: 'error',
        errorCode: 'INPUTS_LOAD_FAILED',
        message: errorMessage,
        details: inputsResult.reason?.stack,
      };
    }

    const strategy = strategyResult.value;
    const artifacts = artifactsResult.status === 'fulfilled' ? artifactsResult.value : [];
    const inputs = inputsResult.value;

    // 4. Handle empty state - V4 renders with empty workspace (no separate CTA page)
    // Create placeholder strategy for V4 to render empty workspace with guided starters
    const now = new Date().toISOString();
    const effectiveStrategy: CompanyStrategy = strategy ?? {
      id: '',
      companyId,
      title: '',
      summary: '',
      objectives: [],
      pillars: [],
      status: 'draft',
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    // 5. Hydrate strategy view model
    const strategyViewModel = strategy
      ? toStrategyViewModel(strategy)
      : createEmptyStrategyViewModel(companyId);

    // 6. Compute readiness
    const readiness = computeStrategyReadiness(inputs);

    // 7. Determine edit state (ai_draft for empty workspace)
    const isEmptyWorkspace = !strategy;
    const editState = isEmptyWorkspace ? 'ai_draft' : determineEditState(effectiveStrategy, artifacts);

    // 8. Check for unsaved canonical edits
    const hasUnsavedCanonicalEdits = isEmptyWorkspace ? false : checkUnsavedCanonicalEdits(effectiveStrategy);

    // 9. Check for new AI draft
    const hasNewAiDraft = isEmptyWorkspace ? false : checkNewAiDraft(effectiveStrategy, artifacts);

    // 10. Build view model
    const viewModel: StrategyStateViewModel = {
      strategy: effectiveStrategy,
      strategyViewModel,
      artifacts,
      inputs,
      readiness,
      hasUnsavedCanonicalEdits,
      hasNewAiDraft,
    };

    // 11. Log and return ready state
    console.log('[STRATEGY_MODE]', {
      companyId,
      mode: 'ready',
      state: editState,
      isEmptyWorkspace,
      strategyId: effectiveStrategy.id || '(new)',
      artifactCount: artifacts.length,
      readinessPercent: readiness.completenessPercent,
      hasUnsavedCanonicalEdits,
      hasNewAiDraft,
      durationMs: Date.now() - startTime,
      ts: new Date().toISOString(),
    });

    return {
      mode: 'ready',
      state: editState,
      viewModel,
    };

  } catch (error) {
    // Explicit error handling - NO fallback to legacy
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[STRATEGY_MODE]', {
      companyId,
      mode: 'error',
      errorCode: 'RESOLVE_FAILED',
      message: errorMessage,
      ts: new Date().toISOString(),
    });

    return {
      mode: 'error',
      errorCode: 'RESOLVE_FAILED',
      message: `Failed to load strategy: ${errorMessage}`,
      details: error instanceof Error ? error.stack : undefined,
    };
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Determine the editing state of the strategy
 */
function determineEditState(
  strategy: CompanyStrategy,
  artifacts: StrategyArtifact[]
): StrategyEditState {
  // Finalized strategies are locked
  if (strategy.status === 'finalized') {
    return 'finalized';
  }

  // Check if user has modified canonical fields (vs AI-generated)
  if (hasUserModifications(strategy)) {
    return 'user_modified';
  }

  // Check if this is a fresh AI draft
  if (isFreshAiDraft(strategy, artifacts)) {
    return 'ai_draft';
  }

  // Default to saved
  return 'saved';
}

/**
 * Check if user has modified canonical fields
 */
function hasUserModifications(strategy: CompanyStrategy): boolean {
  // If strategy was promoted from artifacts, user may have edited after
  if (strategy.promotedFromArtifacts) {
    // Check if updatedAt is significantly after finalizedAt or creation
    const createdAt = new Date(strategy.createdAt).getTime();
    const updatedAt = new Date(strategy.updatedAt).getTime();

    // If updated more than 5 minutes after creation, likely user-modified
    const fiveMinutes = 5 * 60 * 1000;
    if (updatedAt - createdAt > fiveMinutes && strategy.status !== 'finalized') {
      return true;
    }
  }

  return false;
}

/**
 * Check if this is a fresh AI-generated draft
 */
function isFreshAiDraft(
  strategy: CompanyStrategy,
  artifacts: StrategyArtifact[]
): boolean {
  // If strategy was just created and matches artifacts, it's a fresh draft
  if (strategy.status === 'draft' && strategy.sourceArtifactIds?.length) {
    const createdAt = new Date(strategy.createdAt).getTime();
    const updatedAt = new Date(strategy.updatedAt).getTime();

    // Fresh draft = created and not significantly modified
    const oneMinute = 60 * 1000;
    return (updatedAt - createdAt) < oneMinute;
  }

  return false;
}

/**
 * Check for unsaved canonical edits (client will track this more accurately)
 */
function checkUnsavedCanonicalEdits(_strategy: CompanyStrategy): boolean {
  // Server-side we can't know if there are unsaved edits
  // Client will track this via dirty state
  return false;
}

/**
 * Check if there's a new AI draft available
 */
function checkNewAiDraft(
  strategy: CompanyStrategy,
  artifacts: StrategyArtifact[]
): boolean {
  // Check for candidate artifacts that haven't been promoted
  const candidateArtifacts = artifacts.filter(a => a.status === 'candidate');

  // If there are candidate artifacts newer than strategy, there's a new draft
  const strategyUpdatedAt = new Date(strategy.updatedAt).getTime();

  return candidateArtifacts.some(artifact => {
    const artifactUpdatedAt = new Date(artifact.updatedAt).getTime();
    return artifactUpdatedAt > strategyUpdatedAt;
  });
}

// ============================================================================
// Exports
// ============================================================================

export type { StrategyViewModel, StrategyInputs, StrategyReadiness };
