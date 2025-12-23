// tests/dma/intentLevel.test.ts
// Unit tests for DMA Intent Level derivation
//
// Tests all intent level rules:
// - High: Full GAP, 2+ runs in 14 days, low score with recent run
// - Medium: Recent IA, repeat IA runs, mid score with activity
// - Low: Single run, high score, old runs
// - None: No runs

import { describe, it, expect } from 'vitest';
import {
  deriveIntentLevel,
  getScoreBand,
  isRecentRun,
  isHighIntentAlert,
  INTENT_THRESHOLDS,
} from '@/lib/dma/intentLevel';
import type { DMARun } from '@/lib/types/dma';

// ============================================================================
// Helper Functions
// ============================================================================

function createRun(
  overrides: Partial<DMARun> & { daysAgo?: number } = {}
): DMARun {
  const { daysAgo = 0, ...rest } = overrides;

  const createdAt = new Date();
  createdAt.setDate(createdAt.getDate() - daysAgo);

  return {
    id: `run-${Math.random().toString(36).slice(2)}`,
    companyId: 'company-1',
    companyName: 'Test Company',
    domain: 'test.com',
    runType: 'GAP_IA',
    score: 70,
    createdAt: createdAt.toISOString(),
    source: 'DMA',
    runUrl: null,
    notes: null,
    websiteUrl: 'https://test.com',
    scoreBand: 'Mid',
    isRerun: false,
    daysSincePreviousRun: null,
    ...rest,
  };
}

// ============================================================================
// getScoreBand Tests
// ============================================================================

describe('getScoreBand', () => {
  it('returns High for score >= 75', () => {
    expect(getScoreBand(75)).toBe('High');
    expect(getScoreBand(100)).toBe('High');
    expect(getScoreBand(85)).toBe('High');
  });

  it('returns Mid for score 55-74', () => {
    expect(getScoreBand(55)).toBe('Mid');
    expect(getScoreBand(74)).toBe('Mid');
    expect(getScoreBand(65)).toBe('Mid');
  });

  it('returns Low for score < 55', () => {
    expect(getScoreBand(54)).toBe('Low');
    expect(getScoreBand(0)).toBe('Low');
    expect(getScoreBand(30)).toBe('Low');
  });

  it('returns NA for null/undefined score', () => {
    expect(getScoreBand(null)).toBe('NA');
    expect(getScoreBand(undefined as any)).toBe('NA');
  });

  it('returns NA for NaN', () => {
    expect(getScoreBand(NaN)).toBe('NA');
  });
});

// ============================================================================
// deriveIntentLevel Tests - None
// ============================================================================

describe('deriveIntentLevel - None', () => {
  it('returns None with empty reasons for no runs', () => {
    const result = deriveIntentLevel([]);
    expect(result.level).toBe('None');
    expect(result.reasons).toEqual([]);
  });

  it('returns None for null runs array', () => {
    const result = deriveIntentLevel(null as any);
    expect(result.level).toBe('None');
  });

  it('returns None for undefined runs array', () => {
    const result = deriveIntentLevel(undefined as any);
    expect(result.level).toBe('None');
  });
});

// ============================================================================
// deriveIntentLevel Tests - High
// ============================================================================

describe('deriveIntentLevel - High', () => {
  it('returns High for Full GAP run (latest)', () => {
    const runs = [createRun({ runType: 'GAP_FULL', daysAgo: 0 })];
    const result = deriveIntentLevel(runs);

    expect(result.level).toBe('High');
    expect(result.reasons).toContain('Full GAP run');
  });

  it('returns High for Full GAP even if older', () => {
    const runs = [createRun({ runType: 'GAP_FULL', daysAgo: 10 })];
    const result = deriveIntentLevel(runs);

    expect(result.level).toBe('High');
    expect(result.reasons).toContain('Full GAP run');
  });

  it('returns High for 2+ runs within 14 days', () => {
    const runs = [
      createRun({ daysAgo: 0 }),
      createRun({ daysAgo: 5 }),
    ];
    const result = deriveIntentLevel(runs);

    expect(result.level).toBe('High');
    expect(result.reasons).toContain('2 runs in last 14 days');
  });

  it('returns High for 3 runs within 14 days', () => {
    const runs = [
      createRun({ daysAgo: 0 }),
      createRun({ daysAgo: 3 }),
      createRun({ daysAgo: 7 }),
    ];
    const result = deriveIntentLevel(runs);

    expect(result.level).toBe('High');
    expect(result.reasons).toContain('3 runs in last 14 days');
  });

  it('returns High for low score (<55) with run in 7 days', () => {
    const runs = [createRun({ score: 40, daysAgo: 3 })];
    const result = deriveIntentLevel(runs);

    expect(result.level).toBe('High');
    expect(result.reasons).toContain('Low score (<55) with recent run');
  });

  it('returns High for score 54 (boundary) with run in 7 days', () => {
    const runs = [createRun({ score: 54, daysAgo: 7 })];
    const result = deriveIntentLevel(runs);

    expect(result.level).toBe('High');
    expect(result.reasons).toContain('Low score (<55) with recent run');
  });

  it('Full GAP takes priority over other High signals', () => {
    const runs = [
      createRun({ runType: 'GAP_FULL', score: 40, daysAgo: 0 }),
      createRun({ daysAgo: 5 }),
    ];
    const result = deriveIntentLevel(runs);

    expect(result.level).toBe('High');
    expect(result.reasons).toContain('Full GAP run');
    expect(result.reasons).not.toContain('2 runs in last 14 days');
  });
});

