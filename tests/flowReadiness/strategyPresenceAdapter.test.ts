// tests/flowReadiness/strategyPresenceAdapter.test.ts
// Tests for Strategy Presence Adapter
//
// Tests:
// - Presence detection logic
// - Signal structure
// - CTA generation

import { describe, it, expect } from 'vitest';
import {
  strategyPresenceToSignal,
  STRATEGY_SIGNAL_ID,
  STRATEGY_SIGNAL_LABEL,
} from '@/lib/flowReadiness/adapters/strategyPresenceAdapter';
import type { StrategyPresenceInfo } from '@/lib/flowReadiness/adapters/strategyPresenceAdapter';

// ============================================================================
// Test Fixtures
// ============================================================================

function createPresenceInfo(
  overrides: Partial<StrategyPresenceInfo> = {}
): StrategyPresenceInfo {
  return {
    hasStrategy: true,
    hasObjectives: true,
    hasBets: true,
    companyId: 'test-company-123',
    ...overrides,
  };
}

// ============================================================================
// Constants
// ============================================================================

describe('constants', () => {
  it('exports correct signal ID', () => {
    expect(STRATEGY_SIGNAL_ID).toBe('strategy');
  });

  it('exports correct signal label', () => {
    expect(STRATEGY_SIGNAL_LABEL).toBe('Strategy');
  });
});

// ============================================================================
// strategyPresenceToSignal
// ============================================================================

describe('strategyPresenceToSignal', () => {
  describe('signal structure', () => {
    it('sets correct signal ID', () => {
      const info = createPresenceInfo();
      const signal = strategyPresenceToSignal(info);
      expect(signal.id).toBe('strategy');
    });

    it('sets correct signal label', () => {
      const info = createPresenceInfo();
      const signal = strategyPresenceToSignal(info);
      expect(signal.label).toBe('Strategy');
    });
  });

  describe('severity mapping', () => {
    it('returns PASS when strategy exists with objectives', () => {
      const info = createPresenceInfo({
        hasStrategy: true,
        hasObjectives: true,
        hasBets: false,
      });
      const signal = strategyPresenceToSignal(info);
      expect(signal.severity).toBe('PASS');
    });

    it('returns PASS when strategy exists with bets', () => {
      const info = createPresenceInfo({
        hasStrategy: true,
        hasObjectives: false,
        hasBets: true,
      });
      const signal = strategyPresenceToSignal(info);
      expect(signal.severity).toBe('PASS');
    });

    it('returns PASS when strategy exists with both objectives and bets', () => {
      const info = createPresenceInfo({
        hasStrategy: true,
        hasObjectives: true,
        hasBets: true,
      });
      const signal = strategyPresenceToSignal(info);
      expect(signal.severity).toBe('PASS');
    });

    it('returns WARN when no strategy exists', () => {
      const info = createPresenceInfo({
        hasStrategy: false,
        hasObjectives: false,
        hasBets: false,
      });
      const signal = strategyPresenceToSignal(info);
      expect(signal.severity).toBe('WARN');
    });

    it('returns WARN when strategy exists but empty', () => {
      const info = createPresenceInfo({
        hasStrategy: true,
        hasObjectives: false,
        hasBets: false,
      });
      const signal = strategyPresenceToSignal(info);
      expect(signal.severity).toBe('WARN');
    });
  });

  describe('reasons', () => {
    it('includes NO_STRATEGY reason when no strategy', () => {
      const info = createPresenceInfo({ hasStrategy: false });
      const signal = strategyPresenceToSignal(info);
      expect(signal.reasons).toContainEqual({
        code: 'NO_STRATEGY',
        label: 'No strategy has been created yet',
      });
    });

    it('includes STRATEGY_EMPTY reason when strategy exists but empty', () => {
      const info = createPresenceInfo({
        hasStrategy: true,
        hasObjectives: false,
        hasBets: false,
      });
      const signal = strategyPresenceToSignal(info);
      expect(signal.reasons).toContainEqual({
        code: 'STRATEGY_EMPTY',
        label: 'Strategy exists but has no objectives or bets',
      });
    });

    it('has no reasons when PASS', () => {
      const info = createPresenceInfo({
        hasStrategy: true,
        hasObjectives: true,
        hasBets: true,
      });
      const signal = strategyPresenceToSignal(info);
      expect(signal.reasons).toEqual([]);
    });
  });

  describe('CTAs', () => {
    it('returns no CTAs when PASS', () => {
      const info = createPresenceInfo({
        hasStrategy: true,
        hasObjectives: true,
      });
      const signal = strategyPresenceToSignal(info);
      expect(signal.ctas).toBeUndefined();
    });

    it('returns Create Strategy CTA when WARN', () => {
      const info = createPresenceInfo({
        hasStrategy: false,
        companyId: 'my-company',
      });
      const signal = strategyPresenceToSignal(info);
      expect(signal.ctas).toBeDefined();
      expect(signal.ctas).toContainEqual({
        label: 'Create Strategy',
        href: '/c/my-company/strategy',
        priority: 'primary',
      });
    });

    it('uses correct company ID in CTA href', () => {
      const info = createPresenceInfo({
        hasStrategy: false,
        companyId: 'acme-corp',
      });
      const signal = strategyPresenceToSignal(info);
      const cta = signal.ctas?.find(c => c.label === 'Create Strategy');
      expect(cta?.href).toBe('/c/acme-corp/strategy');
    });
  });

  describe('metadata', () => {
    it('includes companyId in meta', () => {
      const info = createPresenceInfo({ companyId: 'my-company' });
      const signal = strategyPresenceToSignal(info);
      expect(signal.meta?.companyId).toBe('my-company');
    });

    it('includes hasStrategy in meta', () => {
      const info = createPresenceInfo({ hasStrategy: true });
      const signal = strategyPresenceToSignal(info);
      expect(signal.meta?.hasStrategy).toBe(true);
    });

    it('includes hasObjectives in meta', () => {
      const info = createPresenceInfo({ hasObjectives: true });
      const signal = strategyPresenceToSignal(info);
      expect(signal.meta?.hasObjectives).toBe(true);
    });

    it('includes hasBets in meta', () => {
      const info = createPresenceInfo({ hasBets: false });
      const signal = strategyPresenceToSignal(info);
      expect(signal.meta?.hasBets).toBe(false);
    });
  });
});

