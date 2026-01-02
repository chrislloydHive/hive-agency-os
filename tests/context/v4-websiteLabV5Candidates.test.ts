// tests/context/v4-websiteLabV5Candidates.test.ts
// Tests for Website Lab V5 → Review Queue proposal pipeline
//
// Verifies:
// 1. buildWebsiteLabV5Candidates produces >= 5 candidates
// 2. Evidence strings include page paths (e.g., "Page: /")
// 3. V5 is preferred over V4 when both exist
// 4. Fallback to V4 when V5 is missing

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { V5DiagnosticOutput } from '@/lib/gap-heavy/modules/websiteLabV5';
import {
  buildWebsiteLabV5Candidates,
  buildWebsiteLabCandidatesWithV5,
  extractV5DiagnosticFromRaw,
} from '@/lib/contextGraph/v4/websiteLabCandidates';

// ============================================================================
// Mock V5 Diagnostic Data
// ============================================================================

const mockV5Diagnostic: V5DiagnosticOutput = {
  observations: [
    {
      pagePath: '/',
      pageType: 'home',
      aboveFoldElements: ['Hero headline', 'CTA button'],
      primaryCTAs: [{ text: 'Get Started', position: 'above_fold', destination: '/signup' }],
      trustProofElements: ['Client logos', 'Testimonials'],
      missingUnclearElements: ['Value prop unclear', 'No social proof above fold'],
    },
    {
      pagePath: '/pricing',
      pageType: 'pricing',
      aboveFoldElements: ['Pricing headline'],
      primaryCTAs: [],
      trustProofElements: [],
      missingUnclearElements: ['No clear pricing table', 'Missing comparison'],
    },
  ],
  personaJourneys: [
    {
      persona: 'first_time',
      startingPage: '/',
      intendedGoal: 'Understand what the product does',
      actualPath: ['/', '/about'],
      failurePoint: null,
      confidenceScore: 75,
      succeeded: true,
    },
    {
      persona: 'ready_to_buy',
      startingPage: '/',
      intendedGoal: 'Find pricing and sign up',
      actualPath: ['/', '/pricing'],
      failurePoint: { page: '/pricing', reason: 'No clear pricing visible' },
      confidenceScore: 40,
      succeeded: false,
    },
    {
      persona: 'comparison_shopper',
      startingPage: '/',
      intendedGoal: 'Compare features with competitors',
      actualPath: ['/', '/features'],
      failurePoint: { page: '/features', reason: 'No feature comparison table' },
      confidenceScore: 35,
      succeeded: false,
    },
  ],
  blockingIssues: [
    {
      id: 1,
      severity: 'high',
      affectedPersonas: ['ready_to_buy'],
      page: '/pricing',
      whyItBlocks: 'No clear pricing visible above the fold',
      concreteFix: { what: 'Add pricing table', where: 'Above fold on /pricing' },
    },
    {
      id: 2,
      severity: 'high',
      affectedPersonas: ['first_time'],
      page: '/',
      whyItBlocks: 'Missing clear CTA on homepage hero',
      concreteFix: { what: 'Add prominent CTA button', where: 'Hero section' },
    },
    {
      id: 3,
      severity: 'medium',
      affectedPersonas: ['comparison_shopper'],
      page: '/features',
      whyItBlocks: 'No feature comparison with competitors',
      concreteFix: { what: 'Add comparison table', where: '/features page' },
    },
  ],
  quickWins: [
    {
      addressesIssueId: 1,
      title: 'Add pricing table',
      action: 'Create a clear pricing table with plan comparison',
      page: '/pricing',
      expectedImpact: 'Increase conversion by 20%',
    },
    {
      addressesIssueId: 2,
      title: 'Add homepage CTA',
      action: 'Add prominent call-to-action button in hero section',
      page: '/',
      expectedImpact: 'Reduce bounce rate by 15%',
    },
    {
      addressesIssueId: 3,
      title: 'Add feature comparison',
      action: 'Create feature comparison table showing vs competitors',
      page: '/features',
      expectedImpact: 'Improve comparison shopper conversion',
    },
  ],
  structuralChanges: [
    {
      addressesIssueIds: [1, 2],
      title: 'Restructure conversion funnel',
      description: 'Improve user journey from homepage to pricing with clearer CTAs',
      pagesAffected: ['/', '/pricing'],
      rationale: 'Users are dropping off due to unclear path to purchase',
    },
  ],
  score: 58,
  scoreJustification: 'The overall score of 58/100 indicates significant room for improvement in the website\'s user experience, particularly in the conversion funnel. Key findings illustrate that the homepage is lacking a clear primary call-to-action (CTA) and the pricing page does not adequately communicate value.',
};

