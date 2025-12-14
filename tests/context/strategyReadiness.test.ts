// tests/context/strategyReadiness.test.ts
// Tests for Strategy Readiness rubric
//
// Validates that calculateStrategyReadiness() produces expected missing-field
// reasons based on STRATEGY_CRITICAL_FIELDS and STRATEGY_RECOMMENDED_FIELDS.

import { describe, it, expect } from 'vitest';
import {
  calculateStrategyReadiness,
  STRATEGY_CRITICAL_FIELDS,
  STRATEGY_RECOMMENDED_FIELDS,
  type CompanyContext,
} from '@/lib/types/context';

// ============================================================================
// Test Fixtures
// ============================================================================

function makeContext(overrides: Partial<CompanyContext> = {}): CompanyContext {
  return {
    companyId: 'test-company',
    ...overrides,
  };
}

function makeMinimalReadyContext(): CompanyContext {
  return makeContext({
    // All critical fields
    businessModel: 'B2C ecommerce',
    primaryAudience: 'Fitness enthusiasts aged 25-45',
    objectives: ['Increase online sales', 'Build brand awareness'],
    budget: '$50,000/month',
    // 3 recommended fields (threshold for ready is < 4 missing)
    geographicScope: 'United States',
    timeline: 'Q1 2025',
    avgOrderValue: 85,
  });
}

function makeFullContext(): CompanyContext {
  return makeContext({
    // All critical fields
    businessModel: 'B2C ecommerce',
    primaryAudience: 'Fitness enthusiasts aged 25-45',
    objectives: ['Increase online sales', 'Build brand awareness'],
    budget: '$50,000/month',
    // All recommended fields
    geographicScope: 'United States',
    timeline: 'Q1 2025',
    avgOrderValue: 85,
    companyCategory: 'fitness marketplace',
    constraints: 'No competitor targeting',
    primaryConversionAction: 'purchase',
  });
}

// ============================================================================
// Tests
// ============================================================================

