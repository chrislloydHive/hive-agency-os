// lib/os/context/index.ts
// Context module exports

// Types
export * from './types';

// Graph Model (canonical types and utilities)
export * from './graphModel';

// Integrity functions
export {
  calculateFreshnessScore,
  detectConflict,
  autoResolveConflict,
  checkMissingFields,
  calculateContextHealth,
  checkContextIntegrity,
  updateProvenance,
  lockField,
  unlockField,
  verifyField,
  getFieldsNeedingAttention,
} from './graphIntegrity';

// Brain integration
export {
  toHealthSummary,
  checkCompanyContextHealth,
  getDetailedIntegrityCheck,
  healthToDataSource,
  getQuickHealthIndicator,
  trackFieldUpdate,
  getFieldsByStatus,
  generateHealthReport,
  type ContextHealthSummary,
} from './brainIntegration';

// Context Overview Loader
export {
  loadContextOverview,
  type ContextOverview,
  type DomainStats,
} from './loadContextOverview';

// Coverage Graph Loader
export {
  loadCoverageGraph,
  type CoverageNode,
  type CoverageNodeStatus,
  type CoverageDomainSummary,
  type CoverageGraph,
} from './loadCoverageGraph';

// Relationship/Dependency Graph Loader
export {
  loadRelationshipGraph,
  getNodeConnections,
  getMissingDependencies,
  type RelationshipType,
  type RelationshipEdge,
  type RelationshipNode,
  type RelationshipGraph,
  type NodePosition,
} from './dependencies';

// Required Context Keys Registry
export {
  REQUIRED_CONTEXT_KEYS,
  REQUIRED_KEYS_BY_KEY,
  REQUIRED_KEYS_BY_ZONE,
  getRequiredKey,
  getRequiredKeysForZone,
  getRequiredKeysByPriority,
  getRequiredKeysForFeature,
  isRequiredKey,
  getCanonicalRequiredKey,
  getAllKeysForRequirement,
  type RequiredContextKey,
} from './requiredContextKeys';

// Context Coverage Auditor
export {
  auditContextCoverage,
  getBlockedByKeys,
  getBlockedBySummary,
  isStrategyReadyByAudit,
  type PresentField,
  type MissingField,
  type BlockedByField,
  type ContextCoverageAudit,
} from './auditContextCoverage';

// ============================================================================
// Canonical Context Schema (Strategy Frame Fields)
// ============================================================================

// Schema and types
export {
  type ContextDimension,
  type CanonicalFieldKey,
  type ContextFieldStatus,
  type ContextFieldSourceType,
  type LabFieldSource,
  type GapFieldSource,
  type UserFieldSource,
  type ContextFieldSource,
  type ContextFieldRecord,
  type ContextFieldCandidate,
  type CanonicalFieldDefinition,
  CANONICAL_FIELD_DEFINITIONS,
  getRequiredFieldsForStrategyFrame,
  getFieldDefinition,
  getFieldsByDimension,
  getFieldsPopulatedByLab,
  getFieldsPopulatedByGap,
  getContextGraphPath,
  ALL_CANONICAL_FIELD_KEYS,
  REQUIRED_STRATEGY_FRAME_KEYS,
} from './schema';

// Extractors
export {
  type ExtractionResult,
  extractFromBrandLab,
  extractFromAudienceLab,
  extractFromCompetitorLab,
  extractFromWebsiteLab,
  extractFromFullGap,
  extractCanonicalFields,
  mergeExtractionResults,
  toContextFindings,
  extractionResultToFindings,
} from './extractors';

// Persistence
export {
  type UpsertResult,
  type UpsertOptions,
  upsertContextFields,
  candidatesToRecords,
  readCanonicalFields,
} from './upsertContextFields';

// ============================================================================
// Canonical Context Pipeline (New)
// ============================================================================

// Canonicalizer (Labs/GAP → Context writes)
export {
  type CanonicalizationResult,
  type CanonicalizerOptions,
  canonicalizeFindings,
  initializeMissingFields,
  getMissingRequiredFieldsForCompany,
  getFieldsForGapToPropose,
} from './canonicalizer';

// Blocker Logic (Strategy/Programs blocking)
export {
  type MissingField as BlockerMissingField,
  type BlockerResult,
  type StrategyBlocker,
  type StrategyBlockersResult,
  checkWorkflowBlocker,
  checkWorkflowBlockerWithGraph,
  isStrategyBlocked,
  areProgramsBlocked,
  getMissingFieldsForUI,
  calculateCompleteness,
  // Unified strategy blockers (single source of truth)
  getStrategyBlockers,
  getStrategyBlockersForCompany,
} from './blocker';

// Competitor Guardrails
export {
  type CompetitorCandidate,
  type CompetitorValidationResult,
  type CompanyContext,
  validateCompetitors,
  validateSingleCompetitor,
  prepareCompetitorsForPersistence,
} from './competitorGuardrails';

// Schema extensions
export {
  type WorkflowType,
  GAP_ALLOWED_FIELDS,
  canGapProposeField,
} from './schema';

// ============================================================================
// Domain Authority (Canonical write permissions)
// ============================================================================

export {
  type DomainKey,
  type WriteSource,
  type DomainAuthorityConfig,
  DOMAIN_AUTHORITY,
  LAB_DOMAINS,
  FIELD_TO_DOMAIN,
  getDomainForField,
  isSourceAllowedForDomain,
  validateWrite,
  getCanonicalSourceForDomain,
  getLabDomains,
  canLabWriteToDomain,
} from './domainAuthority';

// ============================================================================
// Lab Coverage Check (Domain coverage verification)
// ============================================================================

export {
  type LabKey,
  type DomainCoverageResult,
  type LabCoverageReport,
  checkDomainCoverage,
  checkLabCoverage,
  getLabCTAs,
  checkFlowReadiness,
} from './labCoverageCheck';
