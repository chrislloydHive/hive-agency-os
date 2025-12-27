// tests/os/outcomeAnalysis.test.ts
// Tests for RFP Outcome Correlation Analysis

import { describe, test, expect } from 'vitest';
import {
  analyzeOutcomes,
  getTopInsights,
  getInsightsByCategory,
  isReadinessPredictive,
  getAnalysisSummary,
  type RfpOutcomeRecord,
  type OutcomeAnalysisResult,
} from '@/lib/os/rfp/analyzeOutcomes';
import type { SubmissionSnapshot } from '@/components/os/rfp/SubmissionReadinessModal';

// ============================================================================
// Mock Data Helpers
// ============================================================================

function createMockSnapshot(options: {
  score: number;
  recommendation: 'go' | 'conditional' | 'no_go';
  acknowledgedRisks?: Array<{ category: string; severity: 'low' | 'medium' | 'high' | 'critical'; description: string }>;
  risksAcknowledged?: boolean;
}): SubmissionSnapshot {
  return {
    score: options.score,
    recommendation: options.recommendation,
    summary: `Test summary for score ${options.score}`,
    acknowledgedRisks: options.acknowledgedRisks ?? [],
    risksAcknowledged: options.risksAcknowledged ?? false,
    submittedAt: new Date().toISOString(),
    submittedBy: null,
  };
}

function createMockRecord(options: {
  id?: string;
  score: number;
  recommendation: 'go' | 'conditional' | 'no_go';
  outcome: 'won' | 'lost' | null;
  acknowledgedRisks?: Array<{ category: string; severity: 'low' | 'medium' | 'high' | 'critical'; description: string }>;
  risksAcknowledged?: boolean;
  lossReasonTags?: string[];
}): RfpOutcomeRecord {
  return {
    id: options.id ?? `rfp-${Math.random().toString(36).substr(2, 9)}`,
    submissionSnapshot: createMockSnapshot({
      score: options.score,
      recommendation: options.recommendation,
      acknowledgedRisks: options.acknowledgedRisks,
      risksAcknowledged: options.risksAcknowledged,
    }),
    outcome: options.outcome,
    lossReasonTags: options.lossReasonTags,
  };
}

/**
 * Create a batch of records for statistical analysis
 */
function createRecordBatch(
  count: number,
  options: {
    scoreRange: [number, number];
    recommendation: 'go' | 'conditional' | 'no_go';
    winProbability: number; // 0-1
  }
): RfpOutcomeRecord[] {
  const records: RfpOutcomeRecord[] = [];
  const [minScore, maxScore] = options.scoreRange;

  for (let i = 0; i < count; i++) {
    const score = minScore + Math.random() * (maxScore - minScore);
    const won = Math.random() < options.winProbability;

    records.push(createMockRecord({
      score: Math.round(score),
      recommendation: options.recommendation,
      outcome: won ? 'won' : 'lost',
    }));
  }

  return records;
}

// ============================================================================
// Basic Analysis Tests
// ============================================================================

describe('analyzeOutcomes - Basic', () => {
  test('returns empty results for empty input', () => {
    const result = analyzeOutcomes([]);

    expect(result.totalAnalyzed).toBe(0);
    expect(result.completeRecords).toBe(0);
    expect(result.overallWinRate).toBe(0);
    expect(result.insights).toHaveLength(0);
    expect(result.isStatisticallyMeaningful).toBe(false);
  });

  test('excludes records without snapshot', () => {
    const records: RfpOutcomeRecord[] = [
      { id: '1', submissionSnapshot: null, outcome: 'won' },
      { id: '2', submissionSnapshot: null, outcome: 'lost' },
      createMockRecord({ score: 75, recommendation: 'go', outcome: 'won' }),
    ];

    const result = analyzeOutcomes(records);

    expect(result.totalAnalyzed).toBe(3);
    expect(result.completeRecords).toBe(1);
  });

  test('excludes records without outcome', () => {
    const records: RfpOutcomeRecord[] = [
      createMockRecord({ score: 75, recommendation: 'go', outcome: null }),
      createMockRecord({ score: 60, recommendation: 'conditional', outcome: null }),
      createMockRecord({ score: 80, recommendation: 'go', outcome: 'won' }),
    ];

    const result = analyzeOutcomes(records);

    expect(result.completeRecords).toBe(1);
  });

  test('calculates correct win rate', () => {
    const records: RfpOutcomeRecord[] = [
      createMockRecord({ score: 75, recommendation: 'go', outcome: 'won' }),
      createMockRecord({ score: 80, recommendation: 'go', outcome: 'won' }),
      createMockRecord({ score: 60, recommendation: 'conditional', outcome: 'lost' }),
      createMockRecord({ score: 70, recommendation: 'go', outcome: 'lost' }),
    ];

    const result = analyzeOutcomes(records);

    expect(result.overallWinRate).toBe(50); // 2 won out of 4
  });
});

