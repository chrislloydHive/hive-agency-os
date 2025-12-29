// tests/os/attentionSignal.test.ts
// Tests for the attention signal utilities

import { describe, it, expect } from 'vitest';
import {
  computeAttentionSignal,
  computeActivityStatus,
  getCompanyCTA,
  computeAttentionSummary,
  sortCompanies,
  type AttentionSignal,
} from '@/lib/os/companies/attentionSignal';
import type { CompanySummary } from '@/lib/os/companySummary';

// ============================================================================
// Test Fixtures
// ============================================================================

function createMockSummary(overrides: Partial<CompanySummary> = {}): CompanySummary {
  return {
    companyId: 'test-company-1',
    slug: 'test-company',
    fetchedAt: new Date().toISOString(),
    meta: {
      name: 'Test Company',
      domain: 'test.com',
      stage: 'Client',
      tier: 'A',
      healthTag: 'Healthy',
      healthReasons: [],
      labels: [],
      lastActivityAt: new Date().toISOString(),
      lastActivityLabel: 'Today',
      ...overrides.meta,
    },
    scores: {
      latestBlueprintScore: 75,
      ...overrides.scores,
    },
    dimensionScores: overrides.dimensionScores ?? [
      { key: 'website', label: 'UX', score: 70, change: 5 },
      { key: 'seo', label: 'SEO', score: 65, change: 0 },
    ],
    recentWork: {
      openTasksCount: 2,
      inProgressTaskCount: 1,
      nextActions: [{ title: 'Fix SEO issues', area: 'SEO' }],
      topAttentionItem: null,
      lastDiagnosticLabel: 'Ran Website Lab',
      lastDiagnosticDate: new Date().toISOString(),
      lastDiagnosticScore: 70,
      lastDiagnosticToolId: 'websiteLab',
      lastDiagnosticRunId: 'run-123',
      ...overrides.recentWork,
    },
    media: {
      hasMediaProgram: false,
      ...overrides.media,
    },
    analytics: {
      sessions: 1000,
      conversions: 50,
      clicks: 500,
      sessionsChange: 5,
      conversionsChange: 10,
      ...overrides.analytics,
    },
    brain: {
      insightCount: 10,
      recentInsightCount: 2,
      ...overrides.brain,
    },
    flags: {
      isAtRisk: false,
      hasOpenCriticalIssues: false,
      hasOverdueWork: false,
      hasBacklogWork: false,
      needsAttention: false,
      ...overrides.flags,
    },
  };
}

// ============================================================================
// computeAttentionSignal Tests
// ============================================================================

