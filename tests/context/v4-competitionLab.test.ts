// tests/context/v4-competitionLab.test.ts
// Competition Lab V4 Integration Tests
//
// Tests for the Competition Lab → Context V4 proposal flow.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildCompetitionCandidates,
  detectCompetitionErrorState,
  type BuildCompetitionCandidatesResult,
} from '@/lib/contextGraph/v4/competitionCandidates';
import type { CompetitionRun, ScoredCompetitor } from '@/lib/competition/types';

// ============================================================================
// Mock Data
// ============================================================================

const createMockCompetitor = (overrides: Partial<ScoredCompetitor> = {}): ScoredCompetitor => ({
  id: 'comp-1',
  competitorName: 'Competitor One',
  competitorDomain: 'competitor-one.com',
  homepageUrl: 'https://competitor-one.com',
  shortSummary: 'A leading competitor in the space',
  geo: 'US',
  priceTier: 'mid',
  role: 'core',
  overallScore: 75,
  offerSimilarity: 80,
  audienceSimilarity: 70,
  geoOverlap: 90,
  priceTierOverlap: 85,
  compositeScore: 75,
  brandScale: 'mid_market',
  enrichedData: {
    companyType: 'saas',
    category: 'marketing automation',
    summary: 'Marketing automation platform',
    tagline: 'Automate your marketing',
    targetAudience: 'B2B SaaS companies',
    icpDescription: 'Mid-market B2B SaaS companies',
    companySizeTarget: 'SMB',
    geographicFocus: 'US',
    headquartersLocation: 'San Francisco',
    serviceAreas: ['US', 'Europe'],
    primaryOffers: ['Email automation', 'Lead scoring'],
    uniqueFeatures: ['AI-powered insights'],
    pricingTier: 'mid',
    pricingModel: 'subscription',
    estimatedPriceRange: '$500-2000/mo',
    brandScale: 'mid_market',
    estimatedEmployees: 150,
    foundedYear: 2015,
    positioning: 'The easiest marketing automation for growing teams',
    valueProposition: 'Save 10 hours per week on marketing tasks',
    differentiators: ['AI-powered', 'Easy to use', 'Affordable'],
    weaknesses: ['Limited integrations'],
    primaryChannels: ['LinkedIn', 'Content marketing'],
    socialProof: {
      testimonials: ['Great product!'],
      caseStudyCount: 5,
      g2Rating: 4.5,
      gartnerMention: false,
    },
    rawExtract: {},
  },
  provenance: {
    discoveredBy: 'serp',
    discoveredAt: '2024-01-15T10:00:00Z',
    searchQuery: 'marketing automation',
    humanOverrideAt: null,
    humanOverrideReason: null,
    humanOverrideBy: null,
  },
  source: 'serp',
  sourceNote: null,
  removedByUser: false,
  promotedByUser: false,
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: null,
  xPosition: 50,
  yPosition: 50,
  whyThisCompetitorMatters: 'Strong overlap in target market and pricing',
  howTheyDiffer: 'More focus on enterprise features and integrations',
  threatLevel: 65,
  threatDrivers: ['market_overlap', 'pricing_pressure'],
  ...overrides,
});

const createMockCompetitionRun = (overrides: Partial<CompetitionRun> = {}): CompetitionRun => ({
  id: 'run-123',
  companyId: 'company-456',
  status: 'completed',
  startedAt: '2024-01-15T10:00:00Z',
  completedAt: '2024-01-15T10:30:00Z',
  updatedAt: '2024-01-15T10:30:00Z',
  steps: [],
  contextSnapshotId: null,
  querySet: {
    brandQueries: [],
    categoryQueries: [],
    geoQueries: [],
    marketplaceQueries: [],
  },
  querySummary: {
    queriesGenerated: ['marketing automation software'],
    sourcesUsed: ['serp', 'ai_simulation'],
  },
  modelVersion: 'v2',
  competitors: [
    createMockCompetitor({ id: 'comp-1', competitorName: 'Competitor One', role: 'core', threatLevel: 65 }),
    createMockCompetitor({ id: 'comp-2', competitorName: 'Competitor Two', role: 'secondary', threatLevel: 45 }),
    createMockCompetitor({ id: 'comp-3', competitorName: 'Alternative Corp', role: 'alternative', threatLevel: 30 }),
  ],
  discoveredCandidates: [],
  stats: {
    candidatesDiscovered: 10,
    candidatesEnriched: 8,
    candidatesScored: 5,
    coreCount: 1,
    secondaryCount: 1,
    alternativeCount: 1,
  },
  candidatesDiscovered: 10,
  candidatesEnriched: 8,
  candidatesScored: 5,
  dataConfidenceScore: 75,
  errors: [],
  errorMessage: null,
  ...overrides,
});

