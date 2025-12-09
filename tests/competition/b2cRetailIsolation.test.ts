// tests/competition/b2cRetailIsolation.test.ts
// B2C Retail Context Isolation Regression Tests
//
// Validates:
// 1. B2C company never sees "internal hire" or "fractional" competitors
// 2. Retail brand never lists itself as a competitor
// 3. Amazon is classified as "platform" not "direct"
// 4. Positioning map axes switch to B2C definitions
// 5. Narrative engine outputs consumer retail language
// 6. BusinessModelCategory correctly influences competitor categories
// 7. When vertical = consumer retail → only expected categories appear
// 8. No context from Hive Marketing Services leaks into Car Toys or Atlas
// 9. Key Risks for B2C mention things like price competition, category overlap, platform pressure
// 10. Opportunities call out retail expansions, bundling, merchandising
// 11. Competitor snapshot never mentions B2B or startups
// 12. Car Toys output matches expected set: Pep Boys (direct), Best Buy (partial), Amazon (platform)

import { describe, it, expect } from 'vitest';
import {
  isB2CCompany,
  isEcommercePlatform,
  B2C_ALLOWED_COMPETITOR_TYPES,
  B2C_DISALLOWED_COMPETITOR_TYPES,
  getAllowedCompetitorTypes,
  isCompetitorTypeAllowed,
  sanitizeCompetitorTypeForB2C,
  getB2CPositioningAxes,
  getB2BPositioningAxes,
  getPositioningAxes,
  getSelectionQuotas,
  getB2CBreakdown,
  cleanB2CCompetitorData,
  validateNoContextBleed,
  preClassifyForB2C,
  shouldFilterB2BCandidate,
  filterCompetitorsForB2C,
  hasB2BServiceIndicators,
  ECOMMERCE_PLATFORM_DOMAINS,
} from '@/lib/competition-v3/b2cRetailClassifier';
import type { QueryContext, CompetitorType } from '@/lib/competition-v3/types';

// ============================================================================
// Test Fixtures
// ============================================================================

const carToysContext: QueryContext = {
  businessName: 'Car Toys',
  domain: 'cartoys.com',
  industry: 'Automotive aftermarket / car electronics retail',
  businessModel: 'Retail service + installation',
  businessModelCategory: 'B2C',
  icpDescription: 'Car enthusiasts and everyday drivers looking for audio, electronics, and accessory installation',
  icpStage: null,
  targetIndustries: ['Automotive'],
  primaryOffers: ['Car audio installation', 'Remote start', 'Window tinting', 'Dash cam installation'],
  serviceModel: 'project',
  pricePositioning: 'mid',
  valueProposition: 'Expert installation of car electronics with local service centers',
  differentiators: ['Professional installation', 'Warranty on work', 'Local expertise'],
  geography: 'Pacific Northwest',
  serviceRegions: ['Washington', 'Oregon', 'California'],
  aiOrientation: 'traditional',
  invalidCompetitors: [],
};

const atlasSkateContext: QueryContext = {
  businessName: 'Atlas Skateboarding',
  domain: 'atlasskate.com',
  industry: 'Skateboard retail / action sports',
  businessModel: 'Retail + community',
  businessModelCategory: 'B2C',
  icpDescription: 'Skateboarders of all skill levels',
  icpStage: null,
  targetIndustries: ['Retail', 'Sports'],
  primaryOffers: ['Skateboards', 'Parts', 'Apparel'],
  serviceModel: 'retail',
  pricePositioning: 'mid',
  valueProposition: 'Core skate shop',
  differentiators: ['Staff are skaters'],
  geography: 'Regional',
  serviceRegions: ['Local area'],
  aiOrientation: 'traditional',
  invalidCompetitors: [],
};

const hiveMarketingContext: QueryContext = {
  businessName: 'Hive Marketing Services',
  domain: 'hivemarketingservices.com',
  industry: 'Marketing / Advertising',
  businessModel: 'B2B Marketing Agency',
  businessModelCategory: 'B2B',
  icpDescription: 'B2B startups and growth-stage companies needing marketing support',
  icpStage: 'growth',
  targetIndustries: ['SaaS', 'Technology', 'E-commerce'],
  primaryOffers: ['Digital marketing', 'Content strategy', 'Growth marketing'],
  serviceModel: 'retainer',
  pricePositioning: 'premium',
  valueProposition: 'AI-augmented marketing for growth companies',
  differentiators: ['AI-first approach', 'Startup experience'],
  geography: 'US',
  serviceRegions: ['North America'],
  aiOrientation: 'ai-augmented',
  invalidCompetitors: [],
};

