// lib/os/artifacts/lifecycle.ts
// Artifact Lifecycle - Status transitions and validation
//
// Valid transitions:
// - draft → final (finalize)
// - draft → archived (archive without finalizing)
// - final → archived (archive after finalization)
//
// Invalid transitions:
// - final → draft (cannot un-finalize)
// - archived → * (archived is terminal)

import type { ArtifactStatus, Artifact, UpdateArtifactInput } from '@/lib/types/artifact';

// ============================================================================
// Status Transition Validation
// ============================================================================

/**
 * Valid status transitions
 */
const VALID_TRANSITIONS: Record<ArtifactStatus, ArtifactStatus[]> = {
  draft: ['final', 'archived'],
  final: ['archived'],
  archived: [], // Terminal state
};

/**
 * Check if a status transition is valid
 */
export function isValidStatusTransition(
  from: ArtifactStatus,
  to: ArtifactStatus
): boolean {
  if (from === to) return true; // No change is always valid
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Get allowed next statuses from current status
 */
export function getAllowedNextStatuses(current: ArtifactStatus): ArtifactStatus[] {
  return VALID_TRANSITIONS[current] ?? [];
}

/**
 * Get human-readable error for invalid transition
 */
export function getTransitionError(from: ArtifactStatus, to: ArtifactStatus): string {
  if (from === 'archived') {
    return 'Archived artifacts cannot change status';
  }
  if (from === 'final' && to === 'draft') {
    return 'Final artifacts cannot be reverted to draft';
  }
  return `Cannot transition from ${from} to ${to}`;
}

// ============================================================================
// Immutability Checks
// ============================================================================

/**
 * Fields that cannot be modified on final/archived artifacts
 */
const IMMUTABLE_FIELDS: (keyof UpdateArtifactInput)[] = [
  'generatedContent',
  'generatedMarkdown',
  'generatedFormat',
  'title',
  // Note: We allow updating staleness fields and metadata even on final artifacts
];

/**
 * Check if an artifact is immutable (final or archived)
 */
export function isArtifactImmutable(status: ArtifactStatus): boolean {
  return status === 'final' || status === 'archived';
}

/**
 * Validate an update against artifact immutability rules
 * Returns list of fields that cannot be modified
 */
export function validateUpdateImmutability(
  artifact: Artifact,
  updates: UpdateArtifactInput
): { valid: boolean; blockedFields: string[] } {
  // Draft artifacts can be freely edited
  if (artifact.status === 'draft') {
    return { valid: true, blockedFields: [] };
  }

  const blockedFields: string[] = [];

  for (const field of IMMUTABLE_FIELDS) {
    if (updates[field] !== undefined) {
      blockedFields.push(field);
    }
  }

  return {
    valid: blockedFields.length === 0,
    blockedFields,
  };
}

/**
 * Validate a complete update request
 * Checks both transition validity and immutability
 */
export function validateArtifactUpdate(
  artifact: Artifact,
  updates: UpdateArtifactInput
): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check status transition if status is being changed
  if (updates.status && updates.status !== artifact.status) {
    if (!isValidStatusTransition(artifact.status, updates.status)) {
      errors.push(getTransitionError(artifact.status, updates.status));
    }
  }

  // Check immutability (but allow if transitioning to archived - we need to set archivedAt etc)
  const isStatusOnlyUpdate =
    updates.status !== undefined &&
    Object.keys(updates).filter(k => k !== 'status' && k !== 'archivedAt' && k !== 'archivedBy' && k !== 'archivedReason' && k !== 'updatedBy').length === 0;

  if (!isStatusOnlyUpdate) {
    const immutabilityCheck = validateUpdateImmutability(artifact, updates);
    if (!immutabilityCheck.valid) {
      errors.push(
        `Cannot modify ${immutabilityCheck.blockedFields.join(', ')} on ${artifact.status} artifacts`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// Lifecycle Helpers
// ============================================================================

/**
 * Check if artifact can be finalized
 */
export function canFinalize(artifact: Artifact): { allowed: boolean; reason?: string } {
  if (artifact.status !== 'draft') {
    return { allowed: false, reason: 'Only draft artifacts can be finalized' };
  }
  return { allowed: true };
}

/**
 * Check if artifact can be archived
 */
export function canArchive(artifact: Artifact): { allowed: boolean; reason?: string } {
  if (artifact.status === 'archived') {
    return { allowed: false, reason: 'Artifact is already archived' };
  }
  return { allowed: true };
}

/**
 * Check if artifact content can be edited
 */
export function canEditContent(artifact: Artifact): { allowed: boolean; reason?: string } {
  if (artifact.status === 'final') {
    return { allowed: false, reason: 'Final artifacts cannot be edited' };
  }
  if (artifact.status === 'archived') {
    return { allowed: false, reason: 'Archived artifacts cannot be edited' };
  }
  return { allowed: true };
}
