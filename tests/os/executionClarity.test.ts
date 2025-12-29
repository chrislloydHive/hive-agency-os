// tests/os/executionClarity.test.ts
// Tests for Phase 20: Execution Clarity, Guardrails & UX Polish
//
// Tests cover:
// - Artifact execution status derivation
// - CTA configuration based on state
// - Execution description text

import { describe, test, expect } from 'vitest';
import {
  deriveExecutionStatus,
  getExecutionStatusBadge,
  getExecutionCTA,
  getExecutionDescription,
  type ExecutionStatus,
} from '@/lib/os/artifacts/executionStatus';
import type { ArtifactUsage } from '@/lib/types/artifact';

// ============================================================================
// Test Helpers
// ============================================================================

function createMockUsage(overrides: Partial<ArtifactUsage> = {}): ArtifactUsage {
  return {
    attachedWorkCount: 0,
    firstAttachedAt: null,
    lastAttachedAt: null,
    completedWorkCount: 0,
    ...overrides,
  };
}

// ============================================================================
// deriveExecutionStatus Tests
// ============================================================================

describe('deriveExecutionStatus', () => {
  test('returns not_started when no work items exist', () => {
    const usage = createMockUsage();
    const status = deriveExecutionStatus(usage, null);

    expect(status.state).toBe('not_started');
    expect(status.workItemsCreated).toBe(0);
    expect(status.label).toBe('Not started');
    expect(status.canCreateMore).toBe(true);
  });

  test('returns not_started when usage is null', () => {
    const status = deriveExecutionStatus(null, null);

    expect(status.state).toBe('not_started');
    expect(status.workItemsCreated).toBe(0);
    expect(status.canCreateMore).toBe(true);
  });

  test('returns not_started when usage is undefined', () => {
    const status = deriveExecutionStatus(undefined, null);

    expect(status.state).toBe('not_started');
    expect(status.workItemsCreated).toBe(0);
    expect(status.canCreateMore).toBe(true);
  });

  test('returns in_progress when some work items exist but total unknown', () => {
    const usage = createMockUsage({ attachedWorkCount: 3 });
    const status = deriveExecutionStatus(usage, null);

    expect(status.state).toBe('in_progress');
    expect(status.workItemsCreated).toBe(3);
    expect(status.label).toBe('In progress');
    expect(status.canCreateMore).toBe(true);
    expect(status.description).toContain('3 work items created');
  });

  test('returns in_progress when work items exist but fewer than expected', () => {
    const usage = createMockUsage({ attachedWorkCount: 3 });
    const status = deriveExecutionStatus(usage, 5);

    expect(status.state).toBe('in_progress');
    expect(status.workItemsCreated).toBe(3);
    expect(status.totalExpected).toBe(5);
    expect(status.canCreateMore).toBe(true);
    expect(status.description).toBe('3 of 5 work items created.');
  });

  test('returns completed when all expected work items created', () => {
    const usage = createMockUsage({ attachedWorkCount: 5, completedWorkCount: 0 });
    const status = deriveExecutionStatus(usage, 5);

    expect(status.state).toBe('completed');
    expect(status.workItemsCreated).toBe(5);
    expect(status.totalExpected).toBe(5);
    expect(status.canCreateMore).toBe(false);
    expect(status.label).toBe('Fully executed');
  });

  test('returns completed with Completed label when all work items also completed', () => {
    const usage = createMockUsage({ attachedWorkCount: 5, completedWorkCount: 5 });
    const status = deriveExecutionStatus(usage, 5);

    expect(status.state).toBe('completed');
    expect(status.label).toBe('Completed');
    expect(status.description).toContain('All 5 work items completed');
  });

  test('handles single work item correctly', () => {
    const usage = createMockUsage({ attachedWorkCount: 1 });
    const status = deriveExecutionStatus(usage, null);

    expect(status.description).toBe('1 work item created.');
  });
});

// ============================================================================
// getExecutionStatusBadge Tests
// ============================================================================

