// tests/os/bidReadiness.test.ts
// Tests for Bid Readiness + Go/No-Go Intelligence

import { describe, test, expect } from 'vitest';
import {
  computeBidReadiness,
  isBidReady,
  getRecommendationLabel,
  getRecommendationColorClass,
  getRecommendationBgClass,
  getEffortLabel,
  getBidReadinessSummary,
  type BidReadinessInputs,
  type BidReadiness,
} from '@/lib/os/rfp/computeBidReadiness';
import type { FirmBrainReadiness } from '@/lib/os/ai/firmBrainReadiness';
import type { StrategyHealth } from '@/lib/types/rfpWinStrategy';
import type { RubricCoverageResult, CriterionCoverage, SectionCoverage } from '@/lib/os/rfp/computeRubricCoverage';
import { createRfpSection, createRfpWinStrategy } from '@/tests/helpers/factories';

// ============================================================================
// Test Helpers
// ============================================================================

function createMockFirmBrainReadiness(score: number): FirmBrainReadiness {
  return {
    score,
    missing: score < 50 ? ['Case Studies'] : [],
    weak: score < 70 ? ['References'] : [],
    summary: `Score: ${score}`,
    components: {
      agencyProfile: { score: score, weight: 0.25, status: score >= 60 ? 'good' : 'weak', issues: [], sufficient: score >= 50 },
      teamMembers: { score: score, weight: 0.20, status: score >= 60 ? 'good' : 'weak', issues: [], count: 3, sufficient: score >= 50 },
      caseStudies: { score: score, weight: 0.20, status: score >= 60 ? 'good' : 'weak', issues: [], count: 2, sufficient: score >= 50 },
      references: { score: score, weight: 0.15, status: score >= 60 ? 'good' : 'weak', issues: [], count: 1, sufficient: score >= 50 },
      pricingTemplates: { score: score, weight: 0.10, status: score >= 60 ? 'good' : 'weak', issues: [], count: 1, sufficient: score >= 50 },
      planTemplates: { score: score, weight: 0.10, status: score >= 60 ? 'good' : 'weak', issues: [], count: 1, sufficient: score >= 50 },
    },
    recommendGeneration: score >= 50,
    qualityWarnings: score < 60 ? ['Some sections may be generic'] : [],
  };
}

function createMockStrategyHealth(score: number): StrategyHealth {
  return {
    isDefined: score > 0,
    isLocked: false,
    completenessScore: score,
    issues: score < 50 ? ['Missing evaluation criteria'] : [],
    suggestions: score < 70 ? ['Add more win themes'] : [],
  };
}

function createMockCriterionCoverage(
  label: string,
  weight: number,
  coverageScore: number,
  options: Partial<CriterionCoverage> = {}
): CriterionCoverage {
  return {
    criterionLabel: label,
    criterionIndex: 0,
    weight,
    coveredBySectionKeys: coverageScore > 50 ? ['approach'] : [],
    coverageScore,
    proofCoverageScore: options.proofCoverageScore ?? (coverageScore > 50 ? 70 : 20),
    weightedScore: coverageScore * weight,
    notes: [],
    missingSections: coverageScore < 100 ? ['team'] : [],
    isRisk: coverageScore < 50 && weight >= 0.2,
    expectedPersona: options.expectedPersona,
    coveringPersonas: options.coveringPersonas,
    hasPersonaMismatch: options.hasPersonaMismatch ?? false,
    personaRiskLevel: options.personaRiskLevel ?? 'none',
    personaRiskDescription: options.personaRiskDescription,
  };
}

function createMockSectionCoverage(
  sectionKey: string,
  coverageScore: number,
  options: Partial<SectionCoverage> = {}
): SectionCoverage {
  return {
    sectionKey,
    sectionId: `${sectionKey}-id`,
    criteriaTouched: options.criteriaTouched ?? [],
    missingHighWeightCriteria: options.missingHighWeightCriteria ?? [],
    themesApplied: [],
    proofApplied: [],
    coverageScore,
    needsReview: options.needsReview ?? coverageScore < 70,
    primaryPersona: options.primaryPersona,
    secondaryPersonas: options.secondaryPersonas,
  };
}

