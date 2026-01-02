// tests/competition/v4-reducer.test.ts
// Unit tests for Competition Lab V4 render reducer
//
// Tests the deterministic reducer that produces the final display tiers:
// 1. Deduplication by domain
// 2. Subject company removal
// 3. Gating rules enforcement
// 4. Tier sorting

import { describe, it, expect } from 'vitest';
import {
  reduceCompetitionForUI,
  getReducedCompetitorCounts,
  type ReducedCompetition,
} from '@/lib/competition-v4/reduceCompetitionForUI';
import type {
  CompetitionV4Result,
  ScoredCompetitor,
} from '@/lib/competition-v4/types';

// ============================================================================
// Test Fixtures
// ============================================================================

const SUBJECT_CAR_TOYS = {
  companyName: 'Car Toys',
  domain: 'cartoys.com',
};

function createV4Result(
  overrides: Partial<CompetitionV4Result> = {}
): CompetitionV4Result {
  return {
    version: 4,
    runId: 'test-run-1',
    companyId: 'test-company-1',
    companyName: 'Car Toys',
    domain: 'cartoys.com',
    decomposition: {
      market_orientation: 'B2C',
      economic_model: 'Service',
      offering_type: 'Labor-Based Service',
      buyer_user_relationship: 'Same',
      transaction_model: 'One-time',
      primary_vertical: 'Automotive Retail',
      secondary_verticals: [],
      geographic_scope: 'Regional',
      confidence_notes: 'Test fixture',
    },
    category: {
      category_slug: 'car-electronics-installation',
      category_name: 'Car Electronics Installation',
      category_description: 'Test category',
      qualification_rules: [],
      exclusion_rules: [],
    },
    competitors: {
      validated: [],
      removed: [],
    },
    execution: {
      status: 'completed',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 1000,
      stepsCompleted: 5,
    },
    ...overrides,
  };
}

function createBestBuyCompetitor(overrides: Partial<ScoredCompetitor> = {}): ScoredCompetitor {
  return {
    name: 'Best Buy',
    domain: 'bestbuy.com',
    type: 'Direct',
    reason: 'National retailer with installation services',
    overlapScore: 75,
    classification: 'primary',
    rulesApplied: ['national-retailer', 'has-installation'],
    isMajorRetailer: true,
    hasInstallation: true,
    hasNationalReach: true,
    brandTrustScore: 85,
    signalsUsed: {
      installationCapability: true,
      geographicOverlap: 'national',
      marketReach: 'national',
    },
    ...overrides,
  };
}

function createInstallFirstCompetitor(overrides: Partial<ScoredCompetitor> = {}): ScoredCompetitor {
  return {
    name: 'Audio Express',
    domain: 'audioexpress.com',
    type: 'Direct',
    reason: 'Regional car audio specialist',
    overlapScore: 70,
    classification: 'primary',
    rulesApplied: ['install-first', 'regional'],
    isMajorRetailer: false,
    hasInstallation: true,
    hasNationalReach: false,
    isLocal: true,
    brandTrustScore: 60,
    signalsUsed: {
      installationCapability: true,
      geographicOverlap: 'regional',
      serviceOverlap: true,
    },
    ...overrides,
  };
}

function createSubjectAsCompetitor(): ScoredCompetitor {
  return {
    name: 'Car Toys',
    domain: 'cartoys.com',
    type: 'Direct',
    reason: 'This should be filtered out',
    overlapScore: 100,
    classification: 'primary',
    rulesApplied: [],
  };
}

// ============================================================================
// Step 1: Deduplication Tests
// ============================================================================

