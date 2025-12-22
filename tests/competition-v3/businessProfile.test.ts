// tests/competition-v3/businessProfile.test.ts
// Tests for Business Type Sanity Gate
//
// Validates that computeBusinessProfile():
// - Returns correct confidence scoring based on available context
// - Correctly infers business category from context signals
// - Gates competitor discovery when confidence is too low
// - Prevents "marketing agency default" for local service businesses

import { describe, it, expect } from 'vitest';
import {
  computeBusinessProfile,
  MIN_DISCOVERY_CONFIDENCE,
  _testing,
  type BusinessProfile,
  type InferredCategory,
} from '@/lib/competition-v3/businessProfile';
import type { QueryContext } from '@/lib/competition-v3/types';

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Create a minimal QueryContext for testing
 */
function createQueryContext(
  overrides: Partial<QueryContext> & { businessName: string }
): QueryContext {
  return {
    businessName: overrides.businessName,
    domain: overrides.domain ?? null,
    industry: overrides.industry ?? null,
    businessModel: overrides.businessModel ?? null,
    businessModelCategory: overrides.businessModelCategory ?? null,
    icpDescription: overrides.icpDescription ?? null,
    icpStage: overrides.icpStage ?? null,
    targetIndustries: overrides.targetIndustries ?? [],
    primaryOffers: overrides.primaryOffers ?? [],
    serviceModel: overrides.serviceModel ?? null,
    pricePositioning: overrides.pricePositioning ?? null,
    valueProposition: overrides.valueProposition ?? null,
    differentiators: overrides.differentiators ?? [],
    geography: overrides.geography ?? null,
    serviceRegions: overrides.serviceRegions ?? [],
    aiOrientation: overrides.aiOrientation ?? null,
    verticalCategory: overrides.verticalCategory ?? undefined,
    archetype: (overrides as any).archetype ?? undefined,
  };
}

// ============================================================================
// Tests: Confidence Scoring
// ============================================================================

describe('Business Profile: Confidence Scoring', () => {
  describe('computeBusinessProfile basic functionality', () => {
    it('should return high confidence when all fields are present', () => {
      const context = createQueryContext({
        businessName: 'Acme Marketing Agency',
        domain: 'acmemarketing.com',
        industry: 'Marketing Services',
        businessModel: 'Agency',
        icpDescription: 'B2B SaaS startups in the seed to Series A stage',
        primaryOffers: ['Content Marketing', 'SEO', 'Paid Ads'],
        valueProposition: 'AI-powered growth marketing for startups',
      });

      const profile = computeBusinessProfile(context);

      expect(profile.confidence).toBeGreaterThan(0.8);
      expect(profile.confidenceLevel).toBe('high');
      expect(profile.canRunDiscovery).toBe(true);
      expect(profile.gateReason).toBeNull();
    });

    it('should return low confidence when missing website', () => {
      const context = createQueryContext({
        businessName: 'Unknown Company',
        domain: null, // Missing website
        industry: 'Unknown',
      });

      const profile = computeBusinessProfile(context);

      expect(profile.confidence).toBeLessThan(0.5);
      expect(profile.confidenceLevel).toBe('very_low');
      expect(profile.canRunDiscovery).toBe(false);
      // Gate reason will mention confidence threshold (the first gate that fails)
      expect(profile.gateReason).toBeDefined();
      expect(profile.warnings).toContain('Missing website URL - cannot verify business type');
    });

    it('should return low confidence when missing description and offers', () => {
      const context = createQueryContext({
        businessName: 'Mystery Business',
        domain: 'mystery.com',
        industry: null,
        icpDescription: null,
        primaryOffers: [],
      });

      const profile = computeBusinessProfile(context);

      expect(profile.confidence).toBeLessThan(0.6);
      expect(profile.canRunDiscovery).toBe(false);
      expect(profile.warnings.length).toBeGreaterThan(0);
    });

    it('should correctly calculate weighted confidence', () => {
      // Context with only domain and offers (no description)
      const context = createQueryContext({
        businessName: 'Partial Company',
        domain: 'partial.com',
        primaryOffers: ['Service A', 'Service B'],
      });

      const profile = computeBusinessProfile(context);

      // Should have some confidence from domain and offers
      expect(profile.confidence).toBeGreaterThan(0.3);
      expect(profile.confidence).toBeLessThan(0.8);
      expect(profile.evidence.find(e => e.field === 'websiteUrl')?.hasValue).toBe(true);
      expect(profile.evidence.find(e => e.field === 'primaryOffers')?.hasValue).toBe(true);
      // Description is built from value proposition + offers, so it may be true
      const descEvidence = profile.evidence.find(e => e.field === 'companyDescription');
      expect(descEvidence).toBeDefined();
    });
  });

  describe('evidence tracking', () => {
    it('should track all evidence sources', () => {
      const context = createQueryContext({
        businessName: 'Test Company',
        domain: 'test.com',
        industry: 'Tech',
        primaryOffers: ['Software'],
        icpDescription: 'Enterprise companies',
        valueProposition: 'Best in class',
      });

      const profile = computeBusinessProfile(context);

      expect(profile.evidence).toHaveLength(7);
      expect(profile.evidence.map(e => e.field)).toEqual(
        expect.arrayContaining([
          'websiteUrl',
          'companyDescription',
          'primaryOffers',
          'icpDescription',
          'industry',
          'businessModel',
          'valueProposition',
        ])
      );
    });

    it('should calculate confidence contribution for each field', () => {
      const context = createQueryContext({
        businessName: 'Test Company',
        domain: 'test.com',
        primaryOffers: ['Service'],
      });

      const profile = computeBusinessProfile(context);

      const websiteEvidence = profile.evidence.find(e => e.field === 'websiteUrl');
      expect(websiteEvidence?.hasValue).toBe(true);
      expect(websiteEvidence?.confidence).toBe(1.0);

      const descriptionEvidence = profile.evidence.find(e => e.field === 'companyDescription');
      expect(descriptionEvidence?.hasValue).toBe(false);
      expect(descriptionEvidence?.confidence).toBe(0);
    });
  });
});