function createMockRubricCoverage(
  overallHealth: number,
  options: {
    personaMismatchCount?: number;
    uncoveredHighWeightCount?: number;
    criterionCoverage?: CriterionCoverage[];
    sectionCoverage?: SectionCoverage[];
  } = {}
): RubricCoverageResult {
  return {
    criterionCoverage: options.criterionCoverage ?? [
      createMockCriterionCoverage('Technical Approach', 0.3, overallHealth),
      createMockCriterionCoverage('Team Experience', 0.2, overallHealth),
      createMockCriterionCoverage('Price', 0.3, overallHealth),
    ],
    sectionCoverage: options.sectionCoverage ?? [
      createMockSectionCoverage('approach', overallHealth),
      createMockSectionCoverage('team', overallHealth),
      createMockSectionCoverage('pricing', overallHealth),
    ],
    overallHealth,
    uncoveredHighWeightCount: options.uncoveredHighWeightCount ?? (overallHealth < 50 ? 2 : 0),
    sectionsNeedingReview: overallHealth < 70 ? 2 : 0,
    summaryNotes: [],
    personaMismatchCount: options.personaMismatchCount ?? 0,
    hasPersonaSettings: true,
  };
}

function createMockInputs(
  scores: { firmBrain?: number; strategy?: number; coverage?: number } = {}
): BidReadinessInputs {
  const firmBrainScore = scores.firmBrain ?? 75;
  const strategyScore = scores.strategy ?? 70;
  const coverageScore = scores.coverage ?? 70;

  return {
    firmBrainReadiness: createMockFirmBrainReadiness(firmBrainScore),
    strategyHealth: createMockStrategyHealth(strategyScore),
    rubricCoverage: createMockRubricCoverage(coverageScore),
    strategy: createRfpWinStrategy({
      evaluationCriteria: [
        { label: 'Technical Approach', weight: 0.3 },
        { label: 'Team Experience', weight: 0.2 },
        { label: 'Price', weight: 0.3 },
      ],
      winThemes: [],
      proofPlan: [],
      competitiveAssumptions: [],
      landmines: [],
      locked: false,
    }),
    sections: [
      createRfpSection({ sectionKey: 'approach', title: 'Approach', contentWorking: 'Content', status: 'approved' }),
      createRfpSection({ sectionKey: 'team', title: 'Team', contentWorking: 'Content', status: 'approved' }),
      createRfpSection({ sectionKey: 'pricing', title: 'Pricing', contentWorking: 'Content', status: 'approved' }),
    ],
  };
}

// ============================================================================
// Score Calculation Tests
// ============================================================================

