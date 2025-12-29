// lib/types/strategyEvolution.ts
// Strategy Evolution History & Diff Intelligence Types
//
// Design principle: Append-only evolution history with deterministic diffs.
// Every applied proposal creates a versioned snapshot and evolution event.
// Rollback creates a new version equal to old snapshot (never deletes history).

import { createHash } from 'crypto';
import type { StrategyRevisionTarget, StrategyRevisionChange, RevisionConfidence } from './strategyRevision';
import type { CompanyStrategy } from './strategy';

// ============================================================================
// Strategy Snapshot - Minimal stable structure for diff/restore
// ============================================================================

/**
 * Minimal objective representation for snapshot
 */
export interface SnapshotObjective {
  id: string;
  text: string;
  metric?: string;
  target?: string;
  timeframe?: string;
  status?: string;
}

/**
 * Minimal pillar/bet representation for snapshot
 */
export interface SnapshotPillar {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status?: string;
  order?: number;
}

/**
 * Minimal tactic/play representation for snapshot
 */
export interface SnapshotTactic {
  id: string;
  title: string;
  description?: string;
  channels?: string[];
  status?: string;
}

/**
 * Minimal frame representation for snapshot
 */
export interface SnapshotFrame {
  audience?: string;
  offering?: string;
  valueProp?: string;
  positioning?: string;
  constraints?: string;
  successMetrics?: string[];
  nonGoals?: string[];
}

/**
 * Strategy Snapshot - stable minimal snapshot for diff/restore
 * Sorted arrays for deterministic hashing
 */
export interface StrategySnapshot {
  /** Strategy ID */
  strategyId: string;

  /** Goal statement */
  goalStatement?: string;

  /** Strategy frame */
  frame?: SnapshotFrame;

  /** Objectives (sorted by id) */
  objectives: SnapshotObjective[];

  /** Pillars/bets (sorted by id) */
  pillars: SnapshotPillar[];

  /** Tactics/plays (sorted by id) */
  tactics: SnapshotTactic[];

  /** Title */
  title: string;

  /** Summary */
  summary: string;

  /** Status */
  status: string;
}

// ============================================================================
// Strategy Version - Versioned snapshot record
// ============================================================================

/**
 * A versioned strategy snapshot
 */
export interface StrategyVersion {
  /** Unique version ID */
  id: string;

  /** Company ID */
  companyId: string;

  /** Strategy ID */
  strategyId: string;

  /** Version number (1, 2, 3...) */
  versionNumber: number;

  /** SHA-256 hash of the snapshot for dedup/verification */
  snapshotHash: string;

  /** The actual snapshot content */
  snapshot: StrategySnapshot;

  /** When this version was created */
  createdAt: string;

  /** What triggered this version (proposal apply, rollback, manual) */
  trigger: 'proposal' | 'rollback' | 'manual' | 'initial';

  /** ID of the event that created this version (if any) */
  eventId?: string;
}

// ============================================================================
// Strategy Evolution Event - Append-only change record
// ============================================================================

/**
 * Diff summary for strategy changes
 */
export interface DiffSummary {
  /** Number of items added */
  added: number;

  /** Number of items removed */
  removed: number;

  /** Number of items modified */
  modified: number;

  /** Human-readable summary of changes */
  summary: string;

  /** Detailed change descriptions */
  changes: DiffChange[];

  /** Impact score (0-100) based on change magnitude */
  impactScore: number;

  /** Risk flags for notable changes */
  riskFlags: DiffRiskFlag[];
}

/**
 * A single diff change
 */
export interface DiffChange {
  /** What changed */
  target: StrategyRevisionTarget;

  /** Type of change */
  type: 'add' | 'remove' | 'modify';

  /** Path to the changed item */
  path?: string;

  /** Before value (for modify/remove) */
  before?: unknown;

  /** After value (for add/modify) */
  after?: unknown;

  /** Human-readable description */
  description: string;
}

/**
 * Risk flags for notable changes
 */
export type DiffRiskFlag =
  | 'goal_changed'
  | 'objective_removed'
  | 'multiple_objectives_changed'
  | 'high_priority_pillar_changed'
  | 'many_tactics_changed'
  | 'frame_significantly_changed';

/**
 * Strategy Evolution Event - a record of a change that was applied
 */
export interface StrategyEvolutionEvent {
  /** Unique event ID */
  id: string;

  /** Company ID */
  companyId: string;

  /** Strategy ID */
  strategyId: string;

  /** Proposal that triggered this event (if any) */
  proposalId?: string;

  /** Title describing this evolution */
  title: string;

  /** Primary target of the changes */
  target: StrategyRevisionTarget;

  /** Changes that were applied */
  changes: StrategyRevisionChange[];

  /** Confidence at time of apply */
  confidenceAtApply: RevisionConfidence;

  /** Signal IDs that contributed to this change */
  evidenceSignalIds: string[];

  /** Evidence snippets */
  evidenceSnippets: string[];

  // ---------------------------------------------------------------------------
  // Version tracking
  // ---------------------------------------------------------------------------

  /** Version number before this event */
  versionFrom: number;

  /** Version number after this event */
  versionTo: number;

  /** Snapshot hash before changes */
  snapshotHashBefore: string;

  /** Snapshot hash after changes */
  snapshotHashAfter: string;

  /** Diff summary */
  diffSummary: DiffSummary;

  // ---------------------------------------------------------------------------
  // Rollback tracking
  // ---------------------------------------------------------------------------

  /** If this is a rollback, the event ID being rolled back */
  rollbackOfEventId?: string;

  /** Whether this event has been rolled back */
  rolledBack?: boolean;

  /** Event ID of the rollback (if rolled back) */
  rolledBackByEventId?: string;

