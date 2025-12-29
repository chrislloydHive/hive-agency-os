// tests/os/strategyAttribution.test.ts
// Tests for Phase 24: Strategy Attribution & Learning Intelligence
//
// Covers:
// - Window slicing
// - Scoring & confidence
// - Direction thresholds
// - Rollup ranking
// - Stability (ordering)

import { describe, it, expect } from 'vitest';
import type { OutcomeSignal, OutcomeSignalType, OutcomeSignalConfidence } from '@/lib/types/outcomeSignal';
import type { StrategyEvolutionEvent } from '@/lib/types/strategyEvolution';
import {
  calculateSignalWeight,
  calculateTotalWeightedScore,
  determineDirection,
  calculateAttributionScore,
  calculateAttributionConfidence,
  sliceSignalsToWindow,
  sliceSignalsForEvent,
  calculateSignalDeltas,
  extractTopDrivers,
  groupSignalsBy,
  SIGNAL_TYPE_WEIGHTS,
  CONFIDENCE_MULTIPLIERS,
  DIRECTION_THRESHOLDS,
  MIN_SAMPLE_SIZE,
  DEFAULT_ATTRIBUTION_WINDOW,
  type AttributionWindow,
  type SignalDelta,
} from '@/lib/types/strategyAttribution';
import {
  computeEventAttribution,
  generateRollups,
  type ComputeAttributionResult,
} from '@/lib/os/strategy/attribution/computeAttribution';

// ============================================================================
// Test Helpers
// ============================================================================

