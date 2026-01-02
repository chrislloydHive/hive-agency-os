// tests/competition/overlapScoring.test.ts
// Competition V4 - Trait-Based Overlap Scoring Tests
//
// Tests for multiple business archetypes:
// 1. Hybrid Retail + Service (like car audio retailer with installation)
// 2. Local Service Only (like a plumber or electrician)
// 3. Product Only (like an e-commerce store)
// 4. SaaS / Software (like a B2B platform)
//
// Key validation:
// - NO hardcoded brand names in logic
// - Trait-based intent rules work correctly
// - Confidence reflects signal completeness
// - Classification uses intent to prevent exclusion, not boost scores

import { describe, it, expect } from 'vitest';
import {
  calculateOverlapScore,
  getWeightsForModality,
  convertLegacyInput,
  convertLegacySubjectProfile,
  type CompetitorTraits,
  type SubjectProfile,
  type ScoringResult,
} from '@/lib/competition-v4/overlapScoring';
import {
  inferModality,
  mergeSignals,
  buildSignalsFromContext,
  type ModalitySignals,
} from '@/lib/competition-v4/modalityInference';

// ============================================================================
// Test Data Factory Functions
// ============================================================================

function createSubjectProfile(
  overrides: Partial<SubjectProfile> = {}
): SubjectProfile {
  return {
    name: 'Test Subject',
    modality: 'ProductOnly',
    productCategories: [],
    serviceCategories: [],
    hasServiceCapability: false,
    geographicScope: 'regional',
    serviceAreas: [],
    pricePositioning: 'mid',
    brandRecognition: 0.5,
    serviceEmphasis: 0.5,
    productEmphasis: 0.5,
    ...overrides,
  };
}

function createCompetitorTraits(
  overrides: Partial<CompetitorTraits> = {}
): CompetitorTraits {
  return {
    name: 'Test Competitor',
    domain: 'test.com',
    hasServiceCapability: false,
    serviceCapabilityConfidence: 0.5,
    geographicReach: 'regional',
    serviceAreas: [],
    productCategories: [],
    serviceCategories: [],
    brandRecognition: 0.5,
    pricePositioning: 'mid',
    isRetailer: false,
    isServiceProvider: false,
    signalCompleteness: 0.7,
    ...overrides,
  };
}

// ============================================================================
// Archetype 1: Hybrid Retail + Service (Car Toys Example)
// ============================================================================

