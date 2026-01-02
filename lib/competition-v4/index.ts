// lib/competition-v4/index.ts
// Competition V4 - Classification Tree Approach
//
// Export main orchestrator, store, and types

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
} from './types';

export {
  getCompetitionEngine,
  shouldRunV3,
  shouldRunV4,
} from './types';