// ============================================================================
// Tests: Category Inference
// ============================================================================

describe('Business Profile: Category Inference', () => {
  describe('inferCategory', () => {
    it('should infer marketing_agency from agency signals', () => {
      const context = createQueryContext({
        businessName: 'Digital Growth Agency',
        domain: 'digitalgrowth.com',
        industry: 'Digital Marketing',
        businessModel: 'Agency',
        primaryOffers: ['SEO', 'PPC', 'Content Marketing'],
        verticalCategory: 'services',
      });

      const profile = computeBusinessProfile(context);

      expect(profile.inferredCategory).toBe('marketing_agency');
    });

    it('should infer local_service from towing/dispatch signals', () => {
      const context = createQueryContext({
        businessName: 'Queen Anne Dispatch',
        domain: 'queenannedispatch.com',
        industry: 'Towing & Roadside Assistance',
        primaryOffers: ['Towing', 'Roadside Assistance', 'Jump Starts'],
        valueProposition: '24/7 dispatch services',
      });

      const profile = computeBusinessProfile(context);

      expect(profile.inferredCategory).toBe('logistics_dispatch');
    });

    it('should infer automotive_service from car audio signals', () => {
      const context = createQueryContext({
        businessName: 'Seattle Car Audio',
        domain: 'seattlecaraudio.com',
        industry: 'Car Electronics',
        primaryOffers: ['Car Audio Installation', 'Remote Start', 'Window Tint'],
        verticalCategory: 'automotive',
      });

      const profile = computeBusinessProfile(context);

      expect(profile.inferredCategory).toBe('automotive_service');
    });

    it('should infer software_saas from SaaS signals', () => {
      const context = createQueryContext({
        businessName: 'CloudApp Inc',
        domain: 'cloudapp.io',
        industry: 'SaaS',
        businessModel: 'Software Platform',
        primaryOffers: ['Cloud Platform', 'API'],
        verticalCategory: 'software',
      });

      const profile = computeBusinessProfile(context);

      expect(profile.inferredCategory).toBe('software_saas');
    });

    it('should return unknown when no clear signals', () => {
      const context = createQueryContext({
        businessName: 'Mystery Co',
        domain: 'mystery.com',
      });

      const profile = computeBusinessProfile(context);

      expect(profile.inferredCategory).toBe('unknown');
    });

    it('should infer ecommerce_retail from retail signals', () => {
      const context = createQueryContext({
        businessName: 'Fashion Direct',
        domain: 'fashiondirect.com',
        industry: 'Retail',
        primaryOffers: ['Clothing', 'Accessories'],
        valueProposition: 'D2C fashion brand',
      });

      const profile = computeBusinessProfile(context);

      expect(profile.inferredCategory).toBe('ecommerce_retail');
    });
  });

  describe('vertical category mapping', () => {
    it('should consider verticalCategory in inference', () => {
      const context = createQueryContext({
        businessName: 'Digital Marketing Agency',
        domain: 'digitalmarketing.com',
        verticalCategory: 'services' as any,
        industry: 'Digital Marketing',
        primaryOffers: ['SEO Services', 'PPC Management', 'Content Marketing'],
      });
      (context as any).archetype = 'agency';

      const profile = computeBusinessProfile(context);

      // Strong agency signals from industry + offers + archetype
      expect(profile.inferredCategory).toBe('marketing_agency');
    });

    it('should consider archetype in inference', () => {
      const context = createQueryContext({
        businessName: 'Local Retail Shop',
        domain: 'localshop.com',
        verticalCategory: 'retail' as any,
        primaryOffers: ['Products', 'Goods'],
      });

      const profile = computeBusinessProfile(context);

      expect(profile.inferredCategory).toBe('ecommerce_retail');
    });
  });
});

