// lib/os/strategy/revision/generateRevisionProposals.ts
// Deterministic proposal generation from outcome signals
//
// Design principle: Rule-based, no AI/ML. All proposals are explainable
// and grounded in specific signals and evidence.
//
// Hard constraints:
// - Never propose changing goalStatement unless confidence is high
//   AND there are multiple signals indicating mismatch
// - Never propose deletes without offering an alternative
//   (except explicit "remove stale/duplicated tactic")

import type { OutcomeSignal, OutcomeSignalType } from '@/lib/types/outcomeSignal';
import type {
  StrategyRevisionProposal,
  RevisionConfidence,
  RevisionGenerationContext,
} from '@/lib/types/strategyRevision';
import { generateProposalId } from '@/lib/types/strategyRevision';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Thresholds for proposal generation
 */
export const REVISION_THRESHOLDS = {
  /** Minimum signals to propose any change */
  MIN_SIGNALS_FOR_PROPOSAL: 1,

  /** Minimum signals to propose high-impact change (goal, objectives) */
  MIN_SIGNALS_FOR_HIGH_IMPACT: 3,

  /** Minimum high-confidence signals to propose goal change */
  MIN_HIGH_CONF_FOR_GOAL: 2,

  /** Threshold for "abandoned" pattern detection */
  ABANDONED_SIGNAL_THRESHOLD: 2,

  /** Threshold for "low-impact" pattern detection */
  LOW_IMPACT_SIGNAL_THRESHOLD: 2,

  /** Threshold for "learning" cluster detection */
  LEARNING_CLUSTER_THRESHOLD: 2,
};

// ============================================================================
// Main Generation Function
// ============================================================================

/**
 * Generate revision proposals from outcome signals
 *
 * Rule-based mapping:
 * - If signals show low-impact for artifact types tied to a tactic →
 *   propose update tactic description or replace tactic
 * - If multiple "learning" signals cluster around a theme →
 *   propose add a tactic variant
 * - If "abandoned" occurs due to constraints →
 *   propose update constraints wording
 */
export function generateRevisionProposals(
  context: RevisionGenerationContext
): StrategyRevisionProposal[] {
  const proposals: StrategyRevisionProposal[] = [];
  const now = new Date().toISOString();

  // Group signals by type and by tactic
  const signalsByType = groupSignalsByType(context.signals);
  const signalsByTactic = groupSignalsByTactic(context.signals);

  // -------------------------------------------------------------------------
  // Rule 1: Low-impact tactics - propose update or replacement
  // -------------------------------------------------------------------------
  const lowImpactProposals = generateLowImpactTacticProposals(
    context,
    signalsByType['low-impact'] || [],
    signalsByTactic,
    now
  );
  proposals.push(...lowImpactProposals);

  // -------------------------------------------------------------------------
  // Rule 2: Abandoned work - propose constraint or tactic updates
  // -------------------------------------------------------------------------
  const abandonedProposals = generateAbandonedWorkProposals(
    context,
    signalsByType['abandoned'] || [],
    signalsByTactic,
    now
  );
  proposals.push(...abandonedProposals);

  // -------------------------------------------------------------------------
  // Rule 3: Learning clusters - propose tactic additions
  // -------------------------------------------------------------------------
  const learningProposals = generateLearningClusterProposals(
    context,
    signalsByType['learning'] || [],
    signalsByTactic,
    now
  );
  proposals.push(...learningProposals);

  // -------------------------------------------------------------------------
  // Rule 4: High-impact patterns - propose objective updates (rare)
  // -------------------------------------------------------------------------
  const highImpactProposals = generateHighImpactPatternProposals(
    context,
    signalsByType['high-impact'] || [],
    now
  );
  proposals.push(...highImpactProposals);

  // Deduplicate and return
  return dedupeRevisionProposals(proposals);
}

// ============================================================================
// Rule Implementations
// ============================================================================

/**
 * Rule 1: Low-impact tactics
 * If signals show low-impact for artifact types tied to a tactic,
 * propose updating or replacing the tactic
 */
