// lib/hiveBrain/metaEvaluator.ts
// Meta-Evaluator - Self-Assessment System
//
// Performs periodic self-assessment of Hive Brain performance:
// - Prediction accuracy tracking
// - Decision quality evaluation
// - Playbook effectiveness measurement
// - Learning action generation
//
// The meta-evaluator helps the Hive Brain improve over time
// by identifying what's working and what isn't.

import type { MetaEvaluation } from './types';

// ============================================================================
// Types
// ============================================================================

/**
 * A recorded prediction for later evaluation
 */
export interface RecordedPrediction {
  id: string;
  /** When the prediction was made */
  predictedAt: string;
  /** When the prediction should be evaluated */
  evaluateAfter: string;
  /** Company or scope of prediction */
  companyId?: string;
  verticalId?: string;
  /** The metric being predicted */
  metric: string;
  /** Predicted value */
  predictedValue: number;
  /** Confidence in prediction (0-1) */
  confidence: number;
  /** Actual value (filled in after evaluation) */
  actualValue?: number;
  /** Whether prediction was accurate */
  accurate?: boolean;
  /** Prediction context/reasoning */
  reasoning: string;
}

/**
 * An autopilot decision for evaluation
 */
export interface AutopilotDecision {
  id: string;
  /** When decision was made */
  decidedAt: string;
  /** Company affected */
  companyId: string;
  /** Type of decision */
  decisionType: 'budget' | 'creative' | 'targeting' | 'bidding' | 'pause' | 'other';
  /** Description of the decision */
  description: string;
  /** Expected outcome */
  expectedOutcome: string;
  /** Actual outcome (filled in after evaluation) */
  actualOutcome?: string;
  /** Quality rating (-1 = bad, 0 = neutral, 1 = good) */
  qualityRating?: -1 | 0 | 1;
  /** Reasoning for the rating */
  ratingReasoning?: string;
}

/**
 * Playbook usage tracking
 */
export interface PlaybookUsage {
  playbookId: string;
  verticalId: string;
  /** Number of times recommendations were followed */
  followedCount: number;
  /** Number of times recommendations were ignored */
  ignoredCount: number;
  /** Outcomes when followed (positive rate) */
  followedPositiveRate: number;
  /** Outcomes when ignored (positive rate) */
  ignoredPositiveRate: number;
}

// ============================================================================
// In-Memory Storage (In production, use database)
// ============================================================================

let predictions: RecordedPrediction[] = [];
let decisions: AutopilotDecision[] = [];
let playbookUsage: Map<string, PlaybookUsage> = new Map();

// ============================================================================
// Prediction Tracking
// ============================================================================

/**
 * Record a prediction for later evaluation
 */
export function recordPrediction(
  prediction: Omit<RecordedPrediction, 'id' | 'predictedAt'>
): RecordedPrediction {
  const record: RecordedPrediction = {
    ...prediction,
    id: `pred-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    predictedAt: new Date().toISOString(),
  };

  predictions.push(record);
  return record;
}

/**
 * Evaluate a prediction against actual value
 */
export function evaluatePrediction(
  predictionId: string,
  actualValue: number
): RecordedPrediction | null {
  const prediction = predictions.find((p) => p.id === predictionId);
  if (!prediction) return null;

  // Calculate accuracy (within 20% = accurate)
  const errorPercent = Math.abs(
    (actualValue - prediction.predictedValue) / prediction.predictedValue
  );
  const accurate = errorPercent <= 0.2;

  prediction.actualValue = actualValue;
  prediction.accurate = accurate;

  return prediction;
}

/**
 * Get prediction accuracy stats
 */
export function getPredictionAccuracy(): {
  overall: number;
  byMetric: Record<string, number>;
  recentTrend: 'improving' | 'stable' | 'declining';
} {
  const evaluated = predictions.filter((p) => p.accurate !== undefined);

  if (evaluated.length === 0) {
    return { overall: 0, byMetric: {}, recentTrend: 'stable' };
  }

  // Overall accuracy
  const overall =
    evaluated.filter((p) => p.accurate).length / evaluated.length;

  // By metric
  const byMetric: Record<string, number> = {};
  const metricGroups = new Map<string, RecordedPrediction[]>();

  for (const pred of evaluated) {
    if (!metricGroups.has(pred.metric)) {
      metricGroups.set(pred.metric, []);
    }
    metricGroups.get(pred.metric)!.push(pred);
  }

  for (const [metric, preds] of metricGroups) {
    byMetric[metric] = preds.filter((p) => p.accurate).length / preds.length;
  }

  // Recent trend (compare last 10 vs previous 10)
  let recentTrend: 'improving' | 'stable' | 'declining' = 'stable';
  if (evaluated.length >= 20) {
    const sorted = [...evaluated].sort(
      (a, b) => new Date(b.predictedAt).getTime() - new Date(a.predictedAt).getTime()
    );
    const recent = sorted.slice(0, 10);
    const previous = sorted.slice(10, 20);

    const recentAccuracy = recent.filter((p) => p.accurate).length / 10;
    const previousAccuracy = previous.filter((p) => p.accurate).length / 10;

    if (recentAccuracy - previousAccuracy > 0.1) {
      recentTrend = 'improving';
    } else if (previousAccuracy - recentAccuracy > 0.1) {
      recentTrend = 'declining';
    }
  }

  return { overall, byMetric, recentTrend };
}

// ============================================================================
// Autopilot Decision Tracking
// ============================================================================

/**
 * Record an autopilot decision
 */
export function recordDecision(
  decision: Omit<AutopilotDecision, 'id' | 'decidedAt'>
): AutopilotDecision {
  const record: AutopilotDecision = {
    ...decision,
    id: `dec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    decidedAt: new Date().toISOString(),
  };

  decisions.push(record);
  return record;
}

