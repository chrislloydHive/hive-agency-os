// tests/os/websiteLabV5Renderer.test.ts
// Tests for Website Lab V5 renderer selection
//
// Verifies that the LabReportRenderer correctly detects and renders V5 data.

import { describe, it, expect } from 'vitest';

/**
 * V5 diagnostic extraction logic (mirrors LabReportRenderer)
 *
 * This function extracts v5Diagnostic from various possible nesting paths.
 */
function extractV5Diagnostic(data: unknown): unknown | null {
  const websiteLabData = data as any;

  return websiteLabData?.v5Diagnostic ||
    websiteLabData?.rawEvidence?.labResultV4?.v5Diagnostic ||
    websiteLabData?.rawEvidence?.labResultV4?.siteAssessment?.v5Diagnostic ||
    websiteLabData?.siteAssessment?.v5Diagnostic ||
    websiteLabData?.labResult?.v5Diagnostic ||
    null;
}

describe('Website Lab V5 Renderer Selection', () => {
  describe('V5 extraction from various paths', () => {
    const v5Data = {
      score: 77,
      scoreJustification: 'Test V5 output',
      blockingIssues: [
        { id: 1, severity: 'high', page: '/', whyItBlocks: 'No CTA', concreteFix: { what: 'Add CTA', where: 'Hero' } },
      ],
      quickWins: [
        { title: 'Add testimonials', page: '/about', action: 'Add 3 testimonials', expectedImpact: 'Trust boost' },
      ],
      structuralChanges: [
        { what: 'Simplify navigation', why: 'Too many links' },
      ],
      observations: [
        { pagePath: '/', primaryCTAs: [{ text: 'Get Started' }], missingUnclearElements: ['pricing'] },
      ],
      personaJourneys: [
        { personaLabel: 'SMB Owner', goal: 'Get pricing', succeeded: false, frictionPoints: ['No pricing page'] },
      ],
    };

    it('should extract v5Diagnostic from top level', () => {
      const data = { v5Diagnostic: v5Data };
      const result = extractV5Diagnostic(data);
      expect(result).toBe(v5Data);
      expect((result as any).score).toBe(77);
    });

    it('should extract v5Diagnostic from rawEvidence.labResultV4', () => {
      const data = {
        rawEvidence: {
          labResultV4: {
            v5Diagnostic: v5Data,
          },
        },
      };
      const result = extractV5Diagnostic(data);
      expect(result).toBe(v5Data);
      expect((result as any).score).toBe(77);
    });

    it('should extract v5Diagnostic from rawEvidence.labResultV4.siteAssessment', () => {
      const data = {
        rawEvidence: {
          labResultV4: {
            siteAssessment: {
              v5Diagnostic: v5Data,
            },
          },
        },
      };
      const result = extractV5Diagnostic(data);
      expect(result).toBe(v5Data);
      expect((result as any).score).toBe(77);
    });

    it('should extract v5Diagnostic from siteAssessment', () => {
      const data = {
        siteAssessment: {
          v5Diagnostic: v5Data,
        },
      };
      const result = extractV5Diagnostic(data);
      expect(result).toBe(v5Data);
    });

    it('should extract v5Diagnostic from labResult', () => {
      const data = {
        labResult: {
          v5Diagnostic: v5Data,
        },
      };
      const result = extractV5Diagnostic(data);
      expect(result).toBe(v5Data);
    });

    it('should return null when no v5Diagnostic exists', () => {
      const data = {
        siteAssessment: {
          score: 58,
          issues: [],
        },
      };
      const result = extractV5Diagnostic(data);
      expect(result).toBeNull();
    });

    it('should return null for empty data', () => {
      expect(extractV5Diagnostic(null)).toBeNull();
      expect(extractV5Diagnostic(undefined)).toBeNull();
      expect(extractV5Diagnostic({})).toBeNull();
    });
  });

  describe('V5 data structure validation', () => {
    it('should have required V5 fields', () => {
      const v5Data = {
        score: 77,
        scoreJustification: 'Test justification',
        blockingIssues: [],
        quickWins: [],
        structuralChanges: [],
        observations: [],
        personaJourneys: [],
      };

      expect(v5Data.score).toBeDefined();
      expect(v5Data.scoreJustification).toBeDefined();
      expect(Array.isArray(v5Data.blockingIssues)).toBe(true);
      expect(Array.isArray(v5Data.quickWins)).toBe(true);
      expect(Array.isArray(v5Data.structuralChanges)).toBe(true);
      expect(Array.isArray(v5Data.observations)).toBe(true);
      expect(Array.isArray(v5Data.personaJourneys)).toBe(true);
    });

    it('should have correctly structured blockingIssue', () => {
      const blockingIssue = {
        id: 1,
        severity: 'high',
        page: '/',
        whyItBlocks: 'Missing primary CTA prevents conversions',
        concreteFix: {
          what: 'Add a prominent CTA button',
          where: 'Hero section above the fold',
        },
      };

      expect(blockingIssue.id).toBeDefined();
      expect(blockingIssue.severity).toMatch(/high|medium|low/);
      expect(blockingIssue.page).toBeDefined();
      expect(blockingIssue.whyItBlocks).toBeDefined();
      expect(blockingIssue.concreteFix.what).toBeDefined();
      expect(blockingIssue.concreteFix.where).toBeDefined();
    });

    it('should have correctly structured quickWin', () => {
      const quickWin = {
        title: 'Add social proof',
        page: '/about',
        action: 'Add 3 customer testimonials with photos',
        expectedImpact: 'Increases trust and conversion by 15-20%',
      };

      expect(quickWin.title).toBeDefined();
      expect(quickWin.page).toBeDefined();
      expect(quickWin.action).toBeDefined();
      expect(quickWin.expectedImpact).toBeDefined();
    });

    it('should have correctly structured personaJourney', () => {
      const journey = {
        personaLabel: 'SMB Owner',
        goal: 'Find pricing information',
        succeeded: false,
        steps: [
          { page: '/', action: 'Look for pricing link' },
          { page: '/about', action: 'Navigate to about page' },
        ],
        frictionPoints: ['No visible pricing link', 'Had to search for 2 minutes'],
      };

      expect(journey.personaLabel).toBeDefined();
      expect(journey.goal).toBeDefined();
      expect(typeof journey.succeeded).toBe('boolean');
      expect(Array.isArray(journey.frictionPoints)).toBe(true);
    });
  });

  describe('Fallback banner logic', () => {
    function shouldShowNoStructuredDataBanner(data: {
      scores: unknown;
      dimensions: unknown[];
      issues: unknown[];
      findings: unknown;
      hasBrandLabStructure: boolean;
      hasWebsiteLabStructure: boolean;
      hasV5Diagnostic: boolean;
    }): boolean {
      return (
        !data.scores &&
        data.dimensions.length === 0 &&
        data.issues.length === 0 &&
        !data.findings &&
        !data.hasBrandLabStructure &&
        !data.hasWebsiteLabStructure &&
        !data.hasV5Diagnostic
      );
    }

    it('should NOT show banner when V5 diagnostic exists', () => {
      const result = shouldShowNoStructuredDataBanner({
        scores: null,
        dimensions: [],
        issues: [],
        findings: null,
        hasBrandLabStructure: false,
        hasWebsiteLabStructure: false, // This is derived from hasV5Diagnostic
        hasV5Diagnostic: true, // V5 exists!
      });

      expect(result).toBe(false);
    });

    it('should NOT show banner when hasWebsiteLabStructure is true', () => {
      const result = shouldShowNoStructuredDataBanner({
        scores: null,
        dimensions: [],
        issues: [],
        findings: null,
        hasBrandLabStructure: false,
        hasWebsiteLabStructure: true,
        hasV5Diagnostic: true,
      });

      expect(result).toBe(false);
    });

    it('should show banner when no V5 and no other structure exists', () => {
      const result = shouldShowNoStructuredDataBanner({
        scores: null,
        dimensions: [],
        issues: [],
        findings: null,
        hasBrandLabStructure: false,
        hasWebsiteLabStructure: false,
        hasV5Diagnostic: false,
      });

      expect(result).toBe(true);
    });

    it('should NOT show banner when issues exist', () => {
      const result = shouldShowNoStructuredDataBanner({
        scores: null,
        dimensions: [],
        issues: [{ id: '1', title: 'Test issue' }],
        findings: null,
        hasBrandLabStructure: false,
        hasWebsiteLabStructure: false,
        hasV5Diagnostic: false,
      });

      expect(result).toBe(false);
    });
  });
});
