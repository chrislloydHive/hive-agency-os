// tests/plans/ai/buildPlanInputs.test.ts
// Tests for plan generation input building

import { describe, it, expect } from 'vitest';
import {
  buildPlanInputs,
  formatInputsForPrompt,
  type PlanGenerationInputs,
} from '@/lib/os/plans/ai/buildPlanInputs';
import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';
import type { CompanyStrategy } from '@/lib/types/strategy';

// ============================================================================
// Test Fixtures
// ============================================================================

function createMockContext(overrides: Partial<CompanyContextGraph> = {}): CompanyContextGraph {
  return {
    identity: {
      companyName: { value: 'Acme Corp', status: 'confirmed' },
      businessModel: { value: 'B2B SaaS', status: 'confirmed' },
    },
    brand: {
      positioning: { value: 'Enterprise-grade solutions', status: 'confirmed' },
    },
    audience: {
      primaryAudience: { value: 'Marketing teams', status: 'confirmed' },
      icpDescription: { value: 'Mid-market marketing managers', status: 'confirmed' },
      painPoints: { value: ['Manual processes', 'Lack of visibility'], status: 'confirmed' },
    },
    productOffer: {
      valueProposition: { value: 'Save 10 hours per week', status: 'confirmed' },
      mainOffer: { value: 'Marketing automation platform', status: 'confirmed' },
    },
    seo: {
      seoFocus: { value: 'Marketing automation tools', status: 'confirmed' },
    },
    ...overrides,
  } as unknown as CompanyContextGraph;
}

function createMockStrategy(overrides: Partial<CompanyStrategy> = {}): CompanyStrategy {
  return {
    id: 'strategy-1',
    companyId: 'company-1',
    goalStatement: 'Increase qualified leads by 50% in Q1',
    strategyFrame: 'Growth through demand generation',
    objectives: [
      { id: 'obj-1', text: 'Lead Generation', status: 'active' },
      { id: 'obj-2', text: 'Brand Awareness', status: 'active' },
    ],
    pillars: [
      { id: 'pil-1', title: 'Content Marketing', description: 'Educational content', status: 'active' },
      { id: 'pil-2', title: 'Paid Acquisition', description: 'PPC campaigns', status: 'active' },
      { id: 'pil-3', title: 'Rejected Idea', description: 'Not doing this', status: 'rejected' },
    ],
    ...overrides,
  } as unknown as CompanyStrategy;
}

// ============================================================================
// buildPlanInputs Tests
// ============================================================================

