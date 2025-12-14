// lib/os/strategy/strategyViewModel.ts
// Strategy View Model Adapter
//
// Converts stored strategy JSON into a unified UI-friendly view model.
// Supports both V1 (legacy) and V2/V4 (choice-driven) strategies.
//
// Rules:
// - If strategy is V2 → map directly to view model
// - If strategy is V1 → map into V2-like view model with fallbacks
//   - pillar.decision = pillar.description (fallback)
//   - strategicChoices fields empty / marked as needsReview
//   - competitive rationale/tradeoff empty

import type { CompanyStrategy, StrategyPillar } from '@/lib/types/strategy';
import type {
  CompanyStrategyV2,
  StrategyPillarV2,
  StrategicChoices,
  SuccessDefinition,
  StrategyConfidenceNotes,
} from '@/lib/types/strategyV2';

// ============================================================================
// Strategy View Model Types
// ============================================================================

/**
 * Unified pillar view model for the UI
 */
export interface StrategyPillarViewModel {
  id: string;
  pillarName: string;
  decision: string;
  targetAudience: string;
  competitiveRationale: string;
  explicitTradeoff: string;
  priority: 'High' | 'Medium' | 'Low';
  order?: number;
  /** True if this field needs review (migrated from V1 or incomplete) */
  needsReview: boolean;
  /** Services from V1 (for backwards compat display) */
  services?: string[];
  /** KPIs from V1 (for backwards compat display) */
  kpis?: string[];
}

/**
 * Unified strategy view model for the UI
 */
export interface StrategyViewModel {
  id: string;
  companyId: string;

  // Strategy identity
  strategyTitle: string;
  strategySummary: string;

  // Strategic choices (V2/V4)
  strategicChoices: StrategicChoices;
  hasStrategicChoices: boolean;

  // Strategic pillars
  strategyPillars: StrategyPillarViewModel[];

  // Success definition (V2/V4)
  successDefinition: SuccessDefinition;
  hasSuccessDefinition: boolean;

  // Confidence tracking
  confidenceNotes: StrategyConfidenceNotes;
  hasNeedsReview: boolean;

  // Status & lifecycle
  status: 'draft' | 'finalized' | 'archived';
  version: number;

  // Timeline
  startDate?: string;
  endDate?: string;
  quarterLabel?: string;

  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  finalizedAt?: string;
  finalizedBy?: string;

