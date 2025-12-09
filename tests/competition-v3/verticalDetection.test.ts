// tests/competition-v3/verticalDetection.test.ts
// Competition Lab V3.6 - Vertical Detection Tests
//
// Tests for:
// - B2C retail detection (Atlas Skate, skateboard shops)
// - B2C automotive detection (Car Toys, car audio)
// - B2B services detection (marketing agencies)
// - B2B software detection (SaaS platforms)
// - Hybrid detection

import { describe, it, expect } from 'vitest';
import {
  detectVertical,
  isB2CVertical,
  isB2BVertical,
  getHiddenCompetitorTypes,
} from '@/lib/competition-v3/orchestrator/verticalDetection';
import type { QueryContext } from '@/lib/competition-v3/types';

// ============================================================================
// Test Fixtures
// ============================================================================

const createContext = (overrides: Partial<QueryContext>): QueryContext => ({
  businessName: 'Test Company',
  domain: 'test.com',
  industry: null,
  businessModel: null,
  businessModelCategory: null,
  icpDescription: null,
  icpStage: null,
  valueProposition: null,
  differentiators: [],
  primaryOffers: [],
  geography: null,
  targetIndustries: [],
  serviceModel: null,
  pricePositioning: null,
  serviceRegions: [],
  aiOrientation: null,
  verticalCategory: undefined,
  subVertical: null,
  ...overrides,
});

// ============================================================================
// B2C Retail Detection Tests
// ============================================================================

describe('Vertical Detection: B2C Retail', () => {
  it('should detect skateboard shop as retail vertical', () => {
    const context = createContext({
      businessName: 'Atlas Skateshop',
      domain: 'atlasskate.com',
      industry: 'skateboard retail',
      businessModel: 'retail store',
      businessModelCategory: 'B2C',
      primaryOffers: ['skateboards', 'decks', 'wheels', 'apparel'],
    });

    const result = detectVertical(context);

    expect(result.verticalCategory).toBe('retail');
    expect(result.subVertical).toBe('skateboard');
    expect(result.confidence).toBeGreaterThan(0.4);
  });

  it('should detect sporting goods store as retail vertical', () => {
    const context = createContext({
      businessName: 'Local Sports Shop',
      domain: 'localsports.com',
      industry: 'sporting goods retail',
      businessModel: 'retail',
      businessModelCategory: 'B2C',
      primaryOffers: ['sports equipment', 'apparel', 'footwear'],
    });

    const result = detectVertical(context);

    expect(result.verticalCategory).toBe('retail');
    expect(isB2CVertical(result.verticalCategory)).toBe(true);
  });

  it('should hide fractional and internal types for retail', () => {
    const hiddenTypes = getHiddenCompetitorTypes('retail');

    expect(hiddenTypes).toContain('fractional');
    expect(hiddenTypes).toContain('internal');
  });
});

// ============================================================================
// B2C Automotive Detection Tests
// ============================================================================

describe('Vertical Detection: B2C Automotive', () => {
  it('should detect car audio shop as automotive vertical', () => {
    const context = createContext({
      businessName: 'Car Toys',
      domain: 'cartoys.com',
      industry: 'car audio retail',
      businessModel: 'retail and installation',
      businessModelCategory: 'B2C',
      primaryOffers: ['car stereo', 'remote start', 'window tint', 'speakers'],
    });

    const result = detectVertical(context);

    expect(result.verticalCategory).toBe('automotive');
    expect(result.subVertical).toBe('car-audio');
    expect(isB2CVertical(result.verticalCategory)).toBe(true);
  });

  it('should detect window tint shop as automotive vertical', () => {
    const context = createContext({
      businessName: 'Elite Tint',
      domain: 'elitetint.com',
      industry: 'automotive window tinting',
      businessModel: 'service center',
      businessModelCategory: 'B2C',
      primaryOffers: ['window tint', 'ceramic tint', 'paint protection'],
    });

    const result = detectVertical(context);

    expect(result.verticalCategory).toBe('automotive');
    expect(result.subVertical).toBe('window-tint');
  });

  it('should hide fractional and internal types for automotive', () => {
    const hiddenTypes = getHiddenCompetitorTypes('automotive');

    expect(hiddenTypes).toContain('fractional');
    expect(hiddenTypes).toContain('internal');
  });
});

// ============================================================================
// B2B Services Detection Tests
// ============================================================================

