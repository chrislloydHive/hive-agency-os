// lib/os/writeContract/index.ts
// Write Contract - Main Entry Point
//
// This module provides a system-wide enforcement model that guarantees:
// 1. User-confirmed fields are immutable by AI
// 2. Regeneration is non-destructive by default
// 3. AI can only propose changes, never silently apply them
// 4. Conflicts are surfaced clearly in both API and UI
//
// Primary exports:
// - computeProposalForAI: Generate a proposal from AI output
// - applyUserAcceptedProposal: Apply a user-accepted proposal

import type {
  Proposal,
  ApplyResult,
  ComputeProposalInput,
  ApplyProposalInput,
  LockEvaluationMeta,
  JsonPointer,
  WriteContractViolation,
  ViolationConflict,
} from './types';
import { buildProposal, isProposalValid } from './proposal';
import { applyProposal, previewProposal } from './apply';
import { validateProposalRevision, isRevisionCurrent } from './revision';
import { buildLockMeta } from './locks';
import type { FieldProvenance } from './types';

// Re-export types
export * from './types';

// Re-export utilities
export { buildLockMeta, extractContextLocks, extractStrategyLocks, extractCompetitionLocks } from './locks';
export { computeDiff, deepEqual, deepClone, groupOperationsBySection, describeOperation } from './diff';
export { buildProposal, isProposalValid, hasConflicts, getApplicablePaths, getConflictPaths, filterProposalPaths } from './proposal';
export { applyProposal, applyPatch, previewProposal, getProposedValue } from './apply';
export { generateRevisionId, validateRevision, validateProposalRevision, isRevisionCurrent, isRevisionStale, createInitialRevision, createUpdatedRevision } from './revision';

// ============================================================================
// Main API
// ============================================================================

/**
 * Compute a proposal from AI-generated output
 *
 * This is the ONLY way AI should modify protected entities.
 * The resulting proposal separates applicable changes from conflicts,
 * allowing users to review and selectively apply changes.
 *
 * @example
 * ```ts
 * const result = computeProposalForAI({
 *   base: currentContext,
 *   candidate: aiGeneratedContext,
 *   meta: buildLockMeta('context', currentContext),
 *   baseRevisionId: currentContext.revisionId,
 *   createdBy: 'ai:context-regen',
 *   companyId: company.id,
 *   entityId: currentContext.id,
 * });
 *
 * // result.proposal contains:
 * // - patch: operations that CAN be applied
 * // - conflicts: operations that conflict with locked fields
 * // - summary: breakdown by section
 * ```
 */
export function computeProposalForAI(input: ComputeProposalInput): {
  proposal: Proposal;
  hasConflicts: boolean;
  applicableCount: number;
  conflictCount: number;
} {
  const proposal = buildProposal(
    input.base,
    input.candidate,
    input.meta,
    {
      companyId: input.companyId,
      entityId: input.entityId,
      baseRevisionId: input.baseRevisionId,
      createdBy: input.createdBy,
    }
  );

  return {
    proposal,
    hasConflicts: proposal.conflicts.length > 0,
    applicableCount: proposal.patch.length,
    conflictCount: proposal.conflicts.length,
  };
}

/**
 * Apply a user-accepted proposal to the canonical state
 *
 * This validates:
 * 1. The proposal is still valid (not expired, not superseded)
 * 2. The base revision matches (optimistic concurrency)
 * 3. Selected paths don't conflict with locks
 *
 * @example
 * ```ts
 * const result = await applyUserAcceptedProposal({
 *   base: currentContext,
 *   proposal: proposal,
 *   selectedPaths: ['/companyReality/category/value'], // optional
 *   currentRevisionId: currentContext.revisionId,
 *   appliedBy: userId,
 * });
 *
 * if (result.success) {
 *   // result.updatedState contains the new state
 *   // result.newRevisionId is the new revision
 * }
 * ```
 */
