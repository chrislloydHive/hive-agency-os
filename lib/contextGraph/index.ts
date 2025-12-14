// lib/contextGraph/index.ts
// Context Graph Main Export (Phase 2)

// ============================================================================
// Core Types
// ============================================================================
export {
  type ProvenanceTag,
  ContextSource,
  WithMeta,
  WithMetaArray,
  type WithMetaType,
  type WithMetaArrayType,
  emptyMeta,
  emptyMetaArray,
  createProvenance as createProvenanceTag, // Renamed to avoid conflict
  getHighestConfidence,
  getMostRecent,
  normalizeProvenance,
  normalizeProvenanceArray,
  DEFAULT_VALIDITY_DAYS,
} from './types';

// ============================================================================
// Enums
// ============================================================================
export * from './enums';

// ============================================================================
// Domains
// ============================================================================
export * from './domains';

// ============================================================================
// Root Schema
// ============================================================================
export * from './companyContextGraph';

// ============================================================================
// Storage
// ============================================================================
export * from './storage';

// ============================================================================
// Mutation Utilities
// ============================================================================
export {
  type ProvenanceSource,
  type SetFieldOptions,
  type SetFieldResult,
  type SetDomainFieldsResult,
  createProvenance,
  setField,
  setFieldUntyped,
  setFieldUntypedWithResult,
  mergeField,
  setDomainFields,
  setDomainFieldsWithResult,
  batchUpdate,
  getMostConfidentValue,
  hasValueFromSource,
  getLatestProvenance,
  clearField,
  markFusionComplete,
  updateFieldAndSave,
} from './mutate';

// ============================================================================
// Source Priority Configuration
// ============================================================================
export {
  type SourceId,
  type DomainPriorityConfig,
  type PriorityCheckResult,
  type FieldSourceSummary,
  HUMAN_SOURCES,
  DOMAIN_PRIORITY_CONFIG,
  SOURCE_DISPLAY_NAMES,
  isHumanSource,
  hasHumanOverride,
  getHumanOverride,
  getSourcePriorityForDomain,
  isSourceBlockedForDomain,
  canSourceOverwrite,
  getSourceDisplayName,
  getAuthoritativeSourcesForDomain,
  getFieldSourceSummary,
} from './sourcePriority';

// ============================================================================
// Section Summary & Service
// ============================================================================
export {
  type ContextGraphSectionSummary,
  type ContextGraphSummary,
  calculateSectionSummary,
  calculateGraphSummary,
  recalculateSectionFromPath,
  formatSummaryForLog,
} from './sectionSummary';

export {
  type ContextGraphRecordWithSummary,
  getOrCreateContextGraphRecord,
  recalculateContextGraphSummary,
  updateContextGraphForNode,
  getContextGraphSummary,
  getContextGraphSections,
  contextGraphExists,
  getQuickStats,
} from './contextGraphService';

// ============================================================================
// Fusion Pipeline
// ============================================================================
export * from './fusion';

// ============================================================================
// Prefill Utilities
// ============================================================================
export * from './prefill';

// ============================================================================
// Phase 2: History & Snapshots
// ============================================================================
export {
  SnapshotReason,
  ContextGraphSnapshot,
  type SnapshotSummary,
  saveContextGraphSnapshot,
  listContextGraphSnapshots,
  listSnapshotSummaries,
  getSnapshotById as getVersionSnapshotById, // Renamed to avoid conflict with snapshots.ts
  getLatestSnapshot,
  getSnapshotsByReason,
  pruneOldSnapshots,
  createSnapshot,
  captureSnapshot,
  type SnapshotDiff,
  compareSnapshots,
  getRecentChanges,
} from './history';

// ============================================================================
// Phase 2: Conflict Resolution
// ============================================================================
export {
  SOURCE_PRIORITY,
  getSourcePriority,
  type ConflictResolutionConfig,
  DEFAULT_CONFLICT_CONFIG,
  type ConflictResolutionResult,
  calculateProvenanceScore,
  resolveFieldConflict,
  resolveFromProvenance,
  mergeSourceValues,
  type ConflictInfo,
  detectConflict,
  resolveDomainsConflicts,
} from './conflicts';

// ============================================================================
// Phase 2: Freshness & Decay
// ============================================================================
export {
  type FreshnessScore,
  calculateFreshness,
  getFieldFreshness,
  type DomainFreshness,
  getDomainFreshness,
  type GraphFreshnessReport,
  getGraphFreshnessReport,
  isFresh,
  isStale,
  daysUntilStale,
  formatFreshness,
} from './freshness';

// ============================================================================
// Phase 2: Needs Refresh Detection
// ============================================================================
export {
  type RefreshPriority,
  type FieldRefreshFlag,
  type DomainRefreshFlag,
  type NeedsRefreshReport,
  type RefreshAction,
  getNeedsRefreshReport,
  needsRefresh,
  getCriticallyStaleFields,
  domainNeedsRefresh,
} from './needsRefresh';

