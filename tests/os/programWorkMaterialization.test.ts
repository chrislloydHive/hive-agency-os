/**
 * Tests for Program → Work Materialization
 *
 * Tests the buildProgramWorkPlan function for:
 * - Deterministic key generation
 * - Index-based keys for deliverables/milestones
 * - Default items when no structure exists
 * - Setup item inclusion
 * - Filtering completed/cancelled items
 * - Input hash change detection
 */

import { describe, it, expect } from 'vitest';
import { buildProgramWorkPlan, type WorkPlan } from '@/lib/os/planning/programToWork';
import type { PlanningProgram, PlanningDeliverable, PlanningMilestone } from '@/lib/types/program';

// ============================================================================
// Mock Program Factory
// ============================================================================

function createMockProgram(overrides: Partial<PlanningProgram> = {}): PlanningProgram {
  return {
    id: 'prog_test_123',
    companyId: 'company_test',
    strategyId: 'strategy_abc',
    title: 'Test Program',
    status: 'ready',
    origin: {
      strategyId: 'strategy_abc',
      tacticId: 'tactic_xyz',
      tacticTitle: 'Test Tactic',
    },
    scope: {
      summary: 'Test summary',
      deliverables: [],
      workstreams: [],
      channels: [],
      constraints: [],
      assumptions: [],
      unknowns: [],
      dependencies: [],
    },
    success: { kpis: [] },
    planDetails: { horizonDays: 30, milestones: [] },
    commitment: { workItemIds: [] },
    linkedArtifacts: [],
    workPlanJson: null,
    workPlanVersion: 0,
    scopeEnforced: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createDeliverable(overrides: Partial<PlanningDeliverable> = {}): PlanningDeliverable {
  return {
    id: `del_${Math.random().toString(36).substring(2, 8)}`,
    title: 'Test Deliverable',
    type: 'other',
    status: 'planned',
    ...overrides,
  };
}

function createMilestone(overrides: Partial<PlanningMilestone> = {}): PlanningMilestone {
  return {
    id: `ms_${Math.random().toString(36).substring(2, 8)}`,
    title: 'Test Milestone',
    status: 'pending',
    ...overrides,
  };
}

// ============================================================================
// Tests: Deterministic Keys
// ============================================================================

describe('buildProgramWorkPlan - Deterministic Keys', () => {
  it('generates same keys for same inputs', () => {
    const program = createMockProgram({
      scope: {
        ...createMockProgram().scope,
        deliverables: [
          createDeliverable({ title: 'Deliverable 1' }),
          createDeliverable({ title: 'Deliverable 2' }),
        ],
      },
    });

    const plan1 = buildProgramWorkPlan(program);
    const plan2 = buildProgramWorkPlan(program);

    expect(plan1.items.map(i => i.workKey)).toEqual(plan2.items.map(i => i.workKey));
  });

  it('uses index-based keys for deliverables', () => {
    const program = createMockProgram({
      scope: {
        ...createMockProgram().scope,
        deliverables: [
          createDeliverable({ title: 'First' }),
          createDeliverable({ title: 'Second' }),
        ],
      },
    });

    const plan = buildProgramWorkPlan(program);
    const deliverableKeys = plan.items.filter(i => i.workKey.startsWith('del::'));

    expect(deliverableKeys[0].workKey).toBe('del::0');
    expect(deliverableKeys[1].workKey).toBe('del::1');
  });

  it('uses index-based keys for milestones', () => {
    const program = createMockProgram({
      planDetails: {
        horizonDays: 30,
        milestones: [
          createMilestone({ title: 'Phase 1' }),
          createMilestone({ title: 'Phase 2' }),
        ],
      },
    });

    const plan = buildProgramWorkPlan(program);
    const milestoneKeys = plan.items.filter(i => i.workKey.startsWith('milestone::'));

    expect(milestoneKeys[0].workKey).toBe('milestone::0');
    expect(milestoneKeys[1].workKey).toBe('milestone::1');
  });
});

// ============================================================================
// Tests: Default Items
// ============================================================================

describe('buildProgramWorkPlan - Default Items', () => {
  it('generates 3 default items when no deliverables or milestones', () => {
    const program = createMockProgram();
    const plan = buildProgramWorkPlan(program);

    expect(plan.items).toHaveLength(3);
    expect(plan.items[0].workKey).toBe('default::0');
    expect(plan.items[0].title).toBe('Kickoff');
    expect(plan.items[1].workKey).toBe('default::1');
    expect(plan.items[1].title).toBe('Build');
    expect(plan.items[2].workKey).toBe('default::2');
    expect(plan.items[2].title).toBe('QA & Launch');
  });

  it('does not generate defaults when deliverables exist', () => {
    const program = createMockProgram({
      scope: {
        ...createMockProgram().scope,
        deliverables: [createDeliverable({ title: 'Real Deliverable' })],
      },
    });

    const plan = buildProgramWorkPlan(program);
    const defaultItems = plan.items.filter(i => i.workKey.startsWith('default::'));

    expect(defaultItems).toHaveLength(0);
  });

  it('does not generate defaults when milestones exist', () => {
    const program = createMockProgram({
      planDetails: {
        horizonDays: 30,
        milestones: [createMilestone({ title: 'Real Milestone' })],
      },
    });

    const plan = buildProgramWorkPlan(program);
    const defaultItems = plan.items.filter(i => i.workKey.startsWith('default::'));

    expect(defaultItems).toHaveLength(0);
  });
});

// ============================================================================
// Tests: Setup Item
// ============================================================================

describe('buildProgramWorkPlan - Setup Item', () => {
  it('includes setup item when deliverables exist', () => {
    const program = createMockProgram({
      scope: {
        ...createMockProgram().scope,
        deliverables: [createDeliverable({ title: 'Deliverable' })],
      },
    });

    const plan = buildProgramWorkPlan(program);
    const setupItem = plan.items.find(i => i.workKey === 'setup');

    expect(setupItem).toBeDefined();
    expect(setupItem?.title).toContain('[Setup]');
  });

  it('includes setup item when milestones exist', () => {
    const program = createMockProgram({
      planDetails: {
        horizonDays: 30,
        milestones: [createMilestone({ title: 'Milestone' })],
      },
    });

    const plan = buildProgramWorkPlan(program);
    const setupItem = plan.items.find(i => i.workKey === 'setup');

    expect(setupItem).toBeDefined();
    expect(setupItem?.title).toContain('[Setup]');
  });

  it('setup item includes program title', () => {
    const program = createMockProgram({
      title: 'My Custom Program',
      scope: {
        ...createMockProgram().scope,
        deliverables: [createDeliverable()],
      },
    });

    const plan = buildProgramWorkPlan(program);
    const setupItem = plan.items.find(i => i.workKey === 'setup');

    expect(setupItem?.title).toContain('My Custom Program');
  });
});

// ============================================================================
// Tests: Filtering
// ============================================================================

describe('buildProgramWorkPlan - Filtering', () => {
  it('excludes completed deliverables', () => {
    const program = createMockProgram({
      scope: {
        ...createMockProgram().scope,
        deliverables: [
          createDeliverable({ title: 'Active', status: 'planned' }),
          createDeliverable({ title: 'Done', status: 'completed' }),
        ],
      },
    });

    const plan = buildProgramWorkPlan(program);
    const deliverableItems = plan.items.filter(i => i.workKey.startsWith('del::'));

    expect(deliverableItems).toHaveLength(1);
    expect(deliverableItems[0].title).toBe('Active');
  });

  it('excludes cancelled deliverables', () => {
    const program = createMockProgram({
      scope: {
        ...createMockProgram().scope,
        deliverables: [
          createDeliverable({ title: 'Active', status: 'planned' }),
          createDeliverable({ title: 'Cancelled', status: 'cancelled' }),
        ],
      },
    });

    const plan = buildProgramWorkPlan(program);
    const deliverableItems = plan.items.filter(i => i.workKey.startsWith('del::'));

    expect(deliverableItems).toHaveLength(1);
  });

  it('excludes completed milestones', () => {
    const program = createMockProgram({
      planDetails: {
        horizonDays: 30,
        milestones: [
          createMilestone({ title: 'Active', status: 'pending' }),
          createMilestone({ title: 'Done', status: 'completed' }),
        ],
      },
    });

    const plan = buildProgramWorkPlan(program);
    const milestoneItems = plan.items.filter(i => i.workKey.startsWith('milestone::'));

    expect(milestoneItems).toHaveLength(1);
  });

  it('includes in_progress deliverables', () => {
    const program = createMockProgram({
      scope: {
        ...createMockProgram().scope,
        deliverables: [createDeliverable({ title: 'In Progress', status: 'in_progress' })],
      },
    });

    const plan = buildProgramWorkPlan(program);
    const deliverableItems = plan.items.filter(i => i.workKey.startsWith('del::'));

    expect(deliverableItems).toHaveLength(1);
    expect(deliverableItems[0].title).toBe('In Progress');
  });

  it('includes in_progress milestones', () => {
    const program = createMockProgram({
      planDetails: {
        horizonDays: 30,
        milestones: [createMilestone({ title: 'In Progress', status: 'in_progress' })],
      },
    });

    const plan = buildProgramWorkPlan(program);
    const milestoneItems = plan.items.filter(i => i.workKey.startsWith('milestone::'));

    expect(milestoneItems).toHaveLength(1);
  });
});

// ============================================================================
// Tests: Input Hash
// ============================================================================

describe('buildProgramWorkPlan - Input Hash', () => {
  it('includes inputHash for change detection', () => {
    const program = createMockProgram({
      scope: {
        ...createMockProgram().scope,
        deliverables: [createDeliverable({ title: 'Deliverable' })],
      },
    });

    const plan = buildProgramWorkPlan(program);

    expect(plan.inputHash).toBeDefined();
    expect(plan.inputHash.length).toBeGreaterThan(0);
  });

  it('same inputs produce same hash', () => {
    const program = createMockProgram({
      scope: {
        ...createMockProgram().scope,
        deliverables: [createDeliverable({ title: 'Same Title' })],
      },
    });

    const plan1 = buildProgramWorkPlan(program);
    const plan2 = buildProgramWorkPlan(program);

    expect(plan1.inputHash).toBe(plan2.inputHash);
  });

  it('different inputs produce different hashes', () => {
    // Use significantly different inputs to ensure hash differs
    const program1 = createMockProgram({
      title: 'Program Alpha',
      scope: {
        ...createMockProgram().scope,
        workstreams: ['content', 'seo'],
        deliverables: [
          createDeliverable({ title: 'Website Redesign Project' }),
          createDeliverable({ title: 'Content Strategy' }),
        ],
      },
    });

    const program2 = createMockProgram({
      title: 'Program Beta',
      scope: {
        ...createMockProgram().scope,
        workstreams: ['email', 'social'],
        deliverables: [
          createDeliverable({ title: 'Email Campaign Launch' }),
        ],
      },
      planDetails: {
        horizonDays: 30,
        milestones: [createMilestone({ title: 'Launch Day' })],
      },
    });

    const plan1 = buildProgramWorkPlan(program1);
    const plan2 = buildProgramWorkPlan(program2);

    expect(plan1.inputHash).not.toBe(plan2.inputHash);
  });
});

// ============================================================================
// Tests: Work Key Uniqueness
// ============================================================================

describe('buildProgramWorkPlan - Work Key Uniqueness', () => {
  it('generates unique keys per program', () => {
    const program = createMockProgram({
      scope: {
        ...createMockProgram().scope,
        deliverables: [
          createDeliverable({ title: 'Del 1' }),
          createDeliverable({ title: 'Del 2' }),
          createDeliverable({ title: 'Del 3' }),
        ],
      },
      planDetails: {
        horizonDays: 30,
        milestones: [
          createMilestone({ title: 'MS 1' }),
          createMilestone({ title: 'MS 2' }),
        ],
      },
    });

    const plan = buildProgramWorkPlan(program);

    // All keys should be unique
    const keys = plan.items.map(i => i.workKey);
    const uniqueKeys = new Set(keys);

    expect(uniqueKeys.size).toBe(keys.length);
  });

  it('includes generatedAt timestamp', () => {
    const program = createMockProgram();
    const plan = buildProgramWorkPlan(program);

    expect(plan.generatedAt).toBeDefined();
    // Should be a valid ISO string
    expect(() => new Date(plan.generatedAt)).not.toThrow();
  });
});

// ============================================================================
// Tests: Workstream Handling
// ============================================================================

describe('buildProgramWorkPlan - Workstream Handling', () => {
  it('uses deliverable workstreamType if provided', () => {
    const program = createMockProgram({
      scope: {
        ...createMockProgram().scope,
        workstreams: ['content'],
        deliverables: [
          createDeliverable({ title: 'SEO Work', workstreamType: 'seo' }),
        ],
      },
    });

    const plan = buildProgramWorkPlan(program);
    const deliverableItem = plan.items.find(i => i.workKey === 'del::0');

    expect(deliverableItem?.workstreamType).toBe('seo');
  });

  it('falls back to program workstream if deliverable has none', () => {
    const program = createMockProgram({
      scope: {
        ...createMockProgram().scope,
        workstreams: ['content'],
        deliverables: [
          createDeliverable({ title: 'Content Work' }),
        ],
      },
    });

    const plan = buildProgramWorkPlan(program);
    const deliverableItem = plan.items.find(i => i.workKey === 'del::0');

    expect(deliverableItem?.workstreamType).toBe('content');
  });

  it('defaults to "other" if no workstream specified', () => {
    const program = createMockProgram({
      scope: {
        ...createMockProgram().scope,
        workstreams: [],
        deliverables: [createDeliverable({ title: 'Unknown Work' })],
      },
    });

    const plan = buildProgramWorkPlan(program);
    const deliverableItem = plan.items.find(i => i.workKey === 'del::0');

    expect(deliverableItem?.workstreamType).toBe('other');
  });
});
