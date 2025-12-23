// tests/context/v4-competition-integration.test.ts
// Integration Tests for Competition V4
//
// Tests for:
// - Required strategy fields (competition.primaryCompetitors as alternative)
// - Strategy inputs adapter (V4 → legacy mapping)
// - Inspect endpoint (competition lab info)

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Required Strategy Fields Tests
// ============================================================================

describe('Competition V4: Required Strategy Fields', () => {
  it('should include competition.primaryCompetitors as alternative for competitive.competitors', async () => {
    const { V4_REQUIRED_STRATEGY_FIELDS } = await import(
      '@/lib/contextGraph/v4/requiredStrategyFields'
    );

    // Find the competitive.competitors field
    const competitiveField = V4_REQUIRED_STRATEGY_FIELDS.find(
      (f) => f.path === 'competitive.competitors'
    );

    expect(competitiveField).toBeDefined();
    expect(competitiveField?.alternatives).toBeDefined();
    expect(competitiveField?.alternatives).toContain('competition.primaryCompetitors');
  });

  it('should satisfy competitive requirement with competition.primaryCompetitors', async () => {
    const { isFieldSatisfied, V4_REQUIRED_STRATEGY_FIELDS } = await import(
      '@/lib/contextGraph/v4/requiredStrategyFields'
    );

    const competitiveField = V4_REQUIRED_STRATEGY_FIELDS.find(
      (f) => f.path === 'competitive.competitors'
    )!;

    // Empty sets - not satisfied
    const result1 = isFieldSatisfied(competitiveField, new Set(), new Set());
    expect(result1.satisfied).toBe(false);

    // Legacy path satisfied - confirmed
    const result2 = isFieldSatisfied(
      competitiveField,
      new Set(['competitive.competitors']),
      new Set()
    );
    expect(result2.satisfied).toBe(true);
    expect(result2.by).toBe('confirmed');

    // V4 path satisfied - confirmed
    const result3 = isFieldSatisfied(
      competitiveField,
      new Set(['competition.primaryCompetitors']),
      new Set()
    );
    expect(result3.satisfied).toBe(true);
    expect(result3.by).toBe('confirmed');

    // V4 path satisfied - proposed
    const result4 = isFieldSatisfied(
      competitiveField,
      new Set(),
      new Set(['competition.primaryCompetitors'])
    );
    expect(result4.satisfied).toBe(true);
    expect(result4.by).toBe('proposed');
  });

  it('should handle cross-domain alternatives correctly', async () => {
    const { getAllRequiredPaths } = await import(
      '@/lib/contextGraph/v4/requiredStrategyFields'
    );

    const allPaths = getAllRequiredPaths();

    // Should include both legacy and V4 paths
    expect(allPaths.has('competitive.competitors')).toBe(true);
    expect(allPaths.has('competition.primaryCompetitors')).toBe(true);
  });
});

// ============================================================================
// Decision Impact Tests
// ============================================================================

describe('Competition V4: Decision Impact', () => {
  it('should assign HIGH impact to primary competition fields', async () => {
    const { inferDecisionImpact } = await import('@/lib/contextGraph/v4/convergence');

    expect(inferDecisionImpact('competition.primaryCompetitors', [])).toBe('HIGH');
    expect(inferDecisionImpact('competition.positioningMapSummary', '')).toBe('HIGH');
    expect(inferDecisionImpact('competition.threatSummary', '')).toBe('HIGH');
  });

  it('should assign MEDIUM impact to secondary competition fields', async () => {
    const { inferDecisionImpact } = await import('@/lib/contextGraph/v4/convergence');

    expect(inferDecisionImpact('competition.marketAlternatives', [])).toBe('MEDIUM');
    expect(inferDecisionImpact('competition.differentiationAxes', [])).toBe('MEDIUM');
  });

  it('should group competition fields under competition domain', async () => {
    const { getDomainGroup } = await import('@/lib/contextGraph/v4/convergence');

    // getDomainGroup returns capitalized domain names for display
    expect(getDomainGroup('competition.primaryCompetitors')).toBe('Competition');
    expect(getDomainGroup('competition.marketAlternatives')).toBe('Competition');
    expect(getDomainGroup('competitive.competitors')).toBe('Competitive');
  });
});

// ============================================================================
// SRM Field Labels Tests
// ============================================================================

describe('Competition V4: SRM Field Labels', () => {
  it('should have label for competition.primaryCompetitors', async () => {
    const { SRM_FIELD_LABELS } = await import('@/lib/contextGraph/readiness/strategyReady');

    expect(SRM_FIELD_LABELS['competition.primaryCompetitors']).toBe('Competitors');
    expect(SRM_FIELD_LABELS['competitive.competitors']).toBe('Competitors');
  });
});

// ============================================================================
// Feature Flag Tests
// ============================================================================

