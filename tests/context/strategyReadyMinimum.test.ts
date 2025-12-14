// tests/context/strategyReadyMinimum.test.ts
// Unit tests for Strategy-Ready Minimum (SRM)

import { describe, it, expect } from 'vitest';
import {
  isStrategyReady,
  SRM_FIELDS,
  isSrmField,
  getAllSrmFieldPaths,
  checkRegenRecommendation,
  CONTEXT_SRM_FIELD_NAMES,
} from '@/lib/contextGraph/readiness';
import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';

// ============================================================================
// Mock Data Helpers
// ============================================================================

/**
 * Create a minimal empty context graph for testing
 */
function createEmptyGraph(): CompanyContextGraph {
  const now = new Date().toISOString();
  return {
    companyId: 'test-company',
    companyName: 'Test Company',
    meta: {
      version: '2.0.0',
      createdAt: now,
      updatedAt: now,
      lastFusionAt: null,
      lastFusionRunId: null,
      completenessScore: null,
      domainCoverage: null,
    },
    identity: {
      businessName: { value: null, provenance: [] },
      industry: { value: null, provenance: [] },
      businessModel: { value: null, provenance: [] },
      revenueModel: { value: null, provenance: [] },
      icpDescription: { value: null, provenance: [] },
      marketMaturity: { value: null, provenance: [] },
      geographicFootprint: { value: null, provenance: [] },
      serviceArea: { value: null, provenance: [] },
      competitiveLandscape: { value: null, provenance: [] },
      marketPosition: { value: null, provenance: [] },
      primaryCompetitors: { value: [], provenance: [] },
      seasonalityNotes: { value: null, provenance: [] },
      peakSeasons: { value: [], provenance: [] },
      lowSeasons: { value: [], provenance: [] },
      profitCenters: { value: [], provenance: [] },
      revenueStreams: { value: [], provenance: [] },
    },
    brand: {
      positioning: { value: null, provenance: [] },
      tagline: { value: null, provenance: [] },
      missionStatement: { value: null, provenance: [] },
      valueProps: { value: [], provenance: [] },
      differentiators: { value: [], provenance: [] },
      uniqueSellingPoints: { value: [], provenance: [] },
      toneOfVoice: { value: null, provenance: [] },
      brandPersonality: { value: null, provenance: [] },
      messagingPillars: { value: [], provenance: [] },
      brandPerception: { value: null, provenance: [] },
      brandStrengths: { value: [], provenance: [] },
      brandWeaknesses: { value: [], provenance: [] },
      visualIdentitySummary: { value: null, provenance: [] },
      brandColors: { value: [], provenance: [] },
      brandGuidelines: { value: null, provenance: [] },
      competitivePosition: { value: null, provenance: [] },
      shareOfVoice: { value: null, provenance: [] },
    },
    objectives: {
      primaryObjective: { value: null, provenance: [] },
      secondaryObjectives: { value: [], provenance: [] },
      primaryBusinessGoal: { value: null, provenance: [] },
      timeHorizon: { value: null, provenance: [] },
      planningPeriodStart: { value: null, provenance: [] },
      planningPeriodEnd: { value: null, provenance: [] },
      kpiLabels: { value: [], provenance: [] },
      kpiTargets: { value: [], provenance: [] },
      targetCpa: { value: null, provenance: [] },
      targetCpl: { value: null, provenance: [] },
      targetRoas: { value: null, provenance: [] },
      targetMer: { value: null, provenance: [] },
      targetCac: { value: null, provenance: [] },
      targetLtv: { value: null, provenance: [] },
      contributionMarginRequirement: { value: null, provenance: [] },
      breakEvenCpa: { value: null, provenance: [] },
      revenueGoal: { value: null, provenance: [] },
      leadGoal: { value: null, provenance: [] },
      conversionGoal: { value: null, provenance: [] },
    },
    audience: {
      primaryAudience: { value: null, provenance: [] },
      primaryBuyerRoles: { value: [], provenance: [] },
      companyProfile: { value: null, provenance: [] },
      coreSegments: { value: [], provenance: [] },
      segmentDetails: { value: [], provenance: [] },
      demographics: { value: null, provenance: [] },
      ageRanges: { value: [], provenance: [] },
      genderSplit: { value: null, provenance: [] },
      incomeLevel: { value: null, provenance: [] },
      educationLevel: { value: null, provenance: [] },
      geos: { value: null, provenance: [] },
      primaryMarkets: { value: [], provenance: [] },
      secondaryMarkets: { value: [], provenance: [] },
      excludedGeos: { value: [], provenance: [] },
      behavioralDrivers: { value: [], provenance: [] },
      purchaseBehaviors: { value: [], provenance: [] },
      mediaConsumption: { value: null, provenance: [] },
      deviceUsage: { value: null, provenance: [] },
      demandStates: { value: [], provenance: [] },
      funnelDistribution: { value: null, provenance: [] },
      buyerJourney: { value: null, provenance: [] },
      mediaHabits: { value: null, provenance: [] },
      preferredChannels: { value: [], provenance: [] },
      contentPreferences: { value: [], provenance: [] },
      culturalNuances: { value: null, provenance: [] },
      languages: { value: [], provenance: [] },
      primaryLanguage: { value: null, provenance: [] },
      audienceNeeds: { value: [], provenance: [] },
      painPoints: { value: [], provenance: [] },
      motivations: { value: [], provenance: [] },
      personaNames: { value: [], provenance: [] },
      personaBriefs: { value: [], provenance: [] },
      audienceTriggers: { value: [], provenance: [] },
      audienceObjections: { value: [], provenance: [] },
      decisionFactors: { value: [], provenance: [] },
      keyMessages: { value: [], provenance: [] },
      proofPointsNeeded: { value: [], provenance: [] },
      exampleHooks: { value: [], provenance: [] },
      contentFormatsPreferred: { value: [], provenance: [] },
      toneGuidance: { value: null, provenance: [] },
    },
    productOffer: {
      primaryProducts: { value: [], provenance: [] },
      services: { value: [], provenance: [] },
      valueProposition: { value: null, provenance: [] },
      pricingModel: { value: null, provenance: [] },
      keyDifferentiators: { value: [], provenance: [] },
      productLines: { value: [], provenance: [] },
      products: { value: [], provenance: [] },
      heroProducts: { value: [], provenance: [] },
      productCategories: { value: [], provenance: [] },
      pricingNotes: { value: null, provenance: [] },
      priceRange: { value: null, provenance: [] },
      avgTicketValue: { value: null, provenance: [] },
      avgOrderValue: { value: null, provenance: [] },
      marginTiers: { value: null, provenance: [] },
      avgMargin: { value: null, provenance: [] },
      highMarginProducts: { value: [], provenance: [] },
      promoWindows: { value: null, provenance: [] },
      currentPromotions: { value: [], provenance: [] },
      upcomingPromotions: { value: [], provenance: [] },
      promoCalendarNotes: { value: null, provenance: [] },
      inventoryConstraints: { value: null, provenance: [] },
      stockLevels: { value: null, provenance: [] },
      fulfillmentNotes: { value: null, provenance: [] },
      uniqueOffers: { value: [], provenance: [] },
      conversionOffers: { value: [], provenance: [] },
      leadMagnets: { value: [], provenance: [] },
    },
    competitive: {
      dataConfidence: { value: null, provenance: [] },
      lastValidatedAt: { value: null, provenance: [] },
      shareOfVoice: { value: null, provenance: [] },
      marketPosition: { value: null, provenance: [] },
      competitiveAdvantages: { value: [], provenance: [] },
      primaryAxis: { value: null, provenance: [] },
      secondaryAxis: { value: null, provenance: [] },
      positionSummary: { value: null, provenance: [] },
      whitespaceOpportunities: { value: [], provenance: [] },
      whitespaceMap: { value: [], provenance: [] },
      competitors: { value: [], provenance: [] },
      primaryCompetitors: { value: [], provenance: [] },
      competitorMediaMix: { value: null, provenance: [] },
      competitorBudgets: { value: null, provenance: [] },
      competitorSearchStrategy: { value: null, provenance: [] },
      competitorCreativeThemes: { value: [], provenance: [] },
      categoryBenchmarks: { value: null, provenance: [] },
      categoryCpa: { value: null, provenance: [] },
      categoryRoas: { value: null, provenance: [] },
      categoryCtr: { value: null, provenance: [] },
      competitiveThreats: { value: [], provenance: [] },
      competitiveOpportunities: { value: [], provenance: [] },
      marketTrends: { value: [], provenance: [] },
      differentiationStrategy: { value: null, provenance: [] },
      uniqueValueProps: { value: [], provenance: [] },
      positioningAxes: { value: null, provenance: [] },
      ownPositionPrimary: { value: null, provenance: [] },
      ownPositionSecondary: { value: null, provenance: [] },
      positioningSummary: { value: null, provenance: [] },
      featuresMatrix: { value: [], provenance: [] },
      pricingModels: { value: [], provenance: [] },
      ownPriceTier: { value: null, provenance: [] },
      categoryMedianPrice: { value: null, provenance: [] },
      messageOverlap: { value: [], provenance: [] },
      messagingDifferentiationScore: { value: null, provenance: [] },
      marketClusters: { value: [], provenance: [] },
      threatScores: { value: [], provenance: [] },
      overallThreatLevel: { value: null, provenance: [] },
      substitutes: { value: [], provenance: [] },
      invalidCompetitors: { value: [], provenance: [] },
    },
    operationalConstraints: {
      budgetCapsFloors: { value: [], provenance: [] },
      minBudget: { value: null, provenance: [] },
      maxBudget: { value: null, provenance: [] },
      brandVsPerformanceRules: { value: null, provenance: [] },
      testingBudgetNotes: { value: null, provenance: [] },
      creativeBudgetNotes: { value: null, provenance: [] },
      reportingBudgetNotes: { value: null, provenance: [] },
      pacingRequirements: { value: null, provenance: [] },
      launchDeadlines: { value: [], provenance: [] },
      blackoutPeriods: { value: [], provenance: [] },
      channelRestrictions: { value: [], provenance: [] },
      requiredApprovals: { value: [], provenance: [] },
      talentConstraints: { value: null, provenance: [] },
      agencyCapabilities: { value: null, provenance: [] },
      inHouseCapabilities: { value: null, provenance: [] },
      complianceRequirements: { value: [], provenance: [] },
      legalRestrictions: { value: null, provenance: [] },
      industryRegulations: { value: null, provenance: [] },
      platformLimitations: { value: null, provenance: [] },
      integrationConstraints: { value: null, provenance: [] },
      dataAccessLimitations: { value: null, provenance: [] },
    },
    // Minimal stubs for remaining domains
    digitalInfra: {} as any,
    website: {} as any,
    content: {} as any,
    seo: {} as any,
    ops: {} as any,
    performanceMedia: {} as any,
    historical: {} as any,
    creative: {} as any,
    budgetOps: {} as any,
    storeRisk: {} as any,
    historyRefs: {} as any,
    social: {} as any,
    capabilities: {} as any,
  };
}

