// tests/competition/uiTypeModel.test.ts
// UI Type Model Tests for Vertical-Aware Competitor Types
//
// Tests that:
// - B2C/retail companies don't show B2B types (internal, fractional)
// - B2B services companies get full marketing-services taxonomy
// - Type mapping works correctly for each context

import { describe, it, expect } from 'vitest';
import {
  getUiTypeModelForContext,
  isTypeAllowedForContext,
  mapTypeForContext,
  getTypeLabel,
  getTypeBadgeLabel,
  getTypeHexColor,
  getTypeTailwindClasses,
  UI_COMPETITOR_TYPE_CONFIG,
  _testing,
} from '@/lib/competition-v3/uiTypeModel';

// ============================================================================
// B2C Retail Model Tests
// ============================================================================

describe('UI Type Model: B2C Retail', () => {
  const retailContext = { businessModelCategory: 'B2C' as const, verticalCategory: 'retail' };

  it('should NOT include internal or fractional types for retail', () => {
    const model = getUiTypeModelForContext(retailContext);

    expect(model.allowedTypes).not.toContain('internal');
    expect(model.allowedTypes).not.toContain('fractional');
  });

  it('should include direct, partial, marketplace, substitute for retail', () => {
    const model = getUiTypeModelForContext(retailContext);

    expect(model.allowedTypes).toContain('direct');
    expect(model.allowedTypes).toContain('partial');
    expect(model.allowedTypes).toContain('marketplace');
    expect(model.allowedTypes).toContain('substitute');
  });

  it('should have correct display name for retail', () => {
    const model = getUiTypeModelForContext(retailContext);

    expect(model.displayName).toBe('B2C Retail');
  });

  it('should check type allowed correctly', () => {
    expect(isTypeAllowedForContext('direct', retailContext)).toBe(true);
    expect(isTypeAllowedForContext('partial', retailContext)).toBe(true);
    expect(isTypeAllowedForContext('internal', retailContext)).toBe(false);
    expect(isTypeAllowedForContext('fractional', retailContext)).toBe(false);
  });
});

// ============================================================================
// Automotive Model Tests (Car Toys scenario)
// ============================================================================

describe('UI Type Model: Automotive (Car Toys)', () => {
  const automotiveContext = { businessModelCategory: 'B2C' as const, verticalCategory: 'automotive' };

  it('should NOT include internal or fractional types for automotive', () => {
    const model = getUiTypeModelForContext(automotiveContext);

    expect(model.allowedTypes).not.toContain('internal');
    expect(model.allowedTypes).not.toContain('fractional');
  });

  it('should include direct, partial, marketplace, substitute for automotive', () => {
    const model = getUiTypeModelForContext(automotiveContext);

    expect(model.allowedTypes).toContain('direct');
    expect(model.allowedTypes).toContain('partial');
    expect(model.allowedTypes).toContain('marketplace');
    expect(model.allowedTypes).toContain('substitute');
  });

  it('should map backend "platform" to "marketplace" for automotive', () => {
    const mappedType = mapTypeForContext('platform', automotiveContext);

    expect(mappedType).toBe('marketplace');
  });

  it('should map backend "internal" to "internal" (will be filtered by allowed)', () => {
    // The mapping itself doesn't change the type, but it won't be allowed
    const mappedType = mapTypeForContext('internal', automotiveContext);

    // Backend types that aren't remapped keep their name
    expect(mappedType).toBe('internal');
    // But they won't be allowed
    expect(isTypeAllowedForContext(mappedType, automotiveContext)).toBe(false);
  });
});

// ============================================================================
// B2B Services Model Tests (Hive-like agencies)
// ============================================================================

describe('UI Type Model: B2B Services', () => {
  const servicesContext = { businessModelCategory: 'B2B' as const, verticalCategory: 'services' };

  it('should include internal and fractional types for B2B services', () => {
    const model = getUiTypeModelForContext(servicesContext);

    expect(model.allowedTypes).toContain('internal');
    expect(model.allowedTypes).toContain('fractional');
  });

  it('should include direct, partial, platform for B2B services', () => {
    const model = getUiTypeModelForContext(servicesContext);

    expect(model.allowedTypes).toContain('direct');
    expect(model.allowedTypes).toContain('partial');
    expect(model.allowedTypes).toContain('platform');
  });

  it('should have correct display name', () => {
    const model = getUiTypeModelForContext(servicesContext);

    expect(model.displayName).toBe('B2B Services');
  });

  it('should NOT map platform to marketplace for B2B services', () => {
    const mappedType = mapTypeForContext('platform', servicesContext);

    expect(mappedType).toBe('platform');
  });
});

// ============================================================================
// B2B Software Model Tests
// ============================================================================

