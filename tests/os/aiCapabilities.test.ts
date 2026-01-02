/**
 * Tests for AI Capabilities and Boundaries
 *
 * Covers:
 * - Capability level definitions (allowed, requires_approval, never_allowed)
 * - Action validation and permission checks
 * - Program-specific capability restrictions
 * - Capability lookups and summaries
 * - Never Allowed actions are blocked
 * - Approval-required actions return required approvals
 */

import { describe, it, expect } from 'vitest';
import {
  AI_CAPABILITIES,
  getCapability,
  isActionAllowed,
  requiresApproval,
  isNeverAllowed,
  getCapabilitiesByLevel,
  getCapabilitiesByScope,
  validateAction,
  canPerformActionOnProgram,
  getCapabilitySummary,
  toAICapabilityList,
  generateCapabilityInstructions,
  type CapabilityLevel,
  type CapabilityDefinition,
} from '@/lib/os/programs/aiCapabilities';
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

// ============================================================================
// Capability Definition Tests
// ============================================================================

describe('AI Capability Definitions', () => {
  describe('Allowed Capabilities', () => {
    const allowedCapabilities = [
      'draft_deliverables',
      'propose_optimizations',
      'summarize_learnings',
      'prepare_qbr_narrative',
      'analyze_performance',
      'suggest_kpis',
      'draft_work_items',
      'generate_brief',
    ];

    it.each(allowedCapabilities)('%s is defined as allowed', (capabilityId) => {
      const capability = getCapability(capabilityId);

      expect(capability).toBeDefined();
      expect(capability?.level).toBe('allowed');
    });

    it('has correct number of allowed capabilities', () => {
      const allowed = getCapabilitiesByLevel('allowed');
      expect(allowed).toHaveLength(8);
    });
  });

  describe('Requires Approval Capabilities', () => {
    const requiresApprovalCapabilities = [
      'create_work_item',
      'modify_scope',
      'update_status',
      'commit_program',
      'archive_program',
      'link_artifact',
      'publish_artifact',
    ];

    it.each(requiresApprovalCapabilities)('%s is defined as requires_approval', (capabilityId) => {
      const capability = getCapability(capabilityId);

      expect(capability).toBeDefined();
      expect(capability?.level).toBe('requires_approval');
    });

    it('has correct number of requires_approval capabilities', () => {
      const requiresApprovalCaps = getCapabilitiesByLevel('requires_approval');
      expect(requiresApprovalCaps).toHaveLength(7);
    });
  });

  describe('Never Allowed Capabilities', () => {
    const neverAllowedCapabilities = [
      'add_program',
      'change_pricing',
      'bypass_scope',
      'delete_program',
      'modify_template',
      'change_bundle',
      'access_financials',
    ];

    it.each(neverAllowedCapabilities)('%s is defined as never_allowed', (capabilityId) => {
      const capability = getCapability(capabilityId);

      expect(capability).toBeDefined();
      expect(capability?.level).toBe('never_allowed');
    });

    it('has correct number of never_allowed capabilities', () => {
      const neverAllowed = getCapabilitiesByLevel('never_allowed');
      expect(neverAllowed).toHaveLength(7);
    });
  });

  describe('All Capabilities', () => {
    it('has unique IDs', () => {
      const ids = AI_CAPABILITIES.map((c) => c.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('all have required fields', () => {
      for (const cap of AI_CAPABILITIES) {
        expect(cap.id).toBeDefined();
        expect(cap.name).toBeDefined();
        expect(cap.level).toBeDefined();
        expect(cap.description).toBeDefined();
        expect(cap.scope).toBeDefined();
        expect(['allowed', 'requires_approval', 'never_allowed']).toContain(cap.level);
        expect(['program', 'work', 'artifact', 'global']).toContain(cap.scope);
      }
    });
  });
});

// ============================================================================
// Action Permission Tests
// ============================================================================

describe('Action Permission Checks', () => {
  describe('isActionAllowed', () => {
    it('returns true for allowed actions', () => {
      expect(isActionAllowed('draft_deliverables')).toBe(true);
      expect(isActionAllowed('propose_optimizations')).toBe(true);
      expect(isActionAllowed('summarize_learnings')).toBe(true);
    });

    it('returns false for requires_approval actions', () => {
      expect(isActionAllowed('create_work_item')).toBe(false);
      expect(isActionAllowed('modify_scope')).toBe(false);
      expect(isActionAllowed('commit_program')).toBe(false);
    });

    it('returns false for never_allowed actions', () => {
      expect(isActionAllowed('add_program')).toBe(false);
      expect(isActionAllowed('change_pricing')).toBe(false);
      expect(isActionAllowed('bypass_scope')).toBe(false);
    });

    it('returns false for unknown actions', () => {
      expect(isActionAllowed('unknown_action')).toBe(false);
    });
  });

  describe('requiresApproval', () => {
    it('returns false for allowed actions', () => {
      expect(requiresApproval('draft_deliverables')).toBe(false);
      expect(requiresApproval('analyze_performance')).toBe(false);
    });

    it('returns true for requires_approval actions', () => {
      expect(requiresApproval('create_work_item')).toBe(true);
      expect(requiresApproval('modify_scope')).toBe(true);
      expect(requiresApproval('commit_program')).toBe(true);
      expect(requiresApproval('archive_program')).toBe(true);
    });

    it('returns false for never_allowed actions', () => {
      expect(requiresApproval('add_program')).toBe(false);
      expect(requiresApproval('change_pricing')).toBe(false);
    });

    it('returns false for unknown actions', () => {
      expect(requiresApproval('unknown_action')).toBe(false);
    });
  });

  describe('isNeverAllowed', () => {
    it('returns false for allowed actions', () => {
      expect(isNeverAllowed('draft_deliverables')).toBe(false);
      expect(isNeverAllowed('generate_brief')).toBe(false);
    });

    it('returns false for requires_approval actions', () => {
      expect(isNeverAllowed('create_work_item')).toBe(false);
      expect(isNeverAllowed('link_artifact')).toBe(false);
    });

    it('returns true for never_allowed actions', () => {
      expect(isNeverAllowed('add_program')).toBe(true);
      expect(isNeverAllowed('change_pricing')).toBe(true);
      expect(isNeverAllowed('bypass_scope')).toBe(true);
      expect(isNeverAllowed('delete_program')).toBe(true);
      expect(isNeverAllowed('modify_template')).toBe(true);
      expect(isNeverAllowed('change_bundle')).toBe(true);
      expect(isNeverAllowed('access_financials')).toBe(true);
    });

    it('returns false for unknown actions', () => {
      expect(isNeverAllowed('unknown_action')).toBe(false);
    });
  });
});

// ============================================================================
// Action Validation Tests
// ============================================================================

describe('validateAction', () => {
  describe('allowed actions', () => {
    it('returns allowed: true, requiresApproval: false', () => {
      const result = validateAction('draft_deliverables');

      expect(result.allowed).toBe(true);
      expect(result.requiresApproval).toBe(false);
      expect(result.reason).toBeUndefined();
      expect(result.capability).toBeDefined();
      expect(result.capability?.id).toBe('draft_deliverables');
    });
  });

  describe('requires_approval actions', () => {
    it('returns allowed: true, requiresApproval: true with reason', () => {
      const result = validateAction('create_work_item');

      expect(result.allowed).toBe(true);
      expect(result.requiresApproval).toBe(true);
      expect(result.reason).toContain('requires human approval');
      expect(result.capability?.id).toBe('create_work_item');
    });

    it('includes capability name in reason', () => {
      const result = validateAction('commit_program');

      expect(result.reason).toContain('Commit Program');
    });
  });

  describe('never_allowed actions', () => {
    it('returns allowed: false with reason', () => {
      const result = validateAction('change_pricing');

      expect(result.allowed).toBe(false);
      expect(result.requiresApproval).toBe(false);
      expect(result.reason).toContain('not permitted');
      expect(result.capability?.id).toBe('change_pricing');
    });

    it('blocks add_program', () => {
      const result = validateAction('add_program');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Add Program');
    });

    it('blocks bypass_scope', () => {
      const result = validateAction('bypass_scope');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Bypass Scope');
    });

    it('blocks access_financials', () => {
      const result = validateAction('access_financials');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Access Financials');
    });
  });

  describe('unknown actions', () => {
    it('returns allowed: false for unknown capability', () => {
      const result = validateAction('unknown_action');

      expect(result.allowed).toBe(false);
      expect(result.requiresApproval).toBe(false);
      expect(result.reason).toContain('Unknown capability');
      expect(result.capability).toBeUndefined();
    });
  });
});

// ============================================================================
// Program-Specific Capability Tests
// ============================================================================

describe('canPerformActionOnProgram', () => {
  describe('with draft programs', () => {
    it('allows all normally allowed actions', () => {
      const program = createMockProgram({ status: 'draft' });

      const result = canPerformActionOnProgram('draft_deliverables', program);

      expect(result.allowed).toBe(true);
      expect(result.requiresApproval).toBe(false);
    });

    it('allows requires_approval actions with approval flag', () => {
      const program = createMockProgram({ status: 'draft' });

      const result = canPerformActionOnProgram('modify_scope', program);

      expect(result.allowed).toBe(true);
      expect(result.requiresApproval).toBe(true);
    });

    it('still blocks never_allowed actions', () => {
      const program = createMockProgram({ status: 'draft' });

      const result = canPerformActionOnProgram('change_pricing', program);

      expect(result.allowed).toBe(false);
    });
  });

  describe('with ready programs', () => {
    it('allows scope modifications with approval', () => {
      const program = createMockProgram({ status: 'ready' });

      const result = canPerformActionOnProgram('modify_scope', program);

      expect(result.allowed).toBe(true);
      expect(result.requiresApproval).toBe(true);
    });
  });

  describe('with committed programs', () => {
    it('blocks modify_scope even with approval', () => {
      const program = createMockProgram({ status: 'committed' });

      const result = canPerformActionOnProgram('modify_scope', program);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('committed programs');
    });

    it('blocks update_status even with approval', () => {
      const program = createMockProgram({ status: 'committed' });

      const result = canPerformActionOnProgram('update_status', program);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('committed programs');
    });

    it('still allows draft_deliverables', () => {
      const program = createMockProgram({ status: 'committed' });

      const result = canPerformActionOnProgram('draft_deliverables', program);

      expect(result.allowed).toBe(true);
    });

    it('still allows create_work_item with approval', () => {
      const program = createMockProgram({ status: 'committed' });

      const result = canPerformActionOnProgram('create_work_item', program);

      expect(result.allowed).toBe(true);
      expect(result.requiresApproval).toBe(true);
    });
  });

  describe('with archived programs', () => {
    it('blocks all actions', () => {
      const program = createMockProgram({ status: 'archived' });

      const allowedAction = canPerformActionOnProgram('draft_deliverables', program);
      const approvalAction = canPerformActionOnProgram('create_work_item', program);

      expect(allowedAction.allowed).toBe(false);
      expect(allowedAction.reason).toContain('archived');
      expect(approvalAction.allowed).toBe(false);
      expect(approvalAction.reason).toContain('archived');
    });

    it('never_allowed actions remain blocked with same reason', () => {
      const program = createMockProgram({ status: 'archived' });

      const result = canPerformActionOnProgram('change_pricing', program);

      // Never allowed takes precedence, but archived check happens first
      expect(result.allowed).toBe(false);
    });
  });
});

// ============================================================================
// Capability Lookup Tests
// ============================================================================

describe('Capability Lookups', () => {
  describe('getCapability', () => {
    it('returns capability for valid ID', () => {
      const capability = getCapability('draft_deliverables');

      expect(capability).toBeDefined();
      expect(capability?.id).toBe('draft_deliverables');
      expect(capability?.name).toBe('Draft Deliverables');
    });

    it('returns undefined for invalid ID', () => {
      const capability = getCapability('nonexistent');

      expect(capability).toBeUndefined();
    });
  });

  describe('getCapabilitiesByLevel', () => {
    it('returns only capabilities at specified level', () => {
      const allowed = getCapabilitiesByLevel('allowed');
      const requiresApprovalCaps = getCapabilitiesByLevel('requires_approval');
      const neverAllowed = getCapabilitiesByLevel('never_allowed');

      for (const cap of allowed) {
        expect(cap.level).toBe('allowed');
      }
      for (const cap of requiresApprovalCaps) {
        expect(cap.level).toBe('requires_approval');
      }
      for (const cap of neverAllowed) {
        expect(cap.level).toBe('never_allowed');
      }
    });
  });

  describe('getCapabilitiesByScope', () => {
    it('returns only capabilities for specified scope', () => {
      const programCaps = getCapabilitiesByScope('program');
      const workCaps = getCapabilitiesByScope('work');
      const artifactCaps = getCapabilitiesByScope('artifact');
      const globalCaps = getCapabilitiesByScope('global');

      for (const cap of programCaps) {
        expect(cap.scope).toBe('program');
      }
      for (const cap of workCaps) {
        expect(cap.scope).toBe('work');
      }
      for (const cap of artifactCaps) {
        expect(cap.scope).toBe('artifact');
      }
      for (const cap of globalCaps) {
        expect(cap.scope).toBe('global');
      }
    });

    it('program scope includes expected capabilities', () => {
      const programCaps = getCapabilitiesByScope('program');
      const ids = programCaps.map((c) => c.id);

      expect(ids).toContain('draft_deliverables');
      expect(ids).toContain('modify_scope');
      expect(ids).toContain('bypass_scope');
    });

    it('global scope includes pricing restriction', () => {
      const globalCaps = getCapabilitiesByScope('global');
      const ids = globalCaps.map((c) => c.id);

      expect(ids).toContain('change_pricing');
      expect(ids).toContain('access_financials');
    });
  });
});

// ============================================================================
// Summary and Export Tests
// ============================================================================

describe('Capability Summary', () => {
  it('returns all three categories', () => {
    const summary = getCapabilitySummary();

    expect(summary.allowed).toBeDefined();
    expect(summary.requiresApproval).toBeDefined();
    expect(summary.neverAllowed).toBeDefined();
  });

  it('includes human-readable names', () => {
    const summary = getCapabilitySummary();

    expect(summary.allowed).toContain('Draft Deliverables');
    expect(summary.requiresApproval).toContain('Create Work Item');
    expect(summary.neverAllowed).toContain('Change Pricing');
  });

  it('totals match capability count', () => {
    const summary = getCapabilitySummary();
    const total = summary.allowed.length + summary.requiresApproval.length + summary.neverAllowed.length;

    expect(total).toBe(AI_CAPABILITIES.length);
  });
});

describe('toAICapabilityList', () => {
  it('converts all capabilities to API format', () => {
    const list = toAICapabilityList();

    expect(list).toHaveLength(AI_CAPABILITIES.length);
  });

  it('marks never_allowed as not allowed', () => {
    const list = toAICapabilityList();
    const changePricing = list.find((c) => c.id === 'change_pricing');

    expect(changePricing?.allowed).toBe(false);
    expect(changePricing?.requiresApproval).toBe(false);
  });

  it('marks requires_approval correctly', () => {
    const list = toAICapabilityList();
    const createWorkItem = list.find((c) => c.id === 'create_work_item');

    expect(createWorkItem?.allowed).toBe(true);
    expect(createWorkItem?.requiresApproval).toBe(true);
  });

  it('marks allowed correctly', () => {
    const list = toAICapabilityList();
    const draftDeliverables = list.find((c) => c.id === 'draft_deliverables');

    expect(draftDeliverables?.allowed).toBe(true);
    expect(draftDeliverables?.requiresApproval).toBe(false);
  });
});

// ============================================================================
// Prompt Generation Tests
// ============================================================================

describe('generateCapabilityInstructions', () => {
  it('generates non-empty instructions', () => {
    const instructions = generateCapabilityInstructions();

    expect(instructions.length).toBeGreaterThan(100);
  });

  it('includes section headers', () => {
    const instructions = generateCapabilityInstructions();

    expect(instructions).toContain('AI Capability Boundaries');
    expect(instructions).toContain('Actions You Can Perform Autonomously');
    expect(instructions).toContain('Actions Requiring Human Approval');
    expect(instructions).toContain('Actions You Must Never Perform');
  });

  it('includes never_allowed actions', () => {
    const instructions = generateCapabilityInstructions();

    expect(instructions).toContain('Change Pricing');
    expect(instructions).toContain('Bypass Scope');
    expect(instructions).toContain('Access Financials');
  });

  it('includes descriptions', () => {
    const instructions = generateCapabilityInstructions();

    expect(instructions).toContain('Modify any pricing or margin information');
    expect(instructions).toContain('Create work outside of scope-enforced programs');
  });
});

// ============================================================================
// Critical Security Tests
// ============================================================================

describe('Security Enforcement', () => {
  describe('Pricing Protection', () => {
    it('change_pricing is always blocked', () => {
      expect(isNeverAllowed('change_pricing')).toBe(true);

      const draftProgram = createMockProgram({ status: 'draft' });
      const result = canPerformActionOnProgram('change_pricing', draftProgram);
      expect(result.allowed).toBe(false);
    });

    it('access_financials is always blocked', () => {
      expect(isNeverAllowed('access_financials')).toBe(true);

      const draftProgram = createMockProgram({ status: 'draft' });
      const result = canPerformActionOnProgram('access_financials', draftProgram);
      expect(result.allowed).toBe(false);
    });
  });

  describe('Scope Protection', () => {
    it('bypass_scope is always blocked', () => {
      expect(isNeverAllowed('bypass_scope')).toBe(true);

      const draftProgram = createMockProgram({ status: 'draft' });
      const result = canPerformActionOnProgram('bypass_scope', draftProgram);
      expect(result.allowed).toBe(false);
    });
  });

  describe('Program Protection', () => {
    it('add_program is always blocked', () => {
      expect(isNeverAllowed('add_program')).toBe(true);
    });

    it('delete_program is always blocked', () => {
      expect(isNeverAllowed('delete_program')).toBe(true);
    });
  });

  describe('Template Protection', () => {
    it('modify_template is always blocked', () => {
      expect(isNeverAllowed('modify_template')).toBe(true);
    });

    it('change_bundle is always blocked', () => {
      expect(isNeverAllowed('change_bundle')).toBe(true);
    });
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('handles empty capability ID', () => {
    expect(getCapability('')).toBeUndefined();
    expect(isActionAllowed('')).toBe(false);
    expect(validateAction('').allowed).toBe(false);
  });

  it('handles whitespace capability ID', () => {
    expect(getCapability('  ')).toBeUndefined();
    expect(isActionAllowed('  ')).toBe(false);
  });

  it('handles case-sensitive IDs', () => {
    expect(getCapability('DRAFT_DELIVERABLES')).toBeUndefined();
    expect(getCapability('Draft_Deliverables')).toBeUndefined();
    expect(getCapability('draft_deliverables')).toBeDefined();
  });

  it('handles program with undefined status', () => {
    const program = createMockProgram();
    // @ts-expect-error Testing undefined status
    program.status = undefined;

    // Should not throw
    const result = canPerformActionOnProgram('draft_deliverables', program);
    expect(result).toBeDefined();
  });
});