// ============================================================================
// Score Threshold Analysis Tests
// ============================================================================

describe('analyzeOutcomes - Score Thresholds', () => {
  test('identifies positive correlation for high scores', () => {
    // Create dataset where high scores correlate with wins
    const highScoreWins = Array(10).fill(null).map((_, i) =>
      createMockRecord({ score: 75 + i, recommendation: 'go', outcome: 'won' })
    );
    const lowScoreLosses = Array(10).fill(null).map((_, i) =>
      createMockRecord({ score: 40 + i, recommendation: 'no_go', outcome: 'lost' })
    );

    const result = analyzeOutcomes([...highScoreWins, ...lowScoreLosses]);

    const highScoreInsight = result.insights.find(i => i.signal === 'score >= 70');
    expect(highScoreInsight).toBeDefined();
    expect(highScoreInsight!.winRateDelta).toBeGreaterThan(0);
  });

  test('identifies negative correlation for low scores', () => {
    const highScoreWins = Array(10).fill(null).map((_, i) =>
      createMockRecord({ score: 75 + i, recommendation: 'go', outcome: 'won' })
    );
    const lowScoreLosses = Array(10).fill(null).map((_, i) =>
      createMockRecord({ score: 40 + i, recommendation: 'no_go', outcome: 'lost' })
    );

    const result = analyzeOutcomes([...highScoreWins, ...lowScoreLosses]);

    const lowScoreInsight = result.insights.find(i => i.signal === 'score < 70');
    expect(lowScoreInsight).toBeDefined();
    expect(lowScoreInsight!.winRateDelta).toBeLessThan(0);
  });

  test('analyzes multiple thresholds', () => {
    const records = [
      ...createRecordBatch(5, { scoreRange: [80, 90], recommendation: 'go', winProbability: 0.8 }),
      ...createRecordBatch(5, { scoreRange: [60, 70], recommendation: 'conditional', winProbability: 0.5 }),
      ...createRecordBatch(5, { scoreRange: [30, 50], recommendation: 'no_go', winProbability: 0.2 }),
    ];

    const result = analyzeOutcomes(records);

    // Should have insights for various thresholds
    const thresholdInsights = result.insights.filter(i => i.category === 'score_threshold');
    expect(thresholdInsights.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Recommendation Analysis Tests
// ============================================================================

describe('analyzeOutcomes - Recommendations', () => {
  test('identifies correlation for Go recommendation', () => {
    const goWins = Array(10).fill(null).map(() =>
      createMockRecord({ score: 80, recommendation: 'go', outcome: 'won' })
    );
    const noGoLosses = Array(10).fill(null).map(() =>
      createMockRecord({ score: 30, recommendation: 'no_go', outcome: 'lost' })
    );

    const result = analyzeOutcomes([...goWins, ...noGoLosses]);

    const goInsight = result.insights.find(i => i.signal === 'recommendation = Go');
    expect(goInsight).toBeDefined();
    expect(goInsight!.winRateDelta).toBeGreaterThan(0);
  });

  test('identifies correlation for No-Go recommendation', () => {
    const goWins = Array(10).fill(null).map(() =>
      createMockRecord({ score: 80, recommendation: 'go', outcome: 'won' })
    );
    const noGoLosses = Array(10).fill(null).map(() =>
      createMockRecord({ score: 30, recommendation: 'no_go', outcome: 'lost' })
    );

    const result = analyzeOutcomes([...goWins, ...noGoLosses]);

    const noGoInsight = result.insights.find(i => i.signal === 'recommendation = No-Go');
    expect(noGoInsight).toBeDefined();
    expect(noGoInsight!.winRateDelta).toBeLessThan(0);
  });

  test('analyzes Conditional Go separately', () => {
    const records = [
      ...Array(5).fill(null).map(() =>
        createMockRecord({ score: 75, recommendation: 'go', outcome: 'won' })
      ),
      ...Array(5).fill(null).map(() =>
        createMockRecord({ score: 55, recommendation: 'conditional', outcome: 'won' })
      ),
      ...Array(5).fill(null).map(() =>
        createMockRecord({ score: 55, recommendation: 'conditional', outcome: 'lost' })
      ),
    ];

    const result = analyzeOutcomes(records);

    const conditionalInsight = result.insights.find(
      i => i.signal === 'recommendation = Conditional Go'
    );
    expect(conditionalInsight).toBeDefined();
  });
});

// ============================================================================
// Risk Acknowledgement Analysis Tests
// ============================================================================

describe('analyzeOutcomes - Risk Acknowledgement', () => {
  test('identifies correlation for acknowledged risks', () => {
    const acknowledgedLosses = Array(5).fill(null).map(() =>
      createMockRecord({
        score: 55,
        recommendation: 'conditional',
        outcome: 'lost',
        acknowledgedRisks: [{ category: 'coverage', severity: 'high', description: 'Low coverage' }],
        risksAcknowledged: true,
      })
    );
    const noRisksWins = Array(5).fill(null).map(() =>
      createMockRecord({
        score: 80,
        recommendation: 'go',
        outcome: 'won',
      })
    );

    const result = analyzeOutcomes([...acknowledgedLosses, ...noRisksWins]);

    const acknowledgedInsight = result.insights.find(
      i => i.signal === 'submitted with acknowledged risks'
    );
    expect(acknowledgedInsight).toBeDefined();
  });

  test('identifies correlation for critical risks', () => {
    const criticalRiskLosses = Array(5).fill(null).map(() =>
      createMockRecord({
        score: 40,
        recommendation: 'no_go',
        outcome: 'lost',
        acknowledgedRisks: [
          { category: 'coverage', severity: 'critical', description: 'Critical gap' }
        ],
        risksAcknowledged: true,
      })
    );
    const noRisksWins = Array(5).fill(null).map(() =>
      createMockRecord({
        score: 80,
        recommendation: 'go',
        outcome: 'won',
      })
    );

    const result = analyzeOutcomes([...criticalRiskLosses, ...noRisksWins]);

    const criticalInsight = result.insights.find(
      i => i.signal === 'submitted with critical risks'
    );
    expect(criticalInsight).toBeDefined();
    expect(criticalInsight!.winRateDelta).toBeLessThan(0);
  });
});

// ============================================================================
// Loss Reason Analysis Tests
// ============================================================================

describe('analyzeOutcomes - Loss Reasons', () => {
  test('aggregates loss reason tags', () => {
    const records: RfpOutcomeRecord[] = [
      createMockRecord({
        score: 50,
        recommendation: 'conditional',
        outcome: 'lost',
        lossReasonTags: ['price', 'timing'],
      }),
      createMockRecord({
        score: 45,
        recommendation: 'conditional',
        outcome: 'lost',
        lossReasonTags: ['price', 'scope'],
      }),
      createMockRecord({
        score: 40,
        recommendation: 'no_go',
        outcome: 'lost',
        lossReasonTags: ['competitor'],
      }),
    ];

    const result = analyzeOutcomes(records);

    expect(result.lossReasons.length).toBeGreaterThan(0);

    const priceReason = result.lossReasons.find(r => r.reason === 'price');
    expect(priceReason).toBeDefined();
    expect(priceReason!.count).toBe(2);
  });

  test('calculates loss reason percentages', () => {
    const records: RfpOutcomeRecord[] = [
      createMockRecord({
        score: 50,
        recommendation: 'conditional',
        outcome: 'lost',
        lossReasonTags: ['price'],
      }),
      createMockRecord({
        score: 45,
        recommendation: 'conditional',
        outcome: 'lost',
        lossReasonTags: ['timing'],
      }),
      createMockRecord({
        score: 80,
        recommendation: 'go',
        outcome: 'won',
      }),
    ];

    const result = analyzeOutcomes(records);

    // 2 lost, each with different reason = 50% each
    const priceReason = result.lossReasons.find(r => r.reason === 'price');
    expect(priceReason?.percentage).toBe(50);
  });

  test('calculates average readiness score per loss reason', () => {
    const records: RfpOutcomeRecord[] = [
      createMockRecord({
        score: 60,
        recommendation: 'conditional',
        outcome: 'lost',
        lossReasonTags: ['price'],
      }),
      createMockRecord({
        score: 40,
        recommendation: 'no_go',
        outcome: 'lost',
        lossReasonTags: ['price'],
      }),
    ];

    const result = analyzeOutcomes(records);

    const priceReason = result.lossReasons.find(r => r.reason === 'price');
    expect(priceReason?.avgReadinessScore).toBe(50); // (60 + 40) / 2
  });
});

// ============================================================================
// Confidence Level Tests
// ============================================================================

describe('analyzeOutcomes - Confidence Levels', () => {
  test('assigns low confidence for small samples', () => {
    const records = Array(4).fill(null).map((_, i) =>
      createMockRecord({
        score: 75,
        recommendation: 'go',
        outcome: i < 3 ? 'won' : 'lost',
      })
    );

    const result = analyzeOutcomes(records);

    const insight = result.insights.find(i => i.signal === 'recommendation = Go');
    expect(insight?.confidence).toBe('low');
  });

  test('assigns medium confidence for moderate samples', () => {
    const records = Array(15).fill(null).map((_, i) =>
      createMockRecord({
        score: 75,
        recommendation: 'go',
        outcome: i < 10 ? 'won' : 'lost',
      })
    );

    const result = analyzeOutcomes(records);

    const insight = result.insights.find(i => i.signal === 'recommendation = Go');
    expect(insight?.confidence).toBe('medium');
  });

  test('assigns high confidence for large samples', () => {
    const records = Array(25).fill(null).map((_, i) =>
      createMockRecord({
        score: 75,
        recommendation: 'go',
        outcome: i < 20 ? 'won' : 'lost',
      })
    );

    const result = analyzeOutcomes(records);

    const insight = result.insights.find(i => i.signal === 'recommendation = Go');
    expect(insight?.confidence).toBe('high');
  });
});

// ============================================================================
// Statistical Meaningfulness Tests
// ============================================================================

describe('analyzeOutcomes - Statistical Meaningfulness', () => {
  test('marks analysis as not meaningful with few records', () => {
    const records = Array(3).fill(null).map(() =>
      createMockRecord({ score: 75, recommendation: 'go', outcome: 'won' })
    );

    const result = analyzeOutcomes(records);

    expect(result.isStatisticallyMeaningful).toBe(false);
  });

  test('marks analysis as meaningful with sufficient records', () => {
    const records = Array(10).fill(null).map((_, i) =>
      createMockRecord({
        score: 60 + i * 2,
        recommendation: i > 5 ? 'go' : 'conditional',
        outcome: i > 5 ? 'won' : 'lost',
      })
    );

    const result = analyzeOutcomes(records);

    expect(result.isStatisticallyMeaningful).toBe(true);
  });
});

// ============================================================================
// Helper Function Tests
// ============================================================================

describe('getTopInsights', () => {
  test('returns top insights by absolute delta', () => {
    const result: OutcomeAnalysisResult = {
      totalAnalyzed: 20,
      completeRecords: 20,
      overallWinRate: 50,
      insights: [
        { signal: 'a', winRateDelta: 5, sampleSize: 10, confidence: 'medium', category: 'score_threshold' },
        { signal: 'b', winRateDelta: -25, sampleSize: 10, confidence: 'medium', category: 'score_threshold' },
        { signal: 'c', winRateDelta: 30, sampleSize: 10, confidence: 'high', category: 'recommendation' },
        { signal: 'd', winRateDelta: 10, sampleSize: 5, confidence: 'low', category: 'risk' },
      ],
      componentCorrelations: [],
      lossReasons: [],
      isStatisticallyMeaningful: true,
      minimumSampleRecommendation: 5,
    };

    const top = getTopInsights(result, 3);

    expect(top).toHaveLength(3);
    // Low confidence with delta < 20 should be filtered out
    expect(top.find(i => i.signal === 'd')).toBeUndefined();
  });
});

describe('getInsightsByCategory', () => {
  test('filters insights by category', () => {
    const result: OutcomeAnalysisResult = {
      totalAnalyzed: 20,
      completeRecords: 20,
      overallWinRate: 50,
      insights: [
        { signal: 'a', winRateDelta: 10, sampleSize: 10, confidence: 'medium', category: 'score_threshold' },
        { signal: 'b', winRateDelta: 15, sampleSize: 10, confidence: 'medium', category: 'recommendation' },
        { signal: 'c', winRateDelta: -5, sampleSize: 10, confidence: 'high', category: 'score_threshold' },
      ],
      componentCorrelations: [],
      lossReasons: [],
      isStatisticallyMeaningful: true,
      minimumSampleRecommendation: 5,
    };

    const thresholdInsights = getInsightsByCategory(result, 'score_threshold');

    expect(thresholdInsights).toHaveLength(2);
    expect(thresholdInsights.every(i => i.category === 'score_threshold')).toBe(true);
  });
});

describe('isReadinessPredictive', () => {
  test('returns true when high scores correlate with wins', () => {
    const result: OutcomeAnalysisResult = {
      totalAnalyzed: 20,
      completeRecords: 20,
      overallWinRate: 50,
      insights: [
        { signal: 'score >= 70', winRateDelta: 15, sampleSize: 10, confidence: 'medium', category: 'score_threshold' },
      ],
      componentCorrelations: [],
      lossReasons: [],
      isStatisticallyMeaningful: true,
      minimumSampleRecommendation: 5,
    };

    expect(isReadinessPredictive(result)).toBe(true);
  });

  test('returns true when Go recommendation correlates with wins', () => {
    const result: OutcomeAnalysisResult = {
      totalAnalyzed: 20,
      completeRecords: 20,
      overallWinRate: 50,
      insights: [
        { signal: 'recommendation = Go', winRateDelta: 12, sampleSize: 10, confidence: 'medium', category: 'recommendation' },
      ],
      componentCorrelations: [],
      lossReasons: [],
      isStatisticallyMeaningful: true,
      minimumSampleRecommendation: 5,
    };

    expect(isReadinessPredictive(result)).toBe(true);
  });

  test('returns false when correlations are weak', () => {
    const result: OutcomeAnalysisResult = {
      totalAnalyzed: 20,
      completeRecords: 20,
      overallWinRate: 50,
      insights: [
        { signal: 'score >= 70', winRateDelta: 5, sampleSize: 10, confidence: 'medium', category: 'score_threshold' },
        { signal: 'recommendation = Go', winRateDelta: 3, sampleSize: 10, confidence: 'medium', category: 'recommendation' },
      ],
      componentCorrelations: [],
      lossReasons: [],
      isStatisticallyMeaningful: true,
      minimumSampleRecommendation: 5,
    };

    expect(isReadinessPredictive(result)).toBe(false);
  });

  test('returns false when confidence is low', () => {
    const result: OutcomeAnalysisResult = {
      totalAnalyzed: 5,
      completeRecords: 5,
      overallWinRate: 50,
      insights: [
        { signal: 'score >= 70', winRateDelta: 25, sampleSize: 3, confidence: 'low', category: 'score_threshold' },
      ],
      componentCorrelations: [],
      lossReasons: [],
      isStatisticallyMeaningful: true,
      minimumSampleRecommendation: 5,
    };

    expect(isReadinessPredictive(result)).toBe(false);
  });
});

describe('getAnalysisSummary', () => {
  test('returns insufficient data message for small samples', () => {
    const result: OutcomeAnalysisResult = {
      totalAnalyzed: 2,
      completeRecords: 2,
      overallWinRate: 50,
      insights: [],
      componentCorrelations: [],
      lossReasons: [],
      isStatisticallyMeaningful: false,
      minimumSampleRecommendation: 5,
    };

    const summary = getAnalysisSummary(result);

    expect(summary).toContain('Insufficient data');
    expect(summary).toContain('5');
  });

  test('indicates when readiness is predictive', () => {
    const result: OutcomeAnalysisResult = {
      totalAnalyzed: 20,
      completeRecords: 20,
      overallWinRate: 50,
      insights: [
        { signal: 'score >= 70', winRateDelta: 20, sampleSize: 15, confidence: 'medium', category: 'score_threshold' },
      ],
      componentCorrelations: [],
      lossReasons: [],
      isStatisticallyMeaningful: true,
      minimumSampleRecommendation: 5,
    };

    const summary = getAnalysisSummary(result);

    expect(summary).toContain('predictive');
    expect(summary).toContain('+20%');
  });

  test('includes win rate when not predictive', () => {
    const result: OutcomeAnalysisResult = {
      totalAnalyzed: 20,
      completeRecords: 20,
      overallWinRate: 45,
      insights: [
        { signal: 'score >= 70', winRateDelta: 5, sampleSize: 10, confidence: 'medium', category: 'score_threshold' },
      ],
      componentCorrelations: [],
      lossReasons: [],
      isStatisticallyMeaningful: true,
      minimumSampleRecommendation: 5,
    };

    const summary = getAnalysisSummary(result);

    expect(summary).toContain('45%');
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('analyzeOutcomes - Edge Cases', () => {
  test('handles all wins correctly', () => {
    const records = Array(10).fill(null).map(() =>
      createMockRecord({ score: 75, recommendation: 'go', outcome: 'won' })
    );

    const result = analyzeOutcomes(records);

    expect(result.overallWinRate).toBe(100);
  });

  test('handles all losses correctly', () => {
    const records = Array(10).fill(null).map(() =>
      createMockRecord({ score: 40, recommendation: 'no_go', outcome: 'lost' })
    );

    const result = analyzeOutcomes(records);

    expect(result.overallWinRate).toBe(0);
  });

  test('handles mixed null and complete records', () => {
    const records: RfpOutcomeRecord[] = [
      { id: '1', submissionSnapshot: null, outcome: 'won' },
      createMockRecord({ score: 75, recommendation: 'go', outcome: 'won' }),
      { id: '2', submissionSnapshot: null, outcome: 'lost' },
      createMockRecord({ score: 50, recommendation: 'conditional', outcome: null }),
      createMockRecord({ score: 60, recommendation: 'conditional', outcome: 'lost' }),
    ];

    const result = analyzeOutcomes(records);

    expect(result.totalAnalyzed).toBe(5);
    expect(result.completeRecords).toBe(2); // Only records with both snapshot and outcome
    expect(result.overallWinRate).toBe(50); // 1 won, 1 lost
  });

  test('sorts insights by absolute delta', () => {
    // Create dataset with clear high and low deltas
    const goWins = Array(10).fill(null).map(() =>
      createMockRecord({ score: 85, recommendation: 'go', outcome: 'won' })
    );
    const noGoLosses = Array(10).fill(null).map(() =>
      createMockRecord({ score: 25, recommendation: 'no_go', outcome: 'lost' })
    );

    const result = analyzeOutcomes([...goWins, ...noGoLosses]);

    // First insight should have largest absolute delta
    if (result.insights.length >= 2) {
      expect(Math.abs(result.insights[0].winRateDelta))
        .toBeGreaterThanOrEqual(Math.abs(result.insights[1].winRateDelta));
    }
  });
});
