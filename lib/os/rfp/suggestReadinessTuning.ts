// lib/os/rfp/suggestReadinessTuning.ts
// Advisory calibration suggestions for Bid Readiness based on outcome insights
//
// Analyzes outcome analysis results and current config to propose safe tuning
// changes. All suggestions are advisory - no auto-apply.

import type { OutcomeAnalysisResult, OutcomeInsight } from './analyzeOutcomes';
import {
  type BidReadinessConfig,
  type ConfigChange,
  getBidReadinessConfig,
  diffConfigs,
  validateConfig,
} from './bidReadinessConfig';

// ============================================================================
// Types
// ============================================================================

/**
 * Risk level for a suggested change
 */
export type TuningRiskLevel = 'low' | 'medium' | 'high';

/**
 * Expected impact of a suggested change
 */
export type TuningImpact = 'minor' | 'moderate' | 'significant';

/**
 * A single tuning suggestion backed by outcome insights
 */
export interface ReadinessTuningSuggestion {
  /** Unique ID for this suggestion */
  id: string;
  /** Short title for the suggestion */
  title: string;
  /** Detailed description of what to change and why */
  description: string;
  /** The specific config change(s) */
  changes: ConfigChange[];
  /** Expected impact on readiness calculations */
  expectedImpact: TuningImpact;
  /** Risk level of making this change */
  risk: TuningRiskLevel;
  /** Confidence in this suggestion (based on sample size and correlation strength) */
  confidence: 'low' | 'medium' | 'high';
  /** Rationale chips for display */
  rationale: TuningRationale[];
  /** Category of the suggestion */
  category: 'threshold' | 'penalty' | 'weight';
}

/**
 * A rationale chip for a suggestion
 */
export interface TuningRationale {
  /** Label for the chip */
  label: string;
  /** Type of rationale */
  type: 'signal' | 'sample_size' | 'confidence' | 'correlation';
  /** Value if applicable */
  value?: string | number;
}

/**
 * Result of the suggestion engine
 */
export interface TuningSuggestionResult {
  /** Suggested tuning changes, sorted by confidence desc then impact */
  suggestions: ReadinessTuningSuggestion[];
  /** Current config being analyzed against */
  currentConfig: BidReadinessConfig;
  /** Whether there's enough data to make suggestions */
  hasEnoughData: boolean;
  /** Message if not enough data */
  insufficientDataMessage?: string;
}

// ============================================================================
// Configuration
// ============================================================================

/** Minimum sample size needed to generate suggestions */
const MIN_SAMPLE_SIZE_FOR_SUGGESTIONS = 5;

/** Minimum absolute win rate delta to consider a signal meaningful */
const MIN_MEANINGFUL_DELTA = 10;

/** Maximum threshold adjustment per suggestion */
const MAX_THRESHOLD_ADJUSTMENT = 5;

/** Maximum penalty adjustment step */
const MAX_PENALTY_ADJUSTMENT = 0.1;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique ID for a suggestion
 */
function generateSuggestionId(category: string, index: number): string {
  return `tuning-${category}-${index}-${Date.now()}`;
}

/**
 * Determine risk level based on change magnitude
 */
function assessRisk(changes: ConfigChange[]): TuningRiskLevel {
  const totalChange = changes.reduce((sum, c) => sum + Math.abs(c.to - c.from), 0);

  // Risk thresholds
  if (totalChange > 10 || changes.some(c => c.path.includes('threshold'))) {
    return 'medium';
  }
  if (totalChange > 20) {
    return 'high';
  }
  return 'low';
}

/**
 * Determine expected impact
 */
function assessImpact(changes: ConfigChange[]): TuningImpact {
  const hasThresholdChange = changes.some(c => c.path.includes('threshold'));
  const hasPenaltyChange = changes.some(c => c.path.includes('penalty'));

  if (hasThresholdChange) return 'significant';
  if (hasPenaltyChange) return 'moderate';
  return 'minor';
}

/**
 * Create rationale chips from an insight
 */
