// tests/flows/websiteOptimization.e2e.test.ts
// End-to-end test for website optimization flow
//
// This test verifies the website optimization flow:
// 1. Check flow readiness for website_optimization
// 2. Test critical domain requirements (identity, website)
// 3. Test recommended domain requirements (brand, seo, audience, content)
// 4. Verify proper Lab CTAs are suggested

import { describe, it, expect, beforeEach } from 'vitest';
import { createEmptyContextGraph } from '@/lib/contextGraph/companyContextGraph';
import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';
import {
  setFieldUntyped,
  createProvenance,
} from '@/lib/contextGraph/mutate';
import { checkFlowReadinessFromGraph, getFlowDisplayName } from '@/lib/os/flow/readiness';

// ============================================================================
// Test Fixtures
// ============================================================================

const TEST_COMPANY_ID = 'test-company-website-opt';

/**
 * Add minimal identity data
 */
function addIdentityToGraph(graph: CompanyContextGraph): CompanyContextGraph {
  const provenance = createProvenance('user', { confidence: 1.0 });

  graph = setFieldUntyped(graph, 'identity', 'businessName', 'Test Company', provenance);
  graph = setFieldUntyped(graph, 'identity', 'businessModel', 'subscription', provenance);
  graph = setFieldUntyped(graph, 'identity', 'industry', 'Technology', provenance);

  return graph;
}

/**
 * Add minimal website data
 */
function addWebsiteDataToGraph(graph: CompanyContextGraph): CompanyContextGraph {
  const provenance = createProvenance('website_lab', { confidence: 0.9 });

  graph = setFieldUntyped(graph, 'website', 'websiteScore', 75, provenance);
  graph = setFieldUntyped(graph, 'website', 'executiveSummary', 'Good website with room for improvement', provenance);
  graph = setFieldUntyped(graph, 'website', 'criticalIssues', ['Slow page load', 'Missing meta descriptions'], provenance);
  graph = setFieldUntyped(graph, 'website', 'quickWins', ['Add alt tags', 'Compress images'], provenance);

  return graph;
}

/**
 * Add minimal brand data
 */
function addBrandDataToGraph(graph: CompanyContextGraph): CompanyContextGraph {
  const provenance = createProvenance('brand_lab', { confidence: 0.85 });

  graph = setFieldUntyped(graph, 'brand', 'positioning', 'The leading platform for X', provenance);
  graph = setFieldUntyped(graph, 'brand', 'differentiators', ['Fast', 'Reliable', 'Affordable'], provenance);

  return graph;
}

/**
 * Add minimal SEO data
 */
function addSeoDataToGraph(graph: CompanyContextGraph): CompanyContextGraph {
  const provenance = createProvenance('seo_lab', { confidence: 0.8 });

  graph = setFieldUntyped(graph, 'seo', 'seoScore', 72, provenance);
  graph = setFieldUntyped(graph, 'seo', 'topKeywords', ['keyword1', 'keyword2'], provenance);

  return graph;
}

/**
 * Add minimal audience data
 */
function addAudienceDataToGraph(graph: CompanyContextGraph): CompanyContextGraph {
  const provenance = createProvenance('audience_lab', { confidence: 0.8 });

  graph = setFieldUntyped(graph, 'audience', 'primaryAudience', 'Business professionals', provenance);
  graph = setFieldUntyped(graph, 'audience', 'painPoints', ['Time constraints', 'Budget limitations'], provenance);

  return graph;
}

/**
 * Add minimal content data
 */
function addContentDataToGraph(graph: CompanyContextGraph): CompanyContextGraph {
  const provenance = createProvenance('content_lab', { confidence: 0.75 });

  graph = setFieldUntyped(graph, 'content', 'contentScore', 65, provenance);
  graph = setFieldUntyped(graph, 'content', 'contentSummary', 'Emerging content strategy', provenance);

  return graph;
}

// ============================================================================
// Tests
// ============================================================================