describe('Reducer Step 1: Deduplication', () => {
  it('deduplicates by domain, keeping strongest tier', () => {
    const run = createV4Result({
      scoredCompetitors: {
        primary: [createInstallFirstCompetitor({ name: 'Audio Express Primary' })],
        contextual: [createInstallFirstCompetitor({ name: 'Audio Express Contextual' })],
        alternatives: [],
        excluded: [],
        threshold: 40,
        modality: 'InstallationOnly',
      },
    });

    const result = reduceCompetitionForUI(run, SUBJECT_CAR_TOYS);

    // Should only have one Audio Express, from primary tier
    const allCompetitors = [
      ...result.tiers.primaryInstallFirst,
      ...result.tiers.contextual,
    ];
    const audioExpressCount = allCompetitors.filter((c) =>
      c.domain?.includes('audioexpress')
    ).length;
    expect(audioExpressCount).toBe(1);
    expect(result.tiers.primaryInstallFirst.some((c) => c.domain === 'audioexpress.com')).toBe(true);
  });

  it('normalizes domains for deduplication (removes www)', () => {
    const run = createV4Result({
      scoredCompetitors: {
        primary: [createInstallFirstCompetitor({ domain: 'www.audioexpress.com' })],
        contextual: [createInstallFirstCompetitor({ domain: 'audioexpress.com' })],
        alternatives: [],
        excluded: [],
        threshold: 40,
        modality: 'InstallationOnly',
      },
    });

    const result = reduceCompetitionForUI(run, SUBJECT_CAR_TOYS);

    const allCompetitors = [...result.tiers.primaryInstallFirst, ...result.tiers.contextual];
    const audioExpressCount = allCompetitors.filter((c) =>
      c.domain?.includes('audioexpress')
    ).length;
    expect(audioExpressCount).toBe(1);
  });
});

// ============================================================================
// Step 2: Subject Company Removal Tests
// ============================================================================

describe('Reducer Step 2: Subject Company Removal', () => {
  it('removes subject company from primary tier', () => {
    const run = createV4Result({
      scoredCompetitors: {
        primary: [createSubjectAsCompetitor(), createInstallFirstCompetitor()],
        contextual: [],
        alternatives: [],
        excluded: [],
        threshold: 40,
        modality: 'InstallationOnly',
      },
    });

    const result = reduceCompetitionForUI(run, SUBJECT_CAR_TOYS);

    expect(result.notes.suppressedSubjectCount).toBe(1);
    expect(result.tiers.primaryInstallFirst.every((c) => c.domain !== 'cartoys.com')).toBe(true);
  });

  it('removes subject company from all tiers', () => {
    const run = createV4Result({
      scoredCompetitors: {
        primary: [createSubjectAsCompetitor()],
        contextual: [{ ...createSubjectAsCompetitor(), classification: 'contextual' }],
        alternatives: [{ ...createSubjectAsCompetitor(), classification: 'alternative' }],
        excluded: [{ name: 'Car Toys', domain: 'cartoys.com', reason: 'Self' }],
        threshold: 40,
        modality: 'InstallationOnly',
      },
    });

    const result = reduceCompetitionForUI(run, SUBJECT_CAR_TOYS);

    // Note: After deduplication, there's only 1 competitor from primary
    // But excluded is a separate list
    expect(result.notes.suppressedSubjectCount).toBeGreaterThanOrEqual(1);

    // Check all output tiers
    const allCompetitors = [
      ...result.tiers.primaryInstallFirst,
      ...result.tiers.primaryRetailHybrid,
      ...result.tiers.contextual,
      ...result.tiers.alternatives,
    ];
    expect(allCompetitors.every((c) => c.domain !== 'cartoys.com')).toBe(true);
    expect(result.tiers.excluded.every((c) => c.domain !== 'cartoys.com')).toBe(true);
  });

  it('matches subject by partial name', () => {
    const run = createV4Result({
      scoredCompetitors: {
        primary: [
          {
            name: 'Car Toys Inc.',
            domain: 'different-domain.com',
            type: 'Direct',
            reason: 'Test',
            overlapScore: 100,
            classification: 'primary',
            rulesApplied: [],
          },
        ],
        contextual: [],
        alternatives: [],
        excluded: [],
        threshold: 40,
        modality: 'InstallationOnly',
      },
    });

    const result = reduceCompetitionForUI(run, SUBJECT_CAR_TOYS);

    // "Car Toys Inc." should be filtered because it contains "Car Toys"
    expect(result.notes.suppressedSubjectCount).toBe(1);
    expect(result.tiers.primaryInstallFirst).toHaveLength(0);
  });
});

