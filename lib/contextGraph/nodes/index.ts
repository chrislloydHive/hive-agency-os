// lib/contextGraph/nodes/index.ts
// AI-First Context Node System
//
// Exports for the ContextNode abstraction layer that enables:
// - AI proposes, human confirms
// - Protected confirmed values
// - Inline proposal rendering

// Types
export type {
  ContextNode,
  ContextNodeStatus,
  ContextNodeSource,
  ContextProposal,
  ContextProposalBatch,
} from './types';

export {
  ContextNodeStatus as ContextNodeStatusEnum,
  ContextNodeSource as ContextNodeSourceEnum,
  mapContextSourceToNodeSource,
  isNodeProtected,
  isGhostNode,
  createGhostNode,
  canReceiveAIProposal,
  createProposal,
} from './types';

// Proposal Storage
export {
  loadPendingProposals,
  loadProposalBatch,
  loadAllProposals,
  saveProposalBatch,
  acceptProposal,
  rejectProposal,
  editAndAcceptProposal,
  acceptAllProposals,
  rejectAllProposals,
  createProposalBatch,
  getPendingProposalsForField,
} from './proposalStorage';

export type { ProposalRecord } from './proposalStorage';

// Hydration
export type {
  HydratedContextNode,
  HydratedContextMap,
} from './hydration';

export {
  CONTEXT_FIELD_LABELS,
  getFieldLabel,
  hydrateFieldToNode,
  hydrateContextGraph,
  getHydratedDomain,
  getHydratedNode,
  getProposalSummary,
  getFieldsWithPendingProposals,
} from './hydration';

// Apply Proposals
export {
  applyProposalToContextGraph,
  applyMultipleProposals,
} from './applyProposal';

// Protection Logic
export {
  isFieldConfirmed,
  getFieldStatus,
  hasFieldValue,
  canAIPropose,
  getConfirmedFieldPaths,
  getProtectionSummary,
  filterProposalsForProtection,
  getFieldFromPath,
  markFieldAsConfirmed,
} from './protection';

// Strategy → Context Hard Gate
export type {
  StrategyContextProposal,
  StrategyProposalProvenance,
  ProposeFromStrategyResult,
} from './strategyProposals';

export {
  proposeContextFromStrategy,
  isValidRegistryKey,
  getStrategyInputKeys,
  assertNotContextKey,
  assertNoContextKeys,
  findContextKeysInObject,
} from './strategyProposals';