describe('buildPlanInputs', () => {
  describe('extracts context fields correctly', () => {
    it('extracts company identity from context', () => {
      const context = createMockContext();
      const strategy = createMockStrategy();

      const inputs = buildPlanInputs(context, strategy, 'media', 'create');

      expect(inputs.companyName).toBe('Acme Corp');
      expect(inputs.businessModel).toBe('B2B SaaS');
    });

    it('extracts brand positioning from context', () => {
      const context = createMockContext();
      const strategy = createMockStrategy();

      const inputs = buildPlanInputs(context, strategy, 'media', 'create');

      expect(inputs.positioning).toBe('Enterprise-grade solutions');
    });

    it('extracts audience info from context', () => {
      const context = createMockContext();
      const strategy = createMockStrategy();

      const inputs = buildPlanInputs(context, strategy, 'media', 'create');

      expect(inputs.primaryAudience).toBe('Marketing teams');
      expect(inputs.icpDescription).toBe('Mid-market marketing managers');
      expect(inputs.painPoints).toEqual(['Manual processes', 'Lack of visibility']);
    });

    it('extracts product/offer from context', () => {
      const context = createMockContext();
      const strategy = createMockStrategy();

      const inputs = buildPlanInputs(context, strategy, 'media', 'create');

      expect(inputs.valueProposition).toBe('Save 10 hours per week');
      expect(inputs.mainOffer).toBe('Marketing automation platform');
    });

    it('returns null for missing fields', () => {
      const context = {} as CompanyContextGraph;
      const strategy = createMockStrategy();

      const inputs = buildPlanInputs(context, strategy, 'media', 'create');

      expect(inputs.companyName).toBeNull();
      expect(inputs.positioning).toBeNull();
    });

    it('handles null context gracefully', () => {
      const inputs = buildPlanInputs(null, null, 'media', 'create');

      expect(inputs.companyName).toBeNull();
      expect(inputs.goalStatement).toBeNull();
      expect(inputs.objectives).toEqual([]);
    });
  });

  describe('extracts strategy fields correctly', () => {
    it('extracts goal statement from strategy', () => {
      const context = createMockContext();
      const strategy = createMockStrategy();

      const inputs = buildPlanInputs(context, strategy, 'media', 'create');

      expect(inputs.goalStatement).toBe('Increase qualified leads by 50% in Q1');
    });

    it('extracts strategy frame from strategy', () => {
      const context = createMockContext();
      const strategy = createMockStrategy();

      const inputs = buildPlanInputs(context, strategy, 'media', 'create');

      // strategyFrame is JSON.stringify'd in buildPlanInputs
      expect(inputs.strategyFrame).toBe('"Growth through demand generation"');
    });

    it('extracts only active objectives', () => {
      const context = createMockContext();
      const strategy = createMockStrategy({
        objectives: [
          { id: 'obj-1', text: 'Active objective', status: 'active' },
          { id: 'obj-2', text: 'Abandoned objective', status: 'abandoned' },
        ],
      });

      const inputs = buildPlanInputs(context, strategy, 'media', 'create');

      // Only active/draft objectives are extracted
      expect(inputs.objectives).toHaveLength(1);
      expect(inputs.objectives[0]).toBe('Active objective');
    });

    it('extracts only accepted bets', () => {
      const context = createMockContext();
      const strategy = createMockStrategy();

      const inputs = buildPlanInputs(context, strategy, 'media', 'create');

      expect(inputs.acceptedBets).toHaveLength(2);
      expect(inputs.acceptedBets.some(b => b.includes('Content Marketing'))).toBe(true);
      expect(inputs.acceptedBets.some(b => b.includes('Rejected Idea'))).toBe(false);
    });

    it('returns empty channels array (channels not extracted from strategy)', () => {
      const context = createMockContext();
      const strategy = createMockStrategy();

      const inputs = buildPlanInputs(context, strategy, 'media', 'create');

      // Note: buildPlanInputs currently returns empty channels array
      // Channel extraction is not implemented in the current version
      expect(inputs.channels).toEqual([]);
    });
  });

  describe('handles plan type differences', () => {
    it('sets planType to media for media plans', () => {
      const context = createMockContext();
      const strategy = createMockStrategy();

      const inputs = buildPlanInputs(context, strategy, 'media', 'create');

      expect(inputs.planType).toBe('media');
    });

    it('sets planType to content for content plans', () => {
      const context = createMockContext();
      const strategy = createMockStrategy();

      const inputs = buildPlanInputs(context, strategy, 'content', 'create');

      expect(inputs.planType).toBe('content');
    });

    it('extracts seoFocus for content plans', () => {
      const context = createMockContext();
      const strategy = createMockStrategy();

      const inputs = buildPlanInputs(context, strategy, 'content', 'create');

      expect(inputs.seoFocus).toBe('Marketing automation tools');
    });
  });

  describe('handles mode differences', () => {
    it('sets mode to create for new plans', () => {
      const context = createMockContext();
      const strategy = createMockStrategy();

      const inputs = buildPlanInputs(context, strategy, 'media', 'create');

      expect(inputs.mode).toBe('create');
    });

    it('sets mode to refresh for refreshes', () => {
      const context = createMockContext();
      const strategy = createMockStrategy();

      const inputs = buildPlanInputs(context, strategy, 'media', 'refresh');

      expect(inputs.mode).toBe('refresh');
    });

    it('includes existing plan summary for refreshes', () => {
      const context = createMockContext();
      const strategy = createMockStrategy();
      const existingSummary = 'Existing plan focuses on Google Ads';

      const inputs = buildPlanInputs(context, strategy, 'media', 'refresh', existingSummary);

      expect(inputs.existingPlanSummary).toBe(existingSummary);
    });
  });
});

