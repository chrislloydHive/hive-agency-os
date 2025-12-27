// tests/plans/archiveAndSupersession.test.ts
// Tests for Heavy Plan archive and supersession functionality

import { describe, it, expect } from 'vitest';
import {
  canTransition,
  isPlanEditable,
  isPlanLocked,
  isArchived,
  validatePlanForSubmit,
  validatePlanForApproval,
} from '@/lib/os/plans/planTransitions';
import {
  derivePlansState,
  getPlansUIState,
  type PlansDataInput,
} from '@/lib/os/ui/plansUiState';
import type { MediaPlan, ContentPlan, PlanStatus } from '@/lib/types/plan';
import { createDefaultMediaPlanSections, createDefaultContentPlanSections } from '@/lib/types/plan';

// ============================================================================
// Test Fixtures
// ============================================================================

function createMockMediaPlan(overrides: Partial<MediaPlan> = {}): MediaPlan {
  return {
    id: 'plan-1',
    companyId: 'company-1',
    strategyId: 'strategy-1',
    status: 'draft' as PlanStatus,
    version: 1,
    sourceSnapshot: {
      contextHash: 'abc123',
      strategyHash: 'def456',
      contextConfirmedAt: null,
      strategyLockedAt: null,
    },
    sections: {
      ...createDefaultMediaPlanSections(),
      summary: {
        goalStatement: 'Test goal',
        executiveSummary: 'Test summary',
        assumptions: [],
      },
      channelMix: [{ id: '1', channel: 'Google Ads', objective: 'Conversions', audience: 'Test', monthlyBudget: 1000, kpiTargets: {}, rationale: 'Test' }],
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createMockContentPlan(overrides: Partial<ContentPlan> = {}): ContentPlan {
  return {
    id: 'plan-2',
    companyId: 'company-1',
    strategyId: 'strategy-1',
    status: 'draft' as PlanStatus,
    version: 1,
    sourceSnapshot: {
      contextHash: 'abc123',
      strategyHash: 'def456',
      contextConfirmedAt: null,
      strategyLockedAt: null,
    },
    sections: {
      ...createDefaultContentPlanSections(),
      summary: {
        goalStatement: 'Test goal',
        editorialThesis: 'Test thesis',
        voiceGuidance: 'Test voice',
      },
      pillars: [{ id: '1', pillar: 'Test', why: 'Test', targetIntents: [], proofPoints: [] }],
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================================================
// Transition Tests
// ============================================================================

describe('canTransition', () => {
  describe('archived is terminal state', () => {
    it('cannot transition from archived to draft', () => {
      expect(canTransition('archived', 'draft')).toBe(false);
    });

    it('cannot transition from archived to in_review', () => {
      expect(canTransition('archived', 'in_review')).toBe(false);
    });

    it('cannot transition from archived to approved', () => {
      expect(canTransition('archived', 'approved')).toBe(false);
    });

    it('cannot transition from archived to archived', () => {
      expect(canTransition('archived', 'archived')).toBe(false);
    });
  });

  describe('can transition to archived from any active status', () => {
    it('can transition from draft to archived', () => {
      expect(canTransition('draft', 'archived')).toBe(true);
    });

    it('can transition from in_review to archived', () => {
      expect(canTransition('in_review', 'archived')).toBe(true);
    });

    it('can transition from approved to archived', () => {
      expect(canTransition('approved', 'archived')).toBe(true);
    });
  });
});

describe('isArchived', () => {
  it('returns true for archived status', () => {
    expect(isArchived('archived')).toBe(true);
  });

  it('returns false for draft status', () => {
    expect(isArchived('draft')).toBe(false);
  });

  it('returns false for in_review status', () => {
    expect(isArchived('in_review')).toBe(false);
  });

  it('returns false for approved status', () => {
    expect(isArchived('approved')).toBe(false);
  });
});

describe('isPlanEditable', () => {
  it('returns false for archived plans', () => {
    expect(isPlanEditable('archived')).toBe(false);
  });

  it('returns true for draft plans', () => {
    expect(isPlanEditable('draft')).toBe(true);
  });

  it('returns false for approved plans', () => {
    expect(isPlanEditable('approved')).toBe(false);
  });
});

describe('isPlanLocked', () => {
  it('returns true for archived plans', () => {
    expect(isPlanLocked('archived')).toBe(true);
  });

  it('returns true for approved plans', () => {
    expect(isPlanLocked('approved')).toBe(true);
  });

  it('returns false for draft plans', () => {
    expect(isPlanLocked('draft')).toBe(false);
  });

  it('returns false for in_review plans', () => {
    expect(isPlanLocked('in_review')).toBe(false);
  });
});

// ============================================================================
// Validation Tests
// ============================================================================

describe('validatePlanForSubmit', () => {
  it('rejects archived plans', () => {
    const archivedPlan = createMockMediaPlan({ status: 'archived' });
    const result = validatePlanForSubmit(archivedPlan);
    expect(result.valid).toBe(false);
    expect(result.issues).toContain('Cannot submit plan in archived status (must be draft)');
  });
});

describe('validatePlanForApproval', () => {
  it('rejects archived plans', () => {
    const archivedPlan = createMockMediaPlan({ status: 'archived' });
    const result = validatePlanForApproval(archivedPlan);
    expect(result.valid).toBe(false);
    expect(result.issues).toContain('Cannot approve plan in archived status (must be in_review)');
  });
});

// ============================================================================
// Selector Tests - Archived Plans
// ============================================================================

describe('derivePlansState with archived plans', () => {
  it('treats archived-only plans as ready_no_plans', () => {
    const input: PlansDataInput = {
      strategyId: 'strategy-1',
      mediaPlan: createMockMediaPlan({ status: 'archived' }),
      contentPlan: null,
    };
    expect(derivePlansState(input)).toBe('ready_no_plans');
  });

  it('ignores archived plans when other active plans exist', () => {
    const input: PlansDataInput = {
      strategyId: 'strategy-1',
      mediaPlan: createMockMediaPlan({ status: 'archived' }),
      contentPlan: createMockContentPlan({ status: 'draft' }),
    };
    expect(derivePlansState(input)).toBe('plans_drafting');
  });

  it('shows plans_approved when one plan is approved and the other is archived', () => {
    const input: PlansDataInput = {
      strategyId: 'strategy-1',
      mediaPlan: createMockMediaPlan({ status: 'approved' }),
      contentPlan: createMockContentPlan({ status: 'archived' }),
    };
    expect(derivePlansState(input)).toBe('plans_approved');
  });
});

describe('getPlansUIState with archived plans', () => {
  const companyId = 'company-1';

  it('includes archived plan in summary', () => {
    const archivedPlan = createMockMediaPlan({
      status: 'archived',
      archivedAt: '2025-01-01T00:00:00Z',
      archivedReason: 'Superseded by v2',
      supersededByPlanId: 'plan-2',
    });

    const input: PlansDataInput = {
      strategyId: 'strategy-1',
      mediaPlan: archivedPlan,
      contentPlan: null,
    };

    const uiState = getPlansUIState(input, companyId);

    expect(uiState.mediaPlan).not.toBeNull();
    expect(uiState.mediaPlan?.status).toBe('archived');
    expect(uiState.mediaPlan?.archivedAt).toBe('2025-01-01T00:00:00Z');
    expect(uiState.mediaPlan?.archivedReason).toBe('Superseded by v2');
    expect(uiState.mediaPlan?.supersededByPlanId).toBe('plan-2');
  });

  it('allows creating new plan when only archived plans exist', () => {
    const input: PlansDataInput = {
      strategyId: 'strategy-1',
      mediaPlan: createMockMediaPlan({ status: 'archived' }),
      contentPlan: null,
    };

    const uiState = getPlansUIState(input, companyId);

    // Should show ready state since archived plans don't count as active
    expect(uiState.state).toBe('ready_no_plans');
  });
});

// ============================================================================
// Supersession Tests
// ============================================================================

describe('Plan Supersession', () => {
  it('tracks supersession links on plans', () => {
    const oldPlan = createMockMediaPlan({
      id: 'old-plan',
      status: 'archived',
      archivedReason: 'Superseded by v2',
      supersededByPlanId: 'new-plan',
    });

    const newPlan = createMockMediaPlan({
      id: 'new-plan',
      status: 'approved',
      version: 2,
      supersedesPlanId: 'old-plan',
    });

    expect(oldPlan.supersededByPlanId).toBe('new-plan');
    expect(newPlan.supersedesPlanId).toBe('old-plan');
  });

  it('includes supersession info in PlanSummary', () => {
    const plan = createMockMediaPlan({
      status: 'archived',
      supersededByPlanId: 'new-plan',
      archivedReason: 'Superseded by v2',
    });

    const input: PlansDataInput = {
      strategyId: 'strategy-1',
      mediaPlan: plan,
      contentPlan: null,
    };

    const uiState = getPlansUIState(input, 'company-1');

    expect(uiState.mediaPlan?.supersededByPlanId).toBe('new-plan');
    expect(uiState.mediaPlan?.archivedReason).toBe('Superseded by v2');
  });
});

// ============================================================================
// Immutability Tests
// ============================================================================

describe('Archived Plan Immutability', () => {
  it('archived plans are not editable', () => {
    expect(isPlanEditable('archived')).toBe(false);
  });

  it('archived plans are locked', () => {
    expect(isPlanLocked('archived')).toBe(true);
  });

  it('cannot transition archived plans to any other status', () => {
    const statuses: PlanStatus[] = ['draft', 'in_review', 'approved', 'archived'];

    for (const status of statuses) {
      expect(canTransition('archived', status)).toBe(false);
    }
  });

  it('archived status is correctly identified', () => {
    expect(isArchived('archived')).toBe(true);
    expect(isArchived('draft')).toBe(false);
    expect(isArchived('in_review')).toBe(false);
    expect(isArchived('approved')).toBe(false);
  });
});

// ============================================================================
// Edge Case Tests
// ============================================================================

describe('Edge Cases', () => {
  it('handles both plans being archived', () => {
    const input: PlansDataInput = {
      strategyId: 'strategy-1',
      mediaPlan: createMockMediaPlan({ status: 'archived' }),
      contentPlan: createMockContentPlan({ status: 'archived' }),
    };

    const state = derivePlansState(input);
    expect(state).toBe('ready_no_plans');
  });

  it('handles mix of active and archived plans', () => {
    const input: PlansDataInput = {
      strategyId: 'strategy-1',
      mediaPlan: createMockMediaPlan({ status: 'in_review' }),
      contentPlan: createMockContentPlan({ status: 'archived' }),
    };

    const state = derivePlansState(input);
    expect(state).toBe('plans_in_review');
  });

  it('does not show staleness for archived plans', () => {
    const input: PlansDataInput = {
      strategyId: 'strategy-1',
      mediaPlan: createMockMediaPlan({ status: 'archived' }),
      contentPlan: null,
      mediaPlanStale: true,
      mediaPlanStalenessReason: 'Context changed',
    };

    // Archived plans don't affect staleness state since they're not active
    const state = derivePlansState(input);
    expect(state).toBe('ready_no_plans');
    expect(state).not.toBe('plans_stale');
  });
});
