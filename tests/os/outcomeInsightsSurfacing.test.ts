// tests/os/outcomeInsightsSurfacing.test.ts
// Tests for Outcome Insights surfacing (API, filtering, callouts)
// Includes firm-scoped (institutional) insights

import { describe, test, expect } from 'vitest';
import {
  getRelevantInsights,
  getSubmissionInsights,
  hasValidInsights,
  hasFirmInsightsForDisplay,
  FIRM_INSIGHTS_MIN_SAMPLE,
  type OutcomeInsightsData,
  type FirmOutcomeInsightsData,
} from '@/hooks/useOutcomeInsights';
import type { BidReadiness } from '@/lib/os/rfp/computeBidReadiness';
import type { OutcomeInsight, OutcomeAnalysisResult } from '@/lib/os/rfp/analyzeOutcomes';

// ============================================================================
// Mock Data Helpers
// ============================================================================

function createMockInsight(options: {
  signal: string;
  winRateDelta: number;
  confidence: 'low' | 'medium' | 'high';
  category: OutcomeInsight['category'];
  sampleSize?: number;
}): OutcomeInsight {
  return {
    signal: options.signal,
    winRateDelta: options.winRateDelta,
    confidence: options.confidence,
    category: options.category,
    sampleSize: options.sampleSize ?? 15,
  };
}

function createMockAnalysis(options: {
  isStatisticallyMeaningful?: boolean;
  completeRecords?: number;
  overallWinRate?: number;
}): OutcomeAnalysisResult {
  return {
    totalAnalyzed: 20,
    completeRecords: options.completeRecords ?? 15,
    overallWinRate: options.overallWinRate ?? 50,
    insights: [],
    componentCorrelations: [],
    lossReasons: [],
    isStatisticallyMeaningful: options.isStatisticallyMeaningful ?? true,
    minimumSampleRecommendation: 5,
  };
}

function createMockInsightsData(options: {
  isStatisticallyMeaningful?: boolean;
  scoreThresholdInsights?: OutcomeInsight[];
  recommendationInsights?: OutcomeInsight[];
  acknowledgementInsights?: OutcomeInsight[];
  riskInsights?: OutcomeInsight[];
}): OutcomeInsightsData {
  const analysis = createMockAnalysis({
    isStatisticallyMeaningful: options.isStatisticallyMeaningful,
  });

  const insightsByCategory = {
    score_threshold: options.scoreThresholdInsights ?? [],
    recommendation: options.recommendationInsights ?? [],
    acknowledgement: options.acknowledgementInsights ?? [],
    risk: options.riskInsights ?? [],
  };

  return {
    analysis,
    topInsights: [
      ...insightsByCategory.score_threshold,
      ...insightsByCategory.recommendation,
      ...insightsByCategory.acknowledgement,
      ...insightsByCategory.risk,
    ].slice(0, 5),
    isPredictive: false,
    summary: 'Test summary',
    insightsByCategory,
  };
}

function createMockReadiness(options: {
  score: number;
  recommendation: 'go' | 'conditional' | 'no_go';
  hasCriticalRisks?: boolean;
  hasRisks?: boolean;
}): BidReadiness {
  const risks = [];
  if (options.hasCriticalRisks) {
    risks.push({
      category: 'coverage' as const,
      severity: 'critical' as const,
      description: 'Critical coverage gap',
    });
  } else if (options.hasRisks) {
    risks.push({
      category: 'coverage' as const,
      severity: 'medium' as const,
      description: 'Medium coverage gap',
    });
  }

  return {
    score: options.score,
    recommendation: options.recommendation,
    reasons: [],
    topRisks: risks,
    highestImpactFixes: [],
    breakdown: {
      firmBrainReadiness: options.score,
      winStrategyHealth: options.score,
      rubricCoverageHealth: options.score,
      proofCoverage: options.score,
      personaAlignment: options.score,
      weights: { firmBrain: 0.25, strategy: 0.20, coverage: 0.25, proof: 0.15, persona: 0.15 },
    },
    isReliableAssessment: true,
  };
}

// ============================================================================
// hasValidInsights Tests
// ============================================================================

