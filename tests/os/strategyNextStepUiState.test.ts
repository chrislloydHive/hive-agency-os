// tests/os/strategyNextStepUiState.test.ts
// Unit tests for Strategy Next Step UI state selector

import { describe, it, expect } from 'vitest';
import {
  getStrategyNextStepUIState,
  deriveStrategyNextStepState,
  canCreatePlans,
  getNextStepStatusSummary,
  type StrategyNextStepDataInput,
} from '@/lib/os/ui/strategyNextStepUiState';
import type { V4HealthResponse } from '@/lib/types/contextV4Health';
import type { MediaPlan, ContentPlan } from '@/lib/types/plan';

// ============================================================================
// Test Fixtures
// ============================================================================

function makeHealth(confirmedCount: number): V4HealthResponse {
  return {
    healthVersion: 1,
    companyId: 'test',
    timestamp: new Date().toISOString(),
    status: 'GREEN',
    reasons: [],
    flags: { CONTEXT_V4_ENABLED: true, CONTEXT_V4_INGEST_WEBSITELAB: true },
    websiteLab: { hasRun: true, lastRunAt: null, runId: null, diagnosticId: null },
    propose: { lastRunAt: null, candidatesCount: 0, outcome: null },
    store: { confirmed: confirmedCount, pending: 0, total: 10 },
    links: { proposeEndpoint: '', reviewQueue: '' },
  } as unknown as V4HealthResponse;
}

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

function makeInput(overrides: Partial<StrategyNextStepDataInput> = {}): StrategyNextStepDataInput {
  return {
    contextHealth: makeHealth(5),
    strategyId: 'strat-1',
    strategyLocked: false,
    acceptedBetsCount: 2,
    objectivesCount: 3,
    mediaPlan: null,
    contentPlan: null,
    hasBudgetInContext: false,
    hasChannelsInContext: false,
    hasSEOLabRun: false,
    hasContentBets: false,
    hasPaidChannelBets: false,
    ...overrides,
  };
}

// ============================================================================
// deriveStrategyNextStepState Tests
// ============================================================================

describe('deriveStrategyNextStepState', () => {
  describe('context_incomplete state', () => {
    it('returns context_incomplete when confirmed count is below threshold', () => {
      const input = makeInput({ contextHealth: makeHealth(2) });
      expect(deriveStrategyNextStepState(input)).toBe('context_incomplete');
    });

    it('returns context_incomplete when contextHealth is null', () => {
      const input = makeInput({ contextHealth: null });
      expect(deriveStrategyNextStepState(input)).toBe('context_incomplete');
    });
  });

  describe('strategy_incomplete state', () => {
    it('returns strategy_incomplete when no strategy exists', () => {
      const input = makeInput({ strategyId: null });
      expect(deriveStrategyNextStepState(input)).toBe('strategy_incomplete');
    });

    it('returns strategy_incomplete when no bets accepted', () => {
      const input = makeInput({ acceptedBetsCount: 0 });
      expect(deriveStrategyNextStepState(input)).toBe('strategy_incomplete');
    });
  });

  describe('ready_for_plans state', () => {
    it('returns ready_for_plans when context and strategy complete, no plans', () => {
      const input = makeInput();
      expect(deriveStrategyNextStepState(input)).toBe('ready_for_plans');
    });
  });

  describe('plans_in_progress state', () => {
    it('returns plans_in_progress when media plan is draft', () => {
      const input = makeInput({ mediaPlan: makeMediaPlan('draft') });
      expect(deriveStrategyNextStepState(input)).toBe('plans_in_progress');
    });

    it('returns plans_in_progress when content plan is in_review', () => {
      const input = makeInput({ contentPlan: makeContentPlan('in_review') });
      expect(deriveStrategyNextStepState(input)).toBe('plans_in_progress');
    });

    it('returns plans_in_progress when one plan approved, one draft', () => {
      const input = makeInput({
        mediaPlan: makeMediaPlan('approved'),
        contentPlan: makeContentPlan('draft'),
      });
      expect(deriveStrategyNextStepState(input)).toBe('plans_in_progress');
    });
  });

  describe('plans_complete state', () => {
    it('returns plans_complete when media plan is approved', () => {
      const input = makeInput({ mediaPlan: makeMediaPlan('approved') });
      expect(deriveStrategyNextStepState(input)).toBe('plans_complete');
    });

    it('returns plans_complete when both plans are approved', () => {
      const input = makeInput({
        mediaPlan: makeMediaPlan('approved'),
        contentPlan: makeContentPlan('approved'),
      });
      expect(deriveStrategyNextStepState(input)).toBe('plans_complete');
    });
  });
});