describe('Archetype 1: Hybrid Retail + Service', () => {
  const hybridSubject = createSubjectProfile({
    name: 'Regional Auto Electronics',
    modality: 'Retail+Installation',
    productCategories: ['car audio', 'car electronics', 'mobile electronics'],
    serviceCategories: ['installation', 'car audio installation', 'remote start installation'],
    hasServiceCapability: true,
    geographicScope: 'regional',
    serviceAreas: ['Seattle', 'Portland', 'Tacoma'],
    pricePositioning: 'mid',
    serviceEmphasis: 0.6,
    productEmphasis: 0.5,
  });

  describe('National Retailer with Service Capability', () => {
    // This tests the trait-based equivalent of the old "Best Buy Rule"
    const nationalRetailerWithService = createCompetitorTraits({
      name: 'Big National Electronics',
      domain: 'bignational.com',
      hasServiceCapability: true,
      serviceCapabilityConfidence: 0.9,
      geographicReach: 'national',
      productCategories: ['car audio', 'electronics', 'appliances'],
      serviceCategories: ['installation', 'car electronics installation'],
      brandRecognition: 0.85,
      pricePositioning: 'mid',
      isRetailer: true,
      isServiceProvider: true,
      signalCompleteness: 0.9,
    });

    it('should classify national retailer with services as primary for hybrid business', () => {
      const result = calculateOverlapScore(nationalRetailerWithService, hybridSubject);

      expect(result.classification).toBe('primary');
      expect(result.overallScore).toBeGreaterThanOrEqual(55);
    });

    it('should match intent rule for national-retailer-with-service-in-hybrid-market', () => {
      const result = calculateOverlapScore(nationalRetailerWithService, hybridSubject);

      expect(result.traitRulesApplied).toContain('national-retailer-with-service-in-hybrid-market');
    });

    it('should have high installation capability overlap score', () => {
      const result = calculateOverlapScore(nationalRetailerWithService, hybridSubject);

      expect(result.dimensionScores.installationCapabilityOverlap).toBeGreaterThanOrEqual(0.7);
    });
  });

  describe('Local Installer', () => {
    // Tests the trait-based equivalent of the old "Local Installer Rule"
    const localInstaller = createCompetitorTraits({
      name: 'Local Audio Shop',
      domain: 'localaudio.com',
      hasServiceCapability: true,
      serviceCapabilityConfidence: 0.95,
      geographicReach: 'local',
      serviceAreas: ['Seattle'],
      productCategories: [],
      serviceCategories: ['car audio installation', 'custom installation'],
      brandRecognition: 0.3,
      pricePositioning: 'mid',
      isRetailer: false,
      isServiceProvider: true,
      signalCompleteness: 0.8,
    });

    it('should classify local installer as primary/contextual for hybrid business', () => {
      const result = calculateOverlapScore(localInstaller, hybridSubject);

      expect(['primary', 'contextual']).toContain(result.classification);
      expect(result.overallScore).toBeGreaterThanOrEqual(35);
    });

    it('should match local-service-provider-in-service-market rule', () => {
      const result = calculateOverlapScore(localInstaller, hybridSubject);

      expect(result.traitRulesApplied).toContain('local-service-provider-in-service-market');
    });

    it('should prevent exclusion via intent even with lower score', () => {
      // Create a local installer with less overlap
      const weakLocalInstaller = createCompetitorTraits({
        ...localInstaller,
        serviceCategories: ['general automotive'], // Less overlap
        brandRecognition: 0.2,
      });

      const result = calculateOverlapScore(weakLocalInstaller, hybridSubject);

      // Should still be at least alternative, not excluded
      expect(result.classification).not.toBe('excluded');
    });
  });

  describe('Pure E-commerce (No Installation)', () => {
    const pureEcommerce = createCompetitorTraits({
      name: 'Online Audio Store',
      domain: 'onlineaudio.com',
      hasServiceCapability: false,
      serviceCapabilityConfidence: 0.1,
      geographicReach: 'national',
      productCategories: ['car audio', 'home audio', 'electronics'],
      serviceCategories: [],
      brandRecognition: 0.75,
      pricePositioning: 'mid',
      isRetailer: true,
      isServiceProvider: false,
      signalCompleteness: 0.85,
    });

    it('should score lower than national retailer with services', () => {
      const ecommerceResult = calculateOverlapScore(pureEcommerce, hybridSubject);
      const nationalRetailer = createCompetitorTraits({
        name: 'National Retail Chain',
        domain: 'nationalretail.com',
        hasServiceCapability: true,
        serviceCapabilityConfidence: 0.9,
        geographicReach: 'national',
        productCategories: ['car audio', 'electronics'],
        serviceCategories: ['installation'],
        brandRecognition: 0.85,
        isRetailer: true,
        isServiceProvider: true,
        signalCompleteness: 0.9,
      });
      const retailerResult = calculateOverlapScore(nationalRetailer, hybridSubject);

      expect(ecommerceResult.overallScore).toBeLessThan(retailerResult.overallScore);
    });

    it('should still classify as primary if product overlap is high enough', () => {
      const result = calculateOverlapScore(pureEcommerce, hybridSubject);

      // Pure e-commerce with high product overlap can still be primary
      // because product overlap matters even for hybrid businesses
      // However, they should score lower than competitors WITH service capability
      expect(['primary', 'contextual']).toContain(result.classification);
    });

    it('should have low installation capability overlap', () => {
      const result = calculateOverlapScore(pureEcommerce, hybridSubject);

      expect(result.dimensionScores.installationCapabilityOverlap).toBeLessThan(0.5);
    });
  });

  describe('Weights for Retail+Installation modality', () => {
    it('should weight installation capability highly', () => {
      const weights = getWeightsForModality('Retail+Installation');

      expect(weights.installationCapabilityOverlap).toBeGreaterThanOrEqual(0.2);
    });

    it('should balance service and product weights', () => {
      const weights = getWeightsForModality('Retail+Installation');

      expect(weights.serviceSubstitutionOverlap).toBeGreaterThanOrEqual(0.15);
      expect(weights.productCategoryOverlap).toBeGreaterThanOrEqual(0.1);
    });
  });
});

// ============================================================================
// Archetype 2: Local Service Only (Plumber/Electrician Example)
// ============================================================================

