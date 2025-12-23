// tests/context/v4-competitionCandidates.test.ts
// Comprehensive tests for Competition V4 Candidate Builder
//
// Tests strict filtering of noisy competition data:
// - Platforms (Trello, Monday, Slack) should NEVER be in primaryCompetitors
// - Fractional (CMO on Demand, Zylo) should NEVER be in primaryCompetitors
// - Only qualified direct/partial competitors with quality thresholds pass

import { describe, it, expect } from 'vitest';
import {
  buildCompetitionCandidates,
  QUALITY_THRESHOLDS,
  bucketCompetitorsByType,
  filterDirectSet,
  buildMarketAlternativesSet,
  _testing,
} from '@/lib/contextGraph/v4/competitionCandidates';
import type { CompetitionRunV3Payload } from '@/lib/competition-v3/store';
import type { CompetitorProfileV3 } from '@/lib/competition-v3/types';

// ============================================================================
// Test Fixtures - Noisy Competition Data
// ============================================================================

/**
 * Helper to create a minimal competitor profile
 */
function createCompetitor(
  overrides: Partial<CompetitorProfileV3> & { name: string }
): CompetitorProfileV3 {
  return {
    id: `comp-${overrides.name.toLowerCase().replace(/\s+/g, '-')}`,
    runId: 'test-run',
    name: overrides.name,
    domain: overrides.domain ?? `${overrides.name.toLowerCase().replace(/\s+/g, '')}.com`,
    homepageUrl: overrides.homepageUrl ?? `https://${overrides.name.toLowerCase().replace(/\s+/g, '')}.com`,
    logoUrl: null,
    summary: overrides.summary ?? `${overrides.name} is a competitor`,
    classification: overrides.classification ?? {
      type: 'direct',
      confidence: 0.8,
      reasoning: 'Test competitor',
      signals: {
        businessModelMatch: true,
        icpOverlap: true,
        serviceOverlap: true,
        sameMarket: true,
        isPlatform: false,
        isFractional: false,
        isInternalAlt: false,
      },
    },
    scores: overrides.scores ?? {
      icpFit: 70,
      businessModelFit: 70,
      serviceOverlap: 70,
      valueModelFit: 70,
      icpStageMatch: 70,
      aiOrientation: 50,
      geographyFit: 80,
      threatScore: 50,
      relevanceScore: 50,
    },
    positioning: overrides.positioning ?? {
      x: 50,
      y: 50,
      quadrant: 'direct-threat',
      bubbleSize: 'medium',
      clusterGroup: 'cluster-1',
    },
    metadata: overrides.metadata ?? {
      teamSize: 'medium',
      teamSizeEstimate: 50,
      foundedYear: 2015,
      headquarters: 'US',
      serviceRegions: ['US'],
      techStack: [],
      hasAICapabilities: false,
      hasAutomation: false,
      pricingTier: 'mid',
      businessModel: 'agency',
      serviceModel: 'retainer',
    },
    discovery: overrides.discovery ?? {
      source: 'google_search',
      sourceUrl: null,
      frequency: 1,
      directoryRating: null,
      directoryReviews: null,
    },
    analysis: overrides.analysis ?? {
      strengths: [],
      weaknesses: [],
      whyCompetitor: 'Competes in same market',
      differentiators: [],
      opportunities: [],
    },
  };
}

/**
 * Noisy fixture with platforms, fractional, and mixed competitors
 * Similar to real-world noisy data
 */