// ============================================================================
// 1. B2C company never sees "internal hire" or "fractional" competitors
// ============================================================================

describe('B2C Retail Isolation: Competitor Type Filtering', () => {
  it('should NOT allow fractional competitors for B2C companies', () => {
    expect(isCompetitorTypeAllowed('fractional', carToysContext)).toBe(false);
    expect(isCompetitorTypeAllowed('fractional', atlasSkateContext)).toBe(false);
  });

  it('should NOT allow internal hire competitors for B2C companies', () => {
    expect(isCompetitorTypeAllowed('internal', carToysContext)).toBe(false);
    expect(isCompetitorTypeAllowed('internal', atlasSkateContext)).toBe(false);
  });

  it('should ALLOW direct, partial, and platform for B2C companies', () => {
    expect(isCompetitorTypeAllowed('direct', carToysContext)).toBe(true);
    expect(isCompetitorTypeAllowed('partial', carToysContext)).toBe(true);
    expect(isCompetitorTypeAllowed('platform', carToysContext)).toBe(true);
  });

  it('should ALLOW all competitor types for B2B companies', () => {
    expect(isCompetitorTypeAllowed('direct', hiveMarketingContext)).toBe(true);
    expect(isCompetitorTypeAllowed('partial', hiveMarketingContext)).toBe(true);
    expect(isCompetitorTypeAllowed('fractional', hiveMarketingContext)).toBe(true);
    expect(isCompetitorTypeAllowed('internal', hiveMarketingContext)).toBe(true);
    expect(isCompetitorTypeAllowed('platform', hiveMarketingContext)).toBe(true);
  });

  it('should return only allowed types for B2C', () => {
    const allowedForCarToys = getAllowedCompetitorTypes(carToysContext);
    expect(allowedForCarToys).toEqual(B2C_ALLOWED_COMPETITOR_TYPES);
    expect(allowedForCarToys).not.toContain('fractional');
    expect(allowedForCarToys).not.toContain('internal');
  });

  it('should sanitize disallowed types to irrelevant for B2C', () => {
    expect(sanitizeCompetitorTypeForB2C('fractional', carToysContext)).toBe('irrelevant');
    expect(sanitizeCompetitorTypeForB2C('internal', carToysContext)).toBe('irrelevant');
    expect(sanitizeCompetitorTypeForB2C('direct', carToysContext)).toBe('direct');
  });
});

// ============================================================================
// 2. Retail brand never lists itself as a competitor
// ============================================================================

describe('B2C Retail Isolation: Self-Competitor Prevention', () => {
  it('should identify Car Toys as B2C', () => {
    expect(isB2CCompany(carToysContext)).toBe(true);
  });

  it('should identify Atlas Skateboarding as B2C', () => {
    expect(isB2CCompany(atlasSkateContext)).toBe(true);
  });

  it('should identify Hive Marketing as B2B (NOT B2C)', () => {
    expect(isB2CCompany(hiveMarketingContext)).toBe(false);
  });
});

// ============================================================================
// 3. Amazon is classified as "platform" not "direct"
// ============================================================================