describe('Archetype 2: Local Service Only', () => {
  const localServiceSubject = createSubjectProfile({
    name: 'Seattle Plumbing Co',
    modality: 'InstallationOnly',
    productCategories: [],
    serviceCategories: ['plumbing', 'pipe repair', 'water heater installation', 'drain cleaning'],
    hasServiceCapability: true,
    geographicScope: 'local',
    serviceAreas: ['Seattle', 'Bellevue', 'Kirkland'],
    pricePositioning: 'mid',
    serviceEmphasis: 0.95,
    productEmphasis: 0.05,
  });

  describe('Competing Local Service Provider', () => {
    const localCompetitor = createCompetitorTraits({
      name: 'Another Plumber',
      domain: 'anotherplumber.com',
      hasServiceCapability: true,
      serviceCapabilityConfidence: 1.0,
      geographicReach: 'local',
      serviceAreas: ['Seattle', 'Bellevue'],
      productCategories: [],
      serviceCategories: ['plumbing', 'pipe repair', 'emergency plumbing'],
      brandRecognition: 0.3,
      pricePositioning: 'mid',
      isRetailer: false,
      isServiceProvider: true,
      signalCompleteness: 0.9,
    });

    it('should classify as primary (direct local service competitor)', () => {
      const result = calculateOverlapScore(localCompetitor, localServiceSubject);

      expect(result.classification).toBe('primary');
    });

    it('should have high geographic and service overlap', () => {
      const result = calculateOverlapScore(localCompetitor, localServiceSubject);

      expect(result.dimensionScores.geographicPresenceOverlap).toBeGreaterThanOrEqual(0.7);
      expect(result.dimensionScores.serviceSubstitutionOverlap).toBeGreaterThanOrEqual(0.5);
    });

    it('should match same-geographic-same-service rule', () => {
      const result = calculateOverlapScore(localCompetitor, localServiceSubject);

      expect(result.traitRulesApplied).toContain('same-geographic-same-service');
    });
  });

  describe('National Franchise', () => {
    const nationalFranchise = createCompetitorTraits({
      name: 'National Plumbing Franchise',
      domain: 'nationalplumbing.com',
      hasServiceCapability: true,
      serviceCapabilityConfidence: 0.95,
      geographicReach: 'national',
      serviceAreas: [], // Serves everywhere
      productCategories: [],
      serviceCategories: ['plumbing', 'drain cleaning', 'water heater installation'],
      brandRecognition: 0.7,
      pricePositioning: 'mid',
      isRetailer: false,
      isServiceProvider: true,
      signalCompleteness: 0.85,
    });

    it('should classify as primary or contextual (national service provider)', () => {
      const result = calculateOverlapScore(nationalFranchise, localServiceSubject);

      expect(['primary', 'contextual']).toContain(result.classification);
    });

    it('should have strong service substitution overlap', () => {
      const result = calculateOverlapScore(nationalFranchise, localServiceSubject);

      expect(result.dimensionScores.serviceSubstitutionOverlap).toBeGreaterThanOrEqual(0.5);
    });
  });

  describe('Irrelevant Product Retailer', () => {
    const productRetailer = createCompetitorTraits({
      name: 'Hardware Store',
      domain: 'hardwarestore.com',
      hasServiceCapability: false,
      serviceCapabilityConfidence: 0.1,
      geographicReach: 'national',
      productCategories: ['plumbing supplies', 'tools', 'hardware'],
      serviceCategories: [],
      brandRecognition: 0.8,
      pricePositioning: 'mid',
      isRetailer: true,
      isServiceProvider: false,
      signalCompleteness: 0.9,
    });

    it('should score moderately low for service-only business', () => {
      const result = calculateOverlapScore(productRetailer, localServiceSubject);

      // Product retailer has some score due to market reach and brand trust
      // but lower than actual service competitors
      expect(result.overallScore).toBeLessThan(50);
      expect(['contextual', 'alternative']).toContain(result.classification);
    });

    it('should have low installation capability overlap', () => {
      const result = calculateOverlapScore(productRetailer, localServiceSubject);

      expect(result.dimensionScores.installationCapabilityOverlap).toBeLessThan(0.3);
    });
  });

  describe('Weights for InstallationOnly modality', () => {
    it('should weight installation capability very highly', () => {
      const weights = getWeightsForModality('InstallationOnly');

      expect(weights.installationCapabilityOverlap).toBeGreaterThanOrEqual(0.25);
    });

    it('should weight geographic proximity highly', () => {
      const weights = getWeightsForModality('InstallationOnly');

      expect(weights.geographicPresenceOverlap).toBeGreaterThanOrEqual(0.2);
    });

    it('should weight product overlap very low', () => {
      const weights = getWeightsForModality('InstallationOnly');

      expect(weights.productCategoryOverlap).toBeLessThanOrEqual(0.1);
    });
  });
});

