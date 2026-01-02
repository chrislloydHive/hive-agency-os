// tests/os/websiteLabNormalizer.test.ts
// Tests for Website Lab normalization and canonical output contract
//
// These tests verify:
// 1. normalizeWebsiteLabRun lifts v5Diagnostic to top-level
// 2. Nested v5Diagnostic is removed from rawEvidence
// 3. score/summary/issues/recommendations align to V5
// 4. postRunHooks creates CompanyArtifactIndex records

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  normalizeWebsiteLabRun,
  hasV5Diagnostic,
  validateCanonicalOutput,
  type CanonicalWebsiteLabOutput,
} from '@/lib/os/diagnostics/websiteLabNormalizer';
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
      trustProofElements: ['Client logos'],
      missingUnclearElements: ['Value prop unclear'],
    },
  ],
  personaJourneys: [
    {
      persona: 'first_time',
      startingPage: '/',
      intendedGoal: 'Understand the product',
      actualPath: ['/', '/about'],
      failurePoint: null,
      confidenceScore: 75,
      succeeded: true,
    },
  ],
  blockingIssues: [
    {
      id: 1,
      severity: 'high',
      affectedPersonas: ['first_time', 'ready_to_buy'],
      page: '/pricing',
      whyItBlocks: 'No clear pricing visible',
      concreteFix: { what: 'Add pricing table', where: 'Above fold on /pricing' },
    },
    {
      id: 2,
      severity: 'medium',
      affectedPersonas: ['comparison_shopper'],
      page: '/',
      whyItBlocks: 'No feature comparison',
      concreteFix: { what: 'Add comparison table', where: 'Homepage' },
    },
  ],
  quickWins: [
    {
      addressesIssueId: 1,
      title: 'Add pricing table',
      action: 'Create a clear pricing table with plans',
      page: '/pricing',
      expectedImpact: 'Increase conversion by 20%',
    },
  ],
  structuralChanges: [
    {
      addressesIssueIds: [1, 2],
      title: 'Restructure navigation',
      description: 'Add pricing to main nav',
      pagesAffected: ['/', '/pricing'],
      rationale: 'Users expect easy access to pricing',
    },
  ],
  score: 77,
  scoreJustification: 'Good overall UX but pricing transparency needs work.',
};

// ============================================================================
// Test: normalizeWebsiteLabRun - V5 Lifting
// ============================================================================