// ============================================================================
// Tests: Error State Detection
// ============================================================================

describe('Competition Lab V4: Error State Detection', () => {
  it('should detect null run as error', () => {
    const result = detectCompetitionErrorState(null);
    expect(result.isError).toBe(true);
    expect(result.errorType).toBe('UNKNOWN_ERROR');
  });

  it('should detect failed status', () => {
    const run = createMockCompetitionRun({ status: 'failed', errorMessage: 'API error' });
    const result = detectCompetitionErrorState(run);
    expect(result.isError).toBe(true);
    expect(result.errorType).toBe('FAILED');
    expect(result.errorMessage).toContain('API error');
  });

  it('should detect pending status as incomplete', () => {
    const run = createMockCompetitionRun({ status: 'pending' });
    const result = detectCompetitionErrorState(run);
    expect(result.isError).toBe(true);
    expect(result.errorType).toBe('INCOMPLETE');
  });

  it('should detect discovering status as incomplete', () => {
    const run = createMockCompetitionRun({ status: 'discovering' });
    const result = detectCompetitionErrorState(run);
    expect(result.isError).toBe(true);
    expect(result.errorType).toBe('INCOMPLETE');
  });

  it('should detect no competitors as error', () => {
    const run = createMockCompetitionRun({ competitors: [] });
    const result = detectCompetitionErrorState(run);
    expect(result.isError).toBe(true);
    expect(result.errorType).toBe('NO_COMPETITORS');
  });

  it('should not error for completed run with competitors', () => {
    const run = createMockCompetitionRun();
    const result = detectCompetitionErrorState(run);
    expect(result.isError).toBe(false);
  });

  it('should count only active competitors (not removed)', () => {
    const run = createMockCompetitionRun({
      competitors: [
        createMockCompetitor({ removedByUser: true }),
        createMockCompetitor({ removedByUser: true }),
      ],
    });
    const result = detectCompetitionErrorState(run);
    expect(result.isError).toBe(true);
    expect(result.errorType).toBe('NO_COMPETITORS');
  });
});

// ============================================================================
// Tests: Candidate Building
// ============================================================================

