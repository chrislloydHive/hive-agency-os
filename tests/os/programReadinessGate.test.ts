/**
 * Tests for Program Readiness Gate (scoring-based readiness)
 *
 * Tests the deterministic readiness computation from lib/os/programs/programReadiness.ts
 */

import { describe, it, expect } from 'vitest';
import {
  computeProgramReadiness,
  getReadinessStatusLabel,
  getMissingItemLabel,
  getAIFillableMissing,
  canCommitFromReadiness,
  type ProgramReadiness,
} from '@/lib/os/programs/programReadiness';
import type { PlanningProgram } from '@/lib/types/program';

// ============================================================================
// Mock Program Factory
// ============================================================================

function createMockProgram(overrides: Partial<PlanningProgram> = {}): PlanningProgram {
  return {
    id: 'prog_test_123',
    companyId: 'company_test',
    strategyId: 'strategy_abc',
    title: 'Test Program',
    stableKey: 'strategy_abc::tactic_xyz',
    status: 'draft',
    origin: {
      strategyId: 'strategy_abc',
      tacticId: 'tactic_xyz',
      tacticTitle: 'Test Tactic',
    },
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
    success: {
      kpis: [],
    },
    planDetails: {
      horizonDays: 30,
      milestones: [],
    },
    commitment: {
      workItemIds: [],
    },
    linkedArtifacts: [],
    workPlanVersion: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================================================
// Tests: Readiness Gate Scoring
// ============================================================================

describe('Program Readiness Gate', () => {
  describe('computeProgramReadiness', () => {
    it('returns not_ready for empty program', () => {
      const program = createMockProgram();
      const result = computeProgramReadiness(program);

      expect(result.status).toBe('not_ready');
      expect(result.score).toBe(5); // Only has title
      expect(result.missing).toContain('summary');
      expect(result.missing).toContain('deliverables');
      expect(result.missing).toContain('milestones');
    });

    it('returns not_ready when missing title', () => {
      const program = createMockProgram({
        title: '',
        scope: {
          summary: 'A detailed summary',
          deliverables: [{ id: 'd1', title: 'D1', type: 'other', status: 'planned' }],
          workstreams: [],
          channels: [],
          constraints: [],
          assumptions: [],
          unknowns: [],
          dependencies: [],
        },
      });

      const result = computeProgramReadiness(program);

      expect(result.status).toBe('not_ready');
      expect(result.missing).toContain('title');
    });

    it('returns needs_structure when has basics but no structure', () => {
      const program = createMockProgram({
        title: 'My Program',
        scope: {
          summary: 'A detailed program summary that explains the goal',
          deliverables: [],
          workstreams: [],
          channels: [],
          constraints: [],
          assumptions: [],
          unknowns: [],
          dependencies: [],
        },
        planDetails: {
          horizonDays: 30,
          milestones: [],
        },
      });

      const result = computeProgramReadiness(program);

      expect(result.status).toBe('needs_structure');
      expect(result.missing).toContain('deliverables');
      expect(result.missing).toContain('milestones');
    });

    it('returns ready when has sufficient structure', () => {
      const program = createMockProgram({
        title: 'My Program',
        scope: {
          summary: 'A detailed program summary that explains the goal',
          deliverables: [
            { id: 'd1', title: 'D1', type: 'other', status: 'planned' },
            { id: 'd2', title: 'D2', type: 'other', status: 'planned' },
            { id: 'd3', title: 'D3', type: 'other', status: 'planned' },
          ],
          workstreams: ['content'],
          channels: [],
          constraints: ['Budget is limited'],
          assumptions: ['Team is available'],
          unknowns: [],
          dependencies: ['Client approval'],
        },
        success: {
          kpis: [
            { key: 'kpi1', label: 'Conversion rate', target: '10%' },
            { key: 'kpi2', label: 'Traffic increase', target: '50%' },
          ],
        },
        planDetails: {
          horizonDays: 30,
          milestones: [
            { id: 'm1', title: 'M1', status: 'pending' },
            { id: 'm2', title: 'M2', status: 'pending' },
          ],
          owner: 'John Doe',
        },
      });

      const result = computeProgramReadiness(program);

      expect(result.status).toBe('ready');
      expect(result.score).toBeGreaterThanOrEqual(65);
    });

    it('scores partial deliverables correctly', () => {
      const programWith1 = createMockProgram({
        title: 'My Program',
        scope: {
          summary: 'Summary',
          deliverables: [{ id: 'd1', title: 'D1', type: 'other', status: 'planned' }],
          workstreams: [],
          channels: [],
          constraints: [],
          assumptions: [],
          unknowns: [],
          dependencies: [],
        },
      });

      const programWith3 = createMockProgram({
        title: 'My Program',
        scope: {
          summary: 'Summary',
          deliverables: [
            { id: 'd1', title: 'D1', type: 'other', status: 'planned' },
            { id: 'd2', title: 'D2', type: 'other', status: 'planned' },
            { id: 'd3', title: 'D3', type: 'other', status: 'planned' },
          ],
          workstreams: [],
          channels: [],
          constraints: [],
          assumptions: [],
          unknowns: [],
          dependencies: [],
        },
      });

      const result1 = computeProgramReadiness(programWith1);
      const result3 = computeProgramReadiness(programWith3);

      expect(result3.score).toBeGreaterThan(result1.score);
    });
  });

  describe('getReadinessStatusLabel', () => {
    it('returns correct labels', () => {
      expect(getReadinessStatusLabel('not_ready')).toBe('Not Ready');
      expect(getReadinessStatusLabel('needs_structure')).toBe('Needs Structure');
      expect(getReadinessStatusLabel('ready')).toBe('Ready');
    });
  });

  describe('getMissingItemLabel', () => {
    it('returns human-readable labels', () => {
      expect(getMissingItemLabel('deliverables')).toBe('Deliverables (3+ recommended)');
      expect(getMissingItemLabel('milestones')).toBe('Milestones (2+ recommended)');
      expect(getMissingItemLabel('owner')).toBe('Program owner');
    });
  });

  describe('getAIFillableMissing', () => {
    it('filters to AI-fillable items only', () => {
      const missing = ['deliverables', 'milestones', 'owner', 'dates', 'kpis', 'constraints'];
      const aiFillable = getAIFillableMissing(missing);

      expect(aiFillable).toContain('deliverables');
      expect(aiFillable).toContain('milestones');
      expect(aiFillable).toContain('kpis');
      expect(aiFillable).toContain('constraints');
      expect(aiFillable).not.toContain('owner');
      expect(aiFillable).not.toContain('dates');
    });
  });

  describe('canCommitFromReadiness', () => {
    it('returns true only for ready status', () => {
      expect(canCommitFromReadiness({ status: 'ready', score: 70, reasons: [], missing: [] })).toBe(true);
      expect(canCommitFromReadiness({ status: 'needs_structure', score: 40, reasons: [], missing: [] })).toBe(false);
      expect(canCommitFromReadiness({ status: 'not_ready', score: 10, reasons: [], missing: [] })).toBe(false);
    });
  });
});

// ============================================================================
// Tests: Readiness with Owner
// ============================================================================

describe('Readiness with Owner', () => {
  it('requires owner for full score', () => {
    const withoutOwner = createMockProgram({
      title: 'Program',
      scope: {
        summary: 'Summary',
        deliverables: [
          { id: 'd1', title: 'D1', type: 'other', status: 'planned' },
          { id: 'd2', title: 'D2', type: 'other', status: 'planned' },
          { id: 'd3', title: 'D3', type: 'other', status: 'planned' },
        ],
        workstreams: [],
        channels: [],
        constraints: [],
        assumptions: [],
        unknowns: [],
        dependencies: [],
      },
      planDetails: {
        horizonDays: 30,
        milestones: [{ id: 'm1', title: 'M1', status: 'pending' }, { id: 'm2', title: 'M2', status: 'pending' }],
      },
    });

    const withOwner = createMockProgram({
      title: 'Program',
      scope: {
        summary: 'Summary',
        deliverables: [
          { id: 'd1', title: 'D1', type: 'other', status: 'planned' },
          { id: 'd2', title: 'D2', type: 'other', status: 'planned' },
          { id: 'd3', title: 'D3', type: 'other', status: 'planned' },
        ],
        workstreams: [],
        channels: [],
        constraints: [],
        assumptions: [],
        unknowns: [],
        dependencies: [],
      },
      planDetails: {
        horizonDays: 30,
        milestones: [{ id: 'm1', title: 'M1', status: 'pending' }, { id: 'm2', title: 'M2', status: 'pending' }],
        owner: 'Jane Smith',
      },
    });

    const resultWithout = computeProgramReadiness(withoutOwner);
    const resultWith = computeProgramReadiness(withOwner);

    expect(resultWith.score).toBeGreaterThan(resultWithout.score);
    expect(resultWithout.missing).toContain('owner');
    expect(resultWith.missing).not.toContain('owner');
  });
});
