// tests/strategy/croDriftDetection.test.ts
// Tests for CRO/Website-audit drift detection in variant validation
//
// Covers:
// - CRO_INDICATOR_PATTERNS detection
// - checkCRODrift behavior (via validateGeneratedVariants)
// - Integration with existing category_drift warnings

import { describe, it, expect } from 'vitest';
import {
  validateGeneratedVariants,
  type VariantWarning,
} from '@/lib/os/ai/validateGeneratedVariants';
import {
  getContract,
} from '@/lib/os/ai/strategyFieldContracts';
import {
  createSnapshotFromFields,
  type ConfirmedContextSnapshot,
} from '@/lib/os/ai/buildStrategyFieldPrompt';
import type { ContextFieldV4 } from '@/lib/types/contextField';

// ============================================================================
// Test Helpers
// ============================================================================

function createTrainerMarketplaceSnapshot(): ConfirmedContextSnapshot {
  const fields: ContextFieldV4[] = [
    {
      key: 'audience.icpDescription',
      domain: 'audience',
      value: 'Personal trainers looking to grow their client base',
      status: 'confirmed',
      source: 'user',
      updatedAt: new Date().toISOString(),
      confidence: 1.0,
    },
    {
      key: 'productOffer.valueProposition',
      domain: 'productOffer',
      value: 'Marketplace connecting fitness trainers with clients',
      status: 'confirmed',
      source: 'user',
      updatedAt: new Date().toISOString(),
      confidence: 1.0,
    },
    {
      key: 'identity.businessModel',
      domain: 'identity',
      value: 'Commission-based trainer marketplace',
      status: 'confirmed',
      source: 'user',
      updatedAt: new Date().toISOString(),
      confidence: 1.0,
    },
  ];
  return createSnapshotFromFields(fields);
}

function createCROAgencySnapshot(): ConfirmedContextSnapshot {
  const fields: ContextFieldV4[] = [
    {
      key: 'audience.icpDescription',
      domain: 'audience',
      value: 'E-commerce brands needing conversion rate optimization',
      status: 'confirmed',
      source: 'user',
      updatedAt: new Date().toISOString(),
      confidence: 1.0,
    },
    {
      key: 'productOffer.valueProposition',
      domain: 'productOffer',
      value: 'Website optimization and landing page CRO services',
      status: 'confirmed',
      source: 'user',
      updatedAt: new Date().toISOString(),
      confidence: 1.0,
    },
    {
      key: 'identity.businessModel',
      domain: 'identity',
      value: 'CRO consulting agency',
      status: 'confirmed',
      source: 'user',
      updatedAt: new Date().toISOString(),
      confidence: 1.0,
    },
  ];
  return createSnapshotFromFields(fields);
}

function getWarningsOfType(warnings: VariantWarning[], type: string): VariantWarning[] {
  return warnings.filter(w => w.type === type);
}

// ============================================================================
// CRO Terminology Detection Tests
// ============================================================================

