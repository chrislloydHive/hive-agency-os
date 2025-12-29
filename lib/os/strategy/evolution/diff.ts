// lib/os/strategy/evolution/diff.ts
// Deterministic diff engine for strategy evolution
//
// Design: Pure functions, no LLM, explainable and stable.
// Compares StrategySnapshots and produces DiffSummary.

import type {
  StrategySnapshot,
  SnapshotObjective,
  SnapshotPillar,
  SnapshotTactic,
  SnapshotFrame,
  DiffSummary,
  DiffChange,
  DiffRiskFlag,
} from '@/lib/types/strategyEvolution';
import type { StrategyRevisionTarget } from '@/lib/types/strategyRevision';

// Extended target types for diff that include all diffable areas
// Maps to StrategyRevisionTarget where possible, with additional internal types
type DiffTarget =
  | StrategyRevisionTarget
  | 'goal'  // Alias for goalStatement
  | 'frame' // Frame encompasses audience, valueProp, positioning, constraints
  | 'pillars'; // Alias for strategicBets

// Map diff targets to StrategyRevisionTarget for external use
function toDiffChangeTarget(target: DiffTarget): StrategyRevisionTarget {
  switch (target) {
    case 'goal': return 'goalStatement';
    case 'frame': return 'audience'; // Frame changes are reported as audience for simplicity
    case 'pillars': return 'strategicBets';
    default: return target as StrategyRevisionTarget;
  }
}

// ============================================================================
// Main Diff Function
// ============================================================================

/**
 * Compare two strategy snapshots and produce a deterministic diff summary
 * No LLM usage - purely structural comparison
 */
export function diffStrategySnapshots(
  before: StrategySnapshot,
  after: StrategySnapshot
): DiffSummary {
  const changes: DiffChange[] = [];
  let added = 0;
  let removed = 0;
  let modified = 0;

  // Diff goal statement
  const goalChanges = diffGoalStatement(before.goalStatement, after.goalStatement);
  changes.push(...goalChanges);
  modified += goalChanges.filter((c) => c.type === 'modify').length;

  // Diff frame
  const frameChanges = diffFrame(before.frame, after.frame);
  changes.push(...frameChanges);
  added += frameChanges.filter((c) => c.type === 'add').length;
  removed += frameChanges.filter((c) => c.type === 'remove').length;
  modified += frameChanges.filter((c) => c.type === 'modify').length;

  // Diff objectives
  const objectiveChanges = diffObjectives(before.objectives, after.objectives);
  changes.push(...objectiveChanges);
  added += objectiveChanges.filter((c) => c.type === 'add').length;
  removed += objectiveChanges.filter((c) => c.type === 'remove').length;
  modified += objectiveChanges.filter((c) => c.type === 'modify').length;

  // Diff pillars
  const pillarChanges = diffPillars(before.pillars, after.pillars);
  changes.push(...pillarChanges);
  added += pillarChanges.filter((c) => c.type === 'add').length;
  removed += pillarChanges.filter((c) => c.type === 'remove').length;
  modified += pillarChanges.filter((c) => c.type === 'modify').length;

  // Diff tactics
  const tacticChanges = diffTactics(before.tactics, after.tactics);
  changes.push(...tacticChanges);
  added += tacticChanges.filter((c) => c.type === 'add').length;
  removed += tacticChanges.filter((c) => c.type === 'remove').length;
  modified += tacticChanges.filter((c) => c.type === 'modify').length;

  // Diff metadata (title, summary, status)
  const metadataChanges = diffMetadata(before, after);
  changes.push(...metadataChanges);
  modified += metadataChanges.filter((c) => c.type === 'modify').length;

  // Calculate impact score and risk flags
  const impactScore = calculateImpactScore(changes, before, after);
  const riskFlags = calculateRiskFlags(changes, before, after);

  // Sort changes by stable key for deterministic output
  const sortedChanges = sortChangesStably(changes);

  // Generate human-readable summary
  const summary = generateSummary(added, removed, modified, sortedChanges);

  return {
    added,
    removed,
    modified,
    summary,
    changes: sortedChanges,
    impactScore,
    riskFlags,
  };
}

// ============================================================================
// Component Diff Functions
// ============================================================================

/**
 * Diff goal statement
 */