describe('Competition Lab V4: Candidate Building', () => {
  it('should return empty candidates for null run', () => {
    const result = buildCompetitionCandidates(null);
    expect(result.candidates).toHaveLength(0);
    expect(result.errorState?.isError).toBe(true);
    expect(result.extractionFailureReason).toBeDefined();
  });

  it('should extract primaryCompetitors from completed run', () => {
    const run = createMockCompetitionRun();
    const result = buildCompetitionCandidates(run);

    const primaryCompetitors = result.candidates.find(c => c.key === 'competition.primaryCompetitors');
    expect(primaryCompetitors).toBeDefined();
    expect(primaryCompetitors?.confidence).toBeGreaterThanOrEqual(0.8);

    const value = primaryCompetitors?.value as Array<{ name: string }>;
    expect(value).toHaveLength(3);
    expect(value[0].name).toBe('Competitor One');
  });

  it('should exclude removed competitors from primaryCompetitors', () => {
    const run = createMockCompetitionRun({
      competitors: [
        createMockCompetitor({ id: 'comp-1', removedByUser: false }),
        createMockCompetitor({ id: 'comp-2', removedByUser: true }),
      ],
    });
    const result = buildCompetitionCandidates(run);

    const primaryCompetitors = result.candidates.find(c => c.key === 'competition.primaryCompetitors');
    const value = primaryCompetitors?.value as Array<{ name: string }>;
    expect(value).toHaveLength(1);
  });

  it('should extract marketAlternatives from alternative-role competitors', () => {
    const run = createMockCompetitionRun();
    const result = buildCompetitionCandidates(run);

    const marketAlternatives = result.candidates.find(c => c.key === 'competition.marketAlternatives');
    expect(marketAlternatives).toBeDefined();
    expect(marketAlternatives?.confidence).toBeLessThan(0.8); // Medium confidence

    const value = marketAlternatives?.value as string[];
    expect(value).toContain('Alternative Corp');
  });

  it('should extract differentiationAxes from competitor data', () => {
    const run = createMockCompetitionRun();
    const result = buildCompetitionCandidates(run);

    const differentiationAxes = result.candidates.find(c => c.key === 'competition.differentiationAxes');
    expect(differentiationAxes).toBeDefined();

    const value = differentiationAxes?.value as string[];
    expect(value.length).toBeGreaterThan(0);
    // Should detect pricing from priceTier
    expect(value).toContain('pricing');
  });

  it('should build positioningMapSummary from competitor roles', () => {
    const run = createMockCompetitionRun();
    const result = buildCompetitionCandidates(run);

    const summary = result.candidates.find(c => c.key === 'competition.positioningMapSummary');
    expect(summary).toBeDefined();
    expect(typeof summary?.value).toBe('string');
    expect((summary?.value as string).length).toBeGreaterThan(0);
    expect((summary?.value as string)).toContain('Core competitors');
  });

  it('should build threatSummary from high-threat competitors', () => {
    const run = createMockCompetitionRun();
    const result = buildCompetitionCandidates(run);

    const threatSummary = result.candidates.find(c => c.key === 'competition.threatSummary');
    expect(threatSummary).toBeDefined();
    expect(typeof threatSummary?.value).toBe('string');
    // Should include the high-threat competitor
    expect((threatSummary?.value as string)).toContain('Competitor One');
  });

  it('should include evidence with rawPath for each candidate', () => {
    const run = createMockCompetitionRun();
    const result = buildCompetitionCandidates(run);

    for (const candidate of result.candidates) {
      expect(candidate.evidence).toBeDefined();
      expect(candidate.evidence?.rawPath).toBeDefined();
    }
  });

  it('should include runCreatedAt for each candidate', () => {
    const run = createMockCompetitionRun();
    const result = buildCompetitionCandidates(run);

    for (const candidate of result.candidates) {
      expect(candidate.runCreatedAt).toBe(run.startedAt);
    }
  });

  it('should include debug info when no candidates extracted', () => {
    const run = createMockCompetitionRun({ status: 'failed' });
    const result = buildCompetitionCandidates(run);

    expect(result.debug).toBeDefined();
    expect(result.debug?.rootTopKeys).toBeDefined();
    expect(result.debug?.competitorCount).toBeDefined();
  });
});

// ============================================================================
// Tests: Confidence Levels
// ============================================================================

describe('Competition Lab V4: Confidence Levels', () => {
  it('should assign high confidence to primaryCompetitors', () => {
    const run = createMockCompetitionRun();
    const result = buildCompetitionCandidates(run);

    const primaryCompetitors = result.candidates.find(c => c.key === 'competition.primaryCompetitors');
    expect(primaryCompetitors?.confidence).toBeGreaterThanOrEqual(0.75);
  });

  it('should assign medium confidence to marketAlternatives (inferred)', () => {
    const run = createMockCompetitionRun();
    const result = buildCompetitionCandidates(run);

    const marketAlternatives = result.candidates.find(c => c.key === 'competition.marketAlternatives');
    expect(marketAlternatives?.confidence).toBeLessThan(0.75);
    expect(marketAlternatives?.confidence).toBeGreaterThanOrEqual(0.45);
  });

  it('should assign medium-low confidence to differentiationAxes (multi-signal)', () => {
    const run = createMockCompetitionRun();
    const result = buildCompetitionCandidates(run);

    const axes = result.candidates.find(c => c.key === 'competition.differentiationAxes');
    expect(axes?.confidence).toBeLessThan(0.75);
    expect(axes?.confidence).toBeGreaterThanOrEqual(0.45);
  });

  it('should mark inferred fields in evidence', () => {
    const run = createMockCompetitionRun();
    const result = buildCompetitionCandidates(run);

    const marketAlternatives = result.candidates.find(c => c.key === 'competition.marketAlternatives');
    expect(marketAlternatives?.evidence?.isInferred).toBe(true);
  });
});

