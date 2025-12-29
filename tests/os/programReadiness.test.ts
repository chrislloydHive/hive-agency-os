/**
 * Tests for Program Readiness and Templates
 *
 * Covers the canonical model:
 *   Strategy → Program → Work
 */

import { describe, it, expect } from 'vitest';
import type { PlanningProgram, PlanningProgramStatus } from '@/lib/types/program';

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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================================================
// Readiness Logic (inline for testing)
// ============================================================================

interface ReadinessCheckItem {
  id: string;
  label: string;
  check: (program: PlanningProgram) => boolean;
  required: boolean;
}

const READINESS_CHECKS: ReadinessCheckItem[] = [
  {
    id: 'summary',
    label: 'Scope summary defined',
    check: (p) => !!(p.scope.summary && p.scope.summary.trim().length > 10),
    required: false,
  },
  {
    id: 'deliverables',
    label: 'At least one deliverable',
    check: (p) => p.scope.deliverables.length > 0,
    required: true,
  },
  {
    id: 'milestones',
    label: 'Milestones planned',
    check: (p) => p.planDetails.milestones.length > 0,
    required: false,
  },
];

function computeReadiness(program: PlanningProgram): {
  items: Array<ReadinessCheckItem & { passed: boolean }>;
  score: number;
  requiredPassed: boolean;
  canMarkReady: boolean;
} {
  const items = READINESS_CHECKS.map((check) => ({
    ...check,
    passed: check.check(program),
  }));

  const passedCount = items.filter((i) => i.passed).length;
  const score = Math.round((passedCount / items.length) * 100);
  const requiredPassed = items.filter((i) => i.required).every((i) => i.passed);
  const canMarkReady = requiredPassed;

  return { items, score, requiredPassed, canMarkReady };
}

// ============================================================================
// Tests: Program Readiness
// ============================================================================

