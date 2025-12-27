// tests/os/briefUiState.test.ts
// Unit tests for Brief generation UI state selector

import { describe, it, expect } from 'vitest';
import {
  getBriefUIState,
  canGenerateBrief,
  getBriefStatusSummary,
  type BriefDataInput,
  type BriefState,
} from '@/lib/os/ui/briefUiState';
import type { StrategyFrame } from '@/lib/types/strategy';

// ============================================================================
// Test Fixtures
// ============================================================================

const COMPLETE_FRAME: StrategyFrame = {
  audience: 'B2B SaaS companies with 50-200 employees',
  valueProp: 'We help teams ship 2x faster',
  positioning: 'Unlike competitors, we focus on simplicity',
  constraints: 'Must comply with SOC2, limited budget',
};

const PARTIAL_FRAME: StrategyFrame = {
  audience: 'B2B SaaS companies',
  valueProp: 'We help teams ship faster',
  // positioning missing
  // constraints missing
};

const EMPTY_FRAME: StrategyFrame = {};

const ACCEPTED_BETS = [
  { status: 'accepted' },
  { status: 'accepted' },
];

const DRAFT_BETS = [
  { status: 'draft' },
  { status: 'draft' },
];

const MIXED_BETS = [
  { status: 'accepted' },
  { status: 'draft' },
  { status: 'rejected' },
];

// ============================================================================
// getBriefUIState Tests
// ============================================================================

