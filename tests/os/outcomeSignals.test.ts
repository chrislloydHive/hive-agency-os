// tests/os/outcomeSignals.test.ts
// Tests for Phase 21: Outcome Signal Loop & Strategy Learning
//
// Tests cover:
// - Signal derivation logic
// - Confidence assignment
// - No duplicate signals
// - Edge cases (missing data, partial execution)

import { describe, test, expect } from 'vitest';
import {
  generateArtifactSignals,
  generateWorkSignals,
  deduplicateSignals,
  calculateConfidence,
  SIGNAL_THRESHOLDS,
  type ArtifactSignalContext,
  type WorkSignalContext,
} from '@/lib/os/outcomes/generateSignals';
import {
  getSignalsByStrategy,
  getSignalsByTactic,
  getTopLearnings,
  getUnderperformingArtifacts,
  generateStrategySummary,
  getTacticOutcomeSummary,
  generateLearningsSummary,
} from '@/lib/os/outcomes/retrospective';
import type { OutcomeSignal } from '@/lib/types/outcomeSignal';
import {
  generateSignalId,
  isPositiveSignal,
  isImprovementSignal,
  sortSignalsByRelevance,
} from '@/lib/types/outcomeSignal';

// ============================================================================
// Test Helpers
// ============================================================================

function createMockArtifactContext(
  overrides: Partial<ArtifactSignalContext> = {}
): ArtifactSignalContext {
  return {
    artifactId: 'art_1',
    artifactType: 'media_brief',
    artifactTitle: 'Test Artifact',
    artifactStatus: 'final',
    workItemsCreated: 0,
    workItemsCompleted: 0,
    daysSinceCreation: 10,
    feedbackRatings: { helpful: 0, neutral: 0, not_helpful: 0 },
    ...overrides,
  };
}

function createMockWorkContext(
  overrides: Partial<WorkSignalContext> = {}
): WorkSignalContext {
  return {
    workItemId: 'work_1',
    workItemTitle: 'Test Work Item',
    workItemStatus: 'Backlog',
    daysSinceCreation: 10,
    daysInCurrentStatus: 10,
    ...overrides,
  };
}