// ============================================================================
// deriveIntentLevel Tests - Medium
// ============================================================================

describe('deriveIntentLevel - Medium', () => {
  it('returns Medium for GAP_IA within 7 days', () => {
    const runs = [createRun({ runType: 'GAP_IA', daysAgo: 3, score: 70 })];
    const result = deriveIntentLevel(runs);

    expect(result.level).toBe('Medium');
    expect(result.reasons).toContain('Recent IA run (≤7d)');
  });

  it('returns Medium for GAP_IA at exactly 7 days', () => {
    const runs = [createRun({ runType: 'GAP_IA', daysAgo: 7, score: 70 })];
    const result = deriveIntentLevel(runs);

    expect(result.level).toBe('Medium');
    expect(result.reasons).toContain('Recent IA run (≤7d)');
  });

  it('returns Medium for 2+ GAP_IA runs total (even if old)', () => {
    const runs = [
      createRun({ runType: 'GAP_IA', daysAgo: 20, score: 75 }),
      createRun({ runType: 'GAP_IA', daysAgo: 30, score: 75 }),
    ];
    const result = deriveIntentLevel(runs);

    expect(result.level).toBe('Medium');
    expect(result.reasons).toContain('Repeat IA runs');
  });

  it('returns Medium for mid score (55-74) within 14 days', () => {
    const runs = [createRun({ score: 60, daysAgo: 10 })];
    const result = deriveIntentLevel(runs);

    expect(result.level).toBe('Medium');
    expect(result.reasons).toContain('Mid score (55-74) with recent activity');
  });

  it('returns Medium for score 55 (boundary) within 14 days', () => {
    const runs = [createRun({ score: 55, daysAgo: 14 })];
    const result = deriveIntentLevel(runs);

    expect(result.level).toBe('Medium');
    expect(result.reasons).toContain('Mid score (55-74) with recent activity');
  });

  it('returns Medium for score 74 (boundary) within 14 days', () => {
    const runs = [createRun({ score: 74, daysAgo: 10 })];
    const result = deriveIntentLevel(runs);

    expect(result.level).toBe('Medium');
    expect(result.reasons).toContain('Mid score (55-74) with recent activity');
  });
});

// ============================================================================
// deriveIntentLevel Tests - Low
// ============================================================================