describe('computeAttentionSignal', () => {
  it('should return negative signal when isAtRisk is true', () => {
    const summary = createMockSummary({
      flags: { isAtRisk: true, hasOpenCriticalIssues: false, hasOverdueWork: false, hasBacklogWork: false, needsAttention: true },
    });
    const signal = computeAttentionSignal(summary);
    expect(signal.level).toBe('negative');
    expect(signal.icon).toBe('🔴');
  });

  it('should return negative signal when hasOpenCriticalIssues is true', () => {
    const summary = createMockSummary({
      flags: { isAtRisk: false, hasOpenCriticalIssues: true, hasOverdueWork: false, hasBacklogWork: false, needsAttention: true },
    });
    const signal = computeAttentionSignal(summary);
    expect(signal.level).toBe('negative');
  });

  it('should return negative signal for significant traffic decline', () => {
    const summary = createMockSummary({
      analytics: { sessions: 500, sessionsChange: -25 },
    });
    const signal = computeAttentionSignal(summary);
    expect(signal.level).toBe('negative');
  });

  it('should return negative signal when multiple dimension scores are critically low', () => {
    const summary = createMockSummary({
      dimensionScores: [
        { key: 'website', label: 'UX', score: 25, change: 0 },
        { key: 'seo', label: 'SEO', score: 20, change: 0 },
      ],
    });
    const signal = computeAttentionSignal(summary);
    expect(signal.level).toBe('negative');
  });

  it('should return insights signal when there are score trends', () => {
    const summary = createMockSummary({
      dimensionScores: [
        { key: 'website', label: 'UX', score: 70, change: 10 },
      ],
    });
    const signal = computeAttentionSignal(summary);
    expect(signal.level).toBe('insights');
    expect(signal.icon).toBe('🔵');
  });

  it('should return insights signal when there are analytics trends', () => {
    const summary = createMockSummary({
      dimensionScores: [{ key: 'website', label: 'UX', score: 70, change: 0 }],
      analytics: { sessions: 1000, sessionsChange: 15 },
    });
    const signal = computeAttentionSignal(summary);
    expect(signal.level).toBe('insights');
  });

  it('should return baseline signal when no blueprint score and no diagnostics exist', () => {
    const summary = createMockSummary({
      scores: { latestBlueprintScore: null },
      dimensionScores: [],
      analytics: { sessions: null, conversions: null, clicks: null, sessionsChange: null, conversionsChange: null },
      brain: { insightCount: 0, recentInsightCount: 0 },
      recentWork: {
        openTasksCount: 0,
        inProgressTaskCount: 0,
        nextActions: [],
        topAttentionItem: null,
        lastDiagnosticLabel: null,
        lastDiagnosticDate: null,
        lastDiagnosticScore: null,
        lastDiagnosticToolId: null,
        lastDiagnosticRunId: null,
      },
    });
    const signal = computeAttentionSignal(summary);
    expect(signal.level).toBe('baseline');
    expect(signal.icon).toBe('🟡');
  });

  it('should return stable signal for healthy companies with no actionable insights', () => {
    // A "stable" company has:
    // - No negative flags
    // - No trending scores (change = 0)
    // - No trending analytics (change = 0 or null)
    // - No recent brain insights
    // - No pending next actions
    // - No attention items
    // - Has a blueprint score (not baseline)
    const summary = createMockSummary({
      dimensionScores: [{ key: 'website', label: 'UX', score: 80, change: 0 }],
      analytics: { sessions: 1000, sessionsChange: 0, conversions: 50, conversionsChange: 0 },
      brain: { insightCount: 5, recentInsightCount: 0 }, // Old insights, no recent
      recentWork: {
        openTasksCount: 0,
        inProgressTaskCount: 0,
        nextActions: [], // No pending actions
        topAttentionItem: null, // No attention items
        lastDiagnosticLabel: 'Ran Website Lab',
        lastDiagnosticDate: new Date().toISOString(),
        lastDiagnosticScore: 80,
        lastDiagnosticToolId: 'websiteLab',
        lastDiagnosticRunId: 'run-123',
      },
    });
    const signal = computeAttentionSignal(summary);
    expect(signal.level).toBe('stable');
    expect(signal.icon).toBe('🟢');
  });
});

// ============================================================================
// computeActivityStatus Tests
// ============================================================================

