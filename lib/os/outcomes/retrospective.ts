// lib/os/outcomes/retrospective.ts
// Retrospective Helpers - Query and aggregate outcome signals for strategy learning
//
// Design principle: These helpers support human retrospectives.
// They surface insights but never prescribe actions or modify strategy.
// All outputs are read-only observations.

import type {
  OutcomeSignal,
  OutcomeSignalType,
  StrategyOutcomeSummary,
  ArtifactTypeOutcome,
} from '@/lib/types/outcomeSignal';
import {
  sortSignalsByRelevance,
  isPositiveSignal,
  isImprovementSignal,
} from '@/lib/types/outcomeSignal';

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get all signals for a specific strategy
 */
export function getSignalsByStrategy(
  signals: OutcomeSignal[],
  strategyId: string
): OutcomeSignal[] {
  return signals.filter(s => s.strategyId === strategyId);
}

/**
 * Get signals for a specific tactic
 */
export function getSignalsByTactic(
  signals: OutcomeSignal[],
  tacticId: string
): OutcomeSignal[] {
  return signals.filter(s => s.tacticIds?.includes(tacticId));
}

/**
 * Get signals for a specific artifact type
 */
export function getSignalsByArtifactType(
  signals: OutcomeSignal[],
  artifactType: string
): OutcomeSignal[] {
  return signals.filter(s => s.artifactType === artifactType);
}

/**
 * Get signals by source (artifact, work, experiment, manual)
 */
export function getSignalsBySource(
  signals: OutcomeSignal[],
  source: OutcomeSignal['source']
): OutcomeSignal[] {
  return signals.filter(s => s.source === source);
}

/**
 * Get signals by type
 */
export function getSignalsByType(
  signals: OutcomeSignal[],
  signalType: OutcomeSignalType
): OutcomeSignal[] {
  return signals.filter(s => s.signalType === signalType);
}

// ============================================================================
// Top Learnings
// ============================================================================

/**
 * Get top learnings for a company
 * Returns highest confidence signals that provide actionable insights
 */
export function getTopLearnings(
  signals: OutcomeSignal[],
  options: {
    limit?: number;
    minConfidence?: 'low' | 'medium' | 'high';
    signalTypes?: OutcomeSignalType[];
  } = {}
): OutcomeSignal[] {
  const {
    limit = 5,
    minConfidence = 'medium',
    signalTypes = ['learning', 'high-impact', 'completed'],
  } = options;

  const confidenceOrder: Record<string, number> = {
    'high': 2,
    'medium': 1,
    'low': 0,
  };

  const minConfidenceScore = confidenceOrder[minConfidence];

  const filtered = signals.filter(s => {
    // Filter by signal type
    if (!signalTypes.includes(s.signalType)) return false;

    // Filter by minimum confidence
    if (confidenceOrder[s.confidence] < minConfidenceScore) return false;

    return true;
  });

  // Sort by relevance and limit
  return sortSignalsByRelevance(filtered).slice(0, limit);
}

/**
 * Get high-impact outcomes
 */
export function getHighImpactOutcomes(
  signals: OutcomeSignal[],
  limit: number = 5
): OutcomeSignal[] {
  return sortSignalsByRelevance(
    signals.filter(s => s.signalType === 'high-impact')
  ).slice(0, limit);
}

/**
 * Get underperforming artifacts
 * Returns artifacts with low-impact or abandoned signals
 */
export function getUnderperformingArtifacts(
  signals: OutcomeSignal[],
  limit: number = 5
): OutcomeSignal[] {
  return sortSignalsByRelevance(
    signals.filter(s =>
      s.source === 'artifact' &&
      (s.signalType === 'low-impact' || s.signalType === 'abandoned')
    )
  ).slice(0, limit);
}

// ============================================================================
// Strategy Summary
// ============================================================================

/**
 * Generate a complete outcome summary for a strategy
 */