// ============================================================================
// Phase 2: Schema Migration
// ============================================================================
export {
  CURRENT_SCHEMA_VERSION,
  MIN_SUPPORTED_VERSION,
  VERSION_HISTORY,
  type MigrationResult,
  getGraphVersion,
  needsMigration,
  isVersionSupported,
  migrateGraph,
  ensureCurrentVersion,
  type ValidationResult,
  validateGraph,
} from './migrate';

// ============================================================================
// Phase 2: Performance Deltas & Learning
// ============================================================================
export {
  type MetricDelta,
  type PerformanceDeltaReport,
  type LearningInsight,
  calculatePerformanceDeltas,
  calculateGraphDeltas,
  generateLearningInsights,
  type TrendDataPoint,
  extractMetricTrend,
  type TrendAnalysis,
  analyzeTrend,
} from './performanceDeltas';

// ============================================================================
// Phase 2: AI-Ready Context View
// ============================================================================
export {
  type AiContextView,
  type AiContextSection,
  buildAiContextView,
  getAiContextSection,
  getAiContextSections,
  type PromptFormatOptions,
  formatForPrompt,
  buildMediaPlanningContext,
  buildCreativeContext,
  buildStrategyContext,
  buildEnhancedStrategyContext,
  buildContextSummary,
  // Hive Brain Composition
  type HiveBrainOptions,
  buildContextWithHiveBrain,
  buildStrategyContextWithHiveBrain,
  buildCreativeContextWithHiveBrain,
  buildMediaPlanningContextWithHiveBrain,
  // Hive Capabilities Formatting
  formatCapabilitiesForPrompt,
} from './forAi';

// ============================================================================
// Domain Writers
// ============================================================================
export {
  WEBSITE_LAB_MAPPINGS,
  writeWebsiteLabToGraph,
  writeWebsiteLabAndSave,
  previewWebsiteLabMappings,
  type WebsiteLabWriterResult,
} from './websiteLabWriter';

export {
  writeMediaLabToGraph,
  writeMediaLabAndSave,
  type MediaLabWriterResult,
} from './mediaLabWriter';

export {
  writeAudienceLabToGraph,
  writeAudienceLabAndSave,
  type AudienceLabWriterResult,
} from './audienceLabWriter';

export {
  writeBrandLabToGraph,
  writeBrandLabAndSave,
  type BrandLabWriterResult,
} from './brandLabWriter';

// ============================================================================
// Context Gateway (Read API)
// ============================================================================
export {
  type ContextScopeId,
  SCOPE_LABELS,
  type ContextGatewayOptions,
  type ContextFieldStatus,
  type ContextGatewayField,
  type ContextGatewaySection,
  type ContextGatewayResult,
  type ContextUseCase,
  type ContextForPromptOptions,
  type ContextForPromptResult,
  getContextForScopes,
  getContextForPrompt,
  getAllContext,
  getMediaPlanningContext,
  getCreativeContext,
  getQbrContext,
  getSsmContext,
  hasContext,
  getContextHealthSummary,
} from './contextGateway';

// ============================================================================
// Named Snapshots
// ============================================================================
export {
  type SnapshotType,
  type SnapshotMeta,
  type FullSnapshot,
  type CreateSnapshotParams,
  type CreateSnapshotResult,
  createContextSnapshot,
  getSnapshotMetaForCompany,
  getSnapshotById,
  getSnapshotContext,
  createQbrSnapshot,
  createSsmSnapshot,
  createManualSnapshot,
  createLabSnapshot,
  getSnapshotsByType,
  getLatestSnapshotByType,
  snapshotExists,
} from './snapshots';

// ============================================================================
// Strategy-Ready Minimum (SRM)
// ============================================================================
export {
  type MissingSrmField,
  type StaleSrmField,
  type StrategyReadinessResult,
  type RegenRecommendation,
  type ContextSrmFieldName,
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
} from './readiness/strategyReady';

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
} from './readiness/autoFill';

// ============================================================================
// Hive Brain (Global Context Graph)
// ============================================================================
export {
  HIVE_GLOBAL_ID,
  HIVE_GLOBAL_NAME,
  HIVE_BRAIN_DOMAINS,
  HIVE_BRAIN_VALID_SOURCES,
  type HiveBrainDomain,
  type ValueSource,
  isValidHiveBrainSource,
  isHiveGlobalGraph,
  getHiveGlobalContextGraph,
  updateHiveGlobalContextGraph,
  hiveBrainExists,
  mergeWithHiveBrain,
  getValueSource,
} from './globalGraph';

// ============================================================================
// Domain Visibility
// ============================================================================
export {
  type DomainVisibility,
  DOMAIN_VISIBILITY,
  DOMAIN_LABELS,
  DOMAIN_DESCRIPTIONS,
  getDomainVisibility,
  isDomainVisible,
  getDomainsAtLevel,
  getCoreDomains,
  getAdvancedDomains,
  getHiddenDomains,
  getDomainLabel,
  getDomainDescription,
} from './visibility';