describe('calculateStrategyReadiness', () => {
  describe('blocked status', () => {
    it('returns blocked when no critical fields present', () => {
      const context = makeContext();
      const result = calculateStrategyReadiness(context);

      expect(result.status).toBe('blocked');
      expect(result.missingCritical).toEqual([...STRATEGY_CRITICAL_FIELDS]);
    });

    it('returns blocked when missing businessModel', () => {
      const context = makeMinimalReadyContext();
      delete context.businessModel;
      const result = calculateStrategyReadiness(context);

      expect(result.status).toBe('blocked');
      expect(result.missingCritical).toContain('businessModel');
    });

    it('returns blocked when missing primaryAudience', () => {
      const context = makeMinimalReadyContext();
      delete context.primaryAudience;
      const result = calculateStrategyReadiness(context);

      expect(result.status).toBe('blocked');
      expect(result.missingCritical).toContain('primaryAudience');
    });

    it('returns blocked when missing objectives', () => {
      const context = makeMinimalReadyContext();
      delete context.objectives;
      const result = calculateStrategyReadiness(context);

      expect(result.status).toBe('blocked');
      expect(result.missingCritical).toContain('objectives');
    });

    it('returns blocked when objectives is empty array', () => {
      const context = makeMinimalReadyContext();
      context.objectives = [];
      const result = calculateStrategyReadiness(context);

      expect(result.status).toBe('blocked');
      expect(result.missingCritical).toContain('objectives');
    });

    it('returns blocked when missing budget', () => {
      const context = makeMinimalReadyContext();
      delete context.budget;
      const result = calculateStrategyReadiness(context);

      expect(result.status).toBe('blocked');
      expect(result.missingCritical).toContain('budget');
    });

    it('returns blocked when critical field is empty string', () => {
      const context = makeMinimalReadyContext();
      context.businessModel = '   '; // whitespace only
      const result = calculateStrategyReadiness(context);

      expect(result.status).toBe('blocked');
      expect(result.missingCritical).toContain('businessModel');
    });
  });

  describe('needs_info status', () => {
    it('returns needs_info when 4+ recommended fields missing', () => {
      const context = makeContext({
        // All critical fields
        businessModel: 'B2C ecommerce',
        primaryAudience: 'Fitness enthusiasts',
        objectives: ['Grow sales'],
        budget: '$50k/month',
        // Only 2 recommended (4 missing: companyCategory, constraints, avgOrderValue, primaryConversionAction)
        geographicScope: 'US',
        timeline: 'Q1 2025',
      });
      const result = calculateStrategyReadiness(context);

      expect(result.status).toBe('needs_info');
      expect(result.missingCritical).toHaveLength(0);
      expect(result.missingRecommended.length).toBeGreaterThanOrEqual(4);
    });

    it('returns needs_info when exactly 4 recommended fields missing', () => {
      const context = makeContext({
        // All critical fields
        businessModel: 'B2C ecommerce',
        primaryAudience: 'Fitness enthusiasts',
        objectives: ['Grow sales'],
        budget: '$50k/month',
        // Only 2 recommended (4 missing)
        geographicScope: 'US',
        timeline: 'Q1 2025',
      });
      const result = calculateStrategyReadiness(context);

      expect(result.status).toBe('needs_info');
      expect(result.missingRecommended).toHaveLength(4);
      expect(result.missingRecommended).toContain('avgOrderValue');
      expect(result.missingRecommended).toContain('companyCategory');
      expect(result.missingRecommended).toContain('constraints');
      expect(result.missingRecommended).toContain('primaryConversionAction');
    });
  });

  describe('ready status', () => {
    it('returns ready when all critical and most recommended fields present', () => {
      const context = makeMinimalReadyContext();
      const result = calculateStrategyReadiness(context);

      expect(result.status).toBe('ready');
      expect(result.missingCritical).toHaveLength(0);
      expect(result.missingRecommended.length).toBeLessThan(4);
    });

    it('returns ready when all fields present', () => {
      const context = makeFullContext();
      const result = calculateStrategyReadiness(context);

      expect(result.status).toBe('ready');
      expect(result.missingCritical).toHaveLength(0);
      expect(result.missingRecommended).toHaveLength(0);
    });

    it('returns ready with 3 missing recommended fields', () => {
      const context = makeContext({
        // All critical
        businessModel: 'B2C',
        primaryAudience: 'Users',
        objectives: ['Goal'],
        budget: '$10k',
        // 3 recommended (3 missing)
        geographicScope: 'Global',
        timeline: 'Q2',
        avgOrderValue: 100,
      });
      const result = calculateStrategyReadiness(context);

      expect(result.status).toBe('ready');
      expect(result.missingRecommended).toHaveLength(3);
    });
  });

  describe('completeness score', () => {
    it('returns 0% for empty context', () => {
      const context = makeContext();
      const result = calculateStrategyReadiness(context);

      expect(result.completenessScore).toBe(0);
    });

    it('returns non-zero for partially filled context', () => {
      const context = makeMinimalReadyContext();
      const result = calculateStrategyReadiness(context);

      expect(result.completenessScore).toBeGreaterThan(0);
    });

    it('returns 100% for fully filled context', () => {
      const context = makeFullContext();
      // Add remaining completeness fields
      context.valueProposition = 'Best fitness gear';
      context.competitors = [{ domain: 'competitor.com', offerOverlap: 80, jtbdMatch: true, geoRelevance: 90, type: 'direct', confidence: 85, source: 'manual' }];

      const result = calculateStrategyReadiness(context);

      expect(result.completenessScore).toBe(100);
    });
  });

  describe('field constants', () => {
    it('STRATEGY_CRITICAL_FIELDS contains required fields', () => {
      expect(STRATEGY_CRITICAL_FIELDS).toContain('businessModel');
      expect(STRATEGY_CRITICAL_FIELDS).toContain('primaryAudience');
      expect(STRATEGY_CRITICAL_FIELDS).toContain('objectives');
      expect(STRATEGY_CRITICAL_FIELDS).toContain('budget');
      expect(STRATEGY_CRITICAL_FIELDS).toHaveLength(4);
    });

    it('STRATEGY_RECOMMENDED_FIELDS contains quality fields', () => {
      expect(STRATEGY_RECOMMENDED_FIELDS).toContain('geographicScope');
      expect(STRATEGY_RECOMMENDED_FIELDS).toContain('timeline');
      expect(STRATEGY_RECOMMENDED_FIELDS).toContain('avgOrderValue');
      expect(STRATEGY_RECOMMENDED_FIELDS).toContain('companyCategory');
      expect(STRATEGY_RECOMMENDED_FIELDS).toContain('constraints');
      expect(STRATEGY_RECOMMENDED_FIELDS).toContain('primaryConversionAction');
      expect(STRATEGY_RECOMMENDED_FIELDS).toHaveLength(6);
    });
  });
});