describe('computeActivityStatus', () => {
  it('should show "No activity yet" for companies with no activity', () => {
    const summary = createMockSummary({
      meta: { name: 'Test', healthReasons: [], labels: [], lastActivityAt: null, lastActivityLabel: null },
      recentWork: {
        openTasksCount: 0,
        inProgressTaskCount: 0,
        nextActions: [],
        topAttentionItem: null,
        lastDiagnosticLabel: null,
        lastDiagnosticDate: null,
        lastDiagnosticScore: null,
        lastDiagnosticToolId: null,
        lastDiagnosticRunId: null,
      },
    });
    const status = computeActivityStatus(summary);
    expect(status.label).toContain('No activity yet');
    expect(status.isActive).toBe(false);
  });

  it('should show "Active" for recent activity', () => {
    const summary = createMockSummary({
      meta: {
        name: 'Test',
        healthReasons: [],
        labels: [],
        lastActivityAt: new Date().toISOString(),
        lastActivityLabel: 'Today',
      },
    });
    const status = computeActivityStatus(summary);
    expect(status.label).toContain('Active');
    expect(status.isActive).toBe(true);
  });

  it('should show task count for active companies with open tasks', () => {
    const summary = createMockSummary({
      meta: {
        name: 'Test',
        healthReasons: [],
        labels: [],
        lastActivityAt: new Date().toISOString(),
        lastActivityLabel: 'Today',
      },
      recentWork: {
        openTasksCount: 5,
        inProgressTaskCount: 2,
        nextActions: [],
        topAttentionItem: null,
        lastDiagnosticLabel: 'Ran SEO Lab',
        lastDiagnosticDate: new Date().toISOString(),
        lastDiagnosticScore: 65,
        lastDiagnosticToolId: 'seoLab',
        lastDiagnosticRunId: 'run-456',
      },
    });
    const status = computeActivityStatus(summary);
    expect(status.label).toContain('5 task');
    expect(status.isActive).toBe(true);
  });

  it('should show stale message for old activity', () => {
    // 65 days = 2+ months, should trigger "Dormant"
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 65);

    const summary = createMockSummary({
      meta: {
        name: 'Test',
        healthReasons: [],
        labels: [],
        lastActivityAt: oldDate.toISOString(),
        lastActivityLabel: '65d ago',
      },
    });
    const status = computeActivityStatus(summary);
    expect(status.label).toContain('Dormant');
    expect(status.isActive).toBe(false);
  });
});

// ============================================================================
// getCompanyCTA Tests
// ============================================================================

describe('getCompanyCTA', () => {
  it('should return "View insights" for insights signal with blueprint score', () => {
    const summary = createMockSummary();
    const signal: AttentionSignal = {
      level: 'insights',
      label: 'Insights available',
      icon: '🔵',
      colorClass: 'text-blue-400',
      priority: 1,
    };
    const cta = getCompanyCTA(summary, signal);
    expect(cta.label).toBe('View insights');
    expect(cta.type).toBe('insights');
  });

  it('should return "Run baseline" for baseline signal', () => {
    const summary = createMockSummary({
      scores: { latestBlueprintScore: null },
    });
    const signal: AttentionSignal = {
      level: 'baseline',
      label: 'Needs baseline data',
      icon: '🟡',
      colorClass: 'text-amber-400',
      priority: 2,
    };
    const cta = getCompanyCTA(summary, signal);
    expect(cta.label).toBe('Run baseline');
    expect(cta.type).toBe('baseline');
  });

  it('should return "View details" for stable signal with score', () => {
    const summary = createMockSummary();
    const signal: AttentionSignal = {
      level: 'stable',
      label: 'Stable',
      icon: '🟢',
      colorClass: 'text-emerald-400',
      priority: 3,
    };
    const cta = getCompanyCTA(summary, signal);
    expect(cta.label).toBe('View details');
    expect(cta.type).toBe('overview');
  });
});

// ============================================================================
// computeAttentionSummary Tests
// ============================================================================

describe('computeAttentionSummary', () => {
  it('should correctly count companies by attention level', () => {
    const summaries = [
      createMockSummary({ companyId: '1', flags: { isAtRisk: true, hasOpenCriticalIssues: false, hasOverdueWork: false, hasBacklogWork: false, needsAttention: true } }),
      createMockSummary({ companyId: '2' }), // insights (has trends)
      createMockSummary({
        companyId: '3',
        scores: { latestBlueprintScore: null },
        dimensionScores: [],
        analytics: {},
        brain: { insightCount: 0, recentInsightCount: 0 },
        recentWork: {
          openTasksCount: 0,
          inProgressTaskCount: 0,
          nextActions: [],
          topAttentionItem: null,
          lastDiagnosticLabel: null,
          lastDiagnosticDate: null,
          lastDiagnosticScore: null,
          lastDiagnosticToolId: null,
          lastDiagnosticRunId: null,
        },
      }), // baseline
    ];

    const summary = computeAttentionSummary(summaries);
    expect(summary.total).toBe(3);
    expect(summary.atRisk).toBe(1);
    expect(summary.needsAttention).toBeGreaterThanOrEqual(1);
    expect(summary.label).toContain('3 companies');
  });

  it('should return correct label for empty list', () => {
    const summary = computeAttentionSummary([]);
    expect(summary.total).toBe(0);
    expect(summary.label).toBe('0 companies');
  });
});

