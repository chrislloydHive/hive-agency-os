// lib/os/outcomes/generateSignals.ts
// Deterministic Signal Generation - Rule-based, explainable outcome signals
//
// Design principle: No ML, no probabilistic inference.
// All rules are explicit and auditable.
// Signals are derived from concrete data points, not predictions.

import type {
  OutcomeSignal,
  OutcomeSignalType,
  OutcomeSignalConfidence,
  ArtifactSignalContext,
  WorkSignalContext,
} from '@/lib/types/outcomeSignal';
import { generateSignalId } from '@/lib/types/outcomeSignal';

// Re-export types for test access
export type { ArtifactSignalContext, WorkSignalContext } from '@/lib/types/outcomeSignal';

// ============================================================================
// Configuration Constants
// ============================================================================

/**
 * Thresholds for signal generation
 * All values are explicit and can be adjusted without code changes
 */
export const SIGNAL_THRESHOLDS = {
  /** Days without completion before considering work stalled */
  STALL_DAYS: 30,

  /** Days without activity before considering abandoned */
  ABANDON_DAYS: 60,

  /** Minimum feedback count for feedback-based signals */
  MIN_FEEDBACK_COUNT: 3,

  /** Helpful rating ratio for high-impact (e.g., 0.7 = 70% helpful) */
  HIGH_IMPACT_RATING_RATIO: 0.7,

  /** Not helpful ratio for low-impact signals */
  LOW_IMPACT_RATING_RATIO: 0.5,

  /** Completion rate for considering artifact fully executed */
  FULL_EXECUTION_RATE: 1.0,

  /** Completion rate threshold for partial execution */
  PARTIAL_EXECUTION_RATE: 0.5,
} as const;

// ============================================================================
// Artifact Signal Generation
// ============================================================================

/**
 * Generate signals from artifact context
 * Rule-based, deterministic signal generation
 */