function diffGoalStatement(
  before: string | undefined,
  after: string | undefined
): DiffChange[] {
  if (before === after) return [];
  if (!before && !after) return [];

  if (!before && after) {
    return [
      {
        target: 'goalStatement',
        type: 'add',
        path: 'goalStatement',
        after,
        description: 'Goal statement added',
      },
    ];
  }

  if (before && !after) {
    return [
      {
        target: 'goalStatement',
        type: 'remove',
        path: 'goalStatement',
        before,
        description: 'Goal statement removed',
      },
    ];
  }

  return [
    {
      target: 'goalStatement',
      type: 'modify',
      path: 'goalStatement',
      before,
      after,
      description: 'Goal statement modified',
    },
  ];
}

/**
 * Diff strategy frame
 * Frame fields map to their corresponding StrategyRevisionTarget
 */
function diffFrame(
  before: SnapshotFrame | undefined,
  after: SnapshotFrame | undefined
): DiffChange[] {
  const changes: DiffChange[] = [];

  if (!before && !after) return [];

  // Map frame fields to their StrategyRevisionTarget
  const fieldToTarget: Record<string, StrategyRevisionTarget> = {
    audience: 'audience',
    offering: 'valueProp', // offering maps to valueProp
    valueProp: 'valueProp',
    positioning: 'positioning',
    constraints: 'constraints',
    successMetrics: 'constraints', // successMetrics grouped with constraints
    nonGoals: 'constraints', // nonGoals grouped with constraints
  };

  if (!before && after) {
    changes.push({
      target: 'audience',
      type: 'add',
      path: 'frame',
      after,
      description: 'Strategy frame added',
    });
    return changes;
  }

  if (before && !after) {
    changes.push({
      target: 'audience',
      type: 'remove',
      path: 'frame',
      before,
      description: 'Strategy frame removed',
    });
    return changes;
  }

  // Compare individual frame fields
  const frameFields: (keyof SnapshotFrame)[] = [
    'audience',
    'offering',
    'valueProp',
    'positioning',
    'constraints',
  ];

  for (const field of frameFields) {
    const beforeVal = before?.[field];
    const afterVal = after?.[field];

    if (beforeVal !== afterVal) {
      const target = fieldToTarget[field] || 'audience';
      if (!beforeVal && afterVal) {
        changes.push({
          target,
          type: 'add',
          path: `frame.${field}`,
          after: afterVal,
          description: `Frame ${field} added`,
        });
      } else if (beforeVal && !afterVal) {
        changes.push({
          target,
          type: 'remove',
          path: `frame.${field}`,
          before: beforeVal,
          description: `Frame ${field} removed`,
        });
      } else {
        changes.push({
          target,
          type: 'modify',
          path: `frame.${field}`,
          before: beforeVal,
          after: afterVal,
          description: `Frame ${field} modified`,
        });
      }
    }
  }

  // Compare arrays (successMetrics, nonGoals)
  const arrayFields: (keyof SnapshotFrame)[] = ['successMetrics', 'nonGoals'];
  for (const field of arrayFields) {
    const beforeArr = (before?.[field] as string[] | undefined) || [];
    const afterArr = (after?.[field] as string[] | undefined) || [];

    const beforeSet = new Set(beforeArr);
    const afterSet = new Set(afterArr);

    const addedItems = afterArr.filter((x) => !beforeSet.has(x));
    const removedItems = beforeArr.filter((x) => !afterSet.has(x));

    if (addedItems.length > 0 || removedItems.length > 0) {
      changes.push({
        target: 'constraints',
        type: 'modify',
        path: `frame.${field}`,
        before: beforeArr,
        after: afterArr,
        description: `Frame ${field}: ${addedItems.length} added, ${removedItems.length} removed`,
      });
    }
  }

  return changes;
}

/**
 * Diff objectives
 */
function diffObjectives(
  before: SnapshotObjective[],
  after: SnapshotObjective[]
): DiffChange[] {
  return diffItems(before, after, 'objectives', (obj) => ({
    id: obj.id,
    label: obj.text.substring(0, 50),
  }));
}

/**
 * Diff pillars (strategic bets)
 */
function diffPillars(
  before: SnapshotPillar[],
  after: SnapshotPillar[]
): DiffChange[] {
  return diffItems(before, after, 'strategicBets', (p) => ({
    id: p.id,
    label: p.title,
  }));
}

/**
 * Diff tactics
 */
function diffTactics(
  before: SnapshotTactic[],
  after: SnapshotTactic[]
): DiffChange[] {
  return diffItems(before, after, 'tactics', (t) => ({
    id: t.id,
    label: t.title,
  }));
}

