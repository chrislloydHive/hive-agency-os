// tests/os/cadenceDrift.test.ts
// Tests for Cadence Drift Detection

import { describe, it, expect } from 'vitest';
import {
  calculateCadenceDrift,
  calculateCompanyDrift,
  getDriftEnhancedHealthStatus,
  generateDriftSummaryForQBR,
  DRIFT_THRESHOLDS,
  type CadenceDriftMetrics,
  type DriftStatus,
} from '@/lib/os/programs/cadenceDrift';
import type { PlanningProgram, PlanningDeliverable } from '@/lib/types/program';

// ============================================================================
// Test Fixtures
// ============================================================================

function createMockProgram(overrides: Partial<PlanningProgram> = {}): PlanningProgram {
  return {
    id: 'prog-test-1',
    companyId: 'company-1',
    strategyId: 'strategy-1',
    title: 'Test Program',
    status: 'committed',
    stableKey: 'test-stable-key',
    origin: { strategyId: 'strategy-1' },
    scope: {
      summary: 'Test scope',
      deliverables: [],
      workstreams: [],
      channels: [],
      constraints: [],
      assumptions: [],
      unknowns: [],
      dependencies: [],
    },
    success: { kpis: [] },
    planDetails: { horizonDays: 90, milestones: [] },
    commitment: { workItemIds: [] },
    linkedArtifacts: [],
    workPlanVersion: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    scopeEnforced: false,
    domain: 'Strategy',
    intensity: 'Standard',
    ...overrides,
  } as PlanningProgram;
}

function createDeliverable(
  overrides: Partial<PlanningDeliverable> & { dueDate: string }
): PlanningDeliverable {
  return {
    id: `del-${Math.random().toString(36).slice(2)}`,
    title: 'Test Deliverable',
    type: 'document',
    status: 'planned',
    description: 'recurring::test::weekly-2025-W01',
    ...overrides,
  };
}

// ============================================================================
// Drift Thresholds Tests
// ============================================================================

describe('DRIFT_THRESHOLDS', () => {
  it('has expected threshold values', () => {
    expect(DRIFT_THRESHOLDS.OVERDUE_ATTENTION).toBe(1);
    expect(DRIFT_THRESHOLDS.OVERDUE_AT_RISK).toBe(3);
    expect(DRIFT_THRESHOLDS.COMPLETION_RATE_HEALTHY).toBe(80);
    expect(DRIFT_THRESHOLDS.COMPLETION_RATE_ATTENTION).toBe(60);
  });
});

// ============================================================================
// Calculate Cadence Drift Tests
// ============================================================================

