// tests/context/labQualityScore.test.ts
// Lab Quality Score (LQS) System Tests
//
// Tests for:
// - Metric calculations (edge cases, empty findings)
// - Generic phrase detection
// - Persona diagnostic scoring
// - Composite weighting math
// - Regression detection
// - Type contract stability

import { describe, it, expect } from 'vitest';
import {
  computeEvidenceAnchoring,
  computeSpecificity,
  computeDeduplicatedSignalDensity,
  computePersonaDiagnosticQuality,
  computeRecommendationTraceability,
  computeLabQualityScore,
  containsGenericPhrase,
  generateSimpleHash,
  extractQualityInputFromLabRaw,
} from '@/lib/os/diagnostics/qualityScore';
import {
  getQualityBand,
  METRIC_THRESHOLDS,
  DEFAULT_METRIC_WEIGHTS,
  NON_WEBSITE_LAB_WEIGHTS,
  GENERIC_PHRASES,
} from '@/lib/types/labQualityScore';
import type {
  LabQualityInput,
  QualityFinding,
  QualityRecommendation,
  PersonaJourney,
  MetricResult,
  LabQualityScore,
} from '@/lib/types/labQualityScore';

// ============================================================================
// Quality Band Tests
// ============================================================================

describe('Quality Band Classification', () => {
  it('returns Excellent for scores >= 85', () => {
    expect(getQualityBand(85)).toBe('Excellent');
    expect(getQualityBand(90)).toBe('Excellent');
    expect(getQualityBand(100)).toBe('Excellent');
  });

  it('returns Good for scores 70-84', () => {
    expect(getQualityBand(70)).toBe('Good');
    expect(getQualityBand(75)).toBe('Good');
    expect(getQualityBand(84)).toBe('Good');
  });

  it('returns Weak for scores 50-69', () => {
    expect(getQualityBand(50)).toBe('Weak');
    expect(getQualityBand(60)).toBe('Weak');
    expect(getQualityBand(69)).toBe('Weak');
  });

  it('returns Poor for scores < 50', () => {
    expect(getQualityBand(0)).toBe('Poor');
    expect(getQualityBand(25)).toBe('Poor');
    expect(getQualityBand(49)).toBe('Poor');
  });
});

// ============================================================================
// Generic Phrase Detection Tests
// ============================================================================

describe('Generic Phrase Detection', () => {
  it('detects generic phrases in text', () => {
    expect(containsGenericPhrase('You should improve UX on the homepage')).toBe(true);
    expect(containsGenericPhrase('Need to strengthen funnel conversion')).toBe(true);
    expect(containsGenericPhrase('Should clarify value proposition')).toBe(true);
    expect(containsGenericPhrase('improve conversion rate')).toBe(true);
    expect(containsGenericPhrase('Better messaging needed')).toBe(true);
  });

  it('is case insensitive', () => {
    expect(containsGenericPhrase('IMPROVE UX')).toBe(true);
    expect(containsGenericPhrase('Strengthen Funnel')).toBe(true);
  });

  it('returns false for specific findings', () => {
    expect(containsGenericPhrase('The CTA button on /pricing is below the fold')).toBe(false);
    expect(containsGenericPhrase('Competitor X uses blue color scheme')).toBe(false);
    expect(containsGenericPhrase('Page load time is 4.2 seconds on homepage')).toBe(false);
  });

  it('handles empty strings', () => {
    expect(containsGenericPhrase('')).toBe(false);
  });
});

// ============================================================================
// Hash Generation Tests
// ============================================================================

describe('Canonical Hash Generation', () => {
  it('generates consistent hashes for same input', () => {
    const hash1 = generateSimpleHash('Test finding about the homepage');
    const hash2 = generateSimpleHash('Test finding about the homepage');
    expect(hash1).toBe(hash2);
  });

  it('normalizes whitespace', () => {
    const hash1 = generateSimpleHash('Test   finding   about');
    const hash2 = generateSimpleHash('Test finding about');
    expect(hash1).toBe(hash2);
  });

  it('is case insensitive', () => {
    const hash1 = generateSimpleHash('Test Finding');
    const hash2 = generateSimpleHash('test finding');
    expect(hash1).toBe(hash2);
  });

  it('generates different hashes for different input', () => {
    const hash1 = generateSimpleHash('Finding A');
    const hash2 = generateSimpleHash('Finding B');
    expect(hash1).not.toBe(hash2);
  });
});

