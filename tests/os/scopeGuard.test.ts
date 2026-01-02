/**
 * Tests for Scope Guardrails
 *
 * Covers:
 * - Blocks work outside allowed workstreams
 * - Blocks work beyond concurrent limits
 * - Returns structured escalation payload
 * - Programs without scopeEnforced skip checks
 */

import { describe, it, expect } from 'vitest';
import type { PlanningProgram, WorkstreamType } from '@/lib/types/program';
import type { ProgramDomain } from '@/lib/types/programTemplate';
import {
  checkWorkstreamScope,
  checkConcurrencyLimit,
  validateWorkItemForProgram,
  validateWorkHasProgram,
  performScopeCheck,
  getScopeSummary,
  buildScopeEscalationMessage,
  buildConcurrencyEscalationMessage,
} from '@/lib/os/programs/scopeGuard';

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
    planDetails: { horizonDays: 30, milestones: [] },
    commitment: { workItemIds: [] },
    linkedArtifacts: [],
    workPlanVersion: 0,
    scopeEnforced: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createScopeEnforcedProgram(
  domain: ProgramDomain,
  allowedWorkTypes: WorkstreamType[],
  maxConcurrentWork: number
): PlanningProgram {
  return createMockProgram({
    scopeEnforced: true,
    domain,
    allowedWorkTypes,
    maxConcurrentWork,
    intensity: 'Standard',
  });
}

// ============================================================================
// Workstream Scope Tests
// ============================================================================

describe('Workstream Scope Checks', () => {
  describe('when scopeEnforced is false', () => {
    it('allows any workstream', () => {
      const program = createMockProgram({ scopeEnforced: false });

      const result = checkWorkstreamScope(program, 'paid_media');

      expect(result.allowed).toBe(true);
      expect(result.escalationRequired).toBe(false);
    });
  });

  describe('when scopeEnforced is true', () => {
    it('allows workstreams in the allowed list', () => {
      const program = createScopeEnforcedProgram('Creative', ['content', 'brand', 'social'], 5);

      expect(checkWorkstreamScope(program, 'content').allowed).toBe(true);
      expect(checkWorkstreamScope(program, 'brand').allowed).toBe(true);
      expect(checkWorkstreamScope(program, 'social').allowed).toBe(true);
    });

    it('blocks workstreams not in the allowed list', () => {
      const program = createScopeEnforcedProgram('Creative', ['content', 'brand', 'social'], 5);

      const result = checkWorkstreamScope(program, 'paid_media');

      expect(result.allowed).toBe(false);
      expect(result.escalationRequired).toBe(true);
      expect(result.reason).toContain('not within scope');
      expect(result.reason).toContain('Creative');
    });

    it('returns allowed workstreams in error message', () => {
      const program = createScopeEnforcedProgram('Media', ['paid_media'], 4);

      const result = checkWorkstreamScope(program, 'seo');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Paid Media');
    });

    it('allows any workstream if allowedWorkTypes is empty', () => {
      const program = createMockProgram({
        scopeEnforced: true,
        allowedWorkTypes: [],
      });

      const result = checkWorkstreamScope(program, 'anything' as WorkstreamType);

      expect(result.allowed).toBe(true);
    });

    it('allows any workstream if allowedWorkTypes is undefined', () => {
      const program = createMockProgram({
        scopeEnforced: true,
        allowedWorkTypes: undefined,
      });

      const result = checkWorkstreamScope(program, 'anything' as WorkstreamType);

      expect(result.allowed).toBe(true);
    });
  });
});

// ============================================================================
// Concurrency Limit Tests
// ============================================================================

describe('Concurrency Limit Checks', () => {
  describe('when scopeEnforced is false', () => {
    it('allows any number of work items', () => {
      const program = createMockProgram({
        scopeEnforced: false,
        maxConcurrentWork: 2,
      });

      const result = checkConcurrencyLimit(program, 100);

      expect(result.allowed).toBe(true);
    });
  });

  describe('when scopeEnforced is true', () => {
    it('allows work when under the limit', () => {
      const program = createScopeEnforcedProgram('Strategy', ['ops'], 5);

      expect(checkConcurrencyLimit(program, 0).allowed).toBe(true);
      expect(checkConcurrencyLimit(program, 2).allowed).toBe(true);
      expect(checkConcurrencyLimit(program, 4).allowed).toBe(true);
    });

    it('blocks work when at the limit', () => {
      const program = createScopeEnforcedProgram('Strategy', ['ops'], 5);

      const result = checkConcurrencyLimit(program, 5);

      expect(result.allowed).toBe(false);
      expect(result.escalationRequired).toBe(true);
      expect(result.reason).toContain('concurrent work limit');
      expect(result.reason).toContain('5');
    });

    it('blocks work when over the limit', () => {
      const program = createScopeEnforcedProgram('Strategy', ['ops'], 5);

      const result = checkConcurrencyLimit(program, 10);

      expect(result.allowed).toBe(false);
    });

    it('allows any count if maxConcurrentWork is undefined', () => {
      const program = createMockProgram({
        scopeEnforced: true,
        maxConcurrentWork: undefined,
      });

      const result = checkConcurrencyLimit(program, 100);

      expect(result.allowed).toBe(true);
    });
  });
});

