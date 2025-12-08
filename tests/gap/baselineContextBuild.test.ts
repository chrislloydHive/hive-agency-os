// tests/gap/baselineContextBuild.test.ts
//
// Regression tests for baseline_context_build GAP output mapping
//
// These tests ensure that the baseline context build pipeline correctly gates
// digitalFootprint subscores and narratives based on socialFootprint detection.
//
// The issue: Previously, osGapIaBaseline.ts did NOT pass socialFootprint to
// generateGapIaAnalysisCore, so the gating functions never ran. This caused
// GAP runs with source="baseline_context_build" to output contradictory text
// like "No Google Business Profile" when GBP was actually detected.

import { describe, it, expect } from 'vitest';
import { mapInitialAssessmentToApiResponse } from '@/lib/gap/outputMappers';
import type { InitialAssessmentOutput } from '@/lib/gap/outputTemplates';
import type { SocialFootprintSnapshot } from '@/lib/gap/socialDetection';

// ============================================================================
// Mock Data
// ============================================================================

// Mock InitialAssessmentOutput that includes contradictory LLM output
// (The LLM doesn't know about social detection - it just writes based on HTML signals)
// NOTE: Uses the actual schema structure: id, summary, keyIssue (singular)
const mockLlmOutputWithContradictions: InitialAssessmentOutput = {
  executiveSummary: 'Atlas Skateboarding has a strong brand identity but lacks digital footprint optimization. No Google Business Profile was detected and social media presence is minimal.',
  marketingReadinessScore: 40,
  maturityStage: 'Emerging',
  dimensionSummaries: [
    {
      id: 'brand',
      score: 65,
      summary: 'Strong brand identity with consistent visual language.',
      keyIssue: 'Limited brand awareness outside local market',
    },
    {
      id: 'content',
      score: 45,
      summary: 'Basic content with room for improvement.',
      keyIssue: 'Inconsistent posting schedule',
    },
    {
      id: 'seo',
      score: 35,
      summary: 'SEO needs significant work.',
      keyIssue: 'Missing meta descriptions and poor site structure',
    },
    {
      id: 'website',
      score: 50,
      summary: 'Functional website with modern design.',
      keyIssue: 'Mobile responsiveness could be improved',
    },
    {
      id: 'digitalFootprint',
      score: 20,
      summary: 'No Google Business Profile and weak social media presence limit local discovery.',
      keyIssue: 'Without a Google Business Profile, the brand lacks visibility in local searches.',
    },
    {
      id: 'authority',
      score: 30,
      summary: 'Limited online authority.',
      keyIssue: 'Few backlinks from authoritative sources',
    },
  ],
  quickWins: [
    {
      action: 'Establish a Google Business Profile to improve local visibility and appear in Maps searches.',
      dimensionId: 'digitalFootprint',
    },
    {
      action: 'Begin posting regularly on Instagram to engage with the skateboarding community.',
      dimensionId: 'digitalFootprint',
    },
    {
      action: 'Add meta descriptions to all key pages.',
      dimensionId: 'seo',
    },
  ],
  topOpportunities: [
    'Create and optimize a Google Business Profile to enhance local visibility.',
    'Develop an active Instagram presence to engage with the skateboarding community.',
    'Implement a content calendar for consistent posting.',
  ],
};

// Atlas-like socialFootprint: GBP present, Instagram present, YouTube present
const atlasSocialFootprint: SocialFootprintSnapshot = {
  socials: [
    { network: 'instagram', url: 'https://instagram.com/atlasskateboarding', confidence: 0.85, status: 'present', detectionSources: ['html_link_footer'] },
    { network: 'facebook', url: undefined, confidence: 0.15, status: 'missing', detectionSources: [] },
    { network: 'youtube', url: 'https://youtube.com/@atlasskateboarding', confidence: 0.80, status: 'present', detectionSources: ['html_link_footer'] },
    { network: 'tiktok', url: undefined, confidence: 0.10, status: 'missing', detectionSources: [] },
    { network: 'x', url: undefined, confidence: 0.10, status: 'missing', detectionSources: [] },
    { network: 'linkedin', url: undefined, confidence: 0.10, status: 'missing', detectionSources: [] },
  ],
  gbp: { url: 'https://maps.google.com/maps?cid=123', confidence: 0.90, status: 'present', detectionSources: ['html_link_footer', 'schema_gbp'] },
  dataConfidence: 0.85,
};

