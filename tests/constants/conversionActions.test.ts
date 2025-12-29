// tests/constants/conversionActions.test.ts
// Tests for Canonical Conversion Actions

import { describe, it, expect } from 'vitest';
import {
  CANONICAL_CONVERSION_ACTIONS,
  CATEGORY_ORDER,
  CATEGORY_LABELS,
  ConversionActionCategory,
  getConversionActionsByCategory,
  getAllConversionActions,
  getConversionActionLabel,
  getConversionAction,
  isCanonicalConversionAction,
} from '@/lib/constants/conversionActions';

// ============================================================================
// Data Integrity Tests
// ============================================================================

describe('Canonical Conversion Actions - Data Integrity', () => {
  it('should have unique keys', () => {
    const keys = CANONICAL_CONVERSION_ACTIONS.map(a => a.key);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });

  it('should have non-empty labels', () => {
    for (const action of CANONICAL_CONVERSION_ACTIONS) {
      expect(action.label.trim().length).toBeGreaterThan(0);
    }
  });

  it('should have non-empty descriptions', () => {
    for (const action of CANONICAL_CONVERSION_ACTIONS) {
      expect(action.description.trim().length).toBeGreaterThan(0);
    }
  });

  it('should have valid categories', () => {
    const validCategories: ConversionActionCategory[] = [
      'saas',
      'services',
      'ecommerce',
      'content',
      'marketplace',
      'other',
    ];

    for (const action of CANONICAL_CONVERSION_ACTIONS) {
      expect(validCategories).toContain(action.category);
    }
  });

  it('should have snake_case keys', () => {
    for (const action of CANONICAL_CONVERSION_ACTIONS) {
      expect(action.key).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it('should have a custom/other fallback option', () => {
    const customAction = CANONICAL_CONVERSION_ACTIONS.find(
      a => a.key === 'custom'
    );
    expect(customAction).toBeDefined();
    expect(customAction?.category).toBe('other');
  });
});

// ============================================================================
// Category Tests
// ============================================================================

describe('Canonical Conversion Actions - Categories', () => {
  it('should have actions in all categories', () => {
    for (const category of CATEGORY_ORDER) {
      const actions = getConversionActionsByCategory(category);
      expect(actions.length).toBeGreaterThan(0);
    }
  });

  it('should have labels for all categories', () => {
    for (const category of CATEGORY_ORDER) {
      expect(CATEGORY_LABELS[category]).toBeDefined();
      expect(CATEGORY_LABELS[category].length).toBeGreaterThan(0);
    }
  });

  it('CATEGORY_ORDER should match all category types', () => {
    const categoriesInActions = new Set(
      CANONICAL_CONVERSION_ACTIONS.map(a => a.category)
    );

    for (const category of CATEGORY_ORDER) {
      expect(categoriesInActions.has(category)).toBe(true);
    }
  });
});

// ============================================================================
// Helper Function Tests
// ============================================================================

describe('Canonical Conversion Actions - Helpers', () => {
  describe('getConversionActionsByCategory', () => {
    it('should return actions for saas category', () => {
      const actions = getConversionActionsByCategory('saas');
      expect(actions.length).toBeGreaterThan(0);
      expect(actions.every(a => a.category === 'saas')).toBe(true);
    });

    it('should return empty array for invalid category', () => {
      // @ts-expect-error Testing invalid category
      const actions = getConversionActionsByCategory('invalid');
      expect(actions).toEqual([]);
    });
  });

  describe('getAllConversionActions', () => {
    it('should return all actions', () => {
      const actions = getAllConversionActions();
      expect(actions.length).toBe(CANONICAL_CONVERSION_ACTIONS.length);
    });

    it('should return a copy, not the original array', () => {
      const actions = getAllConversionActions();
      actions.push({} as any);
      expect(getAllConversionActions().length).toBe(
        CANONICAL_CONVERSION_ACTIONS.length
      );
    });
  });

  describe('getConversionActionLabel', () => {
    it('should return label for known action', () => {
      expect(getConversionActionLabel('book_demo')).toBe('Book a demo');
    });

    it('should return formatted key for unknown action', () => {
      expect(getConversionActionLabel('custom_action_here')).toBe(
        'Custom Action Here'
      );
    });
  });

  describe('getConversionAction', () => {
    it('should return definition for known action', () => {
      const action = getConversionAction('book_demo');
      expect(action).toBeDefined();
      expect(action?.label).toBe('Book a demo');
      expect(action?.category).toBe('saas');
    });

    it('should return undefined for unknown action', () => {
      expect(getConversionAction('unknown_action')).toBeUndefined();
    });
  });

  describe('isCanonicalConversionAction', () => {
    it('should return true for known action', () => {
      expect(isCanonicalConversionAction('book_demo')).toBe(true);
    });

    it('should return false for unknown action', () => {
      expect(isCanonicalConversionAction('unknown_action')).toBe(false);
    });
  });
});

// ============================================================================
// Expected Actions Tests (sanity check)
// ============================================================================

describe('Canonical Conversion Actions - Expected Actions', () => {
  const expectedSaasActions = [
    'book_demo',
    'start_free_trial',
    'sign_up',
    'add_payment_method',
    'upgrade_subscription',
  ];

  const expectedServicesActions = [
    'request_quote',
    'book_consultation',
    'submit_lead_form',
    'call_sales',
    'schedule_assessment',
  ];

  const expectedEcommerceActions = [
    'complete_purchase',
    'checkout',
    'add_to_cart',
    'begin_checkout',
  ];

  it('should have expected SaaS actions', () => {
    const saasKeys = getConversionActionsByCategory('saas').map(a => a.key);
    for (const key of expectedSaasActions) {
      expect(saasKeys).toContain(key);
    }
  });

  it('should have expected Services actions', () => {
    const servicesKeys = getConversionActionsByCategory('services').map(
      a => a.key
    );
    for (const key of expectedServicesActions) {
      expect(servicesKeys).toContain(key);
    }
  });

  it('should have expected Ecommerce actions', () => {
    const ecommerceKeys = getConversionActionsByCategory('ecommerce').map(
      a => a.key
    );
    for (const key of expectedEcommerceActions) {
      expect(ecommerceKeys).toContain(key);
    }
  });
});