// ============================================================================
// Evidence Anchoring Metric Tests
// ============================================================================

describe('Evidence Anchoring Metric', () => {
  it('returns 100 for empty findings array', () => {
    const result = computeEvidenceAnchoring([]);
    expect(result.score).toBe(100);
    expect(result.passed).toBe(true);
    expect(result.details.context).toBe('No findings to evaluate');
  });

  it('calculates correct score with all evidenced findings', () => {
    const findings: QualityFinding[] = [
      { id: '1', text: 'Finding 1', pageUrl: 'https://example.com', canonicalHash: 'h1' },
      { id: '2', text: 'Finding 2', selector: '.btn-primary', canonicalHash: 'h2' },
      { id: '3', text: 'Finding 3', quotedText: 'Some quote', canonicalHash: 'h3' },
    ];
    const result = computeEvidenceAnchoring(findings);
    expect(result.score).toBe(100);
    expect(result.passed).toBe(true);
  });

  it('calculates correct score with mixed findings', () => {
    const findings: QualityFinding[] = [
      { id: '1', text: 'Finding 1', pageUrl: 'https://example.com', canonicalHash: 'h1' },
      { id: '2', text: 'Finding 2', canonicalHash: 'h2' }, // No evidence
      { id: '3', text: 'Finding 3', canonicalHash: 'h3' }, // No evidence
      { id: '4', text: 'Finding 4', selector: '.cta', canonicalHash: 'h4' },
    ];
    const result = computeEvidenceAnchoring(findings);
    expect(result.score).toBe(50); // 2/4 = 50%
    expect(result.passed).toBe(false); // Below 80% threshold
    expect(result.details.numerator).toBe(2);
    expect(result.details.denominator).toBe(4);
  });

  it('passes when above threshold', () => {
    const findings: QualityFinding[] = Array(10).fill(null).map((_, i) => ({
      id: String(i),
      text: `Finding ${i}`,
      pageUrl: i < 8 ? 'https://example.com' : undefined, // 8/10 = 80%
      canonicalHash: `h${i}`,
    }));
    const result = computeEvidenceAnchoring(findings);
    expect(result.score).toBe(80);
    expect(result.passed).toBe(true);
  });

  it('captures examples of unanchored findings', () => {
    const findings: QualityFinding[] = [
      { id: '1', text: 'Unanchored finding one that is quite long', canonicalHash: 'h1' },
      { id: '2', text: 'Unanchored finding two', canonicalHash: 'h2' },
    ];
    const result = computeEvidenceAnchoring(findings);
    expect(result.details.issues).toBeDefined();
    expect(result.details.issues!.length).toBe(2);
  });
});

// ============================================================================
// Specificity Metric Tests
// ============================================================================

describe('Specificity Metric', () => {
  it('returns 100 for empty findings array', () => {
    const result = computeSpecificity([]);
    expect(result.score).toBe(100);
    expect(result.passed).toBe(true);
  });

  it('penalizes generic phrases', () => {
    const findings: QualityFinding[] = [
      { id: '1', text: 'You should improve UX on the site', pageUrl: 'https://example.com', canonicalHash: 'h1' },
      { id: '2', text: 'Homepage CTA is below the fold at /home', pageUrl: 'https://example.com', canonicalHash: 'h2' },
    ];
    const result = computeSpecificity(findings);
    expect(result.score).toBe(50); // 1/2 specific
    expect(result.passed).toBe(false);
  });

  it('requires both specific reference and no generic phrase', () => {
    const findings: QualityFinding[] = [
      { id: '1', text: 'Specific finding about /pricing page', pageUrl: 'https://example.com/pricing', canonicalHash: 'h1' },
    ];
    const result = computeSpecificity(findings);
    expect(result.score).toBe(100);
    expect(result.passed).toBe(true);
  });

  it('fails if no specific reference', () => {
    const findings: QualityFinding[] = [
      { id: '1', text: 'Some finding without page reference', canonicalHash: 'h1' },
    ];
    const result = computeSpecificity(findings);
    expect(result.score).toBe(0);
    expect(result.passed).toBe(false);
  });
});

// ============================================================================
// Deduplication Metric Tests
// ============================================================================

