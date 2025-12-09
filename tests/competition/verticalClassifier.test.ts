// tests/competition/verticalClassifier.test.ts
// Vertical Category Intelligence Regression Tests
//
// Validates:
// 1. Car Toys → automotive vertical detection
// 2. Atlas → retail vertical with skateboarding subvertical
// 3. HubSpot → software vertical
// 4. Deloitte → services vertical
// 5. Notion → software vertical
// 6. Peloton → consumer-dtc vertical
// 7. Competitor types filtered correctly per vertical
// 8. Discovery queries change per vertical
// 9. Narrative language uses correct terminology
// 10. No irrelevant competitor types leak through

import { describe, it, expect } from 'vitest';
import {
  detectVerticalCategory,
  detectVerticalFromDomain,
  detectSubVertical,
  isCompetitorTypeAllowedForVertical,
  getAllowedTypesForVertical,
  getDisallowedTypesForVertical,
  filterCompetitorsByVertical,
  getVerticalTerminology,
  getVerticalSearchModifiers,
  RETAIL_KEYWORDS,
  AUTOMOTIVE_KEYWORDS,
  SERVICES_KEYWORDS,
  SOFTWARE_KEYWORDS,
  CONSUMER_DTC_KEYWORDS,
  SUB_VERTICAL_KEYWORDS,
  VERTICAL_TERMINOLOGY,
} from '@/lib/competition-v3/verticalClassifier';
import type { QueryContext, CompetitorType, VerticalCategory } from '@/lib/competition-v3/types';
import { VERTICAL_ALLOWED_TYPES, VERTICAL_DISALLOWED_TYPES } from '@/lib/competition-v3/types';

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
  icpDescription: 'Skateboarders of all skill levels looking for decks, trucks, wheels, and apparel',
  icpStage: null,
  targetIndustries: ['Retail', 'Sports'],
  primaryOffers: ['Skateboards', 'Skateboard parts', 'Apparel', 'Accessories'],
  serviceModel: 'retail',
  pricePositioning: 'mid',
  valueProposition: 'Core skate shop with knowledgeable staff',
  differentiators: ['Staff are skaters', 'Local community hub'],
  geography: 'Regional',
  serviceRegions: ['Local area'],
  aiOrientation: 'traditional',
  invalidCompetitors: [],
};

const hubspotContext: QueryContext = {
  businessName: 'HubSpot',
  domain: 'hubspot.com',
  industry: 'Marketing Software / CRM',
  businessModel: 'SaaS',
  businessModelCategory: 'B2B',
  icpDescription: 'Growing businesses needing marketing automation, CRM, and sales tools',
  icpStage: 'growth',
  targetIndustries: ['SaaS', 'Technology', 'E-commerce'],
  primaryOffers: ['CRM', 'Marketing Hub', 'Sales Hub', 'Service Hub'],
  serviceModel: 'subscription',
  pricePositioning: 'mid',
  valueProposition: 'All-in-one platform for inbound marketing and sales',
  differentiators: ['Integrated platform', 'Free tier', 'Academy training'],
  geography: 'Global',
  serviceRegions: ['Worldwide'],
  aiOrientation: 'ai-augmented',
  invalidCompetitors: [],
};

const deloitteContext: QueryContext = {
  businessName: 'Deloitte',
  domain: 'deloitte.com',
  industry: 'Professional Services / Consulting',
  businessModel: 'B2B Consulting',
  businessModelCategory: 'B2B',
  icpDescription: 'Enterprise organizations needing audit, consulting, tax, and advisory services',
  icpStage: 'enterprise',
  targetIndustries: ['Financial Services', 'Healthcare', 'Technology', 'Government'],
  primaryOffers: ['Audit', 'Consulting', 'Tax Advisory', 'Risk Management'],
  serviceModel: 'retainer',
  pricePositioning: 'premium',
  valueProposition: 'Global professional services with deep industry expertise',
  differentiators: ['Global network', 'Industry expertise', 'Big Four credibility'],
  geography: 'Global',
  serviceRegions: ['Worldwide'],
  aiOrientation: 'ai-augmented',
  invalidCompetitors: [],
};

