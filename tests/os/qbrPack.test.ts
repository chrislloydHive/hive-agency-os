// tests/os/qbrPack.test.ts
// Tests for the QBR Pack Generator

import { describe, it, expect } from 'vitest';
import {
  generateQBRPack,
  getCurrentQuarter,
  formatQuarterLabel,
  type QBRPackData,
} from '@/lib/os/programs/qbrPack';
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
    domain: 'Strategy',
    intensity: 'Standard',
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
// Quarter Helpers Tests
// ============================================================================

describe('Quarter Helpers', () => {
  describe('getCurrentQuarter', () => {
    it('returns an object with quarter and year', () => {
      const result = getCurrentQuarter();
      expect(result).toHaveProperty('quarter');
      expect(result).toHaveProperty('year');
      expect(result.quarter).toBeGreaterThanOrEqual(1);
      expect(result.quarter).toBeLessThanOrEqual(4);
    });
  });

  describe('formatQuarterLabel', () => {
    it('formats Q1 correctly', () => {
      expect(formatQuarterLabel(1, 2025)).toBe('Q1 2025');
    });

    it('formats Q4 correctly', () => {
      expect(formatQuarterLabel(4, 2025)).toBe('Q4 2025');
    });
  });
});

// ============================================================================
// QBR Pack Generation Tests
// ============================================================================