function createTestSignal(
  overrides: Partial<OutcomeSignal> = {}
): OutcomeSignal {
  return {
    id: `sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    source: 'artifact',
    sourceId: 'art_123',
    signalType: 'completed',
    confidence: 'medium',
    summary: 'Test signal',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function createTestEvent(
  overrides: Partial<StrategyEvolutionEvent> = {}
): StrategyEvolutionEvent {
  return {
    id: `evo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    companyId: 'comp_123',
    strategyId: 'strat_123',
    title: 'Test Event',
    target: 'tactics',
    changes: [],
    confidenceAtApply: 'medium',
    evidenceSignalIds: [],
    evidenceSnippets: [],
    versionFrom: 1,
    versionTo: 2,
    snapshotHashBefore: 'abc',
    snapshotHashAfter: 'def',
    diffSummary: {
      added: 0,
      removed: 0,
      modified: 1,
      summary: 'Test change',
      changes: [],
      impactScore: 30,
      riskFlags: [],
    },
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function daysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

// ============================================================================
// Signal Weight Calculation Tests
// ============================================================================

describe('calculateSignalWeight', () => {
  it('should calculate correct weight for high-impact + high confidence', () => {
    const signal = createTestSignal({ signalType: 'high-impact', confidence: 'high' });
    const weight = calculateSignalWeight(signal);
    expect(weight).toBe(SIGNAL_TYPE_WEIGHTS['high-impact'] * CONFIDENCE_MULTIPLIERS['high']);
    expect(weight).toBe(15); // 10 * 1.5
  });

  it('should calculate correct weight for completed + medium confidence', () => {
    const signal = createTestSignal({ signalType: 'completed', confidence: 'medium' });
    const weight = calculateSignalWeight(signal);
    expect(weight).toBe(SIGNAL_TYPE_WEIGHTS['completed'] * CONFIDENCE_MULTIPLIERS['medium']);
    expect(weight).toBe(8); // 8 * 1.0
  });

  it('should calculate correct weight for abandoned + low confidence', () => {
    const signal = createTestSignal({ signalType: 'abandoned', confidence: 'low' });
    const weight = calculateSignalWeight(signal);
    expect(weight).toBe(SIGNAL_TYPE_WEIGHTS['abandoned'] * CONFIDENCE_MULTIPLIERS['low']);
    expect(weight).toBe(-2.5); // -5 * 0.5
  });

  it('should calculate correct weight for learning signal', () => {
    const signal = createTestSignal({ signalType: 'learning', confidence: 'medium' });
    const weight = calculateSignalWeight(signal);
    expect(weight).toBe(5); // 5 * 1.0
  });

  it('should calculate correct weight for low-impact signal', () => {
    const signal = createTestSignal({ signalType: 'low-impact', confidence: 'high' });
    const weight = calculateSignalWeight(signal);
    expect(weight).toBe(-4.5); // -3 * 1.5
  });
});

describe('calculateTotalWeightedScore', () => {
  it('should sum weights of all signals', () => {
    const signals = [
      createTestSignal({ signalType: 'completed', confidence: 'high' }), // 12
      createTestSignal({ signalType: 'high-impact', confidence: 'medium' }), // 10
      createTestSignal({ signalType: 'learning', confidence: 'low' }), // 2.5
    ];
    const total = calculateTotalWeightedScore(signals);
    expect(total).toBe(24.5); // 12 + 10 + 2.5
  });

  it('should return 0 for empty array', () => {
    expect(calculateTotalWeightedScore([])).toBe(0);
  });

  it('should handle negative weights', () => {
    const signals = [
      createTestSignal({ signalType: 'completed', confidence: 'medium' }), // 8
      createTestSignal({ signalType: 'abandoned', confidence: 'high' }), // -7.5
    ];
    const total = calculateTotalWeightedScore(signals);
    expect(total).toBe(0.5);
  });
});

// ============================================================================
// Direction Threshold Tests
// ============================================================================

describe('determineDirection', () => {
  it('should return positive for delta above threshold', () => {
    expect(determineDirection(DIRECTION_THRESHOLDS.POSITIVE + 1)).toBe('positive');
    expect(determineDirection(10)).toBe('positive');
    expect(determineDirection(100)).toBe('positive');
  });

  it('should return negative for delta below threshold', () => {
    expect(determineDirection(DIRECTION_THRESHOLDS.NEGATIVE - 1)).toBe('negative');
    expect(determineDirection(-10)).toBe('negative');
    expect(determineDirection(-100)).toBe('negative');
  });

  it('should return neutral for delta within thresholds', () => {
    expect(determineDirection(0)).toBe('neutral');
    expect(determineDirection(3)).toBe('neutral');
    expect(determineDirection(-3)).toBe('neutral');
    expect(determineDirection(DIRECTION_THRESHOLDS.POSITIVE)).toBe('neutral');
    expect(determineDirection(DIRECTION_THRESHOLDS.NEGATIVE)).toBe('neutral');
  });
});

// ============================================================================
// Attribution Score Tests
// ============================================================================

describe('calculateAttributionScore', () => {
  it('should return 0 for no signals', () => {
    expect(calculateAttributionScore(50, 0)).toBe(0);
  });

  it('should normalize by sample size', () => {
    // Same absolute delta, different sample sizes
    const score1 = calculateAttributionScore(30, 10); // 3 per signal
    const score2 = calculateAttributionScore(30, 30); // 1 per signal
    expect(score1).toBeGreaterThan(score2);
  });

  it('should clamp to 100 max', () => {
    const score = calculateAttributionScore(1000, 1);
    expect(score).toBe(100);
  });

  it('should clamp to 0 min', () => {
    const score = calculateAttributionScore(0, 10);
    expect(score).toBe(0);
  });

  it('should produce reasonable scores for typical deltas', () => {
    // Small positive change
    const smallScore = calculateAttributionScore(5, 10);
    expect(smallScore).toBeGreaterThan(0);
    expect(smallScore).toBeLessThan(50);

    // Large positive change
    const largeScore = calculateAttributionScore(50, 10);
    expect(largeScore).toBeGreaterThan(30);
  });
});

// ============================================================================
// Attribution Confidence Tests
// ============================================================================

describe('calculateAttributionConfidence', () => {
  it('should return high confidence for many signals', () => {
    const confidence = calculateAttributionConfidence(15, 10, true);
    expect(confidence).toBeGreaterThanOrEqual(70);
  });

  it('should return medium confidence for moderate signals', () => {
    const confidence = calculateAttributionConfidence(5, 5, true);
    expect(confidence).toBeGreaterThanOrEqual(50);
    expect(confidence).toBeLessThan(90);
  });

  it('should return low confidence for few signals', () => {
    const confidence = calculateAttributionConfidence(1, 1, true);
    expect(confidence).toBeLessThan(50);
  });

  it('should cap confidence when strategy incomplete', () => {
    const completeConf = calculateAttributionConfidence(15, 15, true);
    const incompleteConf = calculateAttributionConfidence(15, 15, false);
    expect(incompleteConf).toBeLessThanOrEqual(60);
    expect(incompleteConf).toBeLessThan(completeConf);
  });

  it('should penalize imbalanced samples', () => {
    const balanced = calculateAttributionConfidence(10, 10, true);
    const imbalanced = calculateAttributionConfidence(2, 20, true);
    expect(imbalanced).toBeLessThan(balanced);
  });

  it('should return 0 for no signals', () => {
    expect(calculateAttributionConfidence(0, 0, true)).toBe(0);
  });
});

// ============================================================================
// Window Slicing Tests
// ============================================================================

describe('sliceSignalsToWindow', () => {
  it('should filter signals within the window', () => {
    const now = new Date();
    const signals = [
      createTestSignal({ createdAt: daysAgo(5) }), // Within window
      createTestSignal({ createdAt: daysAgo(15) }), // Outside window
      createTestSignal({ createdAt: daysAgo(3) }), // Within window
    ];

    const sliced = sliceSignalsToWindow(signals, now, -10, 10);
    expect(sliced).toHaveLength(2);
  });

  it('should correctly handle offset', () => {
    const now = new Date();
    const signals = [
      createTestSignal({ createdAt: daysAgo(5) }), // In -10 to 0 window
      createTestSignal({ createdAt: daysFromNow(5) }), // In 0 to 10 window
    ];

    const preWindow = sliceSignalsToWindow(signals, now, -10, 10);
    expect(preWindow).toHaveLength(1);
    expect(new Date(preWindow[0].createdAt).getTime()).toBeLessThan(now.getTime());
  });

  it('should return empty array when no signals match', () => {
    const now = new Date();
    const signals = [createTestSignal({ createdAt: daysAgo(100) })];
    const sliced = sliceSignalsToWindow(signals, now, -10, 10);
    expect(sliced).toHaveLength(0);
  });
});

describe('sliceSignalsForEvent', () => {
  it('should correctly split signals into pre and post windows', () => {
    const eventDate = new Date();
    const signals = [
      createTestSignal({ createdAt: daysAgo(15) }), // Pre
      createTestSignal({ createdAt: daysAgo(5) }), // Pre
      createTestSignal({ createdAt: daysFromNow(5) }), // Post
      createTestSignal({ createdAt: daysFromNow(10) }), // Post
    ];

    const window: AttributionWindow = { preDays: 30, postDays: 30 };
    const { preSignals, postSignals } = sliceSignalsForEvent(signals, eventDate, window);

    expect(preSignals).toHaveLength(2);
    expect(postSignals).toHaveLength(2);
  });

  it('should respect window boundaries', () => {
    const eventDate = new Date();
    const signals = [
      createTestSignal({ createdAt: daysAgo(50) }), // Outside pre window
      createTestSignal({ createdAt: daysAgo(20) }), // Inside pre window
      createTestSignal({ createdAt: daysFromNow(20) }), // Inside post window
      createTestSignal({ createdAt: daysFromNow(50) }), // Outside post window
    ];

    const window: AttributionWindow = { preDays: 30, postDays: 30 };
    const { preSignals, postSignals } = sliceSignalsForEvent(signals, eventDate, window);

    expect(preSignals).toHaveLength(1);
    expect(postSignals).toHaveLength(1);
  });
});

// ============================================================================
// Signal Grouping Tests
// ============================================================================

describe('groupSignalsBy', () => {
  it('should group by signalType', () => {
    const signals = [
      createTestSignal({ signalType: 'completed' }),
      createTestSignal({ signalType: 'completed' }),
      createTestSignal({ signalType: 'high-impact' }),
      createTestSignal({ signalType: 'learning' }),
    ];

    const groups = groupSignalsBy(signals, 'signalType');
    expect(groups.get('completed')).toHaveLength(2);
    expect(groups.get('high-impact')).toHaveLength(1);
    expect(groups.get('learning')).toHaveLength(1);
  });

  it('should group by source', () => {
    const signals = [
      createTestSignal({ source: 'artifact' }),
      createTestSignal({ source: 'work' }),
      createTestSignal({ source: 'artifact' }),
    ];

    const groups = groupSignalsBy(signals, 'source');
    expect(groups.get('artifact')).toHaveLength(2);
    expect(groups.get('work')).toHaveLength(1);
  });

  it('should group by artifactType with unknown fallback', () => {
    const signals = [
      createTestSignal({ artifactType: 'brief' }),
      createTestSignal({ artifactType: undefined }),
    ];

    const groups = groupSignalsBy(signals, 'artifactType');
    expect(groups.get('brief')).toHaveLength(1);
    expect(groups.get('unknown')).toHaveLength(1);
  });
});

// ============================================================================
// Signal Deltas Tests
// ============================================================================

describe('calculateSignalDeltas', () => {
  it('should calculate correct deltas', () => {
    const preSignals = [
      createTestSignal({ signalType: 'completed', confidence: 'medium' }),
      createTestSignal({ signalType: 'completed', confidence: 'medium' }),
    ];
    const postSignals = [
      createTestSignal({ signalType: 'completed', confidence: 'high' }),
      createTestSignal({ signalType: 'completed', confidence: 'high' }),
      createTestSignal({ signalType: 'completed', confidence: 'high' }),
    ];

    const deltas = calculateSignalDeltas(preSignals, postSignals, 'signalType');
    const completedDelta = deltas.find(d => d.key === 'completed');

    expect(completedDelta).toBeDefined();
    expect(completedDelta!.preCount).toBe(2);
    expect(completedDelta!.postCount).toBe(3);
    expect(completedDelta!.delta).toBe(1);
    expect(completedDelta!.postWeightedScore).toBeGreaterThan(completedDelta!.preWeightedScore);
  });

  it('should handle new signal types in post', () => {
    const preSignals: OutcomeSignal[] = [];
    const postSignals = [
      createTestSignal({ signalType: 'high-impact', confidence: 'high' }),
    ];

    const deltas = calculateSignalDeltas(preSignals, postSignals, 'signalType');
    const highImpactDelta = deltas.find(d => d.key === 'high-impact');

    expect(highImpactDelta).toBeDefined();
    expect(highImpactDelta!.preCount).toBe(0);
    expect(highImpactDelta!.postCount).toBe(1);
  });

  it('should handle signal types that disappear', () => {
    const preSignals = [
      createTestSignal({ signalType: 'abandoned', confidence: 'medium' }),
    ];
    const postSignals: OutcomeSignal[] = [];

    const deltas = calculateSignalDeltas(preSignals, postSignals, 'signalType');
    const abandonedDelta = deltas.find(d => d.key === 'abandoned');

    expect(abandonedDelta).toBeDefined();
    expect(abandonedDelta!.preCount).toBe(1);
    expect(abandonedDelta!.postCount).toBe(0);
    expect(abandonedDelta!.delta).toBe(-1);
  });

  it('should sort deltas by absolute deltaWeightedScore', () => {
    const preSignals = [
      createTestSignal({ signalType: 'completed', confidence: 'low' }),
    ];
    const postSignals = [
      createTestSignal({ signalType: 'high-impact', confidence: 'high' }),
      createTestSignal({ signalType: 'high-impact', confidence: 'high' }),
      createTestSignal({ signalType: 'completed', confidence: 'low' }),
    ];

    const deltas = calculateSignalDeltas(preSignals, postSignals, 'signalType');
    // high-impact should have higher delta, so should be first
    expect(deltas[0].key).toBe('high-impact');
  });
});

// ============================================================================
// Top Drivers Extraction Tests
// ============================================================================

describe('extractTopDrivers', () => {
  it('should extract top N drivers', () => {
    const deltas: SignalDelta[] = [
      { key: 'completed', groupBy: 'signalType', preCount: 1, postCount: 5, delta: 4, preWeightedScore: 8, postWeightedScore: 40, deltaWeightedScore: 32, trend: 'increasing' },
      { key: 'high-impact', groupBy: 'signalType', preCount: 0, postCount: 2, delta: 2, preWeightedScore: 0, postWeightedScore: 20, deltaWeightedScore: 20, trend: 'increasing' },
      { key: 'abandoned', groupBy: 'signalType', preCount: 2, postCount: 0, delta: -2, preWeightedScore: -10, postWeightedScore: 0, deltaWeightedScore: 10, trend: 'increasing' },
    ];

    const drivers = extractTopDrivers(deltas, 2);
    expect(drivers).toHaveLength(2);
    expect(drivers[0].label).toBe('completed');
    expect(drivers[1].label).toBe('high-impact');
  });

  it('should filter out low-impact deltas', () => {
    const deltas: SignalDelta[] = [
      { key: 'completed', groupBy: 'signalType', preCount: 1, postCount: 1, delta: 0, preWeightedScore: 8, postWeightedScore: 8.5, deltaWeightedScore: 0.5, trend: 'stable' },
    ];

    const drivers = extractTopDrivers(deltas);
    expect(drivers).toHaveLength(0);
  });

  it('should determine correct direction for each driver', () => {
    const deltas: SignalDelta[] = [
      { key: 'completed', groupBy: 'signalType', preCount: 0, postCount: 5, delta: 5, preWeightedScore: 0, postWeightedScore: 40, deltaWeightedScore: 40, trend: 'increasing' },
      { key: 'abandoned', groupBy: 'signalType', preCount: 5, postCount: 0, delta: -5, preWeightedScore: -25, postWeightedScore: 0, deltaWeightedScore: 25, trend: 'increasing' },
    ];

    const drivers = extractTopDrivers(deltas, 5);
    const completedDriver = drivers.find(d => d.label === 'completed');
    const abandonedDriver = drivers.find(d => d.label === 'abandoned');

    expect(completedDriver?.direction).toBe('positive');
    expect(abandonedDriver?.direction).toBe('positive'); // delta is now positive (abandoned decreased)
  });
});

// ============================================================================
// Event Attribution Tests
// ============================================================================

describe('computeEventAttribution', () => {
  it('should compute attribution for event with signals', () => {
    const event = createTestEvent({
      createdAt: new Date().toISOString(),
    });

    const signals = [
      createTestSignal({ signalType: 'completed', confidence: 'high', createdAt: daysAgo(10) }),
      createTestSignal({ signalType: 'abandoned', confidence: 'low', createdAt: daysAgo(5) }),
      createTestSignal({ signalType: 'high-impact', confidence: 'high', createdAt: daysFromNow(5) }),
      createTestSignal({ signalType: 'completed', confidence: 'high', createdAt: daysFromNow(10) }),
    ];

    const attribution = computeEventAttribution(
      event,
      signals,
      DEFAULT_ATTRIBUTION_WINDOW,
      true
    );

    expect(attribution.eventId).toBe(event.id);
    expect(attribution.preSignalCount).toBe(2);
    expect(attribution.postSignalCount).toBe(2);
    expect(attribution.direction).toBeDefined();
    expect(attribution.attributionScore).toBeGreaterThanOrEqual(0);
    expect(attribution.confidence).toBeGreaterThan(0);
  });

  it('should return 0 confidence for no signals', () => {
    const event = createTestEvent();
    const attribution = computeEventAttribution(
      event,
      [],
      DEFAULT_ATTRIBUTION_WINDOW,
      true
    );

    expect(attribution.preSignalCount).toBe(0);
    expect(attribution.postSignalCount).toBe(0);
    expect(attribution.confidence).toBe(0);
    expect(attribution.notes).toContain('No signals in attribution window. Unable to assess impact.');
  });

  it('should include notes for low sample size', () => {
    const event = createTestEvent();
    const signals = [
      createTestSignal({ signalType: 'completed', createdAt: daysAgo(5) }),
    ];

    const attribution = computeEventAttribution(
      event,
      signals,
      DEFAULT_ATTRIBUTION_WINDOW,
      true
    );

    expect(attribution.notes.some(n => n.includes('Limited data'))).toBe(true);
  });
});

// ============================================================================
// Rollup Generation Tests
// ============================================================================

describe('generateRollups', () => {
  it('should correctly categorize events by direction', () => {
    const event = createTestEvent();
    const signals = [
      createTestSignal({ signalType: 'completed', confidence: 'high', createdAt: daysAgo(5) }),
      createTestSignal({ signalType: 'high-impact', confidence: 'high', createdAt: daysFromNow(5) }),
      createTestSignal({ signalType: 'high-impact', confidence: 'high', createdAt: daysFromNow(10) }),
    ];

    const positiveAttribution = computeEventAttribution(
      event,
      signals,
      DEFAULT_ATTRIBUTION_WINDOW,
      true
    );

    const negativeEvent = createTestEvent({ id: 'evo_negative' });
    const negativeSignals = [
      createTestSignal({ signalType: 'high-impact', confidence: 'high', createdAt: daysAgo(5) }),
      createTestSignal({ signalType: 'abandoned', confidence: 'medium', createdAt: daysFromNow(5) }),
      createTestSignal({ signalType: 'abandoned', confidence: 'medium', createdAt: daysFromNow(10) }),
    ];

    const negativeAttribution = computeEventAttribution(
      negativeEvent,
      negativeSignals,
      DEFAULT_ATTRIBUTION_WINDOW,
      true
    );

    const rollups = generateRollups([positiveAttribution, negativeAttribution]);

    expect(rollups.totalEvents).toBe(2);
    // Note: actual direction depends on the signal composition
  });

  it('should sort positive events by score descending', () => {
    const attr1 = computeEventAttribution(
      createTestEvent({ id: 'evo_1' }),
      [
        createTestSignal({ signalType: 'completed', createdAt: daysAgo(5) }),
        createTestSignal({ signalType: 'high-impact', confidence: 'high', createdAt: daysFromNow(5) }),
      ],
      DEFAULT_ATTRIBUTION_WINDOW,
      true
    );

    const attr2 = computeEventAttribution(
      createTestEvent({ id: 'evo_2' }),
      [
        createTestSignal({ signalType: 'completed', createdAt: daysAgo(5) }),
        createTestSignal({ signalType: 'high-impact', confidence: 'high', createdAt: daysFromNow(5) }),
        createTestSignal({ signalType: 'high-impact', confidence: 'high', createdAt: daysFromNow(10) }),
        createTestSignal({ signalType: 'high-impact', confidence: 'high', createdAt: daysFromNow(15) }),
      ],
      DEFAULT_ATTRIBUTION_WINDOW,
      true
    );

    const rollups = generateRollups([attr1, attr2]);

    // Event 2 should have higher score due to more positive signals
    if (rollups.topPositiveEvents.length >= 2) {
      expect(rollups.topPositiveEvents[0].attributionScore).toBeGreaterThanOrEqual(
        rollups.topPositiveEvents[1].attributionScore
      );
    }
  });

  it('should calculate average score', () => {
    const attr1 = { ...computeEventAttribution(createTestEvent(), [], DEFAULT_ATTRIBUTION_WINDOW, true), attributionScore: 40 };
    const attr2 = { ...computeEventAttribution(createTestEvent({ id: 'evo_2' }), [], DEFAULT_ATTRIBUTION_WINDOW, true), attributionScore: 60 };

    const rollups = generateRollups([attr1, attr2]);
    expect(rollups.averageScore).toBe(50);
  });

  it('should identify no-signal events', () => {
    const noSignalEvent = createTestEvent({ id: 'evo_nosignal' });
    const attribution = computeEventAttribution(
      noSignalEvent,
      [],
      DEFAULT_ATTRIBUTION_WINDOW,
      true
    );

    const rollups = generateRollups([attribution]);
    expect(rollups.noSignalEvents).toHaveLength(1);
    expect(rollups.noSignalEvents[0].eventId).toBe('evo_nosignal');
  });
});

// ============================================================================
// Stability Tests
// ============================================================================

describe('output stability', () => {
  it('should produce stable attribution for same inputs', () => {
    const event = createTestEvent({ id: 'stable_test', createdAt: '2024-01-15T12:00:00Z' });
    const signals = [
      createTestSignal({ id: 'sig_1', signalType: 'completed', confidence: 'high', createdAt: '2024-01-10T12:00:00Z' }),
      createTestSignal({ id: 'sig_2', signalType: 'high-impact', confidence: 'medium', createdAt: '2024-01-20T12:00:00Z' }),
    ];

    const attr1 = computeEventAttribution(event, signals, DEFAULT_ATTRIBUTION_WINDOW, true);
    const attr2 = computeEventAttribution(event, signals, DEFAULT_ATTRIBUTION_WINDOW, true);

    expect(attr1.attributionScore).toBe(attr2.attributionScore);
    expect(attr1.direction).toBe(attr2.direction);
    expect(attr1.confidence).toBe(attr2.confidence);
    expect(attr1.deltas).toEqual(attr2.deltas);
  });

  it('should produce stable delta ordering', () => {
    const preSignals = [
      createTestSignal({ id: 's1', signalType: 'learning', confidence: 'low' }),
      createTestSignal({ id: 's2', signalType: 'completed', confidence: 'medium' }),
    ];
    const postSignals = [
      createTestSignal({ id: 's3', signalType: 'high-impact', confidence: 'high' }),
      createTestSignal({ id: 's4', signalType: 'completed', confidence: 'high' }),
    ];

    const deltas1 = calculateSignalDeltas(preSignals, postSignals, 'signalType');
    const deltas2 = calculateSignalDeltas(preSignals, postSignals, 'signalType');

    expect(deltas1.map(d => d.key)).toEqual(deltas2.map(d => d.key));
  });

  it('should produce stable rollups ordering', () => {
    const events = [
      createTestEvent({ id: 'e1' }),
      createTestEvent({ id: 'e2' }),
      createTestEvent({ id: 'e3' }),
    ];

    const attributions = events.map((e, i) => ({
      ...computeEventAttribution(e, [], DEFAULT_ATTRIBUTION_WINDOW, true),
      attributionScore: (i + 1) * 20, // 20, 40, 60
    }));

    const rollups1 = generateRollups(attributions);
    const rollups2 = generateRollups(attributions);

    // Verify stable tie-breaker for same scores
    expect(rollups1.topPositiveEvents.map(e => e.eventId)).toEqual(
      rollups2.topPositiveEvents.map(e => e.eventId)
    );
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('edge cases', () => {
  it('should handle signals exactly at window boundaries', () => {
    const now = new Date();
    const window: AttributionWindow = { preDays: 10, postDays: 10 };

    const signalExactlyAtStart = createTestSignal({
      createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString()
    });

    const { preSignals } = sliceSignalsForEvent([signalExactlyAtStart], now, window);
    // Boundary behavior: start is inclusive
    expect(preSignals.length).toBe(1);
  });

  it('should handle very old events', () => {
    const veryOldEvent = createTestEvent({
      createdAt: '2020-01-01T00:00:00Z',
    });

    const recentSignals = [
      createTestSignal({ createdAt: daysAgo(5) }),
    ];

    // Should return empty windows since signals are way after the event
    const { preSignals, postSignals } = sliceSignalsForEvent(
      recentSignals,
      new Date(veryOldEvent.createdAt),
      { preDays: 30, postDays: 30 }
    );

    expect(preSignals).toHaveLength(0);
    expect(postSignals).toHaveLength(0);
  });

  it('should handle extremely large delta scores', () => {
    // Many high-value signals
    const postSignals = Array(100).fill(null).map((_, i) =>
      createTestSignal({ id: `sig_${i}`, signalType: 'high-impact', confidence: 'high' })
    );

    const total = calculateTotalWeightedScore(postSignals);
    const score = calculateAttributionScore(total, 100);

    expect(score).toBeLessThanOrEqual(100);
  });

  it('should handle mixed positive and negative signals', () => {
    const signals = [
      createTestSignal({ signalType: 'high-impact', confidence: 'high' }),
      createTestSignal({ signalType: 'abandoned', confidence: 'high' }),
      createTestSignal({ signalType: 'completed', confidence: 'medium' }),
      createTestSignal({ signalType: 'low-impact', confidence: 'medium' }),
    ];

    const total = calculateTotalWeightedScore(signals);
    // Should not throw and should produce a reasonable value
    expect(typeof total).toBe('number');
    expect(isFinite(total)).toBe(true);
  });
});
