// tests/competition-v3/scoring.test.ts
// Tests for Scoring V3.1 - Deterministic scoring from signals
//
// Validates that:
// - Scores are computed from signals, NOT placeholders
// - threatScore and relevanceScore are in 0-100 range
// - Direct competitors with all signals true yield high threatScore
// - Platform/fractional get lower threatScore than direct
// - LOW_CONFIDENCE_CONTEXT produces fallback scores

import { describe, it, expect } from 'vitest';
import {
  scoreCompetitors,
  scoreCompetitorsWithDebug,
  generateFallbackScores,
  generateFallbackScoringDebug,
  hasPlaceholderScores,
  validateScoredCandidates,
  SIGNAL_SCORES,
  TYPE_ADJUSTMENTS,
  UNKNOWN_SCORES,
  SCORING_VERSION,
} from '@/lib/competition-v3/scoring/computeScores';
import type {
  EnrichedCandidate,
  QueryContext,
  ClassificationResult,
  CompetitorScores,
} from '@/lib/competition-v3/types';

// ============================================================================
// Test Fixtures
// ============================================================================

function createMinimalQueryContext(
  overrides?: Partial<QueryContext>
): QueryContext {
  return {
    businessName: 'Test Company',
    domain: 'testcompany.com',
    industry: 'Marketing Services',
    businessModel: 'Agency',
    businessModelCategory: 'B2B',
    icpDescription: 'B2B SaaS startups in growth stage',
    icpStage: 'growth',
    targetIndustries: ['SaaS', 'Tech'],
    primaryOffers: ['SEO', 'Content Marketing', 'PPC'],
    serviceModel: 'retainer',
    pricePositioning: 'premium',
    valueProposition: 'AI-powered growth marketing',
    differentiators: ['AI-first', 'Startup focus'],
    geography: 'United States',
    serviceRegions: ['US', 'North America'],
    aiOrientation: 'ai-first',
    ...overrides,
  };
}

function createClassifiedCandidate(
  name: string,
  type: ClassificationResult['type'],
  signals: Partial<ClassificationResult['signals']> = {}
): EnrichedCandidate & { classification: ClassificationResult } {
  return {
    name,
    domain: `${name.toLowerCase().replace(/\s+/g, '')}.com`,
    homepageUrl: `https://${name.toLowerCase().replace(/\s+/g, '')}.com`,
    source: 'ai_inference',
    sourceUrl: null,
    sourceRank: null,
    queryMatched: null,
    snippet: `${name} is a competitor`,
    directoryRating: null,
    directoryReviews: null,
    frequency: 1,
    enrichmentStatus: 'completed',
    enrichmentError: null,
    crawledContent: null,
    metadata: {
      teamSize: 'medium',
      teamSizeEstimate: 50,
      foundedYear: 2020,
      headquarters: 'US',
      serviceRegions: ['United States'],
      techStack: [],
      hasAICapabilities: false,
      hasAutomation: false,
      pricingTier: 'mid',
      businessModel: 'agency',
      serviceModel: 'retainer',
    },
    semanticSimilarity: null,
    aiSummary: null,
    aiStrengths: [],
    aiWeaknesses: [],
    aiWhyCompetitor: null,
    classification: {
      type,
      confidence: 0.8,
      reasoning: `Classified as ${type}`,
      signals: {
        businessModelMatch: signals.businessModelMatch ?? false,
        icpOverlap: signals.icpOverlap ?? false,
        serviceOverlap: signals.serviceOverlap ?? false,
        sameMarket: signals.sameMarket ?? false,
        isPlatform: signals.isPlatform ?? false,
        isFractional: signals.isFractional ?? false,
        isInternalAlt: signals.isInternalAlt ?? false,
      },
    },
  };
}

// ============================================================================
// Tests: No Placeholder Defaults
// ============================================================================