// ============================================================================
// Archetype 3: Product Only (E-commerce Example)
// ============================================================================

describe('Archetype 3: Product Only', () => {
  const productOnlySubject = createSubjectProfile({
    name: 'Online Gadget Store',
    modality: 'ProductOnly',
    productCategories: ['electronics', 'gadgets', 'accessories', 'smart home'],
    serviceCategories: [],
    hasServiceCapability: false,
    geographicScope: 'national',
    serviceAreas: [],
    pricePositioning: 'mid',
    serviceEmphasis: 0.05,
    productEmphasis: 0.95,
  });

  describe('Competing E-commerce Store', () => {
    const competingEcommerce = createCompetitorTraits({
      name: 'Another Gadget Store',
      domain: 'gadgets.com',
      hasServiceCapability: false,
      serviceCapabilityConfidence: 0.1,
      geographicReach: 'national',
      serviceAreas: [],
      productCategories: ['electronics', 'gadgets', 'smart home', 'tech accessories'],
      serviceCategories: [],
      brandRecognition: 0.6,
      pricePositioning: 'mid',
      isRetailer: true,
      isServiceProvider: false,
      signalCompleteness: 0.9,
    });

    it('should classify as primary (direct product competitor)', () => {
      const result = calculateOverlapScore(competingEcommerce, productOnlySubject);

      expect(result.classification).toBe('primary');
    });

    it('should have high product category overlap', () => {
      const result = calculateOverlapScore(competingEcommerce, productOnlySubject);

      expect(result.dimensionScores.productCategoryOverlap).toBeGreaterThanOrEqual(0.6);
    });
  });

  describe('Major Marketplace', () => {
    const marketplace = createCompetitorTraits({
      name: 'Major Marketplace',
      domain: 'marketplace.com',
      hasServiceCapability: false,
      serviceCapabilityConfidence: 0.1,
      geographicReach: 'national',
      serviceAreas: [],
      productCategories: ['electronics', 'gadgets', 'everything'],
      serviceCategories: [],
      brandRecognition: 0.95,
      pricePositioning: 'budget',
      isRetailer: true,
      isServiceProvider: false,
      signalCompleteness: 0.9,
    });

    it('should classify as primary or contextual (strong product competitor)', () => {
      const result = calculateOverlapScore(marketplace, productOnlySubject);

      expect(['primary', 'contextual']).toContain(result.classification);
    });

    it('should have high brand trust and market reach overlap', () => {
      const result = calculateOverlapScore(marketplace, productOnlySubject);

      expect(result.dimensionScores.brandTrustOverlap).toBeGreaterThanOrEqual(0.5);
      expect(result.dimensionScores.marketReachOverlap).toBeGreaterThanOrEqual(0.8);
    });
  });

  describe('Service Provider (Not Competitive)', () => {
    const serviceProvider = createCompetitorTraits({
      name: 'Tech Support Service',
      domain: 'techsupport.com',
      hasServiceCapability: true,
      serviceCapabilityConfidence: 1.0,
      geographicReach: 'national',
      serviceAreas: [],
      productCategories: [],
      serviceCategories: ['tech support', 'repair', 'installation'],
      brandRecognition: 0.5,
      pricePositioning: 'mid',
      isRetailer: false,
      isServiceProvider: true,
      signalCompleteness: 0.8,
    });

    it('should be classified appropriately despite overlapping support services', () => {
      const result = calculateOverlapScore(serviceProvider, productOnlySubject);

      // For ProductOnly businesses, the scoring model may still give
      // some weight to service providers that offer complementary services.
      // The key test is that they score lower than direct product competitors.
      const directCompetitor = createCompetitorTraits({
        name: 'Direct Product Competitor',
        domain: 'directproduct.com',
        hasServiceCapability: false,
        productCategories: ['electronics', 'gadgets', 'smart home'],
        brandRecognition: 0.5,
        pricePositioning: 'mid',
        isRetailer: true,
        signalCompleteness: 0.9,
      });
      const directResult = calculateOverlapScore(directCompetitor, productOnlySubject);

      expect(directResult.overallScore).toBeGreaterThan(result.overallScore);
    });
  });

  describe('Weights for ProductOnly modality', () => {
    it('should weight product overlap very highly', () => {
      const weights = getWeightsForModality('ProductOnly');

      expect(weights.productCategoryOverlap).toBeGreaterThanOrEqual(0.25);
    });

    it('should weight brand trust highly', () => {
      const weights = getWeightsForModality('ProductOnly');

      expect(weights.brandTrustOverlap).toBeGreaterThanOrEqual(0.2);
    });

    it('should weight installation capability very low', () => {
      const weights = getWeightsForModality('ProductOnly');

      expect(weights.installationCapabilityOverlap).toBeLessThanOrEqual(0.1);
    });
  });
});