// ============================================================================
// getStrategyNextStepUIState Tests
// ============================================================================

describe('getStrategyNextStepUIState', () => {
  const companyId = 'test-company';

  describe('isDecideComplete', () => {
    it('is false when context incomplete', () => {
      const input = makeInput({ contextHealth: makeHealth(1) });
      const uiState = getStrategyNextStepUIState(input, companyId);
      expect(uiState.isDecideComplete).toBe(false);
    });

    it('is false when strategy incomplete', () => {
      const input = makeInput({ strategyId: null });
      const uiState = getStrategyNextStepUIState(input, companyId);
      expect(uiState.isDecideComplete).toBe(false);
    });

    it('is true when ready_for_plans', () => {
      const input = makeInput();
      const uiState = getStrategyNextStepUIState(input, companyId);
      expect(uiState.isDecideComplete).toBe(true);
    });
  });

  describe('recommendedPlans', () => {
    it('recommends media plan with high priority when budget present', () => {
      const input = makeInput({ hasBudgetInContext: true });
      const uiState = getStrategyNextStepUIState(input, companyId);
      expect(uiState.recommendedPlans.media?.recommended).toBe(true);
      expect(uiState.recommendedPlans.media?.priority).toBe('high');
    });

    it('recommends content plan with high priority when SEO lab run', () => {
      const input = makeInput({ hasSEOLabRun: true });
      const uiState = getStrategyNextStepUIState(input, companyId);
      expect(uiState.recommendedPlans.content?.recommended).toBe(true);
      expect(uiState.recommendedPlans.content?.priority).toBe('high');
    });

    it('returns null for media recommendation when plan already exists', () => {
      const input = makeInput({ mediaPlan: makeMediaPlan('draft') });
      const uiState = getStrategyNextStepUIState(input, companyId);
      expect(uiState.recommendedPlans.media).toBeNull();
    });
  });

  describe('primaryCTA', () => {
    it('links to decide when context incomplete', () => {
      const input = makeInput({ contextHealth: makeHealth(1) });
      const uiState = getStrategyNextStepUIState(input, companyId);
      expect(uiState.primaryCTA.label).toBe('Confirm Context');
      expect(uiState.primaryCTA.href).toContain('/decide');
    });

    it('links to strategy when strategy incomplete', () => {
      const input = makeInput({ strategyId: null });
      const uiState = getStrategyNextStepUIState(input, companyId);
      expect(uiState.primaryCTA.label).toBe('Complete Strategy');
      expect(uiState.primaryCTA.href).toContain('/strategy');
    });

    it('links to media plan when budget present and ready', () => {
      const input = makeInput({ hasBudgetInContext: true });
      const uiState = getStrategyNextStepUIState(input, companyId);
      expect(uiState.primaryCTA.label).toBe('Create Media Plan');
      expect(uiState.primaryCTA.href).toContain('/media-plan');
    });

    it('links to deliver when plans in progress', () => {
      const input = makeInput({ mediaPlan: makeMediaPlan('draft') });
      const uiState = getStrategyNextStepUIState(input, companyId);
      expect(uiState.primaryCTA.label).toBe('Continue Plans');
    });
  });

  describe('secondaryCTAs', () => {
    it('includes create media plan when ready and no media plan', () => {
      const input = makeInput();
      const uiState = getStrategyNextStepUIState(input, companyId);
      const hasCTA = uiState.secondaryCTAs.some(c => c.label.includes('Media Plan'));
      expect(hasCTA).toBe(true);
    });

    it('includes create content plan when ready and no content plan', () => {
      const input = makeInput();
      const uiState = getStrategyNextStepUIState(input, companyId);
      const hasCTA = uiState.secondaryCTAs.some(c => c.label.includes('Content Plan'));
      expect(hasCTA).toBe(true);
    });

    it('is empty when context incomplete', () => {
      const input = makeInput({ contextHealth: makeHealth(1) });
      const uiState = getStrategyNextStepUIState(input, companyId);
      expect(uiState.secondaryCTAs).toHaveLength(0);
    });
  });

  describe('blockingReasons', () => {
    it('includes context message when context incomplete', () => {
      const input = makeInput({ contextHealth: makeHealth(2) });
      const uiState = getStrategyNextStepUIState(input, companyId);
      expect(uiState.blockingReasons[0]).toContain('context fields');
    });

    it('includes strategy message when no strategy', () => {
      const input = makeInput({ strategyId: null });
      const uiState = getStrategyNextStepUIState(input, companyId);
      expect(uiState.blockingReasons[0]).toContain('strategy');
    });

    it('includes bet message when no bets accepted', () => {
      const input = makeInput({ acceptedBetsCount: 0 });
      const uiState = getStrategyNextStepUIState(input, companyId);
      expect(uiState.blockingReasons[0]).toContain('bet');
    });

    it('is empty when ready for plans', () => {
      const input = makeInput();
      const uiState = getStrategyNextStepUIState(input, companyId);
      expect(uiState.blockingReasons).toHaveLength(0);
    });
  });

  describe('showNextStepPanel', () => {
    it('is false when context incomplete', () => {
      const input = makeInput({ contextHealth: makeHealth(1) });
      const uiState = getStrategyNextStepUIState(input, companyId);
      expect(uiState.showNextStepPanel).toBe(false);
    });

    it('is true when ready for plans', () => {
      const input = makeInput();
      const uiState = getStrategyNextStepUIState(input, companyId);
      expect(uiState.showNextStepPanel).toBe(true);
    });
  });
});