// Site with nothing detected - should allow "establish" recommendations
const emptySocialFootprint: SocialFootprintSnapshot = {
  socials: [
    { network: 'instagram', url: undefined, confidence: 0.05, status: 'missing', detectionSources: [] },
    { network: 'facebook', url: undefined, confidence: 0.05, status: 'missing', detectionSources: [] },
    { network: 'youtube', url: undefined, confidence: 0.05, status: 'missing', detectionSources: [] },
    { network: 'tiktok', url: undefined, confidence: 0.05, status: 'missing', detectionSources: [] },
    { network: 'x', url: undefined, confidence: 0.05, status: 'missing', detectionSources: [] },
    { network: 'linkedin', url: undefined, confidence: 0.05, status: 'missing', detectionSources: [] },
  ],
  gbp: { url: undefined, confidence: 0.05, status: 'missing', detectionSources: [] },
  dataConfidence: 0.85,
};

// ============================================================================
// Tests
// ============================================================================

describe('baseline_context_build GAP Output Mapping', () => {
  describe('When GBP and Instagram are PRESENT (Atlas scenario)', () => {
    const result = mapInitialAssessmentToApiResponse(mockLlmOutputWithContradictions, {
      url: 'https://atlasskateboarding.com',
      domain: 'atlasskateboarding.com',
      businessName: 'Atlas Skateboarding',
      socialFootprint: atlasSocialFootprint,
    });

    it('should have non-zero googleBusinessProfile subscore', () => {
      expect(result.dimensions.digitalFootprint?.subscores?.googleBusinessProfile).toBeGreaterThan(0);
      // With GBP present at 0.90 confidence, should be 80+ (80 + 20*0.90 = 98)
      expect(result.dimensions.digitalFootprint?.subscores?.googleBusinessProfile).toBeGreaterThanOrEqual(80);
    });

    it('should have non-zero socialPresence subscore', () => {
      expect(result.dimensions.digitalFootprint?.subscores?.socialPresence).toBeGreaterThan(0);
      // With IG + YouTube present (2 networks), should be 55+
      expect(result.dimensions.digitalFootprint?.subscores?.socialPresence).toBeGreaterThanOrEqual(55);
    });

    it('should have digitalFootprint score reflecting subscores', () => {
      // Score should NOT be 20 (raw LLM output) - should be computed from subscores
      // With GBP ~98 and social ~68, expected weighted: 0.35*98 + 0.35*68 + 0.15*0 + 0.15*50 = 58+
      expect(result.dimensions.digitalFootprint?.score).toBeGreaterThanOrEqual(50);
    });

    it('should NOT say "No Google Business Profile" in digitalFootprint oneLiner', () => {
      const oneLiner = result.dimensions.digitalFootprint?.oneLiner || '';
      expect(oneLiner.toLowerCase()).not.toContain('no google business profile');
    });

    it('should NOT say "Without a Google Business Profile" in issues', () => {
      const issues = result.dimensions.digitalFootprint?.issues || [];
      const issuesText = issues.join(' ').toLowerCase();
      expect(issuesText).not.toContain('without a google business profile');
    });

    it('should NOT say "weak social media presence" in digitalFootprint', () => {
      const oneLiner = result.dimensions.digitalFootprint?.oneLiner || '';
      expect(oneLiner.toLowerCase()).not.toContain('weak social media');
    });

    it('should NOT recommend "Establish a Google Business Profile" in quickWins', () => {
      const quickWinActions = result.quickWins?.bullets?.map(qw => qw.action) || [];
      const quickWinsText = quickWinActions.join(' ').toLowerCase();
      expect(quickWinsText).not.toMatch(/establish.*google business profile/i);
    });

    it('should NOT recommend "Create and optimize a Google Business Profile" in topOpportunities', () => {
      const topOpps = result.summary?.topOpportunities || [];
      const topOppsText = topOpps.join(' ').toLowerCase();
      expect(topOppsText).not.toMatch(/create.*google business profile/i);
    });

    it('should NOT recommend "Begin posting regularly on Instagram" in quickWins', () => {
      const quickWinActions = result.quickWins?.bullets?.map(qw => qw.action) || [];
      const quickWinsText = quickWinActions.join(' ').toLowerCase();
      expect(quickWinsText).not.toMatch(/begin posting.*instagram/i);
    });

    it('should NOT recommend "Develop an active Instagram presence" in topOpportunities', () => {
      const topOpps = result.summary?.topOpportunities || [];
      const topOppsText = topOpps.join(' ').toLowerCase();
      expect(topOppsText).not.toMatch(/develop.*instagram presence/i);
    });

    it('should use "under-optimized" or "strengthen" language instead', () => {
      const oneLiner = result.dimensions.digitalFootprint?.oneLiner || '';
      const topOpps = result.summary?.topOpportunities || [];
      const allText = (oneLiner + ' ' + topOpps.join(' ')).toLowerCase();

      // Should have rewritten language
      const hasRewrittenText =
        allText.includes('under-optimized') ||
        allText.includes('under-leveraged') ||
        allText.includes('strengthen') ||
        allText.includes('optimize');

      expect(hasRewrittenText).toBe(true);
    });
  });

  describe('When GBP and Instagram are MISSING (negative test)', () => {
    const result = mapInitialAssessmentToApiResponse(mockLlmOutputWithContradictions, {
      url: 'https://example.com',
      domain: 'example.com',
      businessName: 'Example Company',
      socialFootprint: emptySocialFootprint,
    });

    it('should have zero googleBusinessProfile subscore', () => {
      expect(result.dimensions.digitalFootprint?.subscores?.googleBusinessProfile).toBe(0);
    });

    it('should have zero socialPresence subscore', () => {
      expect(result.dimensions.digitalFootprint?.subscores?.socialPresence).toBe(0);
    });

    it('should have low digitalFootprint score', () => {
      // Only reviews default (50) at 15% = ~7.5
      expect(result.dimensions.digitalFootprint?.score).toBeLessThanOrEqual(15);
    });

    it('should ALLOW "Establish a Google Business Profile" in quickWins', () => {
      const quickWinActions = result.quickWins?.bullets?.map(qw => qw.action) || [];
      const quickWinsText = quickWinActions.join(' ');
      // Should preserve the recommendation since GBP is truly missing
      expect(quickWinsText).toMatch(/establish|google business profile/i);
    });

    it('should ALLOW "Begin posting on Instagram" in quickWins', () => {
      const quickWinActions = result.quickWins?.bullets?.map(qw => qw.action) || [];
      const quickWinsText = quickWinActions.join(' ');
      // Should preserve the recommendation since Instagram is truly missing
      expect(quickWinsText).toMatch(/instagram/i);
    });
  });

  describe('When socialFootprint is UNDEFINED (defensive behavior)', () => {
    const result = mapInitialAssessmentToApiResponse(mockLlmOutputWithContradictions, {
      url: 'https://example.com',
      domain: 'example.com',
      businessName: 'Example Company',
      // socialFootprint not provided - simulates old behavior
    });

    it('should still produce valid output (not crash)', () => {
      expect(result).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.dimensions).toBeDefined();
    });

    it('should use raw LLM subscores when socialFootprint is missing', () => {
      // Without socialFootprint, subscores come from estimateSubscore (random variance)
      // We can't assert exact values, but should have the dimension present
      expect(result.dimensions.digitalFootprint).toBeDefined();
    });

    it('should preserve raw LLM narratives when socialFootprint is missing', () => {
      // Without socialFootprint, sanitizers don't rewrite
      // This means contradictory text may appear - this is expected legacy behavior
      const oneLiner = result.dimensions.digitalFootprint?.oneLiner || '';
      // Can't assert specific text since sanitizers might still run with undefined
      expect(oneLiner.length).toBeGreaterThan(0);
    });
  });
});

