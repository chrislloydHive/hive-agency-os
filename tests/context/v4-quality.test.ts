// tests/context/v4-quality.test.ts
// Context Quality & Convergence Tests
//
// Tests for the Context V4 Quality features:
// - Convergence scoring
// - Field validation
// - humanEdited tracking
// - confirmedOnly filtering

import { describe, it, expect } from 'vitest';
import {
  computeConvergenceScore,
  computeGraphConvergence,
  getEffectiveConfidence,
  hasHighConvergence,
} from '@/lib/contextGraph/convergence';
import {
  validateFieldValue,
  hasValidationRules,
  getValidationRulesForField,
} from '@/lib/contextGraph/governance/validateField';
import type { WithMetaType, ProvenanceTag, ContextSource } from '@/lib/contextGraph/types';

// ============================================================================
// Helper Functions
// ============================================================================

function createField<T>(
  value: T,
  source: ContextSource,
  options: {
    confidence?: number;
    humanConfirmed?: boolean;
    humanEdited?: boolean;
    additionalSources?: ContextSource[];
  } = {}
): WithMetaType<T> {
  const provenance: ProvenanceTag[] = [
    {
      source,
      confidence: options.confidence ?? 0.8,
      updatedAt: new Date().toISOString(),
      humanConfirmed: options.humanConfirmed,
      humanEdited: options.humanEdited,
    },
  ];

  // Add additional sources for multi-source testing
  if (options.additionalSources) {
    for (const src of options.additionalSources) {
      provenance.push({
        source: src,
        confidence: 0.7,
        updatedAt: new Date(Date.now() - 86400000).toISOString(),
      });
    }
  }

  return { value, provenance };
}

// ============================================================================
// Convergence Scoring Tests
// ============================================================================

describe('Convergence Scoring', () => {
  describe('computeConvergenceScore', () => {
    it('should return base confidence with no boosts for simple AI field', () => {
      const field = createField('test value', 'brain', { confidence: 0.7 });
      const score = computeConvergenceScore(field);

      expect(score.baseConfidence).toBe(0.7);
      expect(score.humanEdited).toBe(false);
      expect(score.humanConfirmed).toBe(false);
      expect(score.convergenceBoost).toBe(0);
      expect(score.finalConfidence).toBe(0.7);
    });

    it('should boost confidence by 0.15 for humanEdited fields', () => {
      const field = createField('test value', 'user', {
        confidence: 0.8,
        humanConfirmed: true,
        humanEdited: true,
      });
      const score = computeConvergenceScore(field);

      expect(score.humanEdited).toBe(true);
      expect(score.convergenceBoost).toBeCloseTo(0.15);
      expect(score.finalConfidence).toBeCloseTo(0.95);
    });

    it('should boost confidence by 0.10 for humanConfirmed (not edited) fields', () => {
      const field = createField('test value', 'user', {
        confidence: 0.8,
        humanConfirmed: true,
        humanEdited: false,
      });
      const score = computeConvergenceScore(field);

      expect(score.humanConfirmed).toBe(true);
      expect(score.humanEdited).toBe(false);
      expect(score.convergenceBoost).toBe(0.10);
      expect(score.finalConfidence).toBe(0.9);
    });

    it('should boost confidence for multi-source agreement', () => {
      const field = createField('test value', 'brain', {
        confidence: 0.8,
        additionalSources: ['website_lab', 'brand_lab'],
      });
      const score = computeConvergenceScore(field);

      expect(score.sourceCount).toBe(3);
      // 2 additional sources = 0.10 boost
      expect(score.convergenceBoost).toBe(0.10);
      expect(score.finalConfidence).toBe(0.9);
    });

    it('should cap multi-source boost at 0.15', () => {
      const field = createField('test value', 'brain', {
        confidence: 0.8,
        additionalSources: ['website_lab', 'brand_lab', 'content_lab', 'seo_lab'],
      });
      const score = computeConvergenceScore(field);

      expect(score.sourceCount).toBe(5);
      // 4 additional sources would be 0.20, but capped at 0.15
      expect(score.convergenceBoost).toBe(0.15);
    });

    it('should cap final confidence at 1.0', () => {
      const field = createField('test value', 'user', {
        confidence: 0.95,
        humanConfirmed: true,
        humanEdited: true,
        additionalSources: ['brain', 'website_lab'],
      });
      const score = computeConvergenceScore(field);

      // 0.95 base + 0.15 edit + 0.10 multi-source = 1.20, capped at 1.0
      expect(score.finalConfidence).toBe(1.0);
    });

    it('should return 0 for empty provenance', () => {
      const field: WithMetaType<string> = { value: 'test', provenance: [] };
      const score = computeConvergenceScore(field);

      expect(score.baseConfidence).toBe(0);
      expect(score.finalConfidence).toBe(0);
    });
  });

  describe('getEffectiveConfidence', () => {
    it('should return final confidence from convergence score', () => {
      const field = createField('test', 'user', { confidence: 0.9, humanConfirmed: true });
      const confidence = getEffectiveConfidence(field);

      expect(confidence).toBe(1.0); // 0.9 + 0.10 boost
    });
  });

  describe('hasHighConvergence', () => {
    it('should return true for fields with confidence >= 0.8', () => {
      const field = createField('test', 'user', { confidence: 0.85, humanConfirmed: true });
      expect(hasHighConvergence(field)).toBe(true);
    });

    it('should return false for fields with confidence < 0.8', () => {
      const field = createField('test', 'brain', { confidence: 0.5 });
      expect(hasHighConvergence(field)).toBe(false);
    });
  });

  describe('computeGraphConvergence', () => {
    it('should compute aggregate metrics for a graph', () => {
      const graph = {
        identity: {
          businessModel: createField('SaaS', 'user', { humanConfirmed: true }),
          industry: createField('Technology', 'brain'),
        },
        brand: {
          positioning: createField('Premium B2B', 'user', { humanConfirmed: true, humanEdited: true }),
        },
      };

      const metrics = computeGraphConvergence(graph);

      expect(metrics.totalFields).toBe(3);
      expect(metrics.humanConfirmedCount).toBe(2);
      expect(metrics.humanEditedCount).toBe(1);
      expect(metrics.averageConfidence).toBeGreaterThan(0.8);
    });
  });
});

