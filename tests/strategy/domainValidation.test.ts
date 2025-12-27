// tests/strategy/domainValidation.test.ts
// Tests for domain mismatch validation in variant generation
//
// Covers:
// - Domain mismatch detection (e.g., healthcare terms in e-commerce context)
// - Category drift detection (mechanism/tool language not in context)
// - Integration with validateGeneratedVariants

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

function createEcommerceSnapshot(): ConfirmedContextSnapshot {
  const fields: ContextFieldV4[] = [
    {
      key: 'audience.icpDescription',
      domain: 'audience',
      value: 'Online shoppers looking for fashion deals',
      status: 'confirmed',
      source: 'user',
      updatedAt: new Date().toISOString(),
      confidence: 1.0,
    },
    {
      key: 'identity.businessModel',
      domain: 'identity',
      value: 'E-commerce fashion retailer',
      status: 'confirmed',
      source: 'user',
      updatedAt: new Date().toISOString(),
      confidence: 1.0,
    },
    {
      key: 'productOffer.valueProposition',
      domain: 'productOffer',
      value: 'Affordable trendy clothing delivered fast',
      status: 'confirmed',
      source: 'user',
      updatedAt: new Date().toISOString(),
      confidence: 1.0,
    },
  ];
  return createSnapshotFromFields(fields);
}

function createSaaSSnapshot(): ConfirmedContextSnapshot {
  const fields: ContextFieldV4[] = [
    {
      key: 'audience.icpDescription',
      domain: 'audience',
      value: 'B2B SaaS companies with MRR over $50k',
      status: 'confirmed',
      source: 'user',
      updatedAt: new Date().toISOString(),
      confidence: 1.0,
    },
    {
      key: 'identity.businessModel',
      domain: 'identity',
      value: 'SaaS subscription model',
      status: 'confirmed',
      source: 'user',
      updatedAt: new Date().toISOString(),
      confidence: 1.0,
    },
    {
      key: 'productOffer.valueProposition',
      domain: 'productOffer',
      value: 'Analytics platform for reducing churn rate',
      status: 'confirmed',
      source: 'user',
      updatedAt: new Date().toISOString(),
      confidence: 1.0,
    },
  ];
  return createSnapshotFromFields(fields);
}

function getWarningOfType(warnings: VariantWarning[], type: string): VariantWarning | undefined {
  return warnings.find(w => w.type === type);
}

// ============================================================================
// Domain Mismatch Tests
// ============================================================================

describe('Domain Mismatch Detection', () => {
  describe('healthcare terms in e-commerce context', () => {
    it('should flag healthcare terminology not in context', () => {
      const snapshot = createEcommerceSnapshot();
      const contract = getContract('valueProp');

      // Variant that mentions healthcare terms (not in e-commerce context)
      const variants = [
        'We help patients manage their treatment plans efficiently',
      ];

      const result = validateGeneratedVariants(variants, contract, snapshot);

      const domainWarning = getWarningOfType(result.warnings, 'domain_mismatch');
      expect(domainWarning).toBeDefined();
      expect(domainWarning?.reason).toContain('healthcare');
    });

    it('should NOT flag e-commerce terms in e-commerce context', () => {
      const snapshot = createEcommerceSnapshot();
      const contract = getContract('valueProp');

      // Variant that uses appropriate e-commerce language
      const variants = [
        'Shop the latest trends with fast checkout and free shipping',
      ];

      const result = validateGeneratedVariants(variants, contract, snapshot);

      const domainWarning = getWarningOfType(result.warnings, 'domain_mismatch');
      // Should not flag since checkout is common in e-commerce
      // Note: context includes "online shoppers" so e-commerce terms are acceptable
      expect(domainWarning).toBeUndefined();
    });
  });

  describe('finance terms in non-finance context', () => {
    it('should flag finance terminology not in context', () => {
      const snapshot = createEcommerceSnapshot();
      const contract = getContract('valueProp');

      // Variant that mentions finance terms (not in fashion e-commerce context)
      const variants = [
        'Optimize your investment portfolio with our trading algorithms',
      ];

      const result = validateGeneratedVariants(variants, contract, snapshot);

      const domainWarning = getWarningOfType(result.warnings, 'domain_mismatch');
      expect(domainWarning).toBeDefined();
      expect(domainWarning?.reason).toContain('finance');
    });
  });

  describe('SaaS terms in appropriate context', () => {
    it('should NOT flag SaaS metrics when in SaaS context', () => {
      const snapshot = createSaaSSnapshot();
      const contract = getContract('valueProp');

      // Variant using SaaS metrics terms - context mentions MRR and churn
      const variants = [
        'Reduce churn rate by 30% with our predictive analytics',
      ];

      const result = validateGeneratedVariants(variants, contract, snapshot);

      const domainWarning = getWarningOfType(result.warnings, 'domain_mismatch');
      // Should not flag since context already mentions churn rate
      expect(domainWarning).toBeUndefined();
    });
  });
});