describe('getExecutionStatusBadge', () => {
  test('returns correct badge for not_started', () => {
    const badge = getExecutionStatusBadge('not_started');

    expect(badge.label).toBe('Not started');
    expect(badge.icon).toBe('circle');
    expect(badge.className).toContain('slate');
  });

  test('returns correct badge for in_progress', () => {
    const badge = getExecutionStatusBadge('in_progress');

    expect(badge.label).toBe('In execution');
    expect(badge.icon).toBe('loader');
    expect(badge.className).toContain('blue');
  });

  test('returns correct badge for completed', () => {
    const badge = getExecutionStatusBadge('completed');

    expect(badge.label).toBe('Executed');
    expect(badge.icon).toBe('check');
    expect(badge.className).toContain('emerald');
  });
});

// ============================================================================
// getExecutionCTA Tests
// ============================================================================

describe('getExecutionCTA', () => {
  test('returns create action for not_started', () => {
    const cta = getExecutionCTA('not_started', 0);

    expect(cta.primary.action).toBe('create');
    expect(cta.primary.label).toBe('Create work from artifact...');
    expect(cta.showSecondary).toBe(true);
    expect(cta.secondaryLabel).toBe('Attach to existing work...');
  });

  test('returns continue action for in_progress', () => {
    const cta = getExecutionCTA('in_progress', 3);

    expect(cta.primary.action).toBe('continue');
    expect(cta.primary.label).toBe('Continue execution...');
    expect(cta.showSecondary).toBe(true);
    expect(cta.secondaryLabel).toBe('View related work');
  });

  test('returns view action for completed', () => {
    const cta = getExecutionCTA('completed', 5);

    expect(cta.primary.action).toBe('view');
    expect(cta.primary.label).toBe('View related work →');
    expect(cta.showSecondary).toBe(false);
  });
});

// ============================================================================
// getExecutionDescription Tests
// ============================================================================

describe('getExecutionDescription', () => {
  test('returns correct description for not_started', () => {
    const status: ExecutionStatus = {
      state: 'not_started',
      workItemsCreated: 0,
      totalExpected: null,
      completedWorkItems: 0,
      label: 'Not started',
      description: 'No work has been created from this artifact yet.',
      canCreateMore: true,
    };

    const desc = getExecutionDescription(status);

    expect(desc.title).toBe('Not executed');
    expect(desc.subtitle).toBe('Turn this artifact into actionable work items');
  });

  test('returns correct description for in_progress with unknown total', () => {
    const status: ExecutionStatus = {
      state: 'in_progress',
      workItemsCreated: 3,
      totalExpected: null,
      completedWorkItems: 0,
      label: 'In progress',
      description: '3 work items created.',
      canCreateMore: true,
    };

    const desc = getExecutionDescription(status);

    expect(desc.title).toBe('Execution in progress');
    expect(desc.subtitle).toContain('Some work has been created');
    expect(desc.subtitle).toContain('3 work items created');
  });

  test('returns correct description for in_progress with known total', () => {
    const status: ExecutionStatus = {
      state: 'in_progress',
      workItemsCreated: 3,
      totalExpected: 5,
      completedWorkItems: 0,
      label: 'In progress',
      description: '3 of 5 work items created.',
      canCreateMore: true,
    };

    const desc = getExecutionDescription(status);

    expect(desc.title).toBe('Execution in progress');
    expect(desc.subtitle).toContain('3 work items created');
    expect(desc.subtitle).toContain('2 remaining');
  });

  test('returns correct description for completed', () => {
    const status: ExecutionStatus = {
      state: 'completed',
      workItemsCreated: 5,
      totalExpected: 5,
      completedWorkItems: 0,
      label: 'Fully executed',
      description: '5 work items created, 0 completed.',
      canCreateMore: false,
    };

    const desc = getExecutionDescription(status);

    expect(desc.title).toBe('Execution in progress');
    expect(desc.subtitle).toContain('All 5 work items created');
    expect(desc.subtitle).toContain('linked to this artifact');
  });

  test('handles singular work item correctly', () => {
    const status: ExecutionStatus = {
      state: 'in_progress',
      workItemsCreated: 1,
      totalExpected: null,
      completedWorkItems: 0,
      label: 'In progress',
      description: '1 work item created.',
      canCreateMore: true,
    };

    const desc = getExecutionDescription(status);

    expect(desc.subtitle).toContain('1 work item created');
    expect(desc.subtitle).not.toContain('items'); // Should be singular
  });
});