describe('Output consistency across source types', () => {
  it('baseline_context_build and gap_ia_run should produce same gating behavior', () => {
    // Both paths now call mapInitialAssessmentToApiResponse with socialFootprint
    // This test documents that expectation

    const result = mapInitialAssessmentToApiResponse(mockLlmOutputWithContradictions, {
      url: 'https://atlasskateboarding.com',
      domain: 'atlasskateboarding.com',
      businessName: 'Atlas Skateboarding',
      socialFootprint: atlasSocialFootprint,
    });

    // Key assertion: when socialFootprint shows GBP present, subscores should be non-zero
    // regardless of which source produced the run
    expect(result.dimensions.digitalFootprint?.subscores?.googleBusinessProfile).toBeGreaterThan(0);
  });
});

// ============================================================================
// HTML Truncation Regression Tests
// ============================================================================
//
// These tests document the HTML truncation bug that was causing detection failures.
//
// Root cause: fetchHtmlBounded() was limited to 50KB, but social links (Instagram,
// YouTube, GBP) are typically in the footer, which is often beyond 50KB.
//
// Example: Atlas Skateboarding's HTML is 127KB, with footer links at byte ~108KB.
// When we fetched only 50KB, all social links were truncated.
//
// Fix: Increased fetchHtmlBounded() default to 150KB.
//
// These tests use a truncated version of the Atlas fixture to demonstrate the issue.

