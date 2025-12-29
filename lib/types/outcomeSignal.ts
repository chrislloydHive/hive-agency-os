// lib/types/outcomeSignal.ts
// Outcome Signal Model - Read-only learning layer for strategy feedback
//
// Design principle: Signals are observations, not actions.
// They surface insights and inform retrospectives but never mutate strategy.
// All signal generation is deterministic and explainable (no ML/probabilistic inference).

// ============================================================================
// Core Types
// ============================================================================

/**
 * Source of the outcome signal
 */
export type OutcomeSignalSource =
  | 'artifact'    // Signal derived from artifact usage/completion
  | 'work'        // Signal derived from work item outcomes
  | 'experiment'  // Signal from experiment results (future)
  | 'manual';     // Manually recorded learning

/**
 * Type of signal - what kind of outcome occurred
 */
export type OutcomeSignalType =
  | 'completed'    // Work/artifact fully executed
  | 'abandoned'    // Started but not completed
  | 'high-impact'  // Positive outcome with evidence
  | 'low-impact'   // Executed but limited effect
  | 'learning';    // Insight gained (positive or negative)

/**
 * Confidence level in the signal
 */
export type OutcomeSignalConfidence = 'low' | 'medium' | 'high';

/**
 * An outcome signal - a read-only observation about strategy execution
 */
export interface OutcomeSignal {
  /** Unique signal identifier */
  id: string;

  /** Where this signal came from */
  source: OutcomeSignalSource;

  /** ID of the source entity (artifact, work item, etc.) */
  sourceId: string;

  /** Type of outcome observed */
  signalType: OutcomeSignalType;

  /** Confidence in this signal */
  confidence: OutcomeSignalConfidence;

  /** Human-readable summary of the outcome */
  summary: string;

  /** Supporting evidence or data points */
  evidence?: string[];

  /** When this signal was generated */
  createdAt: string;

  // ---------------------------------------------------------------------------
  // Strategy Linkage (for filtering/grouping)
  // ---------------------------------------------------------------------------

  /** Linked strategy ID (if applicable) */
  strategyId?: string;

  /** Linked tactic IDs (if applicable) */
  tacticIds?: string[];

  /** Linked objective IDs (if applicable) */
  objectiveIds?: string[];

  /** Artifact type that generated this signal */
  artifactType?: string;
}

// ============================================================================
// Signal Derivation Context
// ============================================================================

/**
 * Context needed to derive signals from an artifact
 */
export interface ArtifactSignalContext {
  /** Artifact ID */
  artifactId: string;

  /** Artifact type */
  artifactType: string;

  /** Artifact title */
  artifactTitle: string;

  /** Artifact status */
  artifactStatus: 'draft' | 'final' | 'archived';

  /** Number of work items created from this artifact */
  workItemsCreated: number;

  /** Number of those work items completed */
  workItemsCompleted: number;

  /** Days since artifact was created */
  daysSinceCreation: number;

  /** Feedback ratings received */
  feedbackRatings: {
    helpful: number;
    neutral: number;
    not_helpful: number;
  };

  /** Strategy ID (if linked) */
  strategyId?: string;

  /** Linked tactic IDs */
  tacticIds?: string[];
}

/**
 * Context needed to derive signals from work items
 */
export interface WorkSignalContext {
  /** Work item ID */
  workItemId: string;

  /** Work item title */
  workItemTitle: string;

  /** Work item status */
  workItemStatus: 'Backlog' | 'Planned' | 'In Progress' | 'Done';

  /** Days since work was created */
  daysSinceCreation: number;

  /** Days in current status */
  daysInCurrentStatus: number;

  /** Source artifact ID (if from artifact conversion) */
  sourceArtifactId?: string;

  /** Strategy ID (if linked) */
  strategyId?: string;

  /** Linked tactic IDs */
  tacticIds?: string[];
}

// ============================================================================
// Aggregated Outcomes
// ============================================================================

/**
 * Aggregated outcome summary for a strategy
 */
export interface StrategyOutcomeSummary {
  /** Strategy ID */
  strategyId: string;

  /** Total signals for this strategy */
  totalSignals: number;

  /** Breakdown by signal type */
  byType: Record<OutcomeSignalType, number>;

  /** Top learnings (highest confidence) */
  topLearnings: OutcomeSignal[];

  /** High-impact outcomes */
  highImpactOutcomes: OutcomeSignal[];

  /** Areas needing attention (low-impact or abandoned) */
  areasNeedingAttention: OutcomeSignal[];
}

/**
 * Aggregated outcome for an artifact type
 */
export interface ArtifactTypeOutcome {
  /** Artifact type */
  artifactType: string;

  /** Total artifacts of this type */
  totalArtifacts: number;

  /** Artifacts with signals */
  artifactsWithSignals: number;

  /** Average completion rate */
  averageCompletionRate: number;

  /** Predominant signal type */
  predominantSignalType: OutcomeSignalType | null;

  /** Key learnings */
  learnings: string[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique signal ID
 */
export function generateSignalId(): string {
  return `sig_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get human-readable label for signal type
 */
export function getSignalTypeLabel(type: OutcomeSignalType): string {
  const labels: Record<OutcomeSignalType, string> = {
    'completed': 'Completed',
    'abandoned': 'Abandoned',
    'high-impact': 'High Impact',
    'low-impact': 'Low Impact',
    'learning': 'Learning',
  };
  return labels[type];
}

/**
 * Get color class for signal type
 */
export function getSignalTypeColorClass(type: OutcomeSignalType): string {
  const colors: Record<OutcomeSignalType, string> = {
    'completed': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    'abandoned': 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    'high-impact': 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    'low-impact': 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    'learning': 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  };
  return colors[type];
}

/**
 * Get color class for confidence level
 */
export function getConfidenceColorClass(confidence: OutcomeSignalConfidence): string {
  const colors: Record<OutcomeSignalConfidence, string> = {
    'low': 'text-slate-500',
    'medium': 'text-amber-400',
    'high': 'text-emerald-400',
  };
  return colors[confidence];
}

/**
 * Get icon name for signal type
 */
export function getSignalTypeIcon(type: OutcomeSignalType): 'check' | 'x' | 'star' | 'minus' | 'lightbulb' {
  const icons: Record<OutcomeSignalType, 'check' | 'x' | 'star' | 'minus' | 'lightbulb'> = {
    'completed': 'check',
    'abandoned': 'x',
    'high-impact': 'star',
    'low-impact': 'minus',
    'learning': 'lightbulb',
  };
  return icons[type];
}

/**
 * Check if a signal indicates positive outcome
 */
export function isPositiveSignal(signal: OutcomeSignal): boolean {
  return signal.signalType === 'completed' || signal.signalType === 'high-impact';
}

/**
 * Check if a signal indicates area for improvement
 */
export function isImprovementSignal(signal: OutcomeSignal): boolean {
  return signal.signalType === 'abandoned' || signal.signalType === 'low-impact';
}

/**
 * Sort signals by confidence (high first) then by date (newest first)
 */
export function sortSignalsByRelevance(signals: OutcomeSignal[]): OutcomeSignal[] {
  const confidenceOrder: Record<OutcomeSignalConfidence, number> = {
    'high': 0,
    'medium': 1,
    'low': 2,
  };

  return [...signals].sort((a, b) => {
    // First by confidence
    const confDiff = confidenceOrder[a.confidence] - confidenceOrder[b.confidence];
    if (confDiff !== 0) return confDiff;

    // Then by date (newest first)
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}
