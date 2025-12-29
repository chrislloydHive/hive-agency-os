// lib/types/strategyRevision.ts
// Strategy Revision Proposal Model - Guided strategy edits from learnings
//
// Design principle: Proposals are drafts (never auto-applied).
// Users explicitly apply or reject each one. Everything has provenance.
// This is a "human-in-the-loop editor," not an autonomous optimizer.

// ============================================================================
// Core Types
// ============================================================================

/**
 * Target areas for strategy revision
 */
export type StrategyRevisionTarget =
  | 'goalStatement'
  | 'audience'
  | 'valueProp'
  | 'positioning'
  | 'constraints'
  | 'objectives'
  | 'strategicBets'
  | 'tactics';

/**
 * Action to take on the target
 */
export type StrategyRevisionAction = 'add' | 'update' | 'remove';

/**
 * A single change within a revision proposal
 */
export interface StrategyRevisionChange {
  /** What part of strategy to change */
  target: StrategyRevisionTarget;

  /** Action to take */
  action: StrategyRevisionAction;

  /** Path for list items: e.g., "objectives[1]", "tactics[tacticId]", "bets[2]" */
  path?: string;

  /** Current value (before change) */
  before?: unknown;

  /** Proposed value (after change) */
  after?: unknown;

  /** Human-readable description of this change */
  description?: string;
}

/**
 * Confidence level for a revision proposal
 */
export type RevisionConfidence = 'low' | 'medium' | 'high';

/**
 * Status of a revision proposal
 */
export type RevisionProposalStatus = 'draft' | 'applied' | 'rejected';

/**
 * A strategy revision proposal - a suggested edit based on outcome signals
 */
export interface StrategyRevisionProposal {
  /** Unique proposal identifier */
  id: string;

  /** Company this proposal is for */
  companyId: string;

  /** Strategy this proposal targets */
  strategyId: string;

  /** Short title describing the revision */
  title: string;

  /** Detailed summary of what this revision addresses */
  summary: string;

  // ---------------------------------------------------------------------------
  // Grounding & Evidence
  // ---------------------------------------------------------------------------

  /** IDs of outcome signals that triggered this proposal */
  signalIds: string[];

  /** Short evidence snippets or links */
  evidence: string[];

  /** Confidence in this proposal */
  confidence: RevisionConfidence;

  // ---------------------------------------------------------------------------
  // Changes
  // ---------------------------------------------------------------------------

  /** List of changes this proposal would make */
  changes: StrategyRevisionChange[];

  // ---------------------------------------------------------------------------
  // Status & Lifecycle
  // ---------------------------------------------------------------------------

  /** Current status of the proposal */
  status: RevisionProposalStatus;

  /** When this proposal was created */
  createdAt: string;

  /** When this proposal was applied (if applied) */
  appliedAt?: string;

  /** When this proposal was rejected (if rejected) */
  rejectedAt?: string;

  /** User who applied/rejected (if any) */
  decidedBy?: string;

  /** Reason for rejection (if rejected) */
  rejectionReason?: string;
}

// ============================================================================
// Generation Context
// ============================================================================

/**
 * Context for generating revision proposals
 */
export interface RevisionGenerationContext {
  /** Company ID */
  companyId: string;

  /** Strategy ID */
  strategyId: string;

  /** Current strategy state */
  currentStrategy: {
    goalStatement?: string;
    audience?: string;
    valueProp?: string;
    positioning?: string;
    constraints?: string;
    objectives: Array<{ id: string; text: string; status?: string }>;
    bets: Array<{ id: string; title: string; status?: string }>;
    tactics: Array<{ id: string; title: string; channels?: string[]; status?: string }>;
  };

  /** Outcome signals to consider */
  signals: Array<{
    id: string;
    signalType: string;
    confidence: string;
    summary: string;
    evidence?: string[];
    tacticIds?: string[];
    objectiveIds?: string[];
    strategyId?: string;
  }>;

  /** Whether strategy is incomplete (missing core fields) */
  isIncomplete: boolean;

  /** Which core fields are missing */
  missingFields: string[];
}

// ============================================================================
// Generation Rules
// ============================================================================

/**
 * A rule for generating revision proposals
 */