/**
 * Rate an autopilot decision
 */
export function rateDecision(
  decisionId: string,
  actualOutcome: string,
  qualityRating: -1 | 0 | 1,
  reasoning: string
): AutopilotDecision | null {
  const decision = decisions.find((d) => d.id === decisionId);
  if (!decision) return null;

  decision.actualOutcome = actualOutcome;
  decision.qualityRating = qualityRating;
  decision.ratingReasoning = reasoning;

  return decision;
}

/**
 * Get autopilot quality stats
 */
export function getAutopilotQuality(): {
  decisionsEvaluated: number;
  goodDecisions: number;
  badDecisions: number;
  neutralDecisions: number;
  byType: Record<string, { good: number; bad: number; neutral: number }>;
} {
  const evaluated = decisions.filter((d) => d.qualityRating !== undefined);

  const result = {
    decisionsEvaluated: evaluated.length,
    goodDecisions: evaluated.filter((d) => d.qualityRating === 1).length,
    badDecisions: evaluated.filter((d) => d.qualityRating === -1).length,
    neutralDecisions: evaluated.filter((d) => d.qualityRating === 0).length,
    byType: {} as Record<string, { good: number; bad: number; neutral: number }>,
  };

  // Group by type
  for (const decision of evaluated) {
    if (!result.byType[decision.decisionType]) {
      result.byType[decision.decisionType] = { good: 0, bad: 0, neutral: 0 };
    }

    if (decision.qualityRating === 1) {
      result.byType[decision.decisionType].good++;
    } else if (decision.qualityRating === -1) {
      result.byType[decision.decisionType].bad++;
    } else {
      result.byType[decision.decisionType].neutral++;
    }
  }

  return result;
}

// ============================================================================
// Playbook Effectiveness Tracking
// ============================================================================

/**
 * Record playbook recommendation follow/ignore
 */
export function recordPlaybookUsage(
  playbookId: string,
  verticalId: string,
  followed: boolean,
  positiveOutcome: boolean
): void {
  let usage = playbookUsage.get(playbookId);

  if (!usage) {
    usage = {
      playbookId,
      verticalId,
      followedCount: 0,
      ignoredCount: 0,
      followedPositiveRate: 0,
      ignoredPositiveRate: 0,
    };
    playbookUsage.set(playbookId, usage);
  }

  if (followed) {
    const prevPositive = usage.followedPositiveRate * usage.followedCount;
    usage.followedCount++;
    usage.followedPositiveRate =
      (prevPositive + (positiveOutcome ? 1 : 0)) / usage.followedCount;
  } else {
    const prevPositive = usage.ignoredPositiveRate * usage.ignoredCount;
    usage.ignoredCount++;
    usage.ignoredPositiveRate =
      (prevPositive + (positiveOutcome ? 1 : 0)) / usage.ignoredCount;
  }
}

/**
 * Get playbook effectiveness
 */
