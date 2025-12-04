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
  createProvenance,
  setField,
  mergeField,
  setDomainFields,
  batchUpdate,
  getMostConfidentValue,
  hasValueFromSource,
  getLatestProvenance,
  clearField,
  markFusionComplete,
  updateFieldAndSave,
} from './mutate';

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
  getSnapshotById,
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
  buildContextSummary,
} from './forAi';
