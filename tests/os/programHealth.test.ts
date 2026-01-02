// tests/os/programHealth.test.ts
// Tests for Program Health computation

import { describe, it, expect } from 'vitest';
import {
  calculateProgramHealth,
  calculateCapacityHint,
  calculateCompanyCapacity,
  getHealthBadgeStyle,
  getLoadBadgeStyle,
  type HealthStatus,
  type ProgramHealthSnapshot,
} from '@/lib/os/programs/programHealth';
import type { PlanningProgram } from '@/lib/types/program';
import type { WorkItemRecord } from '@/lib/airtable/workItems';

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
      summary: 'Test program scope',
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
    ...overrides,
  } as PlanningProgram;
}

function createMockWorkItem(overrides: Partial<WorkItemRecord> = {}): WorkItemRecord {
  return {
    id: 'work-1',
    title: 'Test Work Item',
    companyId: 'company-1',
    status: 'Backlog',
    createdAt: new Date().toISOString(),
    ...overrides,
  } as WorkItemRecord;
}

// ============================================================================
// calculateProgramHealth Tests
// ============================================================================

describe('calculateProgramHealth', () => {
  describe('Health Status Determination', () => {
    it('returns Healthy when no issues', () => {
      const program = createMockProgram({
        scope: {
          summary: '',
          deliverables: [],
          workstreams: [],
          channels: [],
          constraints: [],
          assumptions: [],
          unknowns: [],
          dependencies: [],
        },
      });

      const health = calculateProgramHealth(program, []);

      expect(health.status).toBe('Healthy');
      expect(health.issues).toHaveLength(0);
    });

    it('returns Attention with 1-2 overdue deliverables', () => {
      // Use 40 days ago to avoid triggering low completion rate (30-day window)
      // This isolates the overdue count as the only drift factor
      const fortyDaysAgo = new Date();
      fortyDaysAgo.setDate(fortyDaysAgo.getDate() - 40);

      const program = createMockProgram({
        scope: {
          summary: '',
          deliverables: [
            {
              id: 'del-1',
              title: 'Overdue Deliverable',
              description: '',
              type: 'document',
              status: 'in_progress',
              dueDate: fortyDaysAgo.toISOString().split('T')[0],
            },
          ],
          workstreams: [],
          channels: [],
          constraints: [],
          assumptions: [],
          unknowns: [],
          dependencies: [],
        },
      });

      const health = calculateProgramHealth(program, []);

      expect(health.status).toBe('Attention');
      expect(health.metrics.overdueCount).toBe(1);
      expect(health.issues.some((i) => i.includes('overdue'))).toBe(true);
    });

    it('returns At Risk with 3+ overdue deliverables', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const program = createMockProgram({
        scope: {
          summary: '',
          deliverables: [
            { id: 'd1', title: 'D1', description: '', type: 'document', status: 'planned', dueDate: yesterday.toISOString().split('T')[0] },
            { id: 'd2', title: 'D2', description: '', type: 'document', status: 'planned', dueDate: yesterday.toISOString().split('T')[0] },
            { id: 'd3', title: 'D3', description: '', type: 'document', status: 'planned', dueDate: yesterday.toISOString().split('T')[0] },
          ],
          workstreams: [],
          channels: [],
          constraints: [],
          assumptions: [],
          unknowns: [],
          dependencies: [],
        },
      });

      const health = calculateProgramHealth(program, []);

      expect(health.status).toBe('At Risk');
      expect(health.metrics.overdueCount).toBe(3);
    });

    it('returns Attention when approaching capacity limit', () => {
      const program = createMockProgram({
        scopeEnforced: true,
        maxConcurrentWork: 5,
        commitment: { workItemIds: ['w1', 'w2', 'w3', 'w4'] },
      });

      const workItems = [
        createMockWorkItem({ id: 'w1', status: 'In Progress' }),
        createMockWorkItem({ id: 'w2', status: 'In Progress' }),
        createMockWorkItem({ id: 'w3', status: 'In Progress' }),
        createMockWorkItem({ id: 'w4', status: 'In Progress' }),
      ];

      const health = calculateProgramHealth(program, workItems);

      expect(health.status).toBe('Attention');
      expect(health.issues.some((i) => i.includes('capacity'))).toBe(true);
    });

    it('returns At Risk when capacity limit reached', () => {
      const program = createMockProgram({
        scopeEnforced: true,
        maxConcurrentWork: 4,
        commitment: { workItemIds: ['w1', 'w2', 'w3', 'w4'] },
      });

      const workItems = [
        createMockWorkItem({ id: 'w1', status: 'In Progress' }),
        createMockWorkItem({ id: 'w2', status: 'In Progress' }),
        createMockWorkItem({ id: 'w3', status: 'In Progress' }),
        createMockWorkItem({ id: 'w4', status: 'In Progress' }),
      ];

      const health = calculateProgramHealth(program, workItems);

      expect(health.status).toBe('At Risk');
    });
  });

  describe('Metrics Calculation', () => {
    it('counts deliverables due in next 7 days', () => {
      const inFiveDays = new Date();
      inFiveDays.setDate(inFiveDays.getDate() + 5);

      const program = createMockProgram({
        scope: {
          summary: '',
          deliverables: [
            { id: 'd1', title: 'Due Soon', description: '', type: 'document', status: 'in_progress', dueDate: inFiveDays.toISOString().split('T')[0] },
          ],
          workstreams: [],
          channels: [],
          constraints: [],
          assumptions: [],
          unknowns: [],
          dependencies: [],
        },
      });

      const health = calculateProgramHealth(program, []);

      expect(health.metrics.dueNext7Days).toBe(1);
    });

    it('does not count completed deliverables as overdue', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const program = createMockProgram({
        scope: {
          summary: '',
          deliverables: [
            { id: 'd1', title: 'Completed', description: '', type: 'document', status: 'completed', dueDate: yesterday.toISOString().split('T')[0] },
          ],
          workstreams: [],
          channels: [],
          constraints: [],
          assumptions: [],
          unknowns: [],
          dependencies: [],
        },
      });

      const health = calculateProgramHealth(program, []);

      expect(health.metrics.overdueCount).toBe(0);
    });

    it('counts work items in progress', () => {
      const program = createMockProgram({
        commitment: { workItemIds: ['w1', 'w2', 'w3'] },
      });

      const workItems = [
        createMockWorkItem({ id: 'w1', status: 'In Progress' }),
        createMockWorkItem({ id: 'w2', status: 'In Progress' }),
        createMockWorkItem({ id: 'w3', status: 'Backlog' }),
      ];

      const health = calculateProgramHealth(program, workItems);

      expect(health.metrics.workInProgress).toBe(2);
    });

    it('counts completed work items', () => {
      const program = createMockProgram({
        commitment: { workItemIds: ['w1', 'w2', 'w3'] },
      });

      const workItems = [
        createMockWorkItem({ id: 'w1', status: 'Done' }),
        createMockWorkItem({ id: 'w2', status: 'Done' }),
        createMockWorkItem({ id: 'w3', status: 'In Progress' }),
      ];

      const health = calculateProgramHealth(program, workItems);

      expect(health.metrics.completedThisPeriod).toBe(2);
    });
  });

  describe('Snapshot Structure', () => {
    it('includes programId and title', () => {
      const program = createMockProgram({ id: 'test-prog', title: 'Test Title' });
      const health = calculateProgramHealth(program, []);

      expect(health.programId).toBe('test-prog');
      expect(health.programTitle).toBe('Test Title');
    });

    it('includes lastUpdated timestamp', () => {
      const program = createMockProgram();
      const health = calculateProgramHealth(program, []);

      expect(health.lastUpdated).toBeDefined();
      const date = new Date(health.lastUpdated);
      expect(date.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });
});

// ============================================================================
// calculateCapacityHint Tests
// ============================================================================

describe('calculateCapacityHint', () => {
  describe('Intensity-based Load', () => {
    it('returns low load for Core intensity', () => {
      const program = createMockProgram({ intensity: 'Core' });
      const hint = calculateCapacityHint(program);

      expect(hint.estimatedWeeklyLoad).toBe('low');
      expect(hint.loadScore).toBe(2);
    });

    it('returns medium load for Standard intensity', () => {
      const program = createMockProgram({ intensity: 'Standard' });
      const hint = calculateCapacityHint(program);

      expect(hint.estimatedWeeklyLoad).toBe('medium');
      expect(hint.loadScore).toBe(5);
    });

    it('returns high load for Aggressive intensity', () => {
      const program = createMockProgram({ intensity: 'Aggressive' });
      const hint = calculateCapacityHint(program);

      expect(hint.estimatedWeeklyLoad).toBe('high');
      expect(hint.loadScore).toBe(8);
    });

    it('defaults to low for undefined intensity', () => {
      const program = createMockProgram({ intensity: undefined });
      const hint = calculateCapacityHint(program);

      expect(hint.estimatedWeeklyLoad).toBe('low');
    });
  });

  describe('Recommendations', () => {
    it('provides recommendation for high load', () => {
      const program = createMockProgram({
        intensity: 'Aggressive',
        scope: {
          summary: '',
          deliverables: [
            { id: 'd1', title: 'D1', description: '', type: 'asset', status: 'planned', workstreamType: 'content' },
            { id: 'd2', title: 'D2', description: '', type: 'asset', status: 'planned', workstreamType: 'content' },
            { id: 'd3', title: 'D3', description: '', type: 'asset', status: 'planned', workstreamType: 'content' },
            { id: 'd4', title: 'D4', description: '', type: 'asset', status: 'planned', workstreamType: 'content' },
          ],
          workstreams: [],
          channels: [],
          constraints: [],
          assumptions: [],
          unknowns: [],
          dependencies: [],
        },
      });

      const hint = calculateCapacityHint(program);

      expect(hint.recommendation).toBeDefined();
      expect(hint.recommendation).toContain('capacity');
    });
  });
});

// ============================================================================
// calculateCompanyCapacity Tests
// ============================================================================

describe('calculateCompanyCapacity', () => {
  it('calculates total load across programs', () => {
    const programs = [
      createMockProgram({ id: 'p1', intensity: 'Core' }),      // 2
      createMockProgram({ id: 'p2', intensity: 'Standard' }),  // 5
      createMockProgram({ id: 'p3', intensity: 'Aggressive' }),// 8
    ];

    const capacity = calculateCompanyCapacity(programs);

    expect(capacity.totalLoadScore).toBe(15);
    expect(capacity.totalPrograms).toBe(3);
  });

  it('determines overall load level', () => {
    const highLoadPrograms = [
      createMockProgram({ intensity: 'Aggressive' }),
      createMockProgram({ intensity: 'Aggressive' }),
      createMockProgram({ intensity: 'Aggressive' }),
      createMockProgram({ intensity: 'Aggressive' }),
    ];

    const capacity = calculateCompanyCapacity(highLoadPrograms);

    expect(capacity.estimatedWeeklyLoad).toBe('high');
  });

  it('sets warning threshold for high total load', () => {
    const highLoadPrograms = [
      createMockProgram({ intensity: 'Aggressive' }),
      createMockProgram({ intensity: 'Aggressive' }),
      createMockProgram({ intensity: 'Aggressive' }),
      createMockProgram({ intensity: 'Aggressive' }),
      createMockProgram({ intensity: 'Aggressive' }),
    ];

    const capacity = calculateCompanyCapacity(highLoadPrograms);

    expect(capacity.warningThreshold).toBe(true);
    expect(capacity.recommendation).toBeDefined();
  });

  it('returns no warning for low load', () => {
    const lowLoadPrograms = [
      createMockProgram({ intensity: 'Core' }),
      createMockProgram({ intensity: 'Core' }),
    ];

    const capacity = calculateCompanyCapacity(lowLoadPrograms);

    expect(capacity.warningThreshold).toBe(false);
    expect(capacity.recommendation).toBeUndefined();
  });

  it('includes program hints for each program', () => {
    const programs = [
      createMockProgram({ id: 'p1' }),
      createMockProgram({ id: 'p2' }),
    ];

    const capacity = calculateCompanyCapacity(programs);

    expect(capacity.programHints).toHaveLength(2);
    expect(capacity.programHints[0].programId).toBe('p1');
  });
});

// ============================================================================
// Badge Style Tests
// ============================================================================

describe('getHealthBadgeStyle', () => {
  it('returns emerald for Healthy', () => {
    const style = getHealthBadgeStyle('Healthy');

    expect(style.bg).toContain('emerald');
    expect(style.text).toContain('emerald');
    expect(style.border).toContain('emerald');
  });

  it('returns amber for Attention', () => {
    const style = getHealthBadgeStyle('Attention');

    expect(style.bg).toContain('amber');
    expect(style.text).toContain('amber');
  });

  it('returns red for At Risk', () => {
    const style = getHealthBadgeStyle('At Risk');

    expect(style.bg).toContain('red');
    expect(style.text).toContain('red');
  });
});

describe('getLoadBadgeStyle', () => {
  it('returns slate for low', () => {
    const style = getLoadBadgeStyle('low');
    expect(style.bg).toContain('slate');
  });

  it('returns blue for medium', () => {
    const style = getLoadBadgeStyle('medium');
    expect(style.bg).toContain('blue');
  });

  it('returns amber for high', () => {
    const style = getLoadBadgeStyle('high');
    expect(style.bg).toContain('amber');
  });
});