describe('CRO Terminology Detection', () => {
  describe('CRO acronym detection', () => {
    it('should flag "CRO" when not in context', () => {
      const snapshot = createTrainerMarketplaceSnapshot();
      const contract = getContract('valueProp');

      const variants = [
        'Our CRO expertise helps trainers convert more visitors',
      ];

      const result = validateGeneratedVariants(variants, contract, snapshot);
      const driftWarnings = getWarningsOfType(result.warnings, 'category_drift');

      expect(driftWarnings.length).toBeGreaterThan(0);
      expect(driftWarnings.some(w =>
        w.reason.includes('CRO') || w.matchedPhrase?.toUpperCase() === 'CRO'
      )).toBe(true);
    });

    it('should NOT flag "CRO" when in CRO agency context', () => {
      const snapshot = createCROAgencySnapshot();
      const contract = getContract('valueProp');

      const variants = [
        'Industry-leading CRO services for e-commerce brands',
      ];

      const result = validateGeneratedVariants(variants, contract, snapshot);
      const driftWarnings = result.warnings.filter(
        w => w.type === 'category_drift' &&
        (w.reason.includes('CRO') || w.matchedPhrase?.toUpperCase() === 'CRO')
      );

      expect(driftWarnings.length).toBe(0);
    });
  });

  describe('conversion rate optimization detection', () => {
    it('should flag "conversion rate optimization" when not in context', () => {
      const snapshot = createTrainerMarketplaceSnapshot();
      const contract = getContract('valueProp');

      const variants = [
        'We provide conversion rate optimization for trainer profiles',
      ];

      const result = validateGeneratedVariants(variants, contract, snapshot);
      const driftWarnings = getWarningsOfType(result.warnings, 'category_drift');

      expect(driftWarnings.some(w =>
        w.reason.toLowerCase().includes('conversion rate optimization') ||
        w.matchedPhrase?.toLowerCase().includes('conversion rate')
      )).toBe(true);
    });
  });

  describe('bounce rate detection', () => {
    it('should flag "bounce rate" when not in context', () => {
      const snapshot = createTrainerMarketplaceSnapshot();
      const contract = getContract('valueProp');

      const variants = [
        'Reduce your bounce rate with our trainer matching',
      ];

      const result = validateGeneratedVariants(variants, contract, snapshot);
      const driftWarnings = getWarningsOfType(result.warnings, 'category_drift');

      expect(driftWarnings.some(w =>
        w.reason.toLowerCase().includes('bounce rate') ||
        w.matchedPhrase?.toLowerCase().includes('bounce rate')
      )).toBe(true);
    });
  });

  describe('scroll depth detection', () => {
    it('should flag "scroll depth" when not in context', () => {
      const snapshot = createTrainerMarketplaceSnapshot();
      const contract = getContract('valueProp');

      const variants = [
        'Track scroll depth and user engagement on your profile',
      ];

      const result = validateGeneratedVariants(variants, contract, snapshot);
      const driftWarnings = getWarningsOfType(result.warnings, 'category_drift');

      expect(driftWarnings.some(w =>
        w.reason.toLowerCase().includes('scroll depth') ||
        w.matchedPhrase?.toLowerCase().includes('scroll depth')
      )).toBe(true);
    });
  });

  describe('landing page optimization detection', () => {
    it('should flag "landing page performance" when not in context', () => {
      const snapshot = createTrainerMarketplaceSnapshot();
      const contract = getContract('valueProp');

      const variants = [
        'Improve landing page performance to attract more clients',
      ];

      const result = validateGeneratedVariants(variants, contract, snapshot);
      const driftWarnings = getWarningsOfType(result.warnings, 'category_drift');

      expect(driftWarnings.some(w =>
        w.reason.toLowerCase().includes('landing page')
      )).toBe(true);
    });
  });

  describe('A/B testing detection', () => {
    it('should flag "A/B testing" when not in context', () => {
      const snapshot = createTrainerMarketplaceSnapshot();
      const contract = getContract('valueProp');

      const variants = [
        'Our A/B testing helps you find the best trainer profile layout',
      ];

      const result = validateGeneratedVariants(variants, contract, snapshot);
      const driftWarnings = getWarningsOfType(result.warnings, 'category_drift');

      expect(driftWarnings.some(w =>
        w.reason.toLowerCase().includes('a/b') ||
        w.matchedPhrase?.toLowerCase().includes('a/b')
      )).toBe(true);
    });
  });

  describe('heatmaps detection', () => {
    it('should flag "heatmaps" when not in context', () => {
      const snapshot = createTrainerMarketplaceSnapshot();
      const contract = getContract('valueProp');

      const variants = [
        'Use heatmaps to understand how clients interact with profiles',
      ];

      const result = validateGeneratedVariants(variants, contract, snapshot);
      const driftWarnings = getWarningsOfType(result.warnings, 'category_drift');

      expect(driftWarnings.some(w =>
        w.reason.toLowerCase().includes('heatmap') ||
        w.matchedPhrase?.toLowerCase().includes('heatmap')
      )).toBe(true);
    });
  });

  describe('user behavior tracking detection', () => {
    it('should flag "user behavior tracking" when not in context', () => {
      const snapshot = createTrainerMarketplaceSnapshot();
      const contract = getContract('valueProp');

      const variants = [
        'Our user behavior tracking reveals what clients want',
      ];

      const result = validateGeneratedVariants(variants, contract, snapshot);
      const driftWarnings = getWarningsOfType(result.warnings, 'category_drift');

      expect(driftWarnings.some(w =>
        w.reason.toLowerCase().includes('user behavior')
      )).toBe(true);
    });
  });
});

// ============================================================================
// Website Audit Terminology Detection Tests
// ============================================================================

describe('Website Audit Terminology Detection', () => {
  it('should flag "website audit" when not in context', () => {
    const snapshot = createTrainerMarketplaceSnapshot();
    const contract = getContract('valueProp');

    const variants = [
      'Get a free website audit to improve your trainer profile',
    ];

    const result = validateGeneratedVariants(variants, contract, snapshot);
    const driftWarnings = getWarningsOfType(result.warnings, 'category_drift');

    expect(driftWarnings.some(w =>
      w.reason.toLowerCase().includes('website')
    )).toBe(true);
  });

  it('should flag "page speed" when not in context', () => {
    const snapshot = createTrainerMarketplaceSnapshot();
    const contract = getContract('valueProp');

    const variants = [
      'Improve page speed for better trainer profile visibility',
    ];

    const result = validateGeneratedVariants(variants, contract, snapshot);
    const driftWarnings = getWarningsOfType(result.warnings, 'category_drift');

    expect(driftWarnings.some(w =>
      w.reason.toLowerCase().includes('page speed')
    )).toBe(true);
  });

  it('should flag "core web vitals" when not in context', () => {
    const snapshot = createTrainerMarketplaceSnapshot();
    const contract = getContract('valueProp');

    const variants = [
      'Optimize core web vitals for your trainer marketplace profile',
    ];

    const result = validateGeneratedVariants(variants, contract, snapshot);
    const driftWarnings = getWarningsOfType(result.warnings, 'category_drift');

    expect(driftWarnings.some(w =>
      w.reason.toLowerCase().includes('core web vitals')
    )).toBe(true);
  });
});