describe('Competition V4: Feature Flags', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should respect CONTEXT_V4_INGEST_COMPETITIONLAB env var', async () => {
    // Mock environment
    vi.stubEnv('CONTEXT_V4_ENABLED', 'true');
    vi.stubEnv('CONTEXT_V4_INGEST_COMPETITIONLAB', 'true');

    const { isContextV4IngestCompetitionLabEnabled } = await import(
      '@/lib/types/contextField'
    );

    expect(isContextV4IngestCompetitionLabEnabled()).toBe(true);

    vi.unstubAllEnvs();
  });

  it('should return false when CONTEXT_V4_ENABLED is false', async () => {
    vi.stubEnv('CONTEXT_V4_ENABLED', 'false');
    vi.stubEnv('CONTEXT_V4_INGEST_COMPETITIONLAB', 'true');

    const { isContextV4IngestCompetitionLabEnabled } = await import(
      '@/lib/types/contextField'
    );

    expect(isContextV4IngestCompetitionLabEnabled()).toBe(false);

    vi.unstubAllEnvs();
  });
});

// ============================================================================
// Candidate Extraction Tests (from competitionCandidates.ts)
// ============================================================================

describe('Competition V4: Candidate Keys', () => {
  it('should produce all expected candidate keys', async () => {
    const { buildCompetitionCandidates } = await import(
      '@/lib/contextGraph/v4/competitionCandidates'
    );

    // Create a minimal mock V3 run (CompetitionRunV3Payload)
    const mockRun = {
      runId: 'run-123',
      companyId: 'company-456',
      status: 'completed' as const,
      createdAt: '2024-01-15T10:00:00Z',
      completedAt: '2024-01-15T10:30:00Z',
      competitors: [
        {
          id: 'comp-1',
          runId: 'run-123',
          name: 'Competitor One',
          domain: 'competitor-one.com',
          homepageUrl: 'https://competitor-one.com',
          logoUrl: null,
          summary: 'A direct competitor in marketing automation',
          classification: {
            type: 'direct' as const,
            confidence: 0.85,
            reasoning: 'Same business model and ICP',
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
            businessModelFit: 75,
            serviceOverlap: 85,
            valueModelFit: 70,
            icpStageMatch: 80,
            aiOrientation: 60,
            geographyFit: 90,
            threatScore: 75,
            relevanceScore: 80,
          },
          positioning: {
            x: 50,
            y: 60,
            quadrant: 'direct-threat' as const,
            bubbleSize: 'medium' as const,
            clusterGroup: 'cluster-1',
          },
          metadata: {
            teamSize: 'medium' as const,
            teamSizeEstimate: 50,
            foundedYear: 2015,
            headquarters: 'San Francisco',
            serviceRegions: ['US'],
            techStack: ['React', 'Node.js'],
            hasAICapabilities: true,
            hasAutomation: true,
            pricingTier: 'mid' as const,
            businessModel: 'saas' as const,
            serviceModel: 'subscription' as const,
          },
          discovery: {
            source: 'google_search' as const,
            sourceUrl: 'https://google.com/search?q=...',
            frequency: 3,
            directoryRating: 4.5,
            directoryReviews: 120,
          },
          analysis: {
            strengths: ['Strong market presence', 'Good UI'],
            weaknesses: ['Limited integrations'],
            whyCompetitor: 'Direct overlap in target market',
            differentiators: ['AI-powered automation'],
            opportunities: ['Enterprise segment'],
          },
        },
      ],
      insights: [
        {
          id: 'insight-1',
          category: 'threat' as const,
          title: 'Rising direct competition',
          description: 'Multiple direct competitors entering the market',
          evidence: ['New funding announcements'],
          competitors: ['comp-1'],
          severity: 'high' as const,
        },
      ],
      recommendations: [
        {
          id: 'rec-1',
          priority: 1,
          type: 'differentiation' as const,
          title: 'Strengthen AI positioning',
          description: 'Double down on AI capabilities',
          actions: ['Launch AI feature'],
          targetCompetitors: ['comp-1'],
          expectedOutcome: 'Increased differentiation',
        },
      ],
      summary: {
        totalCandidates: 5,
        totalCompetitors: 1,
        byType: {
          direct: 1,
          partial: 0,
          fractional: 0,
          platform: 0,
          internal: 0,
        },
        avgThreatScore: 75,
        quadrantDistribution: {
          'direct-threat': 1,
        },
      },
      error: null,
    };

    const result = buildCompetitionCandidates(mockRun, mockRun.runId);

    // Should produce candidates
    expect(result.candidates.length).toBeGreaterThan(0);

    // Check expected keys are present
    const keys = result.candidates.map((c) => c.key);
    expect(keys).toContain('competition.primaryCompetitors');
    expect(keys).toContain('competition.positioningMapSummary');
    expect(keys).toContain('competition.threatSummary');

    // All candidates should have evidence
    for (const candidate of result.candidates) {
      expect(candidate.evidence).toBeDefined();
      expect(candidate.evidence?.rawPath).toBeDefined();
    }
  });
});