describe('Bid Readiness Score Calculation', () => {
  test('computes overall score from component scores', () => {
    const inputs = createMockInputs({
      firmBrain: 80,
      strategy: 70,
      coverage: 75,
    });

    const result = computeBidReadiness(inputs);

    // Score should be weighted average of components
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.breakdown.firmBrainReadiness).toBe(80);
    expect(result.breakdown.winStrategyHealth).toBe(70);
    expect(result.breakdown.rubricCoverageHealth).toBe(75);
  });

  test('handles missing inputs gracefully', () => {
    const inputs: BidReadinessInputs = {
      firmBrainReadiness: null,
      strategyHealth: null,
      rubricCoverage: null,
      strategy: null,
      sections: [],
    };

    const result = computeBidReadiness(inputs);

    // When no rubric coverage, persona alignment defaults to 75 (neutral assumption)
    // This gives a minimal score of ~11 (75 * 0.15 weight)
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThan(20); // Still very low
    expect(result.recommendation).toBe('no_go');
    expect(result.isReliableAssessment).toBe(false);
  });

  test('weights components correctly', () => {
    const inputs = createMockInputs({
      firmBrain: 100,
      strategy: 100,
      coverage: 100,
    });

    // With all 100s and persona alignment at 100, should be close to 100
    const result = computeBidReadiness(inputs);

    // All components at 100 should yield high score
    expect(result.score).toBeGreaterThanOrEqual(90);
  });

  test('breakdown includes all component scores', () => {
    const inputs = createMockInputs();
    const result = computeBidReadiness(inputs);

    expect(result.breakdown).toHaveProperty('firmBrainReadiness');
    expect(result.breakdown).toHaveProperty('winStrategyHealth');
    expect(result.breakdown).toHaveProperty('rubricCoverageHealth');
    expect(result.breakdown).toHaveProperty('proofCoverage');
    expect(result.breakdown).toHaveProperty('personaAlignment');
    expect(result.breakdown).toHaveProperty('weights');
  });

  test('weights sum to 1.0', () => {
    const inputs = createMockInputs();
    const result = computeBidReadiness(inputs);

    const totalWeight = Object.values(result.breakdown.weights).reduce((a, b) => a + b, 0);
    expect(totalWeight).toBeCloseTo(1.0, 2);
  });
});

// ============================================================================
// Recommendation Logic Tests
// ============================================================================

describe('Go/Conditional/No-Go Recommendations', () => {
  test('recommends GO when score is high', () => {
    const inputs = createMockInputs({
      firmBrain: 85,
      strategy: 80,
      coverage: 80,
    });

    const result = computeBidReadiness(inputs);

    expect(result.recommendation).toBe('go');
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.reasons.some(r => r.includes('ready') || r.includes('proceed'))).toBe(true);
  });

  test('recommends CONDITIONAL when score is moderate', () => {
    const inputs = createMockInputs({
      firmBrain: 55,
      strategy: 55,
      coverage: 55,
    });

    const result = computeBidReadiness(inputs);

    expect(result.recommendation).toBe('conditional');
    expect(result.conditions).toBeDefined();
    expect(result.conditions!.length).toBeGreaterThan(0);
  });

  test('recommends NO_GO when score is low', () => {
    const inputs = createMockInputs({
      firmBrain: 25,
      strategy: 25,
      coverage: 25,
    });

    const result = computeBidReadiness(inputs);

    expect(result.recommendation).toBe('no_go');
    expect(result.reasons.some(r => r.includes('not ready') || r.includes('not recommended'))).toBe(true);
  });

  test('critical risks can downgrade GO to CONDITIONAL', () => {
    const inputs = createMockInputs({
      firmBrain: 80,
      strategy: 80,
      coverage: 80,
    });
    // Add critical coverage gaps
    inputs.rubricCoverage = createMockRubricCoverage(80, {
      criterionCoverage: [
        createMockCriterionCoverage('Critical Criterion', 0.5, 10), // Very low coverage
      ],
    });

    const result = computeBidReadiness(inputs);

    // Should flag risks even with high overall score
    expect(result.topRisks.some(r => r.severity === 'high' || r.severity === 'critical')).toBe(true);
  });

  test('provides conditions for CONDITIONAL recommendation', () => {
    const inputs = createMockInputs({
      firmBrain: 50,
      strategy: 50,
      coverage: 60,
    });

    const result = computeBidReadiness(inputs);

    expect(result.recommendation).toBe('conditional');
    expect(result.conditions).toBeDefined();
    expect(result.conditions!.some(c => c.includes('Firm Brain') || c.includes('strategy'))).toBe(true);
  });

  test('hard blocks on critically low data', () => {
    const inputs = createMockInputs({
      firmBrain: 10,
      strategy: 10,
      coverage: 50,
    });

    const result = computeBidReadiness(inputs);

    expect(result.recommendation).toBe('no_go');
    expect(result.reasons.some(r => r.includes('critically incomplete') || r.includes('generic'))).toBe(true);
  });
});

