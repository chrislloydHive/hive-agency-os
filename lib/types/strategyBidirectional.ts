// lib/types/strategyBidirectional.ts
// Bidirectional Strategy Types for Objectives ⇄ Strategy ⇄ Tactics
//
// Core Principle:
// - Objectives define what matters
// - Strategy defines how we win
// - Tactics define what we do
//
// New information at any layer may propose changes upstream or downstream,
// always as suggestions, never silent overwrites.

import type {
  StrategyObjective,
  StrategyPillar,
  StrategyPlay,
  ImpactLevel,
  EffortLevel,
} from './strategy';

// ============================================================================
// Extended Objective Types (V6+)
// ============================================================================

/**
 * Effort size codes for quick estimation
 */
export type EffortSize = 's' | 'm' | 'l';

/**
 * Map effort size to display label
 */
export const EFFORT_SIZE_LABELS: Record<EffortSize, string> = {
  s: 'Small',
  m: 'Medium',
  l: 'Large',
};

/**
 * Map effort size to EffortLevel
 */
export function effortSizeToLevel(size: EffortSize): EffortLevel {
  switch (size) {
    case 's': return 'low';
    case 'm': return 'medium';
    case 'l': return 'high';
  }
}

/**
 * Map EffortLevel to effort size
 */
export function effortLevelToSize(level: EffortLevel): EffortSize {
  switch (level) {
    case 'low': return 's';
    case 'medium': return 'm';
    case 'high': return 'l';
  }
}

/**
 * Derivation source - where an item was derived from
 */
export interface DerivedFrom {
  /** IDs of strategies that led to this item */
  strategyIds?: string[];
  /** IDs of tactics that led to this item */
  tacticIds?: string[];
  /** IDs of objectives that led to this item */
  objectiveIds?: string[];
  /** Timestamp of derivation */
  derivedAt?: string;
  /** Reason for derivation */
  reason?: string;
}

/**
 * Extended Objective with linkage and locking
 * Extends base StrategyObjective with bidirectional support
 */
export interface StrategyObjectiveV6 extends StrategyObjective {
  /** Optional longer description */
  description?: string;
  /** Success metric for this objective */
  successMetric?: string;
  /** Whether this objective is locked from AI modification */
  isLocked?: boolean;
  /** When the objective was locked */
  lockedAt?: string;
  /** Who locked the objective */
  lockedBy?: string;
  /** Where this objective was derived from */
  derivedFrom?: DerivedFrom;
  /** Order for display */
  order?: number;
  /** Status of the objective */
  status?: 'draft' | 'active' | 'achieved' | 'deferred' | 'abandoned';
}

/**
 * Extended Priority (Pillar) with objective linkage and locking
 */
export interface StrategyPriorityV6 extends StrategyPillar {
  /** Required: linked objective IDs (every priority must serve ≥1 objective) */
  objectiveIds: string[];
  /** Whether this priority is locked from AI modification */
  isLocked?: boolean;
  /** When the priority was locked */
  lockedAt?: string;
  /** Who locked the priority */
  lockedBy?: string;
}

/**
 * Extended Tactic (Play) with full linkage and locking
 */
export interface StrategyTacticV6 extends StrategyPlay {
  /** Required: linked objective IDs (every tactic must serve ≥1 objective) */
  objectiveIds: string[];
  /** Required: linked priority IDs (every tactic must support ≥1 priority) */
  priorityIds: string[];
  /** Expected impact level */
  expectedImpact: ImpactLevel;
  /** Effort size code (s/m/l) */
  effortSize?: EffortSize;
  /** Whether this tactic is locked from AI modification */
  isLocked?: boolean;
  /** When the tactic was locked */
  lockedAt?: string;
  /** Who locked the tactic */
  lockedBy?: string;
  /** Where this tactic was derived from */
  derivedFrom?: DerivedFrom;
}

// ============================================================================
// AI Proposal System Types
// ============================================================================

/**
 * Proposal target layer
 */
export type ProposalLayer = 'objective' | 'strategy' | 'tactic';

/**
 * Proposal action type
 */
export type ProposalAction = 'add' | 'modify' | 'remove';

/**
 * Proposal confidence level
 */
export type ProposalConfidence = 'high' | 'medium' | 'low';

/**
 * Proposal source - which layer triggered this proposal
 */
export type ProposalSource =
  | 'objectives_to_strategy'
  | 'strategy_to_objectives'
  | 'tactics_to_strategy'
  | 'tactics_to_objectives'
  | 'strategy_to_tactics'
  | 'objectives_to_tactics'
  | 'user_request'
  | 'system_analysis';

