// app/api/os/companies/[companyId]/strategy/orchestration/route.ts
// Strategy Orchestration View Model - SINGLE SOURCE OF TRUTH
//
// Returns the complete StrategyOrchestrationViewModel with:
// - Context snapshot (read-only facts)
// - Objectives, strategies, tactics
// - Freshness hashes for staleness detection
// - Staleness indicators for UI banners
//
// This is the canonical endpoint for the AI-first strategy workflow.

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import { getActiveStrategy, getStrategiesForCompany } from '@/lib/os/strategy';
import { loadContextForStrategy, mapContextToFrame } from '@/lib/os/strategy/contextLoader';
import { getStrategyInputs, computeStrategyReadiness } from '@/lib/os/strategy/strategyInputs';
import type {
  StrategyOrchestrationViewModel,
  ContextSnapshot,
  OrchestrationObjective,
  OrchestrationPriority,
  OrchestrationTactic,
  FreshnessHashes,
  computeHash,
} from '@/lib/types/strategyOrchestration';
import { computeHash as computeFreshnessHash } from '@/lib/types/strategyOrchestration';
import type { CompanyStrategy, StrategyObjective } from '@/lib/types/strategy';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build context snapshot from context graph
 */
function buildContextSnapshot(
  companyId: string,
  companyName: string,
  contextResult: Awaited<ReturnType<typeof loadContextForStrategy>>
): ContextSnapshot {
  const context = contextResult.context;

  // Helper to safely unwrap WithMeta fields
  const unwrap = <T>(field: { value: T | null } | undefined | null): T | null => {
    if (!field) return null;
    return field.value ?? null;
  };

  // Helper to safely convert to string array
  const toStringArray = (val: unknown): string[] | null => {
    if (!val) return null;
    if (Array.isArray(val)) return val.map(String);
    if (typeof val === 'string') return [val];
    return null;
  };

  const snapshot: ContextSnapshot = {
    companyId,
    companyName,
    audience: {
      primaryAudience: context ? unwrap(context.audience?.primaryAudience) : null,
      icpDescription: context ? unwrap(context.audience?.icpDescription) : null,
      segments: context ? toStringArray(unwrap(context.audience?.coreSegments)) : null,
    },
    offering: {
      primaryProducts: context ? toStringArray(unwrap(context.productOffer?.primaryProducts)) : null,
      valueProposition: context ? unwrap(context.productOffer?.valueProposition) : null,
      heroProducts: context ? toStringArray(unwrap(context.productOffer?.heroProducts)) : null,
    },
    constraints: {
      minBudget: null, // Not in current context schema
      maxBudget: null,
      budgetNotes: null,
      geographicConstraints: context ? unwrap(context.identity?.geographicFootprint) : null,
      complianceRequirements: context ? toStringArray(unwrap(context.operationalConstraints?.industryRegulations)) : null,
    },
    competition: {
      competitors: [], // Would need to load from competition data
      competitivePosition: context ? unwrap(context.identity?.marketPosition) : null,
    },
    brand: {
      positioning: context ? unwrap(context.identity?.marketPosition) : null,
      voiceTone: context ? unwrap(context.brand?.toneOfVoice) : null,
      coreValues: null,
    },
    hash: context ? computeFreshnessHash(context) : 'empty',
  };

  return snapshot;
}

/**
 * Convert strategy objectives to orchestration format
 */
function mapObjectivesToOrchestration(
  objectives: string[] | StrategyObjective[],
  strategy: CompanyStrategy
): OrchestrationObjective[] {
  if (!objectives || objectives.length === 0) return [];

  return objectives.map((obj, index) => {
    // Handle both legacy string[] and new StrategyObjective[] formats
    const isLegacy = typeof obj === 'string';
    const text = isLegacy ? obj : obj.text;
    const id = isLegacy ? `obj-${index}` : obj.id || `obj-${index}`;

    return {
      id,
      text,
      metric: isLegacy ? undefined : obj.metric,
      target: isLegacy ? undefined : obj.target,
      timeframe: isLegacy ? undefined : obj.timeframe,
      status: 'active' as const,
      updatedAt: strategy.updatedAt,
    };
  });
}

/**
 * Convert strategy pillars to orchestration priorities
 */
function mapPillarsToOrchestration(
  strategy: CompanyStrategy
): OrchestrationPriority[] {
  if (!strategy.pillars || strategy.pillars.length === 0) return [];

  return strategy.pillars.map((pillar) => ({
    ...pillar,
    provenance: strategy.lastAiUpdatedAt ? {
      generatedByAI: true,
      generatedAt: strategy.lastAiUpdatedAt,
      basedOnHashes: {},
    } : undefined,
  }));
}

/**
 * Convert strategy plays to orchestration tactics
 */
function mapPlaysToOrchestration(
  strategy: CompanyStrategy
): OrchestrationTactic[] {
  if (!strategy.plays || strategy.plays.length === 0) return [];

  return strategy.plays.map((play) => ({
    ...play,
    provenance: strategy.lastAiUpdatedAt ? {
      generatedByAI: true,
      generatedAt: strategy.lastAiUpdatedAt,
      basedOnHashes: {},
    } : undefined,
  }));
}

/**
 * Compute freshness hashes for staleness detection
 */
function computeFreshnessHashes(
  contextSnapshot: ContextSnapshot,
  objectives: OrchestrationObjective[],
  strategy: CompanyStrategy | null
): FreshnessHashes {
  return {
    contextHash: contextSnapshot.hash,
    objectivesHash: computeFreshnessHash(objectives.map(o => o.text)),
    strategyHash: strategy ? computeFreshnessHash({
      title: strategy.title,
      pillars: strategy.pillars,
      tradeoffs: strategy.tradeoffs,
    }) : 'empty',
    tacticsDerivedFromStrategyHash: strategy?.plays && strategy.plays.length > 0
      ? computeFreshnessHash({
          title: strategy.title,
          pillars: strategy.pillars,
        })
      : null,
  };
}

