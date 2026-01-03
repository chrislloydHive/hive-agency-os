import { describe, it, expect } from 'vitest';
import { buildCompetitionCandidates } from '@/lib/contextGraph/v4/competitionCandidates';
import type { CompetitionV4Result, ScoredCompetitor } from '@/lib/competition-v4';

function competitor(name: string, classification: 'primary' | 'contextual' | 'alternative'): ScoredCompetitor {
  return {
    name,
    domain: `${name.toLowerCase().replace(/\s+/g, '')}.com`,
    type: 'Direct' as const,
    overlapScore: classification === 'primary' ? 80 : classification === 'contextual' ? 55 : 35,
    classification,
    confidence: 75,
    reason: 'test-fixture',
    rulesApplied: ['service-match'],
    whyThisMatters: `${name} matters`,
    signalsUsed: {
      installationCapability: true,
      productOverlap: true,
      geographicOverlap: 'local',
    },
  };
}

function v4Run(): CompetitionV4Result {
  return {
    version: 4,
    runId: 'run-v4-1',
    companyId: 'company-1',
    companyName: 'TestCo',
    domain: 'test.co',
    decomposition: {
      market_orientation: 'B2C',
      economic_model: 'Service',
      offering_type: 'Hybrid',
      buyer_user_relationship: 'Same',
      transaction_model: 'One-time',
      primary_vertical: 'Home Services',
      secondary_verticals: [],
      geographic_scope: 'Regional',
      confidence_notes: '',
    },
    category: {
      category_slug: 'test',
      category_name: 'Test',
      category_description: 'desc',
      qualification_rules: [],
      exclusion_rules: [],
    },
    competitors: { validated: [], removed: [] },
    scoredCompetitors: {
      primary: [competitor('Direct One', 'primary')],
      contextual: [competitor('Contextual One', 'contextual')],
      alternatives: [competitor('Alt One', 'alternative')],
      excluded: [],
      threshold: 40,
      modality: 'InstallationOnly',
      modalityConfidence: 80,
      topTraitRules: [],
    },
    modalityInference: {
      modality: 'InstallationOnly',
      confidence: 80,
      signals: [],
      explanation: '',
      serviceEmphasis: 1,
      productEmphasis: 0,
    },
    summary: {
      competitive_positioning: 'Test positioning',
      key_differentiation_axes: ['service', 'price'],
      competitive_risks: ['market shift'],
    },
    execution: {
      status: 'completed',
      startedAt: '2025-01-01T00:00:00Z',
      completedAt: '2025-01-01T00:10:00Z',
      durationMs: 600000,
      stepsCompleted: 5,
    },
  };
}

describe('buildCompetitionCandidates canonical (v4)', () => {
  it('prefers competition.* keys and includes primary/contextual/alternatives', () => {
    const result = buildCompetitionCandidates(v4Run());

    const primary = result.candidates.find((c) => c.key === 'competition.primaryCompetitors');
    const alts = result.candidates.find((c) => c.key === 'competition.marketAlternatives');

    expect(primary).toBeDefined();
    expect(primary?.value).toMatchObject([{ name: 'Direct One' }]);
    expect(alts).toBeDefined();
    expect((alts?.value as any[]).length).toBeGreaterThanOrEqual(2);
    expect(result.extractionPath).toBe('competitionRunV4');
  });
});