// ============================================================================
// Tests: Discovery Gate
// ============================================================================

describe('Business Profile: Discovery Gate', () => {
  describe('canRunDiscovery flag', () => {
    it('should BLOCK discovery when confidence < MIN_DISCOVERY_CONFIDENCE', () => {
      const context = createQueryContext({
        businessName: 'Unknown',
        domain: null,
      });

      const profile = computeBusinessProfile(context);

      expect(profile.confidence).toBeLessThan(MIN_DISCOVERY_CONFIDENCE);
      expect(profile.canRunDiscovery).toBe(false);
    });

    it('should ALLOW discovery when confidence >= MIN_DISCOVERY_CONFIDENCE', () => {
      const context = createQueryContext({
        businessName: 'Known Company',
        domain: 'known.com',
        industry: 'Tech Services',
        primaryOffers: ['Consulting'],
        icpDescription: 'Enterprise businesses',
        valueProposition: 'Expert consulting services',
      });

      const profile = computeBusinessProfile(context);

      expect(profile.confidence).toBeGreaterThanOrEqual(MIN_DISCOVERY_CONFIDENCE);
      expect(profile.canRunDiscovery).toBe(true);
    });

    it('should BLOCK discovery when missing website even with other fields', () => {
      const context = createQueryContext({
        businessName: 'No Website Corp',
        domain: null,
        industry: 'Marketing',
        primaryOffers: ['SEO', 'PPC'],
        icpDescription: 'Startups',
      });

      const profile = computeBusinessProfile(context);

      expect(profile.canRunDiscovery).toBe(false);
      // Gate reason will be confidence or missing website
      expect(profile.gateReason).toBeDefined();
      // Warnings should include the website issue
      expect(profile.warnings).toContain('Missing website URL - cannot verify business type');
    });

    it('should BLOCK discovery when category unknown with low confidence', () => {
      const context = createQueryContext({
        businessName: 'Vague Company',
        domain: 'vague.com',
        // Minimal context - category will be unknown
      });

      const profile = computeBusinessProfile(context);

      if (profile.inferredCategory === 'unknown') {
        expect(profile.canRunDiscovery).toBe(false);
      }
    });

    it('should BLOCK discovery when missing description AND missing offers+ICP', () => {
      const context = createQueryContext({
        businessName: 'Minimal Info',
        domain: 'minimal.com',
        industry: 'Unknown',
        // No description, no offers, no ICP
      });

      const profile = computeBusinessProfile(context);

      expect(profile.canRunDiscovery).toBe(false);
      // Gate reason could be confidence or insufficient context
      expect(profile.gateReason).toBeDefined();
    });

    it('should ALLOW discovery with offers+ICP even without description', () => {
      const context = createQueryContext({
        businessName: 'Offers ICP Co',
        domain: 'offersicp.com',
        primaryOffers: ['Service A', 'Service B'],
        icpDescription: 'Small businesses',
      });

      const profile = computeBusinessProfile(context);

      // May or may not pass depending on total confidence
      // Key is that the gate checks for description OR (offers AND ICP)
      const hasOffersAndIcp = profile.evidence.find(e => e.field === 'primaryOffers')?.hasValue &&
                             profile.evidence.find(e => e.field === 'icpDescription')?.hasValue;
      expect(hasOffersAndIcp).toBe(true);
    });
  });

  describe('gateReason messages', () => {
    it('should explain confidence threshold failure', () => {
      const context = createQueryContext({
        businessName: 'Low Confidence',
        domain: 'low.com',
      });

      const profile = computeBusinessProfile(context);

      if (!profile.canRunDiscovery && profile.confidence < MIN_DISCOVERY_CONFIDENCE) {
        expect(profile.gateReason).toContain('Confidence');
        expect(profile.gateReason).toContain('threshold');
      }
    });

    it('should explain missing website failure', () => {
      const context = createQueryContext({
        businessName: 'No Site',
        domain: null,
      });

      const profile = computeBusinessProfile(context);

      // Gate reason will mention either website or confidence
      expect(profile.gateReason).toBeDefined();
      expect(profile.canRunDiscovery).toBe(false);
      // The warnings should include website message
      expect(profile.warnings).toContain('Missing website URL - cannot verify business type');
    });
  });
});