describe('calculateCadenceDrift', () => {
  describe('No Deliverables', () => {
    it('returns healthy status with no deliverables', () => {
      const program = createMockProgram();
      const metrics = calculateCadenceDrift(program);

      expect(metrics.driftStatus).toBe('healthy');
      expect(metrics.totalOverdue).toBe(0);
      expect(metrics.completionRate30Days).toBe(100);
    });
  });

  describe('Overdue Detection', () => {
    it('detects attention status with 1 overdue', () => {
      // Use 40 days ago so it's outside the 30-day completion rate window
      // This ensures only overdue count affects drift status, not completion rate
      const fortyDaysAgo = new Date();
      fortyDaysAgo.setDate(fortyDaysAgo.getDate() - 40);

      const program = createMockProgram({
        scope: {
          summary: 'Test',
          deliverables: [
            createDeliverable({
              dueDate: fortyDaysAgo.toISOString().split('T')[0],
              status: 'planned',
            }),
          ],
          workstreams: [],
          channels: [],
          constraints: [],
          assumptions: [],
          unknowns: [],
          dependencies: [],
        },
      });

      const metrics = calculateCadenceDrift(program);

      expect(metrics.driftStatus).toBe('attention');
      expect(metrics.totalOverdue).toBe(1);
      expect(metrics.driftReasons).toContain('1 overdue deliverable');
    });

    it('detects at_risk status with 3+ overdue', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const program = createMockProgram({
        scope: {
          summary: 'Test',
          deliverables: [
            createDeliverable({ dueDate: yesterday.toISOString().split('T')[0], status: 'planned' }),
            createDeliverable({ dueDate: yesterday.toISOString().split('T')[0], status: 'in_progress' }),
            createDeliverable({ dueDate: yesterday.toISOString().split('T')[0], status: 'planned' }),
          ],
          workstreams: [],
          channels: [],
          constraints: [],
          assumptions: [],
          unknowns: [],
          dependencies: [],
        },
      });

      const metrics = calculateCadenceDrift(program);

      expect(metrics.driftStatus).toBe('at_risk');
      expect(metrics.totalOverdue).toBe(3);
    });

    it('ignores completed deliverables when counting overdue', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const program = createMockProgram({
        scope: {
          summary: 'Test',
          deliverables: [
            createDeliverable({ dueDate: yesterday.toISOString().split('T')[0], status: 'completed' }),
            createDeliverable({ dueDate: yesterday.toISOString().split('T')[0], status: 'planned' }),
          ],
          workstreams: [],
          channels: [],
          constraints: [],
          assumptions: [],
          unknowns: [],
          dependencies: [],
        },
      });

      const metrics = calculateCadenceDrift(program);

      expect(metrics.totalOverdue).toBe(1);
    });
  });

  describe('Completion Rate', () => {
    it('calculates completion rate for last 30 days', () => {
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      const program = createMockProgram({
        scope: {
          summary: 'Test',
          deliverables: [
            createDeliverable({ dueDate: tenDaysAgo.toISOString().split('T')[0], status: 'completed' }),
            createDeliverable({ dueDate: tenDaysAgo.toISOString().split('T')[0], status: 'completed' }),
            createDeliverable({ dueDate: tenDaysAgo.toISOString().split('T')[0], status: 'planned' }),
            createDeliverable({ dueDate: tenDaysAgo.toISOString().split('T')[0], status: 'planned' }),
          ],
          workstreams: [],
          channels: [],
          constraints: [],
          assumptions: [],
          unknowns: [],
          dependencies: [],
        },
      });

      const metrics = calculateCadenceDrift(program);

      expect(metrics.completionRate30Days).toBe(50);
      expect(metrics.completedLast30Days).toBe(2);
      expect(metrics.totalLast30Days).toBe(4);
    });

    it('returns 100% when no deliverables due in last 30 days', () => {
      const program = createMockProgram();
      const metrics = calculateCadenceDrift(program);

      expect(metrics.completionRate30Days).toBe(100);
    });

    it('flags low completion rate as at_risk', () => {
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      const program = createMockProgram({
        scope: {
          summary: 'Test',
          deliverables: [
            createDeliverable({ dueDate: tenDaysAgo.toISOString().split('T')[0], status: 'completed' }),
            createDeliverable({ dueDate: tenDaysAgo.toISOString().split('T')[0], status: 'planned' }),
            createDeliverable({ dueDate: tenDaysAgo.toISOString().split('T')[0], status: 'planned' }),
            createDeliverable({ dueDate: tenDaysAgo.toISOString().split('T')[0], status: 'planned' }),
            createDeliverable({ dueDate: tenDaysAgo.toISOString().split('T')[0], status: 'planned' }),
          ],
          workstreams: [],
          channels: [],
          constraints: [],
          assumptions: [],
          unknowns: [],
          dependencies: [],
        },
      });

      const metrics = calculateCadenceDrift(program);

      expect(metrics.completionRate30Days).toBeLessThan(DRIFT_THRESHOLDS.COMPLETION_RATE_ATTENTION);
      expect(metrics.driftStatus).toBe('at_risk');
    });
  });

  describe('Program Metadata', () => {
    it('includes program info in metrics', () => {
      const program = createMockProgram({
        id: 'prog-123',
        title: 'My Program',
        domain: 'Media',
      });

      const metrics = calculateCadenceDrift(program);

      expect(metrics.programId).toBe('prog-123');
      expect(metrics.programTitle).toBe('My Program');
      expect(metrics.domain).toBe('Media');
    });
  });
});

// ============================================================================
// Company Drift Summary Tests
// ============================================================================

describe('calculateCompanyDrift', () => {
  it('calculates summary for multiple programs', () => {
    const programs = [
      createMockProgram({ id: 'p1', title: 'Program 1' }),
      createMockProgram({ id: 'p2', title: 'Program 2' }),
      createMockProgram({ id: 'p3', title: 'Program 3' }),
    ];

    const summary = calculateCompanyDrift('company-1', programs);

    expect(summary.totalPrograms).toBe(3);
    expect(summary.healthyPrograms).toBe(3);
    expect(summary.attentionPrograms).toBe(0);
    expect(summary.atRiskPrograms).toBe(0);
  });

  it('excludes archived programs', () => {
    const programs = [
      createMockProgram({ id: 'p1', status: 'committed' }),
      createMockProgram({ id: 'p2', status: 'archived' }),
    ];

    const summary = calculateCompanyDrift('company-1', programs);

    expect(summary.totalPrograms).toBe(1);
  });

  it('returns top drifted programs sorted by severity', () => {
    // Use 40 days ago so overdue deliverables are outside 30-day completion rate window
    const fortyDaysAgo = new Date();
    fortyDaysAgo.setDate(fortyDaysAgo.getDate() - 40);

    const programs = [
      createMockProgram({ id: 'p1', title: 'Healthy' }),
      createMockProgram({
        id: 'p2',
        title: 'At Risk',
        scope: {
          summary: 'Test',
          deliverables: [
            createDeliverable({ dueDate: fortyDaysAgo.toISOString().split('T')[0], status: 'planned' }),
            createDeliverable({ dueDate: fortyDaysAgo.toISOString().split('T')[0], status: 'planned' }),
            createDeliverable({ dueDate: fortyDaysAgo.toISOString().split('T')[0], status: 'planned' }),
          ],
          workstreams: [],
          channels: [],
          constraints: [],
          assumptions: [],
          unknowns: [],
          dependencies: [],
        },
      }),
      createMockProgram({
        id: 'p3',
        title: 'Attention',
        scope: {
          summary: 'Test',
          deliverables: [
            createDeliverable({ dueDate: fortyDaysAgo.toISOString().split('T')[0], status: 'planned' }),
          ],
          workstreams: [],
          channels: [],
          constraints: [],
          assumptions: [],
          unknowns: [],
          dependencies: [],
        },
      }),
    ];

    const summary = calculateCompanyDrift('company-1', programs);

    expect(summary.topDriftedPrograms).toHaveLength(2);
    expect(summary.topDriftedPrograms[0].driftStatus).toBe('at_risk');
    expect(summary.topDriftedPrograms[1].driftStatus).toBe('attention');
  });
});