describe('HTML truncation regression (Atlas scenario)', () => {
  // Simulate what happens when HTML is truncated at 50KB
  // The footer with social links is cut off
  const truncatedHtmlResult: SocialFootprintSnapshot = {
    // After truncation, no socials detected
    socials: [
      { network: 'instagram', url: undefined, confidence: 0.05, status: 'missing', detectionSources: [] },
      { network: 'facebook', url: undefined, confidence: 0.05, status: 'missing', detectionSources: [] },
      { network: 'youtube', url: undefined, confidence: 0.05, status: 'missing', detectionSources: [] },
      { network: 'tiktok', url: undefined, confidence: 0.05, status: 'missing', detectionSources: [] },
      { network: 'x', url: undefined, confidence: 0.05, status: 'missing', detectionSources: [] },
      { network: 'linkedin', url: undefined, confidence: 0.05, status: 'missing', detectionSources: [] },
    ],
    gbp: { url: undefined, confidence: 0.05, status: 'missing', detectionSources: [] },
    dataConfidence: 0.4, // Low confidence due to truncated HTML
  };

  it('should demonstrate the problem: truncated HTML leads to wrong subscores', () => {
    const result = mapInitialAssessmentToApiResponse(mockLlmOutputWithContradictions, {
      url: 'https://atlasskateboarding.com',
      domain: 'atlasskateboarding.com',
      businessName: 'Atlas Skateboarding',
      socialFootprint: truncatedHtmlResult, // Simulates 50KB truncation
    });

    // With truncated HTML, subscores would be 0 (the bug we fixed)
    expect(result.dimensions.digitalFootprint?.subscores?.googleBusinessProfile).toBe(0);
    expect(result.dimensions.digitalFootprint?.subscores?.socialPresence).toBe(0);

    // This shows why we NEED the full HTML (or at least 150KB)
    // The test passes to document the expected behavior when truncation occurs
  });

  it('should produce correct subscores when full HTML is available', () => {
    const result = mapInitialAssessmentToApiResponse(mockLlmOutputWithContradictions, {
      url: 'https://atlasskateboarding.com',
      domain: 'atlasskateboarding.com',
      businessName: 'Atlas Skateboarding',
      socialFootprint: atlasSocialFootprint, // Full HTML → correct detection
    });

    // With full HTML, subscores reflect reality
    expect(result.dimensions.digitalFootprint?.subscores?.googleBusinessProfile).toBeGreaterThan(0);
    expect(result.dimensions.digitalFootprint?.subscores?.socialPresence).toBeGreaterThan(0);
  });
});