describe('generateQBRPack', () => {
  describe('Basic Structure', () => {
    it('generates a pack with all required fields', () => {
      const programs = [createMockProgram()];
      const workItems: WorkItemRecord[] = [];

      const pack = generateQBRPack(programs, workItems);

      expect(pack.companyId).toBe('company-1');
      expect(pack.quarter).toMatch(/Q\d \d{4}/);
      expect(pack.generatedAt).toBeTruthy();
      expect(pack.sections).toBeInstanceOf(Array);
      expect(pack.programs).toBeInstanceOf(Array);
    });

    it('includes executive summary section', () => {
      const programs = [createMockProgram()];
      const pack = generateQBRPack(programs, []);

      const summary = pack.sections.find((s) => s.id === 'executive-summary');
      expect(summary).toBeDefined();
      expect(summary!.type).toBe('summary');
    });

    it('includes program health section', () => {
      const programs = [createMockProgram()];
      const pack = generateQBRPack(programs, []);

      const health = pack.sections.find((s) => s.id === 'program-health');
      expect(health).toBeDefined();
      expect(health!.type).toBe('health');
    });
  });

  describe('Metrics Calculation', () => {
    it('counts programs correctly', () => {
      const programs = [
        createMockProgram({ id: 'p1', title: 'Program 1' }),
        createMockProgram({ id: 'p2', title: 'Program 2' }),
        createMockProgram({ id: 'p3', title: 'Program 3', status: 'archived' }),
      ];

      const pack = generateQBRPack(programs, []);

      expect(pack.programsCount).toBe(2); // Excludes archived
    });

    it('counts deliverables correctly', () => {
      const programs = [
        createMockProgram({
          scope: {
            summary: 'Test',
            deliverables: [
              { id: 'd1', title: 'D1', type: 'document', status: 'completed' },
              { id: 'd2', title: 'D2', type: 'document', status: 'in_progress' },
              { id: 'd3', title: 'D3', type: 'document', status: 'planned' },
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

      const pack = generateQBRPack(programs, []);

      expect(pack.totalDeliverables).toBe(3);
      expect(pack.completedDeliverables).toBe(1);
    });

    it('counts work items correctly', () => {
      const programs = [createMockProgram()];
      const workItems = [
        createMockWorkItem({ id: 'w1', status: 'Done' }),
        createMockWorkItem({ id: 'w2', status: 'Done' }),
        createMockWorkItem({ id: 'w3', status: 'In Progress' }),
        createMockWorkItem({ id: 'w4', status: 'Backlog' }),
      ];

      const pack = generateQBRPack(programs, workItems);

      expect(pack.totalWorkItems).toBe(4);
      expect(pack.completedWorkItems).toBe(2);
    });

    it('identifies overdue deliverables', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const programs = [
        createMockProgram({
          scope: {
            summary: 'Test',
            deliverables: [
              {
                id: 'd1',
                title: 'Overdue',
                type: 'document',
                status: 'planned',
                dueDate: yesterday.toISOString().split('T')[0],
              },
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

      const pack = generateQBRPack(programs, []);

      expect(pack.overdueDeliverables).toBe(1);
    });
  });

  describe('Health Determination', () => {
    it('reports Healthy when no issues', () => {
      const programs = [createMockProgram()];
      const pack = generateQBRPack(programs, []);

      expect(pack.overallHealth).toBe('Healthy');
    });

    it('reports At Risk when programs have issues', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const programs = [
        createMockProgram({
          scope: {
            summary: 'Test',
            deliverables: [
              { id: 'd1', title: 'D1', type: 'document', status: 'planned', dueDate: yesterday.toISOString().split('T')[0] },
              { id: 'd2', title: 'D2', type: 'document', status: 'planned', dueDate: yesterday.toISOString().split('T')[0] },
              { id: 'd3', title: 'D3', type: 'document', status: 'planned', dueDate: yesterday.toISOString().split('T')[0] },
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

      const pack = generateQBRPack(programs, []);

      expect(pack.overallHealth).toBe('At Risk');
    });
  });

  describe('Program Summaries', () => {
    it('includes summary for each active program', () => {
      const programs = [
        createMockProgram({ id: 'p1', title: 'Program 1', domain: 'Strategy' }),
        createMockProgram({ id: 'p2', title: 'Program 2', domain: 'Creative' }),
      ];

      const pack = generateQBRPack(programs, []);

      expect(pack.programs).toHaveLength(2);
      expect(pack.programs[0].domain).toBe('Strategy');
      expect(pack.programs[1].domain).toBe('Creative');
    });

    it('calculates per-program deliverable counts', () => {
      const programs = [
        createMockProgram({
          id: 'p1',
          scope: {
            summary: 'Test',
            deliverables: [
              { id: 'd1', title: 'D1', type: 'document', status: 'completed' },
              { id: 'd2', title: 'D2', type: 'document', status: 'in_progress' },
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

      const pack = generateQBRPack(programs, []);

      expect(pack.programs[0].deliverables.total).toBe(2);
      expect(pack.programs[0].deliverables.completed).toBe(1);
      expect(pack.programs[0].deliverables.inProgress).toBe(1);
    });
  });

  describe('Sections', () => {
    it('includes wins section when there are accomplishments', () => {
      const programs = [
        createMockProgram({
          scope: {
            summary: 'Test',
            deliverables: [
              { id: 'd1', title: 'D1', type: 'document', status: 'completed' },
              { id: 'd2', title: 'D2', type: 'document', status: 'completed' },
              { id: 'd3', title: 'D3', type: 'document', status: 'completed' },
              { id: 'd4', title: 'D4', type: 'document', status: 'completed' },
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

      const pack = generateQBRPack(programs, []);

      const wins = pack.sections.find((s) => s.id === 'wins');
      expect(wins).toBeDefined();
      expect(wins!.bullets!.length).toBeGreaterThan(0);
    });

    it('includes priorities section', () => {
      const programs = [createMockProgram()];
      const pack = generateQBRPack(programs, []);

      const priorities = pack.sections.find((s) => s.id === 'priorities');
      expect(priorities).toBeDefined();
      expect(priorities!.bullets).toBeDefined();
    });

    it('includes capacity section', () => {
      const programs = [createMockProgram()];
      const pack = generateQBRPack(programs, []);

      const capacity = pack.sections.find((s) => s.id === 'capacity');
      expect(capacity).toBeDefined();
    });
  });

  describe('Options', () => {
    it('uses custom quarter and year', () => {
      const programs = [createMockProgram()];
      const pack = generateQBRPack(programs, [], {
        quarter: 2,
        year: 2024,
      });

      expect(pack.quarter).toBe('Q2 2024');
      expect(pack.year).toBe(2024);
    });

    it('uses company name from options', () => {
      const programs = [createMockProgram()];
      const pack = generateQBRPack(programs, [], {
        companyName: 'Car Toys',
      });

      expect(pack.companyName).toBe('Car Toys');
    });
  });
});