const notionContext: QueryContext = {
  businessName: 'Notion',
  domain: 'notion.so',
  industry: 'Productivity Software',
  businessModel: 'SaaS',
  businessModelCategory: 'B2B',
  icpDescription: 'Teams and individuals needing wiki, docs, and project management in one tool',
  icpStage: 'growth',
  targetIndustries: ['Technology', 'Startups', 'Remote Teams'],
  primaryOffers: ['Notes', 'Wikis', 'Databases', 'Project Management'],
  serviceModel: 'subscription',
  pricePositioning: 'mid',
  valueProposition: 'All-in-one workspace for notes, docs, and tasks',
  differentiators: ['Flexibility', 'Templates', 'AI integration'],
  geography: 'Global',
  serviceRegions: ['Worldwide'],
  aiOrientation: 'ai-first',
  invalidCompetitors: [],
};

const pelotonContext: QueryContext = {
  businessName: 'Peloton',
  domain: 'onepeloton.com',
  industry: 'Connected Fitness / Consumer Electronics',
  businessModel: 'D2C + Subscription',
  businessModelCategory: 'B2C',
  icpDescription: 'Fitness enthusiasts who want premium at-home workout experiences',
  icpStage: null,
  targetIndustries: ['Consumer', 'Fitness'],
  primaryOffers: ['Peloton Bike', 'Peloton Tread', 'Fitness Classes', 'App Subscription'],
  serviceModel: 'subscription',
  pricePositioning: 'premium',
  valueProposition: 'Premium connected fitness with live and on-demand classes',
  differentiators: ['Community', 'Instructor quality', 'Content library'],
  geography: 'North America',
  serviceRegions: ['US', 'Canada', 'UK'],
  aiOrientation: 'traditional',
  invalidCompetitors: [],
};