describe('hasValidInsights', () => {
  test('returns false when insights is null', () => {
    expect(hasValidInsights(null)).toBe(false);
  });

  test('returns false when analysis is not statistically meaningful', () => {
    const insights = createMockInsightsData({ isStatisticallyMeaningful: false });
    expect(hasValidInsights(insights)).toBe(false);
  });

  test('returns false when all insights are low confidence', () => {
    const insights = createMockInsightsData({
      isStatisticallyMeaningful: true,
      scoreThresholdInsights: [
        createMockInsight({ signal: 'score >= 70', winRateDelta: 10, confidence: 'low', category: 'score_threshold' }),
      ],
    });
    insights.topInsights = [insights.insightsByCategory.score_threshold[0]];
    expect(hasValidInsights(insights)).toBe(false);
  });

  test('returns true when at least one insight is medium confidence', () => {
    const insights = createMockInsightsData({
      isStatisticallyMeaningful: true,
      scoreThresholdInsights: [
        createMockInsight({ signal: 'score >= 70', winRateDelta: 10, confidence: 'medium', category: 'score_threshold' }),
      ],
    });
    insights.topInsights = [insights.insightsByCategory.score_threshold[0]];
    expect(hasValidInsights(insights)).toBe(true);
  });

  test('returns true when at least one insight is high confidence', () => {
    const insights = createMockInsightsData({
      isStatisticallyMeaningful: true,
      recommendationInsights: [
        createMockInsight({ signal: 'recommendation = Go', winRateDelta: 15, confidence: 'high', category: 'recommendation' }),
      ],
    });
    insights.topInsights = [insights.insightsByCategory.recommendation[0]];
    expect(hasValidInsights(insights)).toBe(true);
  });
});

// ============================================================================
// getRelevantInsights Tests
// ============================================================================

describe('getRelevantInsights', () => {
  test('returns empty array when insights is null', () => {
    const readiness = createMockReadiness({ score: 75, recommendation: 'go' });
    expect(getRelevantInsights(null, readiness)).toEqual([]);
  });

  test('returns empty array when analysis is not statistically meaningful', () => {
    const insights = createMockInsightsData({ isStatisticallyMeaningful: false });
    const readiness = createMockReadiness({ score: 75, recommendation: 'go' });
    expect(getRelevantInsights(insights, readiness)).toEqual([]);
  });

  test('returns critical risk insight when RFP has critical risks', () => {
    const insights = createMockInsightsData({
      riskInsights: [
        createMockInsight({
          signal: 'submitted with critical risks',
          winRateDelta: -25,
          confidence: 'medium',
          category: 'risk',
        }),
      ],
    });
    const readiness = createMockReadiness({
      score: 40,
      recommendation: 'no_go',
      hasCriticalRisks: true,
    });

    const relevant = getRelevantInsights(insights, readiness);
    expect(relevant.length).toBeGreaterThan(0);
    expect(relevant[0].insight.signal).toBe('submitted with critical risks');
    expect(relevant[0].relevanceReason).toContain('critical risks');
  });

  test('returns acknowledged risks insight when RFP has risks', () => {
    const insights = createMockInsightsData({
      acknowledgementInsights: [
        createMockInsight({
          signal: 'submitted with acknowledged risks',
          winRateDelta: -15,
          confidence: 'medium',
          category: 'acknowledgement',
        }),
      ],
    });
    const readiness = createMockReadiness({
      score: 55,
      recommendation: 'conditional',
      hasRisks: true,
    });

    const relevant = getRelevantInsights(insights, readiness);
    expect(relevant.some(r => r.insight.signal === 'submitted with acknowledged risks')).toBe(true);
  });

  test('returns recommendation insight matching current recommendation', () => {
    const insights = createMockInsightsData({
      recommendationInsights: [
        createMockInsight({
          signal: 'recommendation = Conditional Go',
          winRateDelta: -12,
          confidence: 'medium',
          category: 'recommendation',
        }),
      ],
    });
    const readiness = createMockReadiness({
      score: 55,
      recommendation: 'conditional',
    });

    const relevant = getRelevantInsights(insights, readiness);
    expect(relevant.some(r => r.insight.signal === 'recommendation = Conditional Go')).toBe(true);
  });

  test('filters out low confidence insights', () => {
    const insights = createMockInsightsData({
      recommendationInsights: [
        createMockInsight({
          signal: 'recommendation = Go',
          winRateDelta: 20,
          confidence: 'low', // Low confidence
          category: 'recommendation',
        }),
      ],
    });
    const readiness = createMockReadiness({
      score: 80,
      recommendation: 'go',
    });

    const relevant = getRelevantInsights(insights, readiness);
    expect(relevant.every(r => r.insight.confidence !== 'low')).toBe(true);
  });

  test('limits results to maxInsights', () => {
    const insights = createMockInsightsData({
      riskInsights: [
        createMockInsight({
          signal: 'submitted with critical risks',
          winRateDelta: -25,
          confidence: 'high',
          category: 'risk',
        }),
      ],
      acknowledgementInsights: [
        createMockInsight({
          signal: 'submitted with acknowledged risks',
          winRateDelta: -15,
          confidence: 'high',
          category: 'acknowledgement',
        }),
      ],
      recommendationInsights: [
        createMockInsight({
          signal: 'recommendation = No-Go',
          winRateDelta: -30,
          confidence: 'high',
          category: 'recommendation',
        }),
      ],
    });
    const readiness = createMockReadiness({
      score: 30,
      recommendation: 'no_go',
      hasCriticalRisks: true,
    });

    const relevant = getRelevantInsights(insights, readiness, 1);
    expect(relevant.length).toBe(1);
  });
});

