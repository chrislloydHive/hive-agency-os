// lib/contextGraph/readiness/index.ts
// Readiness Checks for Context Graph

// ============================================================================
// Strategy-Ready Minimum (SRM)
// ============================================================================
export {
  type MissingSrmField,
  type StaleSrmField,
  type StrategyReadinessResult,
  type RegenRecommendation,
  type ContextSrmFieldName,
  type CompetitiveContextValidation,
  SRM_FIELDS,
  SRM_FIELD_LABELS,
  CONTEXT_SRM_FIELD_NAMES,
  isStrategyReady,
  getReadinessSummary,
  getSrmFieldsForDomain,
  isSrmField,
  getAllSrmFieldPaths,
  isContextSrmField,
  checkRegenRecommendation,
  validateCompetitiveContext,
  getCompetitiveBlockerMessage,
} from './strategyReady';

// ============================================================================
// Auto-Fill Readiness
// ============================================================================
export {
  type AutoFillReadiness,
  type ReadinessCheckResult,
  type ReadinessMissingItem,
  getAutoFillReadiness,
  checkAutoFillReadiness,
  getRecommendedNavigationPath,
} from './autoFill';
