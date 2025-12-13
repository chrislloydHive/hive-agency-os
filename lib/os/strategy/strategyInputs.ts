// lib/os/strategy/strategyInputs.ts
// Strategy Inputs ViewModel
//
// Provides a unified view of all inputs needed for strategy development.
// Sources from:
// - CompanyContextGraph (canonical context)
// - Competition source selection (V4 > V3)
// - Hive Brain (doctrine + capabilities)
//
// IMPORTANT: This is read-only. Strategy page cannot edit context directly.

import { loadContextGraph } from '@/lib/contextGraph/storage';
import { getHiveGlobalContextGraph, HIVE_BRAIN_DOMAINS } from '@/lib/contextGraph/globalGraph';
import {
  selectCompetitionSource,
  type CompetitionSourceSelection,
  type CompetitionRunInfo,
} from '@/lib/os/competition';
import { getOSGlobalContext } from '@/lib/os/globalContext';
import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';
import type { CompetitorProfile } from '@/lib/contextGraph/domains/competitive';
import type { WithMetaType } from '@/lib/contextGraph/types';
import {
  CAPABILITY_CATEGORIES,
  CAPABILITY_LABELS,
  type CapabilitiesDomain,
} from '@/lib/contextGraph/domains/capabilities';

// ============================================================================
// Types - Re-exported from client-safe helpers
// ============================================================================

// Re-export all types from helpers (client-safe)
export type {
  ProvenanceInfo,
  BusinessReality,
  BusinessRealityWithProvenance,
  Constraints,
  ConstraintsWithProvenance,
  CompetitiveLandscape,
  ExecutionCapabilities,
  StrategyInputsMeta,
  StrategyInputs,
  StrategyInputsWithProvenance,
  CriticalInput,
  StrategyReadiness,
} from './strategyInputsHelpers';

// Re-export functions from helpers (client-safe)
export {
  computeStrategyReadiness,
  getContextDeepLink,
  getHiveBrainLink,
} from './strategyInputsHelpers';

// Import types for use in this file
import type {
  ProvenanceInfo,
  BusinessReality,
  BusinessRealityWithProvenance,
  Constraints,
  ConstraintsWithProvenance,
  CompetitiveLandscape,
  ExecutionCapabilities,
  StrategyInputsMeta,
  StrategyInputs,
  StrategyInputsWithProvenance,
} from './strategyInputsHelpers';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract value from WithMeta wrapper
 */
function unwrap<T>(field: WithMetaType<T> | undefined): T | null {
  if (!field) return null;
  return field.value ?? null;
}

/**
 * Extract provenance info from WithMeta field
 */
function getProvenance(
  field: { value: unknown; provenance: Array<{ source: string; updatedAt: string; confidence?: number }> } | undefined,
  fieldPath: string
): ProvenanceInfo | null {
  if (!field || !field.provenance || field.provenance.length === 0) {
    return null;
  }
  const latest = field.provenance[0];
  return {
    source: latest.source,
    updatedAt: latest.updatedAt || null,
    confidence: latest.confidence ?? null,
    fieldPath,
  };
}

/**
 * Build goals array from objectives domain
 * Uses primaryObjective and/or primaryBusinessGoal, falling back to secondaryObjectives
 */
function buildGoals(graph: CompanyContextGraph): string[] {
  const goals: string[] = [];

  const primaryObjective = graph.objectives?.primaryObjective?.value;
  if (primaryObjective) {
    goals.push(primaryObjective);
  }

  const primaryBusinessGoal = graph.objectives?.primaryBusinessGoal?.value;
  if (primaryBusinessGoal && primaryBusinessGoal !== primaryObjective) {
    goals.push(primaryBusinessGoal);
  }

  // Add secondary objectives if we don't have primary goals
  if (goals.length === 0) {
    const secondaryObjectives = graph.objectives?.secondaryObjectives?.value || [];
    for (const obj of secondaryObjectives) {
      if (obj) goals.push(obj);
    }
  }

  return goals;
}

/**
 * Build service taxonomy summary from capabilities domain
 */
function buildServiceTaxonomy(capabilities: CapabilitiesDomain | undefined): string[] {
  if (!capabilities) return [];

  const services: string[] = [];

  // Check each category
  for (const category of CAPABILITY_CATEGORIES) {
    const categoryData = capabilities[category];
    if (!categoryData) continue;

    for (const [key, capability] of Object.entries(categoryData)) {
      if (capability?.enabled?.value) {
        const label = CAPABILITY_LABELS[key as keyof typeof CAPABILITY_LABELS] || key;
        services.push(label);
      }
    }
  }

  return services;
}

/**
 * Get competition runs for source selection
 * This queries the competitive domain for run info
 */
