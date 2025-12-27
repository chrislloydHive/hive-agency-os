// lib/os/artifacts/usage.ts
// Artifact usage tracking helpers
//
// These functions update artifact usage metadata in response to events.
// IMPORTANT: Usage updates are metadata-only side effects.
// They NEVER mutate artifact content or lifecycle status.

import { getArtifactById, updateArtifact } from '@/lib/airtable/artifacts';
import type {
  Artifact,
  ArtifactUsage,
  ArtifactReference,
  UpdateArtifactInput,
} from '@/lib/types/artifact';
import { createDefaultUsage } from '@/lib/types/artifact';

// ============================================================================
// Pure Functions (no side effects, testable)
// ============================================================================

/**
 * Increment attached work count
 * Returns updated usage with firstAttachedAt set if this is the first attachment
 */
export function incrementAttachedWorkCount(
  currentUsage: ArtifactUsage,
  now: string
): ArtifactUsage {
  return {
    ...currentUsage,
    attachedWorkCount: currentUsage.attachedWorkCount + 1,
    firstAttachedAt: currentUsage.firstAttachedAt ?? now,
    lastAttachedAt: now,
  };
}

/**
 * Decrement attached work count (never goes below 0)
 */
export function decrementAttachedWorkCount(
  currentUsage: ArtifactUsage
): ArtifactUsage {
  return {
    ...currentUsage,
    attachedWorkCount: Math.max(0, currentUsage.attachedWorkCount - 1),
  };
}

/**
 * Increment completed work count
 */
export function incrementCompletedWorkCount(
  currentUsage: ArtifactUsage
): ArtifactUsage {
  return {
    ...currentUsage,
    completedWorkCount: currentUsage.completedWorkCount + 1,
  };
}

/**
 * Create a work item reference
 */
export function createWorkReference(
  workItemId: string,
  now: string
): ArtifactReference {
  return {
    type: 'work',
    id: workItemId,
    at: now,
  };
}

// ============================================================================
// Side-Effecting Functions (call Airtable)
// ============================================================================

/**
 * Record that an artifact was attached to a work item
 * Updates: attachedWorkCount++, firstAttachedAt (if first), lastAttachedAt, lastReferencedBy
 */
export async function recordArtifactAttached(
  artifactId: string,
  workItemId: string
): Promise<Artifact | null> {
  try {
    const artifact = await getArtifactById(artifactId);
    if (!artifact) {
      console.warn('[Usage] Artifact not found for attachment tracking:', artifactId);
      return null;
    }

    const now = new Date().toISOString();
    const currentUsage = artifact.usage ?? createDefaultUsage();
    const updatedUsage = incrementAttachedWorkCount(currentUsage, now);

    const updates: UpdateArtifactInput = {
      usage: updatedUsage,
      lastReferencedBy: createWorkReference(workItemId, now),
    };

    const updated = await updateArtifact(artifactId, updates);
    console.log('[Usage] Recorded artifact attached:', {
      artifactId,
      workItemId,
      attachedWorkCount: updatedUsage.attachedWorkCount,
    });

    return updated;
  } catch (error) {
    console.error('[Usage] Failed to record artifact attached:', error);
    return null;
  }
}

/**
 * Record that an artifact was detached from a work item
 * Updates: attachedWorkCount-- (never below 0)
 */
export async function recordArtifactDetached(
  artifactId: string
): Promise<Artifact | null> {
  try {
    const artifact = await getArtifactById(artifactId);
    if (!artifact) {
      console.warn('[Usage] Artifact not found for detachment tracking:', artifactId);
      return null;
    }

    const currentUsage = artifact.usage ?? createDefaultUsage();
    const updatedUsage = decrementAttachedWorkCount(currentUsage);

    const updates: UpdateArtifactInput = {
      usage: updatedUsage,
    };

    const updated = await updateArtifact(artifactId, updates);
    console.log('[Usage] Recorded artifact detached:', {
      artifactId,
      attachedWorkCount: updatedUsage.attachedWorkCount,
    });

    return updated;
  } catch (error) {
    console.error('[Usage] Failed to record artifact detached:', error);
    return null;
  }
}