describe('UI Type Model: B2B Software', () => {
  const softwareContext = { businessModelCategory: 'B2B' as const, verticalCategory: 'software' };

  it('should NOT include internal or fractional for software', () => {
    const model = getUiTypeModelForContext(softwareContext);

    expect(model.allowedTypes).not.toContain('internal');
    expect(model.allowedTypes).not.toContain('fractional');
  });

  it('should include platform and substitute for software', () => {
    const model = getUiTypeModelForContext(softwareContext);

    expect(model.allowedTypes).toContain('platform');
    expect(model.allowedTypes).toContain('substitute');
  });
});

// ============================================================================
// Default/Unknown Model Tests
// ============================================================================

describe('UI Type Model: Default/Unknown', () => {
  it('should return default model when no context provided', () => {
    const model = getUiTypeModelForContext({});

    expect(model.displayName).toBe('General Business');
    expect(model.allowedTypes).toContain('direct');
    expect(model.allowedTypes).toContain('partial');
    // Default includes all for flexibility
    expect(model.allowedTypes).toContain('fractional');
    expect(model.allowedTypes).toContain('internal');
  });

  it('should return default model for unknown vertical', () => {
    const model = getUiTypeModelForContext({
      businessModelCategory: null,
      verticalCategory: 'unknown-vertical',
    });

    expect(model.displayName).toBe('General Business');
  });
});

// ============================================================================
// Type Configuration Tests
// ============================================================================

describe('UI Type Configuration', () => {
  it('should have configuration for all types', () => {
    const types = ['direct', 'partial', 'marketplace', 'substitute', 'internal', 'fractional', 'platform'];

    for (const type of types) {
      const config = UI_COMPETITOR_TYPE_CONFIG[type as keyof typeof UI_COMPETITOR_TYPE_CONFIG];
      expect(config).toBeDefined();
      expect(config.key).toBe(type);
      expect(config.label).toBeTruthy();
      expect(config.badgeLabel).toBeTruthy();
      expect(config.hexColor).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('should return correct labels', () => {
    expect(getTypeLabel('direct')).toBe('Direct Competitor');
    expect(getTypeLabel('marketplace')).toBe('Marketplace / Online Giant');
    expect(getTypeLabel('fractional')).toBe('Fractional / Freelance Alternative');
  });

  it('should return correct badge labels', () => {
    expect(getTypeBadgeLabel('direct')).toBe('Direct');
    expect(getTypeBadgeLabel('marketplace')).toBe('Marketplace');
    expect(getTypeBadgeLabel('fractional')).toBe('Fractional');
  });

  it('should return hex colors', () => {
    expect(getTypeHexColor('direct')).toBe('#ef4444');
    expect(getTypeHexColor('marketplace')).toBe('#fcd34d');
    expect(getTypeHexColor('unknown')).toBe('#64748b'); // fallback
  });

  it('should return tailwind classes', () => {
    const classes = getTypeTailwindClasses('direct');

    expect(classes.bg).toBe('bg-red-500');
    expect(classes.text).toBe('text-red-400');
  });
});

// ============================================================================
// Type Mapping Tests
// ============================================================================

describe('Type Mapping', () => {
  it('should map legacy "irrelevant" to "partial"', () => {
    const mapped = mapTypeForContext('irrelevant', {});

    expect(mapped).toBe('partial');
  });

  it('should preserve valid types', () => {
    expect(mapTypeForContext('direct', {})).toBe('direct');
    expect(mapTypeForContext('partial', {})).toBe('partial');
    expect(mapTypeForContext('fractional', {})).toBe('fractional');
  });
});

// ============================================================================
// Legend Order Tests
// ============================================================================

describe('Legend Order', () => {
  it('should have legend order for all allowed types', () => {
    const retailModel = getUiTypeModelForContext({ businessModelCategory: 'B2C', verticalCategory: 'retail' });

    // Legend order should match allowed types
    expect(retailModel.legendOrder.length).toBe(retailModel.allowedTypes.length);

    for (const type of retailModel.legendOrder) {
      expect(retailModel.allowedTypes).toContain(type);
    }
  });
});

// ============================================================================
// Internal Model Tests (for debugging)
// ============================================================================

describe('Internal Models', () => {
  it('should export test models', () => {
    expect(_testing.B2C_RETAIL_MODEL).toBeDefined();
    expect(_testing.AUTOMOTIVE_MODEL).toBeDefined();
    expect(_testing.B2B_SERVICES_MODEL).toBeDefined();
    expect(_testing.B2B_SOFTWARE_MODEL).toBeDefined();
    expect(_testing.DEFAULT_MODEL).toBeDefined();
  });
});
