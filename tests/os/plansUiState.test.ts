// tests/os/plansUiState.test.ts
// Unit tests for Plans UI state selector

import { describe, it, expect } from 'vitest';
import {
  getPlansUIState,
  derivePlansState,
  shouldShowPlansSection,
  getPlansStatusSummary,
  type PlansDataInput,
} from '@/lib/os/ui/plansUiState';
import type { MediaPlan, ContentPlan } from '@/lib/types/plan';

// ============================================================================
// Test Fixtures
// ============================================================================

function makeMediaPlan(status: MediaPlan['status'] = 'draft'): MediaPlan {
  return {
    id: 'mp-1',
    companyId: 'test-company',
    strategyId: 'strat-1',
    status,
    version: 1,
    sourceSnapshot: {
      contextHash: 'ctx-hash',
      strategyHash: 'strat-hash',
      contextConfirmedAt: null,
      strategyLockedAt: null,
    },
    sections: {} as MediaPlan['sections'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function makeContentPlan(status: ContentPlan['status'] = 'draft'): ContentPlan {
  return {
    id: 'cp-1',
    companyId: 'test-company',
    strategyId: 'strat-1',
    status,
    version: 1,
    sourceSnapshot: {
      contextHash: 'ctx-hash',
      strategyHash: 'strat-hash',
      contextConfirmedAt: null,
      strategyLockedAt: null,
    },
    sections: {} as ContentPlan['sections'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function makeInput(overrides: Partial<PlansDataInput> = {}): PlansDataInput {
  return {
    strategyId: 'strat-1',
    mediaPlan: null,
    contentPlan: null,
    mediaPlanStale: false,
    contentPlanStale: false,
    mediaPlanStalenessReason: null,
    contentPlanStalenessReason: null,
    mediaPlanPendingProposals: 0,
    contentPlanPendingProposals: 0,
    ...overrides,
  };
}

// ============================================================================
// derivePlansState Tests
// ============================================================================

describe('derivePlansState', () => {
  describe('blocked_no_strategy state', () => {
    it('returns blocked_no_strategy when no strategy exists', () => {
      const input = makeInput({ strategyId: null });
      expect(derivePlansState(input)).toBe('blocked_no_strategy');
    });
  });

  describe('ready_no_plans state', () => {
    it('returns ready_no_plans when strategy exists but no plans', () => {
      const input = makeInput();
      expect(derivePlansState(input)).toBe('ready_no_plans');
    });

    it('returns ready_no_plans when only archived plans exist', () => {
      const input = makeInput({
        mediaPlan: makeMediaPlan('archived'),
      });
      expect(derivePlansState(input)).toBe('ready_no_plans');
    });
  });

  describe('plans_drafting state', () => {
    it('returns plans_drafting when media plan is draft', () => {
      const input = makeInput({ mediaPlan: makeMediaPlan('draft') });
      expect(derivePlansState(input)).toBe('plans_drafting');
    });

    it('returns plans_drafting when content plan is draft', () => {
      const input = makeInput({ contentPlan: makeContentPlan('draft') });
      expect(derivePlansState(input)).toBe('plans_drafting');
    });

    it('prioritizes draft over approved', () => {
      const input = makeInput({
        mediaPlan: makeMediaPlan('approved'),
        contentPlan: makeContentPlan('draft'),
      });
      expect(derivePlansState(input)).toBe('plans_drafting');
    });
  });

  describe('plans_in_review state', () => {
    it('returns plans_in_review when media plan is in_review', () => {
      const input = makeInput({ mediaPlan: makeMediaPlan('in_review') });
      expect(derivePlansState(input)).toBe('plans_in_review');
    });

    it('prioritizes in_review over approved', () => {
      const input = makeInput({
        mediaPlan: makeMediaPlan('approved'),
        contentPlan: makeContentPlan('in_review'),
      });
      expect(derivePlansState(input)).toBe('plans_in_review');
    });

    it('prioritizes draft over in_review', () => {
      const input = makeInput({
        mediaPlan: makeMediaPlan('draft'),
        contentPlan: makeContentPlan('in_review'),
      });
      expect(derivePlansState(input)).toBe('plans_drafting');
    });
  });

  describe('plans_approved state', () => {
    it('returns plans_approved when media plan is approved', () => {
      const input = makeInput({
        mediaPlan: makeMediaPlan('approved'),
        mediaPlanStale: false,
      });
      expect(derivePlansState(input)).toBe('plans_approved');
    });

    it('returns plans_approved when both plans are approved', () => {
      const input = makeInput({
        mediaPlan: makeMediaPlan('approved'),
        contentPlan: makeContentPlan('approved'),
        mediaPlanStale: false,
        contentPlanStale: false,
      });
      expect(derivePlansState(input)).toBe('plans_approved');
    });
  });

  describe('plans_stale state', () => {
    it('returns plans_stale when approved media plan is stale', () => {
      const input = makeInput({
        mediaPlan: makeMediaPlan('approved'),
        mediaPlanStale: true,
      });
      expect(derivePlansState(input)).toBe('plans_stale');
    });

    it('returns plans_stale when approved content plan is stale', () => {
      const input = makeInput({
        contentPlan: makeContentPlan('approved'),
        contentPlanStale: true,
      });
      expect(derivePlansState(input)).toBe('plans_stale');
    });

    it('does not return stale for draft plans', () => {
      const input = makeInput({
        mediaPlan: makeMediaPlan('draft'),
        mediaPlanStale: true, // Ignored because plan is draft
      });
      expect(derivePlansState(input)).toBe('plans_drafting');
    });
  });
});

// ============================================================================
// getPlansUIState Tests
// ============================================================================

describe('getPlansUIState', () => {
  const companyId = 'test-company';

  describe('plan summaries', () => {
    it('returns null mediaPlan when no media plan', () => {
      const input = makeInput();
      const uiState = getPlansUIState(input, companyId);
      expect(uiState.mediaPlan).toBeNull();
    });

    it('returns mediaPlan summary when plan exists', () => {
      const input = makeInput({ mediaPlan: makeMediaPlan('draft') });
      const uiState = getPlansUIState(input, companyId);
      expect(uiState.mediaPlan).not.toBeNull();
      expect(uiState.mediaPlan?.type).toBe('media');
      expect(uiState.mediaPlan?.status).toBe('draft');
    });

    it('includes staleness info in summary', () => {
      const input = makeInput({
        mediaPlan: makeMediaPlan('approved'),
        mediaPlanStale: true,
        mediaPlanStalenessReason: 'Context changed',
      });
      const uiState = getPlansUIState(input, companyId);
      expect(uiState.mediaPlan?.isStale).toBe(true);
      expect(uiState.mediaPlan?.stalenessReason).toBe('Context changed');
    });
  });

  describe('visibility flags', () => {
    it('hides plan cards when no strategy', () => {
      const input = makeInput({ strategyId: null });
      const uiState = getPlansUIState(input, companyId);
      expect(uiState.showPlanCards).toBe(false);
    });

    it('shows plan cards when strategy exists', () => {
      const input = makeInput();
      const uiState = getPlansUIState(input, companyId);
      expect(uiState.showPlanCards).toBe(true);
    });

    it('shows create media plan when no media plan', () => {
      const input = makeInput();
      const uiState = getPlansUIState(input, companyId);
      expect(uiState.showCreateMediaPlan).toBe(true);
    });

    it('hides create media plan when media plan exists', () => {
      const input = makeInput({ mediaPlan: makeMediaPlan('draft') });
      const uiState = getPlansUIState(input, companyId);
      expect(uiState.showCreateMediaPlan).toBe(false);
    });
  });

  describe('primaryCTA', () => {
    it('links to strategy when blocked', () => {
      const input = makeInput({ strategyId: null });
      const uiState = getPlansUIState(input, companyId);
      expect(uiState.primaryCTA.label).toBe('Go to Strategy');
      expect(uiState.primaryCTA.href).toContain('/strategy');
    });

    it('links to create media plan when ready and no plans', () => {
      const input = makeInput();
      const uiState = getPlansUIState(input, companyId);
      expect(uiState.primaryCTA.label).toBe('Create Media Plan');
      expect(uiState.primaryCTA.href).toContain('/media-plan');
    });

    it('links to draft plan when drafting', () => {
      const input = makeInput({ mediaPlan: makeMediaPlan('draft') });
      const uiState = getPlansUIState(input, companyId);
      expect(uiState.primaryCTA.label).toBe('Continue Media Plan');
    });

    it('links to plan in review when in_review', () => {
      const input = makeInput({ contentPlan: makeContentPlan('in_review') });
      const uiState = getPlansUIState(input, companyId);
      expect(uiState.primaryCTA.label).toBe('Review Content Plan');
    });

    it('links to stale plan when plans are stale', () => {
      const input = makeInput({
        mediaPlan: makeMediaPlan('approved'),
        mediaPlanStale: true,
      });
      const uiState = getPlansUIState(input, companyId);
      expect(uiState.primaryCTA.label).toBe('Update Media Plan');
    });
  });

  describe('secondaryCTA', () => {
    it('offers create content plan when ready and no plans', () => {
      const input = makeInput();
      const uiState = getPlansUIState(input, companyId);
      expect(uiState.secondaryCTA?.label).toBe('Create Content Plan');
    });

    it('offers create media plan when only content plan exists', () => {
      const input = makeInput({ contentPlan: makeContentPlan('draft') });
      const uiState = getPlansUIState(input, companyId);
      expect(uiState.secondaryCTA?.label).toBe('Create Media Plan');
    });

    it('is null when both plans exist', () => {
      const input = makeInput({
        mediaPlan: makeMediaPlan('draft'),
        contentPlan: makeContentPlan('draft'),
      });
      const uiState = getPlansUIState(input, companyId);
      expect(uiState.secondaryCTA).toBeNull();
    });

    it('is null when blocked', () => {
      const input = makeInput({ strategyId: null });
      const uiState = getPlansUIState(input, companyId);
      expect(uiState.secondaryCTA).toBeNull();
    });
  });

  describe('banner', () => {
    it('shows blocked tone when no strategy', () => {
      const input = makeInput({ strategyId: null });
      const uiState = getPlansUIState(input, companyId);
      expect(uiState.banner.tone).toBe('blocked');
    });

    it('shows ready tone when ready to create', () => {
      const input = makeInput();
      const uiState = getPlansUIState(input, companyId);
      expect(uiState.banner.tone).toBe('ready');
    });

    it('shows warning tone when plans stale', () => {
      const input = makeInput({
        mediaPlan: makeMediaPlan('approved'),
        mediaPlanStale: true,
      });
      const uiState = getPlansUIState(input, companyId);
      expect(uiState.banner.tone).toBe('warning');
    });

    it('shows warning tone when plans in review', () => {
      const input = makeInput({ mediaPlan: makeMediaPlan('in_review') });
      const uiState = getPlansUIState(input, companyId);
      expect(uiState.banner.tone).toBe('warning');
    });

    it('shows status tone when plans approved', () => {
      const input = makeInput({
        mediaPlan: makeMediaPlan('approved'),
        mediaPlanStale: false,
      });
      const uiState = getPlansUIState(input, companyId);
      expect(uiState.banner.tone).toBe('status');
    });
  });
});

// ============================================================================
// shouldShowPlansSection Tests
// ============================================================================

describe('shouldShowPlansSection', () => {
  it('returns false when no strategy', () => {
    const input = makeInput({ strategyId: null });
    expect(shouldShowPlansSection(input)).toBe(false);
  });

  it('returns true when strategy exists', () => {
    const input = makeInput();
    expect(shouldShowPlansSection(input)).toBe(true);
  });
});

// ============================================================================
// getPlansStatusSummary Tests
// ============================================================================

describe('getPlansStatusSummary', () => {
  const companyId = 'test';

  it('returns "Requires strategy" for blocked_no_strategy', () => {
    const input = makeInput({ strategyId: null });
    const uiState = getPlansUIState(input, companyId);
    expect(getPlansStatusSummary(uiState)).toBe('Requires strategy');
  });

  it('returns "No plans created" for ready_no_plans', () => {
    const input = makeInput();
    const uiState = getPlansUIState(input, companyId);
    expect(getPlansStatusSummary(uiState)).toBe('No plans created');
  });

  it('returns "Drafts in progress" for plans_drafting', () => {
    const input = makeInput({ mediaPlan: makeMediaPlan('draft') });
    const uiState = getPlansUIState(input, companyId);
    expect(getPlansStatusSummary(uiState)).toBe('Drafts in progress');
  });

  it('returns "Awaiting approval" for plans_in_review', () => {
    const input = makeInput({ mediaPlan: makeMediaPlan('in_review') });
    const uiState = getPlansUIState(input, companyId);
    expect(getPlansStatusSummary(uiState)).toBe('Awaiting approval');
  });

  it('returns "All plans approved" for plans_approved', () => {
    const input = makeInput({
      mediaPlan: makeMediaPlan('approved'),
      mediaPlanStale: false,
    });
    const uiState = getPlansUIState(input, companyId);
    expect(getPlansStatusSummary(uiState)).toBe('All plans approved');
  });

  it('returns "Updates available" for plans_stale', () => {
    const input = makeInput({
      mediaPlan: makeMediaPlan('approved'),
      mediaPlanStale: true,
    });
    const uiState = getPlansUIState(input, companyId);
    expect(getPlansStatusSummary(uiState)).toBe('Updates available');
  });
});

// ============================================================================
// Invariant Tests
// ============================================================================

describe('invariants', () => {
  it('blocked state never shows create buttons', () => {
    const input = makeInput({ strategyId: null });
    const uiState = getPlansUIState(input, 'test');
    expect(uiState.showCreateMediaPlan).toBe(false);
    expect(uiState.showCreateContentPlan).toBe(false);
  });

  it('plan summary includes correct type', () => {
    const input = makeInput({
      mediaPlan: makeMediaPlan('draft'),
      contentPlan: makeContentPlan('approved'),
    });
    const uiState = getPlansUIState(input, 'test');
    expect(uiState.mediaPlan?.type).toBe('media');
    expect(uiState.contentPlan?.type).toBe('content');
  });
});