// ============================================================================
// Step 3-5: Mode and Gating Rules Tests
// ============================================================================

describe('Reducer Steps 3-5: Mode and Gating Rules', () => {
  it('extracts mode from scoredCompetitors.modality', () => {
    const run = createV4Result({
      scoredCompetitors: {
        primary: [createInstallFirstCompetitor()],
        contextual: [],
        alternatives: [],
        excluded: [],
        threshold: 40,
        modality: 'InstallationOnly',
        modalityConfidence: 80,
      },
    });

    const result = reduceCompetitionForUI(run, SUBJECT_CAR_TOYS);

    expect(result.mode.modality).toBe('InstallationOnly');
    expect(result.mode.confidence).toBe(80);
  });

  it('falls back to modalityInference when scoredCompetitors.modality is null', () => {
    const run = createV4Result({
      scoredCompetitors: {
        primary: [createInstallFirstCompetitor()],
        contextual: [],
        alternatives: [],
        excluded: [],
        threshold: 40,
        modality: null,
      },
      modalityInference: {
        modality: 'Retail+Installation',
        confidence: 75,
        signals: ['test'],
        explanation: 'Test explanation',
        serviceEmphasis: 0.5,
        productEmphasis: 0.5,
      },
    });

    const result = reduceCompetitionForUI(run, SUBJECT_CAR_TOYS);

    expect(result.mode.modality).toBe('Retail+Installation');
    expect(result.mode.confidence).toBe(75);
  });

  it('gates retail-hybrid to contextual under InstallationOnly + low confidence', () => {
    const run = createV4Result({
      scoredCompetitors: {
        primary: [createBestBuyCompetitor(), createInstallFirstCompetitor()],
        contextual: [],
        alternatives: [],
        excluded: [],
        threshold: 40,
        modality: 'InstallationOnly',
        modalityConfidence: 50,
      },
    });

    const result = reduceCompetitionForUI(run, SUBJECT_CAR_TOYS);

    // Best Buy should be moved to contextual
    expect(result.tiers.primaryRetailHybrid).toHaveLength(0);
    expect(result.tiers.contextual.some((c) => c.name === 'Best Buy')).toBe(true);

    // Audio Express should stay in primary
    expect(result.tiers.primaryInstallFirst.some((c) => c.name === 'Audio Express')).toBe(true);

    // Check forced moves
    expect(result.notes.forcedMoves).toHaveLength(1);
    expect(result.notes.forcedMoves[0].name).toBe('Best Buy');
    expect(result.notes.forcedMoves[0].from).toBe('primary');
    expect(result.notes.forcedMoves[0].to).toBe('contextual');
  });

  it('allows retail-hybrid in primary under Retail+Installation + high confidence', () => {
    const run = createV4Result({
      scoredCompetitors: {
        primary: [createBestBuyCompetitor(), createInstallFirstCompetitor()],
        contextual: [],
        alternatives: [],
        excluded: [],
        threshold: 40,
        modality: 'Retail+Installation',
        modalityConfidence: 80,
      },
    });

    const result = reduceCompetitionForUI(run, SUBJECT_CAR_TOYS);

    // Best Buy should be in primaryRetailHybrid
    expect(result.tiers.primaryRetailHybrid.some((c) => c.name === 'Best Buy')).toBe(true);

    // Audio Express should be in primaryInstallFirst
    expect(result.tiers.primaryInstallFirst.some((c) => c.name === 'Audio Express')).toBe(true);

    // No forced moves
    expect(result.notes.forcedMoves).toHaveLength(0);

    // Mode flags
    expect(result.mode.allowRetailHybridPrimary).toBe(true);
  });

  it('gates retail-hybrid when clarifying question exists + low confidence', () => {
    const run = createV4Result({
      scoredCompetitors: {
        primary: [createBestBuyCompetitor()],
        contextual: [],
        alternatives: [],
        excluded: [],
        threshold: 40,
        modality: 'Retail+Installation',
        modalityConfidence: 65,
        clarifyingQuestion: {
          question: 'Do customers compare you to big retailers?',
          yesImplies: 'Retail+Installation',
          noImplies: 'InstallationOnly',
          context: 'Help us understand',
        },
      },
    });

    const result = reduceCompetitionForUI(run, SUBJECT_CAR_TOYS);

    // Best Buy should be gated to contextual
    expect(result.tiers.primaryRetailHybrid).toHaveLength(0);
    expect(result.tiers.contextual.some((c) => c.name === 'Best Buy')).toBe(true);
    expect(result.mode.hasClarifyingQuestion).toBe(true);
    expect(result.mode.allowRetailHybridPrimary).toBe(false);
  });
});