function generateLowImpactTacticProposals(
  context: RevisionGenerationContext,
  lowImpactSignals: OutcomeSignal[],
  signalsByTactic: Map<string, OutcomeSignal[]>,
  now: string
): StrategyRevisionProposal[] {
  const proposals: StrategyRevisionProposal[] = [];

  // Find tactics with multiple low-impact signals
  for (const [tacticId, signals] of signalsByTactic.entries()) {
    const lowImpactForTactic = signals.filter(s => s.signalType === 'low-impact');

    if (lowImpactForTactic.length >= REVISION_THRESHOLDS.LOW_IMPACT_SIGNAL_THRESHOLD) {
      const tactic = context.currentStrategy.tactics.find(t => t.id === tacticId);
      if (!tactic) continue;

      const confidence = calculateProposalConfidence(lowImpactForTactic);
      const evidence = extractEvidence(lowImpactForTactic);

      proposals.push({
        id: generateProposalId(),
        companyId: context.companyId,
        strategyId: context.strategyId,
        title: `Refine "${tactic.title}" Tactic`,
        summary: `Multiple outcomes show limited impact from this tactic. Consider clarifying scope or adjusting approach.`,
        signalIds: lowImpactForTactic.map(s => s.id),
        evidence,
        confidence,
        changes: [
          {
            target: 'tactics',
            action: 'update',
            path: `tactics[${tacticId}]`,
            before: tactic,
            after: {
              ...tactic,
              // Propose adding a note about refinement needed
              _suggestedRefinement: 'Consider narrowing focus or adjusting execution approach',
            },
            description: `Update tactic "${tactic.title}" to address low-impact outcomes`,
          },
        ],
        status: 'draft',
        createdAt: now,
      });
    }
  }

  return proposals;
}

/**
 * Rule 2: Abandoned work
 * If "abandoned" occurs, propose constraint or tactic updates
 */
function generateAbandonedWorkProposals(
  context: RevisionGenerationContext,
  abandonedSignals: OutcomeSignal[],
  signalsByTactic: Map<string, OutcomeSignal[]>,
  now: string
): StrategyRevisionProposal[] {
  const proposals: StrategyRevisionProposal[] = [];

  if (abandonedSignals.length < REVISION_THRESHOLDS.ABANDONED_SIGNAL_THRESHOLD) {
    return proposals;
  }

  // Check if abandoned work clusters around specific tactics
  for (const [tacticId, signals] of signalsByTactic.entries()) {
    const abandonedForTactic = signals.filter(s => s.signalType === 'abandoned');

    if (abandonedForTactic.length >= REVISION_THRESHOLDS.ABANDONED_SIGNAL_THRESHOLD) {
      const tactic = context.currentStrategy.tactics.find(t => t.id === tacticId);
      if (!tactic) continue;

      const confidence = calculateProposalConfidence(abandonedForTactic);
      const evidence = extractEvidence(abandonedForTactic);

      // Propose tactic scope reduction rather than removal
      proposals.push({
        id: generateProposalId(),
        companyId: context.companyId,
        strategyId: context.strategyId,
        title: `Address Abandoned Work in "${tactic.title}"`,
        summary: `Multiple work items for this tactic were abandoned. Consider reducing scope or adding resource constraints.`,
        signalIds: abandonedForTactic.map(s => s.id),
        evidence,
        confidence,
        changes: [
          {
            target: 'tactics',
            action: 'update',
            path: `tactics[${tacticId}]`,
            before: tactic,
            after: {
              ...tactic,
              _suggestedRefinement: 'Consider reducing scope or breaking into smaller initiatives',
            },
            description: `Refine tactic "${tactic.title}" to address execution challenges`,
          },
        ],
        status: 'draft',
        createdAt: now,
      });
    }
  }

  // If many abandoned signals but not tied to specific tactics,
  // propose constraints update
  const untiedAbandonedSignals = abandonedSignals.filter(
    s => !s.tacticIds || s.tacticIds.length === 0
  );

  if (untiedAbandonedSignals.length >= REVISION_THRESHOLDS.ABANDONED_SIGNAL_THRESHOLD) {
    const confidence = calculateProposalConfidence(untiedAbandonedSignals);
    const evidence = extractEvidence(untiedAbandonedSignals);

    proposals.push({
      id: generateProposalId(),
      companyId: context.companyId,
      strategyId: context.strategyId,
      title: 'Review Resource Constraints',
      summary: `Multiple initiatives were abandoned. Consider documenting resource constraints to set realistic expectations.`,
      signalIds: untiedAbandonedSignals.map(s => s.id),
      evidence,
      confidence: confidence === 'high' ? 'medium' : confidence, // Cap at medium
      changes: [
        {
          target: 'constraints',
          action: context.currentStrategy.constraints ? 'update' : 'add',
          before: context.currentStrategy.constraints,
          after: context.currentStrategy.constraints
            ? `${context.currentStrategy.constraints}\n\n[Suggested] Add resource capacity notes based on abandoned work patterns.`
            : 'Consider documenting resource constraints based on abandoned work patterns.',
          description: 'Update constraints to reflect resource realities',
        },
      ],
      status: 'draft',
      createdAt: now,
    });
  }

  return proposals;
}

/**
 * Rule 3: Learning clusters
 * If multiple "learning" signals cluster around a theme (same channel),
 * propose adding a tactic variant
 */