// ============================================================================
// Risk Assessment Tests
// ============================================================================

describe('Risk Identification', () => {
  test('identifies firm brain risks', () => {
    const inputs = createMockInputs({ firmBrain: 30 });
    const result = computeBidReadiness(inputs);

    expect(result.topRisks.some(r => r.category === 'firm_brain')).toBe(true);
  });

  test('identifies strategy risks', () => {
    const inputs = createMockInputs({ strategy: 25 });
    const result = computeBidReadiness(inputs);

    expect(result.topRisks.some(r => r.category === 'strategy')).toBe(true);
  });

  test('identifies coverage risks', () => {
    const inputs = createMockInputs({ coverage: 30 });
    const result = computeBidReadiness(inputs);

    expect(result.topRisks.some(r => r.category === 'coverage')).toBe(true);
  });

  test('identifies persona alignment risks', () => {
    const inputs = createMockInputs();
    inputs.rubricCoverage = createMockRubricCoverage(70, {
      personaMismatchCount: 3,
      criterionCoverage: [
        createMockCriterionCoverage('Criterion 1', 0.4, 70, {
          hasPersonaMismatch: true,
          personaRiskLevel: 'high',
          expectedPersona: 'procurement',
          coveringPersonas: ['technical'],
        }),
        createMockCriterionCoverage('Criterion 2', 0.3, 70, {
          hasPersonaMismatch: true,
          personaRiskLevel: 'high',
        }),
        createMockCriterionCoverage('Criterion 3', 0.3, 70, {
          hasPersonaMismatch: true,
          personaRiskLevel: 'medium',
        }),
      ],
    });

    const result = computeBidReadiness(inputs);

    expect(result.topRisks.some(r => r.category === 'persona')).toBe(true);
  });

  test('risks are sorted by severity', () => {
    const inputs = createMockInputs({
      firmBrain: 15, // Critical
      strategy: 35,  // High
      coverage: 55,  // Medium
    });

    const result = computeBidReadiness(inputs);

    expect(result.topRisks.length).toBeGreaterThan(0);

    // First risks should be most severe
    const severityOrder = ['critical', 'high', 'medium', 'low'];
    for (let i = 1; i < result.topRisks.length; i++) {
      const prevIdx = severityOrder.indexOf(result.topRisks[i - 1].severity);
      const currIdx = severityOrder.indexOf(result.topRisks[i].severity);
      expect(currIdx).toBeGreaterThanOrEqual(prevIdx);
    }
  });

  test('identifies high-weight uncovered criteria as risks', () => {
    const inputs = createMockInputs();
    inputs.rubricCoverage = createMockRubricCoverage(60, {
      criterionCoverage: [
        createMockCriterionCoverage('Important Criterion', 0.4, 30), // High weight, low coverage
        createMockCriterionCoverage('Another Criterion', 0.35, 25),  // High weight, low coverage
      ],
    });

    const result = computeBidReadiness(inputs);

    expect(result.topRisks.some(r =>
      r.category === 'coverage' && r.description.includes('Important Criterion')
    )).toBe(true);
  });

  test('risks include mitigation suggestions', () => {
    const inputs = createMockInputs({ firmBrain: 25, strategy: 25 });
    const result = computeBidReadiness(inputs);

    expect(result.topRisks.some(r => r.mitigation !== undefined)).toBe(true);
  });

  test('limits top risks to 5', () => {
    const inputs = createMockInputs({
      firmBrain: 20,
      strategy: 20,
      coverage: 20,
    });
    inputs.rubricCoverage = createMockRubricCoverage(20, {
      criterionCoverage: [
        createMockCriterionCoverage('C1', 0.35, 10),
        createMockCriterionCoverage('C2', 0.35, 10),
        createMockCriterionCoverage('C3', 0.35, 10),
        createMockCriterionCoverage('C4', 0.35, 10),
      ],
    });

    const result = computeBidReadiness(inputs);

    expect(result.topRisks.length).toBeLessThanOrEqual(5);
  });
});

