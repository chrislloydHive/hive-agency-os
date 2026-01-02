// tests/context/v4-competitionCandidatesV4.test.ts
// Tests for Competition V4 Candidates Builder (trait-based scoring)
//
// Tests the new V4 candidates builder that uses trait-based overlap scoring
// instead of type-based filtering.

import { describe, it, expect } from 'vitest';
import {
  buildCompetitionCandidatesV4,
  extractV4QualityMetrics,
} from '@/lib/contextGraph/v4/competitionCandidatesV4';
import type {
  CompetitionV4Result,
  ScoredCompetitor,
  ExcludedCompetitorRecord,
} from '@/lib/competition-v4/types';

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Create a minimal V4 run for testing
 */
function createV4Run(overrides: Partial<CompetitionV4Result> = {}): CompetitionV4Result {
  return {
    version: 4,
    runId: 'test-v4-run-123',
    companyId: 'test-company',
    companyName: 'Test Company',
    domain: 'testcompany.com',
    decomposition: {
      market_orientation: 'B2C',
      economic_model: 'Service',
      offering_type: 'Hybrid',
      buyer_user_relationship: 'Same',
      transaction_model: 'One-time',
      primary_vertical: 'Home Services',
      secondary_verticals: ['Electronics'],
      geographic_scope: 'Regional',
      confidence_notes: 'High confidence based on website analysis',
    },
    category: {
      category_slug: 'home-audio-installation',
      category_name: 'Home Audio Installation',
      category_description: 'Companies that sell and install car audio and home electronics',
      qualification_rules: ['Must offer installation services', 'Must sell audio products'],
      exclusion_rules: ['Online-only retailers without installation'],
    },
    competitors: {
      validated: [],
      removed: [],
    },
    scoredCompetitors: {
      primary: [
        createScoredCompetitor('Local Audio Pro', 'primary', 85),
        createScoredCompetitor('Sound Masters', 'primary', 78),
      ],
      contextual: [
        createScoredCompetitor('Big Box Electronics', 'contextual', 55),
      ],
      alternatives: [
        createScoredCompetitor('DIY Audio Kits', 'alternative', 30),
      ],
      excluded: [
        { name: 'Random Company', domain: 'random.com', reason: 'Low overlap (15%) with subject business' },
      ],
      threshold: 40,
      modality: 'Retail+Installation',
      modalityConfidence: 85,
      topTraitRules: ['service-capability-match', 'geographic-overlap', 'product-category-match'],
    },
    modalityInference: {
      modality: 'Retail+Installation',
      confidence: 85,
      signals: ['Has installation flag', 'Has products flag', 'Hybrid offering type'],
      explanation: 'Strong signals for both products and services indicate hybrid retail+installation',
      serviceEmphasis: 0.6,
      productEmphasis: 0.4,
    },
    summary: {
      competitive_positioning: 'Test Company is positioned as a premium local installer with strong product selection',
      key_differentiation_axes: ['Local service expertise', 'Product selection'],
      competitive_risks: ['Big box retailers expanding installation services'],
    },
    execution: {
      status: 'completed',
      startedAt: '2024-01-15T10:00:00Z',
      completedAt: '2024-01-15T10:30:00Z',
      durationMs: 1800000,
      stepsCompleted: 5,
    },
    ...overrides,
  };
}

/**
 * Create a scored competitor for testing
 */
function createScoredCompetitor(
  name: string,
  classification: 'primary' | 'contextual' | 'alternative' | 'excluded',
  overlapScore: number
): ScoredCompetitor {
  return {
    name,
    domain: `${name.toLowerCase().replace(/\s+/g, '')}.com`,
    type: 'Direct',
    reason: `Matches in ${classification} category`,
    overlapScore,
    classification,
    rulesApplied: ['service-match', 'geo-overlap'],
    confidence: 70 + (overlapScore > 50 ? 15 : 0),
    whyThisMatters: `${name} competes for similar customers in the local market`,
    signalsUsed: {
      installationCapability: classification !== 'alternative',
      geographicOverlap: 'local',
      productOverlap: true,
      pricePositioning: 'mid',
    },
    reasons: [
      'Offers similar installation services',
      'Targets same geographic area',
      'Overlapping product categories',
    ],
  };
}

// ============================================================================
// Tests: buildCompetitionCandidatesV4
// ============================================================================