// ============================================================================
// getSubmissionInsights Tests
// ============================================================================

describe('getSubmissionInsights', () => {
  test('returns empty array when insights is null', () => {
    expect(getSubmissionInsights(null, 'conditional', true, true)).toEqual([]);
  });

  test('returns empty array when analysis is not statistically meaningful', () => {
    const insights = createMockInsightsData({ isStatisticallyMeaningful: false });
    expect(getSubmissionInsights(insights, 'conditional', true, true)).toEqual([]);
  });

  test('returns critical risk insight for conditional/no_go with critical risks', () => {
    const insights = createMockInsightsData({
      riskInsights: [
        createMockInsight({
          signal: 'submitted with critical risks',
          winRateDelta: -25,
          confidence: 'high',
          category: 'risk',
        }),
      ],
    });

    const relevant = getSubmissionInsights(insights, 'no_go', true, true);
    expect(relevant.some(r => r.insight.signal === 'submitted with critical risks')).toBe(true);
  });

  test('returns acknowledged risks insight when has acknowledged risks', () => {
    const insights = createMockInsightsData({
      acknowledgementInsights: [
        createMockInsight({
          signal: 'submitted with acknowledged risks',
          winRateDelta: -10,
          confidence: 'medium',
          category: 'acknowledgement',
        }),
      ],
    });

    const relevant = getSubmissionInsights(insights, 'conditional', false, true);
    expect(relevant.some(r => r.insight.signal === 'submitted with acknowledged risks')).toBe(true);
  });

  test('returns recommendation insight with sufficient delta', () => {
    const insights = createMockInsightsData({
      recommendationInsights: [
        createMockInsight({
          signal: 'recommendation = Conditional Go',
          winRateDelta: -15,
          confidence: 'medium',
          category: 'recommendation',
        }),
      ],
    });

    const relevant = getSubmissionInsights(insights, 'conditional', false, false);
    expect(relevant.some(r => r.insight.signal === 'recommendation = Conditional Go')).toBe(true);
  });

  test('filters out low confidence insights', () => {
    const insights = createMockInsightsData({
      riskInsights: [
        createMockInsight({
          signal: 'submitted with critical risks',
          winRateDelta: -25,
          confidence: 'low', // Low confidence
          category: 'risk',
        }),
      ],
    });

    const relevant = getSubmissionInsights(insights, 'no_go', true, true);
    expect(relevant).toEqual([]);
  });

  test('limits results to maxInsights', () => {
    const insights = createMockInsightsData({
      riskInsights: [
        createMockInsight({
          signal: 'submitted with critical risks',
          winRateDelta: -25,
          confidence: 'high',
          category: 'risk',
        }),
      ],
      acknowledgementInsights: [
        createMockInsight({
          signal: 'submitted with acknowledged risks',
          winRateDelta: -15,
          confidence: 'high',
          category: 'acknowledgement',
        }),
      ],
      recommendationInsights: [
        createMockInsight({
          signal: 'recommendation = No-Go',
          winRateDelta: -30,
          confidence: 'high',
          category: 'recommendation',
        }),
      ],
    });

    const relevant = getSubmissionInsights(insights, 'no_go', true, true, 1);
    expect(relevant.length).toBe(1);
  });
});