// ============================================================================
// Combined Validation Tests
// ============================================================================

describe('Combined Work Item Validation', () => {
  it('fails if workstream is not allowed', () => {
    const program = createScopeEnforcedProgram('Media', ['paid_media'], 10);

    const result = validateWorkItemForProgram(program, 'seo', 0);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('not within scope');
  });

  it('fails if concurrency limit is reached', () => {
    const program = createScopeEnforcedProgram('Media', ['paid_media'], 3);

    const result = validateWorkItemForProgram(program, 'paid_media', 3);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('concurrent work limit');
  });

  it('passes when both checks pass', () => {
    const program = createScopeEnforcedProgram('Media', ['paid_media'], 10);

    const result = validateWorkItemForProgram(program, 'paid_media', 2);

    expect(result.allowed).toBe(true);
  });

  it('checks workstream before concurrency', () => {
    const program = createScopeEnforcedProgram('Media', ['paid_media'], 3);

    // Both would fail, but workstream should be checked first
    const result = validateWorkItemForProgram(program, 'seo', 5);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('not within scope');
  });
});

// ============================================================================
// Program Requirement Tests
// ============================================================================

describe('Program Requirement Checks', () => {
  it('allows work without program when not required', () => {
    const result = validateWorkHasProgram(undefined, false);
    expect(result.allowed).toBe(true);
  });

  it('allows work with program when required', () => {
    const result = validateWorkHasProgram('prog_123', true);
    expect(result.allowed).toBe(true);
  });

  it('blocks work without program when required', () => {
    const result = validateWorkHasProgram(undefined, true);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('must be associated with a program');
  });

  it('blocks work with null program when required', () => {
    const result = validateWorkHasProgram(null, true);

    expect(result.allowed).toBe(false);
  });
});

// ============================================================================
// Comprehensive Scope Check Tests
// ============================================================================

describe('Comprehensive Scope Check', () => {
  it('returns all check results', () => {
    const program = createScopeEnforcedProgram('Creative', ['content', 'brand'], 5);

    const result = performScopeCheck({
      program,
      proposedWorkstream: 'content',
      currentActiveWorkCount: 2,
    });

    expect(result.allowed).toBe(true);
    expect(result.checks.workstream?.allowed).toBe(true);
    expect(result.checks.concurrency?.allowed).toBe(true);
  });

  it('includes escalation message when blocked', () => {
    const program = createScopeEnforcedProgram('Creative', ['content', 'brand'], 5);

    const result = performScopeCheck({
      program,
      proposedWorkstream: 'paid_media',
      currentActiveWorkCount: 2,
    });

    expect(result.allowed).toBe(false);
    expect(result.escalationMessage).toBeDefined();
    expect(result.escalationMessage).toContain('Scope Escalation');
  });

  it('skips checks when values not provided', () => {
    const program = createScopeEnforcedProgram('Creative', ['content'], 5);

    const result = performScopeCheck({ program });

    expect(result.allowed).toBe(true);
    expect(result.checks.workstream).toBeUndefined();
    expect(result.checks.concurrency).toBeUndefined();
  });
});

// ============================================================================
// Scope Summary Tests
// ============================================================================

describe('Scope Summary', () => {
  it('returns correct summary for scope-enforced program', () => {
    const program = createScopeEnforcedProgram('Media', ['paid_media'], 4);

    const summary = getScopeSummary(program);

    expect(summary.enforced).toBe(true);
    expect(summary.allowedWorkstreams).toContain('Paid Media');
    expect(summary.maxConcurrentWork).toBe(4);
    expect(summary.domain).toBe('Media');
    expect(summary.intensity).toBe('Standard');
  });

  it('returns correct summary for non-enforced program', () => {
    const program = createMockProgram({ scopeEnforced: false });

    const summary = getScopeSummary(program);

    expect(summary.enforced).toBe(false);
    expect(summary.maxConcurrentWork).toBeNull();
  });
});

// ============================================================================
// Escalation Message Tests
// ============================================================================

