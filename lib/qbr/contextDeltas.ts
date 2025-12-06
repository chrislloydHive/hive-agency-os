// lib/qbr/contextDeltas.ts
// Context Graph Delta Computation for QBR
//
// Computes detailed change deltas between context snapshots,
// enriched with conflict, override, and staleness detection.

import type { QbrDomain } from './qbrTypes';
import type { ContextFieldSnapshot } from './contextSnapshots';

// ============================================================================
// Types
// ============================================================================

export type ContextDeltaChangeType =
  | 'added'
  | 'removed'
  | 'modified'
  | 'conflicted'
  | 'override'
  | 'stale';

export interface ContextGraphDelta {
  /** Field path key */
  key: string;
  /** QBR domain this field belongs to */
  domain: QbrDomain;
  /** Type of change */
  changeType: ContextDeltaChangeType;
  /** Previous snapshot (if existed) */
  before?: ContextFieldSnapshot;
  /** Current snapshot (if exists) */
  after?: ContextFieldSnapshot;
}

export interface ContextDeltasByDomain {
  domain: QbrDomain;
  deltas: ContextGraphDelta[];
  summary: {
    added: number;
    removed: number;
    modified: number;
    conflicted: number;
    override: number;
    stale: number;
  };
}

// ============================================================================
// Delta Computation
// ============================================================================

/**
 * Determine the change type for a field delta
 */
function determineChangeType(
  before: ContextFieldSnapshot | undefined,
  after: ContextFieldSnapshot | undefined
): ContextDeltaChangeType {
  // If no after, it was removed
  if (!after) {
    return 'removed';
  }

  // If no before, it was added
  if (!before) {
    return 'added';
  }

  // Check for conflict (highest priority after add/remove)
  if (after.status === 'conflicted') {
    return 'conflicted';
  }

  // Check for human override
  if (after.isHumanOverride && !before.isHumanOverride) {
    return 'override';
  }

  // Check for staleness
  if (after.freshness < 60) {
    return 'stale';
  }

  // Check for value change
  if (JSON.stringify(before.value) !== JSON.stringify(after.value)) {
    return 'modified';
  }

  // If confidence changed significantly, also count as modified
  if (Math.abs(before.confidence - after.confidence) > 10) {
    return 'modified';
  }

  // Default to modified if we got here (shouldn't happen in practice)
  return 'modified';
}

/**
 * Compute deltas between two sets of context snapshots
 */
export function computeContextGraphDeltas(
  beforeSnapshots: ContextFieldSnapshot[],
  afterSnapshots: ContextFieldSnapshot[]
): ContextGraphDelta[] {
  const deltas: ContextGraphDelta[] = [];

  // Create maps for fast lookup
  const beforeMap = new Map(beforeSnapshots.map(s => [s.key, s]));
  const afterMap = new Map(afterSnapshots.map(s => [s.key, s]));

  // Get all unique keys
  const allKeys = new Set([...beforeMap.keys(), ...afterMap.keys()]);

  for (const key of allKeys) {
    const before = beforeMap.get(key);
    const after = afterMap.get(key);

    // Skip if nothing changed
    if (before && after &&
        JSON.stringify(before.value) === JSON.stringify(after.value) &&
        before.status === after.status &&
        before.isHumanOverride === after.isHumanOverride &&
        Math.abs(before.freshness - after.freshness) < 10) {
      continue;
    }

    const changeType = determineChangeType(before, after);
    const domain = after?.domain || before?.domain || 'strategy';

    deltas.push({
      key,
      domain,
      changeType,
      before,
      after,
    });
  }

  return deltas;
}

/**
 * Compute deltas from a single snapshot set (compared to empty)
 * Used when we only have the current state
 */
export function computeDeltasFromCurrentState(
  currentSnapshots: ContextFieldSnapshot[]
): ContextGraphDelta[] {
  const deltas: ContextGraphDelta[] = [];

  for (const snapshot of currentSnapshots) {
    let changeType: ContextDeltaChangeType;

    // Determine change type based on current status
    if (snapshot.status === 'conflicted') {
      changeType = 'conflicted';
    } else if (snapshot.isHumanOverride) {
      changeType = 'override';
    } else if (snapshot.freshness < 60) {
      changeType = 'stale';
    } else if (snapshot.status === 'missing') {
      continue; // Skip missing fields
    } else {
      // Field exists and is healthy - still include for completeness
      changeType = 'modified';
    }

    deltas.push({
      key: snapshot.key,
      domain: snapshot.domain,
      changeType,
      after: snapshot,
    });
  }

  return deltas;
}

/**
 * Group deltas by QBR domain with summary counts
 */
export function groupDeltasByDomain(
  deltas: ContextGraphDelta[]
): Map<QbrDomain, ContextDeltasByDomain> {
  const grouped = new Map<QbrDomain, ContextDeltasByDomain>();

  // Initialize all domains
  const domains: QbrDomain[] = [
    'strategy',
    'website',
    'seo',
    'content',
    'brand',
    'audience',
    'media',
    'analytics',
  ];

  for (const domain of domains) {
    grouped.set(domain, {
      domain,
      deltas: [],
      summary: {
        added: 0,
        removed: 0,
        modified: 0,
        conflicted: 0,
        override: 0,
        stale: 0,
      },
    });
  }

  // Group deltas
  for (const delta of deltas) {
    const group = grouped.get(delta.domain);
    if (group) {
      group.deltas.push(delta);
      group.summary[delta.changeType]++;
    }
  }

  return grouped;
}

/**
 * Get all problematic deltas (conflicted, override, stale)
 */
export function getProblematicDeltas(
  deltas: ContextGraphDelta[]
): ContextGraphDelta[] {
  return deltas.filter(
    d => d.changeType === 'conflicted' ||
         d.changeType === 'override' ||
         d.changeType === 'stale'
  );
}

/**
 * Count deltas by change type
 */
export function countDeltasByType(
  deltas: ContextGraphDelta[]
): Record<ContextDeltaChangeType, number> {
  const counts: Record<ContextDeltaChangeType, number> = {
    added: 0,
    removed: 0,
    modified: 0,
    conflicted: 0,
    override: 0,
    stale: 0,
  };

  for (const delta of deltas) {
    counts[delta.changeType]++;
  }

  return counts;
}

/**
 * Get human-readable label for field key
 */
export function getFieldLabel(key: string): string {
  const parts = key.split('.');
  const fieldName = parts[parts.length - 1];

  // Convert camelCase to Title Case
  return fieldName
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}