export interface RevisionRule {
  /** Unique rule identifier */
  id: string;

  /** Human-readable rule name */
  name: string;

  /** Which signal types trigger this rule */
  triggerSignalTypes: string[];

  /** Minimum signals needed to trigger */
  minSignalCount: number;

  /** Which target this rule affects */
  target: StrategyRevisionTarget;

  /** Default action for this rule */
  defaultAction: StrategyRevisionAction;

  /** Whether this rule can affect goalStatement (requires high confidence) */
  canAffectGoal?: boolean;

  /** Minimum confidence for high-impact changes */
  minConfidenceForHighImpact?: RevisionConfidence;
}

// ============================================================================
// API Types
// ============================================================================

/**
 * Request to generate revision proposals
 */
export interface GenerateRevisionsRequest {
  strategyId: string;
}

/**
 * Response from generating revision proposals
 */
export interface GenerateRevisionsResponse {
  proposals: StrategyRevisionProposal[];
  signalsUsed: string[];
  rulesApplied: string[];
}

/**
 * Request to apply a revision proposal
 */
export interface ApplyRevisionRequest {
  proposalId: string;
  /** Optional: force apply even with pending changes */
  forceApply?: boolean;
}

/**
 * Response from applying a revision proposal
 */
export interface ApplyRevisionResponse {
  success: boolean;
  proposal: StrategyRevisionProposal;
  changesApplied: number;
  strategyUpdated: boolean;
}

/**
 * Request to reject a revision proposal
 */
export interface RejectRevisionRequest {
  proposalId: string;
  reason?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique proposal ID
 */
export function generateProposalId(): string {
  return `rev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get human-readable label for revision target
 */
export function getRevisionTargetLabel(target: StrategyRevisionTarget): string {
  const labels: Record<StrategyRevisionTarget, string> = {
    goalStatement: 'Goal Statement',
    audience: 'Target Audience',
    valueProp: 'Value Proposition',
    positioning: 'Positioning',
    constraints: 'Constraints',
    objectives: 'Objectives',
    strategicBets: 'Strategic Bets',
    tactics: 'Tactics',
  };
  return labels[target];
}

/**
 * Get human-readable label for revision action
 */
export function getRevisionActionLabel(action: StrategyRevisionAction): string {
  const labels: Record<StrategyRevisionAction, string> = {
    add: 'Add',
    update: 'Update',
    remove: 'Remove',
  };
  return labels[action];
}

/**
 * Get color class for confidence level
 */
export function getConfidenceColorClass(confidence: RevisionConfidence): string {
  const colors: Record<RevisionConfidence, string> = {
    low: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    medium: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    high: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  };
  return colors[confidence];
}

/**
 * Get color class for proposal status
 */
export function getStatusColorClass(status: RevisionProposalStatus): string {
  const colors: Record<RevisionProposalStatus, string> = {
    draft: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    applied: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    rejected: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  };
  return colors[status];
}

/**
 * Check if a proposal affects high-impact areas (goal, objectives)
 */
export function isHighImpactProposal(proposal: StrategyRevisionProposal): boolean {
  return proposal.changes.some(
    change =>
      change.target === 'goalStatement' ||
      change.target === 'objectives' ||
      (change.action === 'remove' && change.target !== 'tactics')
  );
}

/**
 * Check if a proposal includes any deletions
 */
export function hasRemovalChanges(proposal: StrategyRevisionProposal): boolean {
  return proposal.changes.some(change => change.action === 'remove');
}

/**
 * Sort proposals by confidence (high first) then by impact
 */
export function sortProposalsByRelevance(
  proposals: StrategyRevisionProposal[]
): StrategyRevisionProposal[] {
  const confidenceOrder: Record<RevisionConfidence, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };

  return [...proposals].sort((a, b) => {
    // High-impact proposals first
    const aHighImpact = isHighImpactProposal(a) ? 0 : 1;
    const bHighImpact = isHighImpactProposal(b) ? 0 : 1;
    if (aHighImpact !== bHighImpact) return aHighImpact - bHighImpact;

    // Then by confidence
    return confidenceOrder[a.confidence] - confidenceOrder[b.confidence];
  });
}