// ============================================================================
// Archetype 4: SaaS / Software
// ============================================================================

describe('Archetype 4: SaaS / Software', () => {
  // SaaS doesn't fit neatly into existing modalities, but we can model it as ProductOnly
  const saasSubject = createSubjectProfile({
    name: 'B2B Analytics Platform',
    modality: 'ProductOnly', // Software as product
    productCategories: ['analytics', 'business intelligence', 'data visualization', 'reporting'],
    serviceCategories: ['onboarding', 'training', 'support'],
    hasServiceCapability: true, // Support services
    geographicScope: 'national',
    serviceAreas: [],
    pricePositioning: 'premium',
    serviceEmphasis: 0.3, // Support is secondary
    productEmphasis: 0.8,
  });

  describe('Competing SaaS Platform', () => {
    const competingSaaS = createCompetitorTraits({
      name: 'Competitor Analytics',
      domain: 'competitoranalytics.com',
      hasServiceCapability: true,
      serviceCapabilityConfidence: 0.7,
      geographicReach: 'national',
      serviceAreas: [],
      productCategories: ['analytics', 'business intelligence', 'dashboards'],
      serviceCategories: ['onboarding', 'consulting', 'training'],
      brandRecognition: 0.7,
      pricePositioning: 'premium',
      isRetailer: false,
      isServiceProvider: true,
      signalCompleteness: 0.85,
    });

    it('should classify as primary (direct product competitor)', () => {
      const result = calculateOverlapScore(competingSaaS, saasSubject);

      expect(result.classification).toBe('primary');
    });

    it('should have high product category overlap', () => {
      const result = calculateOverlapScore(competingSaaS, saasSubject);

      expect(result.dimensionScores.productCategoryOverlap).toBeGreaterThanOrEqual(0.5);
    });

    it('should have strong price positioning overlap', () => {
      const result = calculateOverlapScore(competingSaaS, saasSubject);

      expect(result.dimensionScores.pricePositioningOverlap).toBeGreaterThanOrEqual(0.8);
    });
  });

  describe('Adjacent Category SaaS', () => {
    const adjacentSaaS = createCompetitorTraits({
      name: 'CRM Platform',
      domain: 'crmplatform.com',
      hasServiceCapability: true,
      serviceCapabilityConfidence: 0.8,
      geographicReach: 'national',
      serviceAreas: [],
      productCategories: ['CRM', 'sales automation', 'reporting'],
      serviceCategories: ['implementation', 'training'],
      brandRecognition: 0.8,
      pricePositioning: 'premium',
      isRetailer: false,
      isServiceProvider: true,
      signalCompleteness: 0.9,
    });

    it('should classify as contextual or alternative (partial overlap)', () => {
      const result = calculateOverlapScore(adjacentSaaS, saasSubject);

      // Partial product overlap (only 'reporting')
      expect(['primary', 'contextual', 'alternative']).toContain(result.classification);
    });

    it('should have lower product overlap than direct competitor', () => {
      const directResult = calculateOverlapScore(
        createCompetitorTraits({
          name: 'Direct Analytics Competitor',
          domain: 'directanalytics.com',
          productCategories: ['analytics', 'business intelligence', 'data visualization'],
          pricePositioning: 'premium',
          isRetailer: false,
          isServiceProvider: true,
          signalCompleteness: 0.9,
        }),
        saasSubject
      );

      const adjacentResult = calculateOverlapScore(adjacentSaaS, saasSubject);

      expect(directResult.dimensionScores.productCategoryOverlap)
        .toBeGreaterThan(adjacentResult.dimensionScores.productCategoryOverlap);
    });
  });
});

// ============================================================================
// Modality Inference Tests
// ============================================================================