/**
 * A single AI-generated proposal for strategy evolution
 * All proposals are drafts until explicitly applied
 */
export interface StrategyProposal {
  /** Unique proposal ID */
  id: string;
  /** Which layer this proposal targets */
  type: ProposalLayer;
  /** What action to take */
  action: ProposalAction;
  /** ID of the item being modified/removed (null for add) */
  targetId?: string;
  /** The proposed change data */
  proposedChange: Partial<StrategyObjectiveV6 | StrategyPriorityV6 | StrategyTacticV6>;
  /** Human-readable rationale for this proposal */
  rationale: string;
  /** AI confidence in this proposal */
  confidence: ProposalConfidence;
  /** Where this proposal originated from */
  source: ProposalSource;
  /** IDs of related items that influenced this proposal */
  relatedItemIds?: string[];
  /** When this proposal was generated */
  generatedAt: string;
  /** Whether the target item is locked (proposal cannot be auto-applied) */
  targetIsLocked?: boolean;
}

/**
 * Grouped proposals by layer for UI display
 */
export interface GroupedProposals {
  objectives: StrategyProposal[];
  strategy: StrategyProposal[];
  tactics: StrategyProposal[];
}

/**
 * AI proposal request - what to analyze and suggest
 */
export interface StrategyProposalRequest {
  companyId: string;
  strategyId: string;
  /** Which direction to analyze */
  analyzeDirection:
    | 'objectives_to_strategy'      // Suggest strategy changes based on objectives
    | 'strategy_to_objectives'      // Suggest objective refinements based on strategy
    | 'tactics_to_strategy'         // Suggest strategy changes based on tactical learnings
    | 'tactics_to_objectives'       // Suggest new objectives from tactical discoveries
    | 'strategy_to_tactics'         // Suggest tactics to implement strategy
    | 'objectives_to_tactics'       // Suggest tactics to achieve objectives
    | 'full_alignment';             // Analyze all directions
  /** Optional focus items to analyze */
  focusItemIds?: string[];
  /** Maximum proposals to return */
  maxProposals?: number;
}

/**
 * AI proposal response
 */
export interface StrategyProposalResponse {
  proposals: StrategyProposal[];
  /** Summary of the analysis */
  analysisSummary: string;
  /** Health signals detected during analysis */
  healthSignals: StrategyHealthSignals;
  /** When the analysis was performed */
  analyzedAt: string;
}

// ============================================================================
// Health Signals Types
// ============================================================================

/**
 * Strategy health signals for coverage and alignment
 */
export interface StrategyHealthSignals {
  /** Percentage of objectives with strategy coverage (0-100) */
  objectivesCovered: number;
  /** Percentage of strategy with tactical support (0-100) */
  strategySupported: number;
  /** Objectives without any strategy support */
  unsupportedObjectives: string[];
  /** Priorities without any tactical support */
  unsupportedPriorities: string[];
  /** Tactics without objective linkage */
  orphanedTactics: string[];
  /** Detected conflicts between objectives */
  conflictingObjectives: Array<{
    objectiveIds: [string, string];
    reason: string;
  }>;
  /** Tactics that may be overloaded (too many objectives) */
  overloadedTactics: Array<{
    tacticId: string;
    objectiveCount: number;
  }>;
  /** Overall health score (0-100) */
  overallHealth: number;
}

/**
 * Calculate health signals from strategy data
 */