  // ---------------------------------------------------------------------------
  // Timestamps
  // ---------------------------------------------------------------------------

  /** When this event was created */
  createdAt: string;

  /** Who created this event */
  createdBy?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique evolution event ID (non-deterministic, for fallback)
 */
export function generateEvolutionEventId(): string {
  return `evo_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate a deterministic evolution event ID based on content hash.
 * Used for idempotent event creation.
 *
 * Format: evo_<hash16>
 * Where hash = SHA256(strategyId + proposalId + beforeHash + afterHash)
 */
export function generateDeterministicEventId(
  strategyId: string,
  proposalId: string | undefined,
  snapshotHashBefore: string,
  snapshotHashAfter: string
): string {
  const content = `${strategyId}|${proposalId || ''}|${snapshotHashBefore}|${snapshotHashAfter}`;
  const hash = createHash('sha256').update(content).digest('hex').substring(0, 16);
  return `evo_${hash}`;
}

/**
 * Generate a deterministic rollback event ID based on content hash.
 * Format: evo_rb_<hash16>
 */
export function generateDeterministicRollbackEventId(
  strategyId: string,
  rollbackOfEventId: string,
  snapshotHashBefore: string,
  snapshotHashAfter: string
): string {
  const content = `rollback|${strategyId}|${rollbackOfEventId}|${snapshotHashBefore}|${snapshotHashAfter}`;
  const hash = createHash('sha256').update(content).digest('hex').substring(0, 16);
  return `evo_rb_${hash}`;
}

/**
 * Generate a unique version ID
 */
export function generateVersionId(): string {
  return `ver_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a minimal snapshot from a full strategy
 */
export function createStrategySnapshot(strategy: CompanyStrategy): StrategySnapshot {
  // Normalize objectives
  const objectives: SnapshotObjective[] = (
    Array.isArray(strategy.objectives)
      ? strategy.objectives.map((obj) => {
          if (typeof obj === 'string') {
            return { id: `legacy_${obj.slice(0, 20)}`, text: obj };
          }
          return {
            id: obj.id,
            text: obj.text,
            metric: obj.metric,
            target: obj.target,
            timeframe: obj.timeframe,
            status: obj.status,
          };
        })
      : []
  ).sort((a, b) => a.id.localeCompare(b.id));

  // Normalize pillars
  const pillars: SnapshotPillar[] = (strategy.pillars || [])
    .map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      priority: p.priority,
      status: p.status,
      order: p.order,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  // Normalize tactics
  const tactics: SnapshotTactic[] = (strategy.plays || [])
    .map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      channels: t.channels ? [...t.channels].sort() : undefined,
      status: t.status,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  // Normalize frame
  const frame: SnapshotFrame | undefined = strategy.strategyFrame
    ? {
        audience: strategy.strategyFrame.audience || strategy.strategyFrame.targetAudience,
        offering: strategy.strategyFrame.offering || strategy.strategyFrame.primaryOffering,
        valueProp: strategy.strategyFrame.valueProp || strategy.strategyFrame.valueProposition,
        positioning: strategy.strategyFrame.positioning,
        constraints: strategy.strategyFrame.constraints,
        successMetrics: strategy.strategyFrame.successMetrics
          ? [...strategy.strategyFrame.successMetrics].sort()
          : undefined,
        nonGoals: strategy.strategyFrame.nonGoals
          ? [...strategy.strategyFrame.nonGoals].sort()
          : undefined,
      }
    : undefined;

  return {
    strategyId: strategy.id,
    goalStatement: strategy.goalStatement,
    frame,
    objectives,
    pillars,
    tactics,
    title: strategy.title,
    summary: strategy.summary,
    status: strategy.status,
  };
}

/**
 * Stable stringify for deterministic hashing
 * Sorts object keys and handles arrays consistently
 */
export function stableStringifySnapshot(snapshot: StrategySnapshot): string {
  return JSON.stringify(snapshot, (key, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Sort object keys
      return Object.keys(value)
        .sort()
        .reduce((sorted: Record<string, unknown>, k) => {
          sorted[k] = value[k];
          return sorted;
        }, {});
    }
    return value;
  });
}

/**
 * Hash a snapshot for dedup/verification
 */
export function hashSnapshot(snapshot: StrategySnapshot): string {
  const content = stableStringifySnapshot(snapshot);
  return createHash('sha256').update(content).digest('hex').substring(0, 16);
}

/**
 * Get human-readable label for diff risk flag
 */
export function getRiskFlagLabel(flag: DiffRiskFlag): string {
  const labels: Record<DiffRiskFlag, string> = {
    goal_changed: 'Goal statement changed',
    objective_removed: 'Objective removed',
    multiple_objectives_changed: 'Multiple objectives changed',
    high_priority_pillar_changed: 'High priority bet changed',
    many_tactics_changed: 'Many tactics changed',
    frame_significantly_changed: 'Strategy frame significantly changed',
  };
  return labels[flag];
}

/**
 * Get color class for impact score
 */
export function getImpactScoreColorClass(score: number): string {
  if (score >= 70) return 'bg-red-500/10 text-red-400 border-red-500/30';
  if (score >= 40) return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
  return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
}

/**
 * Get label for impact score
 */
export function getImpactScoreLabel(score: number): string {
  if (score >= 70) return 'High Impact';
  if (score >= 40) return 'Medium Impact';
  return 'Low Impact';
}

/**
 * Get color class for event trigger
 */
export function getTriggerColorClass(trigger: StrategyVersion['trigger']): string {
  const colors: Record<StrategyVersion['trigger'], string> = {
    proposal: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    rollback: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    manual: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    initial: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  };
  return colors[trigger];
}