describe('Deduplicated Signal Density Metric', () => {
  it('returns 100 for empty findings array', () => {
    const result = computeDeduplicatedSignalDensity([]);
    expect(result.score).toBe(100);
    expect(result.passed).toBe(true);
  });

  it('returns 100 for all unique findings', () => {
    const findings: QualityFinding[] = [
      { id: '1', text: 'Finding 1', canonicalHash: 'hash1' },
      { id: '2', text: 'Finding 2', canonicalHash: 'hash2' },
      { id: '3', text: 'Finding 3', canonicalHash: 'hash3' },
    ];
    const result = computeDeduplicatedSignalDensity(findings);
    expect(result.score).toBe(100);
    expect(result.passed).toBe(true);
  });

  it('calculates correct ratio with duplicates', () => {
    const findings: QualityFinding[] = [
      { id: '1', text: 'Finding A', canonicalHash: 'hash1' },
      { id: '2', text: 'Finding A copy', canonicalHash: 'hash1' }, // Duplicate
      { id: '3', text: 'Finding B', canonicalHash: 'hash2' },
      { id: '4', text: 'Finding B copy', canonicalHash: 'hash2' }, // Duplicate
    ];
    const result = computeDeduplicatedSignalDensity(findings);
    expect(result.score).toBe(50); // 2 unique / 4 total = 50%
    expect(result.passed).toBe(false); // Below 70% threshold
    expect(result.details.numerator).toBe(2);
    expect(result.details.denominator).toBe(4);
  });

  it('passes at 70% threshold', () => {
    const findings: QualityFinding[] = [
      { id: '1', text: 'A', canonicalHash: 'h1' },
      { id: '2', text: 'B', canonicalHash: 'h2' },
      { id: '3', text: 'C', canonicalHash: 'h3' },
      { id: '4', text: 'D', canonicalHash: 'h4' },
      { id: '5', text: 'E', canonicalHash: 'h5' },
      { id: '6', text: 'F', canonicalHash: 'h6' },
      { id: '7', text: 'G', canonicalHash: 'h7' },
      { id: '8', text: 'A dup', canonicalHash: 'h1' }, // Duplicate
      { id: '9', text: 'B dup', canonicalHash: 'h2' }, // Duplicate
      { id: '10', text: 'C dup', canonicalHash: 'h3' }, // Duplicate
    ];
    const result = computeDeduplicatedSignalDensity(findings);
    expect(result.score).toBe(70); // 7 unique / 10 total = 70%
    expect(result.passed).toBe(true);
  });
});

// ============================================================================
// Persona Diagnostic Quality Metric Tests
// ============================================================================

describe('Persona Diagnostic Quality Metric', () => {
  it('returns undefined for non-Website labs', () => {
    const result = computePersonaDiagnosticQuality(undefined);
    expect(result).toBeUndefined();
  });

  it('returns undefined for empty journeys', () => {
    const result = computePersonaDiagnosticQuality([]);
    expect(result).toBeUndefined();
  });

  it('calculates correct score with quality journeys', () => {
    const journeys: PersonaJourney[] = [
      {
        personaName: 'First-time buyer',
        goal: 'Find product pricing',
        failurePointPage: '/pricing',
        failureReason: 'Pricing not visible above fold',
        hasClearGoal: true,
        hasExplicitFailurePoint: true,
      },
      {
        personaName: 'Returning customer',
        goal: 'Check order status',
        failurePointPage: '/account',
        failureReason: 'Login required without clear prompt',
        hasClearGoal: true,
        hasExplicitFailurePoint: true,
      },
    ];
    const result = computePersonaDiagnosticQuality(journeys);
    expect(result).toBeDefined();
    expect(result!.score).toBe(100);
    expect(result!.passed).toBe(true);
  });

  it('penalizes journeys without clear goals', () => {
    const journeys: PersonaJourney[] = [
      {
        personaName: 'Persona 1',
        hasClearGoal: false,
        hasExplicitFailurePoint: true,
        failurePointPage: '/page',
        failureReason: 'Some reason',
      },
    ];
    const result = computePersonaDiagnosticQuality(journeys);
    expect(result!.score).toBe(0);
    expect(result!.passed).toBe(false);
  });

  it('penalizes journeys without failure points', () => {
    const journeys: PersonaJourney[] = [
      {
        personaName: 'Persona 1',
        goal: 'Find something',
        hasClearGoal: true,
        hasExplicitFailurePoint: false,
      },
    ];
    const result = computePersonaDiagnosticQuality(journeys);
    expect(result!.score).toBe(0);
    expect(result!.passed).toBe(false);
  });

  it('passes at 75% threshold', () => {
    const journeys: PersonaJourney[] = [
      { personaName: 'P1', goal: 'G1', failurePointPage: '/p1', failureReason: 'R1', hasClearGoal: true, hasExplicitFailurePoint: true },
      { personaName: 'P2', goal: 'G2', failurePointPage: '/p2', failureReason: 'R2', hasClearGoal: true, hasExplicitFailurePoint: true },
      { personaName: 'P3', goal: 'G3', failurePointPage: '/p3', failureReason: 'R3', hasClearGoal: true, hasExplicitFailurePoint: true },
      { personaName: 'P4', hasClearGoal: false, hasExplicitFailurePoint: false }, // 1 weak
    ];
    const result = computePersonaDiagnosticQuality(journeys);
    expect(result!.score).toBe(75); // 3/4 = 75%
    expect(result!.passed).toBe(true);
  });
});