  // Version info
  isV2: boolean;
  migratedFromV1: boolean;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a strategy is V2 format
 */
export function isStrategyV2(strategy: CompanyStrategy | CompanyStrategyV2): strategy is CompanyStrategyV2 {
  return 'isV2' in strategy && strategy.isV2 === true;
}

// ============================================================================
// View Model Conversion
// ============================================================================

/**
 * Convert V1 strategy pillar to view model
 */
function pillarV1ToViewModel(pillar: StrategyPillar): StrategyPillarViewModel {
  return {
    id: pillar.id,
    pillarName: pillar.title,
    decision: pillar.description || `Focus on ${pillar.title}`,
    targetAudience: '',
    competitiveRationale: '',
    explicitTradeoff: '',
    priority: mapV1Priority(pillar.priority),
    order: pillar.order,
    needsReview: true,
    services: pillar.services,
    kpis: pillar.kpis,
  };
}

/**
 * Convert V2 strategy pillar to view model
 */
function pillarV2ToViewModel(pillar: StrategyPillarV2): StrategyPillarViewModel {
  const needsReview =
    !pillar.decision ||
    pillar.decision === 'Needs definition' ||
    !pillar.targetAudience ||
    pillar.targetAudience === 'Needs definition' ||
    !pillar.competitiveRationale ||
    pillar.competitiveRationale === 'Needs definition' ||
    !pillar.explicitTradeoff ||
    pillar.explicitTradeoff === 'Needs definition';

  return {
    id: pillar.id,
    pillarName: pillar.pillarName,
    decision: pillar.decision,
    targetAudience: pillar.targetAudience,
    competitiveRationale: pillar.competitiveRationale,
    explicitTradeoff: pillar.explicitTradeoff,
    priority: pillar.priority,
    order: pillar.order,
    needsReview,
  };
}

/**
 * Map V1 priority to view model priority
 */
function mapV1Priority(priority: 'low' | 'medium' | 'high'): 'High' | 'Medium' | 'Low' {
  switch (priority) {
    case 'high':
      return 'High';
    case 'medium':
      return 'Medium';
    case 'low':
      return 'Low';
    default:
      return 'Medium';
  }
}

/**
 * Convert V1 strategy to view model
 */
export function strategyV1ToViewModel(strategy: CompanyStrategy): StrategyViewModel {
  const pillars = strategy.pillars.map(pillarV1ToViewModel);

  // Infer strategic choices from V1 data (will be incomplete)
  const strategicChoices: StrategicChoices = {
    whoWeWinWith: strategy.objectives?.[0] || '',
    whereWeFocus: pillars[0]?.pillarName || '',
    howWeDifferentiate: '',
    whatWeDeprioritize: '',
  };

  const hasStrategicChoices =
    !!strategicChoices.whoWeWinWith ||
    !!strategicChoices.whereWeFocus ||
    !!strategicChoices.howWeDifferentiate ||
    !!strategicChoices.whatWeDeprioritize;

  const successDefinition: SuccessDefinition = {
    primaryMetric: '',
    supportingMetrics: [],
  };

  const confidenceNotes: StrategyConfidenceNotes = {
    highConfidence: [],
    needsReview: [
      'Strategic choices need definition',
      'Pillar competitive rationale missing',
      'Pillar tradeoffs missing',
      'Success metrics need definition',
    ],
  };

  return {
    id: strategy.id,
    companyId: strategy.companyId,
    strategyTitle: strategy.title,
    strategySummary: strategy.summary,
    strategicChoices,
    hasStrategicChoices,
    strategyPillars: pillars,
    successDefinition,
    hasSuccessDefinition: false,
    confidenceNotes,
    hasNeedsReview: true,
    status: strategy.status,
    version: strategy.version || 1,
    startDate: strategy.startDate,
    endDate: strategy.endDate,
    quarterLabel: strategy.quarterLabel,
    createdAt: strategy.createdAt,
    updatedAt: strategy.updatedAt,
    createdBy: strategy.createdBy,
    finalizedAt: strategy.finalizedAt,
    finalizedBy: strategy.finalizedBy,
    isV2: false,
    migratedFromV1: false,
  };
}

/**
 * Convert V2 strategy to view model
 */
export function strategyV2ToViewModel(strategy: CompanyStrategyV2): StrategyViewModel {
  const pillars = strategy.strategyPillars.map(pillarV2ToViewModel);

  const { strategicChoices, successDefinition, confidenceNotes } = strategy;

  const hasStrategicChoices =
    (!!strategicChoices.whoWeWinWith && strategicChoices.whoWeWinWith !== 'Needs definition') ||
    (!!strategicChoices.whereWeFocus && strategicChoices.whereWeFocus !== 'Needs definition') ||
    (!!strategicChoices.howWeDifferentiate && strategicChoices.howWeDifferentiate !== 'Needs definition') ||
    (!!strategicChoices.whatWeDeprioritize && strategicChoices.whatWeDeprioritize !== 'Needs definition');

  const hasSuccessDefinition =
    !!successDefinition.primaryMetric && successDefinition.primaryMetric !== 'Needs definition';

  const hasNeedsReview = confidenceNotes.needsReview.length > 0;

  return {
    id: strategy.id,
    companyId: strategy.companyId,
    strategyTitle: strategy.strategyTitle,
    strategySummary: strategy.strategySummary,
    strategicChoices,
    hasStrategicChoices,
    strategyPillars: pillars,
    successDefinition,
    hasSuccessDefinition,
    confidenceNotes,
    hasNeedsReview,
    status: strategy.status,
    version: strategy.version,
    startDate: strategy.startDate,
    endDate: strategy.endDate,
    quarterLabel: strategy.quarterLabel,
    createdAt: strategy.createdAt,
    updatedAt: strategy.updatedAt,
    createdBy: strategy.createdBy,
    finalizedAt: strategy.finalizedAt,
    finalizedBy: strategy.finalizedBy,
    isV2: true,
    migratedFromV1: strategy.migratedFromV1 ?? false,
  };
}

/**
 * Convert any strategy (V1 or V2) to a unified view model
 */
export function toStrategyViewModel(
  strategy: CompanyStrategy | CompanyStrategyV2
): StrategyViewModel {
  if (isStrategyV2(strategy)) {
    return strategyV2ToViewModel(strategy);
  }
  return strategyV1ToViewModel(strategy);
}

// ============================================================================
// View Model to Strategy Conversion (for saves)
// ============================================================================

/**
 * Convert view model back to V2 strategy (for saving)
 */
export function viewModelToStrategyV2(viewModel: StrategyViewModel): CompanyStrategyV2 {
  const pillars: StrategyPillarV2[] = viewModel.strategyPillars.map(p => ({
    id: p.id,
    pillarName: p.pillarName,
    decision: p.decision,
    targetAudience: p.targetAudience,
    competitiveRationale: p.competitiveRationale,
    explicitTradeoff: p.explicitTradeoff,
    priority: p.priority,
    order: p.order,
  }));

  return {
    id: viewModel.id,
    companyId: viewModel.companyId,
    strategyTitle: viewModel.strategyTitle,
    strategySummary: viewModel.strategySummary,
    strategicChoices: viewModel.strategicChoices,
    strategyPillars: pillars,
    successDefinition: viewModel.successDefinition,
    confidenceNotes: viewModel.confidenceNotes,
    status: viewModel.status,
    version: viewModel.version,
    startDate: viewModel.startDate,
    endDate: viewModel.endDate,
    quarterLabel: viewModel.quarterLabel,
    createdAt: viewModel.createdAt,
    updatedAt: viewModel.updatedAt,
    createdBy: viewModel.createdBy,
    finalizedAt: viewModel.finalizedAt,
    finalizedBy: viewModel.finalizedBy,
    isV2: true,
    migratedFromV1: viewModel.migratedFromV1,
  };
}

// ============================================================================
// Empty View Model Factory
// ============================================================================

/**
 * Create an empty strategy view model
 */
export function createEmptyStrategyViewModel(companyId: string): StrategyViewModel {
  const now = new Date().toISOString();

  return {
    id: '',
    companyId,
    strategyTitle: '',
    strategySummary: '',
    strategicChoices: {
      whoWeWinWith: '',
      whereWeFocus: '',
      howWeDifferentiate: '',
      whatWeDeprioritize: '',
    },
    hasStrategicChoices: false,
    strategyPillars: [],
    successDefinition: {
      primaryMetric: '',
      supportingMetrics: [],
    },
    hasSuccessDefinition: false,
    confidenceNotes: {
      highConfidence: [],
      needsReview: [],
    },
    hasNeedsReview: false,
    status: 'draft',
    version: 1,
    createdAt: now,
    updatedAt: now,
    isV2: true,
    migratedFromV1: false,
  };
}