/**
 * Create a fully populated graph that passes SRM
 */
function createPopulatedGraph(): CompanyContextGraph {
  const graph = createEmptyGraph();

  // Fill all SRM required fields
  graph.identity.businessModel = { value: 'saas', provenance: [{ source: 'user', confidence: 1, updatedAt: new Date().toISOString() }] };
  graph.identity.icpDescription = { value: 'Mid-market SaaS companies', provenance: [{ source: 'user', confidence: 1, updatedAt: new Date().toISOString() }] };
  graph.productOffer.primaryProducts = { value: ['Product A', 'Product B'], provenance: [{ source: 'user', confidence: 1, updatedAt: new Date().toISOString() }] };
  graph.productOffer.valueProposition = { value: 'Best in class solution', provenance: [{ source: 'user', confidence: 1, updatedAt: new Date().toISOString() }] };
  graph.audience.primaryAudience = { value: 'Marketing teams', provenance: [{ source: 'user', confidence: 1, updatedAt: new Date().toISOString() }] };
  graph.objectives.primaryObjective = { value: 'lead_generation', provenance: [{ source: 'user', confidence: 1, updatedAt: new Date().toISOString() }] };
  graph.operationalConstraints.minBudget = { value: 10000, provenance: [{ source: 'user', confidence: 1, updatedAt: new Date().toISOString() }] };
  graph.competitive.competitors = {
    value: [{ name: 'Competitor A', domain: 'competitor-a.com', category: 'direct' } as any],
    provenance: [{ source: 'user', confidence: 1, updatedAt: new Date().toISOString() }],
  };
  graph.brand.positioning = { value: 'Premium solution for growth teams', provenance: [{ source: 'user', confidence: 1, updatedAt: new Date().toISOString() }] };

  return graph;
}