export function generateArtifactSignals(context: ArtifactSignalContext): OutcomeSignal[] {
  const signals: OutcomeSignal[] = [];
  const now = new Date().toISOString();

  // Skip draft artifacts - they haven't been executed yet
  if (context.artifactStatus === 'draft') {
    return signals;
  }

  // ---------------------------------------------------------------------------
  // Rule 1: Completion Signals
  // ---------------------------------------------------------------------------
  if (context.workItemsCreated > 0) {
    const completionRate = context.workItemsCompleted / context.workItemsCreated;

    if (completionRate >= SIGNAL_THRESHOLDS.FULL_EXECUTION_RATE) {
      // All work completed
      signals.push({
        id: generateSignalId(),
        source: 'artifact',
        sourceId: context.artifactId,
        signalType: 'completed',
        confidence: 'high',
        summary: `All ${context.workItemsCompleted} work items from "${context.artifactTitle}" completed.`,
        evidence: [
          `${context.workItemsCompleted}/${context.workItemsCreated} work items done`,
          `Artifact type: ${context.artifactType}`,
        ],
        createdAt: now,
        strategyId: context.strategyId,
        tacticIds: context.tacticIds,
        artifactType: context.artifactType,
      });
    } else if (
      completionRate >= SIGNAL_THRESHOLDS.PARTIAL_EXECUTION_RATE &&
      context.daysSinceCreation > SIGNAL_THRESHOLDS.STALL_DAYS
    ) {
      // Partial completion, stalled
      signals.push({
        id: generateSignalId(),
        source: 'artifact',
        sourceId: context.artifactId,
        signalType: 'learning',
        confidence: 'medium',
        summary: `"${context.artifactTitle}" partially executed (${Math.round(completionRate * 100)}%). Consider reviewing remaining items.`,
        evidence: [
          `${context.workItemsCompleted}/${context.workItemsCreated} work items completed`,
          `${context.daysSinceCreation} days since creation`,
          `${context.workItemsCreated - context.workItemsCompleted} items remaining`,
        ],
        createdAt: now,
        strategyId: context.strategyId,
        tacticIds: context.tacticIds,
        artifactType: context.artifactType,
      });
    } else if (
      completionRate < SIGNAL_THRESHOLDS.PARTIAL_EXECUTION_RATE &&
      context.daysSinceCreation > SIGNAL_THRESHOLDS.ABANDON_DAYS
    ) {
      // Low completion after long time - abandoned
      signals.push({
        id: generateSignalId(),
        source: 'artifact',
        sourceId: context.artifactId,
        signalType: 'abandoned',
        confidence: 'medium',
        summary: `"${context.artifactTitle}" appears abandoned. Only ${Math.round(completionRate * 100)}% executed after ${context.daysSinceCreation} days.`,
        evidence: [
          `${context.workItemsCompleted}/${context.workItemsCreated} work items completed`,
          `${context.daysSinceCreation} days since creation`,
        ],
        createdAt: now,
        strategyId: context.strategyId,
        tacticIds: context.tacticIds,
        artifactType: context.artifactType,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Rule 2: Feedback-Based Signals
  // ---------------------------------------------------------------------------
  const totalFeedback =
    context.feedbackRatings.helpful +
    context.feedbackRatings.neutral +
    context.feedbackRatings.not_helpful;

  if (totalFeedback >= SIGNAL_THRESHOLDS.MIN_FEEDBACK_COUNT) {
    const helpfulRatio = context.feedbackRatings.helpful / totalFeedback;
    const notHelpfulRatio = context.feedbackRatings.not_helpful / totalFeedback;

    if (helpfulRatio >= SIGNAL_THRESHOLDS.HIGH_IMPACT_RATING_RATIO) {
      // High helpful ratings + execution = high impact
      const hasExecution = context.workItemsCompleted > 0;
      signals.push({
        id: generateSignalId(),
        source: 'artifact',
        sourceId: context.artifactId,
        signalType: hasExecution ? 'high-impact' : 'learning',
        confidence: hasExecution ? 'high' : 'medium',
        summary: hasExecution
          ? `"${context.artifactTitle}" rated highly helpful and executed successfully.`
          : `"${context.artifactTitle}" rated highly helpful. Consider converting to work.`,
        evidence: [
          `${Math.round(helpfulRatio * 100)}% helpful ratings (${totalFeedback} total)`,
          hasExecution ? `${context.workItemsCompleted} work items completed` : 'Not yet executed',
        ],
        createdAt: now,
        strategyId: context.strategyId,
        tacticIds: context.tacticIds,
        artifactType: context.artifactType,
      });
    } else if (notHelpfulRatio >= SIGNAL_THRESHOLDS.LOW_IMPACT_RATING_RATIO) {
      // High not-helpful ratings = learning opportunity
      signals.push({
        id: generateSignalId(),
        source: 'artifact',
        sourceId: context.artifactId,
        signalType: 'learning',
        confidence: 'medium',
        summary: `"${context.artifactTitle}" received mixed/negative feedback. Review approach for this artifact type.`,
        evidence: [
          `${Math.round(notHelpfulRatio * 100)}% not helpful ratings`,
          `${totalFeedback} total feedback entries`,
          `Artifact type: ${context.artifactType}`,
        ],
        createdAt: now,
        strategyId: context.strategyId,
        tacticIds: context.tacticIds,
        artifactType: context.artifactType,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Rule 3: No Execution Signal
  // ---------------------------------------------------------------------------
  if (
    context.workItemsCreated === 0 &&
    context.daysSinceCreation > SIGNAL_THRESHOLDS.STALL_DAYS &&
    context.artifactStatus === 'final'
  ) {
    signals.push({
      id: generateSignalId(),
      source: 'artifact',
      sourceId: context.artifactId,
      signalType: 'low-impact',
      confidence: 'low',
      summary: `"${context.artifactTitle}" finalized but never converted to work after ${context.daysSinceCreation} days.`,
      evidence: [
        'No work items created',
        `${context.daysSinceCreation} days since creation`,
        'Status: Final',
      ],
      createdAt: now,
      strategyId: context.strategyId,
      tacticIds: context.tacticIds,
      artifactType: context.artifactType,
    });
  }

  return signals;
}

// ============================================================================
// Work Signal Generation
// ============================================================================

/**
 * Generate signals from work item context
 * Rule-based, deterministic signal generation
 */
export function generateWorkSignals(context: WorkSignalContext): OutcomeSignal[] {
  const signals: OutcomeSignal[] = [];
  const now = new Date().toISOString();

  // ---------------------------------------------------------------------------
  // Rule 1: Completion Signal
  // ---------------------------------------------------------------------------
  if (context.workItemStatus === 'Done') {
    const confidence: OutcomeSignalConfidence =
      context.daysSinceCreation <= 14 ? 'high' : // Quick completion
      context.daysSinceCreation <= 30 ? 'medium' : // Reasonable timeline
      'low'; // Took a long time

    signals.push({
      id: generateSignalId(),
      source: 'work',
      sourceId: context.workItemId,
      signalType: 'completed',
      confidence,
      summary: `"${context.workItemTitle}" completed${context.daysSinceCreation <= 14 ? ' quickly' : ''}.`,
      evidence: [
        `Completed in ${context.daysSinceCreation} days`,
        context.sourceArtifactId ? `From artifact: ${context.sourceArtifactId}` : 'Manual work item',
      ],
      createdAt: now,
      strategyId: context.strategyId,
      tacticIds: context.tacticIds,
    });
  }

  // ---------------------------------------------------------------------------
  // Rule 2: Stalled Work Signal
  // ---------------------------------------------------------------------------
  if (
    context.workItemStatus === 'In Progress' &&
    context.daysInCurrentStatus > SIGNAL_THRESHOLDS.STALL_DAYS
  ) {
    signals.push({
      id: generateSignalId(),
      source: 'work',
      sourceId: context.workItemId,
      signalType: 'learning',
      confidence: 'medium',
      summary: `"${context.workItemTitle}" has been in progress for ${context.daysInCurrentStatus} days. May need attention.`,
      evidence: [
        `${context.daysInCurrentStatus} days in "In Progress"`,
        `Total age: ${context.daysSinceCreation} days`,
      ],
      createdAt: now,
      strategyId: context.strategyId,
      tacticIds: context.tacticIds,
    });
  }

  // ---------------------------------------------------------------------------
  // Rule 3: Abandoned Backlog Signal
  // ---------------------------------------------------------------------------
  if (
    context.workItemStatus === 'Backlog' &&
    context.daysSinceCreation > SIGNAL_THRESHOLDS.ABANDON_DAYS
  ) {
    signals.push({
      id: generateSignalId(),
      source: 'work',
      sourceId: context.workItemId,
      signalType: 'abandoned',
      confidence: 'low',
      summary: `"${context.workItemTitle}" has been in backlog for ${context.daysSinceCreation} days. Consider archiving or reprioritizing.`,
      evidence: [
        `${context.daysSinceCreation} days in backlog`,
        'Never started',
      ],
      createdAt: now,
      strategyId: context.strategyId,
      tacticIds: context.tacticIds,
    });
  }

  return signals;
}

// ============================================================================
// Batch Signal Generation
// ============================================================================

/**
 * Generate signals for multiple artifacts
 */
export function generateBatchArtifactSignals(
  contexts: ArtifactSignalContext[]
): OutcomeSignal[] {
  const allSignals: OutcomeSignal[] = [];

  for (const context of contexts) {
    const signals = generateArtifactSignals(context);
    allSignals.push(...signals);
  }

  return allSignals;
}

/**
 * Generate signals for multiple work items
 */
export function generateBatchWorkSignals(
  contexts: WorkSignalContext[]
): OutcomeSignal[] {
  const allSignals: OutcomeSignal[] = [];

  for (const context of contexts) {
    const signals = generateWorkSignals(context);
    allSignals.push(...signals);
  }

  return allSignals;
}

// ============================================================================
// Signal Deduplication
// ============================================================================

/**
 * Deduplicate signals by source ID and type
 * Keeps the most recent signal for each unique source+type combination
 */
export function deduplicateSignals(signals: OutcomeSignal[]): OutcomeSignal[] {
  const seen = new Map<string, OutcomeSignal>();

  for (const signal of signals) {
    const key = `${signal.source}:${signal.sourceId}:${signal.signalType}`;
    const existing = seen.get(key);

    if (!existing || new Date(signal.createdAt) > new Date(existing.createdAt)) {
      seen.set(key, signal);
    }
  }

  return Array.from(seen.values());
}

// ============================================================================
// Confidence Calculation
// ============================================================================

/**
 * Calculate confidence based on evidence strength
 */
export function calculateConfidence(
  factors: {
    hasExecution?: boolean;
    completionRate?: number;
    feedbackCount?: number;
    daysSinceAction?: number;
  }
): OutcomeSignalConfidence {
  let score = 0;

  // Execution adds confidence
  if (factors.hasExecution) score += 2;

  // High completion rate adds confidence
  if (factors.completionRate !== undefined) {
    if (factors.completionRate >= 0.9) score += 2;
    else if (factors.completionRate >= 0.5) score += 1;
  }

  // More feedback adds confidence
  if (factors.feedbackCount !== undefined) {
    if (factors.feedbackCount >= 10) score += 2;
    else if (factors.feedbackCount >= 5) score += 1;
  }

  // Recency adds confidence
  if (factors.daysSinceAction !== undefined) {
    if (factors.daysSinceAction <= 7) score += 1;
    else if (factors.daysSinceAction > 30) score -= 1;
  }

  if (score >= 4) return 'high';
  if (score >= 2) return 'medium';
  return 'low';
}

// ============================================================================
// Signal Summary Generation
// ============================================================================

/**
 * Generate a human-readable summary for a set of signals
 */
export function generateSignalsSummary(signals: OutcomeSignal[]): string {
  if (signals.length === 0) {
    return 'No outcome signals yet.';
  }

  const completed = signals.filter(s => s.signalType === 'completed').length;
  const highImpact = signals.filter(s => s.signalType === 'high-impact').length;
  const learnings = signals.filter(s => s.signalType === 'learning').length;
  const lowImpact = signals.filter(s => s.signalType === 'low-impact').length;
  const abandoned = signals.filter(s => s.signalType === 'abandoned').length;

  const parts: string[] = [];

  if (completed > 0) parts.push(`${completed} completed`);
  if (highImpact > 0) parts.push(`${highImpact} high-impact`);
  if (learnings > 0) parts.push(`${learnings} learning${learnings > 1 ? 's' : ''}`);
  if (lowImpact > 0) parts.push(`${lowImpact} low-impact`);
  if (abandoned > 0) parts.push(`${abandoned} abandoned`);

  return `${signals.length} signals: ${parts.join(', ')}.`;
}
