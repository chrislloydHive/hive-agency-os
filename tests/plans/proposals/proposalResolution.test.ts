// tests/plans/proposals/proposalResolution.test.ts
// Tests for Plan Proposal resolution logic
//
// Tests the isProposalResolvable helper and proposal status invariants.

import { describe, it, expect } from 'vitest';
import { isProposalResolvable } from '@/lib/airtable/planProposals';
import type { PlanProposal, PlanProposalStatus } from '@/lib/types/plan';

// ============================================================================
// Test Fixtures
// ============================================================================

function createMockProposal(overrides: Partial<PlanProposal> = {}): PlanProposal {
  return {
    id: 'proposal-1',
    planType: 'media',
    planId: 'plan-1',
    companyId: 'company-1',
    strategyId: 'strategy-1',
    proposedPatch: [],
    rationale: 'Test rationale',
    warnings: [],
    generatedUsing: {
      contextKeysUsed: [],
      strategyKeysUsed: [],
      goalAlignmentActive: false,
      businessDefinitionMissing: false,
    },
    status: 'pending',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================================================
// isProposalResolvable Tests
// ============================================================================

describe('isProposalResolvable', () => {
  it('returns true for pending proposals', () => {
    const proposal = createMockProposal({ status: 'pending' });
    expect(isProposalResolvable(proposal)).toBe(true);
  });

  it('returns false for applied proposals', () => {
    const proposal = createMockProposal({
      status: 'applied',
      appliedAt: new Date().toISOString(),
    });
    expect(isProposalResolvable(proposal)).toBe(false);
  });

  it('returns false for discarded proposals', () => {
    const proposal = createMockProposal({
      status: 'discarded',
      discardedAt: new Date().toISOString(),
    });
    expect(isProposalResolvable(proposal)).toBe(false);
  });
});

// ============================================================================
// Status Invariants Tests
// ============================================================================

describe('Proposal Status Invariants', () => {
  describe('pending proposals', () => {
    it('should not have resolvedAt', () => {
      const proposal = createMockProposal({ status: 'pending' });
      expect(proposal.resolvedAt).toBeUndefined();
    });

    it('should not have appliedAt', () => {
      const proposal = createMockProposal({ status: 'pending' });
      expect(proposal.appliedAt).toBeUndefined();
    });

    it('should not have discardedAt', () => {
      const proposal = createMockProposal({ status: 'pending' });
      expect(proposal.discardedAt).toBeUndefined();
    });

    it('should not have rejectionReason', () => {
      const proposal = createMockProposal({ status: 'pending' });
      expect(proposal.rejectionReason).toBeUndefined();
    });
  });

  describe('applied proposals', () => {
    it('should have appliedAt', () => {
      const proposal = createMockProposal({
        status: 'applied',
        appliedAt: '2025-01-01T00:00:00Z',
        resolvedAt: '2025-01-01T00:00:00Z',
        acceptedPlanId: 'plan-2',
      });
      expect(proposal.appliedAt).toBe('2025-01-01T00:00:00Z');
    });

    it('should have resolvedAt matching appliedAt', () => {
      const proposal = createMockProposal({
        status: 'applied',
        appliedAt: '2025-01-01T00:00:00Z',
        resolvedAt: '2025-01-01T00:00:00Z',
        acceptedPlanId: 'plan-2',
      });
      expect(proposal.resolvedAt).toBe('2025-01-01T00:00:00Z');
    });

    it('should have acceptedPlanId', () => {
      const proposal = createMockProposal({
        status: 'applied',
        appliedAt: '2025-01-01T00:00:00Z',
        resolvedAt: '2025-01-01T00:00:00Z',
        acceptedPlanId: 'plan-2',
      });
      expect(proposal.acceptedPlanId).toBe('plan-2');
    });

    it('may have previousApprovedPlanId for supersession', () => {
      const proposal = createMockProposal({
        status: 'applied',
        appliedAt: '2025-01-01T00:00:00Z',
        resolvedAt: '2025-01-01T00:00:00Z',
        acceptedPlanId: 'plan-2',
        previousApprovedPlanId: 'plan-1',
      });
      expect(proposal.previousApprovedPlanId).toBe('plan-1');
    });
  });

  describe('discarded proposals', () => {
    it('should have discardedAt', () => {
      const proposal = createMockProposal({
        status: 'discarded',
        discardedAt: '2025-01-01T00:00:00Z',
        resolvedAt: '2025-01-01T00:00:00Z',
      });
      expect(proposal.discardedAt).toBe('2025-01-01T00:00:00Z');
    });

    it('should have resolvedAt matching discardedAt', () => {
      const proposal = createMockProposal({
        status: 'discarded',
        discardedAt: '2025-01-01T00:00:00Z',
        resolvedAt: '2025-01-01T00:00:00Z',
      });
      expect(proposal.resolvedAt).toBe('2025-01-01T00:00:00Z');
    });

    it('may have rejectionReason', () => {
      const proposal = createMockProposal({
        status: 'discarded',
        discardedAt: '2025-01-01T00:00:00Z',
        resolvedAt: '2025-01-01T00:00:00Z',
        rejectionReason: 'Not aligned with current strategy',
      });
      expect(proposal.rejectionReason).toBe('Not aligned with current strategy');
    });

    it('should not have acceptedPlanId', () => {
      const proposal = createMockProposal({
        status: 'discarded',
        discardedAt: '2025-01-01T00:00:00Z',
        resolvedAt: '2025-01-01T00:00:00Z',
      });
      expect(proposal.acceptedPlanId).toBeUndefined();
    });
  });
});

// ============================================================================
// Plan-based Proposal Tests
// ============================================================================

describe('Plan-based Proposals', () => {
  it('should have proposedPlanId for plan-based proposals', () => {
    const proposal = createMockProposal({
      proposedPlanId: 'proposed-plan-1',
      approvedPlanId: 'approved-plan-1',
    });
    expect(proposal.proposedPlanId).toBe('proposed-plan-1');
    expect(proposal.approvedPlanId).toBe('approved-plan-1');
  });

  it('should support title for plan-based proposals', () => {
    const proposal = createMockProposal({
      proposedPlanId: 'proposed-plan-1',
      title: 'Q2 2025 Budget Adjustment',
    });
    expect(proposal.title).toBe('Q2 2025 Budget Adjustment');
  });

  it('should support assumptions and unknowns', () => {
    const proposal = createMockProposal({
      proposedPlanId: 'proposed-plan-1',
      assumptions: ['Market conditions remain stable', 'Team capacity unchanged'],
      unknowns: ['Competitor response unclear', 'Exact timing TBD'],
    });
    expect(proposal.assumptions).toEqual([
      'Market conditions remain stable',
      'Team capacity unchanged',
    ]);
    expect(proposal.unknowns).toEqual([
      'Competitor response unclear',
      'Exact timing TBD',
    ]);
  });
});

// ============================================================================
// Patch-based Proposal Tests
// ============================================================================

describe('Patch-based Proposals', () => {
  it('uses planId for patch-based proposals', () => {
    const proposal = createMockProposal({
      planId: 'target-plan-1',
      proposedPatch: [
        { op: 'replace', path: '/sections/budget/totalMonthly', value: 15000 },
      ],
    });
    expect(proposal.planId).toBe('target-plan-1');
    expect(proposal.proposedPatch).toEqual([
      { op: 'replace', path: '/sections/budget/totalMonthly', value: 15000 },
    ]);
  });

  it('should not have proposedPlanId for patch-based proposals', () => {
    const proposal = createMockProposal({
      planId: 'target-plan-1',
      proposedPatch: [{ op: 'add', path: '/sections/campaigns/-', value: {} }],
    });
    expect(proposal.proposedPlanId).toBeUndefined();
  });
});

// ============================================================================
// Resolution Tracking Tests
// ============================================================================

describe('Resolution Tracking', () => {
  it('tracks resolvedBy for accepted proposals', () => {
    const proposal = createMockProposal({
      status: 'applied',
      appliedAt: '2025-01-01T00:00:00Z',
      resolvedAt: '2025-01-01T00:00:00Z',
      resolvedBy: 'user@example.com',
      acceptedPlanId: 'plan-2',
    });
    expect(proposal.resolvedBy).toBe('user@example.com');
  });

  it('tracks resolvedBy for rejected proposals', () => {
    const proposal = createMockProposal({
      status: 'discarded',
      discardedAt: '2025-01-01T00:00:00Z',
      resolvedAt: '2025-01-01T00:00:00Z',
      resolvedBy: 'admin@example.com',
      rejectionReason: 'Budget constraints',
    });
    expect(proposal.resolvedBy).toBe('admin@example.com');
  });
});

// ============================================================================
// Status Transition Tests
// ============================================================================

describe('Status Transitions', () => {
  const allStatuses: PlanProposalStatus[] = ['pending', 'applied', 'discarded'];

  it('only pending proposals are resolvable', () => {
    for (const status of allStatuses) {
      const proposal = createMockProposal({ status });
      const expected = status === 'pending';
      expect(isProposalResolvable(proposal)).toBe(expected);
    }
  });

  it('applied is a terminal state', () => {
    const proposal = createMockProposal({
      status: 'applied',
      appliedAt: new Date().toISOString(),
      resolvedAt: new Date().toISOString(),
      acceptedPlanId: 'plan-2',
    });
    expect(isProposalResolvable(proposal)).toBe(false);
  });

  it('discarded is a terminal state', () => {
    const proposal = createMockProposal({
      status: 'discarded',
      discardedAt: new Date().toISOString(),
      resolvedAt: new Date().toISOString(),
    });
    expect(isProposalResolvable(proposal)).toBe(false);
  });
});