async function getCompetitionRuns(graph: CompanyContextGraph): Promise<{
  v4Runs: CompetitionRunInfo[];
  v3Runs: CompetitionRunInfo[];
}> {
  // Check provenance of competitive domain to determine source
  const competitorProvenance = graph.competitive?.competitors?.provenance || [];

  const v4Runs: CompetitionRunInfo[] = [];
  const v3Runs: CompetitionRunInfo[] = [];

  for (const prov of competitorProvenance) {
    // Check for V4 competition source
    if (prov.source === ('competition_v4' as string)) {
      v4Runs.push({
        id: `v4_${prov.updatedAt}`,
        version: 'v4',
        createdAt: prov.updatedAt,
        status: 'completed',
      });
    } else if (prov.source === 'competition_lab') {
      v3Runs.push({
        id: `v3_${prov.updatedAt}`,
        version: 'v3',
        createdAt: prov.updatedAt,
        status: 'completed',
      });
    }
  }

  return { v4Runs, v3Runs };
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Get Strategy Inputs for a company
 *
 * Loads from canonical Context Graph and Hive Brain.
 * Competition uses V4 > V3 selection logic.
 *
 * @param companyId - Company ID
 * @returns Strategy inputs view model
 */
export async function getStrategyInputs(companyId: string): Promise<StrategyInputs> {
  // Load context graph and Hive Brain in parallel
  const [graph, hiveBrain, osContext] = await Promise.all([
    loadContextGraph(companyId),
    getHiveGlobalContextGraph(),
    Promise.resolve(getOSGlobalContext()),
  ]);

  // If no graph exists, return empty inputs
  if (!graph) {
    return createEmptyStrategyInputs();
  }

  // Get competition source selection
  const { v4Runs, v3Runs } = await getCompetitionRuns(graph);
  const competitionSource = selectCompetitionSource(v4Runs, v3Runs);

  // Build business reality
  // Note: coreSegments returns strings, not objects; use primaryAudience or first segment
  const coreSegments = unwrap(graph.audience?.coreSegments) || [];
  const businessReality: BusinessReality = {
    stage: unwrap(graph.identity?.marketMaturity),
    businessModel: unwrap(graph.identity?.businessModel),
    primaryOffering: unwrap(graph.productOffer?.primaryProducts)?.[0] || null,
    primaryAudience: unwrap(graph.audience?.primaryAudience) || coreSegments[0] || unwrap(graph.identity?.icpDescription),
    icpDescription: unwrap(graph.identity?.icpDescription),
    goals: buildGoals(graph),
    valueProposition: unwrap(graph.brand?.positioning) || unwrap(graph.brand?.valueProps)?.[0] || null,
    industry: unwrap(graph.identity?.industry),
    geographicFootprint: unwrap(graph.identity?.geographicFootprint),
  };

  // Build constraints
  const constraints: Constraints = {
    minBudget: unwrap(graph.operationalConstraints?.minBudget),
    maxBudget: unwrap(graph.operationalConstraints?.maxBudget),
    budgetCapsFloors: (unwrap(graph.operationalConstraints?.budgetCapsFloors) || []).map(cap => ({
      type: cap.type,
      scope: cap.scope,
      amount: cap.amount,
      period: cap.period,
    })),
    launchDeadlines: unwrap(graph.operationalConstraints?.launchDeadlines) || [],
    channelRestrictions: (unwrap(graph.operationalConstraints?.channelRestrictions) || []).map(r => ({
      channelId: r.channelId,
      restrictionType: r.restrictionType,
      reason: r.reason,
    })),
    complianceRequirements: unwrap(graph.operationalConstraints?.complianceRequirements) || [],
    legalRestrictions: unwrap(graph.operationalConstraints?.legalRestrictions),
  };

  // Build competitive landscape
  const competitors = unwrap(graph.competitive?.competitors) || [];
  const competition: CompetitiveLandscape = {
    competitors: competitors.slice(0, 10).map((c: CompetitorProfile) => ({
      name: c.name,
      category: c.category,
      positioning: c.positioning,
      threatLevel: c.threatLevel,
    })),
    positioningAxisPrimary: unwrap(graph.competitive?.primaryAxis),
    positioningAxisSecondary: unwrap(graph.competitive?.secondaryAxis),
    positionSummary: unwrap(graph.competitive?.positionSummary),
    competitiveAdvantages: unwrap(graph.competitive?.competitiveAdvantages) || [],
    sourceVersion: competitionSource.version,
    sourceRunId: competitionSource.runId,
    sourceRunDate: competitionSource.runDate,
  };

  // Build execution capabilities from Hive Brain
  const serviceTaxonomy = buildServiceTaxonomy(hiveBrain.capabilities);
  const executionCapabilities: ExecutionCapabilities = {
    serviceTaxonomy,
    operatingPrinciples: osContext.doctrine.operatingPrinciples.map(p => p.name),
    doctrineVersion: osContext.version,
  };

  // Build metadata
  const sourcesUsed: string[] = [];
  if (graph) sourcesUsed.push('context_graph');
  if (competitionSource.sourceId) sourcesUsed.push(competitionSource.sourceId);
  if (hiveBrain) sourcesUsed.push('hive_brain');

  const meta: StrategyInputsMeta = {
    contextRevisionId: graph.meta?.lastSnapshotId || null,
    lastUpdatedAt: graph.meta?.updatedAt || null,
    sourcesUsed,
    completenessScore: graph.meta?.completenessScore || null,
  };

  return {
    businessReality,
    constraints,
    competition,
    executionCapabilities,
    meta,
  };
}

/**
 * Get Strategy Inputs with full provenance (for details drawer)
 */
export async function getStrategyInputsWithProvenance(
  companyId: string
): Promise<StrategyInputsWithProvenance> {
  const [graph, hiveBrain, osContext] = await Promise.all([
    loadContextGraph(companyId),
    getHiveGlobalContextGraph(),
    Promise.resolve(getOSGlobalContext()),
  ]);

  if (!graph) {
    return createEmptyStrategyInputsWithProvenance();
  }

  // Get competition source
  const { v4Runs, v3Runs } = await getCompetitionRuns(graph);
  const competitionSource = selectCompetitionSource(v4Runs, v3Runs);

  // Build business reality with provenance
  const coreSegmentsProv = unwrap(graph.audience?.coreSegments) || [];
  const businessReality: BusinessRealityWithProvenance = {
    stage: unwrap(graph.identity?.marketMaturity),
    businessModel: unwrap(graph.identity?.businessModel),
    primaryOffering: unwrap(graph.productOffer?.primaryProducts)?.[0] || null,
    primaryAudience: unwrap(graph.audience?.primaryAudience) || coreSegmentsProv[0] || unwrap(graph.identity?.icpDescription),
    icpDescription: unwrap(graph.identity?.icpDescription),
    goals: buildGoals(graph),
    valueProposition: unwrap(graph.brand?.positioning) || unwrap(graph.brand?.valueProps)?.[0] || null,
    industry: unwrap(graph.identity?.industry),
    geographicFootprint: unwrap(graph.identity?.geographicFootprint),
    provenance: {
      stage: getProvenance(graph.identity?.marketMaturity, 'identity.marketMaturity'),
      businessModel: getProvenance(graph.identity?.businessModel, 'identity.businessModel'),
      primaryOffering: getProvenance(graph.productOffer?.primaryProducts, 'productOffer.primaryProducts'),
      primaryAudience: getProvenance(graph.identity?.icpDescription, 'identity.icpDescription'),
      icpDescription: getProvenance(graph.identity?.icpDescription, 'identity.icpDescription'),
      goals: getProvenance(graph.objectives?.primaryObjective, 'objectives.primaryObjective'),
      valueProposition: getProvenance(graph.brand?.positioning, 'brand.positioning'),
      industry: getProvenance(graph.identity?.industry, 'identity.industry'),
      geographicFootprint: getProvenance(graph.identity?.geographicFootprint, 'identity.geographicFootprint'),
    },
  };

  // Build constraints with provenance
  const constraints: ConstraintsWithProvenance = {
    minBudget: unwrap(graph.operationalConstraints?.minBudget),
    maxBudget: unwrap(graph.operationalConstraints?.maxBudget),
    budgetCapsFloors: (unwrap(graph.operationalConstraints?.budgetCapsFloors) || []).map(cap => ({
      type: cap.type,
      scope: cap.scope,
      amount: cap.amount,
      period: cap.period,
    })),
    launchDeadlines: unwrap(graph.operationalConstraints?.launchDeadlines) || [],
    channelRestrictions: (unwrap(graph.operationalConstraints?.channelRestrictions) || []).map(r => ({
      channelId: r.channelId,
      restrictionType: r.restrictionType,
      reason: r.reason,
    })),
    complianceRequirements: unwrap(graph.operationalConstraints?.complianceRequirements) || [],
    legalRestrictions: unwrap(graph.operationalConstraints?.legalRestrictions),
    provenance: {
      minBudget: getProvenance(graph.operationalConstraints?.minBudget, 'operationalConstraints.minBudget'),
      maxBudget: getProvenance(graph.operationalConstraints?.maxBudget, 'operationalConstraints.maxBudget'),
      budgetCapsFloors: getProvenance(graph.operationalConstraints?.budgetCapsFloors, 'operationalConstraints.budgetCapsFloors'),
      launchDeadlines: getProvenance(graph.operationalConstraints?.launchDeadlines, 'operationalConstraints.launchDeadlines'),
      channelRestrictions: getProvenance(graph.operationalConstraints?.channelRestrictions, 'operationalConstraints.channelRestrictions'),
      complianceRequirements: getProvenance(graph.operationalConstraints?.complianceRequirements, 'operationalConstraints.complianceRequirements'),
      legalRestrictions: getProvenance(graph.operationalConstraints?.legalRestrictions, 'operationalConstraints.legalRestrictions'),
    },
  };

  // Competition (same as before)
  const competitors = unwrap(graph.competitive?.competitors) || [];
  const competition: CompetitiveLandscape = {
    competitors: competitors.slice(0, 10).map((c: CompetitorProfile) => ({
      name: c.name,
      category: c.category,
      positioning: c.positioning,
      threatLevel: c.threatLevel,
    })),
    positioningAxisPrimary: unwrap(graph.competitive?.primaryAxis),
    positioningAxisSecondary: unwrap(graph.competitive?.secondaryAxis),
    positionSummary: unwrap(graph.competitive?.positionSummary),
    competitiveAdvantages: unwrap(graph.competitive?.competitiveAdvantages) || [],
    sourceVersion: competitionSource.version,
    sourceRunId: competitionSource.runId,
    sourceRunDate: competitionSource.runDate,
  };

  // Execution capabilities
  const serviceTaxonomy = buildServiceTaxonomy(hiveBrain.capabilities);
  const executionCapabilities: ExecutionCapabilities = {
    serviceTaxonomy,
    operatingPrinciples: osContext.doctrine.operatingPrinciples.map(p => p.name),
    doctrineVersion: osContext.version,
  };

  // Metadata
  const sourcesUsed: string[] = [];
  if (graph) sourcesUsed.push('context_graph');
  if (competitionSource.sourceId) sourcesUsed.push(competitionSource.sourceId);
  if (hiveBrain) sourcesUsed.push('hive_brain');

  const meta: StrategyInputsMeta = {
    contextRevisionId: graph.meta?.lastSnapshotId || null,
    lastUpdatedAt: graph.meta?.updatedAt || null,
    sourcesUsed,
    completenessScore: graph.meta?.completenessScore || null,
  };

  return {
    businessReality,
    constraints,
    competition,
    executionCapabilities,
    meta,
  };
}

// ============================================================================
// Empty State Factories
// ============================================================================

function createEmptyStrategyInputs(): StrategyInputs {
  return {
    businessReality: {
      stage: null,
      businessModel: null,
      primaryOffering: null,
      primaryAudience: null,
      icpDescription: null,
      goals: [],
      valueProposition: null,
      industry: null,
      geographicFootprint: null,
    },
    constraints: {
      minBudget: null,
      maxBudget: null,
      budgetCapsFloors: [],
      launchDeadlines: [],
      channelRestrictions: [],
      complianceRequirements: [],
      legalRestrictions: null,
    },
    competition: {
      competitors: [],
      positioningAxisPrimary: null,
      positioningAxisSecondary: null,
      positionSummary: null,
      competitiveAdvantages: [],
      sourceVersion: 'none',
      sourceRunId: null,
      sourceRunDate: null,
    },
    executionCapabilities: {
      serviceTaxonomy: [],
      operatingPrinciples: [],
      doctrineVersion: '0.0.0',
    },
    meta: {
      contextRevisionId: null,
      lastUpdatedAt: null,
      sourcesUsed: [],
      completenessScore: null,
    },
  };
}

function createEmptyStrategyInputsWithProvenance(): StrategyInputsWithProvenance {
  return {
    businessReality: {
      stage: null,
      businessModel: null,
      primaryOffering: null,
      primaryAudience: null,
      icpDescription: null,
      goals: [],
      valueProposition: null,
      industry: null,
      geographicFootprint: null,
      provenance: {
        stage: null,
        businessModel: null,
        primaryOffering: null,
        primaryAudience: null,
        icpDescription: null,
        goals: null,
        valueProposition: null,
        industry: null,
        geographicFootprint: null,
      },
    },
    constraints: {
      minBudget: null,
      maxBudget: null,
      budgetCapsFloors: [],
      launchDeadlines: [],
      channelRestrictions: [],
      complianceRequirements: [],
      legalRestrictions: null,
      provenance: {
        minBudget: null,
        maxBudget: null,
        budgetCapsFloors: null,
        launchDeadlines: null,
        channelRestrictions: null,
        complianceRequirements: null,
        legalRestrictions: null,
      },
    },
    competition: {
      competitors: [],
      positioningAxisPrimary: null,
      positioningAxisSecondary: null,
      positionSummary: null,
      competitiveAdvantages: [],
      sourceVersion: 'none',
      sourceRunId: null,
      sourceRunDate: null,
    },
    executionCapabilities: {
      serviceTaxonomy: [],
      operatingPrinciples: [],
      doctrineVersion: '0.0.0',
    },
    meta: {
      contextRevisionId: null,
      lastUpdatedAt: null,
      sourcesUsed: [],
      completenessScore: null,
    },
  };
}