function generateLearningClusterProposals(
  context: RevisionGenerationContext,
  learningSignals: OutcomeSignal[],
  signalsByTactic: Map<string, OutcomeSignal[]>,
  now: string
): StrategyRevisionProposal[] {
  const proposals: StrategyRevisionProposal[] = [];

  if (learningSignals.length < REVISION_THRESHOLDS.LEARNING_CLUSTER_THRESHOLD) {
    return proposals;
  }

  // Find tactics with positive learning clusters
  for (const [tacticId, signals] of signalsByTactic.entries()) {
    const learningsForTactic = signals.filter(s => s.signalType === 'learning');
    const highImpactForTactic = signals.filter(s => s.signalType === 'high-impact');

    // Positive pattern: learnings + high-impact
    if (
      learningsForTactic.length >= REVISION_THRESHOLDS.LEARNING_CLUSTER_THRESHOLD &&
      highImpactForTactic.length >= 1
    ) {
      const tactic = context.currentStrategy.tactics.find(t => t.id === tacticId);
      if (!tactic) continue;

      const allRelevantSignals = [...learningsForTactic, ...highImpactForTactic];
      const confidence = calculateProposalConfidence(allRelevantSignals);
      const evidence = extractEvidence(allRelevantSignals);

      proposals.push({
        id: generateProposalId(),
        companyId: context.companyId,
        strategyId: context.strategyId,
        title: `Expand on "${tactic.title}" Success`,
        summary: `This tactic shows high impact with multiple learnings. Consider adding a variant to capitalize on success.`,
        signalIds: allRelevantSignals.map(s => s.id),
        evidence,
        confidence,
        changes: [
          {
            target: 'tactics',
            action: 'add',
            before: null,
            after: {
              title: `${tactic.title} - Expansion`,
              description: `Build on successful "${tactic.title}" with expanded scope or new channel.`,
              channels: tactic.channels,
              linkedBetIds: [],
              isDerived: false,
              status: 'proposed',
            },
            description: `Add variant of successful tactic "${tactic.title}"`,
          },
        ],
        status: 'draft',
        createdAt: now,
      });
    }
  }

  return proposals;
}

/**
 * Rule 4: High-impact patterns
 * If multiple high-impact signals cluster, propose objective reinforcement
 * (Note: Goal changes require very high bar)
 */
