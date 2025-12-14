// lib/os/registry/index.ts
// Unified Context ↔ Strategy Registry
//
// This module provides:
// 1. Single source of truth for field definitions (contextStrategyRegistry)
// 2. Unified resolver for context values (contextResolver)
// 3. Readiness computation for Strategy and Programs

// Registry exports
export {
  // Types
  type FieldSource,
  type FieldStatus,
  type FieldValueType,
  type StrategySection,
  type RequiredForDomain,
  type ContextStrategyField,

  // Registry data
  DEFAULT_SOURCE_PRIORITY,
  CONTEXT_STRATEGY_REGISTRY,
  REGISTRY_BY_KEY,
  REGISTRY_BY_LEGACY_PATH,

  // Registry lookups
  getRegistryEntry,
  getRegistryEntryByLegacyPath,
  getFieldsForZone,
  getFieldsForStrategySection,
  getFieldsRequiredFor,
  getCriticalFields,
  getAIProposableFields,
  getMissingFieldsForDomain,

  // Strategy mapping
  getStrategyToContextMapping,
  getContextKeyForStrategyField,

  // Readiness helpers
  getTotalWeightForDomain,
  calculateWeightedReadiness,
} from './contextStrategyRegistry';

// Resolver exports
export {
  // Types
  type ResolutionStatus,
  type ResolvedValue,
  type BatchResolutionResult,
  type ReadinessResult,

  // Single value resolution
  resolveContextValue,

  // Batch resolution
  resolveContextValues,
  resolveStrategySection,

  // Readiness computation (SINGLE SOURCE OF TRUTH)
  computeReadiness,
  isStrategyReady,
  isWebsiteProgramReady,

  // Deep links
  getContextDeepLink,
  getFixLink,
} from './contextResolver';

// Event exports
export {
  // Types
  type ContextStrategyEventType,
  type ContextFieldUpdatedEvent,
  type ProposalAcceptedEvent,
  type ProposalRejectedEvent,
  type ProposalCreatedEvent,
  type StrategySectionInvalidatedEvent,
  type ReadinessChangedEvent,
  type ContextStrategyEvent,

  // Event bus
  contextStrategyEventBus,

  // Broadcast functions
  broadcastFieldUpdate,
  broadcastProposalAccepted,
  broadcastProposalRejected,
  broadcastProposalsCreated,
  invalidateStrategySection,
  broadcastReadinessChange,

  // Subscription helpers
  subscribeToReadinessChanges,
  subscribeToContextChanges,
  subscribeToStrategySectionInvalidation,
} from './events';
