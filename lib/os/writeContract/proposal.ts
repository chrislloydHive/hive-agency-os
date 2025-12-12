// lib/os/writeContract/proposal.ts
// Proposal builder for the Write Contract system
//
// Builds Proposal objects from diff operations, separating
// applicable changes from conflicts with locked fields.

import { randomUUID } from 'crypto';
import type {
  Proposal,
  ProposalConflict,
  ProposalSummary,
  PatchOperation,
  LockEvaluationMeta,
} from './types';
import { computeDiff, groupOperationsBySection } from './diff';
import { isPathLocked } from './locks';

// ============================================================================
// Proposal ID Generation
// ============================================================================

/**
 * Generate a unique proposal ID
 */
export function generateProposalId(): string {
  return `prop_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

// ============================================================================
// Proposal Building
// ============================================================================

/**
 * Build a Proposal from base and candidate states
 *
 * @param base - Current canonical state
 * @param candidate - AI-generated candidate state
 * @param meta - Lock evaluation metadata
 * @param options - Additional options
 */
export function buildProposal(
  base: unknown,
  candidate: unknown,
  meta: LockEvaluationMeta,
  options: {
    companyId: string;
    entityId: string;
    baseRevisionId: string;
    createdBy: string;
    expiresInDays?: number;
  }
): Proposal {
  // 1. Compute the diff
  const allOperations = computeDiff(base, candidate);

  // 2. Separate operations into applicable and conflicts
  const applicableOperations: PatchOperation[] = [];
  const conflicts: ProposalConflict[] = [];

  for (const operation of allOperations) {
    const lockStatus = isPathLocked(operation.path, meta);

    if (lockStatus.locked) {
      // This operation conflicts with a locked field
      conflicts.push({
        path: operation.path,
        operation,
        lockStatus,
        message: buildConflictMessage(operation, lockStatus),
      });
    } else {
      // This operation can be applied
      applicableOperations.push(operation);
    }
  }

  // 3. Build summary
  const summary = buildSummary(applicableOperations, conflicts);

  // 4. Calculate expiration
  const expiresInDays = options.expiresInDays ?? 7;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  // 5. Build and return proposal
  return {
    id: generateProposalId(),
    companyId: options.companyId,
    entityType: meta.entityType,
    entityId: options.entityId,
    patch: applicableOperations,
    conflicts,
    summary,
    baseRevisionId: options.baseRevisionId,
    status: 'pending',
    createdAt: new Date().toISOString(),
    createdBy: options.createdBy,
    expiresAt: expiresAt.toISOString(),
  };
}

/**
 * Build a human-readable conflict message
 */
function buildConflictMessage(
  operation: PatchOperation,
  lockStatus: { reason?: string; confirmedValue?: unknown }
): string {
  const pathParts = operation.path.slice(1).split('/');
  const fieldName = pathParts[pathParts.length - 1];

  const reasonText = lockStatus.reason
    ? ` (${formatLockReason(lockStatus.reason)})`
    : '';

  switch (operation.op) {
    case 'replace':
      return `Cannot change "${fieldName}"${reasonText}. Current value: "${formatValue(lockStatus.confirmedValue)}"`;
    case 'remove':
      return `Cannot remove "${fieldName}"${reasonText}`;
    case 'add':
      return `Cannot add to locked path "${fieldName}"${reasonText}`;
    default:
      return `Cannot modify "${fieldName}"${reasonText}`;
  }
}

/**
 * Format a lock reason for display
 */
function formatLockReason(reason: string): string {
  switch (reason) {
    case 'user_confirmed':
      return 'confirmed by user';
    case 'user_set':
      return 'set by user';
    case 'manual_entry':
      return 'manually entered';
    case 'lab_confirmed':
      return 'lab result confirmed';
    case 'immutable':
      return 'system field';
    default:
      return reason;
  }
}

/**
 * Format a value for display in messages
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'empty';
  }
  if (typeof value === 'string') {
    if (value.length > 50) {
      return value.slice(0, 47) + '...';
    }
    return value;
  }
  if (typeof value === 'object') {
    return '[object]';
  }
  return String(value);
}

/**
 * Build a summary of the proposal
 */
function buildSummary(
  applicable: PatchOperation[],
  conflicts: ProposalConflict[]
): ProposalSummary {
  const sectionBreakdown: ProposalSummary['sectionBreakdown'] = {};

  // Count applicable operations by section
  const applicableBySection = groupOperationsBySection(applicable);
  for (const [section, ops] of applicableBySection) {
    sectionBreakdown[section] = {
      adds: ops.filter(op => op.op === 'add').length,
      removes: ops.filter(op => op.op === 'remove').length,
      replaces: ops.filter(op => op.op === 'replace').length,
      conflicts: 0,
    };
  }

  // Count conflicts by section
  const conflictsBySection = groupOperationsBySection(conflicts.map(c => c.operation));
  for (const [section, ops] of conflictsBySection) {
    if (!sectionBreakdown[section]) {
      sectionBreakdown[section] = { adds: 0, removes: 0, replaces: 0, conflicts: 0 };
    }
    sectionBreakdown[section].conflicts = ops.length;
  }

  return {
    totalChanges: applicable.length + conflicts.length,
    applicableChanges: applicable.length,
    conflicts: conflicts.length,
    sectionBreakdown,
  };
}

// ============================================================================
// Proposal Validation
// ============================================================================

/**
 * Check if a proposal is still valid (not expired, not superseded)
 */
export function isProposalValid(proposal: Proposal): boolean {
  if (proposal.status !== 'pending') {
    return false;
  }

  const now = new Date();
  const expiresAt = new Date(proposal.expiresAt);

  if (now > expiresAt) {
    return false;
  }

  return true;
}

/**
 * Check if a proposal has conflicts
 */
export function hasConflicts(proposal: Proposal): boolean {
  return proposal.conflicts.length > 0;
}

/**
 * Get paths that can be applied (no conflicts)
 */
export function getApplicablePaths(proposal: Proposal): string[] {
  return proposal.patch.map(op => op.path);
}

/**
 * Get paths that have conflicts
 */
export function getConflictPaths(proposal: Proposal): string[] {
  return proposal.conflicts.map(c => c.path);
}

// ============================================================================
// Proposal Filtering
// ============================================================================

/**
 * Filter proposal patch to only include specified paths
 */
export function filterProposalPaths(
  proposal: Proposal,
  selectedPaths: string[]
): PatchOperation[] {
  const selectedSet = new Set(selectedPaths);
  return proposal.patch.filter(op => selectedSet.has(op.path));
}

/**
 * Create a partial proposal with only selected paths
 */
export function createPartialProposal(
  proposal: Proposal,
  selectedPaths: string[]
): Proposal {
  const filteredPatch = filterProposalPaths(proposal, selectedPaths);

  // Recalculate summary
  const applicableBySection = groupOperationsBySection(filteredPatch);
  const sectionBreakdown: ProposalSummary['sectionBreakdown'] = {};

  for (const [section, ops] of applicableBySection) {
    sectionBreakdown[section] = {
      adds: ops.filter(op => op.op === 'add').length,
      removes: ops.filter(op => op.op === 'remove').length,
      replaces: ops.filter(op => op.op === 'replace').length,
      conflicts: 0,
    };
  }

  return {
    ...proposal,
    patch: filteredPatch,
    summary: {
      totalChanges: filteredPatch.length,
      applicableChanges: filteredPatch.length,
      conflicts: 0, // Partial proposals don't include conflicts
      sectionBreakdown,
    },
  };
}