describe('Scoring V3.1: No Placeholder Defaults', () => {
  it('should NOT produce placeholder scores (50/50/50/10/5 pattern)', () => {
    const context = createMinimalQueryContext();
    const candidate = createClassifiedCandidate('Test Competitor', 'direct', {
      businessModelMatch: true,
      icpOverlap: true,
      serviceOverlap: true,
    });

    const [scored] = scoreCompetitors([candidate], context);

    // Should NOT have placeholder pattern
    expect(hasPlaceholderScores(scored.scores)).toBe(false);

    // Scores should be computed, not 50
    expect(scored.scores.businessModelFit).not.toBe(50);
    expect(scored.scores.icpFit).not.toBe(50);
    expect(scored.scores.serviceOverlap).not.toBe(50);
  });

  it('should produce high scores when signals are true', () => {
    const context = createMinimalQueryContext();
    const candidate = createClassifiedCandidate('High Signal Competitor', 'direct', {
      businessModelMatch: true,
      icpOverlap: true,
      serviceOverlap: true,
      sameMarket: true,
    });

    const [scored] = scoreCompetitors([candidate], context);

    expect(scored.scores.businessModelFit).toBe(SIGNAL_SCORES.businessModelMatch.present);
    expect(scored.scores.icpFit).toBe(SIGNAL_SCORES.icpOverlap.present);
    expect(scored.scores.serviceOverlap).toBe(SIGNAL_SCORES.serviceOverlap.present);
  });

  it('should produce low scores when signals are false', () => {
    const context = createMinimalQueryContext();
    const candidate = createClassifiedCandidate('Low Signal Competitor', 'partial', {
      businessModelMatch: false,
      icpOverlap: false,
      serviceOverlap: false,
      sameMarket: false,
    });
    // Override metadata to have different business model so we truly test signal-based scoring
    candidate.metadata = {
      ...candidate.metadata!,
      businessModel: 'saas', // Different from context's 'agency'
    };

    const [scored] = scoreCompetitors([candidate], context);

    // Scores should be low but NOT 50 (SIGNAL_SCORES.*.absent values are 30, 25, 20)
    expect(scored.scores.businessModelFit).toBeLessThan(50);
    expect(scored.scores.icpFit).toBeLessThan(50);
    expect(scored.scores.serviceOverlap).toBeLessThan(50);
  });

  it('should use UNKNOWN_SCORES when metadata is missing', () => {
    const context = createMinimalQueryContext();
    const candidate = createClassifiedCandidate('No Metadata Competitor', 'partial', {});
    candidate.metadata = null;

    const [scored] = scoreCompetitors([candidate], context);

    // Should use UNKNOWN_SCORES.noMetadata, NOT 50
    expect(scored.scores.aiOrientation).toBe(UNKNOWN_SCORES.noMetadata);
  });

  it('should validate scored candidates and detect placeholders', () => {
    // Create a fake placeholder pattern
    const placeholderScores: CompetitorScores = {
      icpFit: 50,
      businessModelFit: 50,
      serviceOverlap: 50,
      valueModelFit: 50,
      icpStageMatch: 50,
      aiOrientation: 50,
      geographyFit: 50,
      threatScore: 10,
      relevanceScore: 5,
    };

    expect(hasPlaceholderScores(placeholderScores)).toBe(true);

    const validation = validateScoredCandidates([{ scores: placeholderScores }]);
    expect(validation.valid).toBe(false);
    expect(validation.placeholderCount).toBe(1);
    expect(validation.message).toContain('SCORING_FAILED');
  });
});

// ============================================================================
// Tests: Threat Score Range and Correlation
// ============================================================================