/**
 * Record that an artifact was viewed
 * Updates: lastViewedAt
 */
export async function recordArtifactViewed(
  artifactId: string
): Promise<Artifact | null> {
  try {
    const now = new Date().toISOString();
    const updates: UpdateArtifactInput = {
      lastViewedAt: now,
    };

    const updated = await updateArtifact(artifactId, updates);
    console.log('[Usage] Recorded artifact viewed:', { artifactId });

    return updated;
  } catch (error) {
    console.error('[Usage] Failed to record artifact viewed:', error);
    return null;
  }
}

/**
 * Record that a work item with this artifact was completed
 * Updates: completedWorkCount++
 */
export async function recordWorkItemCompleted(
  artifactId: string,
  workItemId: string
): Promise<Artifact | null> {
  try {
    const artifact = await getArtifactById(artifactId);
    if (!artifact) {
      console.warn('[Usage] Artifact not found for completion tracking:', artifactId);
      return null;
    }

    const now = new Date().toISOString();
    const currentUsage = artifact.usage ?? createDefaultUsage();
    const updatedUsage = incrementCompletedWorkCount(currentUsage);

    const updates: UpdateArtifactInput = {
      usage: updatedUsage,
      lastReferencedBy: createWorkReference(workItemId, now),
    };

    const updated = await updateArtifact(artifactId, updates);
    console.log('[Usage] Recorded work item completed for artifact:', {
      artifactId,
      workItemId,
      completedWorkCount: updatedUsage.completedWorkCount,
    });

    return updated;
  } catch (error) {
    console.error('[Usage] Failed to record work item completed:', error);
    return null;
  }
}

/**
 * Record completion for all artifacts attached to a work item
 * Used when a work item transitions to completed status
 */
export async function recordWorkItemCompletedForArtifacts(
  workItemId: string,
  artifactIds: string[]
): Promise<{ updated: number; failed: number }> {
  let updated = 0;
  let failed = 0;

  for (const artifactId of artifactIds) {
    const result = await recordWorkItemCompleted(artifactId, workItemId);
    if (result) {
      updated++;
    } else {
      failed++;
    }
  }

  console.log('[Usage] Recorded work item completed for artifacts:', {
    workItemId,
    artifactCount: artifactIds.length,
    updated,
    failed,
  });

  return { updated, failed };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if an artifact has been used (attached to any work)
 */
export function isArtifactUsed(artifact: Artifact): boolean {
  const usage = artifact.usage ?? createDefaultUsage();
  return usage.attachedWorkCount > 0 || usage.firstAttachedAt !== null;
}

/**
 * Check if an artifact has high impact (completed work or many attachments)
 */
export function isHighImpactArtifact(
  artifact: Artifact,
  attachmentThreshold: number = 3
): boolean {
  const usage = artifact.usage ?? createDefaultUsage();
  return (
    usage.completedWorkCount > 0 ||
    usage.attachedWorkCount >= attachmentThreshold
  );
}

/**
 * Get a human-readable usage summary for display
 */
export function getUsageSummary(artifact: Artifact): {
  label: string;
  isUsed: boolean;
  isHighImpact: boolean;
} {
  const usage = artifact.usage ?? createDefaultUsage();
  const isUsed = isArtifactUsed(artifact);
  const isHighImpact = isHighImpactArtifact(artifact);

  let label: string;
  if (usage.completedWorkCount > 0) {
    label = `Used in ${usage.attachedWorkCount} work item${usage.attachedWorkCount !== 1 ? 's' : ''}, ${usage.completedWorkCount} completed`;
  } else if (usage.attachedWorkCount > 0) {
    label = `Used in ${usage.attachedWorkCount} work item${usage.attachedWorkCount !== 1 ? 's' : ''}`;
  } else {
    label = 'Not used yet';
  }

  return { label, isUsed, isHighImpact };
}