describe('buildCompetitionCandidatesV4', () => {
  describe('basic functionality', () => {
    it('should build candidates from a valid V4 run', () => {
      const run = createV4Run();
      const result = buildCompetitionCandidatesV4(run);

      expect(result.extractionPath).toBe('competitionV4');
      expect(result.candidates.length).toBeGreaterThan(0);
      expect(result.errorState).toBeUndefined();
    });

    it('should handle null run', () => {
      const result = buildCompetitionCandidatesV4(null);

      expect(result.errorState?.isError).toBe(true);
      expect(result.errorState?.errorType).toBe('UNKNOWN_ERROR');
      expect(result.candidates.length).toBe(0);
    });

    it('should handle failed run', () => {
      const run = createV4Run({
        execution: {
          status: 'failed',
          startedAt: '2024-01-15T10:00:00Z',
          completedAt: null,
          durationMs: 5000,
          stepsCompleted: 2,
          error: 'Pipeline failed at step 3',
        },
      });

      const result = buildCompetitionCandidatesV4(run);

      expect(result.errorState?.isError).toBe(true);
      expect(result.errorState?.errorType).toBe('FAILED');
    });

    it('should handle run without scoredCompetitors', () => {
      const run = createV4Run();
      (run as any).scoredCompetitors = undefined;

      const result = buildCompetitionCandidatesV4(run);

      expect(result.errorState?.isError).toBe(true);
      expect(result.errorState?.errorType).toBe('NO_SCORED_COMPETITORS');
    });
  });

  describe('primaryCompetitors field', () => {
    it('should create competitiveLandscape.primaryCompetitors candidate', () => {
      const run = createV4Run();
      const result = buildCompetitionCandidatesV4(run);

      const primaryField = result.candidates.find(
        c => c.key === 'competitiveLandscape.primaryCompetitors'
      );

      expect(primaryField).toBeDefined();
      expect(primaryField?.confidence).toBe(0.85);
    });

    it('should include all primary competitors with correct structure', () => {
      const run = createV4Run();
      const result = buildCompetitionCandidatesV4(run);

      const primaryField = result.candidates.find(
        c => c.key === 'competitiveLandscape.primaryCompetitors'
      );
      const competitors = primaryField?.value as Array<{
        name: string;
        domain: string;
        classification: string;
        overlapScore: number;
      }>;

      expect(competitors.length).toBe(2);
      expect(competitors[0].name).toBe('Local Audio Pro');
      expect(competitors[0].classification).toBe('primary');
      expect(competitors[0].overlapScore).toBe(85);
    });

    it('should NOT include competitiveLandscape.primaryCompetitors when no primary competitors', () => {
      const run = createV4Run({
        scoredCompetitors: {
          primary: [],
          contextual: [createScoredCompetitor('Context Co', 'contextual', 50)],
          alternatives: [],
          excluded: [],
          threshold: 40,
          modality: 'Retail+Installation',
        },
      });

      const result = buildCompetitionCandidatesV4(run);

      const primaryField = result.candidates.find(
        c => c.key === 'competitiveLandscape.primaryCompetitors'
      );

      expect(primaryField).toBeUndefined();
    });
  });

  describe('competitors field (primary + contextual)', () => {
    it('should create competitiveLandscape.competitors with merged list', () => {
      const run = createV4Run();
      const result = buildCompetitionCandidatesV4(run);

      const competitorsField = result.candidates.find(
        c => c.key === 'competitiveLandscape.competitors'
      );

      expect(competitorsField).toBeDefined();
      const competitors = competitorsField?.value as Array<{ name: string }>;
      // 2 primary + 1 contextual = 3
      expect(competitors.length).toBe(3);
    });

    it('should have lower confidence than primaryCompetitors', () => {
      const run = createV4Run();
      const result = buildCompetitionCandidatesV4(run);

      const primaryField = result.candidates.find(
        c => c.key === 'competitiveLandscape.primaryCompetitors'
      );
      const competitorsField = result.candidates.find(
        c => c.key === 'competitiveLandscape.competitors'
      );

      expect(competitorsField?.confidence).toBeLessThan(primaryField?.confidence ?? 1);
    });
  });

  describe('summary fields', () => {
    it('should create marketStructureSummary from summary.competitive_positioning', () => {
      const run = createV4Run();
      const result = buildCompetitionCandidatesV4(run);

      const summaryField = result.candidates.find(
        c => c.key === 'competitiveLandscape.marketStructureSummary'
      );

      expect(summaryField).toBeDefined();
      expect(summaryField?.value).toBe(
        'Test Company is positioned as a premium local installer with strong product selection'
      );
    });

    it('should create differentiationAxes from summary.key_differentiation_axes', () => {
      const run = createV4Run();
      const result = buildCompetitionCandidatesV4(run);

      const axesField = result.candidates.find(
        c => c.key === 'competitiveLandscape.differentiationAxes'
      );

      expect(axesField).toBeDefined();
      const axes = axesField?.value as string[];
      expect(axes).toContain('Local service expertise');
      expect(axes).toContain('Product selection');
    });

    it('should create competitiveRisks from summary.competitive_risks', () => {
      const run = createV4Run();
      const result = buildCompetitionCandidatesV4(run);

      const risksField = result.candidates.find(
        c => c.key === 'competitiveLandscape.competitiveRisks'
      );

      expect(risksField).toBeDefined();
      const risks = risksField?.value as string[];
      expect(risks.length).toBeGreaterThan(0);
    });

    it('should NOT create summary fields when summary is missing', () => {
      const run = createV4Run({
        summary: undefined,
      });

      const result = buildCompetitionCandidatesV4(run);

      const summaryField = result.candidates.find(
        c => c.key === 'competitiveLandscape.marketStructureSummary'
      );
      const axesField = result.candidates.find(
        c => c.key === 'competitiveLandscape.differentiationAxes'
      );

      expect(summaryField).toBeUndefined();
      expect(axesField).toBeUndefined();
    });
  });

  describe('modality field', () => {
    it('should create competitiveModality with confidence-based score', () => {
      const run = createV4Run();
      const result = buildCompetitionCandidatesV4(run);

      const modalityField = result.candidates.find(
        c => c.key === 'competitiveLandscape.competitiveModality'
      );

      expect(modalityField).toBeDefined();
      expect(modalityField?.value).toBe('Retail+Installation');
      // 85% confidence -> 0.85
      expect(modalityField?.confidence).toBe(0.85);
    });

    it('should use default confidence when modalityConfidence is missing', () => {
      const run = createV4Run();
      run.scoredCompetitors!.modalityConfidence = undefined;

      const result = buildCompetitionCandidatesV4(run);

      const modalityField = result.candidates.find(
        c => c.key === 'competitiveLandscape.competitiveModality'
      );

      expect(modalityField?.confidence).toBe(0.75);
    });
  });

  describe('marketAlternatives field', () => {
    it('should create marketAlternatives from alternatives bucket', () => {
      const run = createV4Run();
      const result = buildCompetitionCandidatesV4(run);

      const altField = result.candidates.find(
        c => c.key === 'competitiveLandscape.marketAlternatives'
      );

      expect(altField).toBeDefined();
      const alternatives = altField?.value as Array<{ name: string; type: string }>;
      expect(alternatives[0].name).toBe('DIY Audio Kits');
      expect(alternatives[0].type).toBe('Alternative Competitor');
    });
  });

  describe('debug info', () => {
    it('should include counts in debug info', () => {
      const run = createV4Run();
      const result = buildCompetitionCandidatesV4(run);

      expect(result.debug).toBeDefined();
      expect(result.debug?.primaryCount).toBe(2);
      expect(result.debug?.contextualCount).toBe(1);
      expect(result.debug?.alternativeCount).toBe(1);
      expect(result.debug?.excludedCount).toBe(1);
    });

    it('should include topTraitRules in debug info', () => {
      const run = createV4Run();
      const result = buildCompetitionCandidatesV4(run);

      expect(result.debug?.topTraitRules).toContain('service-capability-match');
    });

    it('should indicate if summary and modality are present', () => {
      const run = createV4Run();
      const result = buildCompetitionCandidatesV4(run);

      expect(result.debug?.hasSummary).toBe(true);
      expect(result.debug?.hasModality).toBe(true);
    });
  });
});

