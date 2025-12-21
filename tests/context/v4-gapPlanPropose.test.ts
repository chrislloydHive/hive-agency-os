// tests/context/v4-gapPlanPropose.test.ts
// Unit tests for V4 GAP Plan proposal flow
//
// Tests:
// - buildGapPlanCandidates: extracts candidates from GAP Plan dataJson
// - proposeFromLabResult: proposes candidates to V4 store

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildGapPlanCandidates,
  findGapPlanRoot,
} from '@/lib/contextGraph/v4/gapPlanCandidates';

// Mock Airtable for proposeFromLabResult tests
vi.mock('@/lib/airtable', () => ({
  getBase: vi.fn(() => {
    return (tableName: string) => ({
      select: vi.fn(() => ({
        firstPage: vi.fn().mockResolvedValue([]),
      })),
      create: vi.fn().mockResolvedValue([{ id: 'rec123' }]),
      update: vi.fn().mockResolvedValue({ id: 'rec123' }),
    });
  }),
}));

// Mock feature flag
vi.mock('@/lib/types/contextField', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/types/contextField')>();
  return {
    ...actual,
    isContextV4Enabled: vi.fn(() => true),
    isContextV4IngestGapPlanEnabled: vi.fn(() => true),
  };
});

// ============================================================================
// Test Data: Representative GAP Plan dataJson
// ============================================================================

// Simplified mock that matches the shape consumed by buildGapPlanCandidates
const mockGapPlanDataJson = {
  companyName: 'Test Company',
  snapshotId: 'snap-123',
  labsRun: ['websiteLab', 'brandLab'],
  gapStructured: {
    scores: {
      overall: 72,
      brand: 68,
      content: 75,
      website: 80,
      seo: 65,
    },
    maturityStage: 'Emerging',
    primaryOffers: [
      {
        name: 'Marketing Automation Platform',
        description: 'Our platform helps businesses automate their marketing workflows and increase efficiency.',
        targetAudience: 'SMB Marketing Teams',
        priceTier: 'mid' as const,
      },
      {
        name: 'Analytics Dashboard',
        description: 'Real-time analytics and reporting for data-driven decisions.',
        targetAudience: 'Marketing Managers',
        priceTier: 'high' as const,
      },
    ],
    competitors: [
      {
        name: 'HubSpot',
        domain: 'hubspot.com',
        positioningNote: 'Enterprise-focused all-in-one solution',
      },
      {
        name: 'Mailchimp',
        domain: 'mailchimp.com',
        positioningNote: 'Email-first with growing platform play',
      },
    ],
    audienceSummary: {
      icpDescription: 'Growth-focused SMB marketing teams with 5-50 employees seeking marketing automation',
      keyPainPoints: ['Manual workflows', 'Lack of analytics', 'Limited budget'],
      buyingTriggers: ['Team growth', 'New marketing initiative'],
    },
    brandIdentityNotes: {
      tone: ['Professional', 'Approachable'],
      personality: ['Innovative', 'Trustworthy'],
      differentiationSummary: 'Best-in-class automation with SMB-friendly pricing',
    },
    keyFindings: ['Strong website but weak content'],
    kpisToWatch: [{ name: 'MQL to SQL conversion' }],
  },
  insights: [],
};

// ============================================================================
// buildGapPlanCandidates Tests
// ============================================================================