/**
 * Generic item diff for arrays with id-based matching
 */
function diffItems<T extends { id: string }>(
  before: T[],
  after: T[],
  target: StrategyRevisionTarget,
  getInfo: (item: T) => { id: string; label: string }
): DiffChange[] {
  const changes: DiffChange[] = [];

  const beforeMap = new Map(before.map((item) => [item.id, item]));
  const afterMap = new Map(after.map((item) => [item.id, item]));

  // Find added items
  for (const [id, item] of afterMap) {
    if (!beforeMap.has(id)) {
      const info = getInfo(item);
      changes.push({
        target,
        type: 'add',
        path: `${target}[${id}]`,
        after: item,
        description: `Added ${target.slice(0, -1)}: "${info.label}"`,
      });
    }
  }

  // Find removed items
  for (const [id, item] of beforeMap) {
    if (!afterMap.has(id)) {
      const info = getInfo(item);
      changes.push({
        target,
        type: 'remove',
        path: `${target}[${id}]`,
        before: item,
        description: `Removed ${target.slice(0, -1)}: "${info.label}"`,
      });
    }
  }

  // Find modified items
  for (const [id, afterItem] of afterMap) {
    const beforeItem = beforeMap.get(id);
    if (beforeItem) {
      if (!deepEqual(beforeItem, afterItem)) {
        const info = getInfo(afterItem);
        changes.push({
          target,
          type: 'modify',
          path: `${target}[${id}]`,
          before: beforeItem,
          after: afterItem,
          description: `Modified ${target.slice(0, -1)}: "${info.label}"`,
        });
      }
    }
  }

  return changes;
}

/**
 * Diff metadata fields (title, summary, status)
 */
function diffMetadata(
  before: StrategySnapshot,
  after: StrategySnapshot
): DiffChange[] {
  const changes: DiffChange[] = [];

  if (before.title !== after.title) {
    changes.push({
      target: 'goalStatement',
      type: 'modify',
      path: 'title',
      before: before.title,
      after: after.title,
      description: 'Strategy title modified',
    });
  }

  if (before.summary !== after.summary) {
    changes.push({
      target: 'goalStatement',
      type: 'modify',
      path: 'summary',
      before: before.summary,
      after: after.summary,
      description: 'Strategy summary modified',
    });
  }

  if (before.status !== after.status) {
    changes.push({
      target: 'goalStatement',
      type: 'modify',
      path: 'status',
      before: before.status,
      after: after.status,
      description: `Status changed from "${before.status}" to "${after.status}"`,
    });
  }

  return changes;
}

// ============================================================================
// Impact Score Calculation
// ============================================================================

/**
 * Calculate impact score (0-100) based on changes
 * Deterministic algorithm based on change types and targets
 */
function calculateImpactScore(
  changes: DiffChange[],
  before: StrategySnapshot,
  after: StrategySnapshot
): number {
  if (changes.length === 0) return 0;

  let score = 0;

  // Weight by change type
  const addWeight = 15;
  const removeWeight = 20; // Removing is higher risk
  const modifyWeight = 10;

  // Weight by target
  const targetWeights: Record<StrategyRevisionTarget, number> = {
    goalStatement: 3.0, // Goal changes are highest impact
    audience: 2.5, // Audience changes affect positioning
    valueProp: 2.5, // Value proposition is key
    positioning: 2.5, // Positioning is key
    constraints: 2.0, // Constraints affect scope
    objectives: 2.0, // Objectives define what we're trying to achieve
    strategicBets: 1.5, // Strategic bets are medium impact
    tactics: 1.0, // Tactics are execution-level
  };

  for (const change of changes) {
    const targetWeight = targetWeights[change.target] || 1.0;
    let changeScore = 0;

    switch (change.type) {
      case 'add':
        changeScore = addWeight;
        break;
      case 'remove':
        changeScore = removeWeight;
        break;
      case 'modify':
        changeScore = modifyWeight;
        break;
    }

    score += changeScore * targetWeight;
  }

  // Normalize to 0-100
  // Cap at 100, typical strategies have ~10-20 items
  // A complete rewrite would score ~200-300 raw, so divide by 3
  const normalized = Math.min(100, Math.round(score / 3));

  return normalized;
}

// ============================================================================
// Risk Flag Calculation
// ============================================================================

/**
 * Calculate risk flags based on changes
 */
