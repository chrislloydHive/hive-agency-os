// tests/competition-v3/verticalModels.test.ts
// Competition Lab V3.6 - Vertical Models Tests
//
// Tests for vertical-aware competitive models that ensure:
// - B2C companies don't show B2B competitor types
// - Correct terminology for each vertical
// - Proper filtering of competitors by vertical

import { describe, it, expect } from 'vitest';
import {
  getVerticalModel,
  getAllowedTypesForVertical,
  getDisallowedTypesForVertical,
  isTypeAllowedForVertical,
  getTypeLabel,
  getTerminology,
  filterCompetitorsByVertical,
  shouldHideInternalHire,
  shouldHideFractional,
  B2C_RETAIL_MODEL,
  AUTOMOTIVE_MODEL,
  B2B_SERVICES_MODEL,
  B2B_SOFTWARE_MODEL,
} from '@/lib/competition-v3/orchestrator/verticalModels';
import type { CompetitorType } from '@/lib/competition-v3/types';

// ============================================================================
// B2C Retail Model Tests
// ============================================================================

describe('B2C Retail Model', () => {
  it('should return correct model for retail vertical', () => {
    const model = getVerticalModel('retail');

    expect(model.vertical).toBe('retail');
    expect(model.displayName).toBe('B2C Retail');
  });

  it('should only allow direct, partial, platform types', () => {
    const allowed = getAllowedTypesForVertical('retail');

    expect(allowed).toContain('direct');
    expect(allowed).toContain('partial');
    expect(allowed).toContain('platform');
    expect(allowed).not.toContain('fractional');
    expect(allowed).not.toContain('internal');
  });

  it('should disallow fractional and internal types', () => {
    const disallowed = getDisallowedTypesForVertical('retail');

    expect(disallowed).toContain('fractional');
    expect(disallowed).toContain('internal');
    expect(disallowed).toContain('irrelevant');
  });

  it('should hide internal hire for retail', () => {
    expect(shouldHideInternalHire('retail')).toBe(true);
  });

  it('should hide fractional for retail', () => {
    expect(shouldHideFractional('retail')).toBe(true);
  });

  it('should use retail terminology', () => {
    const terminology = getTerminology('retail');

    expect(terminology.customer).toBe('shopper');
    expect(terminology.customers).toBe('shoppers');
    expect(terminology.competitor).toBe('competing store');
    expect(terminology.competitors).toBe('competing stores');
    expect(terminology.market).toBe('local market');
  });

  it('should use retail type labels', () => {
    expect(getTypeLabel('direct', 'retail')).toBe('Direct Retail Competitor');
    expect(getTypeLabel('partial', 'retail')).toBe('Category Substitute');
    expect(getTypeLabel('platform', 'retail')).toBe('Marketplace / Online Giant');
  });
});

// ============================================================================
// B2C Automotive Model Tests
// ============================================================================

describe('B2C Automotive Model', () => {
  it('should return correct model for automotive vertical', () => {
    const model = getVerticalModel('automotive');

    expect(model.vertical).toBe('automotive');
    expect(model.displayName).toBe('Automotive Retail/Service');
  });

  it('should only allow direct, partial, platform types', () => {
    const allowed = getAllowedTypesForVertical('automotive');

    expect(allowed).toContain('direct');
    expect(allowed).toContain('partial');
    expect(allowed).toContain('platform');
    expect(allowed).not.toContain('fractional');
    expect(allowed).not.toContain('internal');
  });

  it('should hide internal hire for automotive', () => {
    expect(shouldHideInternalHire('automotive')).toBe(true);
  });

  it('should use automotive terminology', () => {
    const terminology = getTerminology('automotive');

    expect(terminology.customer).toBe('vehicle owner');
    expect(terminology.customers).toBe('vehicle owners');
    expect(terminology.competitor).toBe('competing shop');
    expect(terminology.market).toBe('automotive aftermarket');
  });
});

// ============================================================================
// B2B Services Model Tests
// ============================================================================

