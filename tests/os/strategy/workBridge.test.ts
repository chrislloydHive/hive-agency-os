// tests/os/strategy/workBridge.test.ts
// Tests for Strategy → Work Bridge helpers
//
// Covers:
// - Workstream type classification
// - Work item building from tactics
// - Idempotency helpers

import { describe, it, expect } from 'vitest';
import {
  classifyWorkstreamType,
  workstreamTypeToArea,
  buildWorkItemFromTactic,
  draftToCreateInput,
  stableWorkKey,
  isWorkLinkedToTactic,
  isWorkLinkedToStrategy,
  isPaidMediaTactic,
} from '@/lib/os/strategy/workBridge';
import type { Tactic, TacticChannel, CompanyStrategy } from '@/lib/types/strategy';
import type { StrategyLink } from '@/lib/types/work';

// ============================================================================
// Test Fixtures
// ============================================================================

function createMockTactic(overrides: Partial<Tactic> = {}): Tactic {
  return {
    id: 'tactic-1',
    title: 'Test Tactic',
    description: 'A test tactic',
    channels: [],
    linkedBetIds: [],
    isDerived: false,
    ...overrides,
  };
}

function createMockStrategy(overrides: Partial<CompanyStrategy> = {}): CompanyStrategy {
  return {
    id: 'strategy-1',
    companyId: 'company-1',
    title: 'Test Strategy',
    pillars: [],
    objectives: [],
    ...overrides,
  } as CompanyStrategy;
}

// ============================================================================
// classifyWorkstreamType Tests
// ============================================================================

describe('classifyWorkstreamType', () => {
  it('should classify tactic with explicit seo channel', () => {
    const tactic = createMockTactic({ channels: ['seo' as TacticChannel] });
    expect(classifyWorkstreamType(tactic)).toBe('seo');
  });

  it('should classify tactic with explicit content channel', () => {
    const tactic = createMockTactic({ channels: ['content' as TacticChannel] });
    expect(classifyWorkstreamType(tactic)).toBe('content');
  });

  it('should classify tactic with explicit media channel', () => {
    const tactic = createMockTactic({ channels: ['media' as TacticChannel] });
    expect(classifyWorkstreamType(tactic)).toBe('paid_media');
  });

  it('should classify tactic by title keywords - paid media', () => {
    const tactic = createMockTactic({
      title: 'Launch Google Ads Campaign',
      channels: [],
    });
    expect(classifyWorkstreamType(tactic)).toBe('paid_media');
  });

  it('should classify tactic by title keywords - seo', () => {
    const tactic = createMockTactic({
      title: 'Improve organic search ranking',
      channels: [],
    });
    expect(classifyWorkstreamType(tactic)).toBe('seo');
  });

  it('should classify tactic by title keywords - content', () => {
    const tactic = createMockTactic({
      title: 'Write blog article about best practices',
      channels: [],
    });
    expect(classifyWorkstreamType(tactic)).toBe('content');
  });

  it('should classify tactic by description keywords - email', () => {
    const tactic = createMockTactic({
      title: 'Q1 Initiative',
      description: 'Create email nurture sequence for prospects',
      channels: [],
    });
    expect(classifyWorkstreamType(tactic)).toBe('email');
  });

  it('should return other for unclassifiable tactics', () => {
    const tactic = createMockTactic({
      title: 'Miscellaneous Task',
      description: 'Something generic',
      channels: [],
    });
    expect(classifyWorkstreamType(tactic)).toBe('other');
  });
});

// ============================================================================
// workstreamTypeToArea Tests
// ============================================================================

describe('workstreamTypeToArea', () => {
  it('should map content to Content area', () => {
    expect(workstreamTypeToArea('content')).toBe('Content');
  });

  it('should map seo to SEO area', () => {
    expect(workstreamTypeToArea('seo')).toBe('SEO');
  });

  it('should map paid_media to Strategy area', () => {
    expect(workstreamTypeToArea('paid_media')).toBe('Strategy');
  });

  it('should map website to Website UX area', () => {
    expect(workstreamTypeToArea('website')).toBe('Website UX');
  });

  it('should map other to Other area', () => {
    expect(workstreamTypeToArea('other')).toBe('Other');
  });
});

// ============================================================================
// buildWorkItemFromTactic Tests
// ============================================================================

