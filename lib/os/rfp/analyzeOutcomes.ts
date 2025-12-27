// lib/os/rfp/analyzeOutcomes.ts
// Outcome Correlation Analysis for RFPs
//
// Analyzes historical RFP outcomes (won/lost) against submission readiness signals
// to identify correlations and surface insights. Read-only analysis - no auto-tuning.

import type { SubmissionSnapshot } from '@/components/os/rfp/SubmissionReadinessModal';

// ============================================================================
// Types
// ============================================================================

/**
 * RFP data required for outcome analysis
 */
export interface RfpOutcomeRecord {
  /** RFP ID */
  id: string;
  /** Submission snapshot captured at export time */
  submissionSnapshot: SubmissionSnapshot | null;
  /** Final outcome */
  outcome: 'won' | 'lost' | null;
  /** Optional loss reason tags */
  lossReasonTags?: string[];
  /** Optional outcome notes */
  outcomeNotes?: string;
}

/**
 * A single insight from outcome correlation analysis
 */
export interface OutcomeInsight {
  /** Signal being analyzed (e.g., "score >= 70", "recommendation = go") */
  signal: string;
  /** Win rate delta vs baseline (e.g., +15 means 15% higher win rate) */
  winRateDelta: number;
  /** Number of RFPs in this signal bucket */
  sampleSize: number;
  /** Confidence level based on sample size */
  confidence: 'low' | 'medium' | 'high';
  /** Optional recommendation based on insight */
  recommendation?: string;
  /** Category of insight */
  category: 'score_threshold' | 'recommendation' | 'risk' | 'acknowledgement';
}

/**
 * Breakdown analysis for a specific component
 */
export interface ComponentCorrelation {
  /** Component name (e.g., "firmBrainReadiness") */
  component: string;
  /** Display label */
  label: string;
  /** Average score in won RFPs */
  avgWonScore: number;
  /** Average score in lost RFPs */
  avgLostScore: number;
  /** Score delta (won - lost) */
  scoreDelta: number;
  /** Sample size for this component */
  sampleSize: number;
  /** Whether this component appears predictive */
  isPredictive: boolean;
}

/**
 * Loss reason frequency analysis
 */
export interface LossReasonAnalysis {
  /** Loss reason tag */
  reason: string;
  /** Number of times cited */
  count: number;
  /** Percentage of lost RFPs with this reason */
  percentage: number;
  /** Average readiness score when this reason was cited */
  avgReadinessScore: number;
}

/**
 * Complete outcome analysis result
 */
export interface OutcomeAnalysisResult {
  /** Total RFPs analyzed */
  totalAnalyzed: number;
  /** RFPs with complete data (snapshot + outcome) */
  completeRecords: number;
  /** Overall win rate */
  overallWinRate: number;
  /** Key insights discovered */
  insights: OutcomeInsight[];
  /** Component-level correlations */
  componentCorrelations: ComponentCorrelation[];
  /** Loss reason breakdown */
  lossReasons: LossReasonAnalysis[];
  /** Whether analysis is statistically meaningful */
  isStatisticallyMeaningful: boolean;
  /** Minimum sample size recommendation */
  minimumSampleRecommendation: number;
}

// ============================================================================
// Configuration
// ============================================================================

/** Minimum samples needed for each confidence level */
const CONFIDENCE_THRESHOLDS = {
  high: 20,    // 20+ samples = high confidence
  medium: 10,  // 10-19 samples = medium confidence
  low: 3,      // 3-9 samples = low confidence
  // < 3 samples = insufficient
};

/** Score thresholds to analyze */
const SCORE_THRESHOLDS = [50, 60, 70, 80];

/** Minimum records for meaningful analysis */
const MINIMUM_MEANINGFUL_SAMPLE = 5;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get confidence level based on sample size
 */
function getConfidence(sampleSize: number): 'low' | 'medium' | 'high' {
  if (sampleSize >= CONFIDENCE_THRESHOLDS.high) return 'high';
  if (sampleSize >= CONFIDENCE_THRESHOLDS.medium) return 'medium';
  return 'low';
}