export function generateStrategySummary(
  signals: OutcomeSignal[],
  strategyId: string
): StrategyOutcomeSummary {
  const strategySignals = getSignalsByStrategy(signals, strategyId);

  // Count by type
  const byType: Record<OutcomeSignalType, number> = {
    'completed': 0,
    'abandoned': 0,
    'high-impact': 0,
    'low-impact': 0,
    'learning': 0,
  };

  for (const signal of strategySignals) {
    byType[signal.signalType]++;
  }

  return {
    strategyId,
    totalSignals: strategySignals.length,
    byType,
    topLearnings: getTopLearnings(strategySignals, { limit: 3 }),
    highImpactOutcomes: getHighImpactOutcomes(strategySignals, 3),
    areasNeedingAttention: strategySignals
      .filter(isImprovementSignal)
      .slice(0, 3),
  };
}

// ============================================================================
// Artifact Type Analysis
// ============================================================================

/**
 * Analyze outcomes by artifact type
 */
export function analyzeArtifactTypeOutcomes(
  signals: OutcomeSignal[],
  artifactTypes: string[]
): ArtifactTypeOutcome[] {
  const outcomes: ArtifactTypeOutcome[] = [];

  for (const artifactType of artifactTypes) {
    const typeSignals = getSignalsByArtifactType(signals, artifactType);

    if (typeSignals.length === 0) {
      outcomes.push({
        artifactType,
        totalArtifacts: 0,
        artifactsWithSignals: 0,
        averageCompletionRate: 0,
        predominantSignalType: null,
        learnings: [],
      });
      continue;
    }

    // Count unique artifacts
    const uniqueArtifacts = new Set(typeSignals.map(s => s.sourceId));

    // Find predominant signal type
    const typeCounts: Record<OutcomeSignalType, number> = {
      'completed': 0,
      'abandoned': 0,
      'high-impact': 0,
      'low-impact': 0,
      'learning': 0,
    };
    for (const signal of typeSignals) {
      typeCounts[signal.signalType]++;
    }
    const predominantType = (Object.entries(typeCounts) as [OutcomeSignalType, number][])
      .sort((a, b) => b[1] - a[1])[0];

    // Calculate average completion rate from completed signals
    const completedSignals = typeSignals.filter(s => s.signalType === 'completed');
    const completionRate = uniqueArtifacts.size > 0
      ? completedSignals.length / uniqueArtifacts.size
      : 0;

    // Extract learnings from learning signals
    const learnings = typeSignals
      .filter(s => s.signalType === 'learning')
      .map(s => s.summary)
      .slice(0, 3);

    outcomes.push({
      artifactType,
      totalArtifacts: uniqueArtifacts.size,
      artifactsWithSignals: uniqueArtifacts.size,
      averageCompletionRate: completionRate,
      predominantSignalType: predominantType[1] > 0 ? predominantType[0] : null,
      learnings,
    });
  }

  return outcomes;
}

// ============================================================================
// Time-Based Analysis
// ============================================================================

/**
 * Get signals from the last N days
 */
export function getRecentSignals(
  signals: OutcomeSignal[],
  days: number
): OutcomeSignal[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  return signals.filter(s => new Date(s.createdAt) >= cutoff);
}

/**
 * Get trend data - compare recent vs older signals
 */