describe('Scoring V3.1: Threat Score', () => {
  it('should produce threatScore in 0-100 range', () => {
    const context = createMinimalQueryContext();
    const candidates = [
      createClassifiedCandidate('Direct', 'direct', { businessModelMatch: true, icpOverlap: true, serviceOverlap: true }),
      createClassifiedCandidate('Partial', 'partial', { businessModelMatch: false, icpOverlap: true }),
      createClassifiedCandidate('Platform', 'platform', { isPlatform: true }),
      createClassifiedCandidate('Fractional', 'fractional', { isFractional: true }),
    ];

    const scored = scoreCompetitors(candidates, context);

    for (const c of scored) {
      expect(c.scores.threatScore).toBeGreaterThanOrEqual(0);
      expect(c.scores.threatScore).toBeLessThanOrEqual(100);
    }
  });

  it('should give direct competitor with all signals > 70 threatScore', () => {
    const context = createMinimalQueryContext();
    const candidate = createClassifiedCandidate('Strong Direct', 'direct', {
      businessModelMatch: true,
      icpOverlap: true,
      serviceOverlap: true,
      sameMarket: true,
    });

    const [scored] = scoreCompetitors([candidate], context);

    expect(scored.scores.threatScore).toBeGreaterThan(70);
  });

  it('should give platform/fractional lower threatScore than direct with same overlaps', () => {
    const context = createMinimalQueryContext();
    const signalsBase = {
      businessModelMatch: true,
      icpOverlap: true,
      serviceOverlap: true,
    };

    const direct = createClassifiedCandidate('Direct', 'direct', signalsBase);
    const platform = createClassifiedCandidate('Platform', 'platform', { ...signalsBase, isPlatform: true });
    const fractional = createClassifiedCandidate('Fractional', 'fractional', { ...signalsBase, isFractional: true });

    const [scoredDirect] = scoreCompetitors([direct], context);
    const [scoredPlatform] = scoreCompetitors([platform], context);
    const [scoredFractional] = scoreCompetitors([fractional], context);

    // Direct should have highest threat
    expect(scoredDirect.scores.threatScore).toBeGreaterThan(scoredPlatform.scores.threatScore);
    expect(scoredDirect.scores.threatScore).toBeGreaterThan(scoredFractional.scores.threatScore);

    // Platform and fractional should be penalized
    expect(scoredPlatform.scores.threatScore).toBeLessThan(scoredDirect.scores.threatScore - 10);
    expect(scoredFractional.scores.threatScore).toBeLessThan(scoredDirect.scores.threatScore - 5);
  });

  it('should apply type adjustments correctly', () => {
    expect(TYPE_ADJUSTMENTS.direct).toBe(10);
    expect(TYPE_ADJUSTMENTS.platform).toBe(-15);
    expect(TYPE_ADJUSTMENTS.fractional).toBe(-10);
    expect(TYPE_ADJUSTMENTS.internal).toBe(-10);
  });

  it('should include scoring notes explaining threat calculation', () => {
    const context = createMinimalQueryContext();
    const candidate = createClassifiedCandidate('Noted Competitor', 'direct', {
      businessModelMatch: true,
      icpOverlap: true,
    });

    const [scored] = scoreCompetitors([candidate], context);

    expect(scored.scores.scoringNotes?.threatNotes).toBeDefined();
    expect(scored.scores.scoringNotes?.threatNotes).toContain('type=direct');
    expect(scored.scores.scoringNotes?.businessModelNotes).toContain('businessModelMatch=true');
    expect(scored.scores.scoringNotes?.icpNotes).toContain('icpOverlap=true');
  });
});

// ============================================================================
// Tests: Relevance Score
// ============================================================================

describe('Scoring V3.1: Relevance Score', () => {
  it('should produce relevanceScore in 0-100 range', () => {
    const context = createMinimalQueryContext();
    const candidates = [
      createClassifiedCandidate('Direct', 'direct', { businessModelMatch: true, icpOverlap: true }),
      createClassifiedCandidate('Partial', 'partial', {}),
      createClassifiedCandidate('Irrelevant', 'irrelevant', {}),
    ];

    const scored = scoreCompetitors(candidates, context);

    for (const c of scored) {
      expect(c.scores.relevanceScore).toBeGreaterThanOrEqual(0);
      expect(c.scores.relevanceScore).toBeLessThanOrEqual(100);
    }
  });

  it('should penalize irrelevant competitors heavily', () => {
    const context = createMinimalQueryContext();
    const relevant = createClassifiedCandidate('Direct', 'direct', { businessModelMatch: true });
    const irrelevant = createClassifiedCandidate('Irrelevant', 'irrelevant', {});

    const [scoredRelevant] = scoreCompetitors([relevant], context);
    const [scoredIrrelevant] = scoreCompetitors([irrelevant], context);

    expect(scoredIrrelevant.scores.relevanceScore).toBeLessThan(20);
    expect(scoredRelevant.scores.relevanceScore).toBeGreaterThan(scoredIrrelevant.scores.relevanceScore);
  });
});