// ============================================================================
// Field Validation Tests
// ============================================================================

describe('Field Validation', () => {
  describe('validateFieldValue', () => {
    it('should validate brand.positioning minLength', () => {
      const result = validateFieldValue('brand.positioning', 'Short');
      expect(result.isValid).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].ruleType).toBe('minLength');
    });

    it('should pass validation for valid brand.positioning', () => {
      const result = validateFieldValue(
        'brand.positioning',
        'A premium B2B SaaS platform that helps enterprises scale their operations.'
      );
      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBe(0);
    });

    it('should detect diagnostic language in positioning', () => {
      const result = validateFieldValue(
        'brand.positioning',
        'Based on our diagnostic score of 85, we recommend focusing on brand awareness.'
      );
      expect(result.isValid).toBe(false);
      expect(result.warnings.some(w => w.ruleType === 'mustNotInclude')).toBe(true);
    });

    it('should validate audience.icpDescription minLength', () => {
      const result = validateFieldValue('audience.icpDescription', 'Business owners');
      expect(result.isValid).toBe(false);
    });

    it('should detect we/our language in ICP description', () => {
      const result = validateFieldValue(
        'audience.icpDescription',
        'We target enterprise customers in the technology sector who need our solutions.'
      );
      expect(result.isValid).toBe(false);
      expect(result.warnings.some(w => w.message.includes('we/our/us'))).toBe(true);
    });

    it('should validate productOffer.valueProposition', () => {
      const result = validateFieldValue('productOffer.valueProposition', 'Buy now!');
      expect(result.isValid).toBe(false);
    });

    it('should return valid for fields without validation rules', () => {
      const result = validateFieldValue('identity.industry', 'Technology');
      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBe(0);
    });

    it('should handle null/undefined values gracefully', () => {
      const result = validateFieldValue('brand.positioning', null);
      expect(result.isValid).toBe(true); // null values skip validation
    });
  });

  describe('hasValidationRules', () => {
    it('should return true for fields with rules', () => {
      expect(hasValidationRules('brand.positioning')).toBe(true);
      expect(hasValidationRules('audience.icpDescription')).toBe(true);
      expect(hasValidationRules('productOffer.valueProposition')).toBe(true);
    });

    it('should return false for fields without rules', () => {
      expect(hasValidationRules('identity.industry')).toBe(false);
      expect(hasValidationRules('digitalInfra.trackingStackSummary')).toBe(false);
    });
  });

  describe('getValidationRulesForField', () => {
    it('should return rules for brand.positioning', () => {
      const rules = getValidationRulesForField('brand.positioning');
      expect(rules.length).toBeGreaterThan(0);
      expect(rules.some(r => r.type === 'minLength')).toBe(true);
      expect(rules.some(r => r.type === 'maxLength')).toBe(true);
    });
  });
});

// ============================================================================
// humanEdited Flag Tests
// ============================================================================

describe('humanEdited Flag', () => {
  it('should be false by default in provenance', () => {
    const field = createField('test', 'brain');
    expect(field.provenance[0].humanEdited).toBeUndefined();
  });

  it('should be settable in provenance', () => {
    const field = createField('test', 'user', { humanEdited: true });
    expect(field.provenance[0].humanEdited).toBe(true);
  });

  it('should affect convergence scoring', () => {
    const editedField = createField('test', 'user', {
      confidence: 0.8,
      humanConfirmed: true,
      humanEdited: true,
    });
    const acceptedField = createField('test', 'user', {
      confidence: 0.8,
      humanConfirmed: true,
      humanEdited: false,
    });

    const editedScore = computeConvergenceScore(editedField);
    const acceptedScore = computeConvergenceScore(acceptedField);

    // Edited should have higher boost (0.15 vs 0.10)
    expect(editedScore.finalConfidence).toBeGreaterThan(acceptedScore.finalConfidence);
    expect(editedScore.convergenceBoost).toBe(0.15);
    expect(acceptedScore.convergenceBoost).toBe(0.10);
  });
});
