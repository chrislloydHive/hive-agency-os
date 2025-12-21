// tests/flowReadiness/resolveFlowReadiness.test.ts
// Tests for the Flow Readiness Resolver
//
// Tests:
// - Overall status computation (worst wins)
// - Reason ranking (FAIL > WARN > PASS)
// - Recommended action selection
// - Helper functions

import { describe, it, expect } from 'vitest';
import {
  resolveFlowReadiness,
  hasActionableIssues,
  getWorstSignal,
  getAllCtas,
} from '@/lib/flowReadiness/resolveFlowReadiness';
import type { FlowReadinessSignal } from '@/lib/types/flowReadiness';

// ============================================================================
// Test Fixtures
// ============================================================================

function createSignal(overrides: Partial<FlowReadinessSignal> = {}): FlowReadinessSignal {
  return {
    id: 'test-signal',
    label: 'Test Signal',
    severity: 'PASS',
    reasons: [],
    ...overrides,
  };
}

// ============================================================================
// resolveFlowReadiness
// ============================================================================

describe('resolveFlowReadiness', () => {
  describe('overall status computation', () => {
    it('returns GREEN when no signals provided', () => {
      const result = resolveFlowReadiness([]);
      expect(result.status).toBe('GREEN');
      expect(result.version).toBe(1);
      expect(result.signals).toEqual([]);
    });

    it('returns GREEN when all signals are PASS', () => {
      const signals: FlowReadinessSignal[] = [
        createSignal({ id: 'a', severity: 'PASS' }),
        createSignal({ id: 'b', severity: 'PASS' }),
        createSignal({ id: 'c', severity: 'PASS' }),
      ];
      const result = resolveFlowReadiness(signals);
      expect(result.status).toBe('GREEN');
    });

    it('returns YELLOW when any signal is WARN (no FAIL)', () => {
      const signals: FlowReadinessSignal[] = [
        createSignal({ id: 'a', severity: 'PASS' }),
        createSignal({ id: 'b', severity: 'WARN' }),
        createSignal({ id: 'c', severity: 'PASS' }),
      ];
      const result = resolveFlowReadiness(signals);
      expect(result.status).toBe('YELLOW');
    });

    it('returns RED when any signal is FAIL', () => {
      const signals: FlowReadinessSignal[] = [
        createSignal({ id: 'a', severity: 'PASS' }),
        createSignal({ id: 'b', severity: 'WARN' }),
        createSignal({ id: 'c', severity: 'FAIL' }),
      ];
      const result = resolveFlowReadiness(signals);
      expect(result.status).toBe('RED');
    });

    it('returns RED when multiple signals are FAIL', () => {
      const signals: FlowReadinessSignal[] = [
        createSignal({ id: 'a', severity: 'FAIL' }),
        createSignal({ id: 'b', severity: 'FAIL' }),
      ];
      const result = resolveFlowReadiness(signals);
      expect(result.status).toBe('RED');
    });

    it('preserves original signals in output', () => {
      const signals: FlowReadinessSignal[] = [
        createSignal({ id: 'context-v4', label: 'Context V4' }),
        createSignal({ id: 'strategy', label: 'Strategy' }),
      ];
      const result = resolveFlowReadiness(signals);
      expect(result.signals).toHaveLength(2);
      expect(result.signals[0].id).toBe('context-v4');
      expect(result.signals[1].id).toBe('strategy');
    });
  });

  describe('reason ranking', () => {
    it('ranks FAIL reasons before WARN reasons', () => {
      const signals: FlowReadinessSignal[] = [
        createSignal({
          id: 'a',
          severity: 'WARN',
          reasons: [{ code: 'WARN_CODE', label: 'Warning' }],
        }),
        createSignal({
          id: 'b',
          severity: 'FAIL',
          reasons: [{ code: 'FAIL_CODE', label: 'Failure' }],
        }),
      ];
      const result = resolveFlowReadiness(signals);
      expect(result.rankedReasons[0].code).toBe('FAIL_CODE');
      expect(result.rankedReasons[1].code).toBe('WARN_CODE');
    });

    it('ranks WARN reasons before PASS reasons', () => {
      const signals: FlowReadinessSignal[] = [
        createSignal({
          id: 'a',
          severity: 'PASS',
          reasons: [{ code: 'PASS_CODE', label: 'Pass' }],
        }),
        createSignal({
          id: 'b',
          severity: 'WARN',
          reasons: [{ code: 'WARN_CODE', label: 'Warning' }],
        }),
      ];
      const result = resolveFlowReadiness(signals);
      expect(result.rankedReasons[0].code).toBe('WARN_CODE');
      expect(result.rankedReasons[1].code).toBe('PASS_CODE');
    });

    it('preserves signal order within same severity', () => {
      const signals: FlowReadinessSignal[] = [
        createSignal({
          id: 'first',
          severity: 'WARN',
          reasons: [{ code: 'FIRST', label: 'First' }],
        }),
        createSignal({
          id: 'second',
          severity: 'WARN',
          reasons: [{ code: 'SECOND', label: 'Second' }],
        }),
      ];
      const result = resolveFlowReadiness(signals);
      expect(result.rankedReasons[0].code).toBe('FIRST');
      expect(result.rankedReasons[1].code).toBe('SECOND');
    });

    it('includes signal ID in ranked reasons', () => {
      const signals: FlowReadinessSignal[] = [
        createSignal({
          id: 'context-v4',
          severity: 'FAIL',
          reasons: [{ code: 'NO_WEBSITELAB', label: 'No WebsiteLab' }],
        }),
      ];
      const result = resolveFlowReadiness(signals);
      expect(result.rankedReasons[0].signalId).toBe('context-v4');
      expect(result.rankedReasons[0].severity).toBe('FAIL');
    });

    it('handles multiple reasons per signal', () => {
      const signals: FlowReadinessSignal[] = [
        createSignal({
          id: 'a',
          severity: 'FAIL',
          reasons: [
            { code: 'FAIL_1', label: 'Failure 1' },
            { code: 'FAIL_2', label: 'Failure 2' },
          ],
        }),
      ];
      const result = resolveFlowReadiness(signals);
      expect(result.rankedReasons).toHaveLength(2);
      expect(result.rankedReasons[0].code).toBe('FAIL_1');
      expect(result.rankedReasons[1].code).toBe('FAIL_2');
    });
  });

  describe('recommended action', () => {
    it('returns undefined when all signals are PASS', () => {
      const signals: FlowReadinessSignal[] = [
        createSignal({ severity: 'PASS' }),
      ];
      const result = resolveFlowReadiness(signals);
      expect(result.recommendedAction).toBeUndefined();
    });

    it('returns undefined when no signals have CTAs', () => {
      const signals: FlowReadinessSignal[] = [
        createSignal({ severity: 'WARN', ctas: undefined }),
      ];
      const result = resolveFlowReadiness(signals);
      expect(result.recommendedAction).toBeUndefined();
    });

    it('returns first FAIL signal primary CTA', () => {
      const signals: FlowReadinessSignal[] = [
        createSignal({
          id: 'warn-signal',
          severity: 'WARN',
          ctas: [{ label: 'Fix Warning', priority: 'primary' }],
        }),
        createSignal({
          id: 'fail-signal',
          severity: 'FAIL',
          ctas: [{ label: 'Fix Failure', priority: 'primary', href: '/fix' }],
        }),
      ];
      const result = resolveFlowReadiness(signals);
      expect(result.recommendedAction).toEqual({
        label: 'Fix Failure',
        signalId: 'fail-signal',
        href: '/fix',
        onClickId: undefined,
      });
    });

    it('returns first WARN signal CTA when no FAIL signals', () => {
      const signals: FlowReadinessSignal[] = [
        createSignal({
          id: 'warn-signal',
          severity: 'WARN',
          ctas: [{ label: 'Review', priority: 'primary', onClickId: 'review' }],
        }),
      ];
      const result = resolveFlowReadiness(signals);
      expect(result.recommendedAction).toEqual({
        label: 'Review',
        signalId: 'warn-signal',
        onClickId: 'review',
        href: undefined,
      });
    });

    it('falls back to first CTA when no primary CTA exists', () => {
      const signals: FlowReadinessSignal[] = [
        createSignal({
          id: 'warn-signal',
          severity: 'WARN',
          ctas: [
            { label: 'Secondary Action', priority: 'secondary' },
          ],
        }),
      ];
      const result = resolveFlowReadiness(signals);
      expect(result.recommendedAction?.label).toBe('Secondary Action');
    });

    it('ignores PASS signal CTAs', () => {
      const signals: FlowReadinessSignal[] = [
        createSignal({
          id: 'pass-signal',
          severity: 'PASS',
          ctas: [{ label: 'View Details', priority: 'primary' }],
        }),
      ];
      const result = resolveFlowReadiness(signals);
      expect(result.recommendedAction).toBeUndefined();
    });
  });
});