function createRationale(insight: OutcomeInsight): TuningRationale[] {
  return [
    {
      label: insight.signal,
      type: 'signal',
    },
    {
      label: `${insight.sampleSize} RFPs`,
      type: 'sample_size',
      value: insight.sampleSize,
    },
    {
      label: insight.confidence,
      type: 'confidence',
      value: insight.confidence,
    },
    {
      label: `${insight.winRateDelta > 0 ? '+' : ''}${insight.winRateDelta}%`,
      type: 'correlation',
      value: insight.winRateDelta,
    },
  ];
}

// ============================================================================
// Suggestion Generation Heuristics
// ============================================================================

/**
 * Analyze critical risk correlations and suggest penalty adjustments
 */
function suggestCriticalRiskPenalty(
  analysis: OutcomeAnalysisResult,
  config: BidReadinessConfig
): ReadinessTuningSuggestion | null {
  // Find critical risk insight
  const criticalRiskInsight = analysis.insights.find(
    i => i.signal === 'submitted with critical risks' &&
         i.confidence !== 'low' &&
         Math.abs(i.winRateDelta) >= MIN_MEANINGFUL_DELTA
  );

  if (!criticalRiskInsight) return null;

  // Strong negative correlation with critical risks → increase penalty
  if (criticalRiskInsight.winRateDelta <= -MIN_MEANINGFUL_DELTA) {
    const currentPenalty = config.penalties.criticalRiskPenalty;
    const suggestedPenalty = Math.min(
      currentPenalty + 5, // Increase by 5 points
      25 // Max reasonable penalty
    );

    if (suggestedPenalty <= currentPenalty) return null;

    const change: ConfigChange = {
      path: 'penalties.criticalRiskPenalty',
      from: currentPenalty,
      to: suggestedPenalty,
      description: `Critical risk penalty: -${currentPenalty}pts → -${suggestedPenalty}pts`,
    };

    return {
      id: generateSuggestionId('penalty', 1),
      title: 'Increase Critical Risk Penalty',
      description: `RFPs submitted with critical risks show ${criticalRiskInsight.winRateDelta}% lower win rate. Consider increasing the score penalty for critical risks.`,
      changes: [change],
      expectedImpact: assessImpact([change]),
      risk: assessRisk([change]),
      confidence: criticalRiskInsight.confidence,
      rationale: createRationale(criticalRiskInsight),
      category: 'penalty',
    };
  }

  return null;
}

/**
 * Analyze score threshold correlations and suggest threshold adjustments
 */
function suggestGoThresholdAdjustment(
  analysis: OutcomeAnalysisResult,
  config: BidReadinessConfig
): ReadinessTuningSuggestion | null {
  // Find insights about the GO threshold boundary
  const currentGo = config.thresholds.go;

  // Look for insights that suggest the threshold is too high or too low
  const aboveInsight = analysis.insights.find(
    i => i.signal === `score >= ${currentGo}` && i.confidence !== 'low'
  );
  const belowInsight = analysis.insights.find(
    i => i.signal === `score < ${currentGo}` && i.confidence !== 'low'
  );

  // Also check adjacent thresholds
  const above70 = analysis.insights.find(i => i.signal === 'score >= 70');
  const above80 = analysis.insights.find(i => i.signal === 'score >= 80');
  const below70 = analysis.insights.find(i => i.signal === 'score < 70');

  // Heuristic: If scores below threshold still win at similar rate, threshold may be too high
  if (aboveInsight && belowInsight) {
    const gapBetween = aboveInsight.winRateDelta - belowInsight.winRateDelta;

    // If gap is small (< 10%), the threshold isn't very predictive
    if (Math.abs(gapBetween) < MIN_MEANINGFUL_DELTA) {
      // Check if we should raise or lower
      if (above80 && above80.winRateDelta > aboveInsight.winRateDelta + 10) {
        // Higher threshold is more predictive - raise it
        const newThreshold = Math.min(currentGo + MAX_THRESHOLD_ADJUSTMENT, 85);

        if (newThreshold <= currentGo) return null;

        const change: ConfigChange = {
          path: 'thresholds.go',
          from: currentGo,
          to: newThreshold,
          description: `GO threshold: ${currentGo} → ${newThreshold}`,
        };

        return {
          id: generateSuggestionId('threshold', 1),
          title: 'Raise GO Threshold',
          description: `Current GO threshold of ${currentGo}% shows weak predictive power. Higher scores (≥80%) have stronger correlation with wins.`,
          changes: [change],
          expectedImpact: 'significant',
          risk: 'medium',
          confidence: above80.confidence,
          rationale: above80 ? createRationale(above80) : createRationale(aboveInsight),
          category: 'threshold',
        };
      }
    }
  }

  // Heuristic: If above-threshold strongly correlates and below strongly anti-correlates
  if (
    aboveInsight &&
    belowInsight &&
    aboveInsight.winRateDelta >= 15 &&
    belowInsight.winRateDelta <= -15
  ) {
    // Current threshold is good - no suggestion needed
    return null;
  }

  return null;
}