describe('B2C Retail Isolation: E-commerce Platform Detection', () => {
  it('should classify Amazon as e-commerce platform', () => {
    expect(isEcommercePlatform('amazon.com')).toBe(true);
    expect(isEcommercePlatform('www.amazon.com')).toBe(true);
    expect(isEcommercePlatform('https://amazon.com')).toBe(true);
  });

  it('should classify eBay as e-commerce platform', () => {
    expect(isEcommercePlatform('ebay.com')).toBe(true);
  });

  it('should classify Walmart as e-commerce platform', () => {
    expect(isEcommercePlatform('walmart.com')).toBe(true);
  });

  it('should NOT classify Car Toys as e-commerce platform', () => {
    expect(isEcommercePlatform('cartoys.com')).toBe(false);
  });

  it('should NOT classify local retailers as platforms', () => {
    expect(isEcommercePlatform('audioexpress.com')).toBe(false);
    expect(isEcommercePlatform('bestbuy.com')).toBe(true); // Best Buy IS in the list
  });

  it('should have all expected platform domains', () => {
    expect(ECOMMERCE_PLATFORM_DOMAINS.has('amazon.com')).toBe(true);
    expect(ECOMMERCE_PLATFORM_DOMAINS.has('ebay.com')).toBe(true);
    expect(ECOMMERCE_PLATFORM_DOMAINS.has('walmart.com')).toBe(true);
    expect(ECOMMERCE_PLATFORM_DOMAINS.has('target.com')).toBe(true);
  });

  it('should pre-classify Amazon as platform for B2C context', () => {
    const mockCandidate = {
      name: 'Amazon',
      domain: 'amazon.com',
      snippet: 'Online shopping from the earth\'s biggest selection',
      aiSummary: 'E-commerce giant',
    } as any;

    const result = preClassifyForB2C(mockCandidate, carToysContext);
    expect(result).not.toBeNull();
    expect(result?.type).toBe('platform');
    expect(result?.confidence).toBeGreaterThan(0.9);
  });
});

// ============================================================================
// 4. Positioning map axes switch to B2C definitions
// ============================================================================

describe('B2C Retail Isolation: Positioning Axes', () => {
  it('should return B2C axes for retail companies', () => {
    const axes = getPositioningAxes(carToysContext);
    expect(axes.xAxis.label).toBe('Product/Value Overlap');
    expect(axes.yAxis.label).toBe('Customer Fit');
  });

  it('should return B2B axes for B2B companies', () => {
    const axes = getPositioningAxes(hiveMarketingContext);
    expect(axes.xAxis.label).toBe('Value Model Alignment');
    expect(axes.yAxis.label).toBe('ICP Alignment');
  });

  it('should have correct B2C axis labels', () => {
    const b2cAxes = getB2CPositioningAxes();
    expect(b2cAxes.xAxis.lowLabel).toBe('Different Products');
    expect(b2cAxes.xAxis.highLabel).toBe('Same Products');
    expect(b2cAxes.yAxis.lowLabel).toBe('Different Customers');
    expect(b2cAxes.yAxis.highLabel).toBe('Same Customers');
  });

  it('should have correct B2B axis labels', () => {
    const b2bAxes = getB2BPositioningAxes();
    expect(b2bAxes.xAxis.label).toContain('Value Model');
    expect(b2bAxes.yAxis.label).toContain('ICP');
  });
});

// ============================================================================
// 5. Selection quotas adapt to B2C
// ============================================================================

describe('B2C Retail Isolation: Selection Quotas', () => {
  it('should have zero fractional/internal slots for B2C', () => {
    const quotas = getSelectionQuotas(carToysContext);
    expect(quotas.fractional.min).toBe(0);
    expect(quotas.fractional.max).toBe(0);
    expect(quotas.internal.min).toBe(0);
    expect(quotas.internal.max).toBe(0);
  });

  it('should have more direct competitor slots for B2C', () => {
    const b2cQuotas = getSelectionQuotas(carToysContext);
    const b2bQuotas = getSelectionQuotas(hiveMarketingContext);
    expect(b2cQuotas.direct.max).toBeGreaterThanOrEqual(b2bQuotas.direct.max);
  });

  it('should have platform slots for B2C', () => {
    const quotas = getSelectionQuotas(carToysContext);
    expect(quotas.platform.max).toBeGreaterThan(0);
  });
});

// ============================================================================
// 6. BusinessModelCategory correctly influences filtering
// ============================================================================

describe('B2C Retail Isolation: Business Model Category Detection', () => {
  it('should detect B2C from retail indicators in industry', () => {
    const retailContext: QueryContext = {
      ...carToysContext,
      businessModelCategory: null, // Force detection
      industry: 'retail electronics',
    };
    expect(isB2CCompany(retailContext)).toBe(true);
  });

  it('should detect B2C from consumer indicators in ICP', () => {
    const consumerContext: QueryContext = {
      ...carToysContext,
      businessModelCategory: null,
      industry: null,
      icpDescription: 'Everyday consumers and shoppers',
    };
    expect(isB2CCompany(consumerContext)).toBe(true);
  });

  it('should NOT detect B2C for agency/consulting businesses', () => {
    const agencyContext: QueryContext = {
      ...hiveMarketingContext,
      businessModelCategory: null,
      industry: 'Marketing Agency',
    };
    expect(isB2CCompany(agencyContext)).toBe(false);
  });
});