function calculateRiskFlags(
  changes: DiffChange[],
  before: StrategySnapshot,
  after: StrategySnapshot
): DiffRiskFlag[] {
  const flags: DiffRiskFlag[] = [];

  // Check for goal statement changes
  const goalChanges = changes.filter((c) => c.target === 'goalStatement' && c.path === 'goalStatement');
  if (goalChanges.length > 0) {
    flags.push('goal_changed');
  }

  // Check for objective removals
  const objectiveRemovals = changes.filter(
    (c) => c.target === 'objectives' && c.type === 'remove'
  );
  if (objectiveRemovals.length > 0) {
    flags.push('objective_removed');
  }

  // Check for multiple objective changes
  const objectiveChanges = changes.filter((c) => c.target === 'objectives');
  if (objectiveChanges.length >= 2) {
    flags.push('multiple_objectives_changed');
  }

  // Check for high-priority pillar changes (strategicBets)
  const pillarChanges = changes.filter((c) => c.target === 'strategicBets');
  for (const change of pillarChanges) {
    const pillar = (change.before || change.after) as SnapshotPillar | undefined;
    if (pillar?.priority === 'high') {
      flags.push('high_priority_pillar_changed');
      break;
    }
  }

  // Check for many tactic changes
  const tacticChanges = changes.filter((c) => c.target === 'tactics');
  if (tacticChanges.length >= 5) {
    flags.push('many_tactics_changed');
  }

  // Check for significant frame changes (audience, valueProp, positioning, constraints)
  const frameTargets: StrategyRevisionTarget[] = ['audience', 'valueProp', 'positioning', 'constraints'];
  const frameChanges = changes.filter((c) => frameTargets.includes(c.target));
  if (frameChanges.length >= 3) {
    flags.push('frame_significantly_changed');
  }

  // Deduplicate and sort alphabetically for stable output
  return [...new Set(flags)].sort();
}

// ============================================================================
// Summary Generation
// ============================================================================

/**
 * Generate human-readable summary
 */
function generateSummary(
  added: number,
  removed: number,
  modified: number,
  changes: DiffChange[]
): string {
  const total = added + removed + modified;

  if (total === 0) {
    return 'No changes detected';
  }

  const parts: string[] = [];

  if (added > 0) {
    parts.push(`${added} added`);
  }
  if (removed > 0) {
    parts.push(`${removed} removed`);
  }
  if (modified > 0) {
    parts.push(`${modified} modified`);
  }

  // Add target breakdown
  const targetCounts = changes.reduce(
    (acc, c) => {
      acc[c.target] = (acc[c.target] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const targetParts: string[] = [];
  for (const [target, count] of Object.entries(targetCounts)) {
    targetParts.push(`${count} ${target}`);
  }

  return `${parts.join(', ')}. Affected: ${targetParts.join(', ')}.`;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Sort changes by stable key for deterministic output
 * Sort order: target (alphabetically), then path (alphabetically), then type (add, modify, remove)
 */
function sortChangesStably(changes: DiffChange[]): DiffChange[] {
  const typeOrder: Record<DiffChange['type'], number> = {
    add: 0,
    modify: 1,
    remove: 2,
  };

  return [...changes].sort((a, b) => {
    // Primary sort: target alphabetically
    if (a.target !== b.target) {
      return a.target.localeCompare(b.target);
    }

    // Secondary sort: path alphabetically (handle undefined)
    const pathA = a.path || '';
    const pathB = b.path || '';
    if (pathA !== pathB) {
      return pathA.localeCompare(pathB);
    }

    // Tertiary sort: type (add before modify before remove)
    return typeOrder[a.type] - typeOrder[b.type];
  });
}

/**
 * Deep equality check
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (typeof a !== 'object') return a === b;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }

  if (Array.isArray(a) || Array.isArray(b)) return false;

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;

  const aKeys = Object.keys(aObj).sort();
  const bKeys = Object.keys(bObj).sort();

  if (aKeys.length !== bKeys.length) return false;
  if (!aKeys.every((key, index) => key === bKeys[index])) return false;

  return aKeys.every((key) => deepEqual(aObj[key], bObj[key]));
}

/**
 * Check if two snapshots are equal
 */
export function snapshotsEqual(a: StrategySnapshot, b: StrategySnapshot): boolean {
  return deepEqual(a, b);
}

/**
 * Get a quick summary of snapshot content
 */
export function getSnapshotSummary(snapshot: StrategySnapshot): string {
  return `${snapshot.objectives.length} objectives, ${snapshot.pillars.length} pillars, ${snapshot.tactics.length} tactics`;
}
