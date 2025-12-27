// lib/os/artifacts/findExistingArtifact.ts
// Helper to find existing artifacts matching a type and source
//
// Used by Recommended Starters to determine whether to show "Open" vs "Generate"
// and to route directly to existing artifacts when clicked.

import type { Artifact, ArtifactType } from '@/lib/types/artifact';

// ============================================================================
// Types
// ============================================================================

export type ArtifactSourceType = 'strategy' | 'plan:media' | 'plan:content';

export interface FindExistingArtifactInput {
  /** The artifact type to find */
  artifactTypeId: string;
  /** The source type (strategy or plan) */
  sourceType: ArtifactSourceType;
  /** The source ID (strategyId or planId) */
  sourceId: string;
  /** List of artifacts to search through */
  artifacts: Artifact[];
}

export interface FindExistingArtifactResult {
  /** The most relevant existing artifact, or null if none found */
  artifact: Artifact | null;
  /** Whether there are multiple matching artifacts */
  hasMultiple: boolean;
  /** Count of matching artifacts (excluding archived) */
  matchCount: number;
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Find the most relevant existing artifact for a given type and source.
 *
 * Selection priority:
 * 1. Draft artifacts (most recently updated first)
 * 2. Final artifacts (most recently updated first)
 *
 * Archived artifacts are always excluded.
 *
 * @example
 * ```ts
 * const result = findExistingArtifact({
 *   artifactTypeId: 'strategy_summary',
 *   sourceType: 'strategy',
 *   sourceId: 'strat-123',
 *   artifacts: companyArtifacts,
 * });
 *
 * if (result.artifact) {
 *   // Route to existing artifact
 *   router.push(`/c/${companyId}/artifacts/${result.artifact.id}`);
 * } else {
 *   // Generate new artifact
 * }
 * ```
 */
export function findExistingArtifact(
  input: FindExistingArtifactInput
): FindExistingArtifactResult {
  const { artifactTypeId, sourceType, sourceId, artifacts } = input;

  // Filter to matching artifacts (exclude archived)
  const matching = artifacts.filter((artifact) => {
    // Must match type
    if (artifact.type !== artifactTypeId) return false;

    // Must not be archived
    if (artifact.status === 'archived') return false;

    // Must match source
    if (sourceType === 'strategy') {
      return artifact.sourceStrategyId === sourceId;
    } else if (sourceType === 'plan:media') {
      return artifact.sourceMediaPlanId === sourceId;
    } else if (sourceType === 'plan:content') {
      return artifact.sourceContentPlanId === sourceId;
    }

    return false;
  });

  if (matching.length === 0) {
    return {
      artifact: null,
      hasMultiple: false,
      matchCount: 0,
    };
  }

  // Sort by preference: drafts first, then by most recently updated
  const sorted = [...matching].sort((a, b) => {
    // Drafts come before finals
    if (a.status === 'draft' && b.status !== 'draft') return -1;
    if (a.status !== 'draft' && b.status === 'draft') return 1;

    // Then by most recently updated
    const aDate = new Date(a.updatedAt).getTime();
    const bDate = new Date(b.updatedAt).getTime();
    return bDate - aDate;
  });

  return {
    artifact: sorted[0],
    hasMultiple: sorted.length > 1,
    matchCount: sorted.length,
  };
}

/**
 * Check if an artifact exists for a given type and source.
 * Convenience wrapper around findExistingArtifact.
 */
export function hasExistingArtifact(
  input: FindExistingArtifactInput
): boolean {
  return findExistingArtifact(input).artifact !== null;
}

/**
 * Get all matching artifacts for a type and source (excluding archived).
 * Useful for showing "X artifacts" count.
 */
export function findAllMatchingArtifacts(
  input: FindExistingArtifactInput
): Artifact[] {
  const { artifactTypeId, sourceType, sourceId, artifacts } = input;

  return artifacts.filter((artifact) => {
    if (artifact.type !== artifactTypeId) return false;
    if (artifact.status === 'archived') return false;

    if (sourceType === 'strategy') {
      return artifact.sourceStrategyId === sourceId;
    } else if (sourceType === 'plan:media') {
      return artifact.sourceMediaPlanId === sourceId;
    } else if (sourceType === 'plan:content') {
      return artifact.sourceContentPlanId === sourceId;
    }

    return false;
  });
}