// ============================================================================
// Health Integration Tests
// ============================================================================

describe('getDriftEnhancedHealthStatus', () => {
  it('maintains healthy if both healthy', () => {
    const driftMetrics: CadenceDriftMetrics = {
      programId: 'p1',
      programTitle: 'Test',
      domain: 'Strategy',
      overdueWeekly: 0,
      overdueMonthly: 0,
      overdueQuarterly: 0,
      totalOverdue: 0,
      weeksSinceLastWeeklyCompletion: null,
      monthsSinceLastMonthlyCompletion: null,
      quartersSinceLastQuarterlyCompletion: null,
      completionRate30Days: 100,
      completedLast30Days: 5,
      totalLast30Days: 5,
      driftStatus: 'healthy',
      driftReasons: [],
    };

    const result = getDriftEnhancedHealthStatus('Healthy', driftMetrics);

    expect(result.status).toBe('Healthy');
  });

  it('escalates to At Risk if drift is at_risk', () => {
    const driftMetrics: CadenceDriftMetrics = {
      programId: 'p1',
      programTitle: 'Test',
      domain: 'Strategy',
      overdueWeekly: 3,
      overdueMonthly: 0,
      overdueQuarterly: 0,
      totalOverdue: 3,
      weeksSinceLastWeeklyCompletion: null,
      monthsSinceLastMonthlyCompletion: null,
      quartersSinceLastQuarterlyCompletion: null,
      completionRate30Days: 50,
      completedLast30Days: 2,
      totalLast30Days: 4,
      driftStatus: 'at_risk',
      driftReasons: ['3 overdue deliverables'],
    };

    const result = getDriftEnhancedHealthStatus('Healthy', driftMetrics);

    expect(result.status).toBe('At Risk');
    expect(result.issues).toContain('3 overdue deliverables');
  });

  it('uses worse of two statuses', () => {
    const driftMetrics: CadenceDriftMetrics = {
      programId: 'p1',
      programTitle: 'Test',
      domain: 'Strategy',
      overdueWeekly: 0,
      overdueMonthly: 0,
      overdueQuarterly: 0,
      totalOverdue: 0,
      weeksSinceLastWeeklyCompletion: null,
      monthsSinceLastMonthlyCompletion: null,
      quartersSinceLastQuarterlyCompletion: null,
      completionRate30Days: 100,
      completedLast30Days: 5,
      totalLast30Days: 5,
      driftStatus: 'healthy',
      driftReasons: [],
    };

    const result = getDriftEnhancedHealthStatus('At Risk', driftMetrics);

    expect(result.status).toBe('At Risk');
  });
});

// ============================================================================
// QBR Integration Tests
// ============================================================================

describe('generateDriftSummaryForQBR', () => {
  it('indicates no significant drift when all healthy', () => {
    const programs = [
      createMockProgram({ id: 'p1' }),
      createMockProgram({ id: 'p2' }),
    ];

    const summary = generateDriftSummaryForQBR(programs);

    expect(summary.hasSignificantDrift).toBe(false);
    expect(summary.riskSummary).toContain('on track');
    expect(summary.affectedPrograms).toHaveLength(0);
  });

  it('indicates significant drift when programs are at risk', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const programs = [
      createMockProgram({
        id: 'p1',
        title: 'Problem Program',
        scope: {
          summary: 'Test',
          deliverables: [
            createDeliverable({ dueDate: yesterday.toISOString().split('T')[0], status: 'planned' }),
            createDeliverable({ dueDate: yesterday.toISOString().split('T')[0], status: 'planned' }),
            createDeliverable({ dueDate: yesterday.toISOString().split('T')[0], status: 'planned' }),
          ],
          workstreams: [],
          channels: [],
          constraints: [],
          assumptions: [],
          unknowns: [],
          dependencies: [],
        },
      }),
    ];

    const summary = generateDriftSummaryForQBR(programs);

    expect(summary.hasSignificantDrift).toBe(true);
    expect(summary.affectedPrograms).toContain('Problem Program');
    expect(summary.recommendations.length).toBeGreaterThan(0);
  });
});
