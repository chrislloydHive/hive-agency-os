// tests/competition/v4-validation.test.ts
// Unit tests for Competition Lab V4 validation guardrails
//
// Tests the fail-fast validation rules:
// 1. Subject company must not appear in competitor lists
// 2. Retail-hybrid cannot be Primary under InstallationOnly with low confidence
// 3. Clarifying question semantics must be honored

import { describe, it, expect } from 'vitest';
import {
  validateCompetitionRun,
  isRetailHybrid,
  isInstallFirst,
  type SubjectInfo,
} from '@/lib/competition-v4/validateCompetitionRun';
import type {
  CompetitionV4Result,
  ScoredCompetitor,
} from '@/lib/competition-v4/types';

// ============================================================================
// Test Fixtures
// ============================================================================

const SUBJECT_CAR_TOYS: SubjectInfo = {
  companyName: 'Car Toys',
  domain: 'cartoys.com',
};

/**
 * Create a minimal V4 result for testing
 */
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

/**
 * Create a Best Buy-style retail-hybrid competitor
 */
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
    signalsUsed: {
      installationCapability: true,
      geographicOverlap: 'national',
      marketReach: 'national',
    },
    ...overrides,
  };
}

/**
 * Create an install-first competitor (Audio Express style)
 * Install-First = primary value proposition is labor/installation services
 */
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
    signalsUsed: {
      installationCapability: true,
      geographicOverlap: 'regional',
      serviceOverlap: true,
    },
    ...overrides,
  };
}

/**
 * Create subject company as a competitor (for testing validation)
 */
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
// isRetailHybrid Tests
// ============================================================================

describe('isRetailHybrid', () => {
  it('identifies Best Buy as retail-hybrid', () => {
    const bestBuy = createBestBuyCompetitor();
    expect(isRetailHybrid(bestBuy)).toBe(true);
  });

  it('does not classify Audio Express as retail-hybrid', () => {
    const audioExpress = createInstallFirstCompetitor();
    expect(isRetailHybrid(audioExpress)).toBe(false);
  });

  it('requires all three conditions: retailer + service + national', () => {
    // Retailer without service
    expect(
      isRetailHybrid({
        name: 'Walmart',
        domain: 'walmart.com',
        type: 'Direct',
        reason: 'Test',
        overlapScore: 50,
        classification: 'contextual',
        rulesApplied: [],
        isMajorRetailer: true,
        hasInstallation: false,
        hasNationalReach: true,
      })
    ).toBe(false);

    // Retailer with service but not national
    expect(
      isRetailHybrid({
        name: 'Local Shop',
        domain: 'localshop.com',
        type: 'Direct',
        reason: 'Test',
        overlapScore: 50,
        classification: 'contextual',
        rulesApplied: [],
        isMajorRetailer: true,
        hasInstallation: true,
        hasNationalReach: false,
        isLocal: true,
      })
    ).toBe(false);
  });
});

// ============================================================================
// isInstallFirst Tests
// ============================================================================

describe('isInstallFirst', () => {
  it('identifies Audio Express as install-first', () => {
    const audioExpress = createInstallFirstCompetitor();
    expect(isInstallFirst(audioExpress)).toBe(true);
  });

  it('does not classify Best Buy as install-first (Best Buy is Retail-Hybrid)', () => {
    const bestBuy = createBestBuyCompetitor();
    expect(isInstallFirst(bestBuy)).toBe(false);
  });

  it('identifies local installer as install-first', () => {
    const localInstaller: ScoredCompetitor = {
      name: 'Local Audio Pros',
      domain: 'localaudiopros.com',
      type: 'Direct',
      reason: 'Local installer',
      overlapScore: 65,
      classification: 'primary',
      rulesApplied: ['local-installer'],
      hasInstallation: true,
      isLocal: true,
    };
    expect(isInstallFirst(localInstaller)).toBe(true);
  });
});

// ============================================================================
// Validation Rule 1: Subject Not In Competitors
// ============================================================================

