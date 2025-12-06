// lib/competition/index.ts
// Competition Lab v2 - Main Export

export { runCompetitionLab } from './competitionOrchestrator';

export {
  createCompetitionRun,
  updateCompetitionRun,
  getCompetitionRun,
  getLatestCompetitionRun,
  listCompetitionRuns,
  updateRunStatus,
  addCompetitorsToRun,
  applyCompetitorFeedback,
  calculateDataConfidence,
} from './store';

export {
  type CompetitorRole,
  type PriceTier,
  type BrandScale,
  type DiscoverySource,
  type CompetitorProvenance,
  type EnrichedCompetitorData,
  type ScoredCompetitor,
  type CompetitionRunStatus,
  type CompetitionRun,
  type CompetitionRunResult,
  type CompetitionSummary,
  type CandidateCompetitor,
  type TargetCompanyContext,
  type CompetitorFeedbackAction,
  calculateOverallScore,
  classifyCompetitorRole,
  generateCompetitorId,
  generateRunId,
} from './types';