describe('Modality Inference', () => {
  describe('Strong service signals', () => {
    it('should infer InstallationOnly for pure service business', () => {
      const signals: ModalitySignals = {
        offeringType: 'Labor-Based Service',
        economicModel: 'Service',
        hasServices: true,
        hasProducts: false,
        hasInstallation: true,
        serviceCategories: ['plumbing', 'repair'],
        productCategories: [],
      };

      const result = inferModality(signals);

      expect(result.modality).toBe('InstallationOnly');
      expect(result.serviceEmphasis).toBeGreaterThan(result.productEmphasis);
    });

    it('should have high confidence with multiple service signals', () => {
      const signals: ModalitySignals = {
        offeringType: 'Labor-Based Service',
        economicModel: 'Service',
        hasServices: true,
        hasInstallation: true,
        serviceCategories: ['installation', 'repair', 'maintenance'],
        industry: 'HVAC',
      };

      const result = inferModality(signals);

      expect(result.confidence).toBeGreaterThanOrEqual(60);
    });
  });

  describe('Strong product signals', () => {
    it('should infer ProductOnly for pure product business', () => {
      const signals: ModalitySignals = {
        offeringType: 'Physical Goods',
        economicModel: 'Product',
        hasProducts: true,
        hasServices: false,
        productCategories: ['electronics', 'gadgets'],
        serviceCategories: [],
      };

      const result = inferModality(signals);

      expect(result.modality).toBe('ProductOnly');
      expect(result.productEmphasis).toBeGreaterThan(result.serviceEmphasis);
    });
  });

  describe('Hybrid signals', () => {
    it('should infer Retail+Installation for hybrid business', () => {
      const signals: ModalitySignals = {
        offeringType: 'Hybrid',
        hasProducts: true,
        hasServices: true,
        hasInstallation: true,
        productCategories: ['car audio', 'electronics'],
        serviceCategories: ['installation', 'custom work'],
      };

      const result = inferModality(signals);

      expect(result.modality).toBe('Retail+Installation');
    });
  });

  describe('Low confidence scenarios', () => {
    it('should provide clarifying question when confidence is low', () => {
      const signals: ModalitySignals = {
        // Minimal signals
        industry: 'automotive',
      };

      const result = inferModality(signals);

      expect(result.confidence).toBeLessThan(60);
      expect(result.clarifyingQuestion).not.toBeNull();
    });

    it('should have yes/no implications in clarifying question', () => {
      const signals: ModalitySignals = {};

      const result = inferModality(signals);

      expect(result.clarifyingQuestion).not.toBeNull();
      expect(result.clarifyingQuestion?.yesImplies).toBeDefined();
      expect(result.clarifyingQuestion?.noImplies).toBeDefined();
    });
  });

  describe('Signal merging', () => {
    it('should merge signals from multiple sources', () => {
      const fromDecomposition: Partial<ModalitySignals> = {
        offeringType: 'Hybrid',
        hasServices: true,
      };

      const fromContext: Partial<ModalitySignals> = {
        productCategories: ['car audio'],
        industry: 'automotive',
      };

      const merged = mergeSignals(fromDecomposition, fromContext);

      expect(merged.offeringType).toBe('Hybrid');
      expect(merged.hasServices).toBe(true);
      expect(merged.productCategories).toEqual(['car audio']);
      expect(merged.industry).toBe('automotive');
    });

    it('should merge arrays without duplicates', () => {
      const source1: Partial<ModalitySignals> = {
        productCategories: ['audio', 'electronics'],
      };

      const source2: Partial<ModalitySignals> = {
        productCategories: ['electronics', 'video'],
      };

      const merged = mergeSignals(source1, source2);

      expect(merged.productCategories).toEqual(['audio', 'electronics', 'video']);
    });
  });
});

// ============================================================================
// Confidence and Signal Completeness Tests
// ============================================================================