// ============================================================================
// Recommendation Traceability Metric Tests
// ============================================================================

describe('Recommendation Traceability Metric', () => {
  it('returns 100 for empty recommendations', () => {
    const result = computeRecommendationTraceability([], []);
    expect(result.score).toBe(100);
    expect(result.passed).toBe(true);
  });

  it('calculates correct traceability with linked recommendations', () => {
    const findings: QualityFinding[] = [
      { id: 'f1', text: 'Finding 1', canonicalHash: 'h1' },
      { id: 'f2', text: 'Finding 2', canonicalHash: 'h2' },
    ];
    const recommendations: QualityRecommendation[] = [
      { id: 'r1', text: 'Rec 1', linkedFindingId: 'f1' },
      { id: 'r2', text: 'Rec 2', linkedFindingId: 'f2' },
    ];
    const result = computeRecommendationTraceability(findings, recommendations);
    expect(result.score).toBe(100);
    expect(result.passed).toBe(true);
  });

  it('penalizes orphan recommendations', () => {
    const findings: QualityFinding[] = [
      { id: 'f1', text: 'Finding 1', canonicalHash: 'h1' },
    ];
    const recommendations: QualityRecommendation[] = [
      { id: 'r1', text: 'Rec 1', linkedFindingId: 'f1' },
      { id: 'r2', text: 'Rec 2' }, // No link
      { id: 'r3', text: 'Rec 3', linkedFindingId: 'invalid' }, // Invalid link
    ];
    const result = computeRecommendationTraceability(findings, recommendations);
    expect(result.score).toBe(33); // 1/3 = 33%
    expect(result.passed).toBe(false);
    expect(result.details.numerator).toBe(1);
    expect(result.details.denominator).toBe(3);
  });
});

// ============================================================================
// Composite Score Calculation Tests
// ============================================================================