// ============================================================================
// hasActionableIssues
// ============================================================================

describe('hasActionableIssues', () => {
  it('returns false for GREEN status', () => {
    const resolved = resolveFlowReadiness([
      createSignal({ severity: 'PASS' }),
    ]);
    expect(hasActionableIssues(resolved)).toBe(false);
  });

  it('returns true for YELLOW status', () => {
    const resolved = resolveFlowReadiness([
      createSignal({ severity: 'WARN' }),
    ]);
    expect(hasActionableIssues(resolved)).toBe(true);
  });

  it('returns true for RED status', () => {
    const resolved = resolveFlowReadiness([
      createSignal({ severity: 'FAIL' }),
    ]);
    expect(hasActionableIssues(resolved)).toBe(true);
  });
});

// ============================================================================
// getWorstSignal
// ============================================================================

describe('getWorstSignal', () => {
  it('returns FAIL signal when status is RED', () => {
    const failSignal = createSignal({ id: 'fail', severity: 'FAIL' });
    const resolved = resolveFlowReadiness([
      createSignal({ id: 'pass', severity: 'PASS' }),
      failSignal,
    ]);
    expect(getWorstSignal(resolved)?.id).toBe('fail');
  });

  it('returns WARN signal when status is YELLOW', () => {
    const warnSignal = createSignal({ id: 'warn', severity: 'WARN' });
    const resolved = resolveFlowReadiness([
      createSignal({ id: 'pass', severity: 'PASS' }),
      warnSignal,
    ]);
    expect(getWorstSignal(resolved)?.id).toBe('warn');
  });

  it('returns PASS signal when status is GREEN', () => {
    const passSignal = createSignal({ id: 'pass', severity: 'PASS' });
    const resolved = resolveFlowReadiness([passSignal]);
    expect(getWorstSignal(resolved)?.id).toBe('pass');
  });

  it('returns first matching signal when multiple have worst severity', () => {
    const resolved = resolveFlowReadiness([
      createSignal({ id: 'fail-1', severity: 'FAIL' }),
      createSignal({ id: 'fail-2', severity: 'FAIL' }),
    ]);
    expect(getWorstSignal(resolved)?.id).toBe('fail-1');
  });
});

