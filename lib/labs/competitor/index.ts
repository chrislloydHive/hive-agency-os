// lib/labs/competitor/index.ts
// Competitor Lab Module Exports

export {
  runCompetitorLabRefinement,
  type CompetitorLabInput,
  type CompetitorLabResult,
  type RefinedField,
  type LabDiagnostic,
  type ApplyResult,
  type ValidationStats,
} from './competitorLab';

// New expanded prompts
export {
  COMPETITOR_LAB_SYSTEM_PROMPT,
  generateCompetitorLabTaskPrompt,
  FEATURE_MATRIX_PROMPT,
  PRICING_ANALYSIS_PROMPT,
  MESSAGING_OVERLAP_PROMPT,
  CLUSTER_ANALYSIS_PROMPT,
  THREAT_MODELING_PROMPT,
  SUBSTITUTE_DETECTION_PROMPT,
  VALIDATION_PROMPT,
  type CompetitorLabTaskInput,
} from './prompts';

// Merge utilities
export {
  normalizeCompetitorName,
  normalizeDomain,
  stringSimilarity,
  areCompetitorsSimilar,
  mergeCompetitorRecord,
  dedupeCompetitors,
  mergeCompetitorLists,
  isValidCompetitorProfile,
  sanitizeCompetitorProfile,
  type MergeOperation,
  type DedupeResult,
  type MergeStats,
} from './mergeCompetitors';

// Legacy exports (deprecated, use prompts.ts instead)
export { COMPETITOR_LAB_SYSTEM_PROMPT as LEGACY_SYSTEM_PROMPT } from './competitorSystemPrompt';
export { COMPETITOR_LAB_TASK_PROMPT as LEGACY_TASK_PROMPT } from './competitorTaskPrompt';
