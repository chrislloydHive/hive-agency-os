// tests/os/strategyInsights.test.ts
// Tests for Strategy Insights - deterministic insight generation
//
// Focus areas:
// - Win/risk thresholds
// - Driver leaderboard aggregation & stable ordering
// - Next-best action rules generation
// - Coverage computation
// - Pattern detection
// - Output stability

import { describe, it, expect } from 'vitest';
import {
  generateInsights,
  generateDriverLeaderboard,
  detectPatterns,
  generateRecommendedActions,
  computeCoverage,
  type GenerateInsightsInput,
} from '@/lib/os/strategy/insights/generateInsights';
import {
  generateInsightId,
  sortInsightsByPriority,
  INSIGHT_THRESHOLDS,
  type StrategyInsight,
  type InsightCategory,
} from '@/lib/types/strategyInsights';
import type { StrategyEvolutionEvent, DiffSummary, DiffRiskFlag } from '@/lib/types/strategyEvolution';
import type { EventAttribution, TopDriver, AttributionDirection } from '@/lib/types/strategyAttribution';
import type { RevisionConfidence, StrategyRevisionTarget } from '@/lib/types/strategyRevision';

// ============================================================================
// Test Helpers
// ============================================================================

function createMockEvent(overrides: Partial<StrategyEvolutionEvent> = {}): StrategyEvolutionEvent {
  const id = overrides.id || `event_${Math.random().toString(36).slice(2)}`;
  return {
    id,
    companyId: 'company_1',
    strategyId: 'strat_1',
    title: 'Test Event',
    target: 'tactic' as StrategyRevisionTarget,
    changes: [],
    versionFrom: 1,
    versionTo: 2,
    snapshotHashBefore: 'hash_before',
    snapshotHashAfter: 'hash_after',
    proposalId: undefined,
    rollbackOfEventId: undefined,
    rolledBack: false,
    diffSummary: {
      added: 1,
      removed: 0,
      modified: 1,
      summary: 'Test change',
      changes: [],
      impactScore: 50,
      riskFlags: [],
    },
    evidenceSnippets: [],
    evidenceSignalIds: [],
    confidenceAtApply: 'high' as RevisionConfidence,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function createMockAttribution(
  eventId: string,
  overrides: Partial<EventAttribution> = {}
): EventAttribution {
  return {
    eventId,
    appliedAt: new Date().toISOString(),
    eventTitle: 'Test Event',
    window: { preDays: 30, postDays: 30 },
    attributionScore: 50,
    direction: 'neutral',
    confidence: 70,
    topDrivers: [],
    deltas: [],
    notes: [],
    preSignalCount: 5,
    postSignalCount: 5,
    preWeightedTotal: 10,
    postWeightedTotal: 10,
    ...overrides,
  };
}

function createMockTopDriver(
  label: string,
  overrides: Partial<TopDriver> = {}
): TopDriver {
  return {
    label,
    type: 'signalType',
    contribution: 30,
    direction: 'positive',
    ...overrides,
  };
}

// ============================================================================
// generateInsightId Tests
// ============================================================================

describe('generateInsightId', () => {
  it('should generate deterministic IDs for same inputs', () => {
    const id1 = generateInsightId('wins', 'driver1', '3');
    const id2 = generateInsightId('wins', 'driver1', '3');
    expect(id1).toBe(id2);
  });

  it('should generate different IDs for different inputs', () => {
    const id1 = generateInsightId('wins', 'driver1', '3');
    const id2 = generateInsightId('wins', 'driver2', '3');
    expect(id1).not.toBe(id2);
  });

  it('should include category in the ID', () => {
    const id = generateInsightId('risks', 'test');
    expect(id).toContain('risks');
  });
});

// ============================================================================
// sortInsightsByPriority Tests
// ============================================================================

describe('sortInsightsByPriority', () => {
  it('should sort wins before risks', () => {
    const insights: StrategyInsight[] = [
      {
        id: 'risk1',
        category: 'risks',
        title: 'Risk',
        summary: 'A risk',
        evidence: { eventIds: [] },
        metrics: { avgAttributionScore: 50, confidence: 70, impactScoreAvg: 50, sampleSize: 2 },
      },
      {
        id: 'win1',
        category: 'wins',
        title: 'Win',
        summary: 'A win',
        evidence: { eventIds: [] },
        metrics: { avgAttributionScore: 80, confidence: 80, impactScoreAvg: 50, sampleSize: 2 },
      },
    ];

    const sorted = sortInsightsByPriority(insights);
    expect(sorted[0].category).toBe('wins');
    expect(sorted[1].category).toBe('risks');
  });

  it('should sort by attribution score within same category', () => {
    const insights: StrategyInsight[] = [
      {
        id: 'win1',
        category: 'wins',
        title: 'Low Score Win',
        summary: 'A win',
        evidence: { eventIds: [] },
        metrics: { avgAttributionScore: 60, confidence: 70, impactScoreAvg: 50, sampleSize: 2 },
      },
      {
        id: 'win2',
        category: 'wins',
        title: 'High Score Win',
        summary: 'A win',
        evidence: { eventIds: [] },
        metrics: { avgAttributionScore: 90, confidence: 70, impactScoreAvg: 50, sampleSize: 2 },
      },
    ];

    const sorted = sortInsightsByPriority(insights);
    expect(sorted[0].metrics.avgAttributionScore).toBe(90);
    expect(sorted[1].metrics.avgAttributionScore).toBe(60);
  });

  it('should produce stable ordering for equal priorities', () => {
    const insights: StrategyInsight[] = [
      {
        id: 'b_insight',
        category: 'wins',
        title: 'B',
        summary: 'A win',
        evidence: { eventIds: [] },
        metrics: { avgAttributionScore: 80, confidence: 80, impactScoreAvg: 50, sampleSize: 2 },
      },
      {
        id: 'a_insight',
        category: 'wins',
        title: 'A',
        summary: 'A win',
        evidence: { eventIds: [] },
        metrics: { avgAttributionScore: 80, confidence: 80, impactScoreAvg: 50, sampleSize: 2 },
      },
    ];

    const sorted1 = sortInsightsByPriority(insights);
    const sorted2 = sortInsightsByPriority([...insights].reverse());

    // Should be stable regardless of input order
    expect(sorted1.map(i => i.id)).toEqual(sorted2.map(i => i.id));
  });
});

// ============================================================================
// Win/Risk Threshold Tests
// ============================================================================

describe('win/risk thresholds', () => {
  it('should classify events with positive direction and high score as wins', () => {
    const event = createMockEvent({ id: 'event_1' });
    const attribution = createMockAttribution('event_1', {
      direction: 'positive',
      attributionScore: INSIGHT_THRESHOLDS.WIN_MIN_SCORE,
      confidence: INSIGHT_THRESHOLDS.MIN_CONFIDENCE,
      topDrivers: [createMockTopDriver('completed')],
    });

    const result = generateInsights({
      events: [event],
      attributions: new Map([['event_1', attribution]]),
      window: { preDays: 30, postDays: 30 },
    });

    const winInsights = result.insights.filter(i => i.category === 'wins');
    expect(winInsights.length).toBeGreaterThan(0);
  });

  it('should not classify events below win threshold as wins', () => {
    const event = createMockEvent({ id: 'event_1' });
    const attribution = createMockAttribution('event_1', {
      direction: 'positive',
      attributionScore: INSIGHT_THRESHOLDS.WIN_MIN_SCORE - 1,
      confidence: INSIGHT_THRESHOLDS.MIN_CONFIDENCE,
    });

    const result = generateInsights({
      events: [event],
      attributions: new Map([['event_1', attribution]]),
      window: { preDays: 30, postDays: 30 },
    });

    const winInsights = result.insights.filter(i => i.category === 'wins');
    expect(winInsights.length).toBe(0);
  });

  it('should classify events with negative direction and low score as risks', () => {
    const event = createMockEvent({ id: 'event_1' });
    const attribution = createMockAttribution('event_1', {
      direction: 'negative',
      attributionScore: INSIGHT_THRESHOLDS.RISK_MAX_SCORE,
      confidence: INSIGHT_THRESHOLDS.MIN_CONFIDENCE,
    });

    const result = generateInsights({
      events: [event],
      attributions: new Map([['event_1', attribution]]),
      window: { preDays: 30, postDays: 30 },
    });

    const riskInsights = result.insights.filter(i => i.category === 'risks');
    expect(riskInsights.length).toBeGreaterThan(0);
  });

  it('should classify events with risk flags as risks even without attribution', () => {
    const event = createMockEvent({
      id: 'event_1',
      diffSummary: {
        added: 0,
        removed: 1,
        modified: 0,
        summary: 'Goal changed',
        changes: [],
        impactScore: 90,
        riskFlags: ['goal_changed'],
      },
    });

    const result = generateInsights({
      events: [event],
      attributions: new Map(), // No attribution
      window: { preDays: 30, postDays: 30 },
    });

    const riskInsights = result.insights.filter(i => i.category === 'risks');
    expect(riskInsights.length).toBeGreaterThan(0);
  });

  it('should not classify low-confidence events as wins even with positive direction', () => {
    const event = createMockEvent({ id: 'event_1' });
    const attribution = createMockAttribution('event_1', {
      direction: 'positive',
      attributionScore: 80,
      confidence: INSIGHT_THRESHOLDS.MIN_CONFIDENCE - 1,
    });

    const result = generateInsights({
      events: [event],
      attributions: new Map([['event_1', attribution]]),
      window: { preDays: 30, postDays: 30 },
    });

    const winInsights = result.insights.filter(i => i.category === 'wins');
    expect(winInsights.length).toBe(0);
  });
});

// ============================================================================
// Driver Leaderboard Tests
// ============================================================================

describe('generateDriverLeaderboard', () => {
  it('should aggregate drivers across multiple events', () => {
    const events = [
      createMockEvent({ id: 'event_1' }),
      createMockEvent({ id: 'event_2' }),
    ];
    const attributions = new Map([
      ['event_1', createMockAttribution('event_1', {
        topDrivers: [
          createMockTopDriver('completed', { contribution: 40 }),
        ],
      })],
      ['event_2', createMockAttribution('event_2', {
        topDrivers: [
          createMockTopDriver('completed', { contribution: 30 }),
        ],
      })],
    ]);

    const pairs = events.map(event => ({
      event,
      attribution: attributions.get(event.id),
    }));

    const leaderboard = generateDriverLeaderboard(pairs);

    const completedDriver = leaderboard.find(d => d.label === 'completed');
    expect(completedDriver).toBeDefined();
    expect(completedDriver!.totalContribution).toBe(70);
    expect(completedDriver!.eventCount).toBe(2);
    expect(completedDriver!.avgContribution).toBe(35);
  });

  it('should sort drivers by total contribution descending', () => {
    const event = createMockEvent({ id: 'event_1' });
    const attribution = createMockAttribution('event_1', {
      topDrivers: [
        createMockTopDriver('low', { contribution: 20 }),
        createMockTopDriver('high', { contribution: 80 }),
        createMockTopDriver('medium', { contribution: 50 }),
      ],
    });

    const pairs = [{ event, attribution }];
    const leaderboard = generateDriverLeaderboard(pairs);

    expect(leaderboard[0].label).toBe('high');
    expect(leaderboard[1].label).toBe('medium');
    expect(leaderboard[2].label).toBe('low');
  });

  it('should produce stable ordering for equal contributions', () => {
    const event = createMockEvent({ id: 'event_1' });
    const attribution = createMockAttribution('event_1', {
      topDrivers: [
        createMockTopDriver('beta', { contribution: 50 }),
        createMockTopDriver('alpha', { contribution: 50 }),
      ],
    });

    const pairs = [{ event, attribution }];
    const leaderboard1 = generateDriverLeaderboard(pairs);
    const leaderboard2 = generateDriverLeaderboard(pairs);

    expect(leaderboard1.map(d => d.label)).toEqual(leaderboard2.map(d => d.label));
  });

  it('should determine predominant direction from multiple events', () => {
    const events = [
      createMockEvent({ id: 'event_1' }),
      createMockEvent({ id: 'event_2' }),
      createMockEvent({ id: 'event_3' }),
    ];
    const attributions = new Map([
      ['event_1', createMockAttribution('event_1', {
        topDrivers: [createMockTopDriver('test', { direction: 'positive' })],
      })],
      ['event_2', createMockAttribution('event_2', {
        topDrivers: [createMockTopDriver('test', { direction: 'positive' })],
      })],
      ['event_3', createMockAttribution('event_3', {
        topDrivers: [createMockTopDriver('test', { direction: 'negative' })],
      })],
    ]);

    const pairs = events.map(event => ({
      event,
      attribution: attributions.get(event.id),
    }));

    const leaderboard = generateDriverLeaderboard(pairs);
    const testDriver = leaderboard.find(d => d.label === 'test');

    expect(testDriver!.predominantDirection).toBe('positive'); // 2 positive vs 1 negative
  });
});

// ============================================================================
// Pattern Detection Tests
// ============================================================================

describe('detectPatterns', () => {
  it('should detect repeating driver patterns', () => {
    const events = [
      createMockEvent({ id: 'event_1' }),
      createMockEvent({ id: 'event_2' }),
      createMockEvent({ id: 'event_3' }),
    ];
    const attributions = new Map([
      ['event_1', createMockAttribution('event_1', {
        topDrivers: [createMockTopDriver('completed')],
      })],
      ['event_2', createMockAttribution('event_2', {
        topDrivers: [createMockTopDriver('completed')],
      })],
      ['event_3', createMockAttribution('event_3', {
        topDrivers: [createMockTopDriver('completed')],
      })],
    ]);

    const pairs = events.map(event => ({
      event,
      attribution: attributions.get(event.id),
    }));

    const patterns = detectPatterns(pairs);

    const repeatingPattern = patterns.find(p => p.type === 'repeating_driver');
    expect(repeatingPattern).toBeDefined();
    expect(repeatingPattern!.eventIds.length).toBe(3);
  });

  it('should detect risk flag clusters', () => {
    const events = [
      createMockEvent({
        id: 'event_1',
        diffSummary: {
          added: 0,
          removed: 1,
          modified: 0,
          summary: 'Removed objective',
          changes: [],
          impactScore: 70,
          riskFlags: ['objective_removed'],
        },
      }),
      createMockEvent({
        id: 'event_2',
        diffSummary: {
          added: 0,
          removed: 1,
          modified: 0,
          summary: 'Removed another objective',
          changes: [],
          impactScore: 70,
          riskFlags: ['objective_removed'],
        },
      }),
    ];

    const pairs = events.map(event => ({
      event,
      attribution: undefined,
    }));

    const patterns = detectPatterns(pairs);

    const riskCluster = patterns.find(p => p.type === 'risk_cluster');
    expect(riskCluster).toBeDefined();
    expect(riskCluster!.description).toContain('objective_removed');
  });

  it('should detect positive direction trends', () => {
    const events = [
      createMockEvent({ id: 'event_1' }),
      createMockEvent({ id: 'event_2' }),
      createMockEvent({ id: 'event_3' }),
      createMockEvent({ id: 'event_4' }),
    ];
    const attributions = new Map([
      ['event_1', createMockAttribution('event_1', { direction: 'positive' })],
      ['event_2', createMockAttribution('event_2', { direction: 'positive' })],
      ['event_3', createMockAttribution('event_3', { direction: 'positive' })],
      ['event_4', createMockAttribution('event_4', { direction: 'neutral' })],
    ]);

    const pairs = events.map(event => ({
      event,
      attribution: attributions.get(event.id),
    }));

    const patterns = detectPatterns(pairs);

    const directionTrend = patterns.find(p => p.type === 'direction_trend');
    expect(directionTrend).toBeDefined();
    expect(directionTrend!.description).toContain('positive');
  });

  it('should detect scope churn patterns', () => {
    const events = [
      createMockEvent({
        id: 'event_1',
        diffSummary: {
          added: 5,
          removed: 3,
          modified: 2,
          summary: 'Major change',
          changes: [],
          impactScore: 80,
          riskFlags: [],
        },
      }),
      createMockEvent({
        id: 'event_2',
        diffSummary: {
          added: 0,
          removed: 0,
          modified: 10,
          summary: 'Many tactics changed',
          changes: [],
          impactScore: 75,
          riskFlags: ['many_tactics_changed'],
        },
      }),
    ];

    const pairs = events.map(event => ({
      event,
      attribution: undefined,
    }));

    const patterns = detectPatterns(pairs);

    const scopeChurn = patterns.find(p => p.type === 'scope_churn');
    expect(scopeChurn).toBeDefined();
  });

  it('should sort patterns by strength', () => {
    const events = [
      createMockEvent({ id: 'event_1' }),
      createMockEvent({ id: 'event_2' }),
      createMockEvent({ id: 'event_3' }),
      createMockEvent({ id: 'event_4' }),
      createMockEvent({ id: 'event_5' }),
    ];
    const attributions = new Map([
      ['event_1', createMockAttribution('event_1', {
        topDrivers: [createMockTopDriver('high_frequency')],
      })],
      ['event_2', createMockAttribution('event_2', {
        topDrivers: [createMockTopDriver('high_frequency')],
      })],
      ['event_3', createMockAttribution('event_3', {
        topDrivers: [createMockTopDriver('high_frequency')],
      })],
      ['event_4', createMockAttribution('event_4', {
        topDrivers: [createMockTopDriver('high_frequency')],
      })],
      ['event_5', createMockAttribution('event_5', {
        topDrivers: [createMockTopDriver('low_frequency')],
      })],
    ]);

    const pairs = events.map(event => ({
      event,
      attribution: attributions.get(event.id),
    }));

    const patterns = detectPatterns(pairs);

    // Should be sorted by strength descending
    for (let i = 1; i < patterns.length; i++) {
      expect(patterns[i - 1].strength).toBeGreaterThanOrEqual(patterns[i].strength);
    }
  });
});

// ============================================================================
// Recommended Actions Tests
// ============================================================================

describe('generateRecommendedActions', () => {
  it('should generate expand_success_pattern action for positive drivers', () => {
    const leaderboard = [
      {
        label: 'completed',
        type: 'signalType' as const,
        totalContribution: 80,
        avgContribution: 40,
        eventCount: 2,
        predominantDirection: 'positive' as const,
        eventIds: ['event_1', 'event_2'],
      },
    ];

    const actions = generateRecommendedActions([], leaderboard, []);

    const expandAction = actions.find(a => a.actionType === 'expand_success_pattern');
    expect(expandAction).toBeDefined();
    expect(expandAction!.target).toBe('completed');
    expect(expandAction!.confidence).toBeGreaterThan(50);
  });

  it('should generate reduce_scope_churn action for scope churn patterns', () => {
    const scopeChurnPattern = {
      id: 'pattern_1',
      type: 'scope_churn' as const,
      description: '3 high-impact changes',
      strength: 60,
      eventIds: ['event_1', 'event_2', 'event_3'],
    };

    const actions = generateRecommendedActions([], [], [scopeChurnPattern]);

    const reduceChurnAction = actions.find(a => a.actionType === 'reduce_scope_churn');
    expect(reduceChurnAction).toBeDefined();
    expect(reduceChurnAction!.how.length).toBeGreaterThan(0);
    expect(reduceChurnAction!.guardrails.length).toBeGreaterThan(0);
  });

  it('should generate add_measurement_loop for low confidence events', () => {
    const events = [
      createMockEvent({ id: 'event_1' }),
      createMockEvent({ id: 'event_2' }),
    ];
    const attributions = new Map([
      ['event_1', createMockAttribution('event_1', { confidence: 30 })],
      ['event_2', createMockAttribution('event_2', { confidence: 40 })],
    ]);

    const pairs = events.map(event => ({
      event,
      attribution: attributions.get(event.id),
    }));

    const actions = generateRecommendedActions(pairs, [], []);

    const measurementAction = actions.find(a => a.actionType === 'add_measurement_loop');
    expect(measurementAction).toBeDefined();
  });

  it('should generate consolidate_neutral_changes for many neutral events', () => {
    const events = [
      createMockEvent({ id: 'event_1' }),
      createMockEvent({ id: 'event_2' }),
      createMockEvent({ id: 'event_3' }),
    ];
    const attributions = new Map([
      ['event_1', createMockAttribution('event_1', { direction: 'neutral' })],
      ['event_2', createMockAttribution('event_2', { direction: 'neutral' })],
      ['event_3', createMockAttribution('event_3', { direction: 'neutral' })],
    ]);

    const pairs = events.map(event => ({
      event,
      attribution: attributions.get(event.id),
    }));

    const actions = generateRecommendedActions(pairs, [], []);

    const consolidateAction = actions.find(a => a.actionType === 'consolidate_neutral_changes');
    expect(consolidateAction).toBeDefined();
  });

  it('should sort actions by confidence then expected impact', () => {
    const events = [
      createMockEvent({ id: 'event_1' }),
      createMockEvent({ id: 'event_2' }),
      createMockEvent({ id: 'event_3' }),
    ];
    const attributions = new Map([
      ['event_1', createMockAttribution('event_1', { confidence: 30, direction: 'neutral' })],
      ['event_2', createMockAttribution('event_2', { confidence: 35, direction: 'neutral' })],
      ['event_3', createMockAttribution('event_3', { confidence: 40, direction: 'neutral' })],
    ]);

    const pairs = events.map(event => ({
      event,
      attribution: attributions.get(event.id),
    }));

    const positiveDriver = {
      label: 'high_impact',
      type: 'signalType' as const,
      totalContribution: 100,
      avgContribution: 50,
      eventCount: 2,
      predominantDirection: 'positive' as const,
      eventIds: ['event_1', 'event_2'],
    };

    const actions = generateRecommendedActions(pairs, [positiveDriver], []);

    // Should be sorted by confidence descending
    for (let i = 1; i < actions.length; i++) {
      expect(actions[i - 1].confidence).toBeGreaterThanOrEqual(actions[i].confidence);
    }
  });
});

// ============================================================================
// Coverage Computation Tests
// ============================================================================

describe('computeCoverage', () => {
  it('should compute coverage correctly', () => {
    const events = [
      createMockEvent({ id: 'event_1' }),
      createMockEvent({ id: 'event_2' }),
      createMockEvent({ id: 'event_3' }),
    ];
    const attributions = new Map([
      ['event_1', createMockAttribution('event_1')],
      ['event_2', createMockAttribution('event_2')],
    ]);
    const insights: StrategyInsight[] = [
      {
        id: 'insight_1',
        category: 'wins',
        title: 'Test',
        summary: 'Test',
        evidence: { eventIds: ['event_1', 'event_2'] },
        metrics: { avgAttributionScore: 80, confidence: 80, impactScoreAvg: 50, sampleSize: 2 },
      },
    ];

    const coverage = computeCoverage(events, attributions, insights);

    expect(coverage.totalEvents).toBe(3);
    expect(coverage.eventsWithAttribution).toBe(2);
    expect(coverage.eventsInInsights).toBe(2);
    expect(coverage.coveragePercent).toBe(67); // 2/3 rounded
  });

  it('should handle empty events', () => {
    const coverage = computeCoverage([], new Map(), []);

    expect(coverage.totalEvents).toBe(0);
    expect(coverage.eventsWithAttribution).toBe(0);
    expect(coverage.eventsInInsights).toBe(0);
    expect(coverage.coveragePercent).toBe(0);
  });

  it('should count unique events in insights', () => {
    const events = [createMockEvent({ id: 'event_1' })];
    const attributions = new Map([['event_1', createMockAttribution('event_1')]]);
    const insights: StrategyInsight[] = [
      {
        id: 'insight_1',
        category: 'wins',
        title: 'Test 1',
        summary: 'Test',
        evidence: { eventIds: ['event_1'] },
        metrics: { avgAttributionScore: 80, confidence: 80, impactScoreAvg: 50, sampleSize: 1 },
      },
      {
        id: 'insight_2',
        category: 'risks',
        title: 'Test 2',
        summary: 'Test',
        evidence: { eventIds: ['event_1'] }, // Same event appears in multiple insights
        metrics: { avgAttributionScore: 20, confidence: 70, impactScoreAvg: 50, sampleSize: 1 },
      },
    ];

    const coverage = computeCoverage(events, attributions, insights);

    expect(coverage.eventsInInsights).toBe(1); // Should count unique events
  });
});

// ============================================================================
// Output Stability Tests
// ============================================================================

describe('output stability', () => {
  it('should produce stable insight output for same inputs', () => {
    const events = [
      createMockEvent({ id: 'event_1' }),
      createMockEvent({ id: 'event_2' }),
    ];
    const attributions = new Map([
      ['event_1', createMockAttribution('event_1', {
        direction: 'positive',
        attributionScore: 75,
        confidence: 80,
        topDrivers: [createMockTopDriver('completed')],
      })],
      ['event_2', createMockAttribution('event_2', {
        direction: 'positive',
        attributionScore: 70,
        confidence: 75,
        topDrivers: [createMockTopDriver('completed')],
      })],
    ]);

    const input: GenerateInsightsInput = {
      events,
      attributions,
      window: { preDays: 30, postDays: 30 },
    };

    const result1 = generateInsights(input);
    const result2 = generateInsights(input);

    // Insight IDs and order should be stable
    expect(result1.insights.map(i => i.id)).toEqual(result2.insights.map(i => i.id));

    // Leaderboard order should be stable
    expect(result1.rollups.driverLeaderboard.map(d => d.label))
      .toEqual(result2.rollups.driverLeaderboard.map(d => d.label));

    // Pattern order should be stable
    expect(result1.rollups.patterns.map(p => p.id))
      .toEqual(result2.rollups.patterns.map(p => p.id));
  });

  it('should produce stable results regardless of input event order', () => {
    const events = [
      createMockEvent({ id: 'event_a' }),
      createMockEvent({ id: 'event_b' }),
      createMockEvent({ id: 'event_c' }),
    ];
    const attributions = new Map([
      ['event_a', createMockAttribution('event_a', {
        direction: 'positive',
        attributionScore: 80,
        confidence: 80,
        topDrivers: [createMockTopDriver('completed')],
      })],
      ['event_b', createMockAttribution('event_b', {
        direction: 'positive',
        attributionScore: 75,
        confidence: 75,
        topDrivers: [createMockTopDriver('completed')],
      })],
      ['event_c', createMockAttribution('event_c', {
        direction: 'positive',
        attributionScore: 70,
        confidence: 70,
        topDrivers: [createMockTopDriver('completed')],
      })],
    ]);

    const result1 = generateInsights({
      events,
      attributions,
      window: { preDays: 30, postDays: 30 },
    });

    // Reverse the event order
    const result2 = generateInsights({
      events: [...events].reverse(),
      attributions,
      window: { preDays: 30, postDays: 30 },
    });

    // Insight IDs should be the same (order may differ due to metrics)
    const ids1 = new Set(result1.insights.map(i => i.id));
    const ids2 = new Set(result2.insights.map(i => i.id));
    expect(ids1).toEqual(ids2);
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('generateInsights integration', () => {
  it('should generate complete result with all sections', () => {
    const events = [
      createMockEvent({ id: 'event_1' }),
      createMockEvent({ id: 'event_2' }),
      createMockEvent({ id: 'event_3' }),
    ];
    const attributions = new Map([
      ['event_1', createMockAttribution('event_1', {
        direction: 'positive',
        attributionScore: 80,
        confidence: 80,
        topDrivers: [createMockTopDriver('completed', { contribution: 50 })],
      })],
      ['event_2', createMockAttribution('event_2', {
        direction: 'negative',
        attributionScore: 25,
        confidence: 70,
        topDrivers: [createMockTopDriver('abandoned', { direction: 'negative', contribution: 40 })],
      })],
      ['event_3', createMockAttribution('event_3', {
        direction: 'neutral',
        attributionScore: 50,
        confidence: 60,
        topDrivers: [createMockTopDriver('completed', { contribution: 30 })],
      })],
    ]);

    const result = generateInsights({
      events,
      attributions,
      window: { preDays: 30, postDays: 30 },
    });

    // Should have insights
    expect(result.insights.length).toBeGreaterThan(0);

    // Should have rollups
    expect(result.rollups.driverLeaderboard.length).toBeGreaterThan(0);
    expect(result.rollups.coverage.totalEvents).toBe(3);

    // Should have window info
    expect(result.window.preDays).toBe(30);
    expect(result.window.postDays).toBe(30);

    // Should have timestamp
    expect(result.generatedAt).toBeDefined();
    expect(new Date(result.generatedAt).getTime()).not.toBeNaN();
  });

  it('should handle empty inputs gracefully', () => {
    const result = generateInsights({
      events: [],
      attributions: new Map(),
      window: { preDays: 30, postDays: 30 },
    });

    expect(result.insights).toEqual([]);
    expect(result.rollups.driverLeaderboard).toEqual([]);
    expect(result.rollups.patterns).toEqual([]);
    expect(result.rollups.recommendedActions).toEqual([]);
    expect(result.rollups.coverage.totalEvents).toBe(0);
  });

  it('should handle events without attribution gracefully', () => {
    const events = [
      createMockEvent({ id: 'event_1' }),
      createMockEvent({ id: 'event_2' }),
    ];

    const result = generateInsights({
      events,
      attributions: new Map(), // No attributions
      window: { preDays: 30, postDays: 30 },
    });

    // Should still produce coverage stats
    expect(result.rollups.coverage.totalEvents).toBe(2);
    expect(result.rollups.coverage.eventsWithAttribution).toBe(0);
  });
});