/**
 * Analyze conditional threshold and suggest adjustments
 */
function suggestConditionalThresholdAdjustment(
  analysis: OutcomeAnalysisResult,
  config: BidReadinessConfig
): ReadinessTuningSuggestion | null {
  // Find conditional recommendation insight
  const conditionalInsight = analysis.insights.find(
    i => i.signal === 'recommendation = Conditional Go' && i.confidence !== 'low'
  );

  const noGoInsight = analysis.insights.find(
    i => i.signal === 'recommendation = No-Go' && i.confidence !== 'low'
  );

  if (!conditionalInsight || !noGoInsight) return null;

  // If conditional behaves like no-go (similar or worse win rate), narrow the band
  const gap = conditionalInsight.winRateDelta - noGoInsight.winRateDelta;

  if (gap < 5 && conditionalInsight.winRateDelta <= -10) {
    // Conditional and No-Go have similar poor outcomes
    const currentMin = config.thresholds.conditionalMin;
    const newMin = Math.min(
      currentMin + MAX_THRESHOLD_ADJUSTMENT,
      config.thresholds.go - 10 // Keep at least 10 point gap
    );

    if (newMin <= currentMin) return null;

    const change: ConfigChange = {
      path: 'thresholds.conditionalMin',
      from: currentMin,
      to: newMin,
      description: `Conditional minimum: ${currentMin} → ${newMin}`,
    };

    return {
      id: generateSuggestionId('threshold', 2),
      title: 'Narrow Conditional Range',
      description: `Conditional Go recommendations show similar win rates to No-Go (${conditionalInsight.winRateDelta}% vs ${noGoInsight.winRateDelta}%). Consider raising the minimum threshold.`,
      changes: [change],
      expectedImpact: 'significant',
      risk: 'medium',
      confidence: conditionalInsight.confidence,
      rationale: createRationale(conditionalInsight),
      category: 'threshold',
    };
  }

  return null;
}

/**
 * Analyze acknowledged risks and suggest penalty adjustments
 */
function suggestAcknowledgedRiskPenalty(
  analysis: OutcomeAnalysisResult,
  config: BidReadinessConfig
): ReadinessTuningSuggestion | null {
  // Find acknowledged risks insight
  const acknowledgedInsight = analysis.insights.find(
    i => i.signal === 'submitted with acknowledged risks' &&
         i.confidence !== 'low' &&
         i.winRateDelta <= -MIN_MEANINGFUL_DELTA
  );

  if (!acknowledgedInsight) return null;

  // Strong negative correlation with acknowledged risks
  // Suggest increasing the penalty multiplier for persona mismatches
  // (as a proxy for "proceed despite issues")
  const currentMultiplier = config.penalties.personaMismatchMultiplier;
  const newMultiplier = Math.max(
    currentMultiplier - MAX_PENALTY_ADJUSTMENT,
    0.6 // Don't go below 60%
  );

  if (newMultiplier >= currentMultiplier) return null;

  const change: ConfigChange = {
    path: 'penalties.personaMismatchMultiplier',
    from: currentMultiplier,
    to: newMultiplier,
    description: `Persona mismatch penalty: ${((1 - currentMultiplier) * 100).toFixed(0)}% → ${((1 - newMultiplier) * 100).toFixed(0)}%`,
  };

  return {
    id: generateSuggestionId('penalty', 2),
    title: 'Increase Acknowledged Risk Impact',
    description: `RFPs submitted despite acknowledged risks show ${acknowledgedInsight.winRateDelta}% lower win rate. Consider stricter scoring for unresolved issues.`,
    changes: [change],
    expectedImpact: 'moderate',
    risk: 'low',
    confidence: acknowledgedInsight.confidence,
    rationale: createRationale(acknowledgedInsight),
    category: 'penalty',
  };
}