// ============================================================================
// formatInputsForPrompt Tests
// ============================================================================

describe('formatInputsForPrompt', () => {
  it('formats company context section', () => {
    const inputs: PlanGenerationInputs = {
      companyName: 'Acme Corp',
      businessModel: 'B2B SaaS',
      positioning: 'Enterprise solutions',
      primaryAudience: null,
      icpDescription: null,
      painPoints: [],
      valueProposition: null,
      mainOffer: null,
      goalStatement: null,
      strategyFrame: null,
      objectives: [],
      acceptedBets: [],
      budgetRange: null,
      channels: [],
      contentThemes: [],
      seoFocus: null,
      planType: 'media',
      mode: 'create',
    };

    const formatted = formatInputsForPrompt(inputs);

    expect(formatted).toContain('## Company Context');
    expect(formatted).toContain('Acme Corp');
    expect(formatted).toContain('B2B SaaS');
    expect(formatted).toContain('Enterprise solutions');
  });

  it('formats target audience section', () => {
    const inputs: PlanGenerationInputs = {
      companyName: null,
      businessModel: null,
      positioning: null,
      primaryAudience: 'Marketing teams',
      icpDescription: 'Mid-market managers',
      painPoints: ['Pain 1', 'Pain 2'],
      valueProposition: null,
      mainOffer: null,
      goalStatement: null,
      strategyFrame: null,
      objectives: [],
      acceptedBets: [],
      budgetRange: null,
      channels: [],
      contentThemes: [],
      seoFocus: null,
      planType: 'media',
      mode: 'create',
    };

    const formatted = formatInputsForPrompt(inputs);

    expect(formatted).toContain('## Target Audience');
    expect(formatted).toContain('Marketing teams');
    expect(formatted).toContain('Pain 1, Pain 2');
  });

  it('formats strategy section with objectives and bets', () => {
    const inputs: PlanGenerationInputs = {
      companyName: null,
      businessModel: null,
      positioning: null,
      primaryAudience: null,
      icpDescription: null,
      painPoints: [],
      valueProposition: null,
      mainOffer: null,
      goalStatement: 'Grow leads by 50%',
      strategyFrame: 'Demand generation',
      objectives: ['Lead Gen: Drive more MQLs', 'Awareness: Increase visibility'],
      acceptedBets: ['Content: Educational content', 'Paid: PPC campaigns'],
      budgetRange: null,
      channels: [],
      contentThemes: [],
      seoFocus: null,
      planType: 'media',
      mode: 'create',
    };

    const formatted = formatInputsForPrompt(inputs);

    expect(formatted).toContain('## Strategy');
    expect(formatted).toContain('Grow leads by 50%');
    expect(formatted).toContain('Demand generation');
    expect(formatted).toContain('Lead Gen');
    expect(formatted).toContain('Content');
  });

  it('formats media context section for media plans', () => {
    const inputs: PlanGenerationInputs = {
      companyName: null,
      businessModel: null,
      positioning: null,
      primaryAudience: null,
      icpDescription: null,
      painPoints: [],
      valueProposition: null,
      mainOffer: null,
      goalStatement: null,
      strategyFrame: null,
      objectives: [],
      acceptedBets: [],
      budgetRange: '$50k-100k',
      channels: ['Google Ads', 'LinkedIn'],
      contentThemes: [],
      seoFocus: null,
      planType: 'media',
      mode: 'create',
    };

    const formatted = formatInputsForPrompt(inputs);

    expect(formatted).toContain('## Media Context');
    expect(formatted).toContain('$50k-100k');
    expect(formatted).toContain('Google Ads, LinkedIn');
  });

  it('formats content context section for content plans', () => {
    const inputs: PlanGenerationInputs = {
      companyName: null,
      businessModel: null,
      positioning: null,
      primaryAudience: null,
      icpDescription: null,
      painPoints: [],
      valueProposition: null,
      mainOffer: null,
      goalStatement: null,
      strategyFrame: null,
      objectives: [],
      acceptedBets: [],
      budgetRange: null,
      channels: [],
      contentThemes: ['Thought leadership', 'Case studies'],
      seoFocus: 'Marketing automation',
      planType: 'content',
      mode: 'create',
    };

    const formatted = formatInputsForPrompt(inputs);

    expect(formatted).toContain('## Content Context');
    expect(formatted).toContain('Thought leadership, Case studies');
    expect(formatted).toContain('Marketing automation');
  });

  it('includes refresh note for refresh mode', () => {
    const inputs: PlanGenerationInputs = {
      companyName: null,
      businessModel: null,
      positioning: null,
      primaryAudience: null,
      icpDescription: null,
      painPoints: [],
      valueProposition: null,
      mainOffer: null,
      goalStatement: null,
      strategyFrame: null,
      objectives: [],
      acceptedBets: [],
      budgetRange: null,
      channels: [],
      contentThemes: [],
      seoFocus: null,
      planType: 'media',
      mode: 'refresh',
      existingPlanSummary: 'Previous plan had 3 campaigns',
    };

    const formatted = formatInputsForPrompt(inputs);

    expect(formatted).toContain('## Existing Plan Summary');
    expect(formatted).toContain('Previous plan had 3 campaigns');
    expect(formatted).toContain('refresh');
  });

  it('omits sections with no data', () => {
    const inputs: PlanGenerationInputs = {
      companyName: null,
      businessModel: null,
      positioning: null,
      primaryAudience: null,
      icpDescription: null,
      painPoints: [],
      valueProposition: null,
      mainOffer: null,
      goalStatement: null,
      strategyFrame: null,
      objectives: [],
      acceptedBets: [],
      budgetRange: null,
      channels: [],
      contentThemes: [],
      seoFocus: null,
      planType: 'media',
      mode: 'create',
    };

    const formatted = formatInputsForPrompt(inputs);

    expect(formatted).not.toContain('## Company Context');
    expect(formatted).not.toContain('## Target Audience');
    expect(formatted).not.toContain('## Strategy');
  });
});