export function calculateHealthSignals(
  objectives: StrategyObjectiveV6[],
  priorities: StrategyPriorityV6[],
  tactics: StrategyTacticV6[]
): StrategyHealthSignals {
  // Find objectives with strategy coverage
  const objectiveIdsWithCoverage = new Set<string>();
  for (const priority of priorities) {
    for (const objId of priority.objectiveIds || []) {
      objectiveIdsWithCoverage.add(objId);
    }
  }
  const unsupportedObjectives = objectives
    .filter(o => !objectiveIdsWithCoverage.has(o.id))
    .map(o => o.id);
  const objectivesCovered = objectives.length > 0
    ? Math.round(((objectives.length - unsupportedObjectives.length) / objectives.length) * 100)
    : 100;

  // Find priorities with tactical support
  const priorityIdsWithTactics = new Set<string>();
  for (const tactic of tactics) {
    for (const prioId of tactic.priorityIds || []) {
      priorityIdsWithTactics.add(prioId);
    }
  }
  const unsupportedPriorities = priorities
    .filter(p => !priorityIdsWithTactics.has(p.id))
    .map(p => p.id);
  const strategySupported = priorities.length > 0
    ? Math.round(((priorities.length - unsupportedPriorities.length) / priorities.length) * 100)
    : 100;

  // Find orphaned tactics (no objective linkage)
  const orphanedTactics = tactics
    .filter(t => !t.objectiveIds || t.objectiveIds.length === 0)
    .map(t => t.id);

  // Find overloaded tactics (>3 objectives)
  const overloadedTactics = tactics
    .filter(t => (t.objectiveIds?.length || 0) > 3)
    .map(t => ({
      tacticId: t.id,
      objectiveCount: t.objectiveIds?.length || 0,
    }));

  // Calculate overall health score
  const healthFactors = [
    objectivesCovered,
    strategySupported,
    Math.max(0, 100 - (orphanedTactics.length * 10)),
    Math.max(0, 100 - (overloadedTactics.length * 15)),
  ];
  const overallHealth = Math.round(
    healthFactors.reduce((sum, f) => sum + f, 0) / healthFactors.length
  );

  return {
    objectivesCovered,
    strategySupported,
    unsupportedObjectives,
    unsupportedPriorities,
    orphanedTactics,
    conflictingObjectives: [], // Requires semantic analysis
    overloadedTactics,
    overallHealth,
  };
}

// ============================================================================
// Locking Helpers
// ============================================================================

/**
 * Lock an item (objective, priority, or tactic)
 */
export function lockItem<T extends { isLocked?: boolean; lockedAt?: string; lockedBy?: string }>(
  item: T,
  lockedBy?: string
): T {
  return {
    ...item,
    isLocked: true,
    lockedAt: new Date().toISOString(),
    lockedBy,
  };
}

/**
 * Unlock an item
 */
export function unlockItem<T extends { isLocked?: boolean; lockedAt?: string; lockedBy?: string }>(
  item: T
): T {
  const { isLocked: _isLocked, lockedAt: _lockedAt, lockedBy: _lockedBy, ...rest } = item;
  return rest as T;
}

/**
 * Check if an item is locked
 */
export function isItemLocked(item: { isLocked?: boolean }): boolean {
  return item.isLocked === true;
}

// ============================================================================
// Conversion Helpers
// ============================================================================

/**
 * Convert base StrategyObjective to V6 format
 */
export function toObjectiveV6(objective: StrategyObjective): StrategyObjectiveV6 {
  return {
    ...objective,
    description: undefined,
    successMetric: objective.metric,
    isLocked: false,
  };
}

/**
 * Convert base StrategyPillar to PriorityV6 format
 */
export function toPriorityV6(pillar: StrategyPillar, objectiveIds: string[] = []): StrategyPriorityV6 {
  return {
    ...pillar,
    objectiveIds,
    isLocked: false,
  };
}

/**
 * Convert base StrategyPlay to TacticV6 format
 */
export function toTacticV6(
  play: StrategyPlay,
  objectiveIds?: string[],
  priorityIds?: string[]
): StrategyTacticV6 {
  // Resolve objective IDs
  const resolvedObjectiveIds = objectiveIds ||
    (play.objectiveIds && play.objectiveIds.length > 0 ? play.objectiveIds : undefined) ||
    (play.objectiveId ? [play.objectiveId] : []);

  // Resolve priority IDs
  const resolvedPriorityIds = priorityIds ||
    (play.priorityIds && play.priorityIds.length > 0 ? play.priorityIds : undefined) ||
    (play.priorityId ? [play.priorityId] : []);

  return {
    ...play,
    objectiveIds: resolvedObjectiveIds,
    priorityIds: resolvedPriorityIds,
    expectedImpact: play.impact || 'medium',
    effortSize: play.effort ? effortLevelToSize(play.effort) : 'm',
    isLocked: false,
  };
}

// ============================================================================
// Proposal Helpers
// ============================================================================

/**
 * Generate a unique proposal ID
 */