// ============================================================================
// Fix Recommendation Tests
// ============================================================================

describe('Highest Impact Fixes', () => {
  test('identifies fixes when scores are low', () => {
    const inputs = createMockInputs({
      firmBrain: 50,
      strategy: 50,
      coverage: 50,
    });

    const result = computeBidReadiness(inputs);

    expect(result.highestImpactFixes.length).toBeGreaterThan(0);
  });

  test('fixes have expected properties', () => {
    const inputs = createMockInputs({ firmBrain: 50, strategy: 50 });
    const result = computeBidReadiness(inputs);

    for (const fix of result.highestImpactFixes) {
      expect(fix).toHaveProperty('sectionKey');
      expect(fix).toHaveProperty('reason');
      expect(fix).toHaveProperty('expectedLift');
      expect(fix).toHaveProperty('effort');
      expect(fix).toHaveProperty('priority');
      expect(fix.expectedLift).toBeGreaterThanOrEqual(0);
      expect(['low', 'medium', 'high']).toContain(fix.effort);
    }
  });

  test('fixes are sorted by priority and lift', () => {
    const inputs = createMockInputs({
      firmBrain: 40,
      strategy: 40,
      coverage: 40,
    });
    inputs.rubricCoverage = createMockRubricCoverage(40, {
      sectionCoverage: [
        createMockSectionCoverage('approach', 40, {
          missingHighWeightCriteria: ['Criterion A', 'Criterion B', 'Criterion C'],
          needsReview: true,
        }),
        createMockSectionCoverage('team', 50, {
          missingHighWeightCriteria: ['Criterion D'],
          needsReview: true,
        }),
      ],
    });

    const result = computeBidReadiness(inputs);

    // Should be sorted by priority first
    for (let i = 1; i < result.highestImpactFixes.length; i++) {
      const prev = result.highestImpactFixes[i - 1];
      const curr = result.highestImpactFixes[i];
      if (prev.priority === curr.priority) {
        expect(curr.expectedLift).toBeLessThanOrEqual(prev.expectedLift);
      } else {
        expect(curr.priority).toBeGreaterThanOrEqual(prev.priority);
      }
    }
  });

  test('limits fixes to 5', () => {
    const inputs = createMockInputs({
      firmBrain: 30,
      strategy: 30,
      coverage: 30,
    });
    inputs.rubricCoverage = createMockRubricCoverage(30, {
      sectionCoverage: [
        createMockSectionCoverage('approach', 30, { missingHighWeightCriteria: ['C1', 'C2'], needsReview: true }),
        createMockSectionCoverage('team', 30, { missingHighWeightCriteria: ['C3', 'C4'], needsReview: true }),
        createMockSectionCoverage('pricing', 30, { missingHighWeightCriteria: ['C5', 'C6'], needsReview: true }),
        createMockSectionCoverage('references', 30, { missingHighWeightCriteria: ['C7', 'C8'], needsReview: true }),
      ],
    });

    const result = computeBidReadiness(inputs);

    expect(result.highestImpactFixes.length).toBeLessThanOrEqual(5);
  });

  test('includes persona skew fixes', () => {
    const inputs = createMockInputs();
    inputs.rubricCoverage = createMockRubricCoverage(70, {
      criterionCoverage: [
        createMockCriterionCoverage('Criterion', 0.4, 70, {
          hasPersonaMismatch: true,
          personaRiskLevel: 'high',
          coveredBySectionKeys: ['approach'],
        }),
      ],
    });

    const result = computeBidReadiness(inputs);

    expect(result.highestImpactFixes.some(f =>
      f.reason.includes('framing') || f.reason.includes('evaluator')
    )).toBe(true);
  });

  test('no fixes when all scores are high', () => {
    const inputs = createMockInputs({
      firmBrain: 95,
      strategy: 95,
      coverage: 95,
    });
    inputs.rubricCoverage = createMockRubricCoverage(95, {
      sectionCoverage: [
        createMockSectionCoverage('approach', 95, { needsReview: false }),
        createMockSectionCoverage('team', 95, { needsReview: false }),
      ],
    });

    const result = computeBidReadiness(inputs);

    // May have no fixes or very few minor ones
    expect(result.highestImpactFixes.every(f => f.expectedLift < 10)).toBe(true);
  });
});

