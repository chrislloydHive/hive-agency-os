// tests/os/rubricCoverage.test.ts
// Tests for RFP Rubric Coverage computation

import { describe, test, expect } from 'vitest';
import {
  computeRubricCoverage,
  getSuggestedSectionsForReview,
  getShortSectionLabel,
  getCoverageStatusClass,
  isCriterionCoveredBySection,
} from '@/lib/os/rfp/computeRubricCoverage';
import type { RfpSection } from '@/lib/types/rfp';
import type { RfpWinStrategy } from '@/lib/types/rfpWinStrategy';

// ============================================================================
// Test Fixtures
// ============================================================================

function createMockSection(overrides: Partial<RfpSection> = {}): RfpSection {
  return {
    id: 'section_1',
    rfpId: 'rfp_1',
    sectionKey: 'approach',
    title: 'Our Approach',
    status: 'draft',
    contentWorking: 'Sample content',
    contentApproved: null,
    sourceType: 'generated',
    generatedUsing: null,
    needsReview: false,
    lastGeneratedAt: new Date().toISOString(),
    isStale: false,
    staleReason: null,
    reviewNotes: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createMockStrategy(overrides: Partial<RfpWinStrategy> = {}): RfpWinStrategy {
  return {
    evaluationCriteria: [],
    winThemes: [],
    proofPlan: [],
    competitiveAssumptions: [],
    landmines: [],
    locked: false,
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('computeRubricCoverage', () => {
  describe('edge cases', () => {
    test('returns empty result for null strategy', () => {
      const sections = [createMockSection()];
      const result = computeRubricCoverage(null, sections);

      expect(result.criterionCoverage).toEqual([]);
      expect(result.overallHealth).toBe(100);
      expect(result.uncoveredHighWeightCount).toBe(0);
      expect(result.summaryNotes).toContain('No evaluation criteria defined in win strategy');
    });

    test('returns empty result for undefined strategy', () => {
      const sections = [createMockSection()];
      const result = computeRubricCoverage(undefined, sections);

      expect(result.criterionCoverage).toEqual([]);
      expect(result.overallHealth).toBe(100);
    });

    test('returns empty result for strategy with no criteria', () => {
      const strategy = createMockStrategy();
      const sections = [createMockSection()];
      const result = computeRubricCoverage(strategy, sections);

      expect(result.criterionCoverage).toEqual([]);
      expect(result.overallHealth).toBe(100);
    });

    test('handles empty sections array', () => {
      const strategy = createMockStrategy({
        evaluationCriteria: [{ label: 'Technical Approach', weight: 0.4 }],
      });
      const result = computeRubricCoverage(strategy, []);

      expect(result.criterionCoverage.length).toBe(1);
      expect(result.criterionCoverage[0].coverageScore).toBe(0);
      expect(result.sectionCoverage).toEqual([]);
    });
  });

  describe('criterion coverage computation', () => {
    test('computes coverage for single criterion with matching section', () => {
      const strategy = createMockStrategy({
        evaluationCriteria: [
          { label: 'Technical Approach', weight: 0.4, primarySections: ['approach'] },
        ],
      });

      const sections = [
        createMockSection({
          sectionKey: 'approach',
          status: 'draft',
          generatedUsing: {
            hasWinStrategy: true,
            winThemesApplied: [],
            proofItemsApplied: [],
          },
        }),
      ];

      const result = computeRubricCoverage(strategy, sections);

      expect(result.criterionCoverage.length).toBe(1);
      expect(result.criterionCoverage[0].criterionLabel).toBe('Technical Approach');
      expect(result.criterionCoverage[0].coverageScore).toBe(100);
      expect(result.criterionCoverage[0].coveredBySectionKeys).toContain('approach');
    });

    test('identifies missing sections for criterion', () => {
      const strategy = createMockStrategy({
        evaluationCriteria: [
          { label: 'Experience', weight: 0.3, primarySections: ['agency_overview', 'work_samples'] },
        ],
      });

      const sections = [
        createMockSection({
          sectionKey: 'agency_overview',
          status: 'draft',
          generatedUsing: { hasWinStrategy: true, winThemesApplied: [], proofItemsApplied: [] },
        }),
        createMockSection({
          id: 'section_2',
          sectionKey: 'work_samples',
          status: 'empty', // Empty section doesn't count as covered
          generatedUsing: null,
        }),
      ];

      const result = computeRubricCoverage(strategy, sections);

      expect(result.criterionCoverage[0].coverageScore).toBe(50); // 1/2 sections
      expect(result.criterionCoverage[0].missingSections).toContain('work_samples');
    });

    test('uses keyword matching when primarySections not specified', () => {
      // 'price' keyword should suggest the 'pricing' section
      const strategy = createMockStrategy({
        evaluationCriteria: [
          { label: 'Price competitiveness', weight: 0.3 }, // 'price' keyword matches 'pricing' section
        ],
      });

      // The section must: have status != 'empty', have generatedUsing.hasWinStrategy = true
      const sections = [
        createMockSection({
          sectionKey: 'pricing',
          status: 'draft',
          generatedUsing: { hasWinStrategy: true, winThemesApplied: [], proofItemsApplied: [] },
        }),
      ];

      const result = computeRubricCoverage(strategy, sections);

      // The criterion should be covered by pricing section via keyword match
      expect(result.criterionCoverage[0].coveredBySectionKeys).toContain('pricing');
    });

    test('falls back to approach section when no keyword matches', () => {
      // Use a criterion that truly doesn't match any keyword
      const strategy = createMockStrategy({
        evaluationCriteria: [
          { label: 'Foobar baz qux', weight: 0.2 }, // No keyword match - falls back to approach
        ],
      });

      // The section must: have status != 'empty', have generatedUsing.hasWinStrategy = true
      const sections = [
        createMockSection({
          sectionKey: 'approach',
          status: 'draft',
          generatedUsing: { hasWinStrategy: true, winThemesApplied: [], proofItemsApplied: [] },
        }),
      ];

      const result = computeRubricCoverage(strategy, sections);

      // Falls back to 'approach' as the default section
      expect(result.criterionCoverage[0].coveredBySectionKeys).toContain('approach');
    });
  });

  describe('sorting and prioritization', () => {
    test('sorts risk items first', () => {
      const strategy = createMockStrategy({
        evaluationCriteria: [
          { label: 'Low Priority', weight: 0.1 },
          { label: 'High Risk Gap', weight: 0.4, primarySections: ['team'] }, // Missing
        ],
      });

      const sections = [
        createMockSection({
          sectionKey: 'approach',
          status: 'draft',
          generatedUsing: { hasWinStrategy: true, winThemesApplied: [], proofItemsApplied: [] },
        }),
      ];

      const result = computeRubricCoverage(strategy, sections);

      // High Risk Gap should be first because it's a risk (high weight, low coverage)
      expect(result.criterionCoverage[0].criterionLabel).toBe('High Risk Gap');
      expect(result.criterionCoverage[0].isRisk).toBe(true);
    });

    test('sorts by weight * (100 - coverage) for non-risk items', () => {
      const strategy = createMockStrategy({
        evaluationCriteria: [
          { label: 'Low Weight Full Coverage', weight: 0.1, primarySections: ['approach'] },
          { label: 'High Weight Full Coverage', weight: 0.5, primarySections: ['approach'] },
        ],
      });

      const sections = [
        createMockSection({
          sectionKey: 'approach',
          status: 'draft',
          generatedUsing: { hasWinStrategy: true, winThemesApplied: [], proofItemsApplied: [] },
        }),
      ];

      const result = computeRubricCoverage(strategy, sections);

      // Both have 100% coverage so priority = weight * 0
      // Should fall back to original index order
      expect(result.criterionCoverage[0].criterionLabel).toBe('Low Weight Full Coverage');
    });
  });

  describe('section coverage computation', () => {
    test('computes section coverage scores', () => {
      const strategy = createMockStrategy({
        evaluationCriteria: [
          { label: 'Technical Approach', weight: 0.4, primarySections: ['approach'] },
          { label: 'Innovation', weight: 0.3, primarySections: ['approach'] },
        ],
      });

      const sections = [
        createMockSection({
          sectionKey: 'approach',
          status: 'draft',
          generatedUsing: { hasWinStrategy: true, winThemesApplied: [], proofItemsApplied: [] },
        }),
      ];

      const result = computeRubricCoverage(strategy, sections);

      expect(result.sectionCoverage.length).toBe(1);
      expect(result.sectionCoverage[0].sectionKey).toBe('approach');
      expect(result.sectionCoverage[0].criteriaTouched.length).toBe(2);
    });

    test('flags sections needing review for missing high-weight criteria', () => {
      const strategy = createMockStrategy({
        evaluationCriteria: [
          { label: 'Team Expertise', weight: 0.4, primarySections: ['team'] },
        ],
      });

      const sections = [
        createMockSection({
          sectionKey: 'team',
          status: 'empty', // Empty - not covering
          generatedUsing: null,
        }),
      ];

      const result = computeRubricCoverage(strategy, sections);

      expect(result.sectionCoverage[0].needsReview).toBe(true);
      expect(result.sectionCoverage[0].missingHighWeightCriteria).toContain('Team Expertise');
    });
  });

  describe('proof coverage', () => {
    test('calculates proof coverage based on applied proof items', () => {
      const strategy = createMockStrategy({
        evaluationCriteria: [
          { label: 'Technical', weight: 0.4, primarySections: ['approach'] },
        ],
        proofPlan: [
          { type: 'case_study', id: 'cs_1', priority: 5 },
          { type: 'case_study', id: 'cs_2', priority: 3 },
        ],
      });

      const sections = [
        createMockSection({
          sectionKey: 'approach',
          status: 'draft',
          generatedUsing: {
            hasWinStrategy: true,
            winThemesApplied: [],
            proofItemsApplied: ['cs_1'], // Only one applied
          },
        }),
      ];

      const result = computeRubricCoverage(strategy, sections);

      // cs_1 has priority 5, cs_2 has priority 3, total = 8
      // Applied cs_1 = 5/8 = 62.5% -> 63%
      expect(result.criterionCoverage[0].proofCoverageScore).toBe(63);
    });

    test('gives 100% proof coverage when no proof plan', () => {
      const strategy = createMockStrategy({
        evaluationCriteria: [
          { label: 'Technical', weight: 0.4, primarySections: ['approach'] },
        ],
        proofPlan: [], // No proof required
      });

      const sections = [
        createMockSection({
          sectionKey: 'approach',
          status: 'draft',
          generatedUsing: { hasWinStrategy: true, winThemesApplied: [], proofItemsApplied: [] },
        }),
      ];

      const result = computeRubricCoverage(strategy, sections);

      expect(result.criterionCoverage[0].proofCoverageScore).toBe(100);
    });
  });

  describe('overall health calculation', () => {
    test('calculates weighted overall health', () => {
      const strategy = createMockStrategy({
        evaluationCriteria: [
          { label: 'High Weight', weight: 0.6, primarySections: ['approach'] },
          { label: 'Low Weight', weight: 0.4, primarySections: ['team'] },
        ],
      });

      const sections = [
        createMockSection({
          sectionKey: 'approach',
          status: 'draft',
          generatedUsing: { hasWinStrategy: true, winThemesApplied: [], proofItemsApplied: [] },
        }),
        // team section missing
      ];

      const result = computeRubricCoverage(strategy, sections);

      // High Weight: 100% * 0.6 = 60
      // Low Weight: 0% * 0.4 = 0
      // Total = 60 / 1.0 = 60%
      expect(result.overallHealth).toBe(60);
    });

    test('counts uncovered high-weight criteria', () => {
      const strategy = createMockStrategy({
        evaluationCriteria: [
          { label: 'High Weight 1', weight: 0.4, primarySections: ['team'] },
          { label: 'High Weight 2', weight: 0.3, primarySections: ['pricing'] },
          { label: 'Low Weight', weight: 0.1, primarySections: ['references'] },
        ],
      });

      const sections = [
        createMockSection({
          sectionKey: 'approach',
          status: 'draft',
          generatedUsing: { hasWinStrategy: true, winThemesApplied: [], proofItemsApplied: [] },
        }),
      ];

      const result = computeRubricCoverage(strategy, sections);

      expect(result.uncoveredHighWeightCount).toBe(2); // Both high-weight criteria uncovered
    });
  });

  describe('notes generation', () => {
    test('adds note when criterion is not covered', () => {
      const strategy = createMockStrategy({
        evaluationCriteria: [
          { label: 'Missing', weight: 0.3, primarySections: ['team'] },
        ],
      });

      const sections = [
        createMockSection({ sectionKey: 'approach' }),
      ];

      const result = computeRubricCoverage(strategy, sections);

      expect(result.criterionCoverage[0].notes).toContain('Not covered by any section');
    });

    test('adds note for low proof coverage', () => {
      const strategy = createMockStrategy({
        evaluationCriteria: [
          { label: 'Technical', weight: 0.4, primarySections: ['approach'] },
        ],
        proofPlan: [
          { type: 'case_study', id: 'cs_1', priority: 5 },
          { type: 'case_study', id: 'cs_2', priority: 5 },
        ],
      });

      const sections = [
        createMockSection({
          sectionKey: 'approach',
          status: 'draft',
          generatedUsing: {
            hasWinStrategy: true,
            winThemesApplied: [],
            proofItemsApplied: [], // No proof applied
          },
        }),
      ];

      const result = computeRubricCoverage(strategy, sections);

      expect(result.criterionCoverage[0].notes.some(n => n.includes('Low proof coverage'))).toBe(true);
    });

    test('adds note for high-weight criterion with gaps', () => {
      const strategy = createMockStrategy({
        evaluationCriteria: [
          { label: 'Important', weight: 0.4, primarySections: ['approach', 'team'] },
        ],
      });

      const sections = [
        createMockSection({
          sectionKey: 'approach',
          status: 'draft',
          generatedUsing: { hasWinStrategy: true, winThemesApplied: [], proofItemsApplied: [] },
        }),
        // team missing
      ];

      const result = computeRubricCoverage(strategy, sections);

      expect(result.criterionCoverage[0].notes.some(n => n.includes('High-weight criterion'))).toBe(true);
    });
  });
});

describe('getSuggestedSectionsForReview', () => {
  test('returns suggested sections for a criterion', () => {
    const strategy = createMockStrategy({
      evaluationCriteria: [
        { label: 'Team Expertise', weight: 0.3, primarySections: ['team'] },
      ],
    });

    const sections = getSuggestedSectionsForReview('Team Expertise', strategy);

    expect(sections).toContain('team');
  });

  test('returns empty array for unknown criterion', () => {
    const strategy = createMockStrategy({
      evaluationCriteria: [
        { label: 'Known', weight: 0.3 },
      ],
    });

    const sections = getSuggestedSectionsForReview('Unknown', strategy);

    expect(sections).toEqual([]);
  });
});

describe('getShortSectionLabel', () => {
  test('returns short labels for known sections', () => {
    expect(getShortSectionLabel('agency_overview')).toBe('Overview');
    expect(getShortSectionLabel('approach')).toBe('Approach');
    expect(getShortSectionLabel('team')).toBe('Team');
    expect(getShortSectionLabel('work_samples')).toBe('Work');
    expect(getShortSectionLabel('plan_timeline')).toBe('Plan');
    expect(getShortSectionLabel('pricing')).toBe('Pricing');
    expect(getShortSectionLabel('references')).toBe('Refs');
  });

  test('returns key for unknown sections', () => {
    expect(getShortSectionLabel('custom_section')).toBe('custom_section');
  });
});

describe('getCoverageStatusClass', () => {
  test('returns emerald for high scores', () => {
    expect(getCoverageStatusClass(100)).toContain('emerald');
    expect(getCoverageStatusClass(80)).toContain('emerald');
  });

  test('returns amber for medium scores', () => {
    expect(getCoverageStatusClass(79)).toContain('amber');
    expect(getCoverageStatusClass(50)).toContain('amber');
  });

  test('returns red for low scores', () => {
    expect(getCoverageStatusClass(49)).toContain('red');
    expect(getCoverageStatusClass(0)).toContain('red');
  });
});

describe('isCriterionCoveredBySection', () => {
  test('returns true when criterion is covered by section', () => {
    const strategy = createMockStrategy({
      evaluationCriteria: [
        { label: 'Technical', weight: 0.4, primarySections: ['approach'] },
      ],
    });

    const sections = [
      createMockSection({
        sectionKey: 'approach',
        status: 'draft',
        generatedUsing: { hasWinStrategy: true, winThemesApplied: [], proofItemsApplied: [] },
      }),
    ];

    const coverage = computeRubricCoverage(strategy, sections);

    expect(isCriterionCoveredBySection('Technical', 'approach', coverage)).toBe(true);
  });

  test('returns false when criterion is not covered by section', () => {
    const strategy = createMockStrategy({
      evaluationCriteria: [
        { label: 'Technical', weight: 0.4, primarySections: ['approach'] },
      ],
    });

    const sections = [
      createMockSection({
        sectionKey: 'approach',
        status: 'draft',
        generatedUsing: { hasWinStrategy: true, winThemesApplied: [], proofItemsApplied: [] },
      }),
    ];

    const coverage = computeRubricCoverage(strategy, sections);

    expect(isCriterionCoveredBySection('Technical', 'team', coverage)).toBe(false);
  });

  test('returns false for unknown criterion', () => {
    const strategy = createMockStrategy({
      evaluationCriteria: [
        { label: 'Technical', weight: 0.4 },
      ],
    });

    const sections = [createMockSection()];
    const coverage = computeRubricCoverage(strategy, sections);

    expect(isCriterionCoveredBySection('Unknown', 'approach', coverage)).toBe(false);
  });
});
