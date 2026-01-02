// tests/os/websiteLabV5Cutover.test.ts
// Website Lab V5 Hard Cutover Tests
//
// Verifies:
// 1. V5 generates proposals (>= 5 candidates)
// 2. V4 is ignored when V5 exists
// 3. V5 missing returns error state (no V4 fallback)

import { describe, it, expect } from 'vitest';
import {
  buildWebsiteLabCandidatesWithV5,
  extractV5DiagnosticFromRaw,
} from '@/lib/contextGraph/v4/websiteLabCandidates';
import type { V5DiagnosticOutput } from '@/lib/gap-heavy/modules/websiteLabV5';

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
  scoreJustification: 'The overall score of 58/100 indicates significant room for improvement.',
};

// ============================================================================
// Test 1: V5 generates >= 5 proposals
// ============================================================================

describe('Website Lab V5 Hard Cutover', () => {
  describe('V5 generates proposals', () => {
    it('should produce >= 5 candidates from V5 diagnostic', () => {
      const rawJson = {
        v5Diagnostic: mockV5Diagnostic,
      };

      const result = buildWebsiteLabCandidatesWithV5(rawJson, 'test-run-1');

      expect(result.candidates.length).toBeGreaterThanOrEqual(5);
      expect(result.extractionPath).toContain('v5Diagnostic');
      expect(result.extractionPath).not.toBe('V5_MISSING_ERROR');
    });

    it('should include required field keys', () => {
      const rawJson = {
        v5Diagnostic: mockV5Diagnostic,
      };

      const result = buildWebsiteLabCandidatesWithV5(rawJson, 'test-run-1');
      const fieldKeys = result.candidates.map(c => c.key);

      // Website-specific fields only (NOT productOffer or identity)
      expect(fieldKeys).toContain('website.websiteScore');
      expect(fieldKeys).toContain('website.executiveSummary');
      expect(fieldKeys).toContain('website.quickWins');
      expect(fieldKeys).toContain('website.conversionBlocks');
      expect(fieldKeys).toContain('website.structuralRecommendations');

      // Should NOT include cross-domain fields
      expect(fieldKeys).not.toContain('productOffer.valueProposition');
      expect(fieldKeys).not.toContain('identity.companyDescription');
    });

    it('should log V5 canonical path confirmation', () => {
      const consoleSpy = vi.spyOn(console, 'log');

      const rawJson = {
        v5Diagnostic: mockV5Diagnostic,
      };

      buildWebsiteLabCandidatesWithV5(rawJson, 'test-run-1');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WebsiteLab] V5 canonical path active')
      );

      consoleSpy.mockRestore();
    });
  });

  // ============================================================================
  // Test 2: V4 is ignored when V5 exists
  // ============================================================================

  describe('V4 ignored when V5 exists', () => {
    it('should use V5 score, not V4 score', () => {
      const rawJson = {
        v5Diagnostic: mockV5Diagnostic,
        // V4 data that should be IGNORED
        siteAssessment: {
          score: 99, // Different from V5 score of 58
          executiveSummary: 'This V4 summary should be IGNORED',
        },
      };

      const result = buildWebsiteLabCandidatesWithV5(rawJson, 'test-run-1');

      const scoreCandidate = result.candidates.find(c => c.key === 'website.websiteScore');
      expect(scoreCandidate?.value).toBe(58); // V5 score
      expect(scoreCandidate?.value).not.toBe(99); // Not V4 score
    });

    it('should use V5 from nested path, ignoring top-level V4', () => {
      const rawJson = {
        // V5 in nested path
        rawEvidence: {
          labResultV4: {
            v5Diagnostic: mockV5Diagnostic,
            siteAssessment: {
              score: 77, // V4 score that should be IGNORED
            },
          },
        },
        // V4 at top level that should be IGNORED
        siteAssessment: {
          score: 88,
        },
      };

      const result = buildWebsiteLabCandidatesWithV5(rawJson, 'test-run-1');

      expect(result.extractionPath).toContain('v5Diagnostic');
      const scoreCandidate = result.candidates.find(c => c.key === 'website.websiteScore');
      expect(scoreCandidate?.value).toBe(58); // V5 score
    });

    it('should prefer top-level v5Diagnostic over nested', () => {
      const nestedV5 = { ...mockV5Diagnostic, score: 30 };
      const topLevelV5 = { ...mockV5Diagnostic, score: 58 };

      const rawJson = {
        v5Diagnostic: topLevelV5,
        rawEvidence: {
          labResultV4: {
            v5Diagnostic: nestedV5,
          },
        },
      };

      const extracted = extractV5DiagnosticFromRaw(rawJson);
      expect(extracted?.score).toBe(58); // Top-level V5
    });
  });

  // ============================================================================
  // Test 3: V5 missing returns error state (no V4 fallback)
  // ============================================================================

  describe('V5 missing returns error (no V4 fallback)', () => {
    it('should return error when V5 is missing', () => {
      const rawJson = {
        // Only V4 data - no V5
        siteAssessment: {
          score: 75,
          executiveSummary: 'Legacy V4 summary',
          issues: [{ description: 'Some issue' }],
        },
        siteGraph: {
          pages: [{ path: '/' }],
        },
      };

      const result = buildWebsiteLabCandidatesWithV5(rawJson, 'test-run-1');

      expect(result.extractionPath).toBe('V5_MISSING_ERROR');
      expect(result.candidates.length).toBe(0);
      expect(result.errorState?.isError).toBe(true);
      expect(result.errorState?.errorType).toBe('DIAGNOSTIC_FAILED');
    });

    it('should NOT fall back to V4 when V5 is missing', () => {
      const consoleSpy = vi.spyOn(console, 'error');

      const rawJson = {
        // Only V4 data
        siteAssessment: {
          score: 75,
          executiveSummary: 'Legacy V4 summary',
        },
      };

      const result = buildWebsiteLabCandidatesWithV5(rawJson, 'test-run-1');

      // Should log error about V5 missing
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WebsiteLab] V5_MISSING'),
        expect.anything()
      );

      // Should NOT produce candidates from V4
      expect(result.candidates.length).toBe(0);

      consoleSpy.mockRestore();
    });

    it('should include helpful error message', () => {
      const rawJson = {
        siteAssessment: { score: 75 },
      };

      const result = buildWebsiteLabCandidatesWithV5(rawJson, 'test-run-1');

      expect(result.extractionFailureReason).toContain('V5 diagnostic data is REQUIRED');
      expect(result.extractionFailureReason).toContain('V4 fallback is DISABLED');
    });

    it('should return null for empty/invalid input', () => {
      expect(extractV5DiagnosticFromRaw(null)).toBeNull();
      expect(extractV5DiagnosticFromRaw(undefined)).toBeNull();
      expect(extractV5DiagnosticFromRaw({})).toBeNull();
      expect(extractV5DiagnosticFromRaw({ foo: 'bar' })).toBeNull();
    });
  });

  // ============================================================================
  // Confirmation log line
  // ============================================================================

  describe('Cutover confirmation logging', () => {
    it('should log V5 canonical path active for successful extraction', () => {
      const consoleSpy = vi.spyOn(console, 'log');

      const rawJson = { v5Diagnostic: mockV5Diagnostic };
      buildWebsiteLabCandidatesWithV5(rawJson, 'test-run-1');

      const logCalls = consoleSpy.mock.calls.map(call => call[0]);
      const hasCanonicalLog = logCalls.some(msg =>
        typeof msg === 'string' && msg.includes('[WebsiteLab] V5 canonical path active')
      );

      expect(hasCanonicalLog).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should log V5_MISSING error for failed extraction', () => {
      const consoleSpy = vi.spyOn(console, 'error');

      const rawJson = { siteAssessment: { score: 75 } };
      buildWebsiteLabCandidatesWithV5(rawJson, 'test-run-1');

      const errorCalls = consoleSpy.mock.calls.map(call => call[0]);
      const hasMissingLog = errorCalls.some(msg =>
        typeof msg === 'string' && msg.includes('[WebsiteLab] V5_MISSING')
      );

      expect(hasMissingLog).toBe(true);

      consoleSpy.mockRestore();
    });
  });
});

// Import vi for spying
import { vi } from 'vitest';