function createMockSignal(overrides: Partial<OutcomeSignal> = {}): OutcomeSignal {
  return {
    id: generateSignalId(),
    source: 'artifact',
    sourceId: 'art_1',
    signalType: 'learning',
    confidence: 'medium',
    summary: 'Test signal',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================================================
// generateArtifactSignals Tests
// ============================================================================

describe('generateArtifactSignals', () => {
  test('returns empty array for draft artifacts', () => {
    const context = createMockArtifactContext({ artifactStatus: 'draft' });
    const signals = generateArtifactSignals(context);

    expect(signals).toHaveLength(0);
  });

  test('generates completed signal when all work items done', () => {
    const context = createMockArtifactContext({
      workItemsCreated: 5,
      workItemsCompleted: 5,
    });
    const signals = generateArtifactSignals(context);

    expect(signals.length).toBeGreaterThanOrEqual(1);
    const completedSignal = signals.find(s => s.signalType === 'completed');
    expect(completedSignal).toBeDefined();
    expect(completedSignal?.confidence).toBe('high');
    expect(completedSignal?.summary).toContain('completed');
  });

  test('generates learning signal for partial completion after stall period', () => {
    const context = createMockArtifactContext({
      workItemsCreated: 10,
      workItemsCompleted: 6, // 60% complete
      daysSinceCreation: SIGNAL_THRESHOLDS.STALL_DAYS + 1,
    });
    const signals = generateArtifactSignals(context);

    const learningSignal = signals.find(s => s.signalType === 'learning');
    expect(learningSignal).toBeDefined();
    expect(learningSignal?.summary).toContain('partially executed');
  });

  test('generates abandoned signal for low completion after abandon period', () => {
    const context = createMockArtifactContext({
      workItemsCreated: 10,
      workItemsCompleted: 2, // 20% complete
      daysSinceCreation: SIGNAL_THRESHOLDS.ABANDON_DAYS + 1,
    });
    const signals = generateArtifactSignals(context);

    const abandonedSignal = signals.find(s => s.signalType === 'abandoned');
    expect(abandonedSignal).toBeDefined();
    expect(abandonedSignal?.summary).toContain('abandoned');
  });

  test('generates high-impact signal for high feedback + execution', () => {
    const context = createMockArtifactContext({
      workItemsCreated: 5,
      workItemsCompleted: 3,
      feedbackRatings: { helpful: 8, neutral: 1, not_helpful: 1 }, // 80% helpful
    });
    const signals = generateArtifactSignals(context);

    const highImpactSignal = signals.find(s => s.signalType === 'high-impact');
    expect(highImpactSignal).toBeDefined();
    expect(highImpactSignal?.confidence).toBe('high');
  });

  test('generates learning signal for negative feedback', () => {
    const context = createMockArtifactContext({
      feedbackRatings: { helpful: 1, neutral: 1, not_helpful: 5 }, // >50% not helpful
    });
    const signals = generateArtifactSignals(context);

    const learningSignal = signals.find(
      s => s.signalType === 'learning' && s.summary.includes('feedback')
    );
    expect(learningSignal).toBeDefined();
  });

  test('generates low-impact signal for no execution after stall period', () => {
    const context = createMockArtifactContext({
      workItemsCreated: 0,
      daysSinceCreation: SIGNAL_THRESHOLDS.STALL_DAYS + 1,
      artifactStatus: 'final',
    });
    const signals = generateArtifactSignals(context);

    const lowImpactSignal = signals.find(s => s.signalType === 'low-impact');
    expect(lowImpactSignal).toBeDefined();
    expect(lowImpactSignal?.summary).toContain('never converted');
  });

  test('includes strategy and tactic IDs in signals', () => {
    const context = createMockArtifactContext({
      workItemsCreated: 5,
      workItemsCompleted: 5,
      strategyId: 'strat_1',
      tacticIds: ['tac_1', 'tac_2'],
    });
    const signals = generateArtifactSignals(context);

    expect(signals.length).toBeGreaterThan(0);
    signals.forEach(signal => {
      expect(signal.strategyId).toBe('strat_1');
      expect(signal.tacticIds).toEqual(['tac_1', 'tac_2']);
    });
  });
});

// ============================================================================
// generateWorkSignals Tests
// ============================================================================

describe('generateWorkSignals', () => {
  test('generates completed signal for done work items', () => {
    const context = createMockWorkContext({
      workItemStatus: 'Done',
      daysSinceCreation: 7,
    });
    const signals = generateWorkSignals(context);

    const completedSignal = signals.find(s => s.signalType === 'completed');
    expect(completedSignal).toBeDefined();
    expect(completedSignal?.confidence).toBe('high'); // Quick completion
  });

  test('assigns lower confidence for slow completion', () => {
    const context = createMockWorkContext({
      workItemStatus: 'Done',
      daysSinceCreation: 45,
    });
    const signals = generateWorkSignals(context);

    const completedSignal = signals.find(s => s.signalType === 'completed');
    expect(completedSignal?.confidence).toBe('low');
  });

  test('generates learning signal for stalled in-progress work', () => {
    const context = createMockWorkContext({
      workItemStatus: 'In Progress',
      daysInCurrentStatus: SIGNAL_THRESHOLDS.STALL_DAYS + 1,
    });
    const signals = generateWorkSignals(context);

    const learningSignal = signals.find(s => s.signalType === 'learning');
    expect(learningSignal).toBeDefined();
    expect(learningSignal?.summary).toContain('in progress');
  });

  test('generates abandoned signal for old backlog items', () => {
    const context = createMockWorkContext({
      workItemStatus: 'Backlog',
      daysSinceCreation: SIGNAL_THRESHOLDS.ABANDON_DAYS + 1,
    });
    const signals = generateWorkSignals(context);

    const abandonedSignal = signals.find(s => s.signalType === 'abandoned');
    expect(abandonedSignal).toBeDefined();
    expect(abandonedSignal?.confidence).toBe('low');
  });
});

// ============================================================================
// deduplicateSignals Tests
// ============================================================================

describe('deduplicateSignals', () => {
  test('removes duplicate signals by source+type', () => {
    const signal1 = createMockSignal({
      sourceId: 'art_1',
      signalType: 'completed',
      createdAt: '2024-01-01T00:00:00Z',
    });
    const signal2 = createMockSignal({
      sourceId: 'art_1',
      signalType: 'completed',
      createdAt: '2024-01-02T00:00:00Z', // Newer
    });
    const signal3 = createMockSignal({
      sourceId: 'art_2',
      signalType: 'completed',
    });

    const deduped = deduplicateSignals([signal1, signal2, signal3]);

    expect(deduped).toHaveLength(2);
    // Should keep the newer signal for art_1
    expect(deduped.find(s => s.sourceId === 'art_1')?.createdAt).toBe('2024-01-02T00:00:00Z');
  });

  test('keeps signals with different types for same source', () => {
    const signal1 = createMockSignal({
      sourceId: 'art_1',
      signalType: 'completed',
    });
    const signal2 = createMockSignal({
      sourceId: 'art_1',
      signalType: 'high-impact',
    });

    const deduped = deduplicateSignals([signal1, signal2]);

    expect(deduped).toHaveLength(2);
  });
});

// ============================================================================
// calculateConfidence Tests
// ============================================================================

describe('calculateConfidence', () => {
  test('returns high confidence for strong evidence', () => {
    const confidence = calculateConfidence({
      hasExecution: true,
      completionRate: 0.95,
      feedbackCount: 15,
      daysSinceAction: 5,
    });

    expect(confidence).toBe('high');
  });

  test('returns medium confidence for moderate evidence', () => {
    const confidence = calculateConfidence({
      hasExecution: true,
      completionRate: 0.6,
    });

    expect(confidence).toBe('medium');
  });

  test('returns low confidence for weak evidence', () => {
    const confidence = calculateConfidence({
      hasExecution: false,
      completionRate: 0.2,
      daysSinceAction: 60,
    });

    expect(confidence).toBe('low');
  });
});

// ============================================================================
// Retrospective Helper Tests
// ============================================================================

describe('getSignalsByStrategy', () => {
  test('filters signals by strategy ID', () => {
    const signals = [
      createMockSignal({ strategyId: 'strat_1' }),
      createMockSignal({ strategyId: 'strat_2' }),
      createMockSignal({ strategyId: 'strat_1' }),
    ];

    const filtered = getSignalsByStrategy(signals, 'strat_1');

    expect(filtered).toHaveLength(2);
    filtered.forEach(s => expect(s.strategyId).toBe('strat_1'));
  });
});

describe('getSignalsByTactic', () => {
  test('filters signals by tactic ID', () => {
    const signals = [
      createMockSignal({ tacticIds: ['tac_1', 'tac_2'] }),
      createMockSignal({ tacticIds: ['tac_2', 'tac_3'] }),
      createMockSignal({ tacticIds: ['tac_3'] }),
    ];

    const filtered = getSignalsByTactic(signals, 'tac_2');

    expect(filtered).toHaveLength(2);
  });
});

describe('getTopLearnings', () => {
  test('returns sorted, limited signals', () => {
    const signals = [
      createMockSignal({ signalType: 'learning', confidence: 'low' }),
      createMockSignal({ signalType: 'high-impact', confidence: 'high' }),
      createMockSignal({ signalType: 'completed', confidence: 'medium' }),
      createMockSignal({ signalType: 'learning', confidence: 'high' }),
    ];

    const learnings = getTopLearnings(signals, { limit: 2 });

    expect(learnings).toHaveLength(2);
    // Should prioritize high confidence
    expect(learnings[0].confidence).toBe('high');
  });

  test('respects minimum confidence filter', () => {
    const signals = [
      createMockSignal({ signalType: 'learning', confidence: 'low' }),
      createMockSignal({ signalType: 'learning', confidence: 'medium' }),
    ];

    const learnings = getTopLearnings(signals, { minConfidence: 'medium' });

    expect(learnings).toHaveLength(1);
    expect(learnings[0].confidence).toBe('medium');
  });
});

describe('getUnderperformingArtifacts', () => {
  test('returns low-impact and abandoned artifact signals', () => {
    const signals = [
      createMockSignal({ source: 'artifact', signalType: 'low-impact' }),
      createMockSignal({ source: 'artifact', signalType: 'abandoned' }),
      createMockSignal({ source: 'artifact', signalType: 'completed' }),
      createMockSignal({ source: 'work', signalType: 'low-impact' }),
    ];

    const underperforming = getUnderperformingArtifacts(signals);

    expect(underperforming).toHaveLength(2);
    underperforming.forEach(s => {
      expect(s.source).toBe('artifact');
      expect(['low-impact', 'abandoned']).toContain(s.signalType);
    });
  });
});

describe('generateStrategySummary', () => {
  test('generates correct summary statistics', () => {
    const signals = [
      createMockSignal({ strategyId: 'strat_1', signalType: 'completed' }),
      createMockSignal({ strategyId: 'strat_1', signalType: 'high-impact' }),
      createMockSignal({ strategyId: 'strat_1', signalType: 'learning' }),
      createMockSignal({ strategyId: 'strat_2', signalType: 'completed' }),
    ];

    const summary = generateStrategySummary(signals, 'strat_1');

    expect(summary.strategyId).toBe('strat_1');
    expect(summary.totalSignals).toBe(3);
    expect(summary.byType.completed).toBe(1);
    expect(summary.byType['high-impact']).toBe(1);
    expect(summary.byType.learning).toBe(1);
  });
});

describe('getTacticOutcomeSummary', () => {
  test('calculates effectiveness score correctly', () => {
    const signals = [
      createMockSignal({ tacticIds: ['tac_1'], signalType: 'completed' }),
      createMockSignal({ tacticIds: ['tac_1'], signalType: 'high-impact' }),
    ];

    const summary = getTacticOutcomeSummary(signals, 'tac_1');

    expect(summary.tacticId).toBe('tac_1');
    expect(summary.totalSignals).toBe(2);
    expect(summary.positiveCount).toBe(2);
    expect(summary.effectivenessScore).toBeGreaterThan(50);
  });
});

describe('generateLearningsSummary', () => {
  test('returns empty summary for no signals', () => {
    const summary = generateLearningsSummary([]);

    expect(summary.hasLearnings).toBe(false);
    expect(summary.totalSignals).toBe(0);
  });

  test('returns populated summary for signals', () => {
    const signals = [
      createMockSignal({ signalType: 'completed', confidence: 'high' }),
      createMockSignal({ signalType: 'learning', confidence: 'medium' }),
    ];

    const summary = generateLearningsSummary(signals);

    expect(summary.hasLearnings).toBe(true);
    expect(summary.totalSignals).toBe(2);
    expect(summary.positiveCount).toBe(1);
    expect(summary.highlightSignal).toBeDefined();
  });
});

// ============================================================================
// Type Helper Tests
// ============================================================================

describe('isPositiveSignal', () => {
  test('returns true for completed and high-impact', () => {
    expect(isPositiveSignal(createMockSignal({ signalType: 'completed' }))).toBe(true);
    expect(isPositiveSignal(createMockSignal({ signalType: 'high-impact' }))).toBe(true);
  });

  test('returns false for other types', () => {
    expect(isPositiveSignal(createMockSignal({ signalType: 'learning' }))).toBe(false);
    expect(isPositiveSignal(createMockSignal({ signalType: 'low-impact' }))).toBe(false);
    expect(isPositiveSignal(createMockSignal({ signalType: 'abandoned' }))).toBe(false);
  });
});

describe('isImprovementSignal', () => {
  test('returns true for abandoned and low-impact', () => {
    expect(isImprovementSignal(createMockSignal({ signalType: 'abandoned' }))).toBe(true);
    expect(isImprovementSignal(createMockSignal({ signalType: 'low-impact' }))).toBe(true);
  });

  test('returns false for other types', () => {
    expect(isImprovementSignal(createMockSignal({ signalType: 'completed' }))).toBe(false);
    expect(isImprovementSignal(createMockSignal({ signalType: 'high-impact' }))).toBe(false);
  });
});

describe('sortSignalsByRelevance', () => {
  test('sorts by confidence then date', () => {
    const signals = [
      createMockSignal({ confidence: 'low', createdAt: '2024-01-03T00:00:00Z' }),
      createMockSignal({ confidence: 'high', createdAt: '2024-01-01T00:00:00Z' }),
      createMockSignal({ confidence: 'high', createdAt: '2024-01-02T00:00:00Z' }),
      createMockSignal({ confidence: 'medium', createdAt: '2024-01-04T00:00:00Z' }),
    ];

    const sorted = sortSignalsByRelevance(signals);

    // High confidence first
    expect(sorted[0].confidence).toBe('high');
    expect(sorted[1].confidence).toBe('high');
    // Then medium
    expect(sorted[2].confidence).toBe('medium');
    // Then low
    expect(sorted[3].confidence).toBe('low');

    // Within same confidence, newer first
    expect(sorted[0].createdAt).toBe('2024-01-02T00:00:00Z');
    expect(sorted[1].createdAt).toBe('2024-01-01T00:00:00Z');
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  test('handles missing feedback data gracefully', () => {
    const context = createMockArtifactContext({
      workItemsCreated: 5,
      workItemsCompleted: 5,
      feedbackRatings: { helpful: 0, neutral: 0, not_helpful: 0 },
    });

    const signals = generateArtifactSignals(context);
    // Should still generate completion signal
    expect(signals.some(s => s.signalType === 'completed')).toBe(true);
  });

  test('handles zero work items', () => {
    const context = createMockArtifactContext({
      workItemsCreated: 0,
      workItemsCompleted: 0,
      daysSinceCreation: 5, // Not past stall threshold
    });

    const signals = generateArtifactSignals(context);
    // No signals for fresh artifact with no work
    expect(signals).toHaveLength(0);
  });

  test('handles work context without source artifact', () => {
    const context = createMockWorkContext({
      workItemStatus: 'Done',
      sourceArtifactId: undefined,
    });

    const signals = generateWorkSignals(context);
    expect(signals.some(s => s.signalType === 'completed')).toBe(true);
  });
});