describe('Website Optimization Flow', () => {
  let graph: CompanyContextGraph;

  beforeEach(() => {
    graph = createEmptyContextGraph(TEST_COMPANY_ID, 'Test Company');
  });

  describe('Flow Type Registration', () => {
    it('should have website_optimization as a valid flow type', () => {
      const displayName = getFlowDisplayName('website_optimization');
      expect(displayName).toBe('Website Optimization');
    });
  });

  describe('Empty Graph Readiness', () => {
    it('should not be ready with an empty graph', () => {
      const readiness = checkFlowReadinessFromGraph(graph, 'website_optimization', TEST_COMPANY_ID);

      expect(readiness.isReady).toBe(false);
      expect(readiness.flow).toBe('website_optimization');
    });

    it('should require identity as critical', () => {
      const readiness = checkFlowReadinessFromGraph(graph, 'website_optimization', TEST_COMPANY_ID);

      const identityMissing = readiness.missingCritical.find(r => r.domain === 'identity');
      expect(identityMissing).toBeDefined();
      expect(identityMissing?.required).toBe(true);
    });

    it('should require website as critical', () => {
      const readiness = checkFlowReadinessFromGraph(graph, 'website_optimization', TEST_COMPANY_ID);

      const websiteMissing = readiness.missingCritical.find(r => r.domain === 'website');
      expect(websiteMissing).toBeDefined();
      expect(websiteMissing?.required).toBe(true);
    });
  });

  describe('Partial Data Readiness', () => {
    it('should not be ready with only identity', () => {
      graph = addIdentityToGraph(graph);

      const readiness = checkFlowReadinessFromGraph(graph, 'website_optimization', TEST_COMPANY_ID);

      expect(readiness.isReady).toBe(false);
      expect(readiness.missingCritical.some(r => r.domain === 'website')).toBe(true);
    });

    it('should not be ready with only website', () => {
      graph = addWebsiteDataToGraph(graph);

      const readiness = checkFlowReadinessFromGraph(graph, 'website_optimization', TEST_COMPANY_ID);

      expect(readiness.isReady).toBe(false);
      expect(readiness.missingCritical.some(r => r.domain === 'identity')).toBe(true);
    });

    it('should be ready with identity and website (critical domains)', () => {
      graph = addIdentityToGraph(graph);
      graph = addWebsiteDataToGraph(graph);

      const readiness = checkFlowReadinessFromGraph(graph, 'website_optimization', TEST_COMPANY_ID);

      expect(readiness.isReady).toBe(true);
      expect(readiness.missingCritical.length).toBe(0);
      expect(readiness.completenessPercent).toBe(100);
    });
  });

  describe('Recommended Domains', () => {
    it('should flag brand as recommended when missing', () => {
      graph = addIdentityToGraph(graph);
      graph = addWebsiteDataToGraph(graph);

      const readiness = checkFlowReadinessFromGraph(graph, 'website_optimization', TEST_COMPANY_ID);

      const brandMissing = readiness.missingRecommended.find(r => r.domain === 'brand');
      expect(brandMissing).toBeDefined();
    });

    it('should flag seo as recommended when missing', () => {
      graph = addIdentityToGraph(graph);
      graph = addWebsiteDataToGraph(graph);

      const readiness = checkFlowReadinessFromGraph(graph, 'website_optimization', TEST_COMPANY_ID);

      const seoMissing = readiness.missingRecommended.find(r => r.domain === 'seo');
      expect(seoMissing).toBeDefined();
    });

    it('should flag audience as recommended when missing', () => {
      graph = addIdentityToGraph(graph);
      graph = addWebsiteDataToGraph(graph);

      const readiness = checkFlowReadinessFromGraph(graph, 'website_optimization', TEST_COMPANY_ID);

      const audienceMissing = readiness.missingRecommended.find(r => r.domain === 'audience');
      expect(audienceMissing).toBeDefined();
    });

    it('should flag content as recommended when missing', () => {
      graph = addIdentityToGraph(graph);
      graph = addWebsiteDataToGraph(graph);

      const readiness = checkFlowReadinessFromGraph(graph, 'website_optimization', TEST_COMPANY_ID);

      const contentMissing = readiness.missingRecommended.find(r => r.domain === 'content');
      expect(contentMissing).toBeDefined();
    });
  });

  describe('Lab CTAs', () => {
    it('should suggest website_lab when website is missing', () => {
      graph = addIdentityToGraph(graph);

      const readiness = checkFlowReadinessFromGraph(graph, 'website_optimization', TEST_COMPANY_ID);

      const websiteLabCta = readiness.labCTAs.find(cta => cta.labKey === 'website_lab');
      expect(websiteLabCta).toBeDefined();
      expect(websiteLabCta?.priority).toBe('critical');
    });

    it('should suggest brand_lab when brand is missing', () => {
      graph = addIdentityToGraph(graph);
      graph = addWebsiteDataToGraph(graph);

      const readiness = checkFlowReadinessFromGraph(graph, 'website_optimization', TEST_COMPANY_ID);

      const brandLabCta = readiness.labCTAs.find(cta => cta.labKey === 'brand_lab');
      expect(brandLabCta).toBeDefined();
      expect(brandLabCta?.priority).toBe('recommended');
    });

    it('should suggest seo_lab when seo is missing', () => {
      graph = addIdentityToGraph(graph);
      graph = addWebsiteDataToGraph(graph);

      const readiness = checkFlowReadinessFromGraph(graph, 'website_optimization', TEST_COMPANY_ID);

      const seoLabCta = readiness.labCTAs.find(cta => cta.labKey === 'seo_lab');
      expect(seoLabCta).toBeDefined();
      expect(seoLabCta?.priority).toBe('recommended');
    });
  });

  describe('Full Context Readiness', () => {
    it('should have no missing domains when all data is present', () => {
      graph = addIdentityToGraph(graph);
      graph = addWebsiteDataToGraph(graph);
      graph = addBrandDataToGraph(graph);
      graph = addSeoDataToGraph(graph);
      graph = addAudienceDataToGraph(graph);
      graph = addContentDataToGraph(graph);

      const readiness = checkFlowReadinessFromGraph(graph, 'website_optimization', TEST_COMPANY_ID);

      expect(readiness.isReady).toBe(true);
      expect(readiness.missingCritical.length).toBe(0);
      expect(readiness.missingRecommended.length).toBe(0);
      expect(readiness.labCTAs.length).toBe(0);
    });

    it('should still be ready even without optional domains', () => {
      graph = addIdentityToGraph(graph);
      graph = addWebsiteDataToGraph(graph);
      graph = addBrandDataToGraph(graph);
      graph = addSeoDataToGraph(graph);
      graph = addAudienceDataToGraph(graph);
      graph = addContentDataToGraph(graph);

      // productOffer, competitive, objectives are all optional
      const readiness = checkFlowReadinessFromGraph(graph, 'website_optimization', TEST_COMPANY_ID);

      expect(readiness.isReady).toBe(true);
    });
  });

  describe('Proceed Anyway', () => {
    it('should allow proceed anyway when only one critical domain is missing', () => {
      graph = addIdentityToGraph(graph);
      // Website is missing (critical)

      const readiness = checkFlowReadinessFromGraph(graph, 'website_optimization', TEST_COMPANY_ID);

      // canProceedAnyway is true if <= 1 critical domain is missing
      expect(readiness.canProceedAnyway).toBe(true);
    });

    it('should not allow proceed anyway when multiple critical domains are missing', () => {
      // Both identity and website are missing
      const readiness = checkFlowReadinessFromGraph(graph, 'website_optimization', TEST_COMPANY_ID);

      expect(readiness.canProceedAnyway).toBe(false);
    });

    it('should include proceed anyway warning when not ready', () => {
      graph = addIdentityToGraph(graph);

      const readiness = checkFlowReadinessFromGraph(graph, 'website_optimization', TEST_COMPANY_ID);

      expect(readiness.proceedAnywayWarning).toBeTruthy();
      expect(readiness.proceedAnywayWarning).toContain('Missing critical data');
    });
  });

  describe('Integration: Full Website Optimization Pipeline', () => {
    it('should complete full website optimization readiness flow', () => {
      // Step 1: Start with empty graph - not ready
      let readiness = checkFlowReadinessFromGraph(graph, 'website_optimization', TEST_COMPANY_ID);
      expect(readiness.isReady).toBe(false);
      expect(readiness.missingCritical.length).toBe(2); // identity, website

      // Step 2: Add identity - still not ready (missing website)
      graph = addIdentityToGraph(graph);
      readiness = checkFlowReadinessFromGraph(graph, 'website_optimization', TEST_COMPANY_ID);
      expect(readiness.isReady).toBe(false);
      expect(readiness.missingCritical.length).toBe(1); // website
      expect(readiness.canProceedAnyway).toBe(true);

      // Step 3: Add website - now ready
      graph = addWebsiteDataToGraph(graph);
      readiness = checkFlowReadinessFromGraph(graph, 'website_optimization', TEST_COMPANY_ID);
      expect(readiness.isReady).toBe(true);
      expect(readiness.missingCritical.length).toBe(0);

      // Step 4: Add recommended domains for better quality
      graph = addBrandDataToGraph(graph);
      graph = addSeoDataToGraph(graph);
      readiness = checkFlowReadinessFromGraph(graph, 'website_optimization', TEST_COMPANY_ID);
      expect(readiness.isReady).toBe(true);
      expect(readiness.missingRecommended.length).toBe(2); // audience, content still missing

      // Step 5: Add remaining recommended domains
      graph = addAudienceDataToGraph(graph);
      graph = addContentDataToGraph(graph);
      readiness = checkFlowReadinessFromGraph(graph, 'website_optimization', TEST_COMPANY_ID);
      expect(readiness.isReady).toBe(true);
      expect(readiness.missingRecommended.length).toBe(0);
      expect(readiness.labCTAs.length).toBe(0);

      console.log('[E2E] Website optimization readiness pipeline completed successfully');
    });
  });
});
