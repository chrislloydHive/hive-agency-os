// tests/os/sectionConfidence.test.ts
// Tests for section confidence scoring

import { describe, test, expect } from 'vitest';
import {
  calculateSectionConfidence,
  countInputsUsed,
  ConfidenceFactors,
} from '@/lib/os/ai/sectionConfidence';

describe('sectionConfidence', () => {
  describe('calculateSectionConfidence', () => {
    test('returns high confidence for human-edited content', () => {
      const factors: ConfidenceFactors = {
        firmBrainReadiness: 0,
        inputsUsedCount: 0,
        isHumanEdited: true,
        isFromLibrary: false,
        fromWonDeal: false,
      };

      const result = calculateSectionConfidence(factors);
      expect(result.confidence).toBe('high');
      expect(result.score).toBe(100);
      expect(result.reasons).toContain('Human-reviewed and edited');
    });

    test('returns high confidence for content from won deals', () => {
      const factors: ConfidenceFactors = {
        firmBrainReadiness: 0,
        inputsUsedCount: 0,
        isHumanEdited: false,
        isFromLibrary: true,
        fromWonDeal: true,
      };

      const result = calculateSectionConfidence(factors);
      expect(result.confidence).toBe('high');
      expect(result.score).toBe(95);
      expect(result.reasons).toContain('From won deal content');
    });

    test('returns high confidence for high FB readiness + many inputs', () => {
      const factors: ConfidenceFactors = {
        firmBrainReadiness: 85,
        inputsUsedCount: 5,
        isHumanEdited: false,
        isFromLibrary: false,
        fromWonDeal: false,
      };

      const result = calculateSectionConfidence(factors);
      expect(result.confidence).toBe('high');
      expect(result.score).toBeGreaterThanOrEqual(70);
    });

    test('returns medium confidence for moderate FB readiness', () => {
      const factors: ConfidenceFactors = {
        firmBrainReadiness: 60,
        inputsUsedCount: 2,
        isHumanEdited: false,
        isFromLibrary: false,
        fromWonDeal: false,
      };

      const result = calculateSectionConfidence(factors);
      expect(result.confidence).toBe('medium');
    });

    test('returns low confidence for poor inputs', () => {
      const factors: ConfidenceFactors = {
        firmBrainReadiness: 20,
        inputsUsedCount: 0,
        isHumanEdited: false,
        isFromLibrary: false,
        fromWonDeal: false,
      };

      const result = calculateSectionConfidence(factors);
      expect(result.confidence).toBe('low');
      expect(result.score).toBeLessThan(40);
    });

    test('library content adds to confidence score', () => {
      const withLibrary: ConfidenceFactors = {
        firmBrainReadiness: 50,
        inputsUsedCount: 2,
        isHumanEdited: false,
        isFromLibrary: true,
        fromWonDeal: false,
      };

      const withoutLibrary: ConfidenceFactors = {
        ...withLibrary,
        isFromLibrary: false,
      };

      const withLibraryResult = calculateSectionConfidence(withLibrary);
      const withoutLibraryResult = calculateSectionConfidence(withoutLibrary);

      expect(withLibraryResult.score).toBeGreaterThan(withoutLibraryResult.score);
    });
  });

  describe('countInputsUsed', () => {
    test('returns 0 for undefined', () => {
      expect(countInputsUsed(undefined)).toBe(0);
    });

    test('returns 0 for empty object', () => {
      expect(countInputsUsed({})).toBe(0);
    });

    test('counts only known input keys', () => {
      const generatedUsing = {
        agencyProfile: true,
        teamMembers: true,
        caseStudies: true,
        unknownField: true, // Should be ignored
      };

      expect(countInputsUsed(generatedUsing)).toBe(3);
    });

    test('counts all 6 inputs correctly', () => {
      const generatedUsing = {
        agencyProfile: true,
        teamMembers: true,
        caseStudies: true,
        references: true,
        pricingTemplate: true,
        planTemplate: true,
      };

      expect(countInputsUsed(generatedUsing)).toBe(6);
    });

    test('does not count false values', () => {
      const generatedUsing = {
        agencyProfile: true,
        teamMembers: false,
        caseStudies: true,
      };

      expect(countInputsUsed(generatedUsing)).toBe(2);
    });
  });
});
