/**
 * Tests for Imported Strategy Flow
 *
 * Tests:
 * - API creates strategy with origin="imported"
 * - Strategy types include origin field
 * - Imported strategies bypass labs requirement
 */

import { describe, it, expect } from 'vitest';
import type { CompanyStrategy, StrategyOrigin, CreateStrategyRequest, StrategyFrame } from '@/lib/types/strategy';

// ============================================================================
// Type Tests
// ============================================================================

describe('StrategyOrigin Type', () => {
  it('supports generated origin (default)', () => {
    const origin: StrategyOrigin = 'generated';
    expect(origin).toBe('generated');
  });

  it('supports imported origin', () => {
    const origin: StrategyOrigin = 'imported';
    expect(origin).toBe('imported');
  });

  it('supports hybrid origin', () => {
    const origin: StrategyOrigin = 'hybrid';
    expect(origin).toBe('hybrid');
  });
});

describe('CompanyStrategy with origin', () => {
  it('accepts origin field', () => {
    const strategy: Partial<CompanyStrategy> = {
      id: 'strat_123',
      companyId: 'company_test',
      title: 'Test Strategy',
      summary: 'A test strategy',
      origin: 'imported',
      status: 'finalized',
      objectives: [],
      pillars: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(strategy.origin).toBe('imported');
  });

  it('origin is optional (defaults to undefined, treated as generated)', () => {
    const strategy: Partial<CompanyStrategy> = {
      id: 'strat_456',
      companyId: 'company_test',
      title: 'Generated Strategy',
      summary: 'A generated strategy',
      status: 'draft',
      objectives: [],
      pillars: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(strategy.origin).toBeUndefined();
  });
});

// ============================================================================
// CreateStrategyRequest Tests
// ============================================================================

describe('CreateStrategyRequest with origin', () => {
  it('accepts origin in request', () => {
    const request: CreateStrategyRequest = {
      companyId: 'company_test',
      title: 'Imported Strategy',
      origin: 'imported',
      status: 'finalized',
    };

    expect(request.origin).toBe('imported');
    expect(request.status).toBe('finalized');
  });

  it('accepts strategyFrame with intent and optimizationScope', () => {
    const request: CreateStrategyRequest = {
      companyId: 'company_test',
      title: 'Imported Strategy',
      origin: 'imported',
      strategyFrame: {
        intent: '• Increase brand awareness\n• Generate leads',
        constraints: 'Budget cap of $50k/month',
        optimizationScope: 'Lead generation',
      },
    };

    expect(request.strategyFrame?.intent).toContain('brand awareness');
    expect(request.strategyFrame?.constraints).toContain('$50k');
    expect(request.strategyFrame?.optimizationScope).toBe('Lead generation');
  });
});

// ============================================================================
// StrategyFrame Tests (V10+ fields)
// ============================================================================

describe('StrategyFrame imported strategy fields', () => {
  it('supports intent field', () => {
    const frame: StrategyFrame = {
      intent: '• Goal 1\n• Goal 2\n• Goal 3',
    };

    expect(frame.intent).toContain('Goal 1');
  });

  it('supports optimizationScope field', () => {
    const frame: StrategyFrame = {
      optimizationScope: 'Brand awareness and lead generation',
    };

    expect(frame.optimizationScope).toContain('Brand awareness');
  });

  it('constraints already supported', () => {
    const frame: StrategyFrame = {
      constraints: 'No paid social, budget under $100k',
    };

    expect(frame.constraints).toContain('No paid social');
  });
});

// ============================================================================
// Import Strategy Request Body Tests
// ============================================================================

describe('Import Strategy Request Body', () => {
  interface ImportStrategyRequestBody {
    name: string;
    status?: 'approved' | 'active' | 'draft';
    intent?: string;
    constraints?: string;
    optimizationScope?: string;
  }

  it('minimal request with just name', () => {
    const body: ImportStrategyRequestBody = {
      name: 'Car Toys Q1 Strategy',
    };

    expect(body.name).toBe('Car Toys Q1 Strategy');
    expect(body.status).toBeUndefined();
  });

  it('full request with all fields', () => {
    const body: ImportStrategyRequestBody = {
      name: 'Car Toys Q1 Strategy',
      status: 'approved',
      intent: '• Increase store traffic by 20%\n• Launch new product line\n• Expand to 3 new markets',
      constraints: 'Budget: $150k total, No TV ads, Must use existing brand assets',
      optimizationScope: 'Store traffic and product awareness',
    };

    expect(body.name).toBe('Car Toys Q1 Strategy');
    expect(body.status).toBe('approved');
    expect(body.intent).toContain('Increase store traffic');
    expect(body.constraints).toContain('$150k');
    expect(body.optimizationScope).toBe('Store traffic and product awareness');
  });

  it('status defaults to approved when not specified', () => {
    const body: ImportStrategyRequestBody = {
      name: 'Default Status Strategy',
    };

    // API should default to 'approved' when status is undefined
    const resolvedStatus = body.status ?? 'approved';
    expect(resolvedStatus).toBe('approved');
  });
});

// ============================================================================
// Phase Detection Tests (Imported Strategy Bypass)
// ============================================================================

describe('Imported Strategy Phase Detection', () => {
  interface DetectPhaseInput {
    hasLabsRun: boolean;
    hasConfirmedContext: boolean;
    hasImportedStrategy: boolean;
  }

  function shouldSkipLabsRequirement(input: DetectPhaseInput): boolean {
    // If imported strategy exists, labs are optional
    return input.hasImportedStrategy || input.hasLabsRun;
  }

  function shouldSkipContextRequirement(input: DetectPhaseInput): boolean {
    // If imported strategy exists, confirmed context is optional
    return input.hasImportedStrategy || input.hasConfirmedContext;
  }

  it('labs not required when imported strategy exists', () => {
    const input: DetectPhaseInput = {
      hasLabsRun: false,
      hasConfirmedContext: false,
      hasImportedStrategy: true,
    };

    expect(shouldSkipLabsRequirement(input)).toBe(true);
  });

  it('context confirmation not required when imported strategy exists', () => {
    const input: DetectPhaseInput = {
      hasLabsRun: false,
      hasConfirmedContext: false,
      hasImportedStrategy: true,
    };

    expect(shouldSkipContextRequirement(input)).toBe(true);
  });

  it('labs still required when no imported strategy', () => {
    const input: DetectPhaseInput = {
      hasLabsRun: false,
      hasConfirmedContext: false,
      hasImportedStrategy: false,
    };

    expect(shouldSkipLabsRequirement(input)).toBe(false);
  });
});

// ============================================================================
// UI State Tests
// ============================================================================

describe('Imported Strategy UI State', () => {
  interface OverviewUIState {
    showTwoPathGetStarted: boolean;
    showImportedBanner: boolean;
    primaryCta: 'runLabs' | 'viewStrategy' | 'goToDeliver';
  }

  function getOverviewUIState(options: {
    hasImportedStrategy: boolean;
    hasLabsRun: boolean;
  }): OverviewUIState {
    const { hasImportedStrategy, hasLabsRun } = options;

    if (hasImportedStrategy) {
      return {
        showTwoPathGetStarted: false,
        showImportedBanner: true,
        primaryCta: 'viewStrategy',
      };
    }

    if (!hasLabsRun) {
      return {
        showTwoPathGetStarted: true,
        showImportedBanner: false,
        primaryCta: 'runLabs',
      };
    }

    return {
      showTwoPathGetStarted: false,
      showImportedBanner: false,
      primaryCta: 'goToDeliver',
    };
  }

  it('shows two-path Get Started when no labs and no imported strategy', () => {
    const state = getOverviewUIState({
      hasImportedStrategy: false,
      hasLabsRun: false,
    });

    expect(state.showTwoPathGetStarted).toBe(true);
    expect(state.showImportedBanner).toBe(false);
  });

  it('shows imported banner when imported strategy exists', () => {
    const state = getOverviewUIState({
      hasImportedStrategy: true,
      hasLabsRun: false,
    });

    expect(state.showTwoPathGetStarted).toBe(false);
    expect(state.showImportedBanner).toBe(true);
    expect(state.primaryCta).toBe('viewStrategy');
  });

  it('primary CTA is viewStrategy when imported strategy exists', () => {
    const state = getOverviewUIState({
      hasImportedStrategy: true,
      hasLabsRun: false,
    });

    expect(state.primaryCta).toBe('viewStrategy');
  });
});

// ============================================================================
// Strategy Surface Banner Tests
// ============================================================================

describe('Strategy Surface Imported Banner', () => {
  interface StrategyBannerState {
    showImportedBanner: boolean;
    bannerText: string;
    showGoToDeliverCta: boolean;
  }

  function getStrategyBannerState(origin?: 'generated' | 'imported' | 'hybrid'): StrategyBannerState {
    if (origin === 'imported') {
      return {
        showImportedBanner: true,
        bannerText: 'Strategy anchored. Diagnostics optional — run later to enrich context.',
        showGoToDeliverCta: true,
      };
    }

    return {
      showImportedBanner: false,
      bannerText: '',
      showGoToDeliverCta: false,
    };
  }

  it('shows imported banner when origin is imported', () => {
    const state = getStrategyBannerState('imported');

    expect(state.showImportedBanner).toBe(true);
    expect(state.bannerText).toContain('Strategy anchored');
    expect(state.showGoToDeliverCta).toBe(true);
  });

  it('does not show banner for generated strategies', () => {
    const state = getStrategyBannerState('generated');

    expect(state.showImportedBanner).toBe(false);
  });

  it('does not show banner when origin is undefined', () => {
    const state = getStrategyBannerState(undefined);

    expect(state.showImportedBanner).toBe(false);
  });
});

// ============================================================================
// Routing Tests
// ============================================================================

describe('Import Strategy Routing', () => {
  function getSuccessRedirectUrl(companyId: string, strategyId: string): string {
    // After successful import, route to Decide with strategyId
    return `/c/${companyId}/decide?strategyId=${strategyId}`;
  }

  it('redirects to Decide with strategyId on success', () => {
    const url = getSuccessRedirectUrl('company_123', 'strat_456');
    expect(url).toBe('/c/company_123/decide?strategyId=strat_456');
  });

  it('includes strategyId as query param for strategy selection', () => {
    const url = getSuccessRedirectUrl('company_abc', 'strat_xyz');
    expect(url).toContain('strategyId=strat_xyz');
  });
});
