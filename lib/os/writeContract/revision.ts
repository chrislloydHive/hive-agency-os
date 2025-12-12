// lib/os/writeContract/revision.ts
// Optimistic concurrency control via revision IDs
//
// Ensures that writes don't overwrite changes made by other processes.

import { randomUUID } from 'crypto';
import type { WriteContractViolation, ViolationConflict, Proposal } from './types';

// ============================================================================
// Revision ID Generation
// ============================================================================

/**
 * Generate a new revision ID
 * Format: rev_<timestamp>_<random>
 */
export function generateRevisionId(): string {
  const timestamp = Date.now().toString(36);
  const random = randomUUID().replace(/-/g, '').slice(0, 8);
  return `rev_${timestamp}_${random}`;
}

/**
 * Parse a revision ID to extract timestamp
 * Returns null if invalid format
 */
export function parseRevisionId(revisionId: string): { timestamp: number; random: string } | null {
  if (!revisionId || !revisionId.startsWith('rev_')) {
    return null;
  }

  const parts = revisionId.split('_');
  if (parts.length !== 3) {
    return null;
  }

  const timestamp = parseInt(parts[1], 36);
  if (isNaN(timestamp)) {
    return null;
  }

  return {
    timestamp,
    random: parts[2],
  };
}

// ============================================================================
// Revision Comparison
// ============================================================================

/**
 * Compare two revision IDs
 * Returns:
 *   -1 if a < b (a is older)
 *    0 if a === b (same revision)
 *    1 if a > b (a is newer)
 *   null if comparison is not possible (different random components)
 */
export function compareRevisions(a: string, b: string): number | null {
  // Exact match
  if (a === b) {
    return 0;
  }

  const parsedA = parseRevisionId(a);
  const parsedB = parseRevisionId(b);

  // If either is invalid, can't compare
  if (!parsedA || !parsedB) {
    return null;
  }

  // Compare by timestamp
  if (parsedA.timestamp < parsedB.timestamp) {
    return -1;
  }
  if (parsedA.timestamp > parsedB.timestamp) {
    return 1;
  }

  // Same timestamp but different random - cannot determine order
  // This is a conflict scenario
  return null;
}

/**
 * Check if a base revision is current (matches the current revision)
 */
export function isRevisionCurrent(baseRevisionId: string, currentRevisionId: string): boolean {
  return baseRevisionId === currentRevisionId;
}

/**
 * Check if a base revision is stale (older than current)
 */
export function isRevisionStale(baseRevisionId: string, currentRevisionId: string): boolean {
  if (baseRevisionId === currentRevisionId) {
    return false;
  }

  const comparison = compareRevisions(baseRevisionId, currentRevisionId);

  // If comparison returns -1, base is older (stale)
  // If comparison returns null, we assume stale (different revisions)
  return comparison === -1 || comparison === null;
}

// ============================================================================
// Revision Validation
// ============================================================================

/**
 * Validate that a base revision matches the current revision
 * Throws WriteContractViolation if stale
 */
export function validateRevision(
  baseRevisionId: string,
  currentRevisionId: string,
  entityType: string
): void {
  if (isRevisionCurrent(baseRevisionId, currentRevisionId)) {
    return; // Valid
  }

  const conflict: ViolationConflict = {
    path: '/',
    type: 'STALE_REVISION',
    message: `The ${entityType} has been modified since you loaded it. Your base revision "${baseRevisionId}" is older than the current revision "${currentRevisionId}".`,
  };

  throw new (class extends Error {
    readonly type = 'STALE_REVISION' as const;
    readonly conflicts = [conflict];
    readonly baseRevisionId = baseRevisionId;
    readonly currentRevisionId = currentRevisionId;

    constructor() {
      super(`Stale revision: expected ${currentRevisionId}, got ${baseRevisionId}`);
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

/**
 * Validate that a proposal's base revision is still current
 * Returns validation result instead of throwing
 */
export function validateProposalRevision(
  proposal: Proposal,
  currentRevisionId: string
): {
  valid: boolean;
  error?: {
    type: 'STALE_REVISION';
    message: string;
    baseRevisionId: string;
    currentRevisionId: string;
  };
} {
  if (isRevisionCurrent(proposal.baseRevisionId, currentRevisionId)) {
    return { valid: true };
  }

  return {
    valid: false,
    error: {
      type: 'STALE_REVISION',
      message: `The entity has been modified since this proposal was created. Proposal was based on revision "${proposal.baseRevisionId}" but current revision is "${currentRevisionId}".`,
      baseRevisionId: proposal.baseRevisionId,
      currentRevisionId,
    },
  };
}

// ============================================================================
// Revision Tracking Helpers
// ============================================================================

/**
 * Create initial revision metadata for a new entity
 */
export function createInitialRevision(): {
  revisionId: string;
  revisionCreatedAt: string;
} {
  return {
    revisionId: generateRevisionId(),
    revisionCreatedAt: new Date().toISOString(),
  };
}

/**
 * Create updated revision metadata after a change
 */
export function createUpdatedRevision(
  previousRevisionId: string
): {
  revisionId: string;
  previousRevisionId: string;
  revisionCreatedAt: string;
} {
  return {
    revisionId: generateRevisionId(),
    previousRevisionId,
    revisionCreatedAt: new Date().toISOString(),
  };
}

/**
 * Get revision age in milliseconds
 */
export function getRevisionAge(revisionId: string): number | null {
  const parsed = parseRevisionId(revisionId);
  if (!parsed) {
    return null;
  }
  return Date.now() - parsed.timestamp;
}

/**
 * Check if a revision is older than a threshold (in milliseconds)
 */
export function isRevisionOlderThan(revisionId: string, maxAgeMs: number): boolean {
  const age = getRevisionAge(revisionId);
  if (age === null) {
    return false; // Can't determine age, assume not old
  }
  return age > maxAgeMs;
}