describe('normalizeWebsiteLabRun', () => {
  describe('V5 diagnostic lifting', () => {
    it('should lift v5Diagnostic from rawEvidence.labResultV4 to top level', () => {
      const rawJson = {
        module: 'website',
        status: 'completed',
        score: 50, // Legacy score
        rawEvidence: {
          labResultV4: {
            v5Diagnostic: mockV5Diagnostic,
            siteGraph: { pages: [{ path: '/', type: 'home' }] },
          },
        },
      };

      const result = normalizeWebsiteLabRun(rawJson);

      // V5 should be at top level
      expect(result.v5Diagnostic).not.toBeNull();
      expect(result.v5Diagnostic?.score).toBe(77);
      expect(result.v5Diagnostic?.blockingIssues).toHaveLength(2);

      // Score should be updated to V5 score
      expect(result.score).toBe(77);

      // v5Diagnostic should be REMOVED from rawEvidence
      expect(result.rawEvidence.labResultV4?.v5Diagnostic).toBeUndefined();
    });

    it('should lift v5Diagnostic from rawEvidence.labResultV4.siteAssessment to top level', () => {
      const rawJson = {
        module: 'website',
        rawEvidence: {
          labResultV4: {
            siteAssessment: {
              v5Diagnostic: mockV5Diagnostic,
              overallScore: 50,
            },
            siteGraph: { pages: [{ path: '/' }] },
          },
        },
      };

      const result = normalizeWebsiteLabRun(rawJson);

      expect(result.v5Diagnostic).not.toBeNull();
      expect(result.v5Diagnostic?.score).toBe(77);

      // Nested v5Diagnostic should be removed
      const lr = result.rawEvidence.labResultV4 as Record<string, unknown>;
      const sa = lr?.siteAssessment as Record<string, unknown>;
      expect(sa?.v5Diagnostic).toBeUndefined();
    });

    it('should lift v5Diagnostic from labResult.siteAssessment to top level', () => {
      const rawJson = {
        module: 'website',
        labResult: {
          siteAssessment: {
            v5Diagnostic: mockV5Diagnostic,
          },
        },
      };

      const result = normalizeWebsiteLabRun(rawJson);

      expect(result.v5Diagnostic).not.toBeNull();
      expect(result.v5Diagnostic?.score).toBe(77);
    });

    it('should preserve v5Diagnostic already at top level', () => {
      const rawJson = {
        module: 'website',
        status: 'completed',
        v5Diagnostic: mockV5Diagnostic,
        rawEvidence: {},
      };

      const result = normalizeWebsiteLabRun(rawJson);

      expect(result.v5Diagnostic).not.toBeNull();
      expect(result.v5Diagnostic?.score).toBe(77);
    });

    it('should handle missing v5Diagnostic gracefully', () => {
      const rawJson = {
        module: 'website',
        status: 'completed',
        score: 65,
        summary: 'Legacy assessment',
        issues: ['Issue 1', 'Issue 2'],
        recommendations: ['Rec 1'],
        rawEvidence: {
          labResultV4: {
            siteGraph: { pages: [] },
          },
        },
      };

      const result = normalizeWebsiteLabRun(rawJson);

      // V5 should be null
      expect(result.v5Diagnostic).toBeNull();

      // Legacy values should be preserved
      expect(result.score).toBe(65);
      expect(result.summary).toBe('Legacy assessment');
      expect(result.issues).toEqual(['Issue 1', 'Issue 2']);
    });
  });

  describe('score/summary/issues/recommendations alignment', () => {
    it('should derive issues from V5 blockingIssues.whyItBlocks', () => {
      const rawJson = {
        module: 'website',
        v5Diagnostic: mockV5Diagnostic,
      };

      const result = normalizeWebsiteLabRun(rawJson);

      expect(result.issues).toContain('No clear pricing visible');
      expect(result.issues).toContain('No feature comparison');
    });

    it('should derive recommendations from V5 quickWins.action', () => {
      const rawJson = {
        module: 'website',
        v5Diagnostic: mockV5Diagnostic,
      };

      const result = normalizeWebsiteLabRun(rawJson);

      expect(result.recommendations).toContain('Create a clear pricing table with plans');
    });

    it('should build summary from V5 score and justification', () => {
      const rawJson = {
        module: 'website',
        v5Diagnostic: mockV5Diagnostic,
      };

      const result = normalizeWebsiteLabRun(rawJson);

      expect(result.summary).toContain('V5 Diagnostic: 77/100');
      expect(result.summary).toContain('Good overall UX');
    });
  });

  describe('rawEvidence cleanup', () => {
    it('should remove v5Diagnostic from all nested paths in rawEvidence', () => {
      const rawJson = {
        module: 'website',
        rawEvidence: {
          labResultV4: {
            v5Diagnostic: mockV5Diagnostic,
            siteAssessment: {
              v5Diagnostic: mockV5Diagnostic,
              overallScore: 50,
            },
          },
        },
      };

      const result = normalizeWebsiteLabRun(rawJson);

      // Top level should have V5
      expect(result.v5Diagnostic).not.toBeNull();

      // All nested paths should be cleaned
      const lr = result.rawEvidence.labResultV4 as Record<string, unknown>;
      expect(lr?.v5Diagnostic).toBeUndefined();
      const sa = lr?.siteAssessment as Record<string, unknown>;
      expect(sa?.v5Diagnostic).toBeUndefined();
    });
  });
});

// ============================================================================
// Test: hasV5Diagnostic
// ============================================================================

describe('hasV5Diagnostic', () => {
  it('should return true when v5Diagnostic exists at top level', () => {
    const rawJson = { v5Diagnostic: mockV5Diagnostic };
    expect(hasV5Diagnostic(rawJson)).toBe(true);
  });

  it('should return true when v5Diagnostic exists in rawEvidence.labResultV4', () => {
    const rawJson = {
      rawEvidence: {
        labResultV4: {
          v5Diagnostic: mockV5Diagnostic,
        },
      },
    };
    expect(hasV5Diagnostic(rawJson)).toBe(true);
  });

  it('should return false when no v5Diagnostic exists', () => {
    const rawJson = {
      module: 'website',
      score: 50,
    };
    expect(hasV5Diagnostic(rawJson)).toBe(false);
  });

  it('should return false for empty/null input', () => {
    expect(hasV5Diagnostic(null)).toBe(false);
    expect(hasV5Diagnostic(undefined)).toBe(false);
    expect(hasV5Diagnostic({})).toBe(false);
  });
});