describe('buildGapPlanCandidates', () => {
  describe('Extraction Paths', () => {
    it('should extract from direct format', () => {
      const rawJson = mockGapPlanDataJson;

      const result = buildGapPlanCandidates(rawJson);

      expect(result.extractionPath).toBe('direct');
      expect(result.candidates.length).toBeGreaterThan(0);
    });

    it('should extract from result wrapper', () => {
      const rawJson = {
        result: mockGapPlanDataJson,
      };

      const result = buildGapPlanCandidates(rawJson);

      expect(result.extractionPath).toBe('result');
      expect(result.candidates.length).toBeGreaterThan(0);
    });

    it('should extract from data wrapper', () => {
      const rawJson = {
        data: mockGapPlanDataJson,
      };

      const result = buildGapPlanCandidates(rawJson);

      expect(result.extractionPath).toBe('data');
      expect(result.candidates.length).toBeGreaterThan(0);
    });

    it('should extract from dataJson wrapper', () => {
      const rawJson = {
        dataJson: mockGapPlanDataJson,
      };

      const result = buildGapPlanCandidates(rawJson);

      expect(result.extractionPath).toBe('dataJson');
      expect(result.candidates.length).toBeGreaterThan(0);
    });

    it('should return empty for invalid rawJson', () => {
      const result = buildGapPlanCandidates(null);

      expect(result.extractionPath).toBe('unknown');
      expect(result.candidates.length).toBe(0);
    });

    it('should include extractionFailureReason for missing extraction path', () => {
      const rawJson = {
        someOtherKey: 'value',
        anotherKey: { nested: 'data' },
      };

      const result = buildGapPlanCandidates(rawJson);

      expect(result.extractionPath).toBe('unknown');
      expect(result.extractionFailureReason).toBeDefined();
      expect(result.topLevelKeys).toContain('someOtherKey');
    });
  });

  describe('Field Extraction', () => {
    it('should extract productOffer.primaryProducts from gapStructured.primaryOffers[].name', () => {
      const rawJson = mockGapPlanDataJson;
      const result = buildGapPlanCandidates(rawJson);

      const productsCandidate = result.candidates.find(
        (c) => c.key === 'productOffer.primaryProducts'
      );
      expect(productsCandidate).toBeDefined();
      expect(productsCandidate?.value).toEqual([
        'Marketing Automation Platform',
        'Analytics Dashboard',
      ]);
      expect(productsCandidate?.confidence).toBe(0.7);
    });

    it('should extract productOffer.valueProposition from gapStructured.primaryOffers[].description', () => {
      const rawJson = mockGapPlanDataJson;
      const result = buildGapPlanCandidates(rawJson);

      const vpCandidate = result.candidates.find(
        (c) => c.key === 'productOffer.valueProposition'
      );
      expect(vpCandidate).toBeDefined();
      expect(vpCandidate?.value).toContain('automate their marketing');
      expect(vpCandidate?.confidence).toBe(0.65);
    });

    it('should extract audience.primaryAudience from gapStructured.audienceSummary.icpDescription', () => {
      const rawJson = mockGapPlanDataJson;
      const result = buildGapPlanCandidates(rawJson);

      const audienceCandidate = result.candidates.find(
        (c) => c.key === 'audience.primaryAudience'
      );
      expect(audienceCandidate).toBeDefined();
      expect(audienceCandidate?.value).toContain('Growth-focused SMB');
    });

    it('should extract audience.icpDescription from gapStructured.audienceSummary.icpDescription', () => {
      const rawJson = mockGapPlanDataJson;
      const result = buildGapPlanCandidates(rawJson);

      const icpCandidate = result.candidates.find(
        (c) => c.key === 'audience.icpDescription'
      );
      expect(icpCandidate).toBeDefined();
      expect(icpCandidate?.value).toContain('marketing automation');
    });

    it('should extract competitive.competitors from gapStructured.competitors[].name', () => {
      const rawJson = mockGapPlanDataJson;
      const result = buildGapPlanCandidates(rawJson);

      const competitorsCandidate = result.candidates.find(
        (c) => c.key === 'competitive.competitors'
      );
      expect(competitorsCandidate).toBeDefined();
      expect(competitorsCandidate?.value).toEqual(['HubSpot', 'Mailchimp']);
    });

    it('should skip empty values', () => {
      const emptyResult = {
        gapStructured: {
          scores: { overall: 72 },
          primaryOffers: [], // Empty array
          competitors: null, // Null
          audienceSummary: {
            icpDescription: '   ', // Whitespace only
            keyPainPoints: [],
          },
        },
      };

      const result = buildGapPlanCandidates(emptyResult);

      // Should produce no candidates for empty values
      expect(result.candidates.length).toBe(0);
    });
  });

  describe('Candidates Count > 0 for Complete Fixture', () => {
    it('should produce >0 candidates from complete GAP Plan data', () => {
      const result = buildGapPlanCandidates(mockGapPlanDataJson);

      // Core test: candidates > 0 for fixture
      expect(result.candidates.length).toBeGreaterThan(0);

      // Should have the 5 required strategy fields from GAP Plan
      const keys = result.candidates.map((c) => c.key);
      expect(keys).toContain('productOffer.primaryProducts');
      expect(keys).toContain('productOffer.valueProposition');
      expect(keys).toContain('audience.primaryAudience');
      expect(keys).toContain('audience.icpDescription');
      expect(keys).toContain('competitive.competitors');
    });
  });

  describe('Evidence & Confidence', () => {
    it('should include rawPath in evidence', () => {
      const rawJson = mockGapPlanDataJson;
      const result = buildGapPlanCandidates(rawJson);

      const productsCandidate = result.candidates.find(
        (c) => c.key === 'productOffer.primaryProducts'
      );
      expect(productsCandidate?.evidence?.rawPath).toBe(
        'gapStructured.primaryOffers[].name'
      );
    });

    it('should include snippet in evidence', () => {
      const rawJson = mockGapPlanDataJson;
      const result = buildGapPlanCandidates(rawJson);

      const productsCandidate = result.candidates.find(
        (c) => c.key === 'productOffer.primaryProducts'
      );
      expect(productsCandidate?.evidence?.snippet).toBeDefined();
      expect(typeof productsCandidate?.evidence?.snippet).toBe('string');
    });

    it('should use default confidence 0.7 for GAP source', () => {
      const result = buildGapPlanCandidates(mockGapPlanDataJson);

      const productsCandidate = result.candidates.find(
        (c) => c.key === 'productOffer.primaryProducts'
      );
      expect(productsCandidate?.confidence).toBe(0.7);
    });
  });

  describe('Debug Info', () => {
    it('should include debug info when NO_CANDIDATES', () => {
      const emptyResult = {
        gapStructured: {
          scores: { overall: 72 },
          maturityStage: 'Emerging',
          primaryOffers: [],
          competitors: [],
          audienceSummary: null,
        },
      };

      const result = buildGapPlanCandidates(emptyResult);

      expect(result.candidates.length).toBe(0);
      expect(result.debug).toBeDefined();
      expect(result.debug?.samplePathsFound.gapStructured).toBe(true);
      expect(result.debug?.samplePathsFound.primaryOffers).toBe(false);
      expect(result.debug?.attemptedMappings.length).toBeGreaterThan(0);
    });

    it('should not include debug info when candidates exist', () => {
      const result = buildGapPlanCandidates(mockGapPlanDataJson);

      expect(result.candidates.length).toBeGreaterThan(0);
      expect(result.debug).toBeUndefined();
    });
  });
});