// ============================================================================
// Integration with resolver
// ============================================================================

describe('integration with resolver', () => {
  it('produces valid signal for resolver', async () => {
    const { resolveFlowReadiness } = await import('@/lib/flowReadiness/resolveFlowReadiness');

    const info = createPresenceInfo({ hasStrategy: false });
    const signal = strategyPresenceToSignal(info);

    // Should not throw when passed to resolver
    const resolved = resolveFlowReadiness([signal]);
    expect(resolved.status).toBe('YELLOW');
    expect(resolved.signals).toHaveLength(1);
  });

  it('works with multi-signal composition', async () => {
    const { resolveFlowReadiness } = await import('@/lib/flowReadiness/resolveFlowReadiness');
    const { contextV4HealthToSignal } = await import('@/lib/flowReadiness/adapters/contextV4HealthAdapter');

    // Create Context V4 Health signal (PASS)
    const healthSignal = contextV4HealthToSignal({
      healthVersion: 1,
      companyId: 'test',
      timestamp: new Date().toISOString(),
      status: 'GREEN',
      reasons: [],
      flags: { CONTEXT_V4_ENABLED: true, CONTEXT_V4_INGEST_WEBSITELAB: true },
      websiteLab: { hasRun: true, runId: 'r', createdAt: '', ageMinutes: 0, staleThresholdMinutes: 10080 },
      propose: { lastReason: null, proposedCount: 0, createdCount: 0, skippedCount: 0, lastRunId: null },
      store: { total: 10, proposed: 5, confirmed: 5, rejected: 0 },
      links: { inspectorPath: '/inspect', proposeApiPath: '/propose' },
    });

    // Create Strategy signal (WARN - no strategy)
    const strategySignal = strategyPresenceToSignal({
      hasStrategy: false,
      companyId: 'test',
    });

    // Compose
    const resolved = resolveFlowReadiness([healthSignal, strategySignal]);

    // Should be YELLOW because strategy is WARN
    expect(resolved.status).toBe('YELLOW');
    expect(resolved.signals).toHaveLength(2);
    expect(resolved.rankedReasons[0].signalId).toBe('strategy');
  });
});