// ============================================================================
// Step 6: Tier Building Tests
// ============================================================================

describe('Reducer Step 6: Tier Building', () => {
  it('separates install-first and retail-hybrid in primary tiers', () => {
    const run = createV4Result({
      scoredCompetitors: {
        primary: [createBestBuyCompetitor(), createInstallFirstCompetitor()],
        contextual: [],
        alternatives: [],
        excluded: [],
        threshold: 40,
        modality: 'Retail+Installation',
        modalityConfidence: 85,
      },
    });

    const result = reduceCompetitionForUI(run, SUBJECT_CAR_TOYS);

    expect(result.tiers.primaryInstallFirst).toHaveLength(1);
    expect(result.tiers.primaryRetailHybrid).toHaveLength(1);
    expect(result.tiers.primaryInstallFirst[0].mechanism).toBe('install-first');
    expect(result.tiers.primaryRetailHybrid[0].mechanism).toBe('retail-hybrid');
  });

  it('preserves competitors in contextual tier', () => {
    const run = createV4Result({
      scoredCompetitors: {
        primary: [createInstallFirstCompetitor()],
        contextual: [
          {
            name: 'Upstream Manufacturer',
            domain: 'manufacturer.com',
            type: 'Indirect',
            reason: 'Test',
            overlapScore: 40,
            classification: 'contextual',
            rulesApplied: [],
          },
        ],
        alternatives: [],
        excluded: [],
        threshold: 40,
        modality: 'InstallationOnly',
      },
    });

    const result = reduceCompetitionForUI(run, SUBJECT_CAR_TOYS);

    expect(result.tiers.contextual.some((c) => c.name === 'Upstream Manufacturer')).toBe(true);
  });

  it('preserves alternatives tier', () => {
    const run = createV4Result({
      scoredCompetitors: {
        primary: [createInstallFirstCompetitor()],
        contextual: [],
        alternatives: [
          {
            name: 'DIY YouTube',
            domain: 'youtube.com',
            type: 'Indirect',
            reason: 'DIY alternative',
            overlapScore: 30,
            classification: 'alternative',
            rulesApplied: [],
          },
        ],
        excluded: [],
        threshold: 40,
        modality: 'InstallationOnly',
      },
    });

    const result = reduceCompetitionForUI(run, SUBJECT_CAR_TOYS);

    expect(result.tiers.alternatives.some((c) => c.name === 'DIY YouTube')).toBe(true);
  });

  it('preserves excluded tier', () => {
    const run = createV4Result({
      scoredCompetitors: {
        primary: [createInstallFirstCompetitor()],
        contextual: [],
        alternatives: [],
        excluded: [
          { name: 'Irrelevant Corp', domain: 'irrelevant.com', reason: 'Not a competitor' },
        ],
        threshold: 40,
        modality: 'InstallationOnly',
      },
    });

    const result = reduceCompetitionForUI(run, SUBJECT_CAR_TOYS);

    expect(result.tiers.excluded.some((c) => c.name === 'Irrelevant Corp')).toBe(true);
  });
});

