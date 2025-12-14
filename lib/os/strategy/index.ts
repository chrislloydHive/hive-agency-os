// lib/os/strategy/index.ts
// Strategy module exports
//
// Re-exports from the main strategy module and artifacts module

// Main strategy operations (from parent)
export {
  getActiveStrategy,
  getStrategyById,
  getStrategiesForCompany,
  getStrategySummary,
  createDraftStrategy,
  updateStrategy,
  finalizeStrategy,
  archiveStrategy,
  addPillarToStrategy,
  updatePillarInStrategy,
  removePillarFromStrategy,
} from '../strategy';

// Artifact operations
export {
  getArtifactsForCompany,
  getArtifactById,
  getArtifactsByStatus,
  getArtifactSummaries,
  getCandidateArtifacts,
  getLinkedArtifacts,
  createArtifact,
  updateArtifact,
  markAsCandidate,
  discardArtifact,
  promoteArtifact,
  deleteArtifact,
} from './artifacts';

// Promotion operations
export {
  promoteArtifactAsStrategy,
  promoteArtifactAsPillar,
  promoteMultipleArtifacts,
} from './promotion';

export type {
  PromoteAsStrategyRequest,
  PromoteAsPillarRequest,
  PromotionResult,
} from './promotion';

// Guardrails
export {
  StrategyGuardrailError,
  isCanonicalStrategy,
  canDirectlyEditStrategy,
  assertCanEditStrategy,
  canEditArtifact,
  canPromoteArtifact,
  assertCanEditArtifact,
  assertCanPromoteArtifact,
  validatePromotion,
  shouldCreateNewDraftOnRegenerate,
  getRegenerationAction,
} from './guardrails';

export type { StrategyGuardrailCode } from './guardrails';

// Types
export type {
  StrategyArtifact,
  StrategyArtifactType,
  StrategyArtifactStatus,
  StrategyArtifactSource,
  CreateArtifactRequest,
  UpdateArtifactRequest,
  PromoteArtifactRequest,
  ArtifactSummary,
} from '@/lib/types/strategyArtifact';

export {
  toArtifactSummary,
  ARTIFACT_TYPE_LABELS,
  ARTIFACT_STATUS_LABELS,
  ARTIFACT_SOURCE_LABELS,
} from '@/lib/types/strategyArtifact';

// Strategy ↔ Context Bindings
export {
  STRATEGY_CONTEXT_BINDINGS,
  BINDINGS_BY_STRATEGY_ID,
  BINDINGS_BY_CONTEXT_KEY,
  BINDINGS_BY_SECTION,
  getBindingByStrategyId,
  getBindingByContextKey,
  getBindingsForSection,
  getRequiredBindings,
  getAIProposableBindings,
  getAllContextKeys,
  getRequiredContextKeys,
  computeBindingReadiness,
  getRecommendedNextBinding,
} from './strategyContextBindings';

export type {
  StrategyContextBinding,
  BindingValueType,
  ResolvedBinding,
  BindingReadinessResult,
} from './strategyContextBindings';