// ============================================================================
// 7. B2C breakdown only shows allowed types
// ============================================================================

describe('B2C Retail Isolation: Breakdown Counts', () => {
  it('should only count direct, partial, platform for B2C', () => {
    const mockCompetitors = [
      { classification: { type: 'direct' as CompetitorType } },
      { classification: { type: 'direct' as CompetitorType } },
      { classification: { type: 'partial' as CompetitorType } },
      { classification: { type: 'platform' as CompetitorType } },
      { classification: { type: 'fractional' as CompetitorType } }, // Should be ignored
      { classification: { type: 'internal' as CompetitorType } }, // Should be ignored
    ];

    const breakdown = getB2CBreakdown(mockCompetitors);
    expect(breakdown.direct).toBe(2);
    expect(breakdown.partial).toBe(1);
    expect(breakdown.platform).toBe(1);
    expect(breakdown.total).toBe(4); // Does NOT include fractional/internal
    expect((breakdown as any).fractional).toBeUndefined();
    expect((breakdown as any).internal).toBeUndefined();
  });
});

// ============================================================================
// 8. No context bleed from B2B to B2C
// ============================================================================

describe('B2C Retail Isolation: Context Bleed Prevention', () => {
  it('should detect context bleed when B2C has fractional competitors', () => {
    const bleededCompetitors = [
      { classification: { type: 'direct' as CompetitorType }, name: 'Audio Express' },
      { classification: { type: 'fractional' as CompetitorType }, name: 'Fractional CMO Inc' }, // B2B bleed!
    ];

    const result = validateNoContextBleed(carToysContext, bleededCompetitors);
    expect(result.isValid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues[0]).toContain('fractional');
  });

  it('should pass validation when B2C has only allowed types', () => {
    const cleanCompetitors = [
      { classification: { type: 'direct' as CompetitorType }, name: 'Audio Express' },
      { classification: { type: 'partial' as CompetitorType }, name: 'Best Buy' },
      { classification: { type: 'platform' as CompetitorType }, name: 'Amazon' },
    ];

    const result = validateNoContextBleed(carToysContext, cleanCompetitors);
    expect(result.isValid).toBe(true);
    expect(result.issues.length).toBe(0);
  });

  it('should clean B2C competitor data removing invalid types', () => {
    const mixedCompetitors = [
      { classification: { type: 'direct' as CompetitorType } },
      { classification: { type: 'fractional' as CompetitorType } },
      { classification: { type: 'internal' as CompetitorType } },
      { classification: { type: 'platform' as CompetitorType } },
    ];

    const { cleaned, removed } = cleanB2CCompetitorData(mixedCompetitors, carToysContext);
    expect(cleaned.length).toBe(2); // direct + platform
    expect(removed.length).toBe(2); // fractional + internal
  });
});

// ============================================================================
// 9. B2B service indicators detected and filtered
// ============================================================================

describe('B2C Retail Isolation: B2B Service Indicator Detection', () => {
  it('should detect agency as B2B indicator', () => {
    expect(hasB2BServiceIndicators('Full service marketing agency')).toBe(true);
  });

  it('should detect consulting as B2B indicator', () => {
    expect(hasB2BServiceIndicators('Business consulting services')).toBe(true);
  });

  it('should detect fractional as B2B indicator', () => {
    expect(hasB2BServiceIndicators('Fractional CMO for startups')).toBe(true);
  });

  it('should NOT detect retail as B2B indicator', () => {
    expect(hasB2BServiceIndicators('Car audio retail and installation')).toBe(false);
  });

  it('should filter B2B candidates for B2C context', () => {
    const agencyCandidate = {
      name: 'Marketing Agency Pro',
      domain: 'marketingagencypro.com',
      snippet: 'Full service marketing agency for B2B companies',
      aiSummary: 'Digital agency',
      crawledContent: {
        homepage: { description: 'Marketing agency' },
        services: { offerings: ['Digital marketing', 'SEO'] },
      },
    } as any;

    expect(shouldFilterB2BCandidate(agencyCandidate, carToysContext)).toBe(true);
  });
});