// ============================================================================
// Tests: extractV4QualityMetrics
// ============================================================================

describe('extractV4QualityMetrics', () => {
  it('should extract metrics from a valid V4 run', () => {
    const run = createV4Run();
    const metrics = extractV4QualityMetrics(run);

    expect(metrics.competitorCount).toBe(4); // 2 primary + 1 contextual + 1 alternative
    expect(metrics.primaryCount).toBe(2);
    expect(metrics.hasReasons).toBe(true);
    expect(metrics.hasSignals).toBe(true);
    expect(metrics.hasSummary).toBe(true);
    expect(metrics.hasDifferentiationAxes).toBe(true);
    expect(metrics.hasRisks).toBe(true);
    expect(metrics.modalityConfidence).toBe(85);
  });

  it('should handle null run', () => {
    const metrics = extractV4QualityMetrics(null);

    expect(metrics.competitorCount).toBe(0);
    expect(metrics.primaryCount).toBe(0);
    expect(metrics.hasReasons).toBe(false);
    expect(metrics.modalityConfidence).toBe(0);
  });

  it('should handle run without scoredCompetitors', () => {
    const run = createV4Run();
    (run as any).scoredCompetitors = undefined;

    const metrics = extractV4QualityMetrics(run);

    expect(metrics.competitorCount).toBe(0);
    expect(metrics.avgConfidence).toBe(0);
  });

  it('should calculate average confidence across all competitors', () => {
    const run = createV4Run();
    const metrics = extractV4QualityMetrics(run);

    // All competitors have confidence set in createScoredCompetitor
    expect(metrics.avgConfidence).toBeGreaterThan(0);
  });
});