// ============================================================================
// Warning Metadata Tests
// ============================================================================

describe('CRO Drift Warning Metadata', () => {
  it('should set action to rewrite_defensible for CRO drift', () => {
    const snapshot = createTrainerMarketplaceSnapshot();
    const contract = getContract('valueProp');

    const variants = [
      'Our CRO platform helps trainers optimize their conversion funnel',
    ];

    const result = validateGeneratedVariants(variants, contract, snapshot);
    const driftWarnings = getWarningsOfType(result.warnings, 'category_drift');

    expect(driftWarnings.length).toBeGreaterThan(0);
    expect(driftWarnings[0].action).toBe('rewrite_defensible');
  });

  it('should set severity to warning for CRO drift', () => {
    const snapshot = createTrainerMarketplaceSnapshot();
    const contract = getContract('valueProp');

    const variants = [
      'Track bounce rate and exit rate on your profile',
    ];

    const result = validateGeneratedVariants(variants, contract, snapshot);
    const driftWarnings = getWarningsOfType(result.warnings, 'category_drift');

    expect(driftWarnings.length).toBeGreaterThan(0);
    expect(driftWarnings[0].severity).toBe('warning');
  });

  it('should include matchedPhrase in warning', () => {
    const snapshot = createTrainerMarketplaceSnapshot();
    const contract = getContract('valueProp');

    const variants = [
      'Improve scroll depth on your trainer profile',
    ];

    const result = validateGeneratedVariants(variants, contract, snapshot);
    const driftWarnings = getWarningsOfType(result.warnings, 'category_drift');

    expect(driftWarnings.length).toBeGreaterThan(0);
    expect(driftWarnings[0].matchedPhrase).toBeDefined();
  });
});

// ============================================================================
// Clean Variant Tests (No False Positives)
// ============================================================================

describe('Clean Variant Detection (No False Positives)', () => {
  it('should NOT flag trainer marketplace language', () => {
    const snapshot = createTrainerMarketplaceSnapshot();
    const contract = getContract('valueProp');

    const variants = [
      'We help personal trainers connect with clients seeking fitness guidance',
    ];

    const result = validateGeneratedVariants(variants, contract, snapshot);
    const driftWarnings = getWarningsOfType(result.warnings, 'category_drift');

    expect(driftWarnings.length).toBe(0);
  });

  it('should NOT flag neutral "We help X do Y" format', () => {
    const snapshot = createTrainerMarketplaceSnapshot();
    const contract = getContract('valueProp');

    const variants = [
      'We help fitness trainers grow their client base',
    ];

    const result = validateGeneratedVariants(variants, contract, snapshot);
    const driftWarnings = getWarningsOfType(result.warnings, 'category_drift');

    expect(driftWarnings.length).toBe(0);
  });

  it('should NOT flag CRO terms when in CRO context', () => {
    // Create a context that explicitly mentions CRO terms
    const fields: ContextFieldV4[] = [
      {
        key: 'audience.icpDescription',
        domain: 'audience',
        value: 'E-commerce brands needing conversion rate optimization and A/B testing',
        status: 'confirmed',
        source: 'user',
        updatedAt: new Date().toISOString(),
        confidence: 1.0,
      },
      {
        key: 'productOffer.valueProposition',
        domain: 'productOffer',
        value: 'Website optimization, landing page optimization, and CRO services',
        status: 'confirmed',
        source: 'user',
        updatedAt: new Date().toISOString(),
        confidence: 1.0,
      },
      {
        key: 'identity.businessModel',
        domain: 'identity',
        value: 'CRO consulting agency specializing in conversion rate and landing page testing',
        status: 'confirmed',
        source: 'user',
        updatedAt: new Date().toISOString(),
        confidence: 1.0,
      },
    ];
    const snapshot = createSnapshotFromFields(fields);
    const contract = getContract('valueProp');

    const variants = [
      'We help e-commerce brands improve their conversion rate through A/B testing and landing page optimization',
    ];

    const result = validateGeneratedVariants(variants, contract, snapshot);

    // Filter to only CRO-related drift warnings
    const croDriftWarnings = result.warnings.filter(
      w => w.type === 'category_drift' &&
      (w.reason.toLowerCase().includes('cro') ||
       w.reason.toLowerCase().includes('conversion') ||
       w.reason.toLowerCase().includes('landing page') ||
       w.reason.toLowerCase().includes('a/b'))
    );

    expect(croDriftWarnings.length).toBe(0);
  });
});
