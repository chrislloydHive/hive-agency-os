// tests/flows/strategyReadiness.e2e.test.ts
// End-to-end smoke test for strategy flow readiness
//
// This test verifies the complete flow from Lab outputs to strategy generation:
// 1. Create empty graph
// 2. Import Lab outputs (minimal fixtures)
// 3. Check flow readiness
// 4. Verify canonical paths exist
// 5. Test provenance locks prevent AI overwrites

import { describe, it, expect, beforeEach } from 'vitest';
import { createEmptyContextGraph } from '@/lib/contextGraph/companyContextGraph';
import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';
import {
  setFieldUntyped,
  createProvenance,
  confirmField,
  isFieldConfirmed,
} from '@/lib/contextGraph/mutate';
import { checkFlowReadinessFromGraph } from '@/lib/os/flow/readiness';
import { validateCanonical } from '@/lib/diagnostics/shared';

// ============================================================================
// Test Fixtures - Minimal Lab Outputs
// ============================================================================

const TEST_COMPANY_ID = 'test-company-123';

/**
 * Minimal Brand Lab output
 */
const brandLabOutput = {
  positioning: 'The leading platform for business intelligence',
  valueProp: 'Access verified data on millions of companies',
  differentiators: ['Real-time data', 'AI-powered insights', 'Global coverage'],
  primaryAudience: 'Sales professionals and market researchers',
};

/**
 * Minimal Website Lab output
 */
const websiteLabOutput = {
  websiteScore: 75,
  websiteSummary: 'Good overall website with room for improvement',
  criticalIssues: ['Slow page load', 'Missing meta descriptions'],
};

/**
 * Minimal SEO Lab output
 */
const seoLabOutput = {
  seoScore: 72,
  seoSummary: 'Good organic visibility with room for improvement',
  topKeywords: ['company research', 'business data'],
  technicalHealth: 'good',
  topIssues: [{ title: 'Missing alt tags', severity: 'medium' }],
};

/**
 * Minimal Content Lab output
 */
const contentLabOutput = {
  contentScore: 65,
  contentSummary: 'Emerging content strategy needs development',
  keyTopics: ['market intelligence', 'startup ecosystem'],
};

// ============================================================================
// Helper Functions
// ============================================================================

function importBrandLabToGraph(graph: CompanyContextGraph): CompanyContextGraph {
  const provenance = createProvenance('brand_lab', { confidence: 0.85 });

  graph = setFieldUntyped(graph, 'brand', 'positioning', brandLabOutput.positioning, provenance);
  graph = setFieldUntyped(graph, 'brand', 'valueProps', [brandLabOutput.valueProp], provenance);
  graph = setFieldUntyped(graph, 'brand', 'differentiators', brandLabOutput.differentiators, provenance);

  return graph;
}

function importWebsiteLabToGraph(graph: CompanyContextGraph): CompanyContextGraph {
  const provenance = createProvenance('website_lab', { confidence: 0.9 });

  graph = setFieldUntyped(graph, 'website', 'websiteScore', websiteLabOutput.websiteScore, provenance);
  graph = setFieldUntyped(graph, 'website', 'websiteSummary', websiteLabOutput.websiteSummary, provenance);
  graph = setFieldUntyped(graph, 'website', 'criticalIssues', websiteLabOutput.criticalIssues, provenance);

  return graph;
}

function importSeoLabToGraph(graph: CompanyContextGraph): CompanyContextGraph {
  const provenance = createProvenance('seo_lab', { confidence: 0.8 });

  graph = setFieldUntyped(graph, 'seo', 'seoScore', seoLabOutput.seoScore, provenance);
  graph = setFieldUntyped(graph, 'seo', 'seoSummary', seoLabOutput.seoSummary, provenance);
  graph = setFieldUntyped(graph, 'seo', 'topKeywords', seoLabOutput.topKeywords, provenance);

  return graph;
}