describe('getBriefUIState', () => {
  describe('blocked_no_strategy state', () => {
    it('returns blocked_no_strategy when strategyExists is false', () => {
      const input: BriefDataInput = {
        strategyExists: false,
        frame: COMPLETE_FRAME,
        bets: ACCEPTED_BETS,
      };
      const result = getBriefUIState(input, 'test-company');

      expect(result.state).toBe('blocked_no_strategy');
      expect(result.canGenerate).toBe(false);
      expect(result.disabledReason).toBe('Create a strategy first');
      expect(result.ctaLabel).toBe('Create Strategy');
      expect(result.ctaHref).toBe('/c/test-company/strategy');
    });

    it('returns blocked_no_strategy even with complete frame and accepted bets', () => {
      const input: BriefDataInput = {
        strategyExists: false,
        frame: COMPLETE_FRAME,
        bets: ACCEPTED_BETS,
      };
      const result = getBriefUIState(input);

      expect(result.state).toBe('blocked_no_strategy');
      expect(result.canGenerate).toBe(false);
    });
  });

  describe('blocked_frame_incomplete state', () => {
    it('returns blocked_frame_incomplete when frame has missing fields', () => {
      const input: BriefDataInput = {
        strategyExists: true,
        frame: PARTIAL_FRAME,
        bets: ACCEPTED_BETS,
      };
      const result = getBriefUIState(input, 'test-company');

      expect(result.state).toBe('blocked_frame_incomplete');
      expect(result.canGenerate).toBe(false);
      expect(result.disabledReason).toContain('Complete your Strategic Frame');
      expect(result.disabledReason).toContain('2 fields missing');
      expect(result.ctaLabel).toBe('Fix Frame');
      expect(result.ctaHref).toBe('/c/test-company/strategy');
      expect(result.missingFrameKeys).toContain('positioning');
      expect(result.missingFrameKeys).toContain('constraints');
    });

    it('returns blocked_frame_incomplete when frame is empty', () => {
      const input: BriefDataInput = {
        strategyExists: true,
        frame: EMPTY_FRAME,
        bets: ACCEPTED_BETS,
      };
      const result = getBriefUIState(input);

      expect(result.state).toBe('blocked_frame_incomplete');
      expect(result.canGenerate).toBe(false);
      expect(result.missingFrameKeys.length).toBe(4);
    });

    it('returns blocked_frame_incomplete when frame is undefined', () => {
      const input: BriefDataInput = {
        strategyExists: true,
        frame: undefined,
        bets: ACCEPTED_BETS,
      };
      const result = getBriefUIState(input);

      expect(result.state).toBe('blocked_frame_incomplete');
      expect(result.canGenerate).toBe(false);
    });

    it('reports singular field when only 1 field missing', () => {
      const input: BriefDataInput = {
        strategyExists: true,
        frame: {
          audience: 'Test',
          valueProp: 'Test',
          positioning: 'Test',
          // constraints missing
        },
        bets: ACCEPTED_BETS,
      };
      const result = getBriefUIState(input);

      expect(result.state).toBe('blocked_frame_incomplete');
      expect(result.disabledReason).toContain('1 field missing');
      expect(result.missingFrameKeys).toEqual(['constraints']);
    });
  });

  describe('blocked_no_accepted_bets state', () => {
    it('returns blocked_no_accepted_bets when no bets are accepted', () => {
      const input: BriefDataInput = {
        strategyExists: true,
        frame: COMPLETE_FRAME,
        bets: DRAFT_BETS,
      };
      const result = getBriefUIState(input, 'test-company');

      expect(result.state).toBe('blocked_no_accepted_bets');
      expect(result.canGenerate).toBe(false);
      expect(result.disabledReason).toBe('Accept at least 1 Strategic Bet');
      expect(result.ctaLabel).toBe('Accept Bets');
      expect(result.ctaHref).toBe('/c/test-company/strategy');
      expect(result.acceptedBetsCount).toBe(0);
    });

    it('returns blocked_no_accepted_bets when bets array is empty', () => {
      const input: BriefDataInput = {
        strategyExists: true,
        frame: COMPLETE_FRAME,
        bets: [],
      };
      const result = getBriefUIState(input);

      expect(result.state).toBe('blocked_no_accepted_bets');
      expect(result.canGenerate).toBe(false);
      expect(result.acceptedBetsCount).toBe(0);
    });
  });

  describe('ready state', () => {
    it('returns ready when all requirements are met', () => {
      const input: BriefDataInput = {
        strategyExists: true,
        frame: COMPLETE_FRAME,
        bets: ACCEPTED_BETS,
      };
      const result = getBriefUIState(input);

      expect(result.state).toBe('ready');
      expect(result.canGenerate).toBe(true);
      expect(result.disabledReason).toBeNull();
      expect(result.ctaLabel).toBe('Generate Brief');
      expect(result.ctaHref).toBeNull();
      expect(result.missingFrameKeys).toEqual([]);
      expect(result.acceptedBetsCount).toBe(2);
    });

    it('returns ready with mixed bets (some accepted, some not)', () => {
      const input: BriefDataInput = {
        strategyExists: true,
        frame: COMPLETE_FRAME,
        bets: MIXED_BETS,
      };
      const result = getBriefUIState(input);

      expect(result.state).toBe('ready');
      expect(result.canGenerate).toBe(true);
      expect(result.acceptedBetsCount).toBe(1);
    });

    it('returns ready with just 1 accepted bet', () => {
      const input: BriefDataInput = {
        strategyExists: true,
        frame: COMPLETE_FRAME,
        bets: [{ status: 'accepted' }],
      };
      const result = getBriefUIState(input);

      expect(result.state).toBe('ready');
      expect(result.canGenerate).toBe(true);
      expect(result.acceptedBetsCount).toBe(1);
    });
  });

  describe('priority ordering', () => {
    it('prioritizes no_strategy over frame_incomplete', () => {
      const input: BriefDataInput = {
        strategyExists: false,
        frame: EMPTY_FRAME,
        bets: DRAFT_BETS,
      };
      const result = getBriefUIState(input);

      expect(result.state).toBe('blocked_no_strategy');
    });

    it('prioritizes frame_incomplete over no_accepted_bets', () => {
      const input: BriefDataInput = {
        strategyExists: true,
        frame: PARTIAL_FRAME,
        bets: [],
      };
      const result = getBriefUIState(input);

      expect(result.state).toBe('blocked_frame_incomplete');
    });
  });

  describe('companyId handling', () => {
    it('generates correct hrefs when companyId is provided', () => {
      const input: BriefDataInput = {
        strategyExists: true,
        frame: EMPTY_FRAME,
        bets: [],
      };
      const result = getBriefUIState(input, 'rec123ABC');

      expect(result.ctaHref).toBe('/c/rec123ABC/strategy');
    });

    it('returns null hrefs when companyId is not provided', () => {
      const input: BriefDataInput = {
        strategyExists: true,
        frame: EMPTY_FRAME,
        bets: [],
      };
      const result = getBriefUIState(input);

      expect(result.ctaHref).toBeNull();
    });
  });

  describe('legacy frame field support', () => {
    it('recognizes legacy targetAudience field', () => {
      const input: BriefDataInput = {
        strategyExists: true,
        frame: {
          targetAudience: 'B2B SaaS companies', // legacy field
          valueProp: 'We help teams ship faster',
          positioning: 'Unlike competitors, we focus on simplicity',
          constraints: 'Must comply with SOC2',
        },
        bets: ACCEPTED_BETS,
      };
      const result = getBriefUIState(input);

      expect(result.state).toBe('ready');
      expect(result.canGenerate).toBe(true);
    });

    it('recognizes legacy valueProposition field', () => {
      const input: BriefDataInput = {
        strategyExists: true,
        frame: {
          audience: 'B2B SaaS companies',
          valueProposition: 'We help teams ship faster', // legacy field
          positioning: 'Unlike competitors, we focus on simplicity',
          constraints: 'Must comply with SOC2',
        },
        bets: ACCEPTED_BETS,
      };
      const result = getBriefUIState(input);

      expect(result.state).toBe('ready');
      expect(result.canGenerate).toBe(true);
    });
  });
});