// ============================================================================
// Input Validation Tests
// ============================================================================

describe('input validation', () => {
  it('handles empty arrays for pain points', () => {
    const context = createMockContext({
      audience: {
        primaryAudience: { value: 'Test', status: 'confirmed' },
        painPoints: { value: [], status: 'confirmed' },
      },
    } as unknown as Partial<CompanyContextGraph>);
    const strategy = createMockStrategy();

    const inputs = buildPlanInputs(context, strategy, 'media', 'create');

    expect(inputs.painPoints).toEqual([]);
  });

  it('handles strategy with no objectives', () => {
    const context = createMockContext();
    const strategy = createMockStrategy({ objectives: [] });

    const inputs = buildPlanInputs(context, strategy, 'media', 'create');

    expect(inputs.objectives).toEqual([]);
  });

  it('handles strategy with no pillars', () => {
    const context = createMockContext();
    const strategy = createMockStrategy({ pillars: [] });

    const inputs = buildPlanInputs(context, strategy, 'media', 'create');

    expect(inputs.acceptedBets).toEqual([]);
  });

  it('always returns empty channels array', () => {
    const context = createMockContext();
    const strategy = createMockStrategy();

    const inputs = buildPlanInputs(context, strategy, 'media', 'create');

    // Channel extraction is not implemented - always returns empty array
    expect(inputs.channels).toEqual([]);
  });
});
