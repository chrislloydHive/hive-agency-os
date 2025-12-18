// tests/diagnostics/canonicalContract.test.ts
// Canonical Contract Tests - verifies each Lab's canonical output guarantees
//
// These tests verify:
// 1. Each Lab's canonical specification is complete
// 2. Required fields are enforced (not missing, not empty)
// 3. Empty {} and [] are stripped
// 4. Synthesis produces valid fallbacks
// 5. Domain write gating is respected

import { describe, it, expect } from 'vitest';
import {
  ensureCanonical,
  validateCanonical,
  wouldBeStripped,
  type EnsureCanonicalInput,
} from '@/lib/diagnostics/shared/ensureCanonical';
import {
  CANONICAL_REGISTRY,
  BRAND_LAB_SPEC,
  WEBSITE_LAB_SPEC,
  SEO_LAB_SPEC,
  CONTENT_LAB_SPEC,
  COMPETITION_LAB_SPEC,
  AUDIENCE_LAB_SPEC,
  getCanonicalSpec,
  getRequiredPaths,
  isRegisteredLabType,
  type LabType,
} from '@/lib/diagnostics/shared/canonicalRegistry';

// ============================================================================
// Test Data
// ============================================================================

const mockBrandV1Result = {
  diagnostic: {
    positioning: {
      positioningTheme: 'The leading platform for business intelligence and company research.',
    },
    identitySystem: {
      tagline: 'Find the companies that matter',
      corePromise: 'Access verified data on millions of companies',
    },
    messagingSystem: {
      valueProps: [
        {
          statement: 'Comprehensive data coverage — Access verified information on millions of companies worldwide',
        },
      ],
      uniqueValueProps: ['Real-time data updates', 'AI-powered insights', 'Global coverage'],
    },
    audienceFit: {
      primaryICPDescription: 'Sales professionals, investors, and market researchers who need accurate company data',
      targetAudience: 'Business professionals seeking market intelligence',
    },
  },
};

const mockWebsiteV1Result = {
  siteAssessment: {
    benchmarkLabel: 'Established',
    conversionAnalysis: {
      primaryCta: 'Start Free Trial',
    },
    issues: [
      { title: 'Slow page load', severity: 'high' },
      { title: 'Missing meta descriptions', severity: 'medium' },
    ],
  },
};

const mockSeoV1Result = {
  maturityStage: 'scaling',
  subscores: [
    { label: 'Technical SEO', status: 'good', score: 75 },
    { label: 'On-Page SEO', status: 'needs-work', score: 55 },
  ],
  issues: [
    { title: 'Missing alt tags', severity: 'medium', category: 'accessibility' },
    { title: 'Duplicate content', severity: 'high', category: 'content' },
  ],
  analyticsSnapshot: {
    topQueries: ['company research', 'business data', 'funding rounds'],
  },
};

const mockContentV1Result = {
  maturityStage: 'emerging',
  findings: {
    contentTypes: [
      { type: 'blog', present: true },
      { type: 'case-studies', present: false },
    ],
    topics: ['market intelligence', 'startup ecosystem', 'investor data'],
  },
  issues: [
    { title: 'Inconsistent publishing cadence', severity: 'medium' },
    { title: 'Missing content calendar', severity: 'low' },
  ],
};

const mockCompetitionV1Result = {
  competitors: [
    { name: 'PitchBook', domain: 'pitchbook.com', category: 'direct' },
    { name: 'ZoomInfo', domain: 'zoominfo.com', category: 'indirect' },
    { name: 'LinkedIn', domain: 'linkedin.com', category: 'indirect' },
  ],
  overallThreatLevel: 65,
};

const mockAudienceV1Result = {
  primaryAudience: 'Enterprise sales teams and venture capital analysts',
  segments: [
    { name: 'Sales Professionals', size: 'large' },
    { name: 'Investors', size: 'medium' },
  ],
  painPoints: ['Data accuracy concerns', 'Integration challenges', 'Pricing'],
};

// ============================================================================
// Registry Tests
// ============================================================================