// ============================================================================
// Step 7: Sorting Tests
// ============================================================================

describe('Reducer Step 7: Sorting', () => {
  it('sorts primary tiers by overlapScore descending', () => {
    const run = createV4Result({
      scoredCompetitors: {
        primary: [
          createInstallFirstCompetitor({ name: 'Low Score', overlapScore: 50 }),
          createInstallFirstCompetitor({ name: 'High Score', domain: 'highscore.com', overlapScore: 90 }),
          createInstallFirstCompetitor({ name: 'Mid Score', domain: 'midscore.com', overlapScore: 70 }),
        ],
        contextual: [],
        alternatives: [],
        excluded: [],
        threshold: 40,
        modality: 'InstallationOnly',
      },
    });

    const result = reduceCompetitionForUI(run, SUBJECT_CAR_TOYS);

    expect(result.tiers.primaryInstallFirst[0].name).toBe('High Score');
    expect(result.tiers.primaryInstallFirst[1].name).toBe('Mid Score');
    expect(result.tiers.primaryInstallFirst[2].name).toBe('Low Score');
  });

  it('sorts contextual by brandRecognition desc, then overlapScore desc', () => {
    const run = createV4Result({
      scoredCompetitors: {
        primary: [],
        contextual: [
          createBestBuyCompetitor({
            name: 'High Brand Low Overlap',
            domain: 'highbrand.com',
            classification: 'contextual',
            brandTrustScore: 90,
            overlapScore: 40,
          }),
          createBestBuyCompetitor({
            name: 'Low Brand High Overlap',
            domain: 'lowbrand.com',
            classification: 'contextual',
            brandTrustScore: 50,
            overlapScore: 80,
          }),
          createBestBuyCompetitor({
            name: 'High Brand High Overlap',
            domain: 'highbrandhighoverlap.com',
            classification: 'contextual',
            brandTrustScore: 90,
            overlapScore: 80,
          }),
        ],
        alternatives: [],
        excluded: [],
        threshold: 40,
        modality: 'InstallationOnly',
      },
    });

    const result = reduceCompetitionForUI(run, SUBJECT_CAR_TOYS);

    // First two have same brand (90), so sorted by overlap
    expect(result.tiers.contextual[0].name).toBe('High Brand High Overlap');
    expect(result.tiers.contextual[1].name).toBe('High Brand Low Overlap');
    expect(result.tiers.contextual[2].name).toBe('Low Brand High Overlap');
  });
});

// ============================================================================
// Copy Hints Tests
// ============================================================================