/**
 * Analyze proof gaps and suggest penalty adjustments
 */
function suggestProofGapPenalty(
  analysis: OutcomeAnalysisResult,
  config: BidReadinessConfig
): ReadinessTuningSuggestion | null {
  // Check loss reasons for patterns related to proof/experience
  const experienceLoss = analysis.lossReasons.find(r => r.reason === 'experience');
  const fitLoss = analysis.lossReasons.find(r => r.reason === 'fit');

  if (!experienceLoss && !fitLoss) return null;

  const totalLost = analysis.totalAnalyzed - Math.round(analysis.overallWinRate * analysis.completeRecords / 100);

  // If "lacked experience" is cited in >20% of losses, suggest increasing proof gap penalty
  const experiencePercent = experienceLoss?.percentage || 0;
  const fitPercent = fitLoss?.percentage || 0;

  if (experiencePercent + fitPercent >= 25) {
    const currentPenalty = config.penalties.proofGapPenalty;
    const newPenalty = Math.min(currentPenalty + 1, 5);

    if (newPenalty <= currentPenalty) return null;

    const change: ConfigChange = {
      path: 'penalties.proofGapPenalty',
      from: currentPenalty,
      to: newPenalty,
      description: `Proof gap penalty: -${currentPenalty}pts/gap → -${newPenalty}pts/gap`,
    };

    return {
      id: generateSuggestionId('penalty', 3),
      title: 'Increase Proof Gap Penalty',
      description: `"Lacked experience" and "poor fit" cited in ${experiencePercent + fitPercent}% of losses. Consider penalizing proof gaps more heavily.`,
      changes: [change],
      expectedImpact: 'moderate',
      risk: 'low',
      confidence: 'medium', // Based on loss reason analysis
      rationale: [
        { label: 'Experience gap', type: 'signal' },
        { label: `${experiencePercent}% of losses`, type: 'correlation', value: experiencePercent },
        { label: `${analysis.lossReasons.length} reasons analyzed`, type: 'sample_size' },
      ],
      category: 'penalty',
    };
  }

  return null;
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Generate tuning suggestions based on outcome analysis
 *
 * @param analysis - The outcome analysis result
 * @param config - Current bid readiness config (optional, uses default if not provided)
 * @returns Sorted list of tuning suggestions
 */
export function suggestReadinessTuning(
  analysis: OutcomeAnalysisResult,
  config?: BidReadinessConfig
): TuningSuggestionResult {
  const currentConfig = config ?? getBidReadinessConfig();

  // Check if we have enough data
  if (analysis.completeRecords < MIN_SAMPLE_SIZE_FOR_SUGGESTIONS) {
    return {
      suggestions: [],
      currentConfig,
      hasEnoughData: false,
      insufficientDataMessage: `Need at least ${MIN_SAMPLE_SIZE_FOR_SUGGESTIONS} completed RFPs with outcomes. Currently have ${analysis.completeRecords}.`,
    };
  }

  if (!analysis.isStatisticallyMeaningful) {
    return {
      suggestions: [],
      currentConfig,
      hasEnoughData: false,
      insufficientDataMessage: 'Not enough data for statistically meaningful analysis yet.',
    };
  }

  // Collect suggestions from all heuristics
  const suggestions: ReadinessTuningSuggestion[] = [];

  const criticalRiskSuggestion = suggestCriticalRiskPenalty(analysis, currentConfig);
  if (criticalRiskSuggestion) suggestions.push(criticalRiskSuggestion);

  const goThresholdSuggestion = suggestGoThresholdAdjustment(analysis, currentConfig);
  if (goThresholdSuggestion) suggestions.push(goThresholdSuggestion);

  const conditionalSuggestion = suggestConditionalThresholdAdjustment(analysis, currentConfig);
  if (conditionalSuggestion) suggestions.push(conditionalSuggestion);

  const acknowledgedRiskSuggestion = suggestAcknowledgedRiskPenalty(analysis, currentConfig);
  if (acknowledgedRiskSuggestion) suggestions.push(acknowledgedRiskSuggestion);

  const proofGapSuggestion = suggestProofGapPenalty(analysis, currentConfig);
  if (proofGapSuggestion) suggestions.push(proofGapSuggestion);

  // Sort by confidence (high first), then by impact (significant first)
  const confidenceOrder = { high: 0, medium: 1, low: 2 };
  const impactOrder = { significant: 0, moderate: 1, minor: 2 };

  suggestions.sort((a, b) => {
    const confDiff = confidenceOrder[a.confidence] - confidenceOrder[b.confidence];
    if (confDiff !== 0) return confDiff;
    return impactOrder[a.expectedImpact] - impactOrder[b.expectedImpact];
  });

  return {
    suggestions,
    currentConfig,
    hasEnoughData: true,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Apply a suggestion to create a new config (for simulation)
 */
export function applySuggestion(
  config: BidReadinessConfig,
  suggestion: ReadinessTuningSuggestion
): BidReadinessConfig {
  const newConfig: BidReadinessConfig = JSON.parse(JSON.stringify(config));

  for (const change of suggestion.changes) {
    const parts = change.path.split('.');
    if (parts.length === 2) {
      const [section, key] = parts;
      if (section === 'weights' && key in newConfig.weights) {
        (newConfig.weights as any)[key] = change.to;
      } else if (section === 'thresholds' && key in newConfig.thresholds) {
        (newConfig.thresholds as any)[key] = change.to;
      } else if (section === 'penalties' && key in newConfig.penalties) {
        (newConfig.penalties as any)[key] = change.to;
      } else if (section === 'riskThresholds' && key in newConfig.riskThresholds) {
        (newConfig.riskThresholds as any)[key] = change.to;
      }
    }
  }

  // Increment version
  const [major, minor, patch] = newConfig.version.split('.').map(Number);
  newConfig.version = `${major}.${minor}.${patch + 1}`;

  return newConfig;
}

/**
 * Generate a JSON patch for clipboard copying
 */
export function generatePatchForClipboard(suggestions: ReadinessTuningSuggestion[]): string {
  const patch: Record<string, number> = {};

  for (const suggestion of suggestions) {
    for (const change of suggestion.changes) {
      patch[change.path] = change.to;
    }
  }

  return JSON.stringify(patch, null, 2);
}

/**
 * Get human-readable summary of suggestions
 */
export function getSuggestionsSummary(result: TuningSuggestionResult): string {
  if (!result.hasEnoughData) {
    return result.insufficientDataMessage || 'Not enough data for suggestions.';
  }

  if (result.suggestions.length === 0) {
    return 'No calibration suggestions at this time. Current config appears well-tuned based on outcome data.';
  }

  const highConf = result.suggestions.filter(s => s.confidence === 'high').length;
  const medConf = result.suggestions.filter(s => s.confidence === 'medium').length;

  if (highConf > 0) {
    return `${result.suggestions.length} calibration suggestion(s) available, ${highConf} with high confidence.`;
  }

  return `${result.suggestions.length} calibration suggestion(s) available with ${medConf > 0 ? 'medium' : 'low'} confidence.`;
}
