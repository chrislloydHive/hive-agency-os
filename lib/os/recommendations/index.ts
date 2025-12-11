// lib/os/recommendations/index.ts
// Recommendations module exports

// Types
export * from './types';

// Engine functions
export {
  generateRecommendations,
  getNextBestActions,
  getQuickWins,
  updateActionStatus,
  getRoadmapStats,
} from './recommendationEngine';

// Plan integration
export {
  synthesizePlan,
  actionToWorkItem,
  getTopRecommendation,
  serializePlanSynthesis,
  generatePlanSummaryText,
  type PlanSynthesisResult,
} from './planIntegration';