describe('Validation Rule 1: Subject Not In Competitors', () => {
  it('FAILS when subject appears in primary tier', () => {
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

    const result = validateCompetitionRun(run, SUBJECT_CAR_TOYS);

    expect(result.ok).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe('SUBJECT_IN_COMPETITORS');
    expect(result.errors[0].details.tier).toBe('primary');
  });

  it('FAILS when subject appears in contextual tier', () => {
    const run = createV4Result({
      scoredCompetitors: {
        primary: [createInstallFirstCompetitor()],
        contextual: [createSubjectAsCompetitor()],
        alternatives: [],
        excluded: [],
        threshold: 40,
        modality: 'InstallationOnly',
      },
    });

    const result = validateCompetitionRun(run, SUBJECT_CAR_TOYS);

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'SUBJECT_IN_COMPETITORS')).toBe(true);
  });

  it('FAILS when subject appears in alternatives tier', () => {
    const run = createV4Result({
      scoredCompetitors: {
        primary: [createInstallFirstCompetitor()],
        contextual: [],
        alternatives: [{ ...createSubjectAsCompetitor(), classification: 'alternative' }],
        excluded: [],
        threshold: 40,
        modality: 'InstallationOnly',
      },
    });

    const result = validateCompetitionRun(run, SUBJECT_CAR_TOYS);

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'SUBJECT_IN_COMPETITORS')).toBe(true);
  });

  it('FAILS when subject appears in excluded tier', () => {
    const run = createV4Result({
      scoredCompetitors: {
        primary: [createInstallFirstCompetitor()],
        contextual: [],
        alternatives: [],
        excluded: [{ name: 'Car Toys', domain: 'cartoys.com', reason: 'Self' }],
        threshold: 40,
        modality: 'InstallationOnly',
      },
    });

    const result = validateCompetitionRun(run, SUBJECT_CAR_TOYS);

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'SUBJECT_IN_COMPETITORS')).toBe(true);
  });

  it('PASSES when subject is not in any tier', () => {
    const run = createV4Result({
      scoredCompetitors: {
        primary: [createInstallFirstCompetitor()],
        contextual: [createBestBuyCompetitor({ classification: 'contextual' })],
        alternatives: [],
        excluded: [],
        threshold: 40,
        modality: 'InstallationOnly',
      },
    });

    const result = validateCompetitionRun(run, SUBJECT_CAR_TOYS);

    expect(result.errors.some((e) => e.code === 'SUBJECT_IN_COMPETITORS')).toBe(false);
  });

  it('detects subject by domain match even with different name', () => {
    const run = createV4Result({
      scoredCompetitors: {
        primary: [
          {
            name: 'CarToys Inc.',
            domain: 'cartoys.com',
            type: 'Direct',
            reason: 'Variant name',
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

    const result = validateCompetitionRun(run, SUBJECT_CAR_TOYS);

    expect(result.ok).toBe(false);
    expect(result.errors[0].code).toBe('SUBJECT_IN_COMPETITORS');
  });
});

// ============================================================================
// Validation Rule 2: Retail-Hybrid Gating
// ============================================================================

describe('Validation Rule 2: Retail-Hybrid Gating', () => {
  it('FAILS when Best Buy is Primary under InstallationOnly + confidence 50', () => {
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

    const result = validateCompetitionRun(run, SUBJECT_CAR_TOYS);

    expect(result.ok).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe('RETAIL_HYBRID_PRIMARY_GATING_VIOLATION');
    expect(result.errors[0].details.competitorName).toBe('Best Buy');
    expect(result.errors[0].details.modality).toBe('InstallationOnly');
    expect(result.errors[0].details.confidence).toBe(50);
  });

  it('FAILS when retail-hybrid is Primary with confidence below 70', () => {
    const run = createV4Result({
      scoredCompetitors: {
        primary: [createBestBuyCompetitor()],
        contextual: [],
        alternatives: [],
        excluded: [],
        threshold: 40,
        modality: 'Retail+Installation',
        modalityConfidence: 65,
      },
    });

    const result = validateCompetitionRun(run, SUBJECT_CAR_TOYS);

    expect(result.ok).toBe(false);
    expect(result.errors[0].code).toBe('RETAIL_HYBRID_PRIMARY_GATING_VIOLATION');
  });

  it('PASSES when Best Buy is in Contextual under InstallationOnly', () => {
    const run = createV4Result({
      scoredCompetitors: {
        primary: [createInstallFirstCompetitor()],
        contextual: [createBestBuyCompetitor({ classification: 'contextual' })],
        alternatives: [],
        excluded: [],
        threshold: 40,
        modality: 'InstallationOnly',
        modalityConfidence: 50,
      },
    });

    const result = validateCompetitionRun(run, SUBJECT_CAR_TOYS);

    expect(result.errors.some((e) => e.code === 'RETAIL_HYBRID_PRIMARY_GATING_VIOLATION')).toBe(
      false
    );
  });

  it('PASSES when Best Buy is Primary under Retail+Installation with confidence >= 70', () => {
    const run = createV4Result({
      scoredCompetitors: {
        primary: [createBestBuyCompetitor(), createInstallFirstCompetitor()],
        contextual: [],
        alternatives: [],
        excluded: [],
        threshold: 40,
        modality: 'Retail+Installation',
        modalityConfidence: 75,
      },
    });

    const result = validateCompetitionRun(run, SUBJECT_CAR_TOYS);

    expect(result.errors.some((e) => e.code === 'RETAIL_HYBRID_PRIMARY_GATING_VIOLATION')).toBe(
      false
    );
  });

  it('install-first competitor in Primary under InstallationOnly is OK', () => {
    const run = createV4Result({
      scoredCompetitors: {
        primary: [createInstallFirstCompetitor()],
        contextual: [],
        alternatives: [],
        excluded: [],
        threshold: 40,
        modality: 'InstallationOnly',
        modalityConfidence: 50,
      },
    });

    const result = validateCompetitionRun(run, SUBJECT_CAR_TOYS);

    expect(result.ok).toBe(true);
  });
});

// ============================================================================
// Validation Rule 3: Clarifying Question Honored
// ============================================================================

describe('Validation Rule 3: Clarifying Question Honored', () => {
  it('FAILS when clarifying question exists + confidence < 70 + retail-hybrid in Primary', () => {
    const run = createV4Result({
      scoredCompetitors: {
        primary: [createBestBuyCompetitor()],
        contextual: [],
        alternatives: [],
        excluded: [],
        threshold: 40,
        modality: 'InstallationOnly',
        modalityConfidence: 55,
        clarifyingQuestion: {
          question: 'Do customers compare you to big retailers like Best Buy?',
          yesImplies: 'Retail+Installation',
          noImplies: 'InstallationOnly',
          context: 'Help us understand your competitive landscape',
        },
      },
    });

    const result = validateCompetitionRun(run, SUBJECT_CAR_TOYS);

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'CLARIFYING_QUESTION_IGNORED')).toBe(true);
  });

  it('PASSES when clarifying question exists but confidence >= 70', () => {
    const run = createV4Result({
      scoredCompetitors: {
        primary: [createBestBuyCompetitor()],
        contextual: [],
        alternatives: [],
        excluded: [],
        threshold: 40,
        modality: 'Retail+Installation',
        modalityConfidence: 75,
        clarifyingQuestion: {
          question: 'Do customers compare you to big retailers?',
          yesImplies: 'Retail+Installation',
          noImplies: 'InstallationOnly',
          context: 'Clarification',
        },
      },
    });

    const result = validateCompetitionRun(run, SUBJECT_CAR_TOYS);

    expect(result.errors.some((e) => e.code === 'CLARIFYING_QUESTION_IGNORED')).toBe(false);
  });

  it('PASSES when no clarifying question exists', () => {
    const run = createV4Result({
      scoredCompetitors: {
        primary: [createBestBuyCompetitor()],
        contextual: [],
        alternatives: [],
        excluded: [],
        threshold: 40,
        modality: 'InstallationOnly',
        modalityConfidence: 50,
        // No clarifyingQuestion
      },
    });

    const result = validateCompetitionRun(run, SUBJECT_CAR_TOYS);

    // Still fails for RETAIL_HYBRID_PRIMARY_GATING_VIOLATION, but not CLARIFYING_QUESTION_IGNORED
    expect(result.errors.some((e) => e.code === 'CLARIFYING_QUESTION_IGNORED')).toBe(false);
  });
});

// ============================================================================
// Combined Scenario Tests
// ============================================================================

describe('Combined Validation Scenarios', () => {
  it('detects multiple violations simultaneously', () => {
    const run = createV4Result({
      scoredCompetitors: {
        primary: [
          createSubjectAsCompetitor(), // Violation 1: subject in competitors
          createBestBuyCompetitor(), // Violation 2: retail-hybrid in primary
        ],
        contextual: [],
        alternatives: [],
        excluded: [],
        threshold: 40,
        modality: 'InstallationOnly',
        modalityConfidence: 50,
        clarifyingQuestion: {
          // Violation 3: clarifying question ignored
          question: 'Test?',
          yesImplies: 'Retail+Installation',
          noImplies: 'InstallationOnly',
          context: 'Test',
        },
      },
    });

    const result = validateCompetitionRun(run, SUBJECT_CAR_TOYS);

    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
    expect(result.errors.some((e) => e.code === 'SUBJECT_IN_COMPETITORS')).toBe(true);
    expect(result.errors.some((e) => e.code === 'RETAIL_HYBRID_PRIMARY_GATING_VIOLATION')).toBe(
      true
    );
    expect(result.errors.some((e) => e.code === 'CLARIFYING_QUESTION_IGNORED')).toBe(true);
  });

  it('PASSES when all rules are satisfied', () => {
    const run = createV4Result({
      scoredCompetitors: {
        primary: [createInstallFirstCompetitor()],
        contextual: [createBestBuyCompetitor({ classification: 'contextual' })],
        alternatives: [],
        excluded: [],
        threshold: 40,
        modality: 'InstallationOnly',
        modalityConfidence: 80,
      },
    });

    const result = validateCompetitionRun(run, SUBJECT_CAR_TOYS);

    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