function generateHighImpactPatternProposals(
  context: RevisionGenerationContext,
  highImpactSignals: OutcomeSignal[],
  now: string
): StrategyRevisionProposal[] {
  const proposals: StrategyRevisionProposal[] = [];

  if (highImpactSignals.length < REVISION_THRESHOLDS.MIN_SIGNALS_FOR_HIGH_IMPACT) {
    return proposals;
  }

  // Check for signals tied to specific objectives
  const signalsByObjective = groupSignalsByObjective(highImpactSignals);

  for (const [objectiveId, signals] of signalsByObjective.entries()) {
    if (signals.length >= 2) {
      const objective = context.currentStrategy.objectives.find(o => o.id === objectiveId);
      if (!objective) continue;

      const confidence = calculateProposalConfidence(signals);
      const evidence = extractEvidence(signals);

      proposals.push({
        id: generateProposalId(),
        companyId: context.companyId,
        strategyId: context.strategyId,
        title: `Reinforce "${objective.text}" Objective`,
        summary: `Multiple high-impact outcomes tied to this objective. Consider reinforcing or expanding.`,
        signalIds: signals.map(s => s.id),
        evidence,
        confidence,
        changes: [
          {
            target: 'objectives',
            action: 'update',
            path: `objectives[${objectiveId}]`,
            before: objective,
            after: {
              ...objective,
              _successNote: `Strong positive signals from ${signals.length} outcomes`,
            },
            description: `Add success note to objective "${objective.text}"`,
          },
        ],
        status: 'draft',
        createdAt: now,
      });
    }
  }

  return proposals;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Group signals by signal type
 */
function groupSignalsByType(
  signals: RevisionGenerationContext['signals']
): Record<OutcomeSignalType, OutcomeSignal[]> {
  const grouped: Record<string, OutcomeSignal[]> = {};

  for (const signal of signals) {
    const type = signal.signalType as OutcomeSignalType;
    if (!grouped[type]) {
      grouped[type] = [];
    }
    grouped[type].push(signal as OutcomeSignal);
  }

  return grouped as Record<OutcomeSignalType, OutcomeSignal[]>;
}

/**
 * Group signals by tactic ID
 */
function groupSignalsByTactic(
  signals: RevisionGenerationContext['signals']
): Map<string, OutcomeSignal[]> {
  const grouped = new Map<string, OutcomeSignal[]>();

  for (const signal of signals) {
    if (signal.tacticIds) {
      for (const tacticId of signal.tacticIds) {
        const existing = grouped.get(tacticId) || [];
        existing.push(signal as OutcomeSignal);
        grouped.set(tacticId, existing);
      }
    }
  }

  return grouped;
}

/**
 * Group signals by objective ID
 */
function groupSignalsByObjective(signals: OutcomeSignal[]): Map<string, OutcomeSignal[]> {
  const grouped = new Map<string, OutcomeSignal[]>();

  for (const signal of signals) {
    if (signal.objectiveIds) {
      for (const objectiveId of signal.objectiveIds) {
        const existing = grouped.get(objectiveId) || [];
        existing.push(signal);
        grouped.set(objectiveId, existing);
      }
    }
  }

  return grouped;
}

/**
 * Calculate proposal confidence based on signals
 */
export function calculateProposalConfidence(signals: OutcomeSignal[]): RevisionConfidence {
  if (signals.length === 0) return 'low';

  // Count by signal confidence
  const highConfCount = signals.filter(s => s.confidence === 'high').length;
  const mediumConfCount = signals.filter(s => s.confidence === 'medium').length;

  // Score: high = 3, medium = 2, low = 1
  const totalScore =
    highConfCount * 3 + mediumConfCount * 2 + (signals.length - highConfCount - mediumConfCount);
  const avgScore = totalScore / signals.length;

  // Also factor in evidence richness
  const totalEvidence = signals.reduce((sum, s) => sum + (s.evidence?.length || 0), 0);
  const evidenceBonus = Math.min(totalEvidence / 5, 0.5); // Max 0.5 bonus

  const finalScore = avgScore + evidenceBonus;

  if (finalScore >= 2.5) return 'high';
  if (finalScore >= 1.5) return 'medium';
  return 'low';
}

/**
 * Extract evidence snippets from signals
 */
function extractEvidence(signals: OutcomeSignal[]): string[] {
  const evidence: string[] = [];

  for (const signal of signals) {
    // Add signal summary as evidence
    evidence.push(signal.summary);

    // Add first 2 evidence points from each signal
    if (signal.evidence) {
      evidence.push(...signal.evidence.slice(0, 2));
    }
  }

  // Dedupe and limit
  return [...new Set(evidence)].slice(0, 5);
}

/**
 * Deduplicate revision proposals by target + action combination
 */
export function dedupeRevisionProposals(
  proposals: StrategyRevisionProposal[]
): StrategyRevisionProposal[] {
  const seen = new Map<string, StrategyRevisionProposal>();

  for (const proposal of proposals) {
    // Create a key based on changes
    const changeKeys = proposal.changes
      .map(c => `${c.target}:${c.action}:${c.path || 'root'}`)
      .sort()
      .join('|');

    const key = `${proposal.strategyId}:${changeKeys}`;

    const existing = seen.get(key);
    if (existing) {
      // Merge: keep the one with higher confidence
      const confOrder: Record<RevisionConfidence, number> = { high: 2, medium: 1, low: 0 };
      if (confOrder[proposal.confidence] > confOrder[existing.confidence]) {
        seen.set(key, {
          ...proposal,
          signalIds: [...new Set([...existing.signalIds, ...proposal.signalIds])],
          evidence: [...new Set([...existing.evidence, ...proposal.evidence])].slice(0, 5),
        });
      } else {
        // Just merge signals/evidence into existing
        existing.signalIds = [...new Set([...existing.signalIds, ...proposal.signalIds])];
        existing.evidence = [...new Set([...existing.evidence, ...proposal.evidence])].slice(0, 5);
      }
    } else {
      seen.set(key, proposal);
    }
  }

  return Array.from(seen.values());
}

// ============================================================================
// Strategy Completeness Check
// ============================================================================

/**
 * Check if strategy is incomplete (missing core fields)
 */
export function getStrategyCompleteness(strategy: RevisionGenerationContext['currentStrategy']): {
  isComplete: boolean;
  missingFields: string[];
} {
  const missingFields: string[] = [];

  if (!strategy.goalStatement?.trim()) {
    missingFields.push('goalStatement');
  }
  if (!strategy.audience?.trim()) {
    missingFields.push('audience');
  }
  if (!strategy.valueProp?.trim()) {
    missingFields.push('valueProp');
  }

  return {
    isComplete: missingFields.length === 0,
    missingFields,
  };
}

/**
 * Apply completeness penalty to proposal confidence
 * When strategy is incomplete, cap confidence at 'medium'
 */
export function applyCompletenessPenalty(
  confidence: RevisionConfidence,
  isComplete: boolean
): RevisionConfidence {
  if (isComplete) return confidence;
  if (confidence === 'high') return 'medium';
  return confidence;
}