export function getPlaybookEffectiveness(): Record<string, number> {
  const effectiveness: Record<string, number> = {};

  for (const [playbookId, usage] of playbookUsage) {
    // Effectiveness = how much better following vs ignoring
    // If both rates are 0 or no data, effectiveness is neutral (0.5)
    if (usage.followedCount === 0 && usage.ignoredCount === 0) {
      effectiveness[playbookId] = 0.5;
    } else if (usage.ignoredCount === 0) {
      effectiveness[playbookId] = usage.followedPositiveRate;
    } else if (usage.followedCount === 0) {
      effectiveness[playbookId] = 1 - usage.ignoredPositiveRate;
    } else {
      // Compare follow rate vs ignore rate
      const delta = usage.followedPositiveRate - usage.ignoredPositiveRate;
      effectiveness[playbookId] = 0.5 + delta * 0.5; // Normalize to 0-1
    }
  }

  return effectiveness;
}

// ============================================================================
// Main Evaluation Function
// ============================================================================

/**
 * Run a full meta-evaluation
 */
export function runMetaEvaluation(
  periodStart: string,
  periodEnd: string
): MetaEvaluation {
  const predictionAccuracy = getPredictionAccuracy();
  const autopilotQuality = getAutopilotQuality();
  const playbookEffectivenessData = getPlaybookEffectiveness();

  // Calculate overall intelligence score
  const overallIntelligenceScore = calculateIntelligenceScore(
    predictionAccuracy,
    autopilotQuality,
    playbookEffectivenessData
  );

  // Identify key wins and failures
  const { keyWins, keyFailures } = identifyKeyOutcomes();

  // Generate learning actions
  const learningActions = generateLearningActions(
    predictionAccuracy,
    autopilotQuality,
    playbookEffectivenessData
  );

  // Vertical scores (simplified - would need more data in production)
  const verticalScores: Record<string, number> = {};
  for (const usage of playbookUsage.values()) {
    if (!verticalScores[usage.verticalId]) {
      verticalScores[usage.verticalId] = 0;
    }
    verticalScores[usage.verticalId] = Math.max(
      verticalScores[usage.verticalId],
      usage.followedPositiveRate * 100
    );
  }

  return {
    overallIntelligenceScore,
    verticalScores,
    keyWins,
    keyFailures,
    learningActions,
    predictionAccuracy: {
      overall: predictionAccuracy.overall,
      byMetric: predictionAccuracy.byMetric,
    },
    autopilotQuality,
    playbookEffectiveness: playbookEffectivenessData,
    evaluatedAt: new Date().toISOString(),
    periodStart,
    periodEnd,
  };
}

/**
 * Calculate overall intelligence score (0-100)
 */