// ============================================================================
// getAllCtas
// ============================================================================

describe('getAllCtas', () => {
  it('returns empty array when no CTAs', () => {
    const resolved = resolveFlowReadiness([
      createSignal({ severity: 'WARN', ctas: undefined }),
    ]);
    expect(getAllCtas(resolved)).toEqual([]);
  });

  it('returns all CTAs from WARN and FAIL signals', () => {
    const resolved = resolveFlowReadiness([
      createSignal({
        id: 'fail',
        severity: 'FAIL',
        ctas: [{ label: 'Fix', href: '/fix' }],
      }),
      createSignal({
        id: 'warn',
        severity: 'WARN',
        ctas: [{ label: 'Review', onClickId: 'review' }],
      }),
    ]);
    const ctas = getAllCtas(resolved);
    expect(ctas).toHaveLength(2);
    expect(ctas[0]).toEqual({ label: 'Fix', href: '/fix', signalId: 'fail', onClickId: undefined });
    expect(ctas[1]).toEqual({ label: 'Review', onClickId: 'review', signalId: 'warn', href: undefined });
  });

  it('deduplicates CTAs by label', () => {
    const resolved = resolveFlowReadiness([
      createSignal({
        id: 'a',
        severity: 'FAIL',
        ctas: [{ label: 'Fix', href: '/fix-a' }],
      }),
      createSignal({
        id: 'b',
        severity: 'FAIL',
        ctas: [{ label: 'Fix', href: '/fix-b' }],
      }),
    ]);
    const ctas = getAllCtas(resolved);
    expect(ctas).toHaveLength(1);
    expect(ctas[0].label).toBe('Fix');
  });

  it('ignores PASS signal CTAs', () => {
    const resolved = resolveFlowReadiness([
      createSignal({
        id: 'pass',
        severity: 'PASS',
        ctas: [{ label: 'View Details' }],
      }),
    ]);
    expect(getAllCtas(resolved)).toEqual([]);
  });
});