describe('Composite Score Calculation', () => {
  it('returns null when no findings or recommendations (prevents bogus 100 score)', () => {
    const input: LabQualityInput = {
      labKey: 'gapPlan',
      runId: 'run-empty',
      companyId: 'comp-1',
      findings: [],
      recommendations: [],
    };

    const result = computeLabQualityScore(input);
    expect(result).toBeNull();
  });

  it('calculates weighted composite for Website Lab', () => {
    const input: LabQualityInput = {
      labKey: 'websiteLab',
      runId: 'run-1',
      companyId: 'comp-1',
      findings: [
        { id: '1', text: 'Finding', pageUrl: 'https://example.com', specificReference: '/home', canonicalHash: 'h1' },
      ],
      recommendations: [
        { id: 'r1', text: 'Rec', linkedFindingId: '1' },
      ],
      personaJourneys: [
        { personaName: 'P1', goal: 'G1', failurePointPage: '/p1', failureReason: 'R1', hasClearGoal: true, hasExplicitFailurePoint: true },
      ],
    };

    const result = computeLabQualityScore(input);
    expect(result).not.toBeNull();
    expect(result!.score).toBeGreaterThan(0);
    expect(result!.qualityBand).toBeDefined();
    expect(result!.metrics.personaDiagnosticQuality).toBeDefined();
  });

  it('calculates weighted composite for non-Website Lab (redistributes persona weight)', () => {
    const input: LabQualityInput = {
      labKey: 'competitionLab',
      runId: 'run-1',
      companyId: 'comp-1',
      findings: [
        { id: '1', text: 'Competitor X analysis', pageUrl: 'https://competitor.com', specificReference: 'Competitor X', canonicalHash: 'h1' },
      ],
      recommendations: [
        { id: 'r1', text: 'Rec', linkedFindingId: '1' },
      ],
    };

    const result = computeLabQualityScore(input);
    expect(result).not.toBeNull();
    expect(result!.score).toBeGreaterThan(0);
    expect(result!.qualityBand).toBeDefined();
    expect(result!.metrics.personaDiagnosticQuality).toBeUndefined();
    // Check that weights are redistributed (no persona weight)
    expect(result!.weights.personaDiagnosticQuality).toBeUndefined();
  });

  it('generates warnings for failed metrics', () => {
    const input: LabQualityInput = {
      labKey: 'brandLab',
      runId: 'run-1',
      companyId: 'comp-1',
      findings: [
        { id: '1', text: 'You should improve UX', canonicalHash: 'h1' }, // Generic, no evidence
        { id: '2', text: 'Need to strengthen funnel', canonicalHash: 'h1' }, // Duplicate
      ],
      recommendations: [
        { id: 'r1', text: 'Generic recommendation' }, // No link
      ],
    };

    const result = computeLabQualityScore(input);
    expect(result).not.toBeNull();
    expect(result!.warnings.length).toBeGreaterThan(0);
    expect(result!.warnings.some(w => w.type === 'low_evidence')).toBe(true);
    expect(result!.warnings.some(w => w.type === 'generic_findings')).toBe(true);
    expect(result!.warnings.some(w => w.type === 'orphan_recommendations')).toBe(true);
  });
});

// ============================================================================
// Regression Detection Tests
// ============================================================================

describe('Regression Detection', () => {
  it('detects regression when score drops >= 10 points', () => {
    const previousScore: LabQualityScore = {
      id: 'prev',
      companyId: 'comp-1',
      labKey: 'websiteLab',
      runId: 'run-prev',
      computedAt: '2025-01-01T00:00:00Z',
      score: 85,
      qualityBand: 'Excellent',
      metrics: {} as any,
      weights: {},
      warnings: [],
    };

    const input: LabQualityInput = {
      labKey: 'websiteLab',
      runId: 'run-1',
      companyId: 'comp-1',
      findings: [
        { id: '1', text: 'Generic finding', canonicalHash: 'h1' },
      ],
      recommendations: [],
      previousScore,
    };

    const result = computeLabQualityScore(input);
    expect(result).not.toBeNull();
    expect(result!.regression).toBeDefined();
    expect(result!.regression!.isRegression).toBe(true);
    expect(result!.regression!.previousScore).toBe(85);
    expect(result!.regression!.pointDifference).toBeLessThan(-10);
  });

  it('does not flag minor score changes as regression', () => {
    const previousScore: LabQualityScore = {
      id: 'prev',
      companyId: 'comp-1',
      labKey: 'websiteLab',
      runId: 'run-prev',
      computedAt: '2025-01-01T00:00:00Z',
      score: 80,
      qualityBand: 'Good',
      metrics: {} as any,
      weights: {},
      warnings: [],
    };

    const input: LabQualityInput = {
      labKey: 'websiteLab',
      runId: 'run-1',
      companyId: 'comp-1',
      findings: [
        { id: '1', text: 'Finding', pageUrl: 'https://example.com', specificReference: '/home', canonicalHash: 'h1' },
      ],
      recommendations: [
        { id: 'r1', text: 'Rec', linkedFindingId: '1' },
      ],
      personaJourneys: [
        { personaName: 'P1', goal: 'G1', failurePointPage: '/p1', failureReason: 'R1', hasClearGoal: true, hasExplicitFailurePoint: true },
      ],
      previousScore,
    };

    const result = computeLabQualityScore(input);
    expect(result).not.toBeNull();
    // Score should be high, so no regression
    if (result!.regression) {
      expect(result!.regression.isRegression).toBe(false);
    }
  });
});

// ============================================================================
// Weight Configuration Tests
// ============================================================================

