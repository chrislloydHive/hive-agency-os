// app/api/os/companies/[companyId]/strategy/view-model/route.ts
// Server-side Strategy View Model resolution
//
// Returns a fully-hydrated strategy view model with:
// - Context-derived Strategic Frame values
// - Strategy Inputs readiness
// - Pillar-level audience inheritance
// - EXPLICIT mapping report for debugging
//
// This is the single source of truth for the Strategy Workspace UI.

import { NextRequest, NextResponse } from 'next/server';
import { getActiveStrategy, getStrategyById, getStrategiesForCompany } from '@/lib/os/strategy';
import { toStrategyViewModel, createEmptyStrategyViewModel } from '@/lib/os/strategy/strategyViewModel';
import {
  hydrateStrategyFrameFromContext,
  getFrameSourceSummary,
  type HydratedStrategyFrame,
} from '@/lib/os/strategy/strategyHydration';
import { getStrategyInputs, computeStrategyReadiness } from '@/lib/os/strategy/strategyInputs';
import type { StrategyReadiness, StrategyInputs } from '@/lib/os/strategy/strategyInputsHelpers';
import type { StrategyViewModel } from '@/lib/os/strategy/strategyViewModel';
import {
  loadContextForStrategy,
  mapContextToFrame,
  type MappingReport,
} from '@/lib/os/strategy/contextLoader';
import {
  getDraftsForStrategy,
  draftsToRecord,
  type StrategyDraft,
} from '@/lib/os/strategy/drafts';
import {
  computeAllHashes,
  computeStaleness,
  type StrategyHashes,
  type StalenessIndicators,
} from '@/lib/os/strategy/hashes';

// ============================================================================
// Response Types
// ============================================================================

interface StrategyViewModelResponse {
  // Strategy view model (for V2/V4 UI)
  viewModel: StrategyViewModel;

  // Raw strategy fields (for views that need direct access)
  strategy: {
    id: string | null;
    title: string;
    summary: string;
    objectives: unknown[];
    pillars: unknown[];
    plays: unknown[];
    tradeoffs?: unknown;
  };

  // Multi-strategy support
  strategies: Array<{
    id: string;
    title: string;
    isActive: boolean;
    status: string;
    updatedAt: string;
  }>;
  activeStrategyId: string | null;

  // Hydrated frame with provenance
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

  // Context snapshot for AI (full context data)
  contextSnapshot: unknown;

  // Mapping report for debugging
  mappingReport: MappingReport;

  // Strategy inputs and readiness
  readiness: StrategyReadiness;
  inputs: StrategyInputs | null;

  // Context load status
  contextStatus: {
    loaded: boolean;
    source: string;
    updatedAt: string | null;
    error: string | null;
  };

  // Hashes for staleness detection
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
    // Dev indicator for priorities source
    prioritiesSource: 'ai_generated' | 'user_created' | 'empty';
  };
}