// ============================================================================
// Test: buildWebsiteLabV5Candidates
// ============================================================================

describe('buildWebsiteLabV5Candidates', () => {
  it('should produce >= 5 candidates from V5 diagnostic', () => {
    const result = buildWebsiteLabV5Candidates(mockV5Diagnostic, 'run_test_123');

    expect(result.candidates.length).toBeGreaterThanOrEqual(5);
    expect(result.fieldKeys.length).toBeGreaterThanOrEqual(5);
  });

  it('should include websiteScore candidate', () => {
    const result = buildWebsiteLabV5Candidates(mockV5Diagnostic, 'run_test_123');

    const scoreCandidate = result.candidates.find(c => c.key === 'website.websiteScore');
    expect(scoreCandidate).toBeDefined();
    expect(scoreCandidate?.value).toBe(58);
    expect(scoreCandidate?.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('should include executiveSummary candidate', () => {
    const result = buildWebsiteLabV5Candidates(mockV5Diagnostic, 'run_test_123');

    const summaryCandidate = result.candidates.find(c => c.key === 'website.executiveSummary');
    expect(summaryCandidate).toBeDefined();
    expect(typeof summaryCandidate?.value).toBe('string');
    expect((summaryCandidate?.value as string).length).toBeGreaterThan(50);
  });

  it('should include quickWins candidate with page-anchored actions', () => {
    const result = buildWebsiteLabV5Candidates(mockV5Diagnostic, 'run_test_123');

    const quickWinsCandidate = result.candidates.find(c => c.key === 'website.quickWins');
    expect(quickWinsCandidate).toBeDefined();
    expect(Array.isArray(quickWinsCandidate?.value)).toBe(true);

    // Value should include page paths and actions
    const qwValue = quickWinsCandidate?.value as string[];
    expect(qwValue.some(qw => qw.includes('/pricing'))).toBe(true);
    expect(qwValue.some(qw => qw.includes('pricing table'))).toBe(true);

    // Evidence should include page paths
    expect(quickWinsCandidate?.evidence?.snippet).toContain('/pricing');
  });

  it('should include conversionBlocks candidate with page paths and fixes', () => {
    const result = buildWebsiteLabV5Candidates(mockV5Diagnostic, 'run_test_123');

    const blocksCandidate = result.candidates.find(c => c.key === 'website.conversionBlocks');
    expect(blocksCandidate).toBeDefined();
    expect(Array.isArray(blocksCandidate?.value)).toBe(true);

    // Value should include page paths and concrete fixes (now uses → separator)
    const blocksValue = blocksCandidate?.value as string[];
    expect(blocksValue.some(b => b.includes('/pricing'))).toBe(true);
    expect(blocksValue.some(b => b.includes('→'))).toBe(true); // Fix separator changed to arrow

    // Evidence should include page paths
    expect(blocksCandidate?.evidence?.snippet).toContain('/pricing');
  });

  it('should include personaJourneyInsights with failed journey details', () => {
    const result = buildWebsiteLabV5Candidates(mockV5Diagnostic, 'run_test_123');

    const journeyCandidate = result.candidates.find(c => c.key === 'website.personaJourneyInsights');
    expect(journeyCandidate).toBeDefined();
    expect(Array.isArray(journeyCandidate?.value)).toBe(true);

    const journeyValue = journeyCandidate?.value as string[];
    // Should focus on FAILED journeys (actionable) - now uses "FAILED:" prefix
    expect(journeyValue.some(j => j.includes('FAILED:'))).toBe(true);
    expect(journeyValue.some(j => j.includes('/pricing'))).toBe(true);

    // Should include success count with "SUCCEEDED:" prefix
    expect(journeyValue.some(j => j.includes('SUCCEEDED:'))).toBe(true);
  });

  it('should NOT propose productOffer.valueProposition (requires Brand Lab)', () => {
    const result = buildWebsiteLabV5Candidates(mockV5Diagnostic, 'run_test_123');

    // Website Lab doesn't know the company's actual value proposition
    const vpCandidate = result.candidates.find(c => c.key === 'productOffer.valueProposition');
    expect(vpCandidate).toBeUndefined();
  });

  it('should NOT propose identity.companyDescription (requires Brand Lab)', () => {
    const result = buildWebsiteLabV5Candidates(mockV5Diagnostic, 'run_test_123');

    // Website Lab doesn't know the company's actual description
    const descCandidate = result.candidates.find(c => c.key === 'identity.companyDescription');
    expect(descCandidate).toBeUndefined();
  });

  it('should include structuralRecommendations from structuralChanges', () => {
    const result = buildWebsiteLabV5Candidates(mockV5Diagnostic, 'run_test_123');

    const structCandidate = result.candidates.find(c => c.key === 'website.structuralRecommendations');
    expect(structCandidate).toBeDefined();
    expect(Array.isArray(structCandidate?.value)).toBe(true);
  });

  it('evidence should be anchored to specific page paths', () => {
    const result = buildWebsiteLabV5Candidates(mockV5Diagnostic, 'run_test_123');

    // Check that evidence snippets contain page paths
    const candidatesWithPageEvidence = result.candidates.filter(c =>
      c.evidence?.snippet?.includes('Page:') ||
      c.evidence?.snippet?.includes('/pricing') ||
      c.evidence?.snippet?.includes('/')
    );

    // At least 3 candidates should have page-anchored evidence
    expect(candidatesWithPageEvidence.length).toBeGreaterThanOrEqual(3);
  });
});

// ============================================================================
// Test: extractV5DiagnosticFromRaw
// ============================================================================

describe('extractV5DiagnosticFromRaw', () => {
  it('should extract v5Diagnostic from top level', () => {
    const rawJson = {
      v5Diagnostic: mockV5Diagnostic,
    };

    const result = extractV5DiagnosticFromRaw(rawJson);
    expect(result).not.toBeNull();
    expect(result?.score).toBe(58);
  });

  it('should extract v5Diagnostic from rawEvidence.labResultV4', () => {
    const rawJson = {
      rawEvidence: {
        labResultV4: {
          v5Diagnostic: mockV5Diagnostic,
          siteGraph: { pages: [] },
        },
      },
    };

    const result = extractV5DiagnosticFromRaw(rawJson);
    expect(result).not.toBeNull();
    expect(result?.score).toBe(58);
  });

  it('should extract v5Diagnostic from labResult', () => {
    const rawJson = {
      labResult: {
        v5Diagnostic: mockV5Diagnostic,
      },
    };

    const result = extractV5DiagnosticFromRaw(rawJson);
    expect(result).not.toBeNull();
    expect(result?.score).toBe(58);
  });

  it('should return null when no v5Diagnostic exists', () => {
    const rawJson = {
      siteAssessment: {
        executiveSummary: 'Legacy V4 summary',
      },
    };

    const result = extractV5DiagnosticFromRaw(rawJson);
    expect(result).toBeNull();
  });

  it('should return null for null/undefined input', () => {
    expect(extractV5DiagnosticFromRaw(null)).toBeNull();
    expect(extractV5DiagnosticFromRaw(undefined)).toBeNull();
    expect(extractV5DiagnosticFromRaw({})).toBeNull();
  });
});

// ============================================================================
// Test: buildWebsiteLabCandidatesWithV5
// ============================================================================

describe('buildWebsiteLabCandidatesWithV5', () => {
  it('should prefer V5 candidates when v5Diagnostic exists', () => {
    const rawJson = {
      v5Diagnostic: mockV5Diagnostic,
      // Also include V4 data to verify V5 is preferred
      siteAssessment: {
        executiveSummary: 'Legacy V4 summary that should NOT be used',
        score: 99, // Different score to verify V5 is used
      },
    };

    const result = buildWebsiteLabCandidatesWithV5(rawJson, 'run_test_123');

    // Should use V5 extraction path
    expect(result.extractionPath).toContain('v5Diagnostic');

    // Score should be V5 score, not V4 score
    const scoreCandidate = result.candidates.find(c => c.key === 'website.websiteScore');
    expect(scoreCandidate?.value).toBe(58); // V5 score
    expect(scoreCandidate?.value).not.toBe(99); // Not V4 score
  });

  it('should fall back to V4 when no v5Diagnostic exists', () => {
    const rawJson = {
      siteAssessment: {
        executiveSummary: 'Legacy V4 summary',
        score: 75,
      },
      siteGraph: {
        pages: [{ path: '/', type: 'home' }],
      },
    };

    const result = buildWebsiteLabCandidatesWithV5(rawJson, 'run_test_123');

    // Should NOT use V5 extraction path
    expect(result.extractionPath).not.toContain('v5Diagnostic');
  });

  it('should produce candidates from V5 data', () => {
    const rawJson = {
      rawEvidence: {
        labResultV4: {
          v5Diagnostic: mockV5Diagnostic,
        },
      },
    };

    const result = buildWebsiteLabCandidatesWithV5(rawJson, 'run_test_123');

    expect(result.candidates.length).toBeGreaterThanOrEqual(5);
    expect(result.extractionPath).toContain('v5Diagnostic');
  });
});

// ============================================================================
// Integration Test: Full V5 Pipeline
// ============================================================================

describe('V5 Pipeline Integration', () => {
  it('should generate meaningful proposals from V5 diagnostic', () => {
    const rawJson = {
      module: 'website',
      status: 'completed',
      v5Diagnostic: mockV5Diagnostic,
      rawEvidence: {
        labResultV4: {
          siteGraph: { pages: [{ path: '/' }] },
        },
      },
    };

    const result = buildWebsiteLabCandidatesWithV5(rawJson, 'run_integration_test');

    // Should produce multiple candidates
    expect(result.candidates.length).toBeGreaterThanOrEqual(5);

    // Should include key proposal types
    const fieldKeys = result.candidates.map(c => c.key);
    expect(fieldKeys).toContain('website.websiteScore');
    expect(fieldKeys).toContain('website.executiveSummary');
    expect(fieldKeys).toContain('website.quickWins');
    expect(fieldKeys).toContain('website.conversionBlocks');

    // Evidence should be meaningful
    for (const candidate of result.candidates) {
      expect(candidate.evidence).toBeDefined();
      expect(candidate.evidence?.rawPath).toBeDefined();
      expect(candidate.confidence).toBeGreaterThan(0);
      expect(candidate.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('should handle minimal V5 diagnostic', () => {
    const minimalV5: V5DiagnosticOutput = {
      observations: [],
      personaJourneys: [],
      blockingIssues: [],
      quickWins: [],
      structuralChanges: [],
      score: 50,
      scoreJustification: 'Minimal assessment',
    };

    const result = buildWebsiteLabV5Candidates(minimalV5, 'run_minimal');

    // Should still produce at least score and summary candidates
    expect(result.candidates.length).toBeGreaterThanOrEqual(2);
    expect(result.fieldKeys).toContain('website.websiteScore');
  });
});