function calculateIntelligenceScore(
  predictionAccuracy: ReturnType<typeof getPredictionAccuracy>,
  autopilotQuality: ReturnType<typeof getAutopilotQuality>,
  playbookEffectiveness: Record<string, number>
): number {
  let score = 50; // Base score

  // Prediction accuracy contribution (up to +25)
  score += predictionAccuracy.overall * 25;

  // Autopilot quality contribution (up to +25)
  if (autopilotQuality.decisionsEvaluated > 0) {
    const goodRate =
      autopilotQuality.goodDecisions / autopilotQuality.decisionsEvaluated;
    const badRate =
      autopilotQuality.badDecisions / autopilotQuality.decisionsEvaluated;
    score += (goodRate - badRate) * 25;
  }

  // Playbook effectiveness contribution (up to +15)
  const playbookValues = Object.values(playbookEffectiveness);
  if (playbookValues.length > 0) {
    const avgEffectiveness =
      playbookValues.reduce((a, b) => a + b, 0) / playbookValues.length;
    score += (avgEffectiveness - 0.5) * 30; // Center around 0.5
  }

  // Improvement trend bonus (up to +10)
  if (predictionAccuracy.recentTrend === 'improving') {
    score += 10;
  } else if (predictionAccuracy.recentTrend === 'declining') {
    score -= 5;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Identify key wins and failures
 */
function identifyKeyOutcomes(): { keyWins: string[]; keyFailures: string[] } {
  const keyWins: string[] = [];
  const keyFailures: string[] = [];

  // From predictions
  const accuratePredictions = predictions.filter(
    (p) => p.accurate === true && p.confidence >= 0.7
  );
  const inaccuratePredictions = predictions.filter(
    (p) => p.accurate === false && p.confidence >= 0.7
  );

  if (accuratePredictions.length > 0) {
    keyWins.push(
      `${accuratePredictions.length} high-confidence predictions were accurate`
    );
  }

  if (inaccuratePredictions.length > 0) {
    keyFailures.push(
      `${inaccuratePredictions.length} high-confidence predictions were wrong`
    );
  }

  // From decisions
  const goodDecisions = decisions.filter((d) => d.qualityRating === 1);
  const badDecisions = decisions.filter((d) => d.qualityRating === -1);

  if (goodDecisions.length > 0) {
    const topGood = goodDecisions[goodDecisions.length - 1];
    keyWins.push(`Good decision: ${topGood.description}`);
  }

  if (badDecisions.length > 0) {
    const topBad = badDecisions[badDecisions.length - 1];
    keyFailures.push(
      `Bad decision: ${topBad.description} - ${topBad.ratingReasoning}`
    );
  }

  // From playbooks
  for (const usage of playbookUsage.values()) {
    if (usage.followedPositiveRate > 0.8 && usage.followedCount >= 5) {
      keyWins.push(
        `Playbook ${usage.playbookId} has ${Math.round(usage.followedPositiveRate * 100)}% success rate`
      );
    }
    if (usage.ignoredPositiveRate > usage.followedPositiveRate + 0.2) {
      keyFailures.push(
        `Playbook ${usage.playbookId} recommendations underperforming (ignoring is better)`
      );
    }
  }

  return {
    keyWins: keyWins.slice(0, 5),
    keyFailures: keyFailures.slice(0, 5),
  };
}

/**
 * Generate learning actions based on evaluation
 */
function generateLearningActions(
  predictionAccuracy: ReturnType<typeof getPredictionAccuracy>,
  autopilotQuality: ReturnType<typeof getAutopilotQuality>,
  playbookEffectiveness: Record<string, number>
): string[] {
  const actions: string[] = [];

  // Prediction-based actions
  if (predictionAccuracy.overall < 0.6) {
    actions.push('Improve prediction models - accuracy below 60%');
  }

  if (predictionAccuracy.recentTrend === 'declining') {
    actions.push('Investigate declining prediction accuracy trend');
  }

  // Find worst-performing metric predictions
  for (const [metric, accuracy] of Object.entries(predictionAccuracy.byMetric)) {
    if (accuracy < 0.5) {
      actions.push(`Retrain ${metric} prediction model (${Math.round(accuracy * 100)}% accuracy)`);
    }
  }

  // Autopilot-based actions
  if (autopilotQuality.badDecisions > autopilotQuality.goodDecisions) {
    actions.push('Review and tighten autopilot decision criteria');
  }

  for (const [type, stats] of Object.entries(autopilotQuality.byType)) {
    if (stats.bad > stats.good) {
      actions.push(`Improve ${type} autopilot decisions (more bad than good)`);
    }
  }

  // Playbook-based actions
  for (const [playbookId, effectiveness] of Object.entries(playbookEffectiveness)) {
    if (effectiveness < 0.4) {
      actions.push(`Regenerate ${playbookId} playbook - low effectiveness`);
    }
  }

  return actions.slice(0, 10);
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Clear all tracking data (for testing)
 */
export function clearTrackingData(): void {
  predictions = [];
  decisions = [];
  playbookUsage = new Map();
}

/**
 * Get tracking stats
 */
export function getTrackingStats(): {
  predictions: number;
  evaluatedPredictions: number;
  decisions: number;
  evaluatedDecisions: number;
  trackedPlaybooks: number;
} {
  return {
    predictions: predictions.length,
    evaluatedPredictions: predictions.filter((p) => p.accurate !== undefined)
      .length,
    decisions: decisions.length,
    evaluatedDecisions: decisions.filter((d) => d.qualityRating !== undefined)
      .length,
    trackedPlaybooks: playbookUsage.size,
  };
}

/**
 * Export all data for analysis
 */
export function exportData(): {
  predictions: RecordedPrediction[];
  decisions: AutopilotDecision[];
  playbookUsage: PlaybookUsage[];
} {
  return {
    predictions: [...predictions],
    decisions: [...decisions],
    playbookUsage: Array.from(playbookUsage.values()),
  };
}