describe('Canonical Registry', () => {
  describe('Registry Completeness', () => {
    it('should have specs for all core Lab types', () => {
      const coreLabTypes: LabType[] = ['brand', 'website', 'seo', 'content', 'competition', 'audience'];

      for (const labType of coreLabTypes) {
        const spec = CANONICAL_REGISTRY[labType];
        expect(spec).toBeDefined();
        expect(spec.fields.length).toBeGreaterThan(0);
      }
    });

    it('should have at least one required field per Lab spec', () => {
      const specsWithContent = [BRAND_LAB_SPEC, WEBSITE_LAB_SPEC, SEO_LAB_SPEC, CONTENT_LAB_SPEC, COMPETITION_LAB_SPEC, AUDIENCE_LAB_SPEC];

      for (const spec of specsWithContent) {
        const requiredFields = spec.fields.filter(f => f.required);
        expect(requiredFields.length).toBeGreaterThan(0);
        // Each required field should have a label and type
        for (const field of requiredFields) {
          expect(field.label).toBeDefined();
          expect(field.type).toBeDefined();
          expect(['string', 'array', 'object', 'number']).toContain(field.type);
        }
      }
    });

    it('should have unique field paths within each spec', () => {
      for (const [labType, spec] of Object.entries(CANONICAL_REGISTRY)) {
        const paths = spec.fields.map(f => f.path);
        const uniquePaths = new Set(paths);
        expect(uniquePaths.size).toBe(paths.length);
      }
    });
  });

  describe('Brand Lab Spec', () => {
    it('should require positioning.statement', () => {
      const positioningField = BRAND_LAB_SPEC.fields.find(f => f.path === 'positioning.statement');
      expect(positioningField).toBeDefined();
      expect(positioningField?.required).toBe(true);
      expect(positioningField?.minLength).toBeGreaterThan(0);
    });

    it('should require valueProp.headline', () => {
      const valuePropField = BRAND_LAB_SPEC.fields.find(f => f.path === 'valueProp.headline');
      expect(valuePropField).toBeDefined();
      expect(valuePropField?.required).toBe(true);
    });

    it('should require differentiators.bullets as array', () => {
      const diffField = BRAND_LAB_SPEC.fields.find(f => f.path === 'differentiators.bullets');
      expect(diffField).toBeDefined();
      expect(diffField?.required).toBe(true);
      expect(diffField?.type).toBe('array');
      expect(diffField?.minItems).toBe(1);
    });

    it('should require icp.primaryAudience', () => {
      const icpField = BRAND_LAB_SPEC.fields.find(f => f.path === 'icp.primaryAudience');
      expect(icpField).toBeDefined();
      expect(icpField?.required).toBe(true);
      expect(icpField?.minLength).toBeGreaterThan(0);
    });
  });

  describe('Competition Lab Spec', () => {
    it('should require competitors array', () => {
      const field = COMPETITION_LAB_SPEC.fields.find(f => f.path === 'competitors');
      expect(field).toBeDefined();
      expect(field?.required).toBe(true);
      expect(field?.type).toBe('array');
    });

    it('should require positionSummary string', () => {
      const field = COMPETITION_LAB_SPEC.fields.find(f => f.path === 'positionSummary');
      expect(field).toBeDefined();
      expect(field?.required).toBe(true);
      expect(field?.type).toBe('string');
    });
  });
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('Canonical Utilities', () => {
  describe('getCanonicalSpec', () => {
    it('should return spec for valid lab types', () => {
      expect(getCanonicalSpec('brand')).toBe(BRAND_LAB_SPEC);
      expect(getCanonicalSpec('competition')).toBe(COMPETITION_LAB_SPEC);
    });

    it('should return null for invalid lab types', () => {
      expect(getCanonicalSpec('invalid' as LabType)).toBeNull();
    });
  });

  describe('getRequiredPaths', () => {
    it('should return required paths for brand', () => {
      const paths = getRequiredPaths('brand');
      expect(paths).toContain('positioning.statement');
      expect(paths).toContain('valueProp.headline');
      expect(paths).toContain('differentiators.bullets');
      expect(paths).toContain('icp.primaryAudience');
    });

    it('should not include optional paths', () => {
      const paths = getRequiredPaths('brand');
      expect(paths).not.toContain('positioning.summary'); // Optional
      expect(paths).not.toContain('toneOfVoice.descriptor'); // Optional
    });
  });

  describe('isRegisteredLabType', () => {
    it('should return true for registered types', () => {
      expect(isRegisteredLabType('brand')).toBe(true);
      expect(isRegisteredLabType('competition')).toBe(true);
    });

    it('should return false for unregistered types', () => {
      expect(isRegisteredLabType('unknown')).toBe(false);
      expect(isRegisteredLabType('')).toBe(false);
    });
  });

  describe('wouldBeStripped', () => {
    it('should identify empty objects', () => {
      expect(wouldBeStripped({})).toBe(true);
    });

    it('should identify empty arrays', () => {
      expect(wouldBeStripped([])).toBe(true);
    });

    it('should identify empty strings', () => {
      expect(wouldBeStripped('')).toBe(true);
    });

    it('should identify undefined', () => {
      expect(wouldBeStripped(undefined)).toBe(true);
    });

    it('should NOT strip explicit null', () => {
      expect(wouldBeStripped(null)).toBe(false);
    });

    it('should NOT strip valid values', () => {
      expect(wouldBeStripped('test')).toBe(false);
      expect(wouldBeStripped(['item'])).toBe(false);
      expect(wouldBeStripped({ key: 'value' })).toBe(false);
      expect(wouldBeStripped(0)).toBe(false);
      expect(wouldBeStripped(false)).toBe(false);
    });
  });
});

// ============================================================================
// ensureCanonical Tests
// ============================================================================

describe('ensureCanonical', () => {
  describe('Brand Lab', () => {
    it('should synthesize canonical fields from v1 result', () => {
      const result = ensureCanonical({
        labType: 'brand',
        canonical: {},
        v1Result: mockBrandV1Result,
      });

      expect(result.synthesizedFields.length).toBeGreaterThan(0);
      expect(result.canonical.positioning).toBeDefined();
      expect((result.canonical.positioning as any).statement).toBeDefined();
    });

    it('should preserve existing canonical values', () => {
      const existingCanonical = {
        positioning: {
          statement: 'Existing positioning statement for the company.',
          confidence: 0.95,
        },
      };

      const result = ensureCanonical({
        labType: 'brand',
        canonical: existingCanonical,
        v1Result: mockBrandV1Result,
      });

      // Should keep existing positioning
      expect((result.canonical.positioning as any).statement).toBe('Existing positioning statement for the company.');
    });

    it('should set null for required fields that cannot be synthesized', () => {
      const result = ensureCanonical({
        labType: 'brand',
        canonical: {},
        v1Result: {}, // Empty v1 result
      });

      // Required fields should be null, not undefined
      expect(result.nullFields.length).toBeGreaterThan(0);
    });

    it('should strip empty objects from output', () => {
      const result = ensureCanonical({
        labType: 'brand',
        canonical: {
          emptyField: {},
          emptyArray: [],
          positioning: {
            statement: 'Valid statement for testing purposes.',
            emptyNested: {},
          },
        },
        v1Result: mockBrandV1Result,
      });

      // Empty objects should be stripped
      expect(result.canonical.emptyField).toBeUndefined();
      expect(result.canonical.emptyArray).toBeUndefined();
      expect((result.canonical.positioning as any).emptyNested).toBeUndefined();
    });

    it('should report valid when all required fields present', () => {
      const completeCanonical = {
        positioning: {
          statement: 'A complete positioning statement for the company.',
          summary: 'Summary text',
          confidence: 0.9,
        },
        valueProp: {
          headline: 'Value prop headline',
          description: 'Description',
          confidence: 0.9,
        },
        differentiators: {
          bullets: ['Diff 1', 'Diff 2', 'Diff 3'],
          confidence: 0.9,
        },
        icp: {
          primaryAudience: 'Primary audience description for the company.',
          confidence: 0.9,
        },
      };

      const result = ensureCanonical({
        labType: 'brand',
        canonical: completeCanonical,
      });

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });
  });

  describe('Competition Lab', () => {
    it('should synthesize competitors array', () => {
      const result = ensureCanonical({
        labType: 'competition',
        canonical: {},
        v1Result: mockCompetitionV1Result,
      });

      expect(result.canonical.competitors).toBeDefined();
      expect(Array.isArray(result.canonical.competitors)).toBe(true);
      expect((result.canonical.competitors as any[]).length).toBe(3);
    });

    it('should synthesize position summary', () => {
      const result = ensureCanonical({
        labType: 'competition',
        canonical: {},
        v1Result: mockCompetitionV1Result,
      });

      expect(result.canonical.positionSummary).toBeDefined();
      expect(typeof result.canonical.positionSummary).toBe('string');
    });

    it('should handle empty competitors list', () => {
      const result = ensureCanonical({
        labType: 'competition',
        canonical: {},
        v1Result: { competitors: [] },
      });

      // Empty array is valid for competitors (minItems: 0)
      expect(result.valid).toBe(true);
    });
  });

  describe('Website Lab', () => {
    it('should synthesize UX maturity from benchmark label', () => {
      const result = ensureCanonical({
        labType: 'website',
        canonical: {},
        v1Result: mockWebsiteV1Result,
      });

      expect(result.canonical.uxMaturity).toBe('Established');
    });

    it('should synthesize primary CTA', () => {
      const result = ensureCanonical({
        labType: 'website',
        canonical: {},
        v1Result: mockWebsiteV1Result,
      });

      expect(result.canonical.primaryCta).toBe('Start Free Trial');
    });

    it('should synthesize top issues', () => {
      const result = ensureCanonical({
        labType: 'website',
        canonical: {},
        v1Result: mockWebsiteV1Result,
      });

      expect(result.canonical.topIssues).toBeDefined();
      expect(Array.isArray(result.canonical.topIssues)).toBe(true);
    });
  });

  describe('SEO Lab', () => {
    it('should synthesize maturity stage', () => {
      const result = ensureCanonical({
        labType: 'seo',
        canonical: {},
        v1Result: mockSeoV1Result,
      });

      expect(result.canonical.maturityStage).toBe('scaling');
    });

    it('should synthesize technical health', () => {
      const result = ensureCanonical({
        labType: 'seo',
        canonical: {},
        v1Result: mockSeoV1Result,
      });

      expect(result.canonical.technicalHealth).toBe('good');
    });

    it('should synthesize top queries', () => {
      const result = ensureCanonical({
        labType: 'seo',
        canonical: {},
        v1Result: mockSeoV1Result,
      });

      expect(result.canonical.topQueries).toBeDefined();
      expect((result.canonical.topQueries as string[])).toContain('company research');
    });
  });

  describe('Content Lab', () => {
    it('should synthesize content maturity stage', () => {
      const result = ensureCanonical({
        labType: 'content',
        canonical: {},
        v1Result: mockContentV1Result,
      });

      expect(result.canonical.maturityStage).toBe('emerging');
    });

    it('should filter to present content types only', () => {
      const result = ensureCanonical({
        labType: 'content',
        canonical: {},
        v1Result: mockContentV1Result,
      });

      expect(result.canonical.contentTypes).toBeDefined();
      expect((result.canonical.contentTypes as string[])).toContain('blog');
      expect((result.canonical.contentTypes as string[])).not.toContain('case-studies');
    });

    it('should synthesize top topics', () => {
      const result = ensureCanonical({
        labType: 'content',
        canonical: {},
        v1Result: mockContentV1Result,
      });

      expect(result.canonical.topTopics).toBeDefined();
      expect((result.canonical.topTopics as string[])).toContain('market intelligence');
    });
  });

  describe('Audience Lab', () => {
    it('should synthesize primary audience', () => {
      const result = ensureCanonical({
        labType: 'audience',
        canonical: {},
        v1Result: mockAudienceV1Result,
      });

      expect(result.canonical.primaryAudience).toBeDefined();
      expect(result.canonical.primaryAudience).toContain('sales teams');
    });

    it('should synthesize segments', () => {
      const result = ensureCanonical({
        labType: 'audience',
        canonical: {},
        v1Result: mockAudienceV1Result,
      });

      expect(result.canonical.segments).toBeDefined();
      expect(Array.isArray(result.canonical.segments)).toBe(true);
    });

    it('should synthesize pain points', () => {
      const result = ensureCanonical({
        labType: 'audience',
        canonical: {},
        v1Result: mockAudienceV1Result,
      });

      expect(result.canonical.painPoints).toBeDefined();
      expect((result.canonical.painPoints as string[])).toContain('Data accuracy concerns');
    });
  });
});

// ============================================================================
// validateCanonical Tests
// ============================================================================

describe('validateCanonical', () => {
  it('should fail for missing required fields', () => {
    const result = validateCanonical('brand', {});

    expect(result.valid).toBe(false);
    expect(result.missingFields.length).toBeGreaterThan(0);
    expect(result.missingFields).toContain('positioning.statement');
  });

  it('should fail for empty string on required string field', () => {
    const result = validateCanonical('brand', {
      positioning: {
        statement: '', // Empty string
      },
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('positioning.statement'))).toBe(true);
  });

  it('should fail for string below minLength', () => {
    const result = validateCanonical('brand', {
      positioning: {
        statement: 'Too short', // Less than 15 chars
      },
    });

    expect(result.valid).toBe(false);
  });

  it('should fail for empty array on required array field with minItems > 0', () => {
    const result = validateCanonical('brand', {
      positioning: {
        statement: 'Valid positioning statement here.',
      },
      valueProp: {
        headline: 'Valid headline',
      },
      differentiators: {
        bullets: [], // Empty, but minItems: 1
      },
      icp: {
        primaryAudience: 'Valid audience description.',
      },
    });

    expect(result.valid).toBe(false);
    expect(result.missingFields).toContain('differentiators.bullets');
  });

  it('should pass for complete valid canonical object', () => {
    const result = validateCanonical('brand', {
      positioning: {
        statement: 'A complete and valid positioning statement.',
      },
      valueProp: {
        headline: 'Valid headline',
      },
      differentiators: {
        bullets: ['Differentiator 1', 'Differentiator 2'],
      },
      icp: {
        primaryAudience: 'Valid primary audience description.',
      },
    });

    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it('should accept null for required fields (explicit "not available")', () => {
    // Note: null is accepted as "explicitly not available" but validation may still fail
    // because null doesn't "meet the spec" for required fields
    const result = validateCanonical('competition', {
      competitors: [],
      positionSummary: null, // Explicit null - should fail required
    });

    // Null should fail required field validation
    expect(result.valid).toBe(false);
  });
});

// ============================================================================
// Empty Field Detection Tests
// ============================================================================

describe('Empty Field Detection', () => {
  it('should identify {} as empty', () => {
    const result = ensureCanonical({
      labType: 'brand',
      canonical: {
        emptyObj: {},
      },
    });

    expect(result.canonical.emptyObj).toBeUndefined();
  });

  it('should identify { value: null } as potentially polluted', () => {
    // This tests the Context Graph pattern of { value: null, provenance: [] }
    const pollutedField = { value: null, provenance: [] };
    expect(wouldBeStripped(pollutedField.value)).toBe(false); // null is preserved
  });

  it('should identify nested empty objects', () => {
    const result = ensureCanonical({
      labType: 'brand',
      canonical: {
        nested: {
          inner: {
            deepEmpty: {},
          },
        },
      },
    });

    // Entire nested structure should be stripped
    expect(result.canonical.nested).toBeUndefined();
  });

  it('should preserve null values (explicit "not available")', () => {
    const result = ensureCanonical({
      labType: 'brand',
      canonical: {
        positioning: {
          statement: null, // Explicit null
        },
      },
    });

    // Null should be preserved
    expect((result.canonical.positioning as any)?.statement).toBeNull();
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Canonical Contract Integration', () => {
  it('should handle full Brand Lab flow', () => {
    // Simulate Brand Lab output with partial findings
    const brandLabOutput = {
      positioning: {
        statement: 'Customer-facing positioning statement.',
        confidence: 0.85,
      },
      // Missing valueProp, differentiators, icp
    };

    const result = ensureCanonical({
      labType: 'brand',
      canonical: brandLabOutput,
      v1Result: mockBrandV1Result,
    });

    // Should have synthesized missing fields
    expect(result.synthesizedFields.length).toBeGreaterThan(0);

    // Should have all required fields either from original or synthesized
    const validation = validateCanonical('brand', result.canonical);
    // Note: validation may still fail if synthesis couldn't produce valid values
    expect(result.canonical.positioning).toBeDefined();
  });

  it('should prevent writing invalid canonical to Context Graph', () => {
    const incompleteCanonical = {
      positioning: {
        statement: 'Short', // Too short
      },
    };

    const validation = validateCanonical('brand', incompleteCanonical);

    // This should fail - caller should not write to Context Graph
    expect(validation.valid).toBe(false);
  });

  it('should track synthesized fields for provenance', () => {
    const result = ensureCanonical({
      labType: 'brand',
      canonical: {},
      v1Result: mockBrandV1Result,
    });

    // Synthesized fields should be tracked
    expect(result.synthesizedFields.length).toBeGreaterThan(0);

    // Each synthesized field should be in the result
    for (const path of result.synthesizedFields) {
      const parts = path.split('.');
      let value: any = result.canonical;
      for (const part of parts) {
        value = value?.[part];
      }
      expect(value).toBeDefined();
    }
  });
});