// ============================================================================
// Tests: Fallback Scoring (LOW_CONFIDENCE_CONTEXT)
// ============================================================================

describe('Scoring V3.1: Fallback Scoring', () => {
  it('should return zeros for LOW_CONFIDENCE_CONTEXT fallback', () => {
    const scores = generateFallbackScores('fallback_low_confidence');

    expect(scores.icpFit).toBe(0);
    expect(scores.businessModelFit).toBe(0);
    expect(scores.serviceOverlap).toBe(0);
    expect(scores.threatScore).toBe(0);
    expect(scores.relevanceScore).toBe(0);
    expect(scores.scoringNotes?.threatNotes).toContain('LOW_CONFIDENCE_CONTEXT');
  });

  it('should return zeros for fallback_error', () => {
    const scores = generateFallbackScores('fallback_error');

    expect(scores.threatScore).toBe(0);
    expect(scores.scoringNotes?.threatNotes).toContain('ERROR_STATE');
  });

  it('should generate fallback debug with correct strategy', () => {
    const debug = generateFallbackScoringDebug('fallback_low_confidence', 'Test reason');

    expect(debug.strategy).toBe('fallback_low_confidence');
    expect(debug.version).toBe(SCORING_VERSION);
    expect(debug.notes).toContain('Test reason');
    expect(debug.scoreDistribution.threatScoreAvg).toBe(0);
  });
});

// ============================================================================
// Tests: Scoring Debug
// ============================================================================

describe('Scoring V3.1: Debug Output', () => {
  it('should return scoring debug with scoreCompetitorsWithDebug', () => {
    const context = createMinimalQueryContext();
    const candidates = [
      createClassifiedCandidate('Test1', 'direct', { businessModelMatch: true }),
      createClassifiedCandidate('Test2', 'partial', { icpOverlap: true }),
    ];

    const { candidates: scored, debug } = scoreCompetitorsWithDebug(candidates, context);

    expect(scored.length).toBe(2);
    expect(debug.strategy).toBe('deterministic');
    expect(debug.version).toBe(SCORING_VERSION);
    expect(debug.computedAt).toBeDefined();
    expect(debug.signalCoverage).toBeDefined();
    expect(debug.signalCoverage.businessModelMatch).toBe(50); // 1/2 = 50%
    expect(debug.scoreDistribution.threatScoreMin).toBeDefined();
    expect(debug.scoreDistribution.threatScoreMax).toBeDefined();
    expect(debug.scoreDistribution.threatScoreAvg).toBeDefined();
  });

  it('should track missing context inputs in debug', () => {
    const context = createMinimalQueryContext({
      businessModel: null,
      icpDescription: null,
    });
    const candidates = [createClassifiedCandidate('Test', 'partial', {})];

    const { debug } = scoreCompetitorsWithDebug(candidates, context);

    expect(debug.missingInputs).toContain('businessModel');
    expect(debug.missingInputs).toContain('icpDescription');
  });
});

// ============================================================================
// Tests: Signal Scores Constants
// ============================================================================