// ============================================================================
// GET Handler
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  let companyId: string | undefined;
  try {
    const resolvedParams = await params;
    companyId = resolvedParams.companyId;
    const url = new URL(request.url);
    const strategyId = url.searchParams.get('strategyId');

    console.log('[view-model] Starting for company:', companyId);

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      );
    }

    // Load all strategies for multi-strategy support
    console.log('[view-model] Loading strategies...');
    const allStrategies = await getStrategiesForCompany(companyId);
    const strategiesSummary = allStrategies.map(s => ({
      id: s.id,
      title: s.title,
      isActive: s.isActive ?? false,
      status: s.status,
      updatedAt: s.updatedAt,
    }));

    // Load strategy (specific or active)
    console.log('[view-model] Loading active strategy...');
    let strategy = strategyId
      ? await getStrategyById(strategyId)
      : await getActiveStrategy(companyId);
    console.log('[view-model] Strategy loaded:', strategy?.id || '(none)');
    console.log('[view-model] Strategy strategyFrame from DB:', JSON.stringify(strategy?.strategyFrame));

    // Load context using CANONICAL loader (explicit, no silent fallbacks)
    console.log('[view-model] Loading context...');
    const contextResult = await loadContextForStrategy(companyId);
    console.log('[view-model] Context loaded:', contextResult.success);

    // Map Context to Strategy Frame with explicit reporting
    console.log('[view-model] Mapping context to frame...');
    const { frame: derivedFrame, report: mappingReport } = mapContextToFrame(
      contextResult.context,
      companyId
    );

    // Load strategy inputs
    console.log('[view-model] Loading strategy inputs...');
    let inputs: StrategyInputs | null = null;
    try {
      inputs = await getStrategyInputs(companyId);
      console.log('[view-model] Strategy inputs loaded');
    } catch (error) {
      console.warn('[view-model] Failed to load strategy inputs:', error);
    }

    // Convert strategy to view model
    console.log('[view-model] Converting to view model...');
    let viewModel: StrategyViewModel;
    if (strategy) {
      viewModel = toStrategyViewModel(strategy);
    } else {
      viewModel = createEmptyStrategyViewModel(companyId);
    }

    // Hydrate strategic frame from context (includes user overrides)
    console.log('[view-model] Hydrating strategic frame...');
    const hydratedFrame = hydrateStrategyFrameFromContext(
      strategy?.strategyFrame,
      contextResult.context
    );
    const frameSummary = getFrameSourceSummary(hydratedFrame);
    console.log('[view-model] Frame summary:', frameSummary);

    // Compute readiness
    const readiness: StrategyReadiness = inputs
      ? computeStrategyReadiness(inputs)
      : {
          isReady: false,
          completenessPercent: 0,
          missingCritical: [],
          warnings: [],
          canSynthesize: false,
          synthesizeBlockReason: 'No strategy inputs loaded',
        };

    // Compute hashes for staleness detection
    console.log('[view-model] Computing hashes...');
    const objectives = strategy?.objectives || [];
    const tactics = strategy?.plays || [];
    const hashes = computeAllHashes(
      contextResult.context,
      objectives,
      {
        title: strategy?.title,
        summary: strategy?.summary,
        pillars: strategy?.pillars,
        strategyFrame: strategy?.strategyFrame,
        tradeoffs: strategy?.tradeoffs,
      },
      tactics
    );

    // Compute staleness (compare to stored derived-from hashes if available)
    // For now, using empty derived-from hashes - would need to store these when generating
    const staleness = computeStaleness(hashes, {});

    // Load server-side drafts
    console.log('[view-model] Loading drafts...');
    let drafts: StrategyDraft[] = [];
    let draftsRecord: Record<string, StrategyDraft> = {};
    if (strategy?.id) {
      try {
        drafts = await getDraftsForStrategy(companyId, strategy.id);
        draftsRecord = draftsToRecord(drafts);
        console.log('[view-model] Loaded', drafts.length, 'drafts');
      } catch (error) {
        console.warn('[view-model] Failed to load drafts:', error);
      }
    }

    const response: StrategyViewModelResponse = {
      viewModel,
      strategy: {
        id: strategy?.id || null,
        title: strategy?.title || '',
        summary: strategy?.summary || '',
        objectives: strategy?.objectives || [],
        pillars: strategy?.pillars || [],
        plays: strategy?.plays || [],
        tradeoffs: strategy?.tradeoffs,
      },
      strategies: strategiesSummary,
      activeStrategyId: strategy?.id || null,
      hydratedFrame,
      frameSummary,
      derivedFrame,
      contextSnapshot: contextResult.context,
      mappingReport,
      readiness,
      inputs,
      contextStatus: {
        loaded: contextResult.success,
        source: contextResult.source,
        updatedAt: contextResult.meta?.updatedAt || null,
        error: contextResult.error || null,
      },
      hashes,
      staleness,
      drafts,
      draftsRecord,
      meta: {
        strategyId: strategy?.id || null,
        hasStrategy: !!strategy,
        isActive: strategy?.isActive ?? false,
        contextLoaded: contextResult.success,
        resolvedAt: new Date().toISOString(),
        // Priorities source for dev debugging
        prioritiesSource: strategy?.pillars && strategy.pillars.length > 0
          ? (strategy.lastAiUpdatedAt ? 'ai_generated' : 'user_created')
          : 'empty',
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[view-model] Error for company:', companyId);
    console.error('[view-model] Error details:', error);
    console.error('[view-model] Stack:', error instanceof Error ? error.stack : 'N/A');
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to resolve strategy view model',
        stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