// ============================================================================
// canGenerateBrief Tests
// ============================================================================

describe('canGenerateBrief', () => {
  it('returns true when all requirements are met', () => {
    const input: BriefDataInput = {
      strategyExists: true,
      frame: COMPLETE_FRAME,
      bets: ACCEPTED_BETS,
    };
    expect(canGenerateBrief(input)).toBe(true);
  });

  it('returns false when blocked', () => {
    const input: BriefDataInput = {
      strategyExists: true,
      frame: COMPLETE_FRAME,
      bets: [],
    };
    expect(canGenerateBrief(input)).toBe(false);
  });
});

// ============================================================================
// getBriefStatusSummary Tests
// ============================================================================

describe('getBriefStatusSummary', () => {
  it('returns "No strategy" for blocked_no_strategy', () => {
    const input: BriefDataInput = {
      strategyExists: false,
      frame: COMPLETE_FRAME,
      bets: ACCEPTED_BETS,
    };
    const uiState = getBriefUIState(input);
    expect(getBriefStatusSummary(uiState)).toBe('No strategy');
  });

  it('returns field count for blocked_frame_incomplete', () => {
    const input: BriefDataInput = {
      strategyExists: true,
      frame: PARTIAL_FRAME,
      bets: ACCEPTED_BETS,
    };
    const uiState = getBriefUIState(input);
    expect(getBriefStatusSummary(uiState)).toBe('2 frame fields missing');
  });

  it('returns singular for 1 missing field', () => {
    const input: BriefDataInput = {
      strategyExists: true,
      frame: {
        audience: 'Test',
        valueProp: 'Test',
        positioning: 'Test',
      },
      bets: ACCEPTED_BETS,
    };
    const uiState = getBriefUIState(input);
    expect(getBriefStatusSummary(uiState)).toBe('1 frame field missing');
  });

  it('returns "No accepted bets" for blocked_no_accepted_bets', () => {
    const input: BriefDataInput = {
      strategyExists: true,
      frame: COMPLETE_FRAME,
      bets: [],
    };
    const uiState = getBriefUIState(input);
    expect(getBriefStatusSummary(uiState)).toBe('No accepted bets');
  });

  it('returns bet count for ready state', () => {
    const input: BriefDataInput = {
      strategyExists: true,
      frame: COMPLETE_FRAME,
      bets: ACCEPTED_BETS,
    };
    const uiState = getBriefUIState(input);
    expect(getBriefStatusSummary(uiState)).toBe('Ready (2 bets accepted)');
  });

  it('returns singular for 1 accepted bet', () => {
    const input: BriefDataInput = {
      strategyExists: true,
      frame: COMPLETE_FRAME,
      bets: [{ status: 'accepted' }],
    };
    const uiState = getBriefUIState(input);
    expect(getBriefStatusSummary(uiState)).toBe('Ready (1 bet accepted)');
  });
});