/**
 * Calculate win rate from a set of records
 */
function calculateWinRate(records: RfpOutcomeRecord[]): number {
  const withOutcome = records.filter(r => r.outcome === 'won' || r.outcome === 'lost');
  if (withOutcome.length === 0) return 0;
  const won = withOutcome.filter(r => r.outcome === 'won').length;
  return Math.round((won / withOutcome.length) * 100);
}

/**
 * Filter records to those with complete data
 */
function getCompleteRecords(records: RfpOutcomeRecord[]): RfpOutcomeRecord[] {
  return records.filter(
    r => r.submissionSnapshot !== null && (r.outcome === 'won' || r.outcome === 'lost')
  );
}

/**
 * Generate recommendation text based on insight
 */
function generateRecommendation(
  signal: string,
  winRateDelta: number,
  confidence: 'low' | 'medium' | 'high'
): string | undefined {
  if (confidence === 'low') return undefined;

  if (winRateDelta >= 20) {
    return `Strong positive correlation. Prioritize achieving ${signal}.`;
  } else if (winRateDelta >= 10) {
    return `Moderate positive correlation. ${signal} appears beneficial.`;
  } else if (winRateDelta <= -20) {
    return `Strong negative correlation. Investigate why ${signal} correlates with losses.`;
  } else if (winRateDelta <= -10) {
    return `Moderate negative correlation. Review process when ${signal}.`;
  }
  return undefined;
}

// ============================================================================
// Analysis Functions
// ============================================================================

/**
 * Analyze score threshold correlations
 */
function analyzeScoreThresholds(
  completeRecords: RfpOutcomeRecord[],
  baselineWinRate: number
): OutcomeInsight[] {
  const insights: OutcomeInsight[] = [];

  for (const threshold of SCORE_THRESHOLDS) {
    const above = completeRecords.filter(
      r => r.submissionSnapshot!.score >= threshold
    );
    const below = completeRecords.filter(
      r => r.submissionSnapshot!.score < threshold
    );

    if (above.length >= CONFIDENCE_THRESHOLDS.low) {
      const winRate = calculateWinRate(above);
      const delta = winRate - baselineWinRate;
      const confidence = getConfidence(above.length);

      insights.push({
        signal: `score >= ${threshold}`,
        winRateDelta: delta,
        sampleSize: above.length,
        confidence,
        category: 'score_threshold',
        recommendation: generateRecommendation(`score >= ${threshold}`, delta, confidence),
      });
    }

    if (below.length >= CONFIDENCE_THRESHOLDS.low) {
      const winRate = calculateWinRate(below);
      const delta = winRate - baselineWinRate;
      const confidence = getConfidence(below.length);

      insights.push({
        signal: `score < ${threshold}`,
        winRateDelta: delta,
        sampleSize: below.length,
        confidence,
        category: 'score_threshold',
        recommendation: generateRecommendation(`score < ${threshold}`, delta, confidence),
      });
    }
  }

  return insights;
}

/**
 * Analyze recommendation correlations
 */
function analyzeRecommendations(
  completeRecords: RfpOutcomeRecord[],
  baselineWinRate: number
): OutcomeInsight[] {
  const insights: OutcomeInsight[] = [];
  const recommendations: Array<'go' | 'conditional' | 'no_go'> = ['go', 'conditional', 'no_go'];

  for (const rec of recommendations) {
    const matching = completeRecords.filter(
      r => r.submissionSnapshot!.recommendation === rec
    );

    if (matching.length >= CONFIDENCE_THRESHOLDS.low) {
      const winRate = calculateWinRate(matching);
      const delta = winRate - baselineWinRate;
      const confidence = getConfidence(matching.length);

      const label = rec === 'go' ? 'Go' : rec === 'conditional' ? 'Conditional Go' : 'No-Go';

      insights.push({
        signal: `recommendation = ${label}`,
        winRateDelta: delta,
        sampleSize: matching.length,
        confidence,
        category: 'recommendation',
        recommendation: generateRecommendation(`recommendation = ${label}`, delta, confidence),
      });
    }
  }

  return insights;
}