describe('Program Readiness', () => {
  describe('computeReadiness', () => {
    it('returns 0% score for empty program', () => {
      const program = createMockProgram();
      const result = computeReadiness(program);

      expect(result.score).toBe(0);
      expect(result.requiredPassed).toBe(false);
      expect(result.canMarkReady).toBe(false);
    });

    it('returns 100% when all checks pass', () => {
      const program = createMockProgram({
        scope: {
          summary: 'This is a detailed summary for the program scope',
          deliverables: [
            { id: 'del_1', title: 'Deliverable 1', type: 'other', status: 'planned' },
            { id: 'del_2', title: 'Deliverable 2', type: 'other', status: 'planned' },
          ],
          workstreams: ['content'],
          channels: [],
          constraints: [],
          assumptions: [],
          unknowns: [],
          dependencies: [],
        },
        planDetails: {
          horizonDays: 30,
          milestones: [{ id: 'ms_1', title: 'Phase 1', status: 'pending' }],
        },
      });

      const result = computeReadiness(program);

      expect(result.score).toBe(100);
      expect(result.requiredPassed).toBe(true);
      expect(result.canMarkReady).toBe(true);
    });

    it('requires deliverables to mark ready', () => {
      // Program with summary and milestones but no deliverables
      const program = createMockProgram({
        scope: {
          summary: 'This is a detailed summary for the program scope',
          deliverables: [], // Empty!
          workstreams: [],
          channels: [],
          constraints: [],
          assumptions: [],
          unknowns: [],
          dependencies: [],
        },
        planDetails: {
          horizonDays: 30,
          milestones: [{ id: 'ms_1', title: 'Phase 1', status: 'pending' }],
        },
      });

      const result = computeReadiness(program);

      // Should have 2/3 passed (summary + milestones)
      expect(result.score).toBe(67);
      expect(result.requiredPassed).toBe(false);
      expect(result.canMarkReady).toBe(false);
    });

    it('allows marking ready with only deliverables', () => {
      const program = createMockProgram({
        scope: {
          summary: '',
          deliverables: [{ id: 'del_1', title: 'Website redesign', type: 'other', status: 'planned' }],
          workstreams: [],
          channels: [],
          constraints: [],
          assumptions: [],
          unknowns: [],
          dependencies: [],
        },
      });

      const result = computeReadiness(program);

      // Only deliverables passed (1/3)
      expect(result.score).toBe(33);
      expect(result.requiredPassed).toBe(true);
      expect(result.canMarkReady).toBe(true);
    });

    it('correctly identifies individual check statuses', () => {
      const program = createMockProgram({
        scope: {
          summary: 'A summary that is long enough to pass',
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

      const result = computeReadiness(program);

      const summaryCheck = result.items.find((i) => i.id === 'summary');
      const deliverablesCheck = result.items.find((i) => i.id === 'deliverables');
      const milestonesCheck = result.items.find((i) => i.id === 'milestones');

      expect(summaryCheck?.passed).toBe(true);
      expect(deliverablesCheck?.passed).toBe(false);
      expect(milestonesCheck?.passed).toBe(false);
    });
  });
});

// ============================================================================
// Tests: Program Status Lifecycle
// ============================================================================

describe('Program Status Lifecycle', () => {
  const VALID_STATUSES: PlanningProgramStatus[] = ['draft', 'ready', 'committed', 'paused', 'archived'];

  it('defines all valid status values', () => {
    expect(VALID_STATUSES).toContain('draft');
    expect(VALID_STATUSES).toContain('ready');
    expect(VALID_STATUSES).toContain('committed');
    expect(VALID_STATUSES).toContain('paused');
    expect(VALID_STATUSES).toContain('archived');
  });

  it('new programs start as draft', () => {
    const program = createMockProgram();
    expect(program.status).toBe('draft');
  });

  it('committed programs have workItemIds', () => {
    const program = createMockProgram({
      status: 'committed',
      commitment: {
        committedAt: new Date().toISOString(),
        workItemIds: ['work_1', 'work_2'],
      },
    });

    expect(program.status).toBe('committed');
    expect(program.commitment.workItemIds).toHaveLength(2);
    expect(program.commitment.committedAt).toBeDefined();
  });
});

// ============================================================================
// Tests: Stable Key Idempotency
// ============================================================================

describe('Stable Key Idempotency', () => {
  it('generates stable key from strategy and tactic IDs', () => {
    const strategyId = 'strat_abc123';
    const tacticId = 'tac_xyz789';

    const stableKey = `${strategyId}::${tacticId}`;

    expect(stableKey).toBe('strat_abc123::tac_xyz789');
  });

  it('same IDs always produce same stable key', () => {
    const key1 = `strategy_1::tactic_1`;
    const key2 = `strategy_1::tactic_1`;
    const key3 = `strategy_1::tactic_2`;

    expect(key1).toBe(key2);
    expect(key1).not.toBe(key3);
  });

  it('program stableKey matches expected format', () => {
    const program = createMockProgram({
      stableKey: 'my_strategy::my_tactic',
    });

    // stableKey is optional, so guard the split
    const stableKey = program.stableKey ?? '';
    const [strategyId, tacticId] = stableKey.split('::');

    expect(strategyId).toBe('my_strategy');
    expect(tacticId).toBe('my_tactic');
  });
});

// ============================================================================
// Tests: Program Origin Traceability
// ============================================================================

describe('Program Origin Traceability', () => {
  it('tracks origin strategy and tactic', () => {
    const programCreatedAt = '2024-01-15T10:00:00Z';
    const program = createMockProgram({
      origin: {
        strategyId: 'strat_123',
        tacticId: 'tac_456',
        tacticTitle: 'Launch SEO Campaign',
      },
      createdAt: programCreatedAt,
    });

    expect(program.origin.strategyId).toBe('strat_123');
    expect(program.origin.tacticId).toBe('tac_456');
    expect(program.origin.tacticTitle).toBe('Launch SEO Campaign');
    expect(program.createdAt).toBe(programCreatedAt);
  });

  it('can trace back from program to strategy', () => {
    const program = createMockProgram();

    // Simulate finding the original strategy
    const strategyId = program.origin.strategyId;

    expect(strategyId).toBe('strategy_abc');
  });
});
