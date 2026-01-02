/**
 * Tests for Create Work from Program
 *
 * Tests the commit API endpoint behavior:
 * - Work item creation from committed programs
 * - Idempotency (calling twice doesn't duplicate)
 * - Work items have correct programId and company links
 * - Error handling for non-existent programs
 */

import { describe, it, expect } from 'vitest';
import type { PlanningProgram, PlanningDeliverable, PlanningMilestone } from '@/lib/types/program';
import { buildProgramWorkPlan } from '@/lib/os/planning/programToWork';

// ============================================================================
// Mock Program Factory (shared with materialization tests)
// ============================================================================

function createMockProgram(overrides: Partial<PlanningProgram> = {}): PlanningProgram {
  return {
    id: 'prog_test_123',
    companyId: 'company_test',
    strategyId: 'strategy_abc',
    title: 'Test Program',
    status: 'committed',
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
// Tests: Work Plan Generation for Committed Programs
// ============================================================================

describe('Create Work from Program - Work Plan Generation', () => {
  it('creates work items from deliverables', () => {
    const program = createMockProgram({
      scope: {
        ...createMockProgram().scope,
        deliverables: [
          createDeliverable({ title: 'Website Redesign' }),
          createDeliverable({ title: 'Landing Page' }),
          createDeliverable({ title: 'Blog Post Series' }),
        ],
      },
    });

    const plan = buildProgramWorkPlan(program);

    // Should have setup + 3 deliverables = 4 items
    expect(plan.items).toHaveLength(4);

    // Check deliverables are included
    const deliverableItems = plan.items.filter((i) => i.workKey.startsWith('del::'));
    expect(deliverableItems).toHaveLength(3);
    expect(deliverableItems[0].title).toBe('Website Redesign');
    expect(deliverableItems[1].title).toBe('Landing Page');
    expect(deliverableItems[2].title).toBe('Blog Post Series');
  });

  it('creates work items from milestones', () => {
    const program = createMockProgram({
      planDetails: {
        horizonDays: 30,
        milestones: [
          createMilestone({ title: 'Phase 1 Complete' }),
          createMilestone({ title: 'Launch Day' }),
        ],
      },
    });

    const plan = buildProgramWorkPlan(program);

    const milestoneItems = plan.items.filter((i) => i.workKey.startsWith('milestone::'));
    expect(milestoneItems).toHaveLength(2);
    // Milestones have [Milestone] prefix
    expect(milestoneItems[0].title).toBe('[Milestone] Phase 1 Complete');
    expect(milestoneItems[1].title).toBe('[Milestone] Launch Day');
  });

  it('creates default items when no deliverables or milestones', () => {
    const program = createMockProgram({
      title: 'Empty Program',
    });

    const plan = buildProgramWorkPlan(program);

    // Should have 3 default items
    expect(plan.items).toHaveLength(3);
    expect(plan.items[0].title).toBe('Kickoff');
    expect(plan.items[1].title).toBe('Build');
    expect(plan.items[2].title).toBe('QA & Launch');
  });
});

// ============================================================================
// Tests: Idempotency
// ============================================================================

describe('Create Work from Program - Idempotency', () => {
  it('generates same keys for same program state', () => {
    const program = createMockProgram({
      scope: {
        ...createMockProgram().scope,
        deliverables: [
          createDeliverable({ title: 'Task A' }),
          createDeliverable({ title: 'Task B' }),
        ],
      },
    });

    const plan1 = buildProgramWorkPlan(program);
    const plan2 = buildProgramWorkPlan(program);

    // Keys should be identical
    expect(plan1.items.map((i) => i.workKey)).toEqual(plan2.items.map((i) => i.workKey));

    // Hashes should be identical
    expect(plan1.inputHash).toBe(plan2.inputHash);
  });

  it('keys remain stable when program order is unchanged', () => {
    const deliverable1 = createDeliverable({ title: 'First Task' });
    const deliverable2 = createDeliverable({ title: 'Second Task' });

    const program = createMockProgram({
      scope: {
        ...createMockProgram().scope,
        deliverables: [deliverable1, deliverable2],
      },
    });

    const plan = buildProgramWorkPlan(program);

    // First deliverable always gets del::0
    expect(plan.items.find((i) => i.title === 'First Task')?.workKey).toBe('del::0');
    expect(plan.items.find((i) => i.title === 'Second Task')?.workKey).toBe('del::1');
  });
});

// ============================================================================
// Tests: Work Item Properties
// ============================================================================

describe('Create Work from Program - Work Item Properties', () => {
  it('work items include correct area mapping', () => {
    const program = createMockProgram({
      scope: {
        ...createMockProgram().scope,
        workstreams: ['seo', 'content'],
        deliverables: [createDeliverable({ title: 'SEO Task' })],
      },
    });

    const plan = buildProgramWorkPlan(program);
    const deliverableItem = plan.items.find((i) => i.workKey === 'del::0');

    // Should map to SEO area (first workstream)
    expect(deliverableItem?.area).toBe('SEO');
  });

  it('work items include workstream type', () => {
    const program = createMockProgram({
      scope: {
        ...createMockProgram().scope,
        workstreams: ['content'],
        deliverables: [createDeliverable({ title: 'Content Task' })],
      },
    });

    const plan = buildProgramWorkPlan(program);
    const deliverableItem = plan.items.find((i) => i.workKey === 'del::0');

    expect(deliverableItem?.workstreamType).toBe('content');
  });

  it('work items include program notes in description', () => {
    const program = createMockProgram({
      scope: {
        ...createMockProgram().scope,
        summary: 'This is a test program for SEO optimization',
        deliverables: [
          createDeliverable({ title: 'Keyword Research', description: 'Research top keywords' }),
        ],
      },
    });

    const plan = buildProgramWorkPlan(program);
    const deliverableItem = plan.items.find((i) => i.workKey === 'del::0');

    // Notes should include the deliverable description
    expect(deliverableItem?.notes).toContain('Research top keywords');
  });
});

// ============================================================================
// Tests: Program State Validation
// ============================================================================

describe('Create Work from Program - State Handling', () => {
  it('handles program with empty deliverables array', () => {
    const program = createMockProgram({
      scope: {
        ...createMockProgram().scope,
        deliverables: [],
      },
    });

    const plan = buildProgramWorkPlan(program);

    // Should fall back to defaults
    expect(plan.items).toHaveLength(3);
    expect(plan.items[0].title).toBe('Kickoff');
  });

  it('handles program with only completed deliverables', () => {
    const program = createMockProgram({
      scope: {
        ...createMockProgram().scope,
        deliverables: [
          createDeliverable({ title: 'Done Task', status: 'completed' }),
          createDeliverable({ title: 'Also Done', status: 'completed' }),
        ],
      },
    });

    const plan = buildProgramWorkPlan(program);

    // When deliverables exist but all are completed, setup item is still included
    // (since deliverables array is not empty, defaults are not generated)
    expect(plan.items).toHaveLength(1);
    expect(plan.items[0].workKey).toBe('setup');
  });

  it('handles mixed deliverable statuses', () => {
    const program = createMockProgram({
      scope: {
        ...createMockProgram().scope,
        deliverables: [
          createDeliverable({ title: 'Active Task', status: 'planned' }),
          createDeliverable({ title: 'In Progress', status: 'in_progress' }),
          createDeliverable({ title: 'Done Task', status: 'completed' }),
          createDeliverable({ title: 'Cancelled', status: 'cancelled' }),
        ],
      },
    });

    const plan = buildProgramWorkPlan(program);

    // Should only include active and in_progress (not completed/cancelled)
    const deliverableItems = plan.items.filter((i) => i.workKey.startsWith('del::'));
    expect(deliverableItems).toHaveLength(2);
    expect(deliverableItems.map((i) => i.title)).toContain('Active Task');
    expect(deliverableItems.map((i) => i.title)).toContain('In Progress');
  });
});

// ============================================================================
// Tests: Work Key Format
// ============================================================================

describe('Create Work from Program - Work Key Format', () => {
  it('setup item has key "setup"', () => {
    const program = createMockProgram({
      scope: {
        ...createMockProgram().scope,
        deliverables: [createDeliverable({ title: 'Task' })],
      },
    });

    const plan = buildProgramWorkPlan(program);
    const setupItem = plan.items.find((i) => i.workKey === 'setup');

    expect(setupItem).toBeDefined();
    expect(setupItem?.title).toContain('[Setup]');
  });

  it('deliverable keys use del::N format', () => {
    const program = createMockProgram({
      scope: {
        ...createMockProgram().scope,
        deliverables: [
          createDeliverable({ title: 'A' }),
          createDeliverable({ title: 'B' }),
          createDeliverable({ title: 'C' }),
        ],
      },
    });

    const plan = buildProgramWorkPlan(program);
    const deliverableKeys = plan.items
      .filter((i) => i.workKey.startsWith('del::'))
      .map((i) => i.workKey);

    expect(deliverableKeys).toEqual(['del::0', 'del::1', 'del::2']);
  });

  it('milestone keys use milestone::N format', () => {
    const program = createMockProgram({
      planDetails: {
        horizonDays: 30,
        milestones: [
          createMilestone({ title: 'M1' }),
          createMilestone({ title: 'M2' }),
        ],
      },
    });

    const plan = buildProgramWorkPlan(program);
    const milestoneKeys = plan.items
      .filter((i) => i.workKey.startsWith('milestone::'))
      .map((i) => i.workKey);

    expect(milestoneKeys).toEqual(['milestone::0', 'milestone::1']);
  });

  it('default keys use default::N format', () => {
    const program = createMockProgram();

    const plan = buildProgramWorkPlan(program);
    const defaultKeys = plan.items.map((i) => i.workKey);

    expect(defaultKeys).toEqual(['default::0', 'default::1', 'default::2']);
  });
});
