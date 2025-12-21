// tests/context/v4-brandLabPropose.test.ts
// Unit tests for V4 Brand Lab proposal flow
//
// Tests:
// - buildBrandLabCandidates: extracts candidates from Brand Lab rawJson
// - proposeFromLabResult: proposes candidates to V4 store

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildBrandLabCandidates,
  findBrandLabRoot,
} from '@/lib/contextGraph/v4/brandLabCandidates';

// Mock Airtable for proposeFromLabResult tests
vi.mock('@/lib/airtable', () => ({
  getBase: vi.fn(() => {
    return () => ({
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
    isContextV4IngestBrandLabEnabled: vi.fn(() => true),
  };
});

// ============================================================================
// Test Data: Representative Brand Lab rawJson
// ============================================================================

// Simplified mock that matches the shape consumed by buildBrandLabCandidates
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockBrandLabResult: Record<string, any> = {
  overallScore: 72,
  maturityStage: 'Emerging',
  findings: {
    positioning: {
      statement: 'We help small businesses grow through innovative marketing solutions.',
      confidence: 0.85,
    },
    valueProp: {
      headline: 'Marketing that works',
      description: 'Our platform helps you reach more customers with less effort.',
      confidence: 0.8,
    },
    icp: {
      primaryAudience: 'Small business owners with 5-50 employees',
      confidence: 0.75,
    },
    audienceFit: {
      primaryICPDescription: 'Growth-focused SMB owners seeking marketing automation',
    },
  },
  dimensions: [
    {
      key: 'audienceFit',
      summary: 'The brand shows strong alignment with SMB decision-makers.',
      score: 78,
    },
    {
      key: 'messagingClarity',
      summary: 'Core messaging is clear but could be more differentiated.',
      score: 65,
    },
  ],
  narrativeSummary: 'This brand has solid foundations with room for positioning refinement.',
  dataConfidence: {
    overall: 0.78,
  },
};

// ============================================================================
// buildBrandLabCandidates Tests
// ============================================================================

describe('buildBrandLabCandidates', () => {
  describe('Extraction Paths', () => {
    it('should extract from direct format', () => {
      const rawJson = mockBrandLabResult;

      const result = buildBrandLabCandidates(rawJson);

      expect(result.extractionPath).toBe('direct');
      expect(result.candidates.length).toBeGreaterThan(0);
    });

    it('should extract from result wrapper', () => {
      const rawJson = {
        result: mockBrandLabResult,
      };

      const result = buildBrandLabCandidates(rawJson);

      expect(result.extractionPath).toBe('result');
      expect(result.candidates.length).toBeGreaterThan(0);
    });

    it('should extract from data wrapper', () => {
      const rawJson = {
        data: mockBrandLabResult,
      };

      const result = buildBrandLabCandidates(rawJson);

      expect(result.extractionPath).toBe('data');
      expect(result.candidates.length).toBeGreaterThan(0);
    });

    it('should extract from brandLab wrapper', () => {
      const rawJson = {
        brandLab: mockBrandLabResult,
      };

      const result = buildBrandLabCandidates(rawJson);

      expect(result.extractionPath).toBe('brandLab');
      expect(result.candidates.length).toBeGreaterThan(0);
    });

    it('should return empty for invalid rawJson', () => {
      const result = buildBrandLabCandidates(null);

      expect(result.extractionPath).toBe('unknown');
      expect(result.candidates.length).toBe(0);
    });

    it('should include extractionFailureReason for missing extraction path', () => {
      const rawJson = {
        someOtherKey: 'value',
        anotherKey: { nested: 'data' },
      };

      const result = buildBrandLabCandidates(rawJson);

      expect(result.extractionPath).toBe('unknown');
      expect(result.extractionFailureReason).toBeDefined();
      expect(result.topLevelKeys).toContain('someOtherKey');
    });
  });

  describe('Field Extraction', () => {
    it('should extract brand.positioning from findings.positioning.statement', () => {
      const rawJson = mockBrandLabResult;
      const result = buildBrandLabCandidates(rawJson);

      const positioningCandidate = result.candidates.find(
        (c) => c.key === 'brand.positioning'
      );
      expect(positioningCandidate).toBeDefined();
      expect(positioningCandidate?.value).toContain('small businesses');
      expect(positioningCandidate?.confidence).toBe(0.85);
    });

    it('should extract productOffer.valueProposition from findings.valueProp', () => {
      const rawJson = mockBrandLabResult;
      const result = buildBrandLabCandidates(rawJson);

      const vpCandidate = result.candidates.find(
        (c) => c.key === 'productOffer.valueProposition'
      );
      expect(vpCandidate).toBeDefined();
      expect(vpCandidate?.value).toContain('Marketing that works');
      expect(vpCandidate?.value).toContain('platform helps you reach');
    });

    it('should extract audience.primaryAudience from findings.icp.primaryAudience', () => {
      const rawJson = mockBrandLabResult;
      const result = buildBrandLabCandidates(rawJson);

      const audienceCandidate = result.candidates.find(
        (c) => c.key === 'audience.primaryAudience'
      );
      expect(audienceCandidate).toBeDefined();
      expect(audienceCandidate?.value).toContain('Small business owners');
    });

    it('should extract audience.icpDescription from audienceFit dimension', () => {
      const rawJson = mockBrandLabResult;
      const result = buildBrandLabCandidates(rawJson);

      const icpCandidate = result.candidates.find(
        (c) => c.key === 'audience.icpDescription'
      );
      expect(icpCandidate).toBeDefined();
      expect(icpCandidate?.value).toContain('strong alignment with SMB');
    });

    it('should skip empty values', () => {
      const emptyResult = {
        overallScore: 72,
        maturityStage: 'Emerging',
        findings: {
          positioning: {
            statement: '', // Empty string
          },
          valueProp: {
            headline: null, // Null
          },
          icp: {
            primaryAudience: '   ', // Whitespace only
          },
        },
        dimensions: [],
      };

      const result = buildBrandLabCandidates(emptyResult);

      // Should produce no candidates for empty values
      expect(result.candidates.length).toBe(0);
    });
  });

  describe('Candidates Count > 0 for Complete Fixture', () => {
    it('should produce >0 candidates from complete Brand Lab data', () => {
      const result = buildBrandLabCandidates(mockBrandLabResult);

      // Core test: candidates > 0 for fixture
      expect(result.candidates.length).toBeGreaterThan(0);

      // Should have the 4 required strategy fields
      const keys = result.candidates.map((c) => c.key);
      expect(keys).toContain('brand.positioning');
      expect(keys).toContain('productOffer.valueProposition');
      expect(keys).toContain('audience.primaryAudience');
      expect(keys).toContain('audience.icpDescription');
    });
  });

  describe('Evidence & Confidence', () => {
    it('should include rawPath in evidence', () => {
      const rawJson = mockBrandLabResult;
      const result = buildBrandLabCandidates(rawJson);

      const positioningCandidate = result.candidates.find(
        (c) => c.key === 'brand.positioning'
      );
      expect(positioningCandidate?.evidence?.rawPath).toBe(
        'findings.positioning.statement'
      );
    });

    it('should include snippet in evidence for string values', () => {
      const rawJson = mockBrandLabResult;
      const result = buildBrandLabCandidates(rawJson);

      const positioningCandidate = result.candidates.find(
        (c) => c.key === 'brand.positioning'
      );
      expect(positioningCandidate?.evidence?.snippet).toBeDefined();
      expect(typeof positioningCandidate?.evidence?.snippet).toBe('string');
    });

    it('should use default confidence when not provided', () => {
      const minimalResult = {
        overallScore: 72,
        dimensions: [],
        findings: {
          positioning: {
            statement: 'Test positioning statement',
            // No confidence provided
          },
        },
      };

      const result = buildBrandLabCandidates(minimalResult);

      const positioningCandidate = result.candidates.find(
        (c) => c.key === 'brand.positioning'
      );
      expect(positioningCandidate?.confidence).toBe(0.75); // Default
    });
  });

  describe('Debug Info', () => {
    it('should include debug info when NO_CANDIDATES', () => {
      const emptyResult = {
        overallScore: 72,
        maturityStage: 'Emerging',
        findings: {},
        dimensions: [],
      };

      const result = buildBrandLabCandidates(emptyResult);

      expect(result.candidates.length).toBe(0);
      expect(result.debug).toBeDefined();
      expect(result.debug?.rootTopKeys).toContain('overallScore');
      expect(result.debug?.samplePathsFound.findings).toBe(true);
      expect(result.debug?.attemptedMappings.length).toBeGreaterThan(0);
    });

    it('should not include debug info when candidates exist', () => {
      const result = buildBrandLabCandidates(mockBrandLabResult);

      expect(result.candidates.length).toBeGreaterThan(0);
      expect(result.debug).toBeUndefined();
    });
  });
});

// ============================================================================
// findBrandLabRoot Tests
// ============================================================================

describe('findBrandLabRoot', () => {
  describe('JSON String Handling', () => {
    it('should parse stringified JSON and find Brand Lab root', () => {
      const stringifiedJson = JSON.stringify({
        overallScore: 72,
        maturityStage: 'Emerging',
        findings: {},
        dimensions: [],
      });

      const result = findBrandLabRoot(stringifiedJson);

      expect(result).not.toBeNull();
      expect(result?.path).toBe('direct');
      expect(result?.matchedFields).toContain('overallScore');
    });

    it('should return null for invalid JSON strings', () => {
      const result = findBrandLabRoot('{ invalid json }');

      expect(result).toBeNull();
    });

    it('should return null for non-object JSON strings', () => {
      const result = findBrandLabRoot(JSON.stringify([1, 2, 3]));

      expect(result).toBeNull();
    });
  });

  describe('Path Detection', () => {
    it('should find Brand Lab at direct root', () => {
      const data = mockBrandLabResult;

      const result = findBrandLabRoot(data);

      expect(result?.path).toBe('direct');
      expect(result?.matchedFields).toContain('overallScore');
    });

    it('should find Brand Lab in result wrapper', () => {
      const data = {
        result: mockBrandLabResult,
      };

      const result = findBrandLabRoot(data);

      expect(result?.path).toBe('result');
    });

    it('should find Brand Lab in data wrapper', () => {
      const data = {
        data: mockBrandLabResult,
      };

      const result = findBrandLabRoot(data);

      expect(result?.path).toBe('data');
    });

    it('should find Brand Lab in report wrapper', () => {
      const data = {
        report: mockBrandLabResult,
      };

      const result = findBrandLabRoot(data);

      expect(result?.path).toBe('report');
    });

    it('should find Brand Lab in brandLab wrapper', () => {
      const data = {
        brandLab: mockBrandLabResult,
      };

      const result = findBrandLabRoot(data);

      expect(result?.path).toBe('brandLab');
    });
  });

  describe('Edge Cases', () => {
    it('should return null for null input', () => {
      expect(findBrandLabRoot(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(findBrandLabRoot(undefined)).toBeNull();
    });

    it('should return null for array input', () => {
      expect(findBrandLabRoot([1, 2, 3])).toBeNull();
    });

    it('should return null for primitive input', () => {
      expect(findBrandLabRoot(42)).toBeNull();
      expect(findBrandLabRoot('string')).toBeNull();
      expect(findBrandLabRoot(true)).toBeNull();
    });

    it('should handle empty object', () => {
      expect(findBrandLabRoot({})).toBeNull();
    });
  });
});

// ============================================================================
// proposeFromLabResult Integration Tests
// ============================================================================

describe('proposeFromLabResult (Brand Lab)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CONTEXT_V4_ENABLED = 'true';
    process.env.CONTEXT_V4_INGEST_BRANDLAB = 'true';
  });

  afterEach(() => {
    delete process.env.CONTEXT_V4_ENABLED;
    delete process.env.CONTEXT_V4_INGEST_BRANDLAB;
  });

  it('should propose valid Brand Lab candidates', async () => {
    const { proposeFromLabResult } = await import('@/lib/contextGraph/v4/propose');

    // Build candidates from fixture
    const candidateResult = buildBrandLabCandidates(mockBrandLabResult);
    expect(candidateResult.candidates.length).toBeGreaterThan(0);

    // Propose to V4
    const result = await proposeFromLabResult({
      companyId: 'company-123',
      importerId: 'brandLab',
      source: 'lab',
      sourceId: 'run-456',
      extractionPath: candidateResult.extractionPath,
      candidates: candidateResult.candidates,
    });

    // Core test: endpoint creates proposals
    expect(result.proposed).toBeGreaterThan(0);
    expect(result.errors.length).toBe(0);
    expect(result.proposedKeys).toContain('brand.positioning');
    expect(result.proposedKeys).toContain('productOffer.valueProposition');
  });

  it('should skip empty values', async () => {
    const { proposeFromLabResult } = await import('@/lib/contextGraph/v4/propose');

    const result = await proposeFromLabResult({
      companyId: 'company-123',
      importerId: 'brandLab',
      source: 'lab',
      sourceId: 'run-456',
      extractionPath: 'direct',
      candidates: [
        { key: 'brand.positioning', value: 'Valid positioning' },
        { key: 'brand.empty', value: null },
        { key: 'brand.emptyString', value: '' },
      ],
    });

    expect(result.proposed).toBe(1);
    expect(result.proposedKeys).toContain('brand.positioning');
  });

  it('should return empty result for no candidates', async () => {
    const { proposeFromLabResult } = await import('@/lib/contextGraph/v4/propose');

    const result = await proposeFromLabResult({
      companyId: 'company-123',
      importerId: 'brandLab',
      source: 'lab',
      sourceId: 'run-456',
      extractionPath: 'direct',
      candidates: [],
    });

    expect(result.proposed).toBe(0);
    expect(result.blocked).toBe(0);
    expect(result.errors.length).toBe(0);
  });
});