describe('deriveIntentLevel - Low', () => {
  it('returns Low for single old run', () => {
    const runs = [createRun({ daysAgo: 20, score: 70 })];
    const result = deriveIntentLevel(runs);

    expect(result.level).toBe('Low');
    expect(result.reasons.some(r => r.includes('ago'))).toBe(true);
  });

  it('returns Medium for high score with recent IA run (recent IA takes precedence)', () => {
    // A recent IA run (within 7 days) triggers Medium, even with high score
    const runs = [createRun({ score: 80, daysAgo: 5 })];
    const result = deriveIntentLevel(runs);

    expect(result.level).toBe('Medium');
    expect(result.reasons).toContain('Recent IA run (≤7d)');
  });

  it('returns Low for high score with OLD run (outside 14 days)', () => {
    // High score + old run = Low
    const runs = [createRun({ score: 85, daysAgo: 20 })];
    const result = deriveIntentLevel(runs);

    expect(result.level).toBe('Low');
    expect(result.reasons).toContain('High score (≥75)');
    expect(result.reasons.some(r => r.includes('ago'))).toBe(true);
  });

  it('returns Low for high score at 8 days (outside recent window)', () => {
    // Outside the 7-day "recent" window, but still high score
    const runs = [createRun({ score: 80, daysAgo: 8 })];
    const result = deriveIntentLevel(runs);

    expect(result.level).toBe('Low');
    expect(result.reasons).toContain('High score (≥75)');
  });

  it('returns Medium for mid score within 14 days', () => {
    // Mid score (55-74) within 14 days = Medium
    const runs = [createRun({ score: 70, daysAgo: 10 })];
    const result = deriveIntentLevel(runs);

    expect(result.level).toBe('Medium');
    expect(result.reasons).toContain('Mid score (55-74) with recent activity');
  });

  it('returns Low for mid score outside 14 days', () => {
    // Mid score but outside 14-day window
    const runs = [createRun({ score: 70, daysAgo: 20 })];
    const result = deriveIntentLevel(runs);

    expect(result.level).toBe('Low');
    expect(result.reasons.some(r => r.includes('ago'))).toBe(true);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('deriveIntentLevel - Edge Cases', () => {
  it('handles null score correctly', () => {
    const runs = [createRun({ score: null, daysAgo: 3 })];
    const result = deriveIntentLevel(runs);

    // Still Medium because of recent IA run
    expect(result.level).toBe('Medium');
  });

  it('handles mixed run types correctly', () => {
    const runs = [
      createRun({ runType: 'GAP_IA', daysAgo: 20, score: 70 }),
      createRun({ runType: 'GAP_FULL', daysAgo: 5, score: 80 }),
    ];
    const result = deriveIntentLevel(runs);

    // Full GAP should make it High
    expect(result.level).toBe('High');
    expect(result.reasons).toContain('Full GAP run');
  });

  it('sorts runs by date correctly', () => {
    // Pass runs in wrong order
    const runs = [
      createRun({ runType: 'GAP_IA', daysAgo: 20 }),
      createRun({ runType: 'GAP_FULL', daysAgo: 0 }), // This should be "latest"
    ];
    const result = deriveIntentLevel(runs);

    // Should detect Full GAP as latest
    expect(result.level).toBe('High');
    expect(result.reasons).toContain('Full GAP run');
  });

  it('handles low score outside 7-day window (within 14 still gets Mid from score band)', () => {
    // Low score at 10 days: Low band + within 14 days could be Mid (mid score rule) but...
    // Actually, Low score <55 is Low band, not Mid band. So it falls through to Low.
    // Wait, the Mid score rule is 55-74. So score 40 is Low band, not Mid band.
    // So at 10 days with score 40, it should be Low (no High/Medium triggers)
    const runs = [createRun({ score: 40, daysAgo: 10 })];
    const result = deriveIntentLevel(runs);

    // Score 40 is Low band, run is outside 7d so not "recent", no repeat runs
    // This should be Low intent
    expect(result.level).toBe('Low');
    expect(result.reasons.some(r => r.includes('ago') || r.includes('Single'))).toBe(true);
  });
});

// ============================================================================
// isRecentRun Tests
// ============================================================================

describe('isRecentRun', () => {
  it('returns true for run today', () => {
    const today = new Date().toISOString();
    expect(isRecentRun(today)).toBe(true);
  });

  it('returns true for run 7 days ago', () => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    expect(isRecentRun(date.toISOString())).toBe(true);
  });

  it('returns false for run 8 days ago', () => {
    const date = new Date();
    date.setDate(date.getDate() - 8);
    expect(isRecentRun(date.toISOString())).toBe(false);
  });
});

// ============================================================================
// isHighIntentAlert Tests
// ============================================================================

describe('isHighIntentAlert', () => {
  it('returns false for empty runs', () => {
    const result = isHighIntentAlert([]);
    expect(result.isAlert).toBe(false);
    expect(result.reason).toBeNull();
  });

  it('returns true for Full GAP in last 7 days', () => {
    const runs = [createRun({ runType: 'GAP_FULL', daysAgo: 3 })];
    const result = isHighIntentAlert(runs);

    expect(result.isAlert).toBe(true);
    expect(result.reason).toBe('New Full GAP run');
  });

  it('returns false for Full GAP older than 7 days', () => {
    const runs = [createRun({ runType: 'GAP_FULL', daysAgo: 10 })];
    const result = isHighIntentAlert(runs);

    expect(result.isAlert).toBe(false);
  });

  it('returns true for 2+ runs in 14 days', () => {
    const runs = [
      createRun({ daysAgo: 0 }),
      createRun({ daysAgo: 10 }),
    ];
    const result = isHighIntentAlert(runs);

    expect(result.isAlert).toBe(true);
    expect(result.reason).toContain('2 runs in 14 days');
  });

  it('returns true for low score with recent run', () => {
    const runs = [createRun({ score: 40, daysAgo: 3 })];
    const result = isHighIntentAlert(runs);

    expect(result.isAlert).toBe(true);
    expect(result.reason).toBe('Low score with recent activity');
  });
});

// ============================================================================
// Threshold Constants Tests
// ============================================================================

describe('INTENT_THRESHOLDS', () => {
  it('has correct score thresholds', () => {
    expect(INTENT_THRESHOLDS.SCORE.HIGH).toBe(75);
    expect(INTENT_THRESHOLDS.SCORE.MID).toBe(55);
  });

  it('has correct time thresholds', () => {
    expect(INTENT_THRESHOLDS.TIME.RECENT).toBe(7);
    expect(INTENT_THRESHOLDS.TIME.MEDIUM).toBe(14);
  });
});