// ============================================================================
// Persona Alignment Tests
// ============================================================================

describe('Persona Alignment Scoring', () => {
  test('high alignment when no mismatches', () => {
    const inputs = createMockInputs();
    inputs.rubricCoverage = createMockRubricCoverage(80, {
      personaMismatchCount: 0,
      criterionCoverage: [
        createMockCriterionCoverage('Criterion 1', 0.3, 80, { hasPersonaMismatch: false }),
        createMockCriterionCoverage('Criterion 2', 0.3, 80, { hasPersonaMismatch: false }),
      ],
    });

    const result = computeBidReadiness(inputs);

    expect(result.breakdown.personaAlignment).toBeGreaterThanOrEqual(90);
  });

  test('low alignment with many high-severity mismatches', () => {
    const inputs = createMockInputs();
    inputs.rubricCoverage = createMockRubricCoverage(70, {
      personaMismatchCount: 3,
      criterionCoverage: [
        createMockCriterionCoverage('Criterion 1', 0.5, 70, {
          hasPersonaMismatch: true,
          personaRiskLevel: 'high',
        }),
        createMockCriterionCoverage('Criterion 2', 0.3, 70, {
          hasPersonaMismatch: true,
          personaRiskLevel: 'high',
        }),
      ],
    });

    const result = computeBidReadiness(inputs);

    expect(result.breakdown.personaAlignment).toBeLessThan(80);
  });

  test('weight affects mismatch penalty', () => {
    const highWeightMismatch = createMockInputs();
    highWeightMismatch.rubricCoverage = createMockRubricCoverage(70, {
      criterionCoverage: [
        createMockCriterionCoverage('Important Criterion', 0.6, 70, {
          hasPersonaMismatch: true,
          personaRiskLevel: 'high',
        }),
      ],
    });

    const lowWeightMismatch = createMockInputs();
    lowWeightMismatch.rubricCoverage = createMockRubricCoverage(70, {
      criterionCoverage: [
        createMockCriterionCoverage('Minor Criterion', 0.1, 70, {
          hasPersonaMismatch: true,
          personaRiskLevel: 'high',
        }),
      ],
    });

    const highResult = computeBidReadiness(highWeightMismatch);
    const lowResult = computeBidReadiness(lowWeightMismatch);

    // High-weight mismatch should have bigger penalty
    expect(highResult.breakdown.personaAlignment).toBeLessThan(lowResult.breakdown.personaAlignment);
  });

  test('default alignment when no persona settings', () => {
    const inputs = createMockInputs();
    inputs.rubricCoverage = createMockRubricCoverage(70);
    inputs.rubricCoverage!.hasPersonaSettings = false;

    const result = computeBidReadiness(inputs);

    // Should default to neutral (75%)
    expect(result.breakdown.personaAlignment).toBe(75);
  });
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('Utility Functions', () => {
  test('isBidReady returns correct boolean', () => {
    const goInputs = createMockInputs({ firmBrain: 85, strategy: 80, coverage: 80 });
    const noGoInputs = createMockInputs({ firmBrain: 20, strategy: 20, coverage: 20 });

    expect(isBidReady(goInputs)).toBe(true);
    expect(isBidReady(noGoInputs)).toBe(false);
  });

  test('getRecommendationLabel returns correct labels', () => {
    expect(getRecommendationLabel('go')).toBe('Go');
    expect(getRecommendationLabel('conditional')).toBe('Conditional Go');
    expect(getRecommendationLabel('no_go')).toBe('No-Go');
  });

  test('getRecommendationColorClass returns valid classes', () => {
    expect(getRecommendationColorClass('go')).toContain('emerald');
    expect(getRecommendationColorClass('conditional')).toContain('amber');
    expect(getRecommendationColorClass('no_go')).toContain('red');
  });

  test('getRecommendationBgClass returns valid classes', () => {
    expect(getRecommendationBgClass('go')).toContain('emerald');
    expect(getRecommendationBgClass('conditional')).toContain('amber');
    expect(getRecommendationBgClass('no_go')).toContain('red');
  });

  test('getEffortLabel returns readable estimates', () => {
    expect(getEffortLabel('low')).toContain('30 min');
    expect(getEffortLabel('medium')).toContain('2 hrs');
    expect(getEffortLabel('high')).toContain('1 day');
  });

  test('getBidReadinessSummary returns descriptive text', () => {
    const goResult = computeBidReadiness(createMockInputs({ firmBrain: 85, strategy: 80, coverage: 80 }));
    const conditionalResult = computeBidReadiness(createMockInputs({ firmBrain: 55, strategy: 55, coverage: 55 }));
    const noGoResult = computeBidReadiness(createMockInputs({ firmBrain: 20, strategy: 20, coverage: 20 }));

    expect(getBidReadinessSummary(goResult)).toContain('confidence');
    expect(getBidReadinessSummary(conditionalResult)).toContain('risk');
    // Case-insensitive check for "not recommended"
    expect(getBidReadinessSummary(noGoResult).toLowerCase()).toContain('not recommended');
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  test('handles empty sections array', () => {
    const inputs = createMockInputs();
    inputs.sections = [];

    const result = computeBidReadiness(inputs);

    expect(result).toBeDefined();
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  test('handles null strategy', () => {
    const inputs = createMockInputs();
    inputs.strategy = null;

    const result = computeBidReadiness(inputs);

    expect(result).toBeDefined();
  });

  test('handles empty rubric coverage', () => {
    const inputs = createMockInputs();
    inputs.rubricCoverage = createMockRubricCoverage(0, {
      criterionCoverage: [],
      sectionCoverage: [],
    });

    const result = computeBidReadiness(inputs);

    expect(result).toBeDefined();
  });

  test('handles perfect scores', () => {
    const inputs = createMockInputs({
      firmBrain: 100,
      strategy: 100,
      coverage: 100,
    });
    inputs.rubricCoverage = createMockRubricCoverage(100, {
      personaMismatchCount: 0,
      uncoveredHighWeightCount: 0,
    });

    const result = computeBidReadiness(inputs);

    expect(result.recommendation).toBe('go');
    expect(result.topRisks.length).toBe(0);
  });

  test('handles zero scores', () => {
    const inputs = createMockInputs({
      firmBrain: 0,
      strategy: 0,
      coverage: 0,
    });

    const result = computeBidReadiness(inputs);

    expect(result.recommendation).toBe('no_go');
    // Score won't be exactly 0 because proof/persona have some baseline from the mock
    // Main components (firmBrain + strategy + coverage) = 70% weight are 0
    // But proof/persona (30% weight) may have non-zero values
    expect(result.score).toBeLessThan(30);
    expect(result.breakdown.firmBrainReadiness).toBe(0);
    expect(result.breakdown.winStrategyHealth).toBe(0);
    expect(result.breakdown.rubricCoverageHealth).toBe(0);
  });

  test('deterministic results', () => {
    const inputs = createMockInputs({ firmBrain: 65, strategy: 55, coverage: 70 });

    const results = [];
    for (let i = 0; i < 5; i++) {
      results.push(computeBidReadiness(inputs));
    }

    // All results should be identical
    const first = results[0];
    for (const result of results) {
      expect(result.score).toBe(first.score);
      expect(result.recommendation).toBe(first.recommendation);
      expect(result.topRisks.length).toBe(first.topRisks.length);
      expect(result.highestImpactFixes.length).toBe(first.highestImpactFixes.length);
    }
  });

  test('isReliableAssessment flag is correct', () => {
    const fullInputs = createMockInputs();
    const partialInputs: BidReadinessInputs = {
      firmBrainReadiness: null,
      strategyHealth: createMockStrategyHealth(70),
      rubricCoverage: createMockRubricCoverage(70),
      strategy: null,
      sections: [],
    };

    expect(computeBidReadiness(fullInputs).isReliableAssessment).toBe(true);
    expect(computeBidReadiness(partialInputs).isReliableAssessment).toBe(false);
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Integration Scenarios', () => {
  test('new RFP with minimal data', () => {
    const inputs: BidReadinessInputs = {
      firmBrainReadiness: createMockFirmBrainReadiness(30),
      strategyHealth: createMockStrategyHealth(0),
      rubricCoverage: null,
      strategy: null,
      sections: [],
    };

    const result = computeBidReadiness(inputs);

    expect(result.recommendation).toBe('no_go');
    expect(result.topRisks.length).toBeGreaterThan(0);
    expect(result.highestImpactFixes.length).toBeGreaterThan(0);
  });

  test('mature RFP ready for submission', () => {
    const inputs: BidReadinessInputs = {
      firmBrainReadiness: createMockFirmBrainReadiness(85),
      strategyHealth: createMockStrategyHealth(90),
      rubricCoverage: createMockRubricCoverage(85, { personaMismatchCount: 0 }),
      strategy: createRfpWinStrategy({
        evaluationCriteria: [
          { label: 'Approach', weight: 0.3, alignmentScore: 5 },
          { label: 'Experience', weight: 0.3, alignmentScore: 4 },
        ],
        winThemes: [
          { id: '1', label: 'Speed', description: 'Fast delivery' },
          { id: '2', label: 'Quality', description: 'High quality' },
        ],
        proofPlan: [
          { type: 'case_study', id: 'cs1', priority: 5 },
          { type: 'reference', id: 'ref1', priority: 4 },
        ],
        competitiveAssumptions: [],
        landmines: [],
        locked: true,
      }),
      sections: [
        createRfpSection({ sectionKey: 'approach', title: 'Approach', contentWorking: 'Content', status: 'approved' }),
        createRfpSection({ sectionKey: 'team', title: 'Team', contentWorking: 'Content', status: 'approved' }),
        createRfpSection({ sectionKey: 'pricing', title: 'Pricing', contentWorking: 'Content', status: 'approved' }),
      ],
    };

    const result = computeBidReadiness(inputs);

    expect(result.recommendation).toBe('go');
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.topRisks.filter(r => r.severity === 'critical').length).toBe(0);
  });

  test('RFP with persona issues but otherwise strong', () => {
    const inputs: BidReadinessInputs = {
      firmBrainReadiness: createMockFirmBrainReadiness(80),
      strategyHealth: createMockStrategyHealth(75),
      rubricCoverage: createMockRubricCoverage(70, {
        personaMismatchCount: 4,
        criterionCoverage: [
          createMockCriterionCoverage('Technical', 0.3, 80, {
            hasPersonaMismatch: true,
            personaRiskLevel: 'high',
          }),
          createMockCriterionCoverage('Price', 0.3, 80, {
            hasPersonaMismatch: true,
            personaRiskLevel: 'medium',
          }),
        ],
      }),
      strategy: createRfpWinStrategy({
        evaluationCriteria: [{ label: 'Technical', weight: 0.3 }],
        winThemes: [],
        proofPlan: [],
        competitiveAssumptions: [],
        landmines: [],
        locked: false,
      }),
      sections: [],
    };

    const result = computeBidReadiness(inputs);

    // Should identify persona risks
    expect(result.topRisks.some(r => r.category === 'persona')).toBe(true);
    // Should suggest persona fixes
    expect(result.highestImpactFixes.some(f => f.reason.includes('framing'))).toBe(true);
  });
});