describe('B2B Services Model', () => {
  it('should return correct model for services vertical', () => {
    const model = getVerticalModel('services');

    expect(model.vertical).toBe('services');
    expect(model.displayName).toBe('B2B Services');
  });

  it('should allow all competitor types including fractional and internal', () => {
    const allowed = getAllowedTypesForVertical('services');

    expect(allowed).toContain('direct');
    expect(allowed).toContain('partial');
    expect(allowed).toContain('platform');
    expect(allowed).toContain('fractional');
    expect(allowed).toContain('internal');
  });

  it('should NOT hide internal hire for services', () => {
    expect(shouldHideInternalHire('services')).toBe(false);
  });

  it('should NOT hide fractional for services', () => {
    expect(shouldHideFractional('services')).toBe(false);
  });

  it('should use B2B terminology', () => {
    const terminology = getTerminology('services');

    expect(terminology.customer).toBe('client');
    expect(terminology.customers).toBe('clients');
    expect(terminology.competitor).toBe('competing agency');
    expect(terminology.market).toBe('B2B services market');
  });
});

// ============================================================================
// B2B Software Model Tests
// ============================================================================

describe('B2B Software Model', () => {
  it('should return correct model for software vertical', () => {
    const model = getVerticalModel('software');

    expect(model.vertical).toBe('software');
    expect(model.displayName).toBe('B2B Software/SaaS');
  });

  it('should allow direct, partial, platform but NOT fractional and internal', () => {
    const allowed = getAllowedTypesForVertical('software');

    expect(allowed).toContain('direct');
    expect(allowed).toContain('partial');
    expect(allowed).toContain('platform');
    expect(allowed).not.toContain('fractional');
    expect(allowed).not.toContain('internal');
  });

  it('should use software terminology', () => {
    const terminology = getTerminology('software');

    expect(terminology.customer).toBe('user');
    expect(terminology.customers).toBe('users');
    expect(terminology.competitor).toBe('competing platform');
  });
});

// ============================================================================
// Type Filtering Tests
// ============================================================================

describe('Competitor Type Filtering', () => {
  it('should check if type is allowed for vertical', () => {
    expect(isTypeAllowedForVertical('direct', 'retail')).toBe(true);
    expect(isTypeAllowedForVertical('fractional', 'retail')).toBe(false);
    expect(isTypeAllowedForVertical('fractional', 'services')).toBe(true);
  });

  it('should filter competitors by vertical-allowed types', () => {
    const competitors = [
      { name: 'Comp1', classification: { type: 'direct' as CompetitorType } },
      { name: 'Comp2', classification: { type: 'fractional' as CompetitorType } },
      { name: 'Comp3', classification: { type: 'platform' as CompetitorType } },
      { name: 'Comp4', classification: { type: 'internal' as CompetitorType } },
    ];

    const filteredForRetail = filterCompetitorsByVertical(competitors, 'retail');
    const filteredForServices = filterCompetitorsByVertical(competitors, 'services');

    // Retail should only have direct and platform
    expect(filteredForRetail).toHaveLength(2);
    expect(filteredForRetail.map(c => c.name)).toContain('Comp1');
    expect(filteredForRetail.map(c => c.name)).toContain('Comp3');
    expect(filteredForRetail.map(c => c.name)).not.toContain('Comp2');
    expect(filteredForRetail.map(c => c.name)).not.toContain('Comp4');

    // Services should have all 4
    expect(filteredForServices).toHaveLength(4);
  });
});

// ============================================================================
// Unknown Vertical Tests
// ============================================================================

describe('Unknown Vertical Handling', () => {
  it('should return default model for unknown vertical', () => {
    const model = getVerticalModel('unknown');

    expect(model.displayName).toBe('General Business');
    expect(model.noInternalHire).toBe(false);
    expect(model.noFractional).toBe(false);
  });

  it('should allow all types for unknown vertical', () => {
    const allowed = getAllowedTypesForVertical('unknown');

    expect(allowed).toContain('direct');
    expect(allowed).toContain('partial');
    expect(allowed).toContain('fractional');
    expect(allowed).toContain('internal');
    expect(allowed).toContain('platform');
  });
});