describe('buildWorkItemFromTactic', () => {
  it('should build work item from tactic', () => {
    const strategy = createMockStrategy({ title: 'Q1 Growth Strategy' });
    const tactic = createMockTactic({
      id: 'tactic-1',
      title: 'Launch PPC Campaign',
      description: 'Set up Google Ads for lead gen',
      channels: ['media' as TacticChannel],
    });

    const draft = buildWorkItemFromTactic({
      strategy,
      tactic,
    });

    expect(draft.title).toBe('Launch PPC Campaign');
    expect(draft.workstreamType).toBe('paid_media');
    expect(draft.strategyLink.strategyId).toBe('strategy-1');
    expect(draft.strategyLink.tacticId).toBe('tactic-1');
    expect(draft.strategyLink.tacticTitle).toBe('Launch PPC Campaign');
    expect(draft.description).toContain('From Strategy: Q1 Growth Strategy');
  });

  it('should include objective in description if provided', () => {
    const strategy = createMockStrategy();
    const tactic = createMockTactic();
    const objective = { id: 'obj-1', text: 'Increase leads by 30%' };

    const draft = buildWorkItemFromTactic({
      strategy,
      tactic,
      objective,
    });

    expect(draft.description).toContain('Objective: Increase leads by 30%');
  });

  it('should include bet in description if provided', () => {
    const strategy = createMockStrategy();
    const tactic = createMockTactic();
    const bet = { id: 'bet-1', title: 'Digital Expansion' };

    const draft = buildWorkItemFromTactic({
      strategy,
      tactic,
      bet: bet as Parameters<typeof buildWorkItemFromTactic>[0]['bet'],
    });

    expect(draft.description).toContain('Strategic Bet: Digital Expansion');
  });
});

// ============================================================================
// draftToCreateInput Tests
// ============================================================================

describe('draftToCreateInput', () => {
  it('should convert draft to create input', () => {
    const strategy = createMockStrategy();
    const tactic = createMockTactic({ channels: ['content' as TacticChannel] });
    const draft = buildWorkItemFromTactic({ strategy, tactic });

    const input = draftToCreateInput(draft, 'company-123');

    expect(input.title).toBe(draft.title);
    expect(input.companyId).toBe('company-123');
    expect(input.area).toBe('Content');
    expect(input.status).toBe('Backlog');
    expect(input.severity).toBe('Medium');
    expect(input.strategyLink).toEqual(draft.strategyLink);
    expect(input.workstreamType).toBe('content');
  });
});

// ============================================================================
// Idempotency Helpers Tests
// ============================================================================

describe('stableWorkKey', () => {
  it('should generate stable key from strategy and tactic IDs', () => {
    const key = stableWorkKey('strat-1', 'tactic-1');
    expect(key).toBe('strategy:strat-1:tactic:tactic-1');
  });

  it('should generate different keys for different tactics', () => {
    const key1 = stableWorkKey('strat-1', 'tactic-1');
    const key2 = stableWorkKey('strat-1', 'tactic-2');
    expect(key1).not.toBe(key2);
  });
});

describe('isWorkLinkedToTactic', () => {
  it('should return true when strategyLink matches tacticId', () => {
    const strategyLink: StrategyLink = {
      strategyId: 'strat-1',
      tacticId: 'tactic-1',
    };
    expect(isWorkLinkedToTactic(strategyLink, 'tactic-1')).toBe(true);
  });

  it('should return false when tacticId does not match', () => {
    const strategyLink: StrategyLink = {
      strategyId: 'strat-1',
      tacticId: 'tactic-1',
    };
    expect(isWorkLinkedToTactic(strategyLink, 'tactic-2')).toBe(false);
  });

  it('should return false when strategyLink is undefined', () => {
    expect(isWorkLinkedToTactic(undefined, 'tactic-1')).toBe(false);
  });
});

describe('isWorkLinkedToStrategy', () => {
  it('should return true when strategyLink matches strategyId', () => {
    const strategyLink: StrategyLink = {
      strategyId: 'strat-1',
      tacticId: 'tactic-1',
    };
    expect(isWorkLinkedToStrategy(strategyLink, 'strat-1')).toBe(true);
  });

  it('should return false when strategyId does not match', () => {
    const strategyLink: StrategyLink = {
      strategyId: 'strat-1',
      tacticId: 'tactic-1',
    };
    expect(isWorkLinkedToStrategy(strategyLink, 'strat-2')).toBe(false);
  });
});

// ============================================================================
// Paid Media Detection Tests
// ============================================================================

describe('isPaidMediaTactic', () => {
  it('should return true for tactic with media channel', () => {
    const tactic = createMockTactic({ channels: ['media' as TacticChannel] });
    expect(isPaidMediaTactic(tactic)).toBe(true);
  });

  it('should return true for tactic with paid keywords', () => {
    const tactic = createMockTactic({
      title: 'Meta Ads Campaign',
      channels: [],
    });
    expect(isPaidMediaTactic(tactic)).toBe(true);
  });

  it('should return false for content tactic', () => {
    const tactic = createMockTactic({
      title: 'Blog Post Series',
      channels: ['content' as TacticChannel],
    });
    expect(isPaidMediaTactic(tactic)).toBe(false);
  });
});