/**
 * Compute staleness indicators
 */
function computeStaleness(
  hashes: FreshnessHashes,
  contextResult: Awaited<ReturnType<typeof loadContextForStrategy>>,
  strategy: CompanyStrategy | null
): StrategyOrchestrationViewModel['staleness'] {
  // Check if strategy might be stale due to context changes
  const contextChanged = strategy?.lastAiUpdatedAt
    ? new Date(contextResult.meta?.updatedAt || 0) > new Date(strategy.lastAiUpdatedAt)
    : false;

  // Check if tactics might be stale due to strategy changes
  const tacticsStale = hashes.tacticsDerivedFromStrategyHash !== null &&
    hashes.tacticsDerivedFromStrategyHash !== hashes.strategyHash;

  return {
    strategyStale: contextChanged,
    strategyStaleReason: contextChanged
      ? 'Context has been updated since strategy was generated'
      : null,
    tacticsStale,
    tacticsStaleReason: tacticsStale
      ? 'Strategy priorities have changed since tactics were derived'
      : null,
    contextChanged,
    contextChangedReason: contextChanged
      ? `Context updated at ${contextResult.meta?.updatedAt}`
      : null,
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

    console.log('[orchestration] Starting for company:', companyId);

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      );
    }

    // Load company info
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    // Load context
    console.log('[orchestration] Loading context...');
    const contextResult = await loadContextForStrategy(companyId);

    // Build context snapshot
    const contextSnapshot = buildContextSnapshot(
      companyId,
      company.name || 'Unknown Company',
      contextResult
    );

    // Load all strategies for this company
    console.log('[orchestration] Loading strategies...');
    const allStrategies = await getStrategiesForCompany(companyId);

    // Get active strategy
    const activeStrategy = await getActiveStrategy(companyId);

    // Map strategies to list format
    const strategies = allStrategies.map((s) => ({
      id: s.id,
      title: s.title,
      status: s.status,
      isActive: s.isActive,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));

    // Map objectives from active strategy
    const objectives = activeStrategy
      ? mapObjectivesToOrchestration(activeStrategy.objectives, activeStrategy)
      : [];

    // Map priorities from active strategy
    const priorities = activeStrategy
      ? mapPillarsToOrchestration(activeStrategy)
      : [];

    // Map tactics from active strategy
    const tactics = activeStrategy
      ? mapPlaysToOrchestration(activeStrategy)
      : [];

    // Load strategy inputs for readiness
    console.log('[orchestration] Loading strategy inputs...');
    let readiness: StrategyOrchestrationViewModel['readiness'];
    try {
      const inputs = await getStrategyInputs(companyId);
      const computed = computeStrategyReadiness(inputs);
      readiness = {
        completenessPercent: computed.completenessPercent,
        missingInputs: computed.missingCritical.map((field) => ({
          field: String(field),
          label: String(field).replace(/([A-Z])/g, ' $1').trim(),
          critical: true,
        })),
        canGenerateStrategy: computed.canSynthesize,
        canGenerateTactics: computed.isReady && activeStrategy !== null && priorities.length > 0,
        blockedReason: computed.synthesizeBlockReason || null,
      };
    } catch {
      readiness = {
        completenessPercent: 0,
        missingInputs: [],
        canGenerateStrategy: false,
        canGenerateTactics: false,
        blockedReason: 'Could not load strategy inputs',
      };
    }

    // Compute freshness hashes
    const hashes = computeFreshnessHashes(contextSnapshot, objectives, activeStrategy);

    // Compute staleness
    const staleness = computeStaleness(hashes, contextResult, activeStrategy);

    // Build active strategy details
    const activeStrategyDetails = activeStrategy ? {
      id: activeStrategy.id,
      title: activeStrategy.title,
      summary: activeStrategy.summary,
      priorities,
      tradeoffs: {
        optimizesFor: activeStrategy.tradeoffs?.optimizesFor || [],
        sacrifices: activeStrategy.tradeoffs?.sacrifices || [],
        risks: activeStrategy.tradeoffs?.risks || [],
      },
      status: activeStrategy.status as 'draft' | 'finalized' | 'archived',
      provenance: activeStrategy.lastAiUpdatedAt ? {
        generatedByAI: true,
        generatedAt: activeStrategy.lastAiUpdatedAt,
        basedOnHashes: {},
      } : undefined,
    } : null;

    // Build full view model
    const viewModel: StrategyOrchestrationViewModel = {
      companyId,
      companyName: company.name || 'Unknown Company',
      contextSnapshot,
      objectives,
      strategies: strategies.map((s) => ({
        ...s,
        isActive: s.isActive ?? false,
      })),
      activeStrategyId: activeStrategy?.id || null,
      activeStrategy: activeStrategyDetails,
      tactics,
      readiness,
      hashes,
      staleness,
      meta: {
        resolvedAt: new Date().toISOString(),
        viewModelVersion: '1.0.0',
      },
    };

    console.log('[orchestration] View model built successfully');

    return NextResponse.json(viewModel);
  } catch (error) {
    console.error('[orchestration] Error for company:', companyId);
    console.error('[orchestration] Error details:', error);
    console.error('[orchestration] Stack:', error instanceof Error ? error.stack : 'N/A');
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to resolve strategy orchestration view model',
        stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