export function generateProposalId(): string {
  return `prop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Group proposals by layer for UI display
 */
export function groupProposalsByLayer(proposals: StrategyProposal[]): GroupedProposals {
  return {
    objectives: proposals.filter(p => p.type === 'objective'),
    strategy: proposals.filter(p => p.type === 'strategy'),
    tactics: proposals.filter(p => p.type === 'tactic'),
  };
}

/**
 * Filter proposals that can be applied (target not locked)
 */
export function getApplicableProposals(proposals: StrategyProposal[]): StrategyProposal[] {
  return proposals.filter(p => !p.targetIsLocked);
}

/**
 * Filter proposals that require unlock
 */
export function getLockedProposals(proposals: StrategyProposal[]): StrategyProposal[] {
  return proposals.filter(p => p.targetIsLocked);
}

/**
 * Create a proposal for adding a new objective
 */
export function createAddObjectiveProposal(
  objective: Partial<StrategyObjectiveV6>,
  rationale: string,
  source: ProposalSource,
  confidence: ProposalConfidence = 'medium'
): StrategyProposal {
  return {
    id: generateProposalId(),
    type: 'objective',
    action: 'add',
    proposedChange: objective,
    rationale,
    confidence,
    source,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Create a proposal for modifying an objective
 */
export function createModifyObjectiveProposal(
  targetId: string,
  changes: Partial<StrategyObjectiveV6>,
  rationale: string,
  source: ProposalSource,
  confidence: ProposalConfidence = 'medium',
  isLocked = false
): StrategyProposal {
  return {
    id: generateProposalId(),
    type: 'objective',
    action: 'modify',
    targetId,
    proposedChange: changes,
    rationale,
    confidence,
    source,
    generatedAt: new Date().toISOString(),
    targetIsLocked: isLocked,
  };
}

/**
 * Create a proposal for adding a new tactic
 */
export function createAddTacticProposal(
  tactic: Partial<StrategyTacticV6>,
  rationale: string,
  source: ProposalSource,
  confidence: ProposalConfidence = 'medium'
): StrategyProposal {
  return {
    id: generateProposalId(),
    type: 'tactic',
    action: 'add',
    proposedChange: tactic,
    rationale,
    confidence,
    source,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Create a proposal for modifying a priority
 */
export function createModifyPriorityProposal(
  targetId: string,
  changes: Partial<StrategyPriorityV6>,
  rationale: string,
  source: ProposalSource,
  confidence: ProposalConfidence = 'medium',
  isLocked = false
): StrategyProposal {
  return {
    id: generateProposalId(),
    type: 'strategy',
    action: 'modify',
    targetId,
    proposedChange: changes,
    rationale,
    confidence,
    source,
    generatedAt: new Date().toISOString(),
    targetIsLocked: isLocked,
  };
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate that a priority has required objective linkage
 */
export function validatePriorityLinkage(priority: StrategyPriorityV6): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (!priority.objectiveIds || priority.objectiveIds.length === 0) {
    issues.push('Priority must be linked to at least one objective');
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Validate that a tactic has required linkages
 */
export function validateTacticLinkage(tactic: StrategyTacticV6): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (!tactic.objectiveIds || tactic.objectiveIds.length === 0) {
    issues.push('Tactic must be linked to at least one objective');
  }

  if (!tactic.priorityIds || tactic.priorityIds.length === 0) {
    issues.push('Tactic must be linked to at least one priority');
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Validate full strategy alignment
 */
export function validateStrategyAlignment(
  objectives: StrategyObjectiveV6[],
  priorities: StrategyPriorityV6[],
  tactics: StrategyTacticV6[]
): {
  valid: boolean;
  issues: string[];
  warnings: string[];
} {
  const issues: string[] = [];
  const warnings: string[] = [];

  // Check all priorities have objective linkage
  for (const priority of priorities) {
    const validation = validatePriorityLinkage(priority);
    if (!validation.valid) {
      issues.push(`Priority "${priority.title}": ${validation.issues.join(', ')}`);
    }
  }

  // Check all tactics have required linkages
  for (const tactic of tactics) {
    const validation = validateTacticLinkage(tactic);
    if (!validation.valid) {
      issues.push(`Tactic "${tactic.title}": ${validation.issues.join(', ')}`);
    }
  }

  // Check for orphaned objectives (warning, not error)
  const coveredObjectiveIds = new Set<string>();
  for (const priority of priorities) {
    for (const objId of priority.objectiveIds || []) {
      coveredObjectiveIds.add(objId);
    }
  }
  for (const objective of objectives) {
    if (!coveredObjectiveIds.has(objective.id)) {
      warnings.push(`Objective "${objective.text}" has no strategy support`);
    }
  }

  // Check for unsupported priorities (warning)
  const supportedPriorityIds = new Set<string>();
  for (const tactic of tactics) {
    for (const prioId of tactic.priorityIds || []) {
      supportedPriorityIds.add(prioId);
    }
  }
  for (const priority of priorities) {
    if (!supportedPriorityIds.has(priority.id)) {
      warnings.push(`Priority "${priority.title}" has no tactical support`);
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings,
  };
}