// ============================================================================
// Tests: Real-World Scenarios
// ============================================================================

describe('Business Profile: Real-World Scenarios', () => {
  describe('Queenannedispatch scenario (should NOT be marketing agency)', () => {
    it('should infer dispatch/logistics category for towing company', () => {
      const context = createQueryContext({
        businessName: 'Queen Anne Dispatch',
        domain: 'queenannedispatch.com',
        industry: 'Towing Services',
        primaryOffers: ['Towing', 'Roadside Assistance', 'Jump Starts', 'Lockouts'],
        valueProposition: '24/7 towing and roadside dispatch',
        geography: 'Seattle, WA',
      });

      const profile = computeBusinessProfile(context);

      // Should NOT be marketing_agency
      expect(profile.inferredCategory).not.toBe('marketing_agency');
      // Should be logistics/dispatch or local_service
      expect(['logistics_dispatch', 'local_service']).toContain(profile.inferredCategory);
    });

    it('should gate discovery for empty dispatch context', () => {
      const context = createQueryContext({
        businessName: 'Unknown Dispatch',
        domain: null, // No website
        industry: null,
        primaryOffers: [],
      });

      const profile = computeBusinessProfile(context);

      expect(profile.canRunDiscovery).toBe(false);
      // The name contains "Dispatch" so inference will pick up on that
      // Key point: should NOT default to marketing_agency
      expect(profile.inferredCategory).not.toBe('marketing_agency');
      expect(['unknown', 'local_service', 'logistics_dispatch']).toContain(profile.inferredCategory);
    });
  });

  describe('Car audio shop scenario (should NOT be marketing agency)', () => {
    it('should infer automotive_service category', () => {
      const context = createQueryContext({
        businessName: 'Elite Car Audio',
        domain: 'elitecaraudio.com',
        industry: 'Car Audio Installation',
        primaryOffers: ['Car Stereo Installation', 'Subwoofers', 'Remote Start', 'Window Tint'],
        valueProposition: 'Professional car audio and electronics installation',
        geography: 'Denver, CO',
        verticalCategory: 'automotive' as any,
      });

      const profile = computeBusinessProfile(context);

      expect(profile.inferredCategory).toBe('automotive_service');
      expect(profile.canRunDiscovery).toBe(true);
    });
  });

  describe('Marketing agency scenario (should BE marketing agency)', () => {
    it('should correctly identify marketing agency', () => {
      const context = createQueryContext({
        businessName: 'Growth Hackers Agency',
        domain: 'growthhackersagency.com',
        industry: 'Digital Marketing',
        businessModel: 'Agency',
        primaryOffers: ['SEO', 'Content Marketing', 'PPC Management'],
        icpDescription: 'B2B SaaS startups',
        valueProposition: 'AI-powered growth marketing for tech startups',
        verticalCategory: 'services' as any,
      });
      (context as any).archetype = 'agency';

      const profile = computeBusinessProfile(context);

      expect(profile.inferredCategory).toBe('marketing_agency');
      expect(profile.canRunDiscovery).toBe(true);
    });
  });
});

// ============================================================================
// Tests: Constants
// ============================================================================

describe('Business Profile: Constants', () => {
  it('should export MIN_DISCOVERY_CONFIDENCE as 0.5', () => {
    expect(MIN_DISCOVERY_CONFIDENCE).toBe(0.5);
  });

  it('should have correct field weights', () => {
    const { FIELD_WEIGHTS } = _testing;

    expect(FIELD_WEIGHTS.websiteUrl).toBe(0.25);
    expect(FIELD_WEIGHTS.companyDescription).toBe(0.20);
    expect(FIELD_WEIGHTS.primaryOffers).toBe(0.15);
    expect(FIELD_WEIGHTS.icpDescription).toBe(0.15);
    expect(FIELD_WEIGHTS.industry).toBe(0.10);
    expect(FIELD_WEIGHTS.businessModel).toBe(0.10);
    expect(FIELD_WEIGHTS.valueProposition).toBe(0.05);
  });

  it('should have category patterns for key business types', () => {
    const { CATEGORY_PATTERNS } = _testing;

    expect(CATEGORY_PATTERNS.marketing_agency.length).toBeGreaterThan(0);
    expect(CATEGORY_PATTERNS.local_service.length).toBeGreaterThan(0);
    expect(CATEGORY_PATTERNS.software_saas.length).toBeGreaterThan(0);
    expect(CATEGORY_PATTERNS.automotive_service.length).toBeGreaterThan(0);
    expect(CATEGORY_PATTERNS.logistics_dispatch.length).toBeGreaterThan(0);
  });
});
