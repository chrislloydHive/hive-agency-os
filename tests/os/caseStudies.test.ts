// tests/os/caseStudies.test.ts
// Tests for Case Study schema validation and filtering

import { describe, it, expect } from 'vitest';
import {
  CaseStudySchema,
  CaseStudyInputSchema,
  CaseStudyMetricsSchema,
  normalizePermissionLevel,
} from '@/lib/types/firmBrain';
import { SEED_CASE_STUDIES } from '@/lib/os/caseStudies/seed';

// ============================================================================
// Schema Validation Tests
// ============================================================================

describe('CaseStudySchema', () => {
  it('should validate a minimal case study', () => {
    const minimal = {
      id: 'test-1',
      title: 'Test Case Study',
      client: 'Test Client',
      industry: null,
      services: [],
      summary: null,
      problem: null,
      approach: null,
      outcome: null,
      metrics: {},
      assets: [],
      tags: [],
      permissionLevel: 'internal' as const,
      visibility: 'internal' as const,
      createdAt: null,
      updatedAt: null,
    };

    const result = CaseStudySchema.safeParse(minimal);
    expect(result.success).toBe(true);
  });

  it('should validate a full case study', () => {
    const full = {
      id: 'test-1',
      title: 'Full Case Study',
      client: 'Test Client',
      industry: 'Technology',
      services: ['Branding', 'Strategy'],
      summary: 'A summary of the work',
      problem: 'The problem we solved',
      approach: 'How we solved it',
      outcome: 'The results we achieved',
      metrics: {
        brandClarity: 'Improved',
        conversionLift: 15,
      },
      assets: ['https://example.com/image.png'],
      tags: ['branding', 'tech'],
      permissionLevel: 'public' as const,
      visibility: 'public' as const,
      caseStudyUrl: 'https://example.com/case-study',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
    };

    const result = CaseStudySchema.safeParse(full);
    expect(result.success).toBe(true);
  });

  it('should reject case study without title', () => {
    const invalid = {
      id: 'test-1',
      title: '', // Empty title
      client: 'Test Client',
      industry: null,
      services: [],
      summary: null,
      problem: null,
      approach: null,
      outcome: null,
      metrics: [],
      assets: [],
      tags: [],
      permissionLevel: 'internal' as const,
      visibility: 'internal' as const,
      createdAt: null,
      updatedAt: null,
    };

    const result = CaseStudySchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject invalid permission level', () => {
    const invalid = {
      id: 'test-1',
      title: 'Test',
      client: 'Client',
      industry: null,
      services: [],
      summary: null,
      problem: null,
      approach: null,
      outcome: null,
      metrics: [],
      assets: [],
      tags: [],
      permissionLevel: 'secret', // Invalid
      visibility: 'internal',
      createdAt: null,
      updatedAt: null,
    };

    const result = CaseStudySchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Metrics Schema Tests
// ============================================================================

describe('CaseStudyMetricsSchema', () => {
  it('should accept array format (legacy)', () => {
    const arrayMetrics = [
      { label: 'Brand Clarity', value: 'Improved' },
      { label: 'Conversion', value: '15%', context: 'YoY' },
    ];

    const result = CaseStudyMetricsSchema.safeParse(arrayMetrics);
    expect(result.success).toBe(true);
  });

  it('should accept object format (new)', () => {
    const objectMetrics = {
      brandClarity: 'Improved',
      conversionLift: 15,
      engagementLift: null,
      completed: true,
    };

    const result = CaseStudyMetricsSchema.safeParse(objectMetrics);
    expect(result.success).toBe(true);
  });

  it('should accept empty array', () => {
    const result = CaseStudyMetricsSchema.safeParse([]);
    expect(result.success).toBe(true);
  });

  it('should accept empty object', () => {
    const result = CaseStudyMetricsSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// Permission Normalization Tests
// ============================================================================

describe('normalizePermissionLevel', () => {
  it('should return "public" for "public"', () => {
    expect(normalizePermissionLevel('public')).toBe('public');
  });

  it('should return "internal" for "internal"', () => {
    expect(normalizePermissionLevel('internal')).toBe('internal');
  });

  it('should map "internal_only" to "internal"', () => {
    expect(normalizePermissionLevel('internal_only')).toBe('internal');
  });

  it('should map "nda_allowed" to "internal"', () => {
    expect(normalizePermissionLevel('nda_allowed')).toBe('internal');
  });

  it('should return "internal" for null', () => {
    expect(normalizePermissionLevel(null)).toBe('internal');
  });

  it('should return "internal" for undefined', () => {
    expect(normalizePermissionLevel(undefined)).toBe('internal');
  });

  it('should return "internal" for unknown values', () => {
    expect(normalizePermissionLevel('unknown')).toBe('internal');
  });
});

// ============================================================================
// Seed Data Tests
// ============================================================================

describe('SEED_CASE_STUDIES', () => {
  it('should contain 8 case studies', () => {
    // 4 clients (MOE, FCTG, Microsoft, Optum) × 2 permission levels (internal, public)
    expect(SEED_CASE_STUDIES).toHaveLength(8);
  });

  it('should have valid structure for all seed case studies', () => {
    for (const caseStudy of SEED_CASE_STUDIES) {
      const result = CaseStudyInputSchema.safeParse(caseStudy);
      expect(result.success).toBe(true);
    }
  });

  it('should have 4 public and 4 internal case studies', () => {
    const publicCount = SEED_CASE_STUDIES.filter(
      (cs) => cs.permissionLevel === 'public'
    ).length;
    const internalCount = SEED_CASE_STUDIES.filter(
      (cs) => cs.permissionLevel === 'internal'
    ).length;

    expect(publicCount).toBe(4);
    expect(internalCount).toBe(4);
  });

  it('should include MOE, FCTG, and Microsoft clients', () => {
    const clients = new Set(SEED_CASE_STUDIES.map((cs) => cs.client));
    expect(clients.has('MOE Brand') || clients.has('MOE')).toBe(true);
    expect(clients.has('FCTG')).toBe(true);
    expect(clients.has('Microsoft')).toBe(true);
  });

  it('should have visibility matching permissionLevel', () => {
    for (const caseStudy of SEED_CASE_STUDIES) {
      expect(caseStudy.visibility).toBe(caseStudy.permissionLevel);
    }
  });
});

// ============================================================================
// Filtering Tests (Unit)
// ============================================================================

describe('Case Study Filtering', () => {
  const mockCaseStudies = SEED_CASE_STUDIES.map((cs, i) => ({
    ...cs,
    id: `test-${i}`,
    createdAt: null,
    updatedAt: null,
  }));

  it('should filter by public permission', () => {
    const publicOnly = mockCaseStudies.filter(
      (cs) => cs.permissionLevel === 'public'
    );
    expect(publicOnly).toHaveLength(4);
    expect(publicOnly.every((cs) => cs.permissionLevel === 'public')).toBe(true);
  });

  it('should filter by internal permission', () => {
    const internalOnly = mockCaseStudies.filter(
      (cs) => cs.permissionLevel === 'internal'
    );
    expect(internalOnly).toHaveLength(4);
    expect(internalOnly.every((cs) => cs.permissionLevel === 'internal')).toBe(
      true
    );
  });

  it('should search by title', () => {
    const search = 'scalable';
    const results = mockCaseStudies.filter((cs) =>
      cs.title.toLowerCase().includes(search.toLowerCase())
    );
    expect(results.length).toBeGreaterThan(0);
  });

  it('should search by client', () => {
    const search = 'microsoft';
    const results = mockCaseStudies.filter((cs) =>
      cs.client.toLowerCase().includes(search.toLowerCase())
    );
    expect(results).toHaveLength(2); // Internal + Public
  });

  it('should search by industry', () => {
    const search = 'technology';
    const results = mockCaseStudies.filter((cs) =>
      cs.industry?.toLowerCase().includes(search.toLowerCase())
    );
    expect(results.length).toBeGreaterThan(0);
  });

  it('should search by service', () => {
    const search = 'brand strategy';
    const results = mockCaseStudies.filter((cs) =>
      cs.services.some((s) => s.toLowerCase().includes(search.toLowerCase()))
    );
    expect(results.length).toBeGreaterThan(0);
  });

  it('should search by tag', () => {
    const search = 'enterprise';
    const results = mockCaseStudies.filter((cs) =>
      cs.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
    );
    expect(results.length).toBeGreaterThan(0);
  });
});
