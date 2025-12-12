// lib/competition-v4/index.ts
// Competition V4 - Classification Tree Approach
//
// Export main orchestrator and types

export { runCompetitionV4 } from './runCompetitionV4';

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