// ============================================================================
// Confidence Threshold Tests
// ============================================================================

describe('Confidence Thresholds', () => {
  test('medium confidence insights are included', () => {
    const insights = createMockInsightsData({
      scoreThresholdInsights: [
        createMockInsight({
          signal: 'score >= 70',
          winRateDelta: 15,
          confidence: 'medium',
          category: 'score_threshold',
        }),
      ],
    });
    const readiness = createMockReadiness({ score: 75, recommendation: 'go' });

    const relevant = getRelevantInsights(insights, readiness);
    // Should match score threshold
    expect(relevant.some(r => r.insight.signal === 'score >= 70')).toBe(true);
  });

  test('high confidence insights are included', () => {
    const insights = createMockInsightsData({
      recommendationInsights: [
        createMockInsight({
          signal: 'recommendation = Go',
          winRateDelta: 20,
          confidence: 'high',
          category: 'recommendation',
        }),
      ],
    });
    const readiness = createMockReadiness({ score: 80, recommendation: 'go' });

    const relevant = getRelevantInsights(insights, readiness);
    expect(relevant.some(r => r.insight.signal === 'recommendation = Go')).toBe(true);
  });

  test('low confidence insights are excluded even with high delta', () => {
    const insights = createMockInsightsData({
      recommendationInsights: [
        createMockInsight({
          signal: 'recommendation = Go',
          winRateDelta: 50, // Very high delta
          confidence: 'low', // But low confidence
          category: 'recommendation',
        }),
      ],
    });
    const readiness = createMockReadiness({ score: 80, recommendation: 'go' });

    const relevant = getRelevantInsights(insights, readiness);
    expect(relevant.filter(r => r.insight.signal === 'recommendation = Go').length).toBe(0);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  test('handles empty insightsByCategory gracefully', () => {
    const insights = createMockInsightsData({});
    const readiness = createMockReadiness({
      score: 50,
      recommendation: 'conditional',
      hasRisks: true,
    });

    const relevant = getRelevantInsights(insights, readiness);
    expect(relevant).toEqual([]);
  });

  test('handles readiness with no risks', () => {
    const insights = createMockInsightsData({
      recommendationInsights: [
        createMockInsight({
          signal: 'recommendation = Go',
          winRateDelta: 15,
          confidence: 'medium',
          category: 'recommendation',
        }),
      ],
    });
    const readiness = createMockReadiness({
      score: 80,
      recommendation: 'go',
      hasRisks: false,
    });

    const relevant = getRelevantInsights(insights, readiness);
    // Should still match recommendation
    expect(relevant.some(r => r.insight.signal === 'recommendation = Go')).toBe(true);
  });

  test('ignores insights with small win rate delta', () => {
    const insights = createMockInsightsData({
      acknowledgementInsights: [
        createMockInsight({
          signal: 'submitted with acknowledged risks',
          winRateDelta: 3, // Small delta
          confidence: 'high',
          category: 'acknowledgement',
        }),
      ],
    });
    const readiness = createMockReadiness({
      score: 55,
      recommendation: 'conditional',
      hasRisks: true,
    });

    const relevant = getRelevantInsights(insights, readiness);
    // Should not include insight with small delta
    expect(relevant.filter(r => r.insight.signal === 'submitted with acknowledged risks').length).toBe(0);
  });
});

// ============================================================================
// Firm-Scoped Insights Tests
// ============================================================================

function createMockFirmInsightsData(options: {
  isStatisticallyMeaningful?: boolean;
  sampleSize?: number;
  scoreThresholdInsights?: OutcomeInsight[];
  recommendationInsights?: OutcomeInsight[];
}): FirmOutcomeInsightsData {
  const analysis = createMockAnalysis({
    isStatisticallyMeaningful: options.isStatisticallyMeaningful,
    completeRecords: options.sampleSize ?? 15,
  });

  const insightsByCategory = {
    score_threshold: options.scoreThresholdInsights ?? [],
    recommendation: options.recommendationInsights ?? [],
    acknowledgement: [],
    risk: [],
  };

  return {
    analysis,
    topInsights: [
      ...insightsByCategory.score_threshold,
      ...insightsByCategory.recommendation,
    ].slice(0, 5),
    isPredictive: false,
    summary: 'Test summary',
    insightsByCategory,
    meta: {
      sampleSize: options.sampleSize ?? 15,
      timeRange: '365d',
      minConfidence: 'medium',
      totalRfps: options.sampleSize ?? 15,
    },
  };
}

describe('hasFirmInsightsForDisplay', () => {
  test('returns false when data is null', () => {
    expect(hasFirmInsightsForDisplay(null)).toBe(false);
  });

  test('returns false when analysis is not statistically meaningful', () => {
    const data = createMockFirmInsightsData({
      isStatisticallyMeaningful: false,
      sampleSize: 15,
    });
    expect(hasFirmInsightsForDisplay(data)).toBe(false);
  });

  test('returns false when sample size is below minimum', () => {
    const data = createMockFirmInsightsData({
      isStatisticallyMeaningful: true,
      sampleSize: FIRM_INSIGHTS_MIN_SAMPLE - 1,
    });
    expect(hasFirmInsightsForDisplay(data)).toBe(false);
  });

  test('returns false when all insights are low confidence', () => {
    const data = createMockFirmInsightsData({
      isStatisticallyMeaningful: true,
      sampleSize: 15,
      scoreThresholdInsights: [
        createMockInsight({
          signal: 'score >= 70',
          winRateDelta: 15,
          confidence: 'low',
          category: 'score_threshold',
        }),
      ],
    });
    expect(hasFirmInsightsForDisplay(data)).toBe(false);
  });

  test('returns true when sample size meets minimum and has medium confidence insight', () => {
    const data = createMockFirmInsightsData({
      isStatisticallyMeaningful: true,
      sampleSize: FIRM_INSIGHTS_MIN_SAMPLE,
      scoreThresholdInsights: [
        createMockInsight({
          signal: 'score >= 70',
          winRateDelta: 15,
          confidence: 'medium',
          category: 'score_threshold',
        }),
      ],
    });
    expect(hasFirmInsightsForDisplay(data)).toBe(true);
  });

  test('returns true when sample size exceeds minimum and has high confidence insight', () => {
    const data = createMockFirmInsightsData({
      isStatisticallyMeaningful: true,
      sampleSize: 25,
      recommendationInsights: [
        createMockInsight({
          signal: 'recommendation = Go',
          winRateDelta: 20,
          confidence: 'high',
          category: 'recommendation',
        }),
      ],
    });
    expect(hasFirmInsightsForDisplay(data)).toBe(true);
  });
});

describe('Firm Insights Integration', () => {
  test('FIRM_INSIGHTS_MIN_SAMPLE is 10', () => {
    expect(FIRM_INSIGHTS_MIN_SAMPLE).toBe(10);
  });

  test('firm insights work with getRelevantInsights', () => {
    const firmData = createMockFirmInsightsData({
      isStatisticallyMeaningful: true,
      sampleSize: 20,
      recommendationInsights: [
        createMockInsight({
          signal: 'recommendation = Go',
          winRateDelta: 18,
          confidence: 'high',
          category: 'recommendation',
        }),
      ],
    });
    const readiness = createMockReadiness({ score: 80, recommendation: 'go' });

    // Should work with FirmOutcomeInsightsData (which extends OutcomeInsightsData)
    const relevant = getRelevantInsights(firmData, readiness);
    expect(relevant.length).toBeGreaterThan(0);
    expect(relevant[0].insight.signal).toBe('recommendation = Go');
  });

  test('firm insights work with getSubmissionInsights', () => {
    const firmData = createMockFirmInsightsData({
      isStatisticallyMeaningful: true,
      sampleSize: 20,
      recommendationInsights: [
        createMockInsight({
          signal: 'recommendation = Conditional Go',
          winRateDelta: -12,
          confidence: 'medium',
          category: 'recommendation',
        }),
      ],
    });

    const relevant = getSubmissionInsights(firmData, 'conditional', false, false);
    expect(relevant.length).toBeGreaterThan(0);
    expect(relevant[0].insight.signal).toBe('recommendation = Conditional Go');
  });
});