function importContentLabToGraph(graph: CompanyContextGraph): CompanyContextGraph {
  const provenance = createProvenance('content_lab', { confidence: 0.75 });

  graph = setFieldUntyped(graph, 'content', 'contentScore', contentLabOutput.contentScore, provenance);
  graph = setFieldUntyped(graph, 'content', 'contentSummary', contentLabOutput.contentSummary, provenance);
  graph = setFieldUntyped(graph, 'content', 'keyTopics', contentLabOutput.keyTopics, provenance);

  return graph;
}

function addIdentityToGraph(graph: CompanyContextGraph): CompanyContextGraph {
  const provenance = createProvenance('user', { confidence: 1.0 });

  graph = setFieldUntyped(graph, 'identity', 'businessName', 'Test Company', provenance);
  graph = setFieldUntyped(graph, 'identity', 'businessModel', 'subscription', provenance);
  graph = setFieldUntyped(graph, 'identity', 'industry', 'Technology', provenance);
  graph = setFieldUntyped(graph, 'identity', 'marketMaturity', 'growth', provenance);

  return graph;
}

// ============================================================================
// Tests
// ============================================================================

describe('Strategy Flow End-to-End', () => {
  let graph: CompanyContextGraph;

  beforeEach(() => {
    graph = createEmptyContextGraph(TEST_COMPANY_ID, 'Test Company');
  });

  describe('Step 1: Empty Graph', () => {
    it('should start with an empty graph', () => {
      expect(graph.companyId).toBe(TEST_COMPANY_ID);
      expect(graph.companyName).toBe('Test Company');
    });

    it('should not be ready for strategy with empty graph', () => {
      const readiness = checkFlowReadinessFromGraph(graph, 'strategy', TEST_COMPANY_ID);

      expect(readiness.isReady).toBe(false);
      expect(readiness.completenessPercent).toBeLessThan(100);
      expect(readiness.missingCritical.length).toBeGreaterThan(0);
    });
  });

  describe('Step 2: Import Lab Outputs', () => {
    it('should import Brand Lab output', () => {
      graph = importBrandLabToGraph(graph);

      expect((graph.brand as any).positioning?.value).toBe(brandLabOutput.positioning);
      expect((graph.brand as any).differentiators?.value).toEqual(brandLabOutput.differentiators);
    });

    it('should import Website Lab output', () => {
      graph = importWebsiteLabToGraph(graph);

      expect((graph.website as any).websiteScore?.value).toBe(websiteLabOutput.websiteScore);
      expect((graph.website as any).websiteSummary?.value).toBe(websiteLabOutput.websiteSummary);
    });

    it('should import all Labs without conflicts', () => {
      graph = addIdentityToGraph(graph);
      graph = importBrandLabToGraph(graph);
      graph = importWebsiteLabToGraph(graph);
      graph = importSeoLabToGraph(graph);
      graph = importContentLabToGraph(graph);

      // All domains should have data
      expect((graph.identity as any).businessName?.value).toBeTruthy();
      expect((graph.brand as any).positioning?.value).toBeTruthy();
      expect((graph.website as any).websiteScore?.value).toBeTruthy();
      expect((graph.seo as any).seoScore?.value).toBeTruthy();
      expect((graph.content as any).contentScore?.value).toBeTruthy();
    });
  });

  describe('Step 3: Check Flow Readiness', () => {
    it('should be ready for strategy after importing Labs', () => {
      graph = addIdentityToGraph(graph);
      graph = importBrandLabToGraph(graph);
      graph = importWebsiteLabToGraph(graph);

      const readiness = checkFlowReadinessFromGraph(graph, 'strategy', TEST_COMPANY_ID);

      // Identity is critical for strategy
      expect(readiness.missingCritical.find(r => r.domain === 'identity')).toBeUndefined();
      expect(readiness.completenessPercent).toBe(100);
      expect(readiness.isReady).toBe(true);
    });

    it('should generate Lab CTAs for missing domains', () => {
      // Only add identity, no Labs
      graph = addIdentityToGraph(graph);

      const readiness = checkFlowReadinessFromGraph(graph, 'gap_full', TEST_COMPANY_ID);

      // gap_full requires brand, website, seo
      expect(readiness.isReady).toBe(false);
      expect(readiness.labCTAs.length).toBeGreaterThan(0);

      // Should have CTAs for missing Labs
      const labKeys = readiness.labCTAs.map(cta => cta.labKey);
      expect(labKeys).toContain('brand_lab');
      expect(labKeys).toContain('website_lab');
    });

    it('should handle different flow types correctly', () => {
      graph = addIdentityToGraph(graph);
      graph = importBrandLabToGraph(graph);
      graph = importWebsiteLabToGraph(graph);

      // Strategy should be ready (only needs identity critical)
      const strategyReadiness = checkFlowReadinessFromGraph(graph, 'strategy', TEST_COMPANY_ID);
      expect(strategyReadiness.isReady).toBe(true);

      // GAP IA should be ready (needs identity, brand, website)
      const gapIaReadiness = checkFlowReadinessFromGraph(graph, 'gap_ia', TEST_COMPANY_ID);
      expect(gapIaReadiness.isReady).toBe(true);

      // GAP Full needs SEO too
      const gapFullReadiness = checkFlowReadinessFromGraph(graph, 'gap_full', TEST_COMPANY_ID);
      expect(gapFullReadiness.isReady).toBe(false);
      expect(gapFullReadiness.missingCritical.some(r => r.domain === 'seo')).toBe(true);
    });
  });

  describe('Step 4: Canonical Paths Validation', () => {
    it('should have valid Brand Lab canonical structure', () => {
      // Structure must match the canonical spec paths (nested)
      const validation = validateCanonical('brand', {
        positioning: {
          statement: brandLabOutput.positioning,
        },
        valueProp: {
          headline: brandLabOutput.valueProp,
        },
        differentiators: {
          bullets: brandLabOutput.differentiators,
        },
        icp: {
          primaryAudience: brandLabOutput.primaryAudience,
        },
      });

      expect(validation.valid).toBe(true);
    });

    it('should have valid Website Lab canonical structure', () => {
      const validation = validateCanonical('website', {
        uxMaturity: 'established',
        primaryCta: 'Start Free Trial',
        topIssues: websiteLabOutput.criticalIssues,
      });

      expect(validation.valid).toBe(true);
    });

    it('should have valid SEO Lab canonical structure', () => {
      // Use hardcoded values matching SEO_LAB_SPEC requirements
      const validation = validateCanonical('seo', {
        maturityStage: 'scaling',
        technicalHealth: 'good',
        topIssues: [{ title: 'Missing alt tags', severity: 'medium' }],
      });

      expect(validation.valid).toBe(true);
    });

    it('should reject invalid canonical structure', () => {
      // Missing required fields should fail validation
      const validation = validateCanonical('brand', {
        // Missing positioning.statement, valueProp.headline, etc.
        someRandomField: 'value',
      });

      expect(validation.valid).toBe(false);
      expect(validation.missingFields.length).toBeGreaterThan(0);
    });
  });

  describe('Step 5: Provenance Locks', () => {
    it('should allow confirming a field', () => {
      graph = addIdentityToGraph(graph);

      expect(isFieldConfirmed(graph, 'identity', 'businessName')).toBe(false);

      graph = confirmField(graph, 'identity', 'businessName', 'test-user');

      expect(isFieldConfirmed(graph, 'identity', 'businessName')).toBe(true);
    });

    it('should block AI overwrites of human-confirmed fields', () => {
      graph = addIdentityToGraph(graph);
      graph = confirmField(graph, 'identity', 'businessName');

      const originalName = (graph.identity as any).businessName?.value;

      // Try to overwrite with AI source (gap_ia is allowed to write to identity)
      const aiProvenance = createProvenance('gap_ia', { confidence: 0.9 });
      graph = setFieldUntyped(graph, 'identity', 'businessName', 'AI Renamed Company', aiProvenance);

      // Should NOT be updated because field is confirmed
      expect((graph.identity as any).businessName?.value).toBe(originalName);
    });

    it('should allow user overwrites of human-confirmed fields', () => {
      graph = addIdentityToGraph(graph);
      graph = confirmField(graph, 'identity', 'businessName');

      // Overwrite with user source
      const userProvenance = createProvenance('user', { confidence: 1.0 });
      graph = setFieldUntyped(graph, 'identity', 'businessName', 'User Updated Company', userProvenance);

      // Should be updated
      expect((graph.identity as any).businessName?.value).toBe('User Updated Company');
    });

    it('should allow forced overwrites regardless of confirmation', () => {
      graph = addIdentityToGraph(graph);
      graph = confirmField(graph, 'identity', 'businessName');

      // Force overwrite with AI source (gap_ia is allowed)
      const aiProvenance = createProvenance('gap_ia', { confidence: 0.9 });
      graph = setFieldUntyped(
        graph,
        'identity',
        'businessName',
        'Force Renamed Company',
        aiProvenance,
        { force: true }
      );

      // Should be updated due to force
      expect((graph.identity as any).businessName?.value).toBe('Force Renamed Company');
    });
  });

  describe('Step 6: Empty Value Handling', () => {
    it('should not overwrite existing values with empty values', () => {
      // First set a valid value
      graph = addIdentityToGraph(graph);
      const originalName = (graph.identity as any).businessName?.value;

      // Try to write empty value
      const provenance = createProvenance('user', { confidence: 0.9 });
      graph = setFieldUntyped(graph, 'identity', 'businessName', '', provenance);

      // Value should remain unchanged (empty values are ignored)
      // Note: actual behavior depends on setFieldUntyped implementation
      // This test documents the expected behavior
      expect((graph.identity as any).businessName?.value).toBe(originalName);
    });
  });

  describe('Integration: Full Pipeline', () => {
    it('should complete full strategy readiness pipeline', () => {
      // Step 1: Start with empty graph
      expect(graph.companyId).toBe(TEST_COMPANY_ID);

      // Step 2: Add identity (user input)
      graph = addIdentityToGraph(graph);

      // Step 3: Import Labs
      graph = importBrandLabToGraph(graph);
      graph = importWebsiteLabToGraph(graph);
      graph = importSeoLabToGraph(graph);
      graph = importContentLabToGraph(graph);

      // Step 4: Check readiness for different flows
      const strategyReadiness = checkFlowReadinessFromGraph(graph, 'strategy', TEST_COMPANY_ID);
      const gapFullReadiness = checkFlowReadinessFromGraph(graph, 'gap_full', TEST_COMPANY_ID);

      expect(strategyReadiness.isReady).toBe(true);
      expect(gapFullReadiness.isReady).toBe(true);

      // Step 5: Confirm critical fields
      graph = confirmField(graph, 'identity', 'businessName', 'test-user');
      graph = confirmField(graph, 'brand', 'positioning', 'test-user');

      expect(isFieldConfirmed(graph, 'identity', 'businessName')).toBe(true);
      expect(isFieldConfirmed(graph, 'brand', 'positioning')).toBe(true);

      // Step 6: Verify AI cannot overwrite confirmed fields
      const aiProvenance = createProvenance('gap_full', { confidence: 0.8 });
      const businessNameBefore = (graph.identity as any).businessName?.value;

      graph = setFieldUntyped(graph, 'identity', 'businessName', 'AI Override Attempt', aiProvenance);

      expect((graph.identity as any).businessName?.value).toBe(businessNameBefore);

      // Pipeline complete!
      console.log('[E2E] Strategy readiness pipeline completed successfully');
    });
  });
});