// ============================================================================
// Tests: Edge Cases
// ============================================================================

describe('Competition Lab V4: Edge Cases', () => {
  it('should handle run with only removed competitors', () => {
    const run = createMockCompetitionRun({
      competitors: [
        createMockCompetitor({ removedByUser: true }),
      ],
    });
    const result = buildCompetitionCandidates(run);

    // Should detect as error state (no active competitors)
    expect(result.errorState?.isError).toBe(true);
  });

  it('should handle run with no threat data', () => {
    const run = createMockCompetitionRun({
      competitors: [
        createMockCompetitor({ threatLevel: 0 }),
        createMockCompetitor({ threatLevel: 10 }),
      ],
    });
    const result = buildCompetitionCandidates(run);

    // threatSummary should be null/not present when no significant threats
    const threatSummary = result.candidates.find(c => c.key === 'competition.threatSummary');
    expect(threatSummary).toBeUndefined();
  });

  it('should handle run with only core competitors (no alternatives)', () => {
    const run = createMockCompetitionRun({
      competitors: [
        createMockCompetitor({ role: 'core' }),
        createMockCompetitor({ role: 'core' }),
      ],
    });
    const result = buildCompetitionCandidates(run);

    // Should still extract primary competitors
    const primaryCompetitors = result.candidates.find(c => c.key === 'competition.primaryCompetitors');
    expect(primaryCompetitors).toBeDefined();

    // marketAlternatives might be empty or based on enriched data
    const marketAlternatives = result.candidates.find(c => c.key === 'competition.marketAlternatives');
    // Either not present or empty
    if (marketAlternatives) {
      const value = marketAlternatives.value as string[];
      // Could have inferred alternatives from companyType
      expect(Array.isArray(value)).toBe(true);
    }
  });

  it('should limit market alternatives to 10 items', () => {
    const competitors = Array.from({ length: 15 }, (_, i) =>
      createMockCompetitor({
        id: `comp-${i}`,
        competitorName: `Alt ${i}`,
        role: 'alternative',
      })
    );
    const run = createMockCompetitionRun({ competitors });
    const result = buildCompetitionCandidates(run);

    const marketAlternatives = result.candidates.find(c => c.key === 'competition.marketAlternatives');
    if (marketAlternatives) {
      const value = marketAlternatives.value as string[];
      expect(value.length).toBeLessThanOrEqual(10);
    }
  });
});

// ============================================================================
// Tests: Integration with Decision Impact
// ============================================================================

describe('Competition Lab V4: Decision Impact Integration', () => {
  it('should produce candidates that will be HIGH impact', async () => {
    // Verify our keys are in HIGH_IMPACT_FIELDS
    const { inferDecisionImpact } = await import('@/lib/contextGraph/v4/convergence');

    expect(inferDecisionImpact('competition.primaryCompetitors', [])).toBe('HIGH');
    expect(inferDecisionImpact('competition.positioningMapSummary', '')).toBe('HIGH');
    expect(inferDecisionImpact('competition.threatSummary', '')).toBe('HIGH');
  });

  it('should produce candidates that will be MEDIUM impact', async () => {
    const { inferDecisionImpact } = await import('@/lib/contextGraph/v4/convergence');

    expect(inferDecisionImpact('competition.marketAlternatives', [])).toBe('MEDIUM');
    expect(inferDecisionImpact('competition.differentiationAxes', [])).toBe('MEDIUM');
  });
});