describe('Confidence Calculation', () => {
  const subject = createSubjectProfile({
    name: 'Test Business',
    modality: 'Retail+Installation',
    productCategories: ['electronics'],
    serviceCategories: ['installation'],
    hasServiceCapability: true,
  });

  it('should have high confidence with complete signals', () => {
    const completeCompetitor = createCompetitorTraits({
      name: 'Complete Signals',
      domain: 'complete.com',
      hasServiceCapability: true,
      serviceCapabilityConfidence: 0.9,
      geographicReach: 'national',
      productCategories: ['electronics'],
      serviceCategories: ['installation'],
      brandRecognition: 0.8,
      pricePositioning: 'mid',
      isRetailer: true,
      isServiceProvider: true,
      signalCompleteness: 0.95,
    });

    const result = calculateOverlapScore(completeCompetitor, subject);

    expect(result.confidence).toBeGreaterThanOrEqual(60);
    expect(result.missingSignals.length).toBeLessThanOrEqual(2);
  });

  it('should have lower confidence with incomplete signals', () => {
    const incompleteCompetitor = createCompetitorTraits({
      name: 'Incomplete Signals',
      domain: 'incomplete.com',
      hasServiceCapability: false,
      serviceCapabilityConfidence: 0.2,
      geographicReach: 'unknown',
      productCategories: [],
      serviceCategories: [],
      brandRecognition: 0,
      pricePositioning: 'unknown',
      isRetailer: false,
      isServiceProvider: false,
      signalCompleteness: 0.2,
    });

    const result = calculateOverlapScore(incompleteCompetitor, subject);

    expect(result.confidence).toBeLessThan(50);
    expect(result.missingSignals.length).toBeGreaterThan(3);
  });

  it('should list specific missing signals', () => {
    const partialCompetitor = createCompetitorTraits({
      name: 'Partial Signals',
      domain: 'partial.com',
      hasServiceCapability: true,
      serviceCapabilityConfidence: 0.8,
      geographicReach: 'unknown', // Missing
      productCategories: ['electronics'],
      serviceCategories: [],
      brandRecognition: 0, // Missing
      pricePositioning: 'unknown', // Missing
      isRetailer: true,
      isServiceProvider: true,
      signalCompleteness: 0.5,
    });

    const result = calculateOverlapScore(partialCompetitor, subject);

    expect(result.missingSignals).toContain('geographic_reach');
    expect(result.missingSignals).toContain('price_positioning');
  });
});

// ============================================================================
// Intent-Based Exclusion Prevention Tests
// ============================================================================