describe('Weight Configuration', () => {
  it('default weights sum to 100', () => {
    const total = Object.values(DEFAULT_METRIC_WEIGHTS).reduce((sum, w) => sum + w, 0);
    expect(total).toBe(100);
  });

  it('non-Website weights sum to 100', () => {
    const total = Object.values(NON_WEBSITE_LAB_WEIGHTS).reduce((sum, w) => sum + w, 0);
    expect(total).toBe(100);
  });

  it('thresholds are within valid range', () => {
    for (const threshold of Object.values(METRIC_THRESHOLDS)) {
      expect(threshold).toBeGreaterThanOrEqual(0);
      expect(threshold).toBeLessThanOrEqual(100);
    }
  });
});

// ============================================================================
// Quality Input Extraction Tests
// ============================================================================

describe('Quality Input Extraction from Lab Raw', () => {
  it('returns empty for V4-only Website Lab structure (V4 fallback disabled)', () => {
    // HARD CUTOVER: V4 fallback is disabled. V5 is REQUIRED.
    // This test verifies that V4-only data returns empty results.
    const rawJson = {
      siteAssessment: {
        issues: [
          { description: 'Issue 1', pageUrl: 'https://example.com' },
          { description: 'Issue 2' },
        ],
        recommendations: [
          { description: 'Rec 1', findingId: 'f1' },
        ],
      },
    };

    const input = extractQualityInputFromLabRaw('websiteLab', 'run-1', 'comp-1', rawJson);
    // V4 data is ignored - expect empty results
    expect(input.findings.length).toBe(0);
    expect(input.recommendations.length).toBe(0);
  });

  it('extracts findings from Competition Lab structure', () => {
    const rawJson = {
      competitors: [
        { name: 'Competitor A', analysis: 'They do X well', website: 'https://compA.com' },
      ],
      insights: [
        { text: 'Market insight 1' },
      ],
      recommendations: [
        { text: 'Strategy recommendation' },
      ],
    };

    const input = extractQualityInputFromLabRaw('competitionLab', 'run-1', 'comp-1', rawJson);
    expect(input.findings.length).toBeGreaterThan(0);
    expect(input.recommendations.length).toBeGreaterThan(0);
  });

  it('handles empty raw JSON gracefully', () => {
    const input = extractQualityInputFromLabRaw('brandLab', 'run-1', 'comp-1', null);
    expect(input.findings).toEqual([]);
    expect(input.recommendations).toEqual([]);
  });

  it('handles malformed JSON gracefully', () => {
    const input = extractQualityInputFromLabRaw('gapPlan', 'run-1', 'comp-1', { randomField: 123 });
    expect(input.findings).toEqual([]);
    expect(input.recommendations).toEqual([]);
  });

  it('extracts findings from Website Lab V5 structure (preferred)', () => {
    const rawJson = {
      v5Diagnostic: {
        score: 58,
        blockingIssues: [
          {
            id: 1,
            severity: 'high',
            page: '/pricing',
            whyItBlocks: 'No clear pricing visible above the fold',
            concreteFix: { what: 'Add pricing table', where: 'Above fold on /pricing' },
          },
          {
            id: 2,
            severity: 'medium',
            page: '/',
            whyItBlocks: 'Missing clear CTA on homepage',
            concreteFix: { what: 'Add CTA button', where: 'Hero section' },
          },
        ],
        observations: [
          {
            pagePath: '/',
            pageType: 'home',
            missingUnclearElements: ['Value proposition unclear', 'No social proof'],
          },
        ],
        quickWins: [
          {
            addressesIssueId: 1,
            title: 'Add pricing table',
            action: 'Create clear pricing table with plan comparison',
            page: '/pricing',
          },
          {
            addressesIssueId: 2,
            title: 'Add homepage CTA',
            action: 'Add prominent call-to-action button in hero',
            page: '/',
          },
        ],
        structuralChanges: [
          {
            addressesIssueIds: [1, 2],
            title: 'Restructure conversion funnel',
            description: 'Improve user journey from homepage to pricing',
          },
        ],
        personaJourneys: [
          {
            persona: 'first_time',
            intendedGoal: 'Understand what the product does',
            actualPath: ['/', '/about'],
            succeeded: true,
            failurePoint: null,
          },
          {
            persona: 'ready_to_buy',
            intendedGoal: 'Find pricing and sign up',
            actualPath: ['/', '/pricing'],
            succeeded: false,
            failurePoint: '/pricing',
          },
        ],
      },
    };

    const input = extractQualityInputFromLabRaw('websiteLab', 'run-1', 'comp-1', rawJson);

    // Should extract findings from blockingIssues and observations
    expect(input.findings.length).toBeGreaterThanOrEqual(4); // 2 blocking issues + 2 missing elements
    expect(input.findings.some(f => f.text.includes('No clear pricing visible'))).toBe(true);
    expect(input.findings.some(f => f.text.includes('Value proposition unclear'))).toBe(true);

    // Should have page URLs from V5 structure
    expect(input.findings.some(f => f.pageUrl === '/pricing')).toBe(true);

    // Should extract recommendations from quickWins and structuralChanges
    expect(input.recommendations.length).toBeGreaterThanOrEqual(3); // 2 quick wins + 1 structural change
    expect(input.recommendations.some(r => r.text.includes('pricing table'))).toBe(true);

    // Should have linked finding IDs (addressesIssueId -> finding-N)
    expect(input.recommendations.some(r => r.linkedFindingId === 'finding-0')).toBe(true);

    // Should extract persona journeys from V5 structure
    expect(input.personaJourneys).toBeDefined();
    expect(input.personaJourneys!.length).toBe(2);
    expect(input.personaJourneys!.some(j => j.personaName === 'first_time')).toBe(true);
    expect(input.personaJourneys!.some(j => j.personaName === 'ready_to_buy' && j.failurePointPage === '/pricing')).toBe(true);
  });

  it('prefers V5 structure over V4 when both exist', () => {
    const rawJson = {
      v5Diagnostic: {
        blockingIssues: [
          { id: 1, page: '/v5-page', whyItBlocks: 'V5 issue' },
        ],
        quickWins: [
          { addressesIssueId: 1, action: 'V5 recommendation' },
        ],
        personaJourneys: [
          { persona: 'v5_persona', intendedGoal: 'V5 goal', succeeded: true, failurePoint: null },
        ],
        observations: [],
        structuralChanges: [],
      },
      siteAssessment: {
        issues: [
          { description: 'V4 issue', pageUrl: '/v4-page' },
        ],
        recommendations: [
          { description: 'V4 recommendation' },
        ],
      },
    };

    const input = extractQualityInputFromLabRaw('websiteLab', 'run-1', 'comp-1', rawJson);

    // Should only have V5 data, not V4
    expect(input.findings.some(f => f.text.includes('V5 issue'))).toBe(true);
    expect(input.findings.some(f => f.text.includes('V4 issue'))).toBe(false);
    expect(input.recommendations.some(r => r.text.includes('V5 recommendation'))).toBe(true);
    expect(input.recommendations.some(r => r.text.includes('V4 recommendation'))).toBe(false);
  });
});