describe('Escalation Messages', () => {
  describe('Scope Escalation', () => {
    it('includes program information', () => {
      const program = createScopeEnforcedProgram('Media', ['paid_media'], 4);
      program.title = 'Media Optimization Program';

      const message = buildScopeEscalationMessage(program, 'seo', 'SEO is not in scope');

      expect(message).toContain('Media Optimization Program');
      expect(message).toContain('Media');
      expect(message).toContain('Standard');
    });

    it('includes escalation options', () => {
      const program = createScopeEnforcedProgram('Media', ['paid_media'], 4);

      const message = buildScopeEscalationMessage(program, 'seo', 'Not in scope');

      expect(message).toContain('Request scope expansion');
      expect(message).toContain('Use a different workstream');
      expect(message).toContain('Create ad-hoc work');
    });
  });

  describe('Concurrency Escalation', () => {
    it('includes current and max counts', () => {
      const program = createScopeEnforcedProgram('Creative', ['content'], 5);
      program.title = 'Creative Production Program';

      const message = buildConcurrencyEscalationMessage(program, 5, 5);

      expect(message).toContain('Creative Production Program');
      expect(message).toContain('Current Active Work:** 5');
      expect(message).toContain('Maximum Allowed:** 5');
    });

    it('includes resolution options', () => {
      const program = createScopeEnforcedProgram('Creative', ['content'], 5);

      const message = buildConcurrencyEscalationMessage(program, 5, 5);

      expect(message).toContain('Complete in-progress work');
      expect(message).toContain('Archive or cancel');
      expect(message).toContain('capacity increase');
    });
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('handles program with empty title in escalation', () => {
    const program = createScopeEnforcedProgram('Strategy', ['ops'], 2);
    program.title = '';

    const message = buildScopeEscalationMessage(program, 'content', 'Not allowed');

    expect(message).toBeDefined();
    expect(message.length).toBeGreaterThan(0);
  });

  it('handles program without domain in summary', () => {
    const program = createMockProgram({
      scopeEnforced: true,
      domain: undefined,
    });

    const summary = getScopeSummary(program);

    expect(summary.domain).toBeNull();
  });

  it('handles program without intensity in summary', () => {
    const program = createMockProgram({
      scopeEnforced: true,
      intensity: undefined,
    });

    const summary = getScopeSummary(program);

    expect(summary.intensity).toBeNull();
  });
});

// ============================================================================
// Enhanced Violation Response Tests
// ============================================================================

import {
  buildWorkstreamViolationResponse,
  buildConcurrencyViolationResponse,
  type ScopeViolationResponse,
} from '@/lib/os/programs/scopeGuard';

describe('Enhanced Violation Response', () => {
  describe('Workstream Violation Response', () => {
    it('includes error code', () => {
      const program = createScopeEnforcedProgram('Media', ['paid_media'], 4);

      const response = buildWorkstreamViolationResponse(program, 'seo', 'Not in scope');

      expect(response.code).toBe('WORKSTREAM_NOT_ALLOWED');
    });

    it('includes human-readable message', () => {
      const program = createScopeEnforcedProgram('Media', ['paid_media'], 4);

      const response = buildWorkstreamViolationResponse(program, 'seo', 'Not in scope');

      expect(response.message).toContain('SEO');
      expect(response.message).toContain('Paid Media');
    });

    it('includes blocked action details', () => {
      const program = createScopeEnforcedProgram('Media', ['paid_media'], 4);

      const response = buildWorkstreamViolationResponse(program, 'seo', 'Not in scope');

      expect(response.blockedAction.type).toBe('create_work');
      expect(response.blockedAction.description).toContain('SEO');
    });

    it('includes context with allowed workstreams', () => {
      const program = createScopeEnforcedProgram('Creative', ['content', 'brand'], 5);

      const response = buildWorkstreamViolationResponse(program, 'paid_media', 'Not in scope');

      expect(response.context.allowedWorkstreams).toContain('content');
      expect(response.context.allowedWorkstreams).toContain('brand');
      expect(response.context.allowedWorkstreamLabels).toContain('Content');
      expect(response.context.allowedWorkstreamLabels).toContain('Brand');
    });

    it('includes program context', () => {
      const program = createScopeEnforcedProgram('Media', ['paid_media'], 4);
      program.title = 'Test Media Program';

      const response = buildWorkstreamViolationResponse(program, 'seo', 'Not in scope');

      expect(response.context.programId).toBe(program.id);
      expect(response.context.programTitle).toBe('Test Media Program');
      expect(response.context.domain).toBe('Media');
      expect(response.context.intensity).toBe('Standard');
    });

    it('includes recommended actions', () => {
      const program = createScopeEnforcedProgram('Media', ['paid_media'], 4);

      const response = buildWorkstreamViolationResponse(program, 'seo', 'Not in scope');

      expect(response.recommendedActions.length).toBeGreaterThan(0);

      const actionIds = response.recommendedActions.map((a) => a.id);
      expect(actionIds).toContain('use_allowed_workstream');
      expect(actionIds).toContain('create_adhoc');
      expect(actionIds).toContain('request_expansion');
    });

    it('includes escalation markdown', () => {
      const program = createScopeEnforcedProgram('Media', ['paid_media'], 4);

      const response = buildWorkstreamViolationResponse(program, 'seo', 'Not in scope');

      expect(response.escalationMarkdown).toContain('Scope Escalation');
      expect(response.escalationMarkdown.length).toBeGreaterThan(50);
    });
  });

  describe('Concurrency Violation Response', () => {
    it('includes error code', () => {
      const program = createScopeEnforcedProgram('Creative', ['content'], 5);

      const response = buildConcurrencyViolationResponse(program, 5);

      expect(response.code).toBe('CONCURRENCY_LIMIT_REACHED');
    });

    it('includes human-readable message with counts', () => {
      const program = createScopeEnforcedProgram('Creative', ['content'], 5);

      const response = buildConcurrencyViolationResponse(program, 5);

      expect(response.message).toContain('5');
      expect(response.message).toContain('limit');
    });

    it('includes current count and limit in context', () => {
      const program = createScopeEnforcedProgram('Creative', ['content'], 8);

      const response = buildConcurrencyViolationResponse(program, 8);

      expect(response.context.currentCount).toBe(8);
      expect(response.context.limit).toBe(8);
    });

    it('includes recommended actions for concurrency', () => {
      const program = createScopeEnforcedProgram('Creative', ['content'], 5);

      const response = buildConcurrencyViolationResponse(program, 5);

      const actionIds = response.recommendedActions.map((a) => a.id);
      expect(actionIds).toContain('view_active_work');
      expect(actionIds).toContain('complete_work');
      expect(actionIds).toContain('archive_blocked');
      expect(actionIds).toContain('request_capacity');
    });

    it('includes escalation markdown', () => {
      const program = createScopeEnforcedProgram('Creative', ['content'], 5);

      const response = buildConcurrencyViolationResponse(program, 5);

      expect(response.escalationMarkdown).toContain('Concurrent Work Limit');
    });
  });

  describe('performScopeCheck returns violation response', () => {
    it('includes violation for workstream violations', () => {
      const program = createScopeEnforcedProgram('Media', ['paid_media'], 4);

      const result = performScopeCheck({
        program,
        proposedWorkstream: 'seo',
        currentActiveWorkCount: 0,
      });

      expect(result.allowed).toBe(false);
      expect(result.violation).toBeDefined();
      expect(result.violation?.code).toBe('WORKSTREAM_NOT_ALLOWED');
    });

    it('includes violation for concurrency violations', () => {
      const program = createScopeEnforcedProgram('Creative', ['content'], 3);

      const result = performScopeCheck({
        program,
        proposedWorkstream: 'content',
        currentActiveWorkCount: 3,
      });

      expect(result.allowed).toBe(false);
      expect(result.violation).toBeDefined();
      expect(result.violation?.code).toBe('CONCURRENCY_LIMIT_REACHED');
    });

    it('does not include violation when allowed', () => {
      const program = createScopeEnforcedProgram('Creative', ['content'], 5);

      const result = performScopeCheck({
        program,
        proposedWorkstream: 'content',
        currentActiveWorkCount: 2,
      });

      expect(result.allowed).toBe(true);
      expect(result.violation).toBeUndefined();
    });
  });

  describe('Recommended Action Structure', () => {
    it('each action has required fields', () => {
      const program = createScopeEnforcedProgram('Media', ['paid_media'], 4);

      const response = buildWorkstreamViolationResponse(program, 'seo', 'Not in scope');

      for (const action of response.recommendedActions) {
        expect(action.id).toBeDefined();
        expect(action.id.length).toBeGreaterThan(0);
        expect(action.label).toBeDefined();
        expect(action.label.length).toBeGreaterThan(0);
        expect(action.description).toBeDefined();
        expect(action.type).toBeDefined();
        expect(['primary', 'secondary', 'link']).toContain(action.type);
      }
    });

    it('has exactly one primary action', () => {
      const program = createScopeEnforcedProgram('Media', ['paid_media'], 4);

      const response = buildWorkstreamViolationResponse(program, 'seo', 'Not in scope');
      const primaryActions = response.recommendedActions.filter((a) => a.type === 'primary');

      expect(primaryActions).toHaveLength(1);
    });
  });
});