describe('Reducer Copy Hints', () => {
  it('sets showModerateConfidenceLabel when confidence < 70', () => {
    const run = createV4Result({
      scoredCompetitors: {
        primary: [createInstallFirstCompetitor()],
        contextual: [],
        alternatives: [],
        excluded: [],
        threshold: 40,
        modality: 'InstallationOnly',
        modalityConfidence: 65,
      },
    });

    const result = reduceCompetitionForUI(run, SUBJECT_CAR_TOYS);

    expect(result.copyHints.showModerateConfidenceLabel).toBe(true);
  });

  it('does not set showModerateConfidenceLabel when confidence >= 70', () => {
    const run = createV4Result({
      scoredCompetitors: {
        primary: [createInstallFirstCompetitor()],
        contextual: [],
        alternatives: [],
        excluded: [],
        threshold: 40,
        modality: 'InstallationOnly',
        modalityConfidence: 75,
      },
    });

    const result = reduceCompetitionForUI(run, SUBJECT_CAR_TOYS);

    expect(result.copyHints.showModerateConfidenceLabel).toBe(false);
  });

  it('sets retailHybridGatingReason when forced moves occur', () => {
    const run = createV4Result({
      scoredCompetitors: {
        primary: [createBestBuyCompetitor()],
        contextual: [],
        alternatives: [],
        excluded: [],
        threshold: 40,
        modality: 'InstallationOnly',
        modalityConfidence: 50,
      },
    });

    const result = reduceCompetitionForUI(run, SUBJECT_CAR_TOYS);

    expect(result.copyHints.showRetailHybridGatingExplanation).toBe(true);
    expect(result.copyHints.retailHybridGatingReason).toContain('Installation-Focused');
  });
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('getReducedCompetitorCounts', () => {
  it('calculates counts correctly', () => {
    const run = createV4Result({
      scoredCompetitors: {
        primary: [
          createBestBuyCompetitor(),
          createInstallFirstCompetitor(),
          createInstallFirstCompetitor({ name: 'Another', domain: 'another.com' }),
        ],
        contextual: [
          createBestBuyCompetitor({ name: 'Costco', domain: 'costco.com', classification: 'contextual' }),
        ],
        alternatives: [
          {
            name: 'DIY',
            domain: 'diy.com',
            type: 'Indirect',
            reason: 'DIY',
            overlapScore: 20,
            classification: 'alternative',
            rulesApplied: [],
          },
        ],
        excluded: [{ name: 'Excluded', domain: 'excluded.com', reason: 'Test' }],
        threshold: 40,
        modality: 'Retail+Installation',
        modalityConfidence: 85,
      },
    });

    const reduced = reduceCompetitionForUI(run, SUBJECT_CAR_TOYS);
    const counts = getReducedCompetitorCounts(reduced);

    expect(counts.primaryInstallFirst).toBe(2);
    expect(counts.primaryRetailHybrid).toBe(1);
    expect(counts.primaryTotal).toBe(3);
    expect(counts.contextual).toBe(1);
    expect(counts.alternatives).toBe(1);
    expect(counts.excluded).toBe(1);
    expect(counts.total).toBe(5);
  });
});

// ============================================================================
// Regression Test: The Car Toys + Best Buy Scenario
// ============================================================================

describe('Regression: Car Toys + Best Buy Scenario', () => {
  it('corrects the classic violation: Best Buy primary under InstallationOnly + low confidence', () => {
    // This is the exact scenario from the spec:
    // modality === InstallationOnly + modalityConfidence < 70 but Best Buy appears as primary
    const run = createV4Result({
      scoredCompetitors: {
        primary: [
          createBestBuyCompetitor(),
          createSubjectAsCompetitor(), // Car Toys as own competitor
        ],
        contextual: [],
        alternatives: [],
        excluded: [],
        threshold: 40,
        modality: 'InstallationOnly',
        modalityConfidence: 50,
        clarifyingQuestion: {
          question: 'Do customers compare you to big retailers like Best Buy?',
          yesImplies: 'Retail+Installation',
          noImplies: 'InstallationOnly',
          context: 'Help us understand',
        },
      },
    });

    const result = reduceCompetitionForUI(run, SUBJECT_CAR_TOYS);

    // 1. Car Toys should be removed
    expect(result.notes.suppressedSubjectCount).toBe(1);
    expect(
      [...result.tiers.primaryInstallFirst, ...result.tiers.primaryRetailHybrid].every(
        (c) => c.domain !== 'cartoys.com'
      )
    ).toBe(true);

    // 2. Best Buy should be moved to contextual (not primary)
    expect(result.tiers.primaryRetailHybrid).toHaveLength(0);
    expect(result.tiers.contextual.some((c) => c.name === 'Best Buy')).toBe(true);

    // 3. Forced moves should be recorded
    expect(result.notes.forcedMoves.some((m) => m.name === 'Best Buy')).toBe(true);

    // 4. Validation errors should be recorded (for dev visibility)
    expect(result.notes.validationErrors.length).toBeGreaterThan(0);

    // 5. Copy hints should indicate gating
    expect(result.copyHints.showModerateConfidenceLabel).toBe(true);
    expect(result.copyHints.showRetailHybridGatingExplanation).toBe(true);
  });
});