// ============================================================================
// Category Drift Tests
// ============================================================================

describe('Category Drift Detection', () => {
  it('should flag mechanism/tool language not in context', () => {
    const snapshot = createEcommerceSnapshot();
    const contract = getContract('valueProp');

    // Variant that introduces platform/software language not in context
    const variants = [
      'Our AI-powered platform automates your entire workflow with seamless integrations',
    ];

    const result = validateGeneratedVariants(variants, contract, snapshot);

    const driftWarning = getWarningOfType(result.warnings, 'category_drift');
    expect(driftWarning).toBeDefined();
    // Should flag "platform", "AI-powered", "workflow", or "integrations"
    expect(driftWarning?.type).toBe('category_drift');
  });

  it('should NOT flag mechanism language when present in context', () => {
    // Create a snapshot that explicitly mentions platform
    const fields: ContextFieldV4[] = [
      {
        key: 'audience.icpDescription',
        domain: 'audience',
        value: 'Users of our fashion platform',
        status: 'confirmed',
        source: 'user',
        updatedAt: new Date().toISOString(),
        confidence: 1.0,
      },
      {
        key: 'productOffer.valueProposition',
        domain: 'productOffer',
        value: 'Platform for discovering fashion trends',
        status: 'confirmed',
        source: 'user',
        updatedAt: new Date().toISOString(),
        confidence: 1.0,
      },
    ];
    const snapshot = createSnapshotFromFields(fields);
    const contract = getContract('valueProp');

    const variants = [
      'The fashion platform that helps you discover trends',
    ];

    const result = validateGeneratedVariants(variants, contract, snapshot);

    const driftWarning = getWarningOfType(result.warnings, 'category_drift');
    // "platform" is in context, so should not flag
    expect(driftWarning).toBeUndefined();
  });
});

// ============================================================================
// Warning Action Map Tests
// ============================================================================

describe('Warning Action Mapping', () => {
  it('should recommend rewrite_defensible for domain_mismatch', () => {
    const snapshot = createEcommerceSnapshot();
    const contract = getContract('valueProp');

    const variants = [
      'Help patients manage their healthcare needs',
    ];

    const result = validateGeneratedVariants(variants, contract, snapshot);

    const domainWarning = getWarningOfType(result.warnings, 'domain_mismatch');
    expect(domainWarning?.action).toBe('rewrite_defensible');
  });

  it('should recommend rewrite_defensible for category_drift', () => {
    const snapshot = createEcommerceSnapshot();
    const contract = getContract('valueProp');

    const variants = [
      'Our analytics dashboard provides real-time metrics',
    ];

    const result = validateGeneratedVariants(variants, contract, snapshot);

    const driftWarning = getWarningOfType(result.warnings, 'category_drift');
    expect(driftWarning?.action).toBe('rewrite_defensible');
  });
});

// ============================================================================
// Product Category Drift Tests (TrainrHub-style)
// ============================================================================

