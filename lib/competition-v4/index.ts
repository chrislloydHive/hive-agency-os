// lib/competition-v4/index.ts
// Competition V4 - Classification Tree Approach
//
// Export main orchestrator, store, types, and overlap scoring

export { runCompetitionV4 } from './runCompetitionV4';
export {
  saveCompetitionRunV4,
  updateCompetitionRunV4,
  getLatestCompetitionRunV4,
} from './store';

export type {
  CompetitionV4Input,
  CompetitionV4Result,
  BusinessDecompositionResult,
  CategoryDefinition,
  ProposedCompetitor,
  RemovedCompetitor,
  CompetitorValidationResult,
  CompetitiveSummary,
  CompetitionEngine,
  MarketOrientation,
  EconomicModel,
  OfferingType,
  TransactionModel,
  GeographicScope,
  CompetitorType,
  ScoredCompetitor,
  CustomerComparisonMode,
  CompetitiveModalityType,
} from './types';

export {
  getCompetitionEngine,
  shouldRunV3,
  shouldRunV4,
} from './types';

// Overlap scoring exports
export {
  calculateOverlapScore,
  getWeightsForModality,
  // Legacy exports (deprecated, use trait-based scoring)
  applyBestBuyRule,
  applyLocalInstallerRule,
} from './overlapScoring';

export type {
  LegacyOverlapScoringInput as OverlapScoringInput,
  SubjectProfile,
  OverlapWeights,
  CompetitorTraits,
  ScoringOptions,
  ScoringResult,
} from './overlapScoring';