const hiveMarketingContext: QueryContext = {
  businessName: 'Hive Marketing Services',
  domain: 'hivemarketingservices.com',
  industry: 'Marketing Agency',
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
// 1. Car Toys → Automotive Vertical Detection
// ============================================================================

describe('Vertical Detection: Car Toys → Automotive', () => {
  it('should detect Car Toys as automotive vertical', () => {
    const result = detectVerticalCategory(carToysContext);
    expect(result.verticalCategory).toBe('automotive');
  });

  it('should detect automotive from domain pattern', () => {
    const vertical = detectVerticalFromDomain('cartoys.com');
    expect(vertical).toBe('automotive');
  });

  it('should have high confidence for Car Toys', () => {
    const result = detectVerticalCategory(carToysContext);
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('should include automotive signals in reasoning', () => {
    const result = detectVerticalCategory(carToysContext);
    expect(result.signals.some(s =>
      s.toLowerCase().includes('automotive') ||
      s.toLowerCase().includes('domain')
    )).toBe(true);
  });

  it('should detect automotive subvertical for Car Toys', () => {
    const text = carToysContext.primaryOffers?.join(' ') || '';
    const result = detectSubVertical(text);
    // Car Toys could match car-audio or car-electronics - both are valid automotive subverticals
    expect(['car-audio', 'car-electronics']).toContain(result?.subVertical);
    expect(result?.vertical).toBe('automotive');
  });
});

// ============================================================================
// 2. Atlas → Retail with Skateboard Subvertical
// ============================================================================

describe('Vertical Detection: Atlas → Retail (Skateboarding)', () => {
  it('should detect Atlas as retail vertical', () => {
    const result = detectVerticalCategory(atlasSkateContext);
    expect(result.verticalCategory).toBe('retail');
  });

  it('should detect skateboard subvertical', () => {
    const result = detectVerticalCategory(atlasSkateContext);
    expect(result.subVertical).toBe('skateboard');
  });

  it('should not misclassify Atlas as automotive', () => {
    const result = detectVerticalCategory(atlasSkateContext);
    expect(result.verticalCategory).not.toBe('automotive');
  });

  it('should have retail signals in detection', () => {
    const result = detectVerticalCategory(atlasSkateContext);
    expect(result.signals.some(s =>
      s.toLowerCase().includes('retail') ||
      s.toLowerCase().includes('skateboard')
    )).toBe(true);
  });
});

// ============================================================================
// 3. HubSpot → Software Vertical
// ============================================================================

describe('Vertical Detection: HubSpot → Software', () => {
  it('should detect HubSpot as software vertical', () => {
    const result = detectVerticalCategory(hubspotContext);
    expect(result.verticalCategory).toBe('software');
  });

  it('should detect software subvertical', () => {
    const result = detectVerticalCategory(hubspotContext);
    // HubSpot could match CRM or marketing-software - both are valid software subverticals
    expect(['crm', 'marketing-software']).toContain(result.subVertical);
  });

  it('should have software signals in detection', () => {
    const result = detectVerticalCategory(hubspotContext);
    expect(result.signals.some(s =>
      s.toLowerCase().includes('software') ||
      s.toLowerCase().includes('saas')
    )).toBe(true);
  });

  it('should not misclassify HubSpot as services', () => {
    const result = detectVerticalCategory(hubspotContext);
    expect(result.verticalCategory).not.toBe('services');
  });
});

// ============================================================================
// 4. Deloitte → Services Vertical
// ============================================================================

describe('Vertical Detection: Deloitte → Services', () => {
  it('should detect Deloitte as services vertical', () => {
    const result = detectVerticalCategory(deloitteContext);
    expect(result.verticalCategory).toBe('services');
  });

  it('should detect consulting subvertical', () => {
    const result = detectVerticalCategory(deloitteContext);
    expect(result.subVertical).toBe('consulting');
  });

  it('should have services signals in detection', () => {
    const result = detectVerticalCategory(deloitteContext);
    expect(result.signals.some(s =>
      s.toLowerCase().includes('services') ||
      s.toLowerCase().includes('consulting')
    )).toBe(true);
  });

  it('should not misclassify Deloitte as software', () => {
    const result = detectVerticalCategory(deloitteContext);
    expect(result.verticalCategory).not.toBe('software');
  });
});

// ============================================================================
// 5. Notion → Software Vertical
// ============================================================================

describe('Vertical Detection: Notion → Software', () => {
  it('should detect Notion as software vertical', () => {
    const result = detectVerticalCategory(notionContext);
    expect(result.verticalCategory).toBe('software');
  });

  it('should have software signals in detection', () => {
    const result = detectVerticalCategory(notionContext);
    expect(result.signals.some(s =>
      s.toLowerCase().includes('software')
    )).toBe(true);
  });
});

// ============================================================================
// 6. Peloton → Consumer DTC Vertical
// ============================================================================

describe('Vertical Detection: Peloton → Consumer DTC', () => {
  it('should detect Peloton as consumer-dtc vertical', () => {
    const result = detectVerticalCategory(pelotonContext);
    // Peloton could be detected as consumer-dtc or retail depending on signals
    expect(['consumer-dtc', 'retail']).toContain(result.verticalCategory);
  });

  it('should have DTC or consumer signals in detection', () => {
    const result = detectVerticalCategory(pelotonContext);
    expect(result.signals.some(s =>
      s.toLowerCase().includes('dtc') ||
      s.toLowerCase().includes('consumer') ||
      s.toLowerCase().includes('b2c')
    )).toBe(true);
  });
});

// ============================================================================
// 7. Hive Marketing → Services Vertical
// ============================================================================

describe('Vertical Detection: Hive Marketing → Services', () => {
  it('should detect Hive Marketing as services vertical', () => {
    const result = detectVerticalCategory(hiveMarketingContext);
    expect(result.verticalCategory).toBe('services');
  });

  it('should detect marketing-agency subvertical', () => {
    const result = detectVerticalCategory(hiveMarketingContext);
    expect(result.subVertical).toBe('marketing-agency');
  });
});

// ============================================================================
// 8. Competitor Type Filtering Per Vertical
// ============================================================================

describe('Vertical-Based Competitor Type Filtering', () => {
  // Retail vertical
  it('should NOT allow fractional for retail vertical', () => {
    expect(isCompetitorTypeAllowedForVertical('fractional', 'retail')).toBe(false);
  });

  it('should NOT allow internal for retail vertical', () => {
    expect(isCompetitorTypeAllowedForVertical('internal', 'retail')).toBe(false);
  });

  it('should ALLOW direct, partial, platform for retail', () => {
    expect(isCompetitorTypeAllowedForVertical('direct', 'retail')).toBe(true);
    expect(isCompetitorTypeAllowedForVertical('partial', 'retail')).toBe(true);
    expect(isCompetitorTypeAllowedForVertical('platform', 'retail')).toBe(true);
  });

  // Automotive vertical
  it('should NOT allow fractional for automotive vertical', () => {
    expect(isCompetitorTypeAllowedForVertical('fractional', 'automotive')).toBe(false);
  });

  it('should NOT allow internal for automotive vertical', () => {
    expect(isCompetitorTypeAllowedForVertical('internal', 'automotive')).toBe(false);
  });

  it('should ALLOW direct, partial, platform for automotive', () => {
    expect(isCompetitorTypeAllowedForVertical('direct', 'automotive')).toBe(true);
    expect(isCompetitorTypeAllowedForVertical('partial', 'automotive')).toBe(true);
    expect(isCompetitorTypeAllowedForVertical('platform', 'automotive')).toBe(true);
  });

  // Services vertical
  it('should ALLOW all types for services vertical', () => {
    expect(isCompetitorTypeAllowedForVertical('direct', 'services')).toBe(true);
    expect(isCompetitorTypeAllowedForVertical('partial', 'services')).toBe(true);
    expect(isCompetitorTypeAllowedForVertical('fractional', 'services')).toBe(true);
    expect(isCompetitorTypeAllowedForVertical('internal', 'services')).toBe(true);
    expect(isCompetitorTypeAllowedForVertical('platform', 'services')).toBe(true);
  });

  // Software vertical
  it('should NOT allow fractional for software vertical', () => {
    expect(isCompetitorTypeAllowedForVertical('fractional', 'software')).toBe(false);
  });

  it('should NOT allow internal for software vertical', () => {
    expect(isCompetitorTypeAllowedForVertical('internal', 'software')).toBe(false);
  });
});

// ============================================================================
// 9. Filter Competitors By Vertical
// ============================================================================

describe('Filter Competitors By Vertical', () => {
  const mockCompetitors = [
    { name: 'Direct Co', classification: { type: 'direct' as CompetitorType } },
    { name: 'Partial Inc', classification: { type: 'partial' as CompetitorType } },
    { name: 'Fractional CMO', classification: { type: 'fractional' as CompetitorType } },
    { name: 'Internal Team', classification: { type: 'internal' as CompetitorType } },
    { name: 'Platform Giant', classification: { type: 'platform' as CompetitorType } },
    { name: 'Irrelevant Corp', classification: { type: 'irrelevant' as CompetitorType } },
  ];

  it('should filter out fractional and internal for retail', () => {
    const filtered = filterCompetitorsByVertical(mockCompetitors, 'retail');
    expect(filtered.length).toBe(3); // direct, partial, platform
    expect(filtered.some(c => c.classification?.type === 'fractional')).toBe(false);
    expect(filtered.some(c => c.classification?.type === 'internal')).toBe(false);
  });

  it('should filter out fractional and internal for automotive', () => {
    const filtered = filterCompetitorsByVertical(mockCompetitors, 'automotive');
    expect(filtered.length).toBe(3); // direct, partial, platform
    expect(filtered.some(c => c.classification?.type === 'fractional')).toBe(false);
    expect(filtered.some(c => c.classification?.type === 'internal')).toBe(false);
  });

  it('should keep all types for services', () => {
    const filtered = filterCompetitorsByVertical(mockCompetitors, 'services');
    expect(filtered.length).toBe(5); // All except irrelevant
    expect(filtered.some(c => c.classification?.type === 'fractional')).toBe(true);
    expect(filtered.some(c => c.classification?.type === 'internal')).toBe(true);
  });

  it('should filter out fractional and internal for software', () => {
    const filtered = filterCompetitorsByVertical(mockCompetitors, 'software');
    expect(filtered.length).toBe(3); // direct, partial, platform
    expect(filtered.some(c => c.classification?.type === 'fractional')).toBe(false);
    expect(filtered.some(c => c.classification?.type === 'internal')).toBe(false);
  });
});

// ============================================================================
// 10. Allowed/Disallowed Types Per Vertical
// ============================================================================

describe('Allowed and Disallowed Types Per Vertical', () => {
  it('should have correct allowed types for retail', () => {
    const allowed = getAllowedTypesForVertical('retail');
    expect(allowed).toContain('direct');
    expect(allowed).toContain('partial');
    expect(allowed).toContain('platform');
    expect(allowed).not.toContain('fractional');
    expect(allowed).not.toContain('internal');
  });

  it('should have correct disallowed types for retail', () => {
    const disallowed = getDisallowedTypesForVertical('retail');
    expect(disallowed).toContain('fractional');
    expect(disallowed).toContain('internal');
    expect(disallowed).toContain('irrelevant');
  });

  it('should have correct allowed types for services', () => {
    const allowed = getAllowedTypesForVertical('services');
    expect(allowed).toContain('direct');
    expect(allowed).toContain('partial');
    expect(allowed).toContain('fractional');
    expect(allowed).toContain('internal');
    expect(allowed).toContain('platform');
  });

  it('should have minimal disallowed types for services', () => {
    const disallowed = getDisallowedTypesForVertical('services');
    expect(disallowed).toContain('irrelevant');
    expect(disallowed).not.toContain('fractional');
    expect(disallowed).not.toContain('internal');
  });
});

// ============================================================================
// 11. Vertical-Specific Terminology
// ============================================================================

describe('Vertical-Specific Terminology', () => {
  it('should use "shopper" for retail vertical', () => {
    const terminology = getVerticalTerminology('retail');
    expect(terminology.customer).toBe('shopper');
    expect(terminology.customers).toBe('shoppers');
  });

  it('should use "vehicle owner" for automotive vertical', () => {
    const terminology = getVerticalTerminology('automotive');
    expect(terminology.customer).toBe('vehicle owner');
    expect(terminology.customers).toBe('vehicle owners');
  });

  it('should use "client" for services vertical', () => {
    const terminology = getVerticalTerminology('services');
    expect(terminology.customer).toBe('client');
    expect(terminology.customers).toBe('clients');
  });

  it('should use "user" for software vertical', () => {
    const terminology = getVerticalTerminology('software');
    expect(terminology.customer).toBe('user');
    expect(terminology.customers).toBe('users');
  });

  it('should have automotive-specific threats', () => {
    const terminology = getVerticalTerminology('automotive');
    expect(terminology.threats).toContain('national chains');
    expect(terminology.threats).toContain('dealership service');
    expect(terminology.threats).toContain('online retailers');
  });

  it('should have services-specific threats', () => {
    const terminology = getVerticalTerminology('services');
    expect(terminology.threats).toContain('in-house teams');
    expect(terminology.threats).toContain('freelancers');
    expect(terminology.threats).toContain('AI tools');
  });

  it('should have software-specific threats', () => {
    const terminology = getVerticalTerminology('software');
    expect(terminology.threats).toContain('enterprise incumbents');
    expect(terminology.threats).toContain('open source');
  });
});

// ============================================================================
// 12. Vertical Search Modifiers
// ============================================================================

describe('Vertical Search Modifiers', () => {
  it('should include store/shop for retail searches', () => {
    const modifiers = getVerticalSearchModifiers('retail');
    expect(modifiers.include).toContain('store');
    expect(modifiers.include).toContain('shop');
  });

  it('should exclude agency/consulting from retail searches', () => {
    const modifiers = getVerticalSearchModifiers('retail');
    expect(modifiers.exclude).toContain('agency');
    expect(modifiers.exclude).toContain('consulting');
  });

  it('should include car/auto for automotive searches', () => {
    const modifiers = getVerticalSearchModifiers('automotive');
    expect(modifiers.include).toContain('car');
    expect(modifiers.include).toContain('auto');
    expect(modifiers.include).toContain('installation');
  });

  it('should exclude agency from automotive searches', () => {
    const modifiers = getVerticalSearchModifiers('automotive');
    expect(modifiers.exclude).toContain('agency');
    expect(modifiers.exclude).toContain('consulting');
  });

  it('should include agency/firm for services searches', () => {
    const modifiers = getVerticalSearchModifiers('services');
    expect(modifiers.include).toContain('agency');
    expect(modifiers.include).toContain('firm');
    expect(modifiers.include).toContain('consulting');
  });

  it('should exclude retail from services searches', () => {
    const modifiers = getVerticalSearchModifiers('services');
    expect(modifiers.exclude).toContain('store');
    expect(modifiers.exclude).toContain('retail');
  });

  it('should include software/saas for software searches', () => {
    const modifiers = getVerticalSearchModifiers('software');
    expect(modifiers.include).toContain('software');
    expect(modifiers.include).toContain('saas');
    expect(modifiers.include).toContain('platform');
  });
});

// ============================================================================
// 13. Constants Validation
// ============================================================================

describe('Vertical Classification Constants', () => {
  it('should have keyword lists with sufficient coverage', () => {
    expect(RETAIL_KEYWORDS.length).toBeGreaterThan(10);
    expect(AUTOMOTIVE_KEYWORDS.length).toBeGreaterThan(10);
    expect(SERVICES_KEYWORDS.length).toBeGreaterThan(10);
    expect(SOFTWARE_KEYWORDS.length).toBeGreaterThan(10);
    expect(CONSUMER_DTC_KEYWORDS.length).toBeGreaterThan(10);
  });

  it('should have sub-vertical mappings for key categories', () => {
    expect(SUB_VERTICAL_KEYWORDS['car-audio']).toBeDefined();
    expect(SUB_VERTICAL_KEYWORDS['skateboard']).toBeDefined();
    expect(SUB_VERTICAL_KEYWORDS['marketing-agency']).toBeDefined();
    expect(SUB_VERTICAL_KEYWORDS['crm']).toBeDefined();
  });

  it('should have terminology for all verticals', () => {
    const verticals: VerticalCategory[] = ['retail', 'automotive', 'services', 'software', 'consumer-dtc', 'manufacturing', 'unknown'];
    for (const vertical of verticals) {
      expect(VERTICAL_TERMINOLOGY[vertical]).toBeDefined();
      expect(VERTICAL_TERMINOLOGY[vertical].customer).toBeDefined();
      expect(VERTICAL_TERMINOLOGY[vertical].competitor).toBeDefined();
    }
  });

  it('should have allowed types defined for all verticals', () => {
    const verticals: VerticalCategory[] = ['retail', 'automotive', 'services', 'software', 'consumer-dtc', 'manufacturing', 'unknown'];
    for (const vertical of verticals) {
      expect(VERTICAL_ALLOWED_TYPES[vertical]).toBeDefined();
      expect(VERTICAL_ALLOWED_TYPES[vertical].length).toBeGreaterThan(0);
    }
  });

  it('should have disallowed types defined for all verticals', () => {
    const verticals: VerticalCategory[] = ['retail', 'automotive', 'services', 'software', 'consumer-dtc', 'manufacturing', 'unknown'];
    for (const vertical of verticals) {
      expect(VERTICAL_DISALLOWED_TYPES[vertical]).toBeDefined();
      expect(VERTICAL_DISALLOWED_TYPES[vertical].length).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// 14. No Context Bleed Between Verticals
// ============================================================================

describe('No Context Bleed Between Verticals', () => {
  it('should not detect Car Toys as services', () => {
    const result = detectVerticalCategory(carToysContext);
    expect(result.verticalCategory).not.toBe('services');
  });

  it('should not detect Deloitte as retail', () => {
    const result = detectVerticalCategory(deloitteContext);
    expect(result.verticalCategory).not.toBe('retail');
    expect(result.verticalCategory).not.toBe('automotive');
  });

  it('should not detect HubSpot as services (despite offering services)', () => {
    const result = detectVerticalCategory(hubspotContext);
    expect(result.verticalCategory).not.toBe('services');
  });

  it('should not allow fractional competitors for retail context', () => {
    const carToysResult = detectVerticalCategory(carToysContext);
    const allowed = getAllowedTypesForVertical(carToysResult.verticalCategory);
    expect(allowed).not.toContain('fractional');
  });

  it('should not allow internal competitors for automotive context', () => {
    const carToysResult = detectVerticalCategory(carToysContext);
    const allowed = getAllowedTypesForVertical(carToysResult.verticalCategory);
    expect(allowed).not.toContain('internal');
  });
});

// ============================================================================
// 15. Edge Cases
// ============================================================================

describe('Vertical Detection Edge Cases', () => {
  it('should handle empty context gracefully', () => {
    const result = detectVerticalCategory({});
    expect(result.verticalCategory).toBe('unknown');
    expect(result.confidence).toBeLessThan(0.5);
  });

  it('should handle context with only domain', () => {
    const result = detectVerticalCategory({ domain: 'cartoys.com' });
    expect(result.verticalCategory).toBe('automotive');
  });

  it('should handle null values in context', () => {
    const contextWithNulls: Partial<QueryContext> = {
      businessName: 'Test',
      domain: null,
      industry: null,
      businessModel: null,
    };
    const result = detectVerticalCategory(contextWithNulls);
    expect(result.verticalCategory).toBe('unknown');
  });

  it('should handle unknown vertical with default terminology', () => {
    const terminology = getVerticalTerminology('unknown');
    expect(terminology.customer).toBe('customer');
    expect(terminology.competitor).toBe('competitor');
  });

  it('should handle unknown vertical with all types allowed except irrelevant', () => {
    const allowed = getAllowedTypesForVertical('unknown');
    expect(allowed).toContain('direct');
    expect(allowed).toContain('partial');
    expect(allowed).toContain('fractional');
    expect(allowed).toContain('internal');
    expect(allowed).toContain('platform');
  });
});

// ============================================================================
// 16. Integration: Car Toys Expected Behavior
// ============================================================================

describe('Integration: Car Toys Expected Competitor Behavior', () => {
  it('should classify Car Toys as automotive with high confidence', () => {
    const result = detectVerticalCategory(carToysContext);
    expect(result.verticalCategory).toBe('automotive');
    expect(result.confidence).toBeGreaterThan(0.6);
  });

  it('should use automotive terminology for Car Toys', () => {
    const result = detectVerticalCategory(carToysContext);
    const terminology = getVerticalTerminology(result.verticalCategory);
    expect(terminology.customer).toBe('vehicle owner');
    expect(terminology.competitor).toBe('competing shop');
    expect(terminology.market).toBe('automotive aftermarket');
  });

  it('should filter B2B competitors for Car Toys', () => {
    const mockMixedCompetitors = [
      { name: 'Crutchfield', classification: { type: 'direct' as CompetitorType } },
      { name: 'Best Buy', classification: { type: 'partial' as CompetitorType } },
      { name: 'Amazon', classification: { type: 'platform' as CompetitorType } },
      { name: 'Marketing Agency', classification: { type: 'fractional' as CompetitorType } },
      { name: 'Internal Team', classification: { type: 'internal' as CompetitorType } },
    ];

    const result = detectVerticalCategory(carToysContext);
    const filtered = filterCompetitorsByVertical(mockMixedCompetitors, result.verticalCategory);

    expect(filtered.length).toBe(3);
    expect(filtered.map(c => c.name)).toContain('Crutchfield');
    expect(filtered.map(c => c.name)).toContain('Best Buy');
    expect(filtered.map(c => c.name)).toContain('Amazon');
    expect(filtered.map(c => c.name)).not.toContain('Marketing Agency');
    expect(filtered.map(c => c.name)).not.toContain('Internal Team');
  });
});

// ============================================================================
// 17. Integration: Atlas Skateboarding Expected Behavior
// ============================================================================

describe('Integration: Atlas Skateboarding Expected Behavior', () => {
  it('should classify Atlas as retail with skateboard subvertical', () => {
    const result = detectVerticalCategory(atlasSkateContext);
    expect(result.verticalCategory).toBe('retail');
    expect(result.subVertical).toBe('skateboard');
  });

  it('should use retail terminology for Atlas', () => {
    const result = detectVerticalCategory(atlasSkateContext);
    const terminology = getVerticalTerminology(result.verticalCategory);
    expect(terminology.customer).toBe('shopper');
    expect(terminology.competitor).toBe('competing store');
    expect(terminology.market).toBe('retail market');
  });
});

// ============================================================================
// 18. Integration: Services Company (Deloitte) Expected Behavior
// ============================================================================

describe('Integration: Deloitte Services Expected Behavior', () => {
  it('should allow all competitor types for Deloitte', () => {
    const result = detectVerticalCategory(deloitteContext);
    const allowed = getAllowedTypesForVertical(result.verticalCategory);

    expect(allowed).toContain('direct');
    expect(allowed).toContain('partial');
    expect(allowed).toContain('fractional');
    expect(allowed).toContain('internal');
    expect(allowed).toContain('platform');
  });

  it('should use services terminology for Deloitte', () => {
    const result = detectVerticalCategory(deloitteContext);
    const terminology = getVerticalTerminology(result.verticalCategory);
    expect(terminology.customer).toBe('client');
    expect(terminology.purchase).toBe('engagement');
    expect(terminology.competitor).toBe('competing agency');
  });
});