export function getSignalTrend(
  signals: OutcomeSignal[],
  recentDays: number = 30,
  olderDays: number = 60
): {
  recent: { positive: number; improvement: number; total: number };
  older: { positive: number; improvement: number; total: number };
  trend: 'improving' | 'declining' | 'stable';
} {
  const now = new Date();
  const recentCutoff = new Date(now.getTime() - recentDays * 24 * 60 * 60 * 1000);
  const olderCutoff = new Date(now.getTime() - olderDays * 24 * 60 * 60 * 1000);

  const recent = signals.filter(s => new Date(s.createdAt) >= recentCutoff);
  const older = signals.filter(s => {
    const date = new Date(s.createdAt);
    return date >= olderCutoff && date < recentCutoff;
  });

  const recentPositive = recent.filter(isPositiveSignal).length;
  const recentImprovement = recent.filter(isImprovementSignal).length;
  const olderPositive = older.filter(isPositiveSignal).length;
  const olderImprovement = older.filter(isImprovementSignal).length;

  // Calculate trend based on positive ratio
  const recentPositiveRatio = recent.length > 0 ? recentPositive / recent.length : 0;
  const olderPositiveRatio = older.length > 0 ? olderPositive / older.length : 0;

  let trend: 'improving' | 'declining' | 'stable' = 'stable';
  if (recentPositiveRatio > olderPositiveRatio + 0.1) {
    trend = 'improving';
  } else if (recentPositiveRatio < olderPositiveRatio - 0.1) {
    trend = 'declining';
  }

  return {
    recent: {
      positive: recentPositive,
      improvement: recentImprovement,
      total: recent.length,
    },
    older: {
      positive: olderPositive,
      improvement: olderImprovement,
      total: older.length,
    },
    trend,
  };
}

// ============================================================================
// Tactic-Level Analysis
// ============================================================================

/**
 * Get outcome summary for a specific tactic
 */
export function getTacticOutcomeSummary(
  signals: OutcomeSignal[],
  tacticId: string
): {
  tacticId: string;
  totalSignals: number;
  positiveCount: number;
  improvementCount: number;
  topSignal: OutcomeSignal | null;
  effectivenessScore: number; // 0-100
} {
  const tacticSignals = getSignalsByTactic(signals, tacticId);

  const positiveCount = tacticSignals.filter(isPositiveSignal).length;
  const improvementCount = tacticSignals.filter(isImprovementSignal).length;

  // Calculate effectiveness score
  // Positive signals add, improvement signals subtract slightly
  let score = 50; // Baseline
  if (tacticSignals.length > 0) {
    const positiveRatio = positiveCount / tacticSignals.length;
    const improvementRatio = improvementCount / tacticSignals.length;
    score = Math.round(50 + (positiveRatio * 50) - (improvementRatio * 25));
    score = Math.max(0, Math.min(100, score));
  }

  const sorted = sortSignalsByRelevance(tacticSignals);

  return {
    tacticId,
    totalSignals: tacticSignals.length,
    positiveCount,
    improvementCount,
    topSignal: sorted[0] || null,
    effectivenessScore: score,
  };
}

// ============================================================================
// Export Summary for UI
// ============================================================================

/**
 * Generate a UI-friendly summary of learnings
 */
export function generateLearningsSummary(
  signals: OutcomeSignal[]
): {
  hasLearnings: boolean;
  totalSignals: number;
  highlightSignal: OutcomeSignal | null;
  positiveCount: number;
  improvementCount: number;
  recentTrend: 'improving' | 'declining' | 'stable';
  keyInsights: string[];
} {
  if (signals.length === 0) {
    return {
      hasLearnings: false,
      totalSignals: 0,
      highlightSignal: null,
      positiveCount: 0,
      improvementCount: 0,
      recentTrend: 'stable',
      keyInsights: [],
    };
  }

  const sorted = sortSignalsByRelevance(signals);
  const positiveCount = signals.filter(isPositiveSignal).length;
  const improvementCount = signals.filter(isImprovementSignal).length;
  const trend = getSignalTrend(signals);

  // Extract key insights from high-confidence signals
  const keyInsights = sorted
    .filter(s => s.confidence === 'high' || s.confidence === 'medium')
    .slice(0, 3)
    .map(s => s.summary);

  return {
    hasLearnings: true,
    totalSignals: signals.length,
    highlightSignal: sorted[0],
    positiveCount,
    improvementCount,
    recentTrend: trend.trend,
    keyInsights,
  };
}