// ============================================================================
// canCreatePlans Tests
// ============================================================================

describe('canCreatePlans', () => {
  it('returns false when context incomplete', () => {
    const input = makeInput({ contextHealth: makeHealth(1) });
    expect(canCreatePlans(input)).toBe(false);
  });

  it('returns false when strategy incomplete', () => {
    const input = makeInput({ strategyId: null });
    expect(canCreatePlans(input)).toBe(false);
  });

  it('returns true when ready for plans', () => {
    const input = makeInput();
    expect(canCreatePlans(input)).toBe(true);
  });

  it('returns true when plans in progress', () => {
    const input = makeInput({ mediaPlan: makeMediaPlan('draft') });
    expect(canCreatePlans(input)).toBe(true);
  });
});

// ============================================================================
// getNextStepStatusSummary Tests
// ============================================================================

describe('getNextStepStatusSummary', () => {
  it('returns correct summary for each state', () => {
    const companyId = 'test';

    const incompleteContext = getStrategyNextStepUIState(
      makeInput({ contextHealth: makeHealth(1) }),
      companyId
    );
    expect(getNextStepStatusSummary(incompleteContext)).toBe('Complete context confirmation');

    const incompleteStrategy = getStrategyNextStepUIState(
      makeInput({ strategyId: null }),
      companyId
    );
    expect(getNextStepStatusSummary(incompleteStrategy)).toBe('Complete strategy');

    const readyForPlans = getStrategyNextStepUIState(makeInput(), companyId);
    expect(getNextStepStatusSummary(readyForPlans)).toBe('Ready to create plans');

    const plansInProgress = getStrategyNextStepUIState(
      makeInput({ mediaPlan: makeMediaPlan('draft') }),
      companyId
    );
    expect(getNextStepStatusSummary(plansInProgress)).toBe('Plans in progress');

    const plansComplete = getStrategyNextStepUIState(
      makeInput({ mediaPlan: makeMediaPlan('approved') }),
      companyId
    );
    expect(getNextStepStatusSummary(plansComplete)).toBe('Plans approved');
  });
});