describe('Product Category Drift Detection', () => {
  describe('marketplace → CRO drift', () => {
    it('should flag CRO language in trainer marketplace context', () => {
      // TrainrHub-style context: trainer marketplace
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
      ];
      const snapshot = createSnapshotFromFields(fields);
      const contract = getContract('valueProp');

      // Variant drifts into CRO/website optimization language
      const variants = [
        'Optimize your landing pages to improve conversion rate optimization for website visitors',
      ];

      const result = validateGeneratedVariants(variants, contract, snapshot);

      const driftWarning = getWarningOfType(result.warnings, 'domain_mismatch');
      expect(driftWarning).toBeDefined();
      expect(driftWarning?.reason).toContain('CRO');
    });

    it('should flag web analytics language in trainer context', () => {
      const fields: ContextFieldV4[] = [
        {
          key: 'productOffer.valueProposition',
          domain: 'productOffer',
          value: 'Connect clients with personal trainers for fitness sessions',
          status: 'confirmed',
          source: 'user',
          updatedAt: new Date().toISOString(),
          confidence: 1.0,
        },
      ];
      const snapshot = createSnapshotFromFields(fields);
      const contract = getContract('valueProp');

      const variants = [
        'Reduce bounce rate and improve scroll depth with our analytics',
      ];

      const result = validateGeneratedVariants(variants, contract, snapshot);

      const driftWarning = getWarningOfType(result.warnings, 'domain_mismatch');
      expect(driftWarning).toBeDefined();
      expect(driftWarning?.reason).toContain('marketplace');
    });

    it('should NOT flag when CRO terms are in context', () => {
      // Context explicitly mentions CRO
      const fields: ContextFieldV4[] = [
        {
          key: 'productOffer.valueProposition',
          domain: 'productOffer',
          value: 'Trainer marketplace with CRO for landing pages',
          status: 'confirmed',
          source: 'user',
          updatedAt: new Date().toISOString(),
          confidence: 1.0,
        },
      ];
      const snapshot = createSnapshotFromFields(fields);
      const contract = getContract('valueProp');

      const variants = [
        'CRO tools to improve your trainer profile conversion',
      ];

      const result = validateGeneratedVariants(variants, contract, snapshot);

      // Should not flag since CRO is explicitly in context
      const driftWarning = result.warnings.find(
        w => w.type === 'domain_mismatch' && w.reason?.includes('CRO')
      );
      expect(driftWarning).toBeUndefined();
    });
  });

  describe('CRO → marketplace drift', () => {
    it('should flag trainer/marketplace language in CRO context', () => {
      // CRO agency context
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
      ];
      const snapshot = createSnapshotFromFields(fields);
      const contract = getContract('valueProp');

      // Variant drifts into trainer marketplace language
      const variants = [
        'Connect with personal trainers to book fitness sessions and appointments',
      ];

      const result = validateGeneratedVariants(variants, contract, snapshot);

      const driftWarning = getWarningOfType(result.warnings, 'domain_mismatch');
      expect(driftWarning).toBeDefined();
      expect(driftWarning?.reason).toContain('CRO');
    });
  });

  describe('agency → SaaS drift', () => {
    it('should flag SaaS product language in agency context', () => {
      const fields: ContextFieldV4[] = [
        {
          key: 'identity.businessModel',
          domain: 'identity',
          value: 'Digital marketing agency providing consulting services',
          status: 'confirmed',
          source: 'user',
          updatedAt: new Date().toISOString(),
          confidence: 1.0,
        },
      ];
      const snapshot = createSnapshotFromFields(fields);
      const contract = getContract('valueProp');

      const variants = [
        'Try our freemium self-serve platform with a free trial',
      ];

      const result = validateGeneratedVariants(variants, contract, snapshot);

      const driftWarning = getWarningOfType(result.warnings, 'domain_mismatch');
      expect(driftWarning).toBeDefined();
      expect(driftWarning?.reason).toContain('SaaS');
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Validation Result Structure', () => {
  it('should include domain and phrase in warning metadata', () => {
    const snapshot = createEcommerceSnapshot();
    const contract = getContract('valueProp');

    const variants = [
      'Streamline patient care with our medical platform',
    ];

    const result = validateGeneratedVariants(variants, contract, snapshot);

    const domainWarning = getWarningOfType(result.warnings, 'domain_mismatch');
    expect(domainWarning).toBeDefined();
    expect(domainWarning?.matchedPhrase).toBeDefined();
    expect(domainWarning?.meta?.phrases).toBeDefined();
  });

  it('should set severity to warning for domain mismatch', () => {
    const snapshot = createEcommerceSnapshot();
    const contract = getContract('valueProp');

    const variants = [
      'We handle all your banking needs',
    ];

    const result = validateGeneratedVariants(variants, contract, snapshot);

    const domainWarning = getWarningOfType(result.warnings, 'domain_mismatch');
    expect(domainWarning?.severity).toBe('warning');
  });

  it('should include variantIndex in warnings', () => {
    const snapshot = createEcommerceSnapshot();
    const contract = getContract('valueProp');

    const variants = [
      'Clean fashion for clean living', // No issue
      'Healthcare solutions for everyone', // Domain mismatch
      'Another clean variant', // No issue
    ];

    const result = validateGeneratedVariants(variants, contract, snapshot);

    const domainWarning = getWarningOfType(result.warnings, 'domain_mismatch');
    expect(domainWarning?.variantIndex).toBe(1); // Second variant (0-indexed)
  });
});