/**
 * Analyze risk acknowledgement correlations
 */
function analyzeRiskAcknowledgement(
  completeRecords: RfpOutcomeRecord[],
  baselineWinRate: number
): OutcomeInsight[] {
  const insights: OutcomeInsight[] = [];

  // RFPs where risks were acknowledged
  const acknowledged = completeRecords.filter(
    r => r.submissionSnapshot!.risksAcknowledged &&
         r.submissionSnapshot!.acknowledgedRisks.length > 0
  );

  // RFPs with no risks or not requiring acknowledgement
  const noRisks = completeRecords.filter(
    r => r.submissionSnapshot!.acknowledgedRisks.length === 0
  );

  if (acknowledged.length >= CONFIDENCE_THRESHOLDS.low) {
    const winRate = calculateWinRate(acknowledged);
    const delta = winRate - baselineWinRate;
    const confidence = getConfidence(acknowledged.length);

    insights.push({
      signal: 'submitted with acknowledged risks',
      winRateDelta: delta,
      sampleSize: acknowledged.length,
      confidence,
      category: 'acknowledgement',
      recommendation: delta < -10 && confidence !== 'low'
        ? 'Consider addressing risks before submission rather than just acknowledging them.'
        : undefined,
    });
  }

  if (noRisks.length >= CONFIDENCE_THRESHOLDS.low) {
    const winRate = calculateWinRate(noRisks);
    const delta = winRate - baselineWinRate;
    const confidence = getConfidence(noRisks.length);

    insights.push({
      signal: 'submitted with no outstanding risks',
      winRateDelta: delta,
      sampleSize: noRisks.length,
      confidence,
      category: 'acknowledgement',
    });
  }

  // Analyze by risk severity
  const withCritical = completeRecords.filter(
    r => r.submissionSnapshot!.acknowledgedRisks.some(risk => risk.severity === 'critical')
  );

  if (withCritical.length >= CONFIDENCE_THRESHOLDS.low) {
    const winRate = calculateWinRate(withCritical);
    const delta = winRate - baselineWinRate;
    const confidence = getConfidence(withCritical.length);

    insights.push({
      signal: 'submitted with critical risks',
      winRateDelta: delta,
      sampleSize: withCritical.length,
      confidence,
      category: 'risk',
      recommendation: delta < -15 && confidence !== 'low'
        ? 'Critical risks strongly correlate with losses. Prioritize resolving before submission.'
        : undefined,
    });
  }

  return insights;
}

/**
 * Analyze component-level correlations
 * Note: This requires access to the full breakdown, which isn't stored in SubmissionSnapshot.
 * For now, we analyze the overall score. Future: store breakdown in snapshot.
 */
function analyzeComponentCorrelations(
  completeRecords: RfpOutcomeRecord[]
): ComponentCorrelation[] {
  // Currently we only have overall score in the snapshot.
  // To analyze components, we'd need to either:
  // 1. Store breakdown in SubmissionSnapshot
  // 2. Re-compute from source data at analysis time
  // For now, return empty - this is a future enhancement.
  return [];
}

/**
 * Analyze loss reasons
 */
