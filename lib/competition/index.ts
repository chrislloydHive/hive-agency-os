// lib/competition/index.ts
// Competition Lab v2 - Main Export

export { runCompetitionLab } from './competitionOrchestrator';
export { runCompetitionV2 } from './discoveryV2';

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
  type SimplePriceTier,
  type BrandScale,
  type DiscoverySource,
  type CompetitorProvenance,
  type EnrichedCompetitorData,
  type ScoredCompetitor,
  type CompetitionRunStatus,
  type CompetitionRunStepName,
  type CompetitionRunStepStatus,
  type CompetitionRunStep,
  type CompetitionRunStats,
  type CompetitionRunQuerySummary,
  type DiscoveredCandidate,
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
  createInitialSteps,
  startStep,
  completeStep,
  failStep,
  normalizeDomain,
  derivePriceTierFromText,
  resolvePriceTier,
  calculatePriceTierOverlap,
  computeRunStats,
} from './types';