// ============================================================================
// sortCompanies Tests
// ============================================================================

describe('sortCompanies', () => {
  it('should sort by attention priority (urgent first)', () => {
    const summaries = [
      createMockSummary({ companyId: '1', meta: { name: 'Alpha', healthReasons: [], labels: [] } }), // insights
      createMockSummary({
        companyId: '2',
        meta: { name: 'Beta', healthReasons: [], labels: [] },
        flags: { isAtRisk: true, hasOpenCriticalIssues: false, hasOverdueWork: false, hasBacklogWork: false, needsAttention: true },
      }), // negative
      createMockSummary({
        companyId: '3',
        meta: { name: 'Gamma', healthReasons: [], labels: [] },
        dimensionScores: [{ key: 'website', label: 'UX', score: 80, change: 0 }],
        analytics: { sessions: 1000, sessionsChange: 0 },
        brain: { insightCount: 0, recentInsightCount: 0 },
        recentWork: {
          openTasksCount: 0,
          inProgressTaskCount: 0,
          nextActions: [],
          topAttentionItem: null,
          lastDiagnosticLabel: 'Ran Lab',
          lastDiagnosticDate: new Date().toISOString(),
          lastDiagnosticScore: 80,
          lastDiagnosticToolId: 'websiteLab',
          lastDiagnosticRunId: 'run-1',
        },
      }), // stable
    ];

    const sorted = sortCompanies(summaries, 'attention');
    expect(sorted[0].meta.name).toBe('Beta'); // negative first
    expect(sorted[1].meta.name).toBe('Alpha'); // insights second
    expect(sorted[2].meta.name).toBe('Gamma'); // stable last
  });

  it('should sort alphabetically when selected', () => {
    const summaries = [
      createMockSummary({ companyId: '1', meta: { name: 'Zebra', healthReasons: [], labels: [] } }),
      createMockSummary({ companyId: '2', meta: { name: 'Alpha', healthReasons: [], labels: [] } }),
      createMockSummary({ companyId: '3', meta: { name: 'Beta', healthReasons: [], labels: [] } }),
    ];

    const sorted = sortCompanies(summaries, 'alphabetical');
    expect(sorted[0].meta.name).toBe('Alpha');
    expect(sorted[1].meta.name).toBe('Beta');
    expect(sorted[2].meta.name).toBe('Zebra');
  });

  it('should sort by recent activity when selected', () => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const summaries = [
      createMockSummary({ companyId: '1', meta: { name: 'Old', lastActivityAt: weekAgo.toISOString(), healthReasons: [], labels: [] } }),
      createMockSummary({ companyId: '2', meta: { name: 'Recent', lastActivityAt: now.toISOString(), healthReasons: [], labels: [] } }),
      createMockSummary({ companyId: '3', meta: { name: 'Yesterday', lastActivityAt: yesterday.toISOString(), healthReasons: [], labels: [] } }),
    ];

    const sorted = sortCompanies(summaries, 'recent');
    expect(sorted[0].meta.name).toBe('Recent');
    expect(sorted[1].meta.name).toBe('Yesterday');
    expect(sorted[2].meta.name).toBe('Old');
  });

  it('should produce stable ordering for equal attention levels', () => {
    const summaries = [
      createMockSummary({ companyId: '1', meta: { name: 'Zebra', healthReasons: [], labels: [] } }),
      createMockSummary({ companyId: '2', meta: { name: 'Alpha', healthReasons: [], labels: [] } }),
    ];

    const sorted1 = sortCompanies(summaries, 'attention');
    const sorted2 = sortCompanies([...summaries].reverse(), 'attention');

    // Both should produce same order
    expect(sorted1.map(s => s.meta.name)).toEqual(sorted2.map(s => s.meta.name));
  });
});