// ============================================================================
// Type Contract Stability Tests
// ============================================================================

describe('Type Contracts', () => {
  it('MetricResult has required fields', () => {
    const result: MetricResult = {
      metricId: 'evidenceAnchoring',
      name: 'Evidence Anchoring',
      score: 80,
      passed: true,
      threshold: 80,
      details: {},
    };
    expect(result.metricId).toBeDefined();
    expect(result.score).toBeDefined();
    expect(result.passed).toBeDefined();
    expect(result.threshold).toBeDefined();
  });

  it('LabQualityScore has required fields', () => {
    const score: LabQualityScore = {
      id: 'test',
      companyId: 'comp-1',
      labKey: 'websiteLab',
      runId: 'run-1',
      computedAt: new Date().toISOString(),
      score: 75,
      qualityBand: 'Good',
      metrics: {
        evidenceAnchoring: { metricId: 'evidenceAnchoring', name: 'Evidence Anchoring', score: 80, passed: true, threshold: 80, details: {} },
        specificity: { metricId: 'specificity', name: 'Specificity', score: 70, passed: true, threshold: 70, details: {} },
        deduplicatedSignalDensity: { metricId: 'deduplicatedSignalDensity', name: 'Signal Density', score: 80, passed: true, threshold: 70, details: {} },
        recommendationTraceability: { metricId: 'recommendationTraceability', name: 'Recommendation Traceability', score: 70, passed: true, threshold: 70, details: {} },
      },
      weights: {},
      warnings: [],
    };
    expect(score.id).toBeDefined();
    expect(score.qualityBand).toBeDefined();
    expect(score.metrics).toBeDefined();
  });

  it('Generic phrases array is non-empty', () => {
    expect(GENERIC_PHRASES.length).toBeGreaterThan(0);
  });
});
