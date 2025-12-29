// tests/os/primaryConversionAction.test.ts
// Tests for Primary Conversion Action field configuration

import { describe, it, expect } from 'vitest';
import {
  CONTEXT_SCHEMA_V2_REGISTRY,
  PRIMARY_CONVERSION_ACTION_OPTIONS,
} from '@/lib/contextGraph/unifiedRegistry';
import { REQUIRED_CONTEXT_KEYS, getCanonicalRequiredKey } from '@/lib/os/context/requiredContextKeys';
import { CANONICAL_CONVERSION_ACTIONS } from '@/lib/constants/conversionActions';

// ============================================================================
// Field Definition Tests
// ============================================================================

describe('Primary Conversion Action Field Definition', () => {
  const conversionActionField = CONTEXT_SCHEMA_V2_REGISTRY.find(
    f => f.key === 'gtm.conversionAction'
  );

  it('should exist in the registry', () => {
    expect(conversionActionField).toBeDefined();
  });

  it('should have the correct label', () => {
    expect(conversionActionField?.label).toBe('Primary Conversion Action');
  });

  it('should have valueType of select', () => {
    expect(conversionActionField?.valueType).toBe('select');
  });

  it('should have predefined options', () => {
    expect(conversionActionField?.options).toBeDefined();
    expect(conversionActionField?.options?.length).toBeGreaterThan(0);
  });

  it('should allow custom options', () => {
    expect(conversionActionField?.allowCustomOptions).toBe(true);
  });

  it('should be required for demandProgram', () => {
    expect(conversionActionField?.requiredFor).toContain('demandProgram');
  });

  it('should have the legacy path for backward compat', () => {
    expect(conversionActionField?.legacyPath).toBe('primaryConversionAction');
  });
});

// ============================================================================
// Options Tests
// ============================================================================

describe('Primary Conversion Action Options', () => {
  it('should be derived from CANONICAL_CONVERSION_ACTIONS', () => {
    // Options should match the canonical list
    const canonicalKeys = CANONICAL_CONVERSION_ACTIONS.map(a => a.key);
    const optionValues = PRIMARY_CONVERSION_ACTION_OPTIONS.map(o => o.value);
    expect(optionValues).toEqual(canonicalKeys);
  });

  it('should have human-readable labels', () => {
    const bookDemo = PRIMARY_CONVERSION_ACTION_OPTIONS.find(o => o.value === 'book_demo');
    expect(bookDemo?.label).toBe('Book a demo');

    const custom = PRIMARY_CONVERSION_ACTION_OPTIONS.find(o => o.value === 'custom');
    expect(custom?.label).toBe('Other (custom)');
  });

  it('should NOT contain unrelated fields like AOV, LTV, or Channels', () => {
    const labels = PRIMARY_CONVERSION_ACTION_OPTIONS.map(o => o.label.toLowerCase());

    expect(labels.some(l => l.includes('aov'))).toBe(false);
    expect(labels.some(l => l.includes('ltv'))).toBe(false);
    expect(labels.some(l => l.includes('gross margin'))).toBe(false);
    expect(labels.some(l => l.includes('spend'))).toBe(false);
    expect(labels.some(l => l.includes('channels'))).toBe(false);
  });

  it('should NOT have duplicate labels', () => {
    const labels = PRIMARY_CONVERSION_ACTION_OPTIONS.map(o => o.label);
    const uniqueLabels = new Set(labels);
    expect(uniqueLabels.size).toBe(labels.length);
  });
});

// ============================================================================
// Backward Compatibility Tests
// ============================================================================

describe('Backward Compatibility', () => {
  it('should recognize gtm.conversionAction as a required key', () => {
    const requiredKey = REQUIRED_CONTEXT_KEYS.find(k => k.key === 'gtm.conversionAction');
    expect(requiredKey).toBeDefined();
    expect(requiredKey?.label).toBe('Primary Conversion Action');
  });

  it('should have productOffer.primaryConversionAction as an alternative', () => {
    const requiredKey = REQUIRED_CONTEXT_KEYS.find(k => k.key === 'gtm.conversionAction');
    expect(requiredKey?.alternatives).toContain('productOffer.primaryConversionAction');
  });

  it('should resolve legacy key to canonical key', () => {
    const canonical = getCanonicalRequiredKey('productOffer.primaryConversionAction');
    expect(canonical).toBeDefined();
    expect(canonical?.key).toBe('gtm.conversionAction');
  });

  it('should be accessible via registry lookup', () => {
    const field = CONTEXT_SCHEMA_V2_REGISTRY.find(f => f.key === 'gtm.conversionAction');
    expect(field).toBeDefined();
    expect(field?.label).toBe('Primary Conversion Action');
  });
});

// ============================================================================
// Required Field Gate Tests
// ============================================================================

describe('Required Field Gating', () => {
  it('should be marked as critical', () => {
    const conversionActionField = CONTEXT_SCHEMA_V2_REGISTRY.find(
      f => f.key === 'gtm.conversionAction'
    );
    expect(conversionActionField?.isCritical).toBe(true);
  });

  it('should be in the go-to-market zone', () => {
    const conversionActionField = CONTEXT_SCHEMA_V2_REGISTRY.find(
      f => f.key === 'gtm.conversionAction'
    );
    expect(conversionActionField?.zoneId).toBe('go-to-market');
  });

  it('should be listed as required for demandProgram', () => {
    const requiredKey = REQUIRED_CONTEXT_KEYS.find(k => k.key === 'gtm.conversionAction');
    expect(requiredKey?.requiredFor).toContain('demandProgram');
  });
});