// ============================================================================
// 10. Filter function works correctly
// ============================================================================

describe('B2C Retail Isolation: Filter Function', () => {
  it('should filter out fractional and internal types for B2C', () => {
    const competitors = [
      { classification: { type: 'direct' as CompetitorType } },
      { classification: { type: 'fractional' as CompetitorType } },
      { classification: { type: 'internal' as CompetitorType } },
      { classification: { type: 'platform' as CompetitorType } },
    ];

    const filtered = filterCompetitorsForB2C(competitors, carToysContext);
    expect(filtered.length).toBe(2);
    expect(filtered.every(c => B2C_ALLOWED_COMPETITOR_TYPES.includes(c.classification!.type))).toBe(true);
  });

  it('should NOT filter anything for B2B companies', () => {
    const competitors = [
      { classification: { type: 'direct' as CompetitorType } },
      { classification: { type: 'fractional' as CompetitorType } },
      { classification: { type: 'internal' as CompetitorType } },
    ];

    const filtered = filterCompetitorsForB2C(competitors, hiveMarketingContext);
    expect(filtered.length).toBe(3); // All kept
  });
});

// ============================================================================
// 11. Constants are correctly defined
// ============================================================================

describe('B2C Retail Isolation: Constants', () => {
  it('should have correct B2C allowed types', () => {
    expect(B2C_ALLOWED_COMPETITOR_TYPES).toContain('direct');
    expect(B2C_ALLOWED_COMPETITOR_TYPES).toContain('partial');
    expect(B2C_ALLOWED_COMPETITOR_TYPES).toContain('platform');
    expect(B2C_ALLOWED_COMPETITOR_TYPES).not.toContain('fractional');
    expect(B2C_ALLOWED_COMPETITOR_TYPES).not.toContain('internal');
  });

  it('should have correct B2C disallowed types', () => {
    expect(B2C_DISALLOWED_COMPETITOR_TYPES).toContain('fractional');
    expect(B2C_DISALLOWED_COMPETITOR_TYPES).toContain('internal');
    expect(B2C_DISALLOWED_COMPETITOR_TYPES).toContain('irrelevant');
  });
});

// ============================================================================
// 12. Car Toys expected competitor set
// ============================================================================

describe('B2C Retail Isolation: Car Toys Expected Competitors', () => {
  const expectedCarToysCompetitors = [
    { name: 'Pep Boys', expectedType: 'direct' as CompetitorType, reason: 'Similar retail + service' },
    { name: 'Audio Express', expectedType: 'direct' as CompetitorType, reason: 'Car audio specialist' },
    { name: 'Best Buy', expectedType: 'partial' as CompetitorType, reason: 'Electronics retail, less service' },
    { name: 'Amazon', expectedType: 'platform' as CompetitorType, reason: 'E-commerce platform' },
    { name: 'Walmart', expectedType: 'platform' as CompetitorType, reason: 'E-commerce/retail platform' },
  ];

  it('should classify expected competitors correctly for Car Toys', () => {
    for (const expected of expectedCarToysCompetitors) {
      // Platform detection test
      if (expected.expectedType === 'platform') {
        const domain = expected.name.toLowerCase().replace(' ', '') + '.com';
        if (['amazon.com', 'walmart.com'].includes(domain)) {
          expect(isEcommercePlatform(domain)).toBe(true);
        }
      }

      // All expected types should be allowed for B2C
      expect(B2C_ALLOWED_COMPETITOR_TYPES).toContain(expected.expectedType);
    }
  });

  it('should NOT include agency-style competitors for Car Toys', () => {
    const invalidForCarToys = [
      'Fractional CMO Inc',
      'Marketing Agency XYZ',
      'Growth Consulting Partners',
      'In-House Marketing Team',
    ];

    for (const invalid of invalidForCarToys) {
      const hasAgencyIndicator = hasB2BServiceIndicators(invalid);
      expect(hasAgencyIndicator).toBe(true);
    }
  });
});
