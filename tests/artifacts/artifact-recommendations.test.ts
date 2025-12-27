// tests/artifacts/artifact-recommendations.test.ts
// Tests for artifact recommendations scoring

import { describe, it, expect } from 'vitest';
import {
  getArtifactRecommendations,
  getTopRecommendations,
  getRecommendedArtifactTypesLegacy,
  type RecommendationContext,
} from '@/lib/os/artifacts/recommendations';
import type { CompanyStrategy } from '@/lib/types/strategy';
import type { Artifact } from '@/lib/types/artifact';

// ============================================================================
// Test Helpers
// ============================================================================

function createMockStrategy(overrides: Partial<CompanyStrategy> = {}): CompanyStrategy {
  return {
    id: 'test-strategy-1',
    companyId: 'test-company-1',
    title: 'Test Strategy',
    summary: 'Test summary',
    goalStatement: 'Increase ARR by 40%',
    objectives: [
      { id: 'obj-1', text: 'Increase leads', status: 'active', metric: 'MQLs', target: '500' },
    ],
    pillars: [
      {
        id: 'pillar-1',
        title: 'ABM Focus',
        description: 'Account-based marketing',
        priority: 'high',
        status: 'active',
      },
    ],
    status: 'active',
    ...overrides,
  } as CompanyStrategy;
}

