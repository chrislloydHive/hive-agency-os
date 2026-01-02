// lib/os/contextReadiness/index.ts
// Context Readiness System Exports
//
// Provides a system-level "Context Readiness" layer that tells users:
// 1) Do we have enough trusted context to proceed?
// 2) If not, exactly what is missing?
// 3) What is the single next best action?

// Types
export type {
  ContextDomainKey,
  RequirementLevel,
  ReadinessStatus,
  RequiredForFeature,
  ReadinessCTAType,
  DomainCheck,
  DomainWarning,
  ReadinessCTA,
  DomainReadiness,
  ReadinessSummary,
  LabRunSummary,
  ReadinessInput,
  ContextGraphSnapshot,
  DomainConfig,
  FeatureRequirements,
} from './types';

// Rules and configuration
export {
  DOMAIN_CONFIGS,
  DOMAIN_DISPLAY_ORDER,
  FEATURE_REQUIREMENTS,
  MIN_QUALITY_SCORE_FOR_READY,
  MIN_COMPETITORS_FOR_READY,
  IDEAL_COMPETITORS_COUNT,
  getDomainLabSlug,
  getLabDomainKey,
  getRequirementLevel,
  generateDomainCTAs,
  // Domain check functions (for testing)
  checkAudienceDomain,
  checkCompetitiveLandscapeDomain,
  checkBrandDomain,
  checkWebsiteDomain,
  checkSeoDomain,
  checkMediaDomain,
  checkCreativeDomain,
} from './rules';

// Computation
export {
  computeReadiness,
  computeDomainReadiness,
  computeOverallScore,
} from './compute';

// Data loading
export {
  loadCompanyReadiness,
  loadCompanyReadinessCached,
  loadReadinessInputs,
  invalidateReadinessCache,
} from './loadCompanyReadiness';

// Messaging
export {
  getOverallStatusMessage,
  getStatusBadgeLabel,
  getStatusBadgeColor,
  getDomainStatusMessage,
  getDomainWhyMessage,
  getNextActionMessage,
  getEmptyStateMessage,
  formatMissingDomainsMessage,
  getProgressMessage,
  getCompactStatusLine,
} from './messages';