// ============================================================================
// Tests
// ============================================================================

describe('Strategy-Ready Minimum (SRM)', () => {

  describe('isStrategyReady', () => {

    it('should return not ready when all SRM fields are missing', () => {
      const graph = createEmptyGraph();
      const result = isStrategyReady(graph);

      expect(result.ready).toBe(false);
      expect(result.missing.length).toBeGreaterThan(0);
      expect(result.presentCount).toBe(0);
    });

    it('should return ready when all SRM fields are present', () => {
      const graph = createPopulatedGraph();
      const result = isStrategyReady(graph);

      expect(result.ready).toBe(true);
      expect(result.missing.length).toBe(0);
      expect(result.presentCount).toBe(SRM_FIELDS.length);
      expect(result.completenessPercent).toBe(100);
    });

    it('should list specific missing fields when partially filled', () => {
      const graph = createEmptyGraph();
      // Only fill some fields
      graph.identity.businessModel = { value: 'saas', provenance: [] };
      graph.audience.primaryAudience = { value: 'Marketers', provenance: [] };

      const result = isStrategyReady(graph);

      expect(result.ready).toBe(false);
      expect(result.missing.length).toBeGreaterThan(0);
      expect(result.presentCount).toBe(2);

      // Check that missing fields include expected ones
      const missingLabels = result.missing.map(m => m.label);
      expect(missingLabels).toContain('Value Proposition');
      expect(missingLabels).toContain('Competitors');
    });

    it('should accept alternative fields (e.g., minBudget instead of budgetCapsFloors)', () => {
      const graph = createPopulatedGraph();
      // Clear budgetCapsFloors but keep minBudget
      graph.operationalConstraints.budgetCapsFloors = { value: [], provenance: [] };

      const result = isStrategyReady(graph);

      expect(result.ready).toBe(true);
      // minBudget is set as alternative
    });

  });

  describe('isSrmField', () => {

    it('should return true for SRM fields', () => {
      expect(isSrmField('identity', 'businessModel')).toBe(true);
      expect(isSrmField('audience', 'primaryAudience')).toBe(true);
      expect(isSrmField('competitive', 'competitors')).toBe(true);
    });

    it('should return true for alternative fields', () => {
      expect(isSrmField('objectives', 'primaryBusinessGoal')).toBe(true);
      expect(isSrmField('brand', 'valueProps')).toBe(true);
    });

    it('should return false for non-SRM fields', () => {
      expect(isSrmField('identity', 'peakSeasons')).toBe(false);
      expect(isSrmField('audience', 'deviceUsage')).toBe(false);
    });

  });

  describe('getAllSrmFieldPaths', () => {

    it('should return all SRM field paths including alternatives', () => {
      const paths = getAllSrmFieldPaths();

      expect(paths).toContain('identity.businessModel');
      expect(paths).toContain('audience.primaryAudience');
      expect(paths).toContain('competitive.competitors');

      // Should include alternatives
      expect(paths).toContain('objectives.primaryBusinessGoal');
      expect(paths).toContain('brand.valueProps');

      // Should not have duplicates
      const uniquePaths = [...new Set(paths)];
      expect(paths.length).toBe(uniquePaths.length);
    });

  });

  describe('checkRegenRecommendation', () => {

    it('should recommend regen when SRM field changes', () => {
      const oldContext = { businessModel: 'B2B SaaS' };
      const newContext = { businessModel: 'Marketplace' };

      const result = checkRegenRecommendation(oldContext, newContext);

      expect(result.recommended).toBe(true);
      expect(result.changedFields).toContain('businessModel');
      expect(result.message).toContain('businessModel');
    });

    it('should not recommend regen when non-SRM field changes', () => {
      const oldContext = { businessModel: 'B2B SaaS', notes: 'Old note' };
      const newContext = { businessModel: 'B2B SaaS', notes: 'New note' };

      const result = checkRegenRecommendation(oldContext, newContext);

      expect(result.recommended).toBe(false);
      expect(result.changedFields.length).toBe(0);
    });

    it('should detect multiple SRM field changes', () => {
      const oldContext = { businessModel: 'B2B', primaryAudience: 'SMBs' };
      const newContext = { businessModel: 'B2C', primaryAudience: 'Enterprise' };

      const result = checkRegenRecommendation(oldContext, newContext);

      expect(result.recommended).toBe(true);
      expect(result.changedFields.length).toBe(2);
      expect(result.message).toContain('SRM fields changed');
    });

  });

  describe('CONTEXT_SRM_FIELD_NAMES', () => {

    it('should contain expected fields', () => {
      expect(CONTEXT_SRM_FIELD_NAMES).toContain('businessModel');
      expect(CONTEXT_SRM_FIELD_NAMES).toContain('primaryAudience');
      expect(CONTEXT_SRM_FIELD_NAMES).toContain('objectives');
      expect(CONTEXT_SRM_FIELD_NAMES).toContain('budget');
      expect(CONTEXT_SRM_FIELD_NAMES).toContain('competitors');
    });

  });

});