function analyzeLossReasons(records: RfpOutcomeRecord[]): LossReasonAnalysis[] {
  const lostRecords = records.filter(
    r => r.outcome === 'lost' && r.lossReasonTags && r.lossReasonTags.length > 0
  );

  if (lostRecords.length === 0) return [];

  const reasonCounts = new Map<string, { count: number; scores: number[] }>();

  for (const record of lostRecords) {
    for (const reason of record.lossReasonTags!) {
      const existing = reasonCounts.get(reason) || { count: 0, scores: [] };
      existing.count++;
      if (record.submissionSnapshot) {
        existing.scores.push(record.submissionSnapshot.score);
      }
      reasonCounts.set(reason, existing);
    }
  }

  const totalLost = records.filter(r => r.outcome === 'lost').length;

  return Array.from(reasonCounts.entries())
    .map(([reason, data]) => ({
      reason,
      count: data.count,
      percentage: Math.round((data.count / totalLost) * 100),
      avgReadinessScore: data.scores.length > 0
        ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length)
        : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

// ============================================================================
// Main Analysis Function
// ============================================================================

/**
 * Analyze RFP outcomes against readiness signals
 *
 * @param records - Array of RFPs with outcome data
 * @returns Complete analysis result with insights and correlations
 */
export function analyzeOutcomes(records: RfpOutcomeRecord[]): OutcomeAnalysisResult {
  const completeRecords = getCompleteRecords(records);
  const baselineWinRate = calculateWinRate(completeRecords);
  const isStatisticallyMeaningful = completeRecords.length >= MINIMUM_MEANINGFUL_SAMPLE;

  // Collect all insights
  const insights: OutcomeInsight[] = [];

  if (completeRecords.length >= CONFIDENCE_THRESHOLDS.low) {
    insights.push(...analyzeScoreThresholds(completeRecords, baselineWinRate));
    insights.push(...analyzeRecommendations(completeRecords, baselineWinRate));
    insights.push(...analyzeRiskAcknowledgement(completeRecords, baselineWinRate));
  }

  // Sort insights by absolute delta (most impactful first)
  insights.sort((a, b) => Math.abs(b.winRateDelta) - Math.abs(a.winRateDelta));

  // Analyze components and loss reasons
  const componentCorrelations = analyzeComponentCorrelations(completeRecords);
  const lossReasons = analyzeLossReasons(records);

  return {
    totalAnalyzed: records.length,
    completeRecords: completeRecords.length,
    overallWinRate: baselineWinRate,
    insights,
    componentCorrelations,
    lossReasons,
    isStatisticallyMeaningful,
    minimumSampleRecommendation: MINIMUM_MEANINGFUL_SAMPLE,
  };
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Get the top N most significant insights
 */
export function getTopInsights(
  result: OutcomeAnalysisResult,
  limit: number = 5
): OutcomeInsight[] {
  return result.insights
    .filter(i => i.confidence !== 'low' || Math.abs(i.winRateDelta) >= 20)
    .slice(0, limit);
}

/**
 * Get insights for a specific category
 */
export function getInsightsByCategory(
  result: OutcomeAnalysisResult,
  category: OutcomeInsight['category']
): OutcomeInsight[] {
  return result.insights.filter(i => i.category === category);
}

/**
 * Check if the analysis suggests the readiness system is predictive
 */
export function isReadinessPredictive(result: OutcomeAnalysisResult): boolean {
  // Check if high-score RFPs have meaningfully higher win rates
  const highScoreInsight = result.insights.find(
    i => i.signal === 'score >= 70' && i.confidence !== 'low'
  );

  const goRecommendationInsight = result.insights.find(
    i => i.signal === 'recommendation = Go' && i.confidence !== 'low'
  );

  // Predictive if either high score OR go recommendation correlates with +10% win rate
  const highScorePredictive = highScoreInsight && highScoreInsight.winRateDelta >= 10;
  const goPredictive = goRecommendationInsight && goRecommendationInsight.winRateDelta >= 10;

  return Boolean(highScorePredictive || goPredictive);
}

/**
 * Generate a summary sentence for the analysis
 */
export function getAnalysisSummary(result: OutcomeAnalysisResult): string {
  if (!result.isStatisticallyMeaningful) {
    return `Insufficient data for analysis. Need at least ${result.minimumSampleRecommendation} completed RFPs with outcomes.`;
  }

  const predictive = isReadinessPredictive(result);
  const topInsight = result.insights[0];

  if (!topInsight) {
    return `Analyzed ${result.completeRecords} RFPs with a ${result.overallWinRate}% win rate. No significant correlations found yet.`;
  }

  if (predictive) {
    return `Readiness signals are predictive. RFPs with ${topInsight.signal} have a ${topInsight.winRateDelta > 0 ? '+' : ''}${topInsight.winRateDelta}% win rate vs baseline.`;
  }

  return `Analyzed ${result.completeRecords} RFPs with a ${result.overallWinRate}% win rate. ${topInsight.signal} shows ${topInsight.winRateDelta > 0 ? '+' : ''}${topInsight.winRateDelta}% impact.`;
}