// ============================================================================
// Test: validateCanonicalOutput
// ============================================================================

describe('validateCanonicalOutput', () => {
  it('should pass for valid canonical output with V5', () => {
    const output: CanonicalWebsiteLabOutput = {
      module: 'website',
      status: 'completed',
      score: 77,
      summary: 'V5 Diagnostic: 77/100',
      issues: ['Issue 1'],
      recommendations: ['Rec 1'],
      v5Diagnostic: mockV5Diagnostic,
      rawEvidence: {},
    };

    expect(() => validateCanonicalOutput(output)).not.toThrow();
  });

  it('should pass for valid canonical output without V5', () => {
    const output: CanonicalWebsiteLabOutput = {
      module: 'website',
      status: 'completed',
      score: 50,
      summary: 'Legacy assessment',
      issues: [],
      recommendations: [],
      v5Diagnostic: null,
      rawEvidence: {},
    };

    expect(() => validateCanonicalOutput(output)).not.toThrow();
  });

  it('should throw when module is not "website"', () => {
    const output = {
      module: 'brand',
      status: 'completed',
      score: 50,
      summary: '',
      issues: [],
      recommendations: [],
      v5Diagnostic: null,
      rawEvidence: {},
    } as unknown as CanonicalWebsiteLabOutput;

    expect(() => validateCanonicalOutput(output)).toThrow('Invalid module');
  });

  it('should throw when rawEvidence contains v5Diagnostic', () => {
    const output = {
      module: 'website',
      status: 'completed',
      score: 50,
      summary: '',
      issues: [],
      recommendations: [],
      v5Diagnostic: mockV5Diagnostic,
      rawEvidence: {
        v5Diagnostic: mockV5Diagnostic, // This should not be here
      },
    } as CanonicalWebsiteLabOutput;

    expect(() => validateCanonicalOutput(output)).toThrow('rawEvidence contains v5Diagnostic');
  });
});

// ============================================================================
// Test: Guard Log for Missing V5
// ============================================================================

describe('Guard log for missing V5', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('should log error when V5 is missing but pages were analyzed', () => {
    const rawJson = {
      module: 'website',
      status: 'completed',
      siteGraph: {
        pages: [{ path: '/' }, { path: '/about' }],
      },
      rawEvidence: {
        labResultV4: {
          siteGraph: {
            pages: [{ path: '/' }],
          },
        },
      },
    };

    normalizeWebsiteLabRun(rawJson, { runId: 'run_123', companyId: 'company_456' });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('V5 diagnostic missing'),
      expect.objectContaining({
        runId: 'run_123',
        companyId: 'company_456',
      })
    );
  });

  it('should not log error when V5 exists', () => {
    // Create a fresh spy for this test
    consoleErrorSpy.mockClear();

    const rawJson = {
      module: 'website',
      v5Diagnostic: mockV5Diagnostic,
      siteGraph: {
        pages: [{ path: '/' }],
      },
    };

    normalizeWebsiteLabRun(rawJson, { runId: 'run_123', companyId: 'company_456' });

    // Should not have been called with the V5 missing error
    const calls = consoleErrorSpy.mock.calls as unknown[][];
    const hasV5MissingError = calls.some(
      (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('V5 diagnostic missing')
    );
    expect(hasV5MissingError).toBe(false);
  });

  it('should not log error when no pages were analyzed', () => {
    consoleErrorSpy.mockClear();

    const rawJson = {
      module: 'website',
      status: 'failed',
    };

    normalizeWebsiteLabRun(rawJson, { runId: 'run_123', companyId: 'company_456' });

    // Should not have been called with the V5 missing error
    const calls = consoleErrorSpy.mock.calls as unknown[][];
    const hasV5MissingError = calls.some(
      (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('V5 diagnostic missing')
    );
    expect(hasV5MissingError).toBe(false);
  });
});