describe('Scoring V3.1: Constants', () => {
  it('should have correct signal score values', () => {
    expect(SIGNAL_SCORES.businessModelMatch.present).toBe(90);
    expect(SIGNAL_SCORES.businessModelMatch.absent).toBe(30);
    expect(SIGNAL_SCORES.icpOverlap.present).toBe(85);
    expect(SIGNAL_SCORES.icpOverlap.absent).toBe(25);
    expect(SIGNAL_SCORES.serviceOverlap.present).toBe(90);
    expect(SIGNAL_SCORES.serviceOverlap.absent).toBe(20);
  });

  it('should have correct unknown score values (NOT 50)', () => {
    expect(UNKNOWN_SCORES.noMetadata).toBe(35);
    expect(UNKNOWN_SCORES.noGeography).toBe(40);
    expect(UNKNOWN_SCORES.noAIContext).toBe(45);
    expect(UNKNOWN_SCORES.noSignalData).toBe(30);

    // Verify none are 50
    Object.values(UNKNOWN_SCORES).forEach(score => {
      expect(score).not.toBe(50);
    });
  });

  it('should have correct type adjustments', () => {
    expect(TYPE_ADJUSTMENTS.direct).toBe(10);
    expect(TYPE_ADJUSTMENTS.partial).toBe(0);
    expect(TYPE_ADJUSTMENTS.fractional).toBe(-10);
    expect(TYPE_ADJUSTMENTS.platform).toBe(-15);
    expect(TYPE_ADJUSTMENTS.internal).toBe(-10);
    expect(TYPE_ADJUSTMENTS.irrelevant).toBe(-30);
  });
});

// ============================================================================
// Tests: Real-World Scenarios
// ============================================================================

describe('Scoring V3.1: Real-World Scenarios', () => {
  it('should score agency competitor against agency target correctly', () => {
    const context = createMinimalQueryContext({
      businessModel: 'Agency',
      industry: 'Digital Marketing',
    });

    const competitor = createClassifiedCandidate('Similar Agency', 'direct', {
      businessModelMatch: true,
      icpOverlap: true,
      serviceOverlap: true,
      sameMarket: true,
    });
    competitor.metadata!.businessModel = 'agency';

    const [scored] = scoreCompetitors([competitor], context);

    // Should have high scores across the board
    expect(scored.scores.businessModelFit).toBeGreaterThan(80);
    expect(scored.scores.icpFit).toBeGreaterThan(80);
    expect(scored.scores.serviceOverlap).toBeGreaterThan(80);
    expect(scored.scores.threatScore).toBeGreaterThan(70);
  });

  it('should score platform alternative lower than direct competitor', () => {
    const context = createMinimalQueryContext();

    const directCompetitor = createClassifiedCandidate('Direct Agency', 'direct', {
      businessModelMatch: true,
      icpOverlap: true,
      serviceOverlap: true,
    });

    const platformAlternative = createClassifiedCandidate('HubSpot', 'platform', {
      businessModelMatch: false,
      icpOverlap: true,
      serviceOverlap: false,
      isPlatform: true,
    });
    platformAlternative.metadata!.businessModel = 'saas';

    const scored = scoreCompetitors([directCompetitor, platformAlternative], context);

    const directScored = scored.find(c => c.name === 'Direct Agency')!;
    const platformScored = scored.find(c => c.name === 'HubSpot')!;

    expect(directScored.scores.threatScore).toBeGreaterThan(platformScored.scores.threatScore);
    expect(directScored.scores.businessModelFit).toBeGreaterThan(platformScored.scores.businessModelFit);
  });

  it('should handle competitor with no signals gracefully', () => {
    const context = createMinimalQueryContext();
    const candidate = createClassifiedCandidate('Unknown Competitor', 'partial', {
      businessModelMatch: false,
      icpOverlap: false,
      serviceOverlap: false,
      sameMarket: false,
    });

    const [scored] = scoreCompetitors([candidate], context);

    // Should still produce valid scores, not placeholders
    expect(hasPlaceholderScores(scored.scores)).toBe(false);
    expect(scored.scores.threatScore).toBeGreaterThanOrEqual(0);
    expect(scored.scores.threatScore).toBeLessThanOrEqual(100);

    // Scores should be low but not undefined
    expect(scored.scores.businessModelFit).toBeDefined();
    expect(scored.scores.icpFit).toBeDefined();
    expect(scored.scores.serviceOverlap).toBeDefined();
  });
});