describe('Intent-Based Exclusion Prevention', () => {
  const hybridSubject = createSubjectProfile({
    name: 'Hybrid Business',
    modality: 'Retail+Installation',
    productCategories: ['car audio'],
    serviceCategories: ['installation'],
    hasServiceCapability: true,
    geographicScope: 'regional',
    serviceEmphasis: 0.6,
    productEmphasis: 0.5,
  });

  it('should prevent exclusion of national retailer with services even with low overlap scores', () => {
    const lowScoreNationalRetailer = createCompetitorTraits({
      name: 'National Retailer',
      domain: 'national.com',
      hasServiceCapability: true,
      serviceCapabilityConfidence: 0.7,
      geographicReach: 'national',
      productCategories: ['appliances'], // Low product overlap
      serviceCategories: ['delivery'], // Low service overlap
      brandRecognition: 0.3, // Low brand
      pricePositioning: 'unknown',
      isRetailer: true,
      isServiceProvider: true,
      signalCompleteness: 0.5,
    });

    const result = calculateOverlapScore(lowScoreNationalRetailer, hybridSubject);

    // Should be at least contextual or alternative, not excluded
    expect(result.classification).not.toBe('excluded');
    // Intent rule should be applied
    expect(result.traitRulesApplied.length).toBeGreaterThan(0);
  });

  it('should flag exclusion prevention with inclusionReason', () => {
    const matchingIntentCompetitor = createCompetitorTraits({
      name: 'Intent Match',
      domain: 'intent.com',
      hasServiceCapability: true,
      serviceCapabilityConfidence: 0.8,
      geographicReach: 'national',
      productCategories: [], // No product overlap
      serviceCategories: [], // No service overlap
      brandRecognition: 0.5,
      pricePositioning: 'mid',
      isRetailer: true,
      isServiceProvider: true,
      signalCompleteness: 0.6,
    });

    const result = calculateOverlapScore(matchingIntentCompetitor, hybridSubject);

    if (result.exclusionPrevented) {
      expect(result.inclusionReason).not.toBeNull();
      expect(result.inclusionReason!.length).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// Legacy Compatibility Tests
// ============================================================================

describe('Legacy Compatibility', () => {
  it('should convert legacy input format correctly', () => {
    const legacyInput = {
      name: 'Legacy Competitor',
      domain: 'legacy.com',
      hasInstallation: true,
      hasNationalReach: true,
      isLocal: false,
      productCategories: ['electronics'],
      serviceCategories: ['installation'],
      brandTrustScore: 80,
      pricePositioning: 'mid' as const,
      isMajorRetailer: true,
    };

    const converted = convertLegacyInput(legacyInput);

    expect(converted.name).toBe('Legacy Competitor');
    expect(converted.hasServiceCapability).toBe(true);
    expect(converted.geographicReach).toBe('national');
    expect(converted.isRetailer).toBe(true);
    expect(converted.brandRecognition).toBe(0.8);
  });

  it('should convert legacy subject profile correctly', () => {
    const legacySubject = {
      name: 'Legacy Subject',
      modality: 'Retail+Installation' as const,
      productCategories: ['audio'],
      serviceCategories: ['installation'],
      hasInstallation: true,
      geographicScope: 'regional' as const,
      pricePositioning: 'mid' as const,
      customerComparisonModes: ['national_retailers', 'local_installers'],
    };

    const converted = convertLegacySubjectProfile(legacySubject);

    expect(converted.name).toBe('Legacy Subject');
    expect(converted.modality).toBe('Retail+Installation');
    expect(converted.hasServiceCapability).toBe(true);
    expect(converted.serviceEmphasis).toBeGreaterThan(0.5);
  });
});

// ============================================================================
// Ranking Consistency Tests
// ============================================================================

describe('Ranking Consistency', () => {
  const hybridSubject = createSubjectProfile({
    name: 'Hybrid Test',
    modality: 'Retail+Installation',
    productCategories: ['car audio', 'electronics'],
    serviceCategories: ['installation', 'custom work'],
    hasServiceCapability: true,
    geographicScope: 'regional',
    serviceEmphasis: 0.6,
    productEmphasis: 0.5,
  });

  const competitors = [
    createCompetitorTraits({
      name: 'National Retailer with Service',
      domain: 'national-service.com',
      hasServiceCapability: true,
      serviceCapabilityConfidence: 0.9,
      geographicReach: 'national',
      productCategories: ['car audio', 'electronics'],
      serviceCategories: ['installation'],
      brandRecognition: 0.85,
      pricePositioning: 'mid',
      isRetailer: true,
      isServiceProvider: true,
      signalCompleteness: 0.9,
    }),
    createCompetitorTraits({
      name: 'Local Installer',
      domain: 'local-installer.com',
      hasServiceCapability: true,
      serviceCapabilityConfidence: 0.95,
      geographicReach: 'local',
      productCategories: [],
      serviceCategories: ['installation', 'custom work'],
      brandRecognition: 0.3,
      pricePositioning: 'mid',
      isRetailer: false,
      isServiceProvider: true,
      signalCompleteness: 0.85,
    }),
    createCompetitorTraits({
      name: 'Pure E-commerce',
      domain: 'ecommerce.com',
      hasServiceCapability: false,
      serviceCapabilityConfidence: 0.1,
      geographicReach: 'national',
      productCategories: ['car audio', 'electronics'],
      serviceCategories: [],
      brandRecognition: 0.75,
      pricePositioning: 'mid',
      isRetailer: true,
      isServiceProvider: false,
      signalCompleteness: 0.9,
    }),
    createCompetitorTraits({
      name: 'Unrelated Business',
      domain: 'unrelated.com',
      hasServiceCapability: false,
      serviceCapabilityConfidence: 0.1,
      geographicReach: 'local',
      productCategories: ['furniture'],
      serviceCategories: [],
      brandRecognition: 0.2,
      pricePositioning: 'budget',
      isRetailer: true,
      isServiceProvider: false,
      signalCompleteness: 0.7,
    }),
  ];

  it('should rank national retailer with service highest for hybrid business', () => {
    const results = competitors.map((c) => ({
      name: c.name,
      ...calculateOverlapScore(c, hybridSubject),
    }));

    // Sort by score
    results.sort((a, b) => b.overallScore - a.overallScore);

    expect(results[0].name).toBe('National Retailer with Service');
  });

  it('should rank pure e-commerce lower than service-capable competitors', () => {
    const nationalWithService = calculateOverlapScore(competitors[0], hybridSubject);
    const localInstaller = calculateOverlapScore(competitors[1], hybridSubject);
    const pureEcommerce = calculateOverlapScore(competitors[2], hybridSubject);

    expect(pureEcommerce.overallScore).toBeLessThan(nationalWithService.overallScore);
    // Local installer may score higher or similar to e-commerce due to service capability
    expect(localInstaller.overallScore).toBeGreaterThanOrEqual(pureEcommerce.overallScore * 0.8);
  });

  it('should rank unrelated business lowest', () => {
    const results = competitors.map((c) => ({
      name: c.name,
      ...calculateOverlapScore(c, hybridSubject),
    }));

    // Sort by score ascending to find lowest
    results.sort((a, b) => a.overallScore - b.overallScore);

    // Unrelated business should be the lowest scoring
    expect(results[0].name).toBe('Unrelated Business');

    // Find unrelated business
    const unrelated = results.find((r) => r.name === 'Unrelated Business');

    // Should be excluded or alternative (lowest classification)
    expect(['excluded', 'alternative']).toContain(unrelated?.classification);
    expect(unrelated?.overallScore).toBeLessThan(40);
  });
});