function createMockArtifact(type: string, overrides: Partial<Artifact> = {}): Artifact {
  return {
    id: `artifact-${type}-${Date.now()}`,
    companyId: 'test-company-1',
    type: type as Artifact['type'],
    title: `${type} artifact`,
    source: 'ai_generated',
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as Artifact;
}

// ============================================================================
// Recommendations Tests
// ============================================================================

describe('getArtifactRecommendations', () => {
  it('returns recommendations sorted by score descending', () => {
    const context: RecommendationContext = {
      sourceType: 'strategy',
    };

    const recommendations = getArtifactRecommendations(context);

    expect(recommendations.length).toBeGreaterThan(0);

    // Verify sorted by score descending
    for (let i = 1; i < recommendations.length; i++) {
      expect(recommendations[i - 1].score).toBeGreaterThanOrEqual(recommendations[i].score);
    }
  });

  it('assigns priority based on score thresholds', () => {
    const context: RecommendationContext = {
      sourceType: 'strategy',
      strategy: createMockStrategy(),
      tacticChannels: {
        hasMediaTactics: true,
        hasContentTactics: true,
        hasSeoTactics: false,
        hasExperiments: false,
      },
    };

    const recommendations = getArtifactRecommendations(context);

    // High score items should have high priority
    const highPriority = recommendations.filter(r => r.priority === 'high');
    expect(highPriority.length).toBeGreaterThan(0);
    highPriority.forEach(r => {
      expect(r.score).toBeGreaterThanOrEqual(15);
    });
  });

  it('boosts score for types matching tactic channels', () => {
    const withMedia: RecommendationContext = {
      sourceType: 'strategy',
      tacticChannels: {
        hasMediaTactics: true,
        hasContentTactics: false,
        hasSeoTactics: false,
        hasExperiments: false,
      },
    };

    const withoutMedia: RecommendationContext = {
      sourceType: 'strategy',
      tacticChannels: {
        hasMediaTactics: false,
        hasContentTactics: false,
        hasSeoTactics: false,
        hasExperiments: false,
      },
    };

    const withMediaRecs = getArtifactRecommendations(withMedia);
    const withoutMediaRecs = getArtifactRecommendations(withoutMedia);

    const mediaBriefWithMedia = withMediaRecs.find(r => r.type.id === 'media_brief');
    const mediaBriefWithoutMedia = withoutMediaRecs.find(r => r.type.id === 'media_brief');

    expect(mediaBriefWithMedia).toBeDefined();
    expect(mediaBriefWithoutMedia).toBeDefined();
    expect(mediaBriefWithMedia!.score).toBeGreaterThan(mediaBriefWithoutMedia!.score);
  });

  it('adds "Matches active channels" reason when tactic alignment found', () => {
    const context: RecommendationContext = {
      sourceType: 'strategy',
      tacticChannels: {
        hasMediaTactics: true,
        hasContentTactics: false,
        hasSeoTactics: false,
        hasExperiments: false,
      },
    };

    const recommendations = getArtifactRecommendations(context);
    const mediaBrief = recommendations.find(r => r.type.id === 'media_brief');

    expect(mediaBrief).toBeDefined();
    expect(mediaBrief!.reasons).toContain('Matches active channels');
  });

  it('boosts score for types not yet generated', () => {
    const withExisting: RecommendationContext = {
      sourceType: 'strategy',
      existingArtifacts: [createMockArtifact('strategy_summary')],
    };

    const withoutExisting: RecommendationContext = {
      sourceType: 'strategy',
      existingArtifacts: [],
    };

    const withExistingRecs = getArtifactRecommendations(withExisting);
    const withoutExistingRecs = getArtifactRecommendations(withoutExisting);

    const summaryWithExisting = withExistingRecs.find(r => r.type.id === 'strategy_summary');
    const summaryWithoutExisting = withoutExistingRecs.find(r => r.type.id === 'strategy_summary');

    expect(summaryWithExisting).toBeDefined();
    expect(summaryWithoutExisting).toBeDefined();
    expect(summaryWithoutExisting!.score).toBeGreaterThan(summaryWithExisting!.score);
    expect(summaryWithoutExisting!.reasons).toContain('Not yet generated');
  });

  it('only returns types that support the source type', () => {
    const mediaContext: RecommendationContext = {
      sourceType: 'plan:media',
    };

    const contentContext: RecommendationContext = {
      sourceType: 'plan:content',
    };

    const mediaRecs = getArtifactRecommendations(mediaContext);
    const contentRecs = getArtifactRecommendations(contentContext);

    // All media recs should support plan:media
    mediaRecs.forEach(r => {
      expect(r.type.supportedSources).toContain('plan:media');
    });

    // All content recs should support plan:content
    contentRecs.forEach(r => {
      expect(r.type.supportedSources).toContain('plan:content');
    });
  });
});

describe('getTopRecommendations', () => {
  it('returns specified number of recommendations', () => {
    const context: RecommendationContext = {
      sourceType: 'strategy',
    };

    const top3 = getTopRecommendations(context, 3);
    const top5 = getTopRecommendations(context, 5);

    expect(top3.length).toBe(3);
    expect(top5.length).toBe(5);
  });

  it('returns types in score order', () => {
    const context: RecommendationContext = {
      sourceType: 'strategy',
      strategy: createMockStrategy(),
    };

    const allRecs = getArtifactRecommendations(context);
    const top3 = getTopRecommendations(context, 3);

    // Top 3 should match first 3 from full list
    expect(top3[0].id).toBe(allRecs[0].type.id);
    expect(top3[1].id).toBe(allRecs[1].type.id);
    expect(top3[2].id).toBe(allRecs[2].type.id);
  });
});

describe('getRecommendedArtifactTypesLegacy', () => {
  it('returns recommendations based on tactic channels', () => {
    const result = getRecommendedArtifactTypesLegacy({
      hasMediaTactics: true,
      hasContentTactics: true,
      hasSeoTactics: false,
      hasExperiments: false,
    });

    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it('handles undefined channel flags', () => {
    const result = getRecommendedArtifactTypesLegacy({});

    // Should still return recommendations
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('Source-specific recommendations', () => {
  it('media_brief scores higher for plan:media source', () => {
    const strategyContext: RecommendationContext = {
      sourceType: 'strategy',
    };

    const mediaPlanContext: RecommendationContext = {
      sourceType: 'plan:media',
    };

    const strategyRecs = getArtifactRecommendations(strategyContext);
    const mediaPlanRecs = getArtifactRecommendations(mediaPlanContext);

    const mediaBriefFromStrategy = strategyRecs.find(r => r.type.id === 'media_brief');
    const mediaBriefFromPlan = mediaPlanRecs.find(r => r.type.id === 'media_brief');

    // Both should exist
    expect(mediaBriefFromStrategy).toBeDefined();
    expect(mediaBriefFromPlan).toBeDefined();
  });

  it('content_brief is available for plan:content source', () => {
    const context: RecommendationContext = {
      sourceType: 'plan:content',
    };

    const recs = getArtifactRecommendations(context);
    const contentBrief = recs.find(r => r.type.id === 'content_brief');

    expect(contentBrief).toBeDefined();
  });

  it('strategy_summary is not available for plan sources', () => {
    const mediaContext: RecommendationContext = {
      sourceType: 'plan:media',
    };

    const contentContext: RecommendationContext = {
      sourceType: 'plan:content',
    };

    const mediaRecs = getArtifactRecommendations(mediaContext);
    const contentRecs = getArtifactRecommendations(contentContext);

    const summaryFromMedia = mediaRecs.find(r => r.type.id === 'strategy_summary');
    const summaryFromContent = contentRecs.find(r => r.type.id === 'strategy_summary');

    // strategy_summary only supports 'strategy' source
    expect(summaryFromMedia).toBeUndefined();
    expect(summaryFromContent).toBeUndefined();
  });
});

describe('Strategy completeness scoring', () => {
  it('boosts score when strategy has goalStatement', () => {
    const withGoal: RecommendationContext = {
      sourceType: 'strategy',
      strategy: createMockStrategy({ goalStatement: 'Increase revenue' }),
    };

    const withoutGoal: RecommendationContext = {
      sourceType: 'strategy',
      strategy: createMockStrategy({ goalStatement: undefined }),
    };

    const withGoalRecs = getArtifactRecommendations(withGoal);
    const withoutGoalRecs = getArtifactRecommendations(withoutGoal);

    // Pick any type that exists in both
    const typeToCompare = withGoalRecs[0].type.id;
    const withGoalScore = withGoalRecs.find(r => r.type.id === typeToCompare)!.score;
    const withoutGoalScore = withoutGoalRecs.find(r => r.type.id === typeToCompare)!.score;

    expect(withGoalScore).toBeGreaterThan(withoutGoalScore);
  });

  it('boosts score when strategy has active pillars', () => {
    const withActivePillars: RecommendationContext = {
      sourceType: 'strategy',
      strategy: createMockStrategy({
        pillars: [
          { id: '1', title: 'Active', description: '', priority: 'high', status: 'active' },
        ],
      }),
    };

    const withDraftPillars: RecommendationContext = {
      sourceType: 'strategy',
      strategy: createMockStrategy({
        pillars: [
          { id: '1', title: 'Draft', description: '', priority: 'high', status: 'draft' },
        ],
      }),
    };

    const withActiveRecs = getArtifactRecommendations(withActivePillars);
    const withDraftRecs = getArtifactRecommendations(withDraftPillars);

    const typeToCompare = withActiveRecs[0].type.id;
    const withActiveScore = withActiveRecs.find(r => r.type.id === typeToCompare)!.score;
    const withDraftScore = withDraftRecs.find(r => r.type.id === typeToCompare)!.score;

    expect(withActiveScore).toBeGreaterThan(withDraftScore);
  });
});