function createNoisyCompetitionRun(): CompetitionRunV3Payload {
  return {
    runId: 'noisy-run-123',
    companyId: 'test-company',
    status: 'completed',
    createdAt: '2024-01-15T10:00:00Z',
    completedAt: '2024-01-15T10:30:00Z',
    competitors: [
      // Direct competitors - should be in primaryCompetitors
      createCompetitor({
        name: 'Acme Agency',
        classification: {
          type: 'direct',
          confidence: 0.9,
          reasoning: 'Same business model, same ICP',
          signals: {
            businessModelMatch: true,
            icpOverlap: true,
            serviceOverlap: true,
            sameMarket: true,
            isPlatform: false,
            isFractional: false,
            isInternalAlt: false,
          },
        },
        scores: {
          icpFit: 85,
          businessModelFit: 90,
          serviceOverlap: 85,
          valueModelFit: 80,
          icpStageMatch: 85,
          aiOrientation: 70,
          geographyFit: 90,
          threatScore: 75, // Above threshold
          relevanceScore: 80,
        },
        analysis: {
          strengths: ['Strong brand'],
          weaknesses: ['High prices'],
          whyCompetitor: 'Direct competitor in marketing services',
          differentiators: ['pricing', 'enterprise-focus'],
          opportunities: [],
        },
      }),
      createCompetitor({
        name: 'Beta Marketing',
        classification: {
          type: 'direct',
          confidence: 0.85,
          reasoning: 'Direct competitor',
          signals: {
            businessModelMatch: true,
            icpOverlap: true,
            serviceOverlap: true,
            sameMarket: true,
            isPlatform: false,
            isFractional: false,
            isInternalAlt: false,
          },
        },
        scores: {
          icpFit: 80,
          businessModelFit: 85,
          serviceOverlap: 80,
          valueModelFit: 75,
          icpStageMatch: 80,
          aiOrientation: 60,
          geographyFit: 85,
          threatScore: 65, // Above threshold
          relevanceScore: 70,
        },
      }),
      // Low-score direct - should be EXCLUDED from primaryCompetitors
      createCompetitor({
        name: 'Weak Direct Co',
        classification: {
          type: 'direct',
          confidence: 0.6,
          reasoning: 'Weak direct',
          signals: {
            businessModelMatch: true,
            icpOverlap: false,
            serviceOverlap: false,
            sameMarket: true,
            isPlatform: false,
            isFractional: false,
            isInternalAlt: false,
          },
        },
        scores: {
          icpFit: 30,
          businessModelFit: 40,
          serviceOverlap: 25,
          valueModelFit: 30,
          icpStageMatch: 35,
          aiOrientation: 20,
          geographyFit: 50,
          threatScore: 15, // BELOW threshold (25)
          relevanceScore: 18, // BELOW threshold (20)
        },
      }),
      // Partial competitor - may qualify if strong signals
      createCompetitor({
        name: 'Disruptive Advertising',
        classification: {
          type: 'partial',
          confidence: 0.75,
          reasoning: 'Category neighbor - overlaps on PPC',
          signals: {
            businessModelMatch: true,
            icpOverlap: true,
            serviceOverlap: true,
            sameMarket: true,
            isPlatform: false,
            isFractional: false,
            isInternalAlt: false,
          },
        },
        scores: {
          icpFit: 70,
          businessModelFit: 75,
          serviceOverlap: 65,
          valueModelFit: 70,
          icpStageMatch: 70,
          aiOrientation: 55,
          geographyFit: 80,
          threatScore: 55, // Above threshold
          relevanceScore: 60,
        },
        offerOverlapScore: 0.4, // Above 0.2 threshold
      }),
      // Partial competitor - weak signals, should NOT qualify
      createCompetitor({
        name: 'Cleverly',
        classification: {
          type: 'partial',
          confidence: 0.6,
          reasoning: 'LinkedIn outreach - different model',
          signals: {
            businessModelMatch: false,
            icpOverlap: true,
            serviceOverlap: false,
            sameMarket: false,
            isPlatform: false,
            isFractional: false,
            isInternalAlt: false,
          },
        },
        scores: {
          icpFit: 50,
          businessModelFit: 40,
          serviceOverlap: 30,
          valueModelFit: 45,
          icpStageMatch: 50,
          aiOrientation: 40,
          geographyFit: 70,
          threatScore: 30,
          relevanceScore: 35,
        },
      }),
      // PLATFORM - should NEVER be in primaryCompetitors
      createCompetitor({
        name: 'Trello',
        domain: 'trello.com',
        classification: {
          type: 'platform',
          confidence: 0.95,
          reasoning: 'Project management tool',
          signals: {
            businessModelMatch: false,
            icpOverlap: true,
            serviceOverlap: false,
            sameMarket: false,
            isPlatform: true,
            isFractional: false,
            isInternalAlt: false,
          },
        },
        scores: {
          icpFit: 60,
          businessModelFit: 20,
          serviceOverlap: 10,
          valueModelFit: 30,
          icpStageMatch: 60,
          aiOrientation: 50,
          geographyFit: 100,
          threatScore: 40, // Even with decent threat score
          relevanceScore: 35,
        },
      }),
      createCompetitor({
        name: 'Monday.com',
        domain: 'monday.com',
        classification: {
          type: 'platform',
          confidence: 0.92,
          reasoning: 'Work management platform',
          signals: {
            businessModelMatch: false,
            icpOverlap: true,
            serviceOverlap: false,
            sameMarket: false,
            isPlatform: true,
            isFractional: false,
            isInternalAlt: false,
          },
        },
        scores: {
          icpFit: 55,
          businessModelFit: 15,
          serviceOverlap: 5,
          valueModelFit: 25,
          icpStageMatch: 55,
          aiOrientation: 60,
          geographyFit: 100,
          threatScore: 35,
          relevanceScore: 30,
        },
      }),
      createCompetitor({
        name: 'Slack',
        domain: 'slack.com',
        classification: {
          type: 'platform',
          confidence: 0.9,
          reasoning: 'Communication platform',
          signals: {
            businessModelMatch: false,
            icpOverlap: true,
            serviceOverlap: false,
            sameMarket: false,
            isPlatform: true,
            isFractional: false,
            isInternalAlt: false,
          },
        },
        scores: {
          icpFit: 50,
          businessModelFit: 10,
          serviceOverlap: 5,
          valueModelFit: 20,
          icpStageMatch: 50,
          aiOrientation: 70,
          geographyFit: 100,
          threatScore: 25,
          relevanceScore: 25,
        },
      }),
      // FRACTIONAL - should NEVER be in primaryCompetitors
      createCompetitor({
        name: 'CMO on Demand',
        classification: {
          type: 'fractional',
          confidence: 0.88,
          reasoning: 'Fractional CMO service',
          signals: {
            businessModelMatch: false,
            icpOverlap: true,
            serviceOverlap: true,
            sameMarket: true,
            isPlatform: false,
            isFractional: true,
            isInternalAlt: false,
          },
        },
        scores: {
          icpFit: 70,
          businessModelFit: 40,
          serviceOverlap: 60,
          valueModelFit: 55,
          icpStageMatch: 70,
          aiOrientation: 30,
          geographyFit: 90,
          threatScore: 50, // Even with decent threat score
          relevanceScore: 55,
        },
      }),
      createCompetitor({
        name: 'Zylo Fractional',
        classification: {
          type: 'fractional',
          confidence: 0.85,
          reasoning: 'Fractional marketing executives',
          signals: {
            businessModelMatch: false,
            icpOverlap: true,
            serviceOverlap: true,
            sameMarket: true,
            isPlatform: false,
            isFractional: true,
            isInternalAlt: false,
          },
        },
        scores: {
          icpFit: 65,
          businessModelFit: 35,
          serviceOverlap: 55,
          valueModelFit: 50,
          icpStageMatch: 65,
          aiOrientation: 25,
          geographyFit: 85,
          threatScore: 45,
          relevanceScore: 50,
        },
      }),
      // INTERNAL - should NEVER be in primaryCompetitors
      createCompetitor({
        name: 'In-House Marketing Team',
        classification: {
          type: 'internal',
          confidence: 0.8,
          reasoning: 'DIY/hire alternative',
          signals: {
            businessModelMatch: false,
            icpOverlap: true,
            serviceOverlap: true,
            sameMarket: true,
            isPlatform: false,
            isFractional: false,
            isInternalAlt: true,
          },
        },
        scores: {
          icpFit: 80,
          businessModelFit: 30,
          serviceOverlap: 70,
          valueModelFit: 60,
          icpStageMatch: 75,
          aiOrientation: 40,
          geographyFit: 100,
          threatScore: 60,
          relevanceScore: 65,
        },
      }),
    ],
    insights: [],
    recommendations: [],
    summary: {
      totalCandidates: 11,
      totalCompetitors: 11,
      byType: {
        direct: 3,
        partial: 2,
        fractional: 2,
        platform: 3,
        internal: 1,
      },
      avgThreatScore: 45,
      quadrantDistribution: {
        'direct-threat': 2,
        'different-value': 3,
        'different-icp': 4,
        'distant': 2,
      },
    },
    error: null,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('Competition V4: Strict Filtering', () => {
  describe('bucketCompetitorsByType', () => {
    it('should correctly bucket competitors by classification type', () => {
      const run = createNoisyCompetitionRun();
      const buckets = bucketCompetitorsByType(run.competitors);

      expect(buckets.direct.length).toBe(3);
      expect(buckets.partial.length).toBe(2);
      expect(buckets.fractional.length).toBe(2);
      expect(buckets.platform.length).toBe(3);
      expect(buckets.internal.length).toBe(1);
      expect(buckets.unknown.length).toBe(0);
    });

    it('should handle empty competitors array', () => {
      const buckets = bucketCompetitorsByType([]);

      expect(buckets.direct.length).toBe(0);
      expect(buckets.partial.length).toBe(0);
      expect(buckets.platform.length).toBe(0);
    });
  });

  describe('filterDirectSet', () => {
    it('should exclude low-score direct competitors', () => {
      const run = createNoisyCompetitionRun();
      const buckets = bucketCompetitorsByType(run.competitors);
      const { qualified, excluded } = filterDirectSet(buckets);

      // Weak Direct Co should be excluded (threatScore 15, relevanceScore 18)
      const weakDirect = excluded.find((e) => e.name === 'Weak Direct Co');
      expect(weakDirect).toBeDefined();
      expect(weakDirect?.reason).toMatch(/LOW_THREAT_SCORE|LOW_RELEVANCE_SCORE/);

      // Acme Agency should be qualified (threatScore 75)
      const acme = qualified.find((c) => c.name === 'Acme Agency');
      expect(acme).toBeDefined();
    });

    it('should include partial competitors with strong signals', () => {
      const run = createNoisyCompetitionRun();
      const buckets = bucketCompetitorsByType(run.competitors);
      const { qualified } = filterDirectSet(buckets);

      // Disruptive Advertising has strong signals (businessModelMatch + sameMarket + serviceOverlap)
      const disruptive = qualified.find((c) => c.name === 'Disruptive Advertising');
      expect(disruptive).toBeDefined();
    });

    it('should NOT include partial competitors with weak signals', () => {
      const run = createNoisyCompetitionRun();
      const buckets = bucketCompetitorsByType(run.competitors);
      const { qualified } = filterDirectSet(buckets);

      // Cleverly has weak signals (no businessModelMatch, no sameMarket)
      const cleverly = qualified.find((c) => c.name === 'Cleverly');
      expect(cleverly).toBeUndefined();
    });

    it('should cap to PRIMARY_CAP (5) competitors', () => {
      const run = createNoisyCompetitionRun();
      const buckets = bucketCompetitorsByType(run.competitors);
      const { qualified } = filterDirectSet(buckets);

      expect(qualified.length).toBeLessThanOrEqual(QUALITY_THRESHOLDS.PRIMARY_CAP);
    });

    it('should sort by threat score descending', () => {
      const run = createNoisyCompetitionRun();
      const buckets = bucketCompetitorsByType(run.competitors);
      const { qualified } = filterDirectSet(buckets);

      // Check sorted order
      for (let i = 1; i < qualified.length; i++) {
        const prevThreat = qualified[i - 1].scores?.threatScore ?? 0;
        const currThreat = qualified[i].scores?.threatScore ?? 0;
        expect(prevThreat).toBeGreaterThanOrEqual(currThreat);
      }
    });
  });

  describe('buildMarketAlternativesSet', () => {
    it('should include platforms with type labels', () => {
      const run = createNoisyCompetitionRun();
      const buckets = bucketCompetitorsByType(run.competitors);
      const { alternatives } = buildMarketAlternativesSet(buckets);

      const trello = alternatives.find((a) => a.name === 'Trello');
      expect(trello).toBeDefined();
      expect(trello?.type).toBe('Platform/Tool');
    });

    it('should include fractional with type labels', () => {
      const run = createNoisyCompetitionRun();
      const buckets = bucketCompetitorsByType(run.competitors);
      const { alternatives } = buildMarketAlternativesSet(buckets);

      const cmo = alternatives.find((a) => a.name === 'CMO on Demand');
      expect(cmo).toBeDefined();
      expect(cmo?.type).toBe('Fractional Executive');
    });

    it('should include internal with type labels', () => {
      const run = createNoisyCompetitionRun();
      const buckets = bucketCompetitorsByType(run.competitors);
      const { alternatives } = buildMarketAlternativesSet(buckets);

      const internal = alternatives.find((a) => a.name === 'In-House Marketing Team');
      expect(internal).toBeDefined();
      expect(internal?.type).toBe('Internal Alternative');
    });

    it('should cap to ALTERNATIVES_CAP (5)', () => {
      const run = createNoisyCompetitionRun();
      const buckets = bucketCompetitorsByType(run.competitors);
      const { alternatives } = buildMarketAlternativesSet(buckets);

      expect(alternatives.length).toBeLessThanOrEqual(QUALITY_THRESHOLDS.ALTERNATIVES_CAP);
    });
  });
});

describe('Competition V4: buildCompetitionCandidates', () => {
  describe('primaryCompetitors field', () => {
    it('should NEVER include platform competitors', () => {
      const run = createNoisyCompetitionRun();
      const result = buildCompetitionCandidates(run, run.runId);

      const primaryField = result.candidates.find((c) => c.key === 'competition.primaryCompetitors');
      expect(primaryField).toBeDefined();

      const primaryCompetitors = primaryField?.value as Array<{ name: string }>;
      const platformNames = ['Trello', 'Monday.com', 'Slack'];

      for (const platformName of platformNames) {
        const found = primaryCompetitors.find((c) => c.name === platformName);
        expect(found).toBeUndefined();
      }
    });

    it('should NEVER include fractional competitors', () => {
      const run = createNoisyCompetitionRun();
      const result = buildCompetitionCandidates(run, run.runId);

      const primaryField = result.candidates.find((c) => c.key === 'competition.primaryCompetitors');
      const primaryCompetitors = primaryField?.value as Array<{ name: string }>;
      const fractionalNames = ['CMO on Demand', 'Zylo Fractional'];

      for (const fractionalName of fractionalNames) {
        const found = primaryCompetitors.find((c) => c.name === fractionalName);
        expect(found).toBeUndefined();
      }
    });

    it('should NEVER include internal alternatives', () => {
      const run = createNoisyCompetitionRun();
      const result = buildCompetitionCandidates(run, run.runId);

      const primaryField = result.candidates.find((c) => c.key === 'competition.primaryCompetitors');
      const primaryCompetitors = primaryField?.value as Array<{ name: string }>;

      const internal = primaryCompetitors.find((c) => c.name === 'In-House Marketing Team');
      expect(internal).toBeUndefined();
    });

    it('should include qualified direct competitors', () => {
      const run = createNoisyCompetitionRun();
      const result = buildCompetitionCandidates(run, run.runId);

      const primaryField = result.candidates.find((c) => c.key === 'competition.primaryCompetitors');
      const primaryCompetitors = primaryField?.value as Array<{ name: string }>;

      // Acme Agency and Beta Marketing should be included
      expect(primaryCompetitors.find((c) => c.name === 'Acme Agency')).toBeDefined();
      expect(primaryCompetitors.find((c) => c.name === 'Beta Marketing')).toBeDefined();
    });

    it('should EXCLUDE low-score direct competitors', () => {
      const run = createNoisyCompetitionRun();
      const result = buildCompetitionCandidates(run, run.runId);

      const primaryField = result.candidates.find((c) => c.key === 'competition.primaryCompetitors');
      const primaryCompetitors = primaryField?.value as Array<{ name: string }>;

      // Weak Direct Co should be excluded (threatScore 15, relevanceScore 18)
      const weakDirect = primaryCompetitors.find((c) => c.name === 'Weak Direct Co');
      expect(weakDirect).toBeUndefined();
    });

    it('should be slide-worthy (max 5 competitors)', () => {
      const run = createNoisyCompetitionRun();
      const result = buildCompetitionCandidates(run, run.runId);

      const primaryField = result.candidates.find((c) => c.key === 'competition.primaryCompetitors');
      const primaryCompetitors = primaryField?.value as Array<{ name: string }>;

      expect(primaryCompetitors.length).toBeLessThanOrEqual(5);
    });
  });

  describe('marketAlternatives field', () => {
    it('should contain platforms with type labels', () => {
      const run = createNoisyCompetitionRun();
      const result = buildCompetitionCandidates(run, run.runId);

      const altField = result.candidates.find((c) => c.key === 'competition.marketAlternatives');
      expect(altField).toBeDefined();

      const alternatives = altField?.value as Array<{ name: string; type: string }>;
      const trello = alternatives.find((a) => a.name === 'Trello');
      expect(trello?.type).toBe('Platform/Tool');
    });

    it('should contain fractional with type labels', () => {
      const run = createNoisyCompetitionRun();
      const result = buildCompetitionCandidates(run, run.runId);

      const altField = result.candidates.find((c) => c.key === 'competition.marketAlternatives');
      const alternatives = altField?.value as Array<{ name: string; type: string }>;

      const cmo = alternatives.find((a) => a.name === 'CMO on Demand');
      expect(cmo?.type).toBe('Fractional Executive');
    });
  });

  describe('threatSummary field', () => {
    it('should ONLY reference direct competitors, NEVER platforms/fractional', () => {
      const run = createNoisyCompetitionRun();
      const result = buildCompetitionCandidates(run, run.runId);

      const threatField = result.candidates.find((c) => c.key === 'competition.threatSummary');
      if (threatField) {
        const summary = threatField.value as string;

        // Should NOT mention platforms or fractional
        expect(summary).not.toContain('Trello');
        expect(summary).not.toContain('Monday');
        expect(summary).not.toContain('Slack');
        expect(summary).not.toContain('CMO on Demand');
        expect(summary).not.toContain('Zylo');
        expect(summary).not.toContain('In-House');

        // Should mention direct competitors
        expect(summary).toContain('Acme Agency');
      }
    });
  });

  describe('positioningMapSummary field', () => {
    it('should ONLY reference direct/partial competitors, NEVER platforms/fractional', () => {
      const run = createNoisyCompetitionRun();
      const result = buildCompetitionCandidates(run, run.runId);

      const posField = result.candidates.find((c) => c.key === 'competition.positioningMapSummary');
      if (posField) {
        const summary = posField.value as string;

        // Should NOT mention platforms or fractional
        expect(summary).not.toContain('Trello');
        expect(summary).not.toContain('Monday');
        expect(summary).not.toContain('Slack');
        expect(summary).not.toContain('CMO on Demand');
        expect(summary).not.toContain('Zylo');
      }
    });
  });

  describe('filteringStats', () => {
    it('should include bucket counts', () => {
      const run = createNoisyCompetitionRun();
      const result = buildCompetitionCandidates(run, run.runId);

      expect(result.filteringStats).toBeDefined();
      expect(result.filteringStats?.bucketCounts.direct).toBe(3);
      expect(result.filteringStats?.bucketCounts.platform).toBe(3);
      expect(result.filteringStats?.bucketCounts.fractional).toBe(2);
    });

    it('should include excluded competitors with reasons', () => {
      const run = createNoisyCompetitionRun();
      const result = buildCompetitionCandidates(run, run.runId);

      expect(result.filteringStats?.excluded).toBeDefined();
      expect(result.filteringStats?.excluded.length).toBeGreaterThan(0);

      // Weak Direct Co should be excluded with reason
      const weakExclusion = result.filteringStats?.excluded.find((e) => e.name === 'Weak Direct Co');
      expect(weakExclusion).toBeDefined();
      expect(weakExclusion?.reason).toMatch(/LOW_THREAT_SCORE|LOW_RELEVANCE_SCORE/);
    });

    it('should include quality thresholds used', () => {
      const run = createNoisyCompetitionRun();
      const result = buildCompetitionCandidates(run, run.runId);

      expect(result.filteringStats?.thresholds.minThreatScore).toBe(25);
      expect(result.filteringStats?.thresholds.minRelevanceScore).toBe(20);
      expect(result.filteringStats?.thresholds.primaryCap).toBe(5);
    });
  });
});

describe('Competition V4: Quality Thresholds', () => {
  it('should have correct threshold values', () => {
    expect(QUALITY_THRESHOLDS.MIN_THREAT_SCORE).toBe(25);
    expect(QUALITY_THRESHOLDS.MIN_RELEVANCE_SCORE).toBe(20);
    expect(QUALITY_THRESHOLDS.MIN_OFFER_OVERLAP_SCORE).toBe(0.2);
    expect(QUALITY_THRESHOLDS.MIN_JTBD_MATCHES).toBe(1);
    expect(QUALITY_THRESHOLDS.PRIMARY_CAP).toBe(5);
    expect(QUALITY_THRESHOLDS.ALTERNATIVES_CAP).toBe(5);
  });

  it('qualifiesAsDirectViaSignals should require businessModelMatch AND sameMarket', () => {
    const { qualifiesAsDirectViaSignals } = _testing;

    // Missing sameMarket - should not qualify
    const noSameMarket = createCompetitor({
      name: 'Test',
      classification: {
        type: 'partial',
        confidence: 0.8,
        reasoning: 'Test',
        signals: {
          businessModelMatch: true,
          icpOverlap: true,
          serviceOverlap: true,
          sameMarket: false, // Missing
          isPlatform: false,
          isFractional: false,
          isInternalAlt: false,
        },
      },
    });
    expect(qualifiesAsDirectViaSignals(noSameMarket)).toBe(false);

    // Missing businessModelMatch - should not qualify
    const noBusinessModel = createCompetitor({
      name: 'Test2',
      classification: {
        type: 'partial',
        confidence: 0.8,
        reasoning: 'Test',
        signals: {
          businessModelMatch: false, // Missing
          icpOverlap: true,
          serviceOverlap: true,
          sameMarket: true,
          isPlatform: false,
          isFractional: false,
          isInternalAlt: false,
        },
      },
    });
    expect(qualifiesAsDirectViaSignals(noBusinessModel)).toBe(false);

    // Has both + serviceOverlap - should qualify
    const qualifies = createCompetitor({
      name: 'Test3',
      classification: {
        type: 'partial',
        confidence: 0.8,
        reasoning: 'Test',
        signals: {
          businessModelMatch: true,
          icpOverlap: true,
          serviceOverlap: true,
          sameMarket: true,
          isPlatform: false,
          isFractional: false,
          isInternalAlt: false,
        },
      },
    });
    expect(qualifiesAsDirectViaSignals(qualifies)).toBe(true);
  });

  it('meetsQualityThreshold should pass with high threat OR high relevance', () => {
    const { meetsQualityThreshold } = _testing;

    // High threat, low relevance - should pass
    const highThreat = createCompetitor({
      name: 'HighThreat',
      scores: {
        icpFit: 50,
        businessModelFit: 50,
        serviceOverlap: 50,
        valueModelFit: 50,
        icpStageMatch: 50,
        aiOrientation: 50,
        geographyFit: 50,
        threatScore: 30, // Above 25
        relevanceScore: 15, // Below 20
      },
    });
    expect(meetsQualityThreshold(highThreat)).toBe(true);

    // Low threat, high relevance - should pass
    const highRelevance = createCompetitor({
      name: 'HighRelevance',
      scores: {
        icpFit: 50,
        businessModelFit: 50,
        serviceOverlap: 50,
        valueModelFit: 50,
        icpStageMatch: 50,
        aiOrientation: 50,
        geographyFit: 50,
        threatScore: 20, // Below 25
        relevanceScore: 25, // Above 20
      },
    });
    expect(meetsQualityThreshold(highRelevance)).toBe(true);

    // Both below threshold - should fail
    const lowBoth = createCompetitor({
      name: 'LowBoth',
      scores: {
        icpFit: 50,
        businessModelFit: 50,
        serviceOverlap: 50,
        valueModelFit: 50,
        icpStageMatch: 50,
        aiOrientation: 50,
        geographyFit: 50,
        threatScore: 20, // Below 25
        relevanceScore: 15, // Below 20
      },
    });
    expect(meetsQualityThreshold(lowBoth)).toBe(false);
  });
});

describe('Competition V4: LOW_CONFIDENCE_CONTEXT Error Handling', () => {
  it('should detect LOW_CONFIDENCE_CONTEXT from errorInfo', () => {
    const run: CompetitionRunV3Payload = {
      runId: 'low-confidence-run',
      companyId: 'test-company',
      status: 'completed',
      createdAt: '2024-01-15T10:00:00Z',
      completedAt: '2024-01-15T10:30:00Z',
      competitors: [],
      insights: [],
      recommendations: [],
      summary: {
        totalCandidates: 0,
        totalCompetitors: 0,
        byType: { direct: 0, partial: 0, fractional: 0, platform: 0, internal: 0 },
        avgThreatScore: 0,
        quadrantDistribution: {},
      },
      error: 'Insufficient context',
      errorInfo: {
        type: 'LOW_CONFIDENCE_CONTEXT',
        message: 'Confidence too low (35% < 50% threshold)',
        debug: {
          confidence: 0.35,
          inferredCategory: 'unknown',
          missingFields: ['companyDescription', 'primaryOffers', 'icpDescription'],
          warnings: ['Missing website URL - cannot verify business type'],
        },
      },
    };

    const result = buildCompetitionCandidates(run, run.runId);

    expect(result.errorState?.isError).toBe(true);
    expect(result.errorState?.errorType).toBe('LOW_CONFIDENCE_CONTEXT');
    expect(result.errorState?.errorMessage).toContain('Confidence');
    expect(result.errorState?.confidenceDebug?.confidence).toBe(0.35);
    expect(result.errorState?.confidenceDebug?.missingFields).toContain('companyDescription');
    expect(result.errorState?.confidenceDebug?.inferredCategory).toBe('unknown');
  });

  it('should return empty candidates for LOW_CONFIDENCE_CONTEXT error', () => {
    const run: CompetitionRunV3Payload = {
      runId: 'low-confidence-run-2',
      companyId: 'test-company',
      status: 'completed',
      createdAt: '2024-01-15T10:00:00Z',
      completedAt: '2024-01-15T10:30:00Z',
      competitors: [],
      insights: [],
      recommendations: [],
      summary: {
        totalCandidates: 0,
        totalCompetitors: 0,
        byType: { direct: 0, partial: 0, fractional: 0, platform: 0, internal: 0 },
        avgThreatScore: 0,
        quadrantDistribution: {},
      },
      error: 'Low confidence',
      errorInfo: {
        type: 'LOW_CONFIDENCE_CONTEXT',
        message: 'Cannot determine business category with sufficient confidence',
        debug: {
          confidence: 0.42,
          inferredCategory: 'unknown',
          missingFields: ['websiteUrl', 'companyDescription'],
          warnings: ['Missing website URL'],
        },
      },
    };

    const result = buildCompetitionCandidates(run, run.runId);

    // Should have no candidates when in error state
    expect(result.candidates.length).toBe(0);
    expect(result.extractionFailureReason).toBeDefined();
  });

  it('should detect LOW_CONFIDENCE_CONTEXT from legacy error string', () => {
    const run: CompetitionRunV3Payload = {
      runId: 'legacy-low-confidence',
      companyId: 'test-company',
      status: 'completed',
      createdAt: '2024-01-15T10:00:00Z',
      completedAt: '2024-01-15T10:30:00Z',
      competitors: [],
      insights: [],
      recommendations: [],
      summary: {
        totalCandidates: 0,
        totalCompetitors: 0,
        byType: { direct: 0, partial: 0, fractional: 0, platform: 0, internal: 0 },
        avgThreatScore: 0,
        quadrantDistribution: {},
      },
      error: 'Confidence too low (30% < 50% threshold)',
    };

    const result = buildCompetitionCandidates(run, run.runId);

    expect(result.errorState?.isError).toBe(true);
    expect(result.errorState?.errorType).toBe('LOW_CONFIDENCE_CONTEXT');
    expect(result.errorState?.errorMessage).toContain('Confidence');
  });

  it('should NOT flag as error when confidence is sufficient', () => {
    const run = createNoisyCompetitionRun();
    // This run has valid competitors, so should NOT be an error
    const result = buildCompetitionCandidates(run, run.runId);

    expect(result.errorState?.isError).not.toBe(true);
    expect(result.errorState?.errorType).toBeUndefined();
  });

  it('should include debug info for LOW_CONFIDENCE_CONTEXT', () => {
    const run: CompetitionRunV3Payload = {
      runId: 'debug-info-run',
      companyId: 'test-company',
      status: 'completed',
      createdAt: '2024-01-15T10:00:00Z',
      completedAt: '2024-01-15T10:30:00Z',
      competitors: [],
      insights: [],
      recommendations: [],
      summary: {
        totalCandidates: 0,
        totalCompetitors: 0,
        byType: { direct: 0, partial: 0, fractional: 0, platform: 0, internal: 0 },
        avgThreatScore: 0,
        quadrantDistribution: {},
      },
      error: null,
      errorInfo: {
        type: 'LOW_CONFIDENCE_CONTEXT',
        message: 'Missing website URL',
        debug: {
          confidence: 0.25,
          inferredCategory: 'unknown',
          missingFields: ['websiteUrl', 'companyDescription', 'primaryOffers'],
          warnings: ['Missing website URL - cannot verify business type', 'No primary offers/services identified'],
        },
      },
    };

    const result = buildCompetitionCandidates(run, run.runId);

    // Debug should have sample paths and root top keys
    expect(result.debug).toBeDefined();
    expect(result.debug?.rootTopKeys).toContain('errorInfo');
    expect(result.debug?.competitorCount).toBe(0);
  });
});

describe('Competition V4: Edge Cases', () => {
  it('should handle run with only platforms (no primary competitors)', () => {
    const run: CompetitionRunV3Payload = {
      runId: 'platforms-only',
      companyId: 'test',
      status: 'completed',
      createdAt: '2024-01-15T10:00:00Z',
      completedAt: '2024-01-15T10:30:00Z',
      competitors: [
        createCompetitor({
          name: 'Trello',
          classification: {
            type: 'platform',
            confidence: 0.9,
            reasoning: 'Platform',
            signals: {
              businessModelMatch: false,
              icpOverlap: true,
              serviceOverlap: false,
              sameMarket: false,
              isPlatform: true,
              isFractional: false,
              isInternalAlt: false,
            },
          },
        }),
      ],
      insights: [],
      recommendations: [],
      summary: {
        totalCandidates: 1,
        totalCompetitors: 1,
        byType: { direct: 0, partial: 0, fractional: 0, platform: 1, internal: 0 },
        avgThreatScore: 30,
        quadrantDistribution: {},
      },
      error: null,
    };

    const result = buildCompetitionCandidates(run, run.runId);

    // primaryCompetitors should be empty or not present
    const primaryField = result.candidates.find((c) => c.key === 'competition.primaryCompetitors');
    if (primaryField) {
      const primaryCompetitors = primaryField.value as Array<{ name: string }>;
      expect(primaryCompetitors.length).toBe(0);
    }

    // marketAlternatives should contain Trello
    const altField = result.candidates.find((c) => c.key === 'competition.marketAlternatives');
    expect(altField).toBeDefined();
    const alternatives = altField?.value as Array<{ name: string; type: string }>;
    expect(alternatives.find((a) => a.name === 'Trello')).toBeDefined();
  });

  it('should handle run with empty competitors', () => {
    const run: CompetitionRunV3Payload = {
      runId: 'empty-run',
      companyId: 'test',
      status: 'completed',
      createdAt: '2024-01-15T10:00:00Z',
      completedAt: '2024-01-15T10:30:00Z',
      competitors: [],
      insights: [],
      recommendations: [],
      summary: {
        totalCandidates: 0,
        totalCompetitors: 0,
        byType: { direct: 0, partial: 0, fractional: 0, platform: 0, internal: 0 },
        avgThreatScore: 0,
        quadrantDistribution: {},
      },
      error: null,
    };

    const result = buildCompetitionCandidates(run, run.runId);

    // Should have error state
    expect(result.errorState?.isError).toBe(true);
    expect(result.errorState?.errorType).toBe('NO_COMPETITORS');
  });

  it('should handle null run', () => {
    const result = buildCompetitionCandidates(null, 'test');

    expect(result.errorState?.isError).toBe(true);
    expect(result.extractionFailureReason).toContain('null');
  });
});