export function applyUserAcceptedProposal(input: ApplyProposalInput): ApplyResult {
  // 1. Validate proposal is still pending
  if (!isProposalValid(input.proposal)) {
    return {
      success: false,
      applied: [],
      skipped: [{
        path: '/',
        reason: 'validation_failed',
        message: `Proposal is no longer valid (status: ${input.proposal.status})`,
      }],
      newRevisionId: input.currentRevisionId,
    };
  }

  // 2. Validate revision (optimistic concurrency)
  const revisionCheck = validateProposalRevision(input.proposal, input.currentRevisionId);
  if (!revisionCheck.valid) {
    return {
      success: false,
      applied: [],
      skipped: [{
        path: '/',
        reason: 'validation_failed',
        message: revisionCheck.error?.message || 'Revision check failed',
      }],
      newRevisionId: input.currentRevisionId,
    };
  }

  // 3. Apply the proposal
  return applyProposal(input.base, input.proposal, {
    selectedPaths: input.selectedPaths,
    trustProposal: true, // We trust the proposal's conflict detection
  });
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Quick check if an entity has any locked fields
 */
export function hasLockedFields(
  entityType: LockEvaluationMeta['entityType'],
  entity: Record<string, unknown>,
  provenance?: Record<string, FieldProvenance>
): boolean {
  const meta = buildLockMeta(entityType, entity, provenance);
  return meta.lockedPaths.size > 0;
}

/**
 * Get all locked paths for an entity
 */
export function getLockedPaths(
  entityType: LockEvaluationMeta['entityType'],
  entity: Record<string, unknown>,
  provenance?: Record<string, FieldProvenance>
): JsonPointer[] {
  const meta = buildLockMeta(entityType, entity, provenance);
  return Array.from(meta.lockedPaths.keys());
}

/**
 * Preview what a proposal would look like when applied
 * Does not modify any state - for UI preview only
 */
export function previewProposalApplication(
  base: unknown,
  proposal: Proposal,
  selectedPaths?: JsonPointer[]
): unknown {
  return previewProposal(base, proposal, selectedPaths);
}

/**
 * Create a WriteContractViolation error
 * Useful for API endpoints that need to reject direct AI writes
 */
export function createViolationError(
  type: 'LOCKED_FIELD' | 'STALE_REVISION' | 'SCHEMA' | 'INVALID_OPERATION',
  conflicts: ViolationConflict[],
  options?: {
    baseRevisionId?: string;
    currentRevisionId?: string;
  }
): WriteContractViolation {
  return new (class extends Error {
    readonly type = type;
    readonly conflicts = conflicts;
    readonly baseRevisionId = options?.baseRevisionId;
    readonly currentRevisionId = options?.currentRevisionId;

    constructor() {
      const message = `Write contract violation: ${type}. ${conflicts.length} conflict(s).`;
      super(message);
      this.name = 'WriteContractViolation';
    }

    toJSON() {
      return {
        type: this.type,
        conflicts: this.conflicts,
        baseRevisionId: this.baseRevisionId,
        currentRevisionId: this.currentRevisionId,
      };
    }
  })();
}

// ============================================================================
// API Response Helpers
// ============================================================================

/**
 * Format a proposal for API response
 */
export function formatProposalForResponse(proposal: Proposal): {
  id: string;
  status: Proposal['status'];
  summary: Proposal['summary'];
  hasConflicts: boolean;
  expiresAt: string;
  createdAt: string;
  createdBy: string;
  patch: Proposal['patch'];
  conflicts: Proposal['conflicts'];
} {
  return {
    id: proposal.id,
    status: proposal.status,
    summary: proposal.summary,
    hasConflicts: proposal.conflicts.length > 0,
    expiresAt: proposal.expiresAt,
    createdAt: proposal.createdAt,
    createdBy: proposal.createdBy,
    patch: proposal.patch,
    conflicts: proposal.conflicts,
  };
}

/**
 * Format an apply result for API response
 */
export function formatApplyResultForResponse(result: ApplyResult): {
  success: boolean;
  applied: string[];
  skipped: ApplyResult['skipped'];
  newRevisionId: string;
} {
  return {
    success: result.success,
    applied: result.applied,
    skipped: result.skipped,
    newRevisionId: result.newRevisionId,
  };
}