// ============================================================================
// findGapPlanRoot Tests
// ============================================================================

describe('findGapPlanRoot', () => {
  describe('JSON String Handling', () => {
    it('should parse stringified JSON and find GAP Plan root', () => {
      const stringifiedJson = JSON.stringify(mockGapPlanDataJson);

      const result = findGapPlanRoot(stringifiedJson);

      expect(result).not.toBeNull();
      expect(result?.path).toBe('direct');
      expect(result?.matchedFields).toContain('gapStructured');
    });

    it('should return null for invalid JSON strings', () => {
      const result = findGapPlanRoot('{ invalid json }');

      expect(result).toBeNull();
    });

    it('should return null for non-object JSON strings', () => {
      const result = findGapPlanRoot(JSON.stringify([1, 2, 3]));

      expect(result).toBeNull();
    });
  });

  describe('Path Detection', () => {
    it('should find GAP Plan at direct root', () => {
      const data = mockGapPlanDataJson;

      const result = findGapPlanRoot(data);

      expect(result?.path).toBe('direct');
      expect(result?.matchedFields).toContain('gapStructured');
    });

    it('should find GAP Plan in result wrapper', () => {
      const data = {
        result: mockGapPlanDataJson,
      };

      const result = findGapPlanRoot(data);

      expect(result?.path).toBe('result');
    });

    it('should find GAP Plan in data wrapper', () => {
      const data = {
        data: mockGapPlanDataJson,
      };

      const result = findGapPlanRoot(data);

      expect(result?.path).toBe('data');
    });

    it('should find GAP Plan in dataJson wrapper', () => {
      const data = {
        dataJson: mockGapPlanDataJson,
      };

      const result = findGapPlanRoot(data);

      expect(result?.path).toBe('dataJson');
    });

    it('should find GAP Plan in gapPlan wrapper', () => {
      const data = {
        gapPlan: mockGapPlanDataJson,
      };

      const result = findGapPlanRoot(data);

      expect(result?.path).toBe('gapPlan');
    });
  });

  describe('Edge Cases', () => {
    it('should return null for null input', () => {
      expect(findGapPlanRoot(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(findGapPlanRoot(undefined)).toBeNull();
    });

    it('should return null for array input', () => {
      expect(findGapPlanRoot([1, 2, 3])).toBeNull();
    });

    it('should return null for primitive input', () => {
      expect(findGapPlanRoot(42)).toBeNull();
      expect(findGapPlanRoot('string')).toBeNull();
      expect(findGapPlanRoot(true)).toBeNull();
    });

    it('should handle empty object', () => {
      expect(findGapPlanRoot({})).toBeNull();
    });
  });
});

// ============================================================================
// proposeFromLabResult Integration Tests
// ============================================================================

describe('proposeFromLabResult (GAP Plan)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CONTEXT_V4_ENABLED = 'true';
    process.env.CONTEXT_V4_INGEST_GAPPLAN = 'true';
  });

  afterEach(() => {
    delete process.env.CONTEXT_V4_ENABLED;
    delete process.env.CONTEXT_V4_INGEST_GAPPLAN;
  });

  it('should propose valid GAP Plan candidates', async () => {
    const { proposeFromLabResult } = await import('@/lib/contextGraph/v4/propose');

    // Build candidates from fixture
    const candidateResult = buildGapPlanCandidates(mockGapPlanDataJson);
    expect(candidateResult.candidates.length).toBeGreaterThan(0);

    // Propose to V4 with source: 'gap'
    const result = await proposeFromLabResult({
      companyId: 'company-123',
      importerId: 'gapPlan',
      source: 'gap',
      sourceId: 'run-456',
      extractionPath: candidateResult.extractionPath,
      candidates: candidateResult.candidates,
    });

    // Core test: endpoint creates proposals
    expect(result.proposed).toBeGreaterThan(0);
    expect(result.errors.length).toBe(0);
    expect(result.proposedKeys).toContain('productOffer.primaryProducts');
    expect(result.proposedKeys).toContain('competitive.competitors');
  });

  it('should skip empty values', async () => {
    const { proposeFromLabResult } = await import('@/lib/contextGraph/v4/propose');

    const result = await proposeFromLabResult({
      companyId: 'company-123',
      importerId: 'gapPlan',
      source: 'gap',
      sourceId: 'run-456',
      extractionPath: 'direct',
      candidates: [
        { key: 'productOffer.primaryProducts', value: ['Product A'] },
        { key: 'productOffer.empty', value: null },
        { key: 'productOffer.emptyArray', value: [] },
      ],
    });

    expect(result.proposed).toBe(1);
    expect(result.proposedKeys).toContain('productOffer.primaryProducts');
  });

  it('should return empty result for no candidates', async () => {
    const { proposeFromLabResult } = await import('@/lib/contextGraph/v4/propose');

    const result = await proposeFromLabResult({
      companyId: 'company-123',
      importerId: 'gapPlan',
      source: 'gap',
      sourceId: 'run-456',
      extractionPath: 'direct',
      candidates: [],
    });

    expect(result.proposed).toBe(0);
    expect(result.blocked).toBe(0);
    expect(result.errors.length).toBe(0);
  });
});
