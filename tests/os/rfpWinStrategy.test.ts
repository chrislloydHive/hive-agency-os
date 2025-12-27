// tests/os/rfpWinStrategy.test.ts
// Tests for RFP Win Strategy types and functions

import { describe, test, expect } from 'vitest';
import {
  RfpWinStrategySchema,
  RfpWinThemeSchema,
  RfpEvaluationCriterionSchema,
  RfpProofItemSchema,
  RfpLandmineSchema,
  computeStrategyHealth,
  createEmptyWinStrategy,
  type RfpWinStrategy,
  type RfpWinTheme,
  type RfpEvaluationCriterion,
} from '@/lib/types/rfpWinStrategy';

describe('rfpWinStrategy', () => {
  describe('RfpWinThemeSchema', () => {
    test('validates a complete theme', () => {
      const theme = {
        id: 'theme_1',
        label: 'Speed to Market',
        description: 'We deliver faster than competitors',
        applicableSections: ['approach', 'team'],
      };

      const result = RfpWinThemeSchema.safeParse(theme);
      expect(result.success).toBe(true);
    });

    test('requires label to be non-empty', () => {
      const theme = {
        id: 'theme_1',
        label: '',
        description: 'Description',
      };

      const result = RfpWinThemeSchema.safeParse(theme);
      expect(result.success).toBe(false);
    });

    test('applicableSections is optional', () => {
      const theme = {
        id: 'theme_1',
        label: 'Theme',
        description: 'Description',
      };

      const result = RfpWinThemeSchema.safeParse(theme);
      expect(result.success).toBe(true);
    });
  });

  describe('RfpEvaluationCriterionSchema', () => {
    test('validates a criterion with weight', () => {
      const criterion = {
        label: 'Technical Approach',
        weight: 0.4,
        guidance: 'Focus on methodology',
        primarySections: ['approach'],
        alignmentScore: 4,
        alignmentRationale: 'Strong methodology',
      };

      const result = RfpEvaluationCriterionSchema.safeParse(criterion);
      expect(result.success).toBe(true);
    });

    test('weight must be between 0 and 1', () => {
      const overWeight = { label: 'Test', weight: 1.5 };
      const underWeight = { label: 'Test', weight: -0.1 };
      const validWeight = { label: 'Test', weight: 0.5 };

      expect(RfpEvaluationCriterionSchema.safeParse(overWeight).success).toBe(false);
      expect(RfpEvaluationCriterionSchema.safeParse(underWeight).success).toBe(false);
      expect(RfpEvaluationCriterionSchema.safeParse(validWeight).success).toBe(true);
    });

    test('alignmentScore must be between 1 and 5', () => {
      const lowScore = { label: 'Test', alignmentScore: 0 };
      const highScore = { label: 'Test', alignmentScore: 6 };
      const validScore = { label: 'Test', alignmentScore: 3 };

      expect(RfpEvaluationCriterionSchema.safeParse(lowScore).success).toBe(false);
      expect(RfpEvaluationCriterionSchema.safeParse(highScore).success).toBe(false);
      expect(RfpEvaluationCriterionSchema.safeParse(validScore).success).toBe(true);
    });
  });

  describe('RfpProofItemSchema', () => {
    test('validates case study proof item', () => {
      const proof = {
        type: 'case_study',
        id: 'cs_123',
        usageGuidance: 'Use for technical capability',
        targetSections: ['work_samples'],
        priority: 5,
      };

      const result = RfpProofItemSchema.safeParse(proof);
      expect(result.success).toBe(true);
    });

    test('validates reference proof item', () => {
      const proof = {
        type: 'reference',
        id: 'ref_456',
        priority: 3,
      };

      const result = RfpProofItemSchema.safeParse(proof);
      expect(result.success).toBe(true);
    });

    test('priority must be between 1 and 5', () => {
      const lowPriority = { type: 'case_study', id: 'cs_1', priority: 0 };
      const highPriority = { type: 'case_study', id: 'cs_1', priority: 6 };
      const validPriority = { type: 'case_study', id: 'cs_1', priority: 3 };

      expect(RfpProofItemSchema.safeParse(lowPriority).success).toBe(false);
      expect(RfpProofItemSchema.safeParse(highPriority).success).toBe(false);
      expect(RfpProofItemSchema.safeParse(validPriority).success).toBe(true);
    });
  });

  describe('RfpLandmineSchema', () => {
    test('validates a complete landmine', () => {
      const landmine = {
        id: 'landmine_1',
        description: 'Pricing may be higher than competitors',
        severity: 'high',
        mitigation: 'Emphasize value and ROI',
        affectedSections: ['pricing'],
      };

      const result = RfpLandmineSchema.safeParse(landmine);
      expect(result.success).toBe(true);
    });

    test('severity must be valid enum value', () => {
      const validSeverities = ['low', 'medium', 'high', 'critical'];
      const invalidSeverity = { id: 'l1', description: 'Test', severity: 'extreme' };

      expect(RfpLandmineSchema.safeParse(invalidSeverity).success).toBe(false);

      for (const severity of validSeverities) {
        const landmine = { id: 'l1', description: 'Test', severity };
        expect(RfpLandmineSchema.safeParse(landmine).success).toBe(true);
      }
    });
  });

  describe('RfpWinStrategySchema', () => {
    test('validates a complete strategy', () => {
      const strategy: RfpWinStrategy = {
        evaluationCriteria: [{ label: 'Technical', weight: 0.4 }],
        winThemes: [{ id: 't1', label: 'Speed', description: 'Fast delivery' }],
        proofPlan: [{ type: 'case_study', id: 'cs_1', priority: 4 }],
        competitiveAssumptions: ['Better methodology'],
        landmines: [{ id: 'l1', description: 'Higher price', severity: 'medium' }],
        locked: false,
      };

      const result = RfpWinStrategySchema.safeParse(strategy);
      expect(result.success).toBe(true);
    });

    test('applies defaults for empty arrays', () => {
      const minimal = {};
      const result = RfpWinStrategySchema.safeParse(minimal);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.evaluationCriteria).toEqual([]);
        expect(result.data.winThemes).toEqual([]);
        expect(result.data.proofPlan).toEqual([]);
        expect(result.data.competitiveAssumptions).toEqual([]);
        expect(result.data.landmines).toEqual([]);
        expect(result.data.locked).toBe(false);
      }
    });

    test('validates locked state with metadata', () => {
      const lockedStrategy = {
        evaluationCriteria: [],
        winThemes: [],
        proofPlan: [],
        locked: true,
        lockedBy: 'user_123',
        lockedAt: new Date().toISOString(),
      };

      const result = RfpWinStrategySchema.safeParse(lockedStrategy);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.locked).toBe(true);
        expect(result.data.lockedBy).toBe('user_123');
      }
    });
  });

  describe('computeStrategyHealth', () => {
    test('returns isDefined: false for null strategy', () => {
      const health = computeStrategyHealth(null);
      expect(health.isDefined).toBe(false);
      expect(health.completenessScore).toBe(0);
      expect(health.issues).toContain('No win strategy defined');
    });

    test('returns isDefined: false for undefined strategy', () => {
      const health = computeStrategyHealth(undefined);
      expect(health.isDefined).toBe(false);
    });

    test('returns low score for empty strategy', () => {
      const empty = createEmptyWinStrategy();
      const health = computeStrategyHealth(empty);

      expect(health.isDefined).toBe(true);
      expect(health.completenessScore).toBeLessThan(30);
      expect(health.issues.length).toBeGreaterThan(0);
    });

    test('gives points for evaluation criteria', () => {
      const withCriteria = createEmptyWinStrategy();
      withCriteria.evaluationCriteria = [
        { label: 'Technical', weight: 0.4, guidance: 'Focus on methodology' },
        { label: 'Cost', weight: 0.3, guidance: 'Competitive pricing' },
      ];

      const health = computeStrategyHealth(withCriteria);
      expect(health.completenessScore).toBeGreaterThan(0);
    });

    test('gives points for win themes', () => {
      const withThemes = createEmptyWinStrategy();
      withThemes.winThemes = [
        { id: 't1', label: 'Speed', description: 'Fast delivery' },
        { id: 't2', label: 'Quality', description: 'High quality' },
        { id: 't3', label: 'Value', description: 'Great value' },
      ];

      const health = computeStrategyHealth(withThemes);
      expect(health.completenessScore).toBeGreaterThan(20);
    });

    test('gives points for proof plan', () => {
      const withProof = createEmptyWinStrategy();
      withProof.proofPlan = [
        { type: 'case_study', id: 'cs_1', priority: 5 },
        { type: 'case_study', id: 'cs_2', priority: 4 },
        { type: 'reference', id: 'ref_1', priority: 3 },
      ];

      const health = computeStrategyHealth(withProof);
      expect(health.completenessScore).toBeGreaterThan(0);
    });

    test('gives points for landmines with mitigation', () => {
      const withLandmines = createEmptyWinStrategy();
      withLandmines.landmines = [
        { id: 'l1', description: 'Risk 1', severity: 'high', mitigation: 'Solution 1' },
      ];

      const health = computeStrategyHealth(withLandmines);
      expect(health.completenessScore).toBeGreaterThan(0);
    });

    test('high score for complete strategy', () => {
      const complete: RfpWinStrategy = {
        evaluationCriteria: [
          { label: 'Technical', weight: 0.4, guidance: 'Method' },
          { label: 'Cost', weight: 0.3, guidance: 'Price' },
          { label: 'Team', weight: 0.3, guidance: 'People' },
        ],
        winThemes: [
          { id: 't1', label: 'Speed', description: 'Fast' },
          { id: 't2', label: 'Quality', description: 'Good' },
          { id: 't3', label: 'Value', description: 'Worth' },
        ],
        proofPlan: [
          { type: 'case_study', id: 'cs_1', priority: 5 },
          { type: 'case_study', id: 'cs_2', priority: 4 },
          { type: 'reference', id: 'ref_1', priority: 3 },
        ],
        competitiveAssumptions: ['Better methodology'],
        landmines: [
          { id: 'l1', description: 'Risk', severity: 'medium', mitigation: 'Solution' },
        ],
        locked: false,
      };

      const health = computeStrategyHealth(complete);
      expect(health.completenessScore).toBeGreaterThanOrEqual(70);
      expect(health.issues.length).toBe(0);
    });

    test('tracks locked state', () => {
      const locked = createEmptyWinStrategy();
      locked.locked = true;

      const health = computeStrategyHealth(locked);
      expect(health.isLocked).toBe(true);
    });

    test('provides suggestions for incomplete strategy', () => {
      const incomplete = createEmptyWinStrategy();
      incomplete.evaluationCriteria = [{ label: 'Test' }]; // No weight or guidance

      const health = computeStrategyHealth(incomplete);
      expect(health.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('createEmptyWinStrategy', () => {
    test('returns a valid empty strategy', () => {
      const empty = createEmptyWinStrategy();

      expect(empty.evaluationCriteria).toEqual([]);
      expect(empty.winThemes).toEqual([]);
      expect(empty.proofPlan).toEqual([]);
      expect(empty.competitiveAssumptions).toEqual([]);
      expect(empty.landmines).toEqual([]);
      expect(empty.locked).toBe(false);
    });

    test('returns a new object each time', () => {
      const empty1 = createEmptyWinStrategy();
      const empty2 = createEmptyWinStrategy();

      expect(empty1).not.toBe(empty2);
      empty1.winThemes.push({ id: 't1', label: 'Test', description: 'Test' });
      expect(empty2.winThemes).toEqual([]);
    });

    test('validates against schema', () => {
      const empty = createEmptyWinStrategy();
      const result = RfpWinStrategySchema.safeParse(empty);
      expect(result.success).toBe(true);
    });
  });
});
