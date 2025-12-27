// tests/os/rfpRequirementsParser.test.ts
// Tests for RFP requirements parsing schema and safe fallback behavior

import { describe, test, expect } from 'vitest';
import {
  hasRequirements,
  getRequirementsSummary,
  createEmptyRequirements,
} from '@/lib/os/rfp/parseRfpRequirements';
import {
  ParsedRfpRequirementsSchema,
  type ParsedRfpRequirements,
} from '@/lib/types/rfp';

describe('rfpRequirementsParser', () => {
  describe('ParsedRfpRequirementsSchema', () => {
    test('validates a complete valid requirements object', () => {
      const validRequirements = {
        deadline: '2024-03-15T17:00:00Z',
        submissionInstructions: ['Submit via email', 'Include PDF format'],
        complianceChecklist: ['Must have insurance', 'Must be incorporated'],
        evaluationCriteria: ['Technical approach (40%)', 'Cost (30%)'],
        requiredResponseSections: [
          {
            title: 'Company Overview',
            description: 'Describe your company',
            pageLimit: 2,
          },
        ],
        mustAnswerQuestions: ['What is your approach?'],
        wordLimit: 5000,
        pageLimit: 20,
        parseConfidence: 'high' as const,
      };

      const result = ParsedRfpRequirementsSchema.safeParse(validRequirements);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.deadline).toBe('2024-03-15T17:00:00Z');
        expect(result.data.submissionInstructions).toHaveLength(2);
        expect(result.data.requiredResponseSections).toHaveLength(1);
      }
    });

    test('applies defaults for empty arrays', () => {
      const minimalRequirements = {
        deadline: null,
      };

      const result = ParsedRfpRequirementsSchema.safeParse(minimalRequirements);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.submissionInstructions).toEqual([]);
        expect(result.data.complianceChecklist).toEqual([]);
        expect(result.data.evaluationCriteria).toEqual([]);
        expect(result.data.requiredResponseSections).toEqual([]);
        expect(result.data.mustAnswerQuestions).toEqual([]);
      }
    });

    test('accepts empty object and provides defaults', () => {
      const result = ParsedRfpRequirementsSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.deadline).toBeUndefined();
        expect(result.data.submissionInstructions).toEqual([]);
      }
    });

    test('validates parseConfidence enum values', () => {
      const highConfidence = { parseConfidence: 'high' };
      const mediumConfidence = { parseConfidence: 'medium' };
      const lowConfidence = { parseConfidence: 'low' };
      const invalidConfidence = { parseConfidence: 'very_high' };

      expect(ParsedRfpRequirementsSchema.safeParse(highConfidence).success).toBe(true);
      expect(ParsedRfpRequirementsSchema.safeParse(mediumConfidence).success).toBe(true);
      expect(ParsedRfpRequirementsSchema.safeParse(lowConfidence).success).toBe(true);
      expect(ParsedRfpRequirementsSchema.safeParse(invalidConfidence).success).toBe(false);
    });

    test('validates requiredResponseSections structure', () => {
      const withSections = {
        requiredResponseSections: [
          { title: 'Overview', description: 'Company info', pageLimit: 2, wordLimit: 500 },
          { title: 'Approach' }, // minimal valid section
        ],
      };

      const result = ParsedRfpRequirementsSchema.safeParse(withSections);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.requiredResponseSections).toHaveLength(2);
        expect(result.data.requiredResponseSections[0].pageLimit).toBe(2);
        expect(result.data.requiredResponseSections[1].description).toBeUndefined();
      }
    });

    test('rejects requiredResponseSections without title', () => {
      const invalidSections = {
        requiredResponseSections: [
          { description: 'No title provided' },
        ],
      };

      const result = ParsedRfpRequirementsSchema.safeParse(invalidSections);
      expect(result.success).toBe(false);
    });
  });

  describe('hasRequirements', () => {
    test('returns false for null/undefined', () => {
      expect(hasRequirements(null)).toBe(false);
      expect(hasRequirements(undefined)).toBe(false);
    });

    test('returns false for empty requirements', () => {
      const empty = createEmptyRequirements();
      expect(hasRequirements(empty)).toBe(false);
    });

    test('returns true when deadline is set', () => {
      const withDeadline: ParsedRfpRequirements = {
        ...createEmptyRequirements(),
        deadline: '2024-03-15',
      };
      expect(hasRequirements(withDeadline)).toBe(true);
    });

    test('returns true when submission instructions exist', () => {
      const withInstructions: ParsedRfpRequirements = {
        ...createEmptyRequirements(),
        submissionInstructions: ['Submit via email'],
      };
      expect(hasRequirements(withInstructions)).toBe(true);
    });

    test('returns true when compliance checklist exists', () => {
      const withChecklist: ParsedRfpRequirements = {
        ...createEmptyRequirements(),
        complianceChecklist: ['Must have insurance'],
      };
      expect(hasRequirements(withChecklist)).toBe(true);
    });

    test('returns true when evaluation criteria exist', () => {
      const withCriteria: ParsedRfpRequirements = {
        ...createEmptyRequirements(),
        evaluationCriteria: ['Technical (40%)'],
      };
      expect(hasRequirements(withCriteria)).toBe(true);
    });

    test('returns true when required sections exist', () => {
      const withSections: ParsedRfpRequirements = {
        ...createEmptyRequirements(),
        requiredResponseSections: [{ title: 'Overview' }],
      };
      expect(hasRequirements(withSections)).toBe(true);
    });

    test('returns true when must-answer questions exist', () => {
      const withQuestions: ParsedRfpRequirements = {
        ...createEmptyRequirements(),
        mustAnswerQuestions: ['What is your approach?'],
      };
      expect(hasRequirements(withQuestions)).toBe(true);
    });
  });

  describe('getRequirementsSummary', () => {
    test('returns "No requirements parsed" for empty requirements', () => {
      const empty = createEmptyRequirements();
      expect(getRequirementsSummary(empty)).toBe('No requirements parsed');
    });

    test('includes deadline in summary', () => {
      const withDeadline: ParsedRfpRequirements = {
        ...createEmptyRequirements(),
        deadline: '2024-03-15',
      };
      const summary = getRequirementsSummary(withDeadline);
      expect(summary).toContain('Deadline: 2024-03-15');
    });

    test('includes section count in summary', () => {
      const withSections: ParsedRfpRequirements = {
        ...createEmptyRequirements(),
        requiredResponseSections: [
          { title: 'Overview' },
          { title: 'Approach' },
          { title: 'Team' },
        ],
      };
      const summary = getRequirementsSummary(withSections);
      expect(summary).toContain('3 required sections');
    });

    test('includes evaluation criteria count', () => {
      const withCriteria: ParsedRfpRequirements = {
        ...createEmptyRequirements(),
        evaluationCriteria: ['Technical (40%)', 'Cost (30%)', 'Experience (30%)'],
      };
      const summary = getRequirementsSummary(withCriteria);
      expect(summary).toContain('3 evaluation criteria');
    });

    test('includes question count', () => {
      const withQuestions: ParsedRfpRequirements = {
        ...createEmptyRequirements(),
        mustAnswerQuestions: ['Q1?', 'Q2?'],
      };
      const summary = getRequirementsSummary(withQuestions);
      expect(summary).toContain('2 questions to answer');
    });

    test('includes compliance count', () => {
      const withCompliance: ParsedRfpRequirements = {
        ...createEmptyRequirements(),
        complianceChecklist: ['Insurance', 'Certification'],
      };
      const summary = getRequirementsSummary(withCompliance);
      expect(summary).toContain('2 compliance items');
    });

    test('combines multiple parts with pipe separator', () => {
      const full: ParsedRfpRequirements = {
        ...createEmptyRequirements(),
        deadline: '2024-03-15',
        requiredResponseSections: [{ title: 'Overview' }],
        evaluationCriteria: ['Technical'],
      };
      const summary = getRequirementsSummary(full);
      expect(summary).toContain(' | ');
      expect(summary.split(' | ')).toHaveLength(3);
    });
  });

  describe('createEmptyRequirements', () => {
    test('returns object with all required fields', () => {
      const empty = createEmptyRequirements();

      expect(empty.deadline).toBeNull();
      expect(empty.submissionInstructions).toEqual([]);
      expect(empty.complianceChecklist).toEqual([]);
      expect(empty.evaluationCriteria).toEqual([]);
      expect(empty.requiredResponseSections).toEqual([]);
      expect(empty.mustAnswerQuestions).toEqual([]);
      expect(empty.wordLimit).toBeNull();
      expect(empty.pageLimit).toBeNull();
      expect(empty.parseConfidence).toBe('low');
    });

    test('returns a new object each time (not shared reference)', () => {
      const empty1 = createEmptyRequirements();
      const empty2 = createEmptyRequirements();

      expect(empty1).not.toBe(empty2);
      empty1.submissionInstructions.push('test');
      expect(empty2.submissionInstructions).toEqual([]);
    });
  });
});