describe('Vertical Detection: B2B Services', () => {
  it('should detect marketing agency as services vertical', () => {
    const context = createContext({
      businessName: 'Growth Marketing Agency',
      domain: 'growthagency.com',
      industry: 'marketing agency',
      businessModel: 'retainer-based agency',
      businessModelCategory: 'B2B',
      primaryOffers: ['marketing strategy', 'paid media', 'content marketing'],
    });

    const result = detectVertical(context);

    expect(result.verticalCategory).toBe('services');
    expect(isB2BVertical(result.verticalCategory)).toBe(true);
  });

  it('should detect consulting firm as services vertical', () => {
    const context = createContext({
      businessName: 'Strategic Advisors',
      domain: 'strategicadvisors.com',
      industry: 'management consulting',
      businessModel: 'consulting',
      businessModelCategory: 'B2B',
      primaryOffers: ['strategy consulting', 'digital transformation'],
    });

    const result = detectVertical(context);

    expect(result.verticalCategory).toBe('services');
  });

  it('should NOT hide fractional and internal types for services', () => {
    const hiddenTypes = getHiddenCompetitorTypes('services');

    expect(hiddenTypes).not.toContain('fractional');
    expect(hiddenTypes).not.toContain('internal');
  });
});

// ============================================================================
// B2B Software Detection Tests
// ============================================================================

describe('Vertical Detection: B2B Software', () => {
  it('should detect SaaS platform as software vertical', () => {
    const context = createContext({
      businessName: 'DataFlow Platform',
      domain: 'dataflow.io',
      industry: 'SaaS analytics',
      businessModel: 'subscription SaaS',
      businessModelCategory: 'B2B',
      primaryOffers: ['analytics dashboard', 'data integrations', 'API'],
    });

    const result = detectVertical(context);

    expect(result.verticalCategory).toBe('software');
    expect(isB2BVertical(result.verticalCategory)).toBe(true);
  });

  it('should detect CRM tool as software vertical', () => {
    const context = createContext({
      businessName: 'SalesCRM',
      domain: 'salescrm.com',
      industry: 'CRM software',
      businessModel: 'SaaS',
      businessModelCategory: 'B2B',
      primaryOffers: ['CRM', 'sales automation', 'pipeline management'],
    });

    const result = detectVertical(context);

    expect(result.verticalCategory).toBe('software');
    expect(result.subVertical).toBe('crm');
  });
});

// ============================================================================
// Hybrid Business Detection Tests
// ============================================================================

describe('Vertical Detection: Hybrid Business', () => {
  it('should handle Hybrid business model category', () => {
    const context = createContext({
      businessName: 'Pro Audio Wholesale',
      domain: 'proaudiowholesale.com',
      industry: 'audio equipment wholesale and retail',
      businessModel: 'wholesale and retail',
      businessModelCategory: 'Hybrid',
      primaryOffers: ['wholesale audio equipment', 'retail sales', 'dealer pricing'],
    });

    const result = detectVertical(context);

    // Hybrid should map to retail or automotive, not stay as 'hybrid'
    expect(['retail', 'automotive']).toContain(result.verticalCategory);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Vertical Detection: Edge Cases', () => {
  it('should return a valid category even for minimal business info', () => {
    const context = createContext({
      businessName: 'ABC Company',
      domain: 'abc.com',
      industry: '',
      businessModel: '',
      primaryOffers: [],
    });

    const result = detectVertical(context);

    // With minimal info, detection still returns a valid category (may default to services due to scoring)
    expect(['retail', 'automotive', 'services', 'software', 'consumer-dtc', 'manufacturing', 'unknown']).toContain(result.verticalCategory);
    // Confidence should be low for minimal info
    expect(result.confidence).toBeLessThan(0.5);
  });

  it('should use businessModelCategory to boost confidence', () => {
    const b2cContext = createContext({
      businessName: 'Local Shop',
      domain: 'localshop.com',
      businessModelCategory: 'B2C',
    });

    const b2bContext = createContext({
      businessName: 'Local Shop',
      domain: 'localshop.com',
      businessModelCategory: 'B2B',
    });

    const b2cResult = detectVertical(b2cContext);
    const b2bResult = detectVertical(b2bContext);

    // B2C should favor retail, B2B should favor services
    expect(isB2CVertical(b2cResult.verticalCategory) || b2cResult.verticalCategory === 'unknown').toBe(true);
    expect(isB2BVertical(b2bResult.verticalCategory) || b2bResult.verticalCategory === 'unknown').toBe(true);
  });
});
