// tests/context/v4-websiteLabPropose.test.ts
// Unit tests for V4 WebsiteLab proposal flow
//
// Tests:
// - buildWebsiteLabCandidates: extracts candidates from WebsiteLab rawJson
// - proposeFromLabResult: proposes candidates to V4 store

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildWebsiteLabCandidates, findWebsiteLabRoot } from '@/lib/contextGraph/v4/websiteLabCandidates';
// Note: We use simplified mock data that matches the shape consumed by WEBSITE_LAB_MAPPINGS
// rather than fully typed WebsiteUXLabResultV4 to avoid test maintenance burden

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
    isContextV4IngestWebsiteLabEnabled: vi.fn(() => true),
  };
});

// ============================================================================
// Test Data: Representative WebsiteLab rawJson
// ============================================================================

// Simplified mock that matches the shape consumed by WEBSITE_LAB_MAPPINGS
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockWebsiteLabResult: Record<string, any> = {
  siteAssessment: {
    score: 72,
    executiveSummary: 'The website has good foundations but needs conversion optimization.',
    keyIssues: ['No clear CTA above fold', 'Slow page load times'],
    funnelHealthScore: 65,
    quickWins: [
      { title: 'Add hero CTA', description: 'Place prominent CTA in hero section' },
      { title: 'Optimize images', description: 'Compress hero images for faster load' },
    ],
    strategicInitiatives: [
      { title: 'Conversion optimization', description: 'Implement A/B testing framework' },
    ],
    strengths: ['Strong brand identity', 'Clear navigation'],
    benchmarkLabel: 'Above Average',
    multiPageConsistencyScore: 0.85,
    pageLevelScores: [
      { path: '/', type: 'homepage', score: 75, weaknesses: [], strengths: ['Clear nav'] },
      { path: '/contact', type: 'contact', score: 68, weaknesses: ['Form too long'], strengths: [] },
    ],
  },
  siteGraph: {
    pages: [
      {
        url: 'https://example.com/',
        path: '/',
        type: 'homepage',
        evidenceV3: { ctas: ['Get Started', 'Learn More'] },
      },
      {
        url: 'https://example.com/contact',
        path: '/contact',
        type: 'contact',
        evidenceV3: { ctas: ['Submit'] },
      },
    ],
    edges: [],
  },
  trustAnalysis: {
    trustScore: 78,
    signals: [
      { type: 'Social Proof', description: 'Testimonials present on homepage' },
      { type: 'Security', description: 'HTTPS enabled' },
    ],
    narrative: 'The website builds trust through social proof and security indicators.',
  },
  visualBrandEvaluation: {
    brandConsistencyScore: 0.82,
    colorHarmony: {
      primaryColors: ['#1a73e8', '#ffffff', '#333333'],
      accessibilityScore: 0.9,
    },
    typography: {
      fontFamilies: ['Inter', 'Georgia'],
    },
    layout: {
      scannabilityScore: 0.75,
    },
    narrative: 'Visual identity is consistent with modern design principles.',
  },
  contentIntelligence: {
    summaryScore: 70,
    narrative: 'Content is clear but could be more compelling.',
    valuePropositionStrength: 0.72,
    improvements: ['Add more social proof', 'Strengthen headlines'],
    qualityMetrics: {
      clarityScore: 0.78,
      readingLevel: 'Grade 10',
    },
  },
  ctaIntelligence: {
    summaryScore: 65,
    narrative: 'CTAs are present but could be more prominent.',
    patterns: {
      primaryCta: 'Get Started',
    },
    recommendations: ['Increase CTA contrast', 'Add urgency language'],
  },
  // Cross-domain data (should be skipped)
  personas: [
    {
      persona: 'Business Owner',
      goal: 'Find reliable service provider',
      success: true,
      frictionNotes: ['Pricing not clear upfront'],
    },
  ],
  strategistViews: {
    copywriting: {
      toneAnalysis: { detectedTone: 'Professional but friendly' },
      messagingIssues: ['Value prop could be clearer'],
      differentiationAnalysis: {
        competitivePositioning: 'Premium positioning',
        recommendations: ['Emphasize unique features'],
      },
    },
    conversion: {
      funnelBlockers: ['Multi-step form too long'],
      opportunities: ['Add live chat'],
    },
  },
};

// ============================================================================
// buildWebsiteLabCandidates Tests
// ============================================================================

describe('buildWebsiteLabCandidates', () => {
  describe('Extraction Paths', () => {
    it('should extract from rawEvidence.labResultV4 (new format)', () => {
      const rawJson = {
        rawEvidence: {
          labResultV4: mockWebsiteLabResult,
        },
      };

      const result = buildWebsiteLabCandidates(rawJson);

      expect(result.extractionPath).toBe('rawEvidence.labResultV4');
      expect(result.candidates.length).toBeGreaterThan(0);
    });

    it('should extract from result (wrapped format)', () => {
      const rawJson = {
        result: mockWebsiteLabResult,
      };

      const result = buildWebsiteLabCandidates(rawJson);

      expect(result.extractionPath).toBe('result');
      expect(result.candidates.length).toBeGreaterThan(0);
    });

    it('should extract from output (wrapped format)', () => {
      const rawJson = {
        output: mockWebsiteLabResult,
      };

      const result = buildWebsiteLabCandidates(rawJson);

      expect(result.extractionPath).toBe('output');
      expect(result.candidates.length).toBeGreaterThan(0);
    });

    it('should extract from data (wrapped format)', () => {
      const rawJson = {
        data: mockWebsiteLabResult,
      };

      const result = buildWebsiteLabCandidates(rawJson);

      expect(result.extractionPath).toBe('data');
      expect(result.candidates.length).toBeGreaterThan(0);
    });

    it('should extract from direct format', () => {
      const rawJson = mockWebsiteLabResult;

      const result = buildWebsiteLabCandidates(rawJson);

      expect(result.extractionPath).toBe('direct');
      expect(result.candidates.length).toBeGreaterThan(0);
    });

    it('should still work with truncated data that has valid structure', () => {
      // Truncated data with valid structure should use normal path
      const rawJson = {
        _truncated: true,
        rawEvidence: {
          labResultV4: {
            siteAssessment: mockWebsiteLabResult.siteAssessment,
          },
        },
      };

      const result = buildWebsiteLabCandidates(rawJson);

      // Should still extract successfully (truncated check is a fallback)
      expect(result.extractionPath).toBe('rawEvidence.labResultV4');
      expect(result.candidates.length).toBeGreaterThan(0);
    });

    it('should return empty for invalid rawJson', () => {
      const result = buildWebsiteLabCandidates(null);

      expect(result.extractionPath).toBe('unknown');
      expect(result.candidates.length).toBe(0);
    });

    it('should include extractionFailureReason for missing extraction path', () => {
      const rawJson = {
        someOtherKey: 'value',
        anotherKey: { nested: 'data' },
      };

      const result = buildWebsiteLabCandidates(rawJson);

      expect(result.extractionPath).toBe('unknown');
      expect(result.extractionFailureReason).toBeDefined();
      expect(result.extractionFailureReason).toContain('someOtherKey');
      expect(result.topLevelKeys).toContain('someOtherKey');
    });
  });

  describe('Domain Filtering', () => {
    it('should only include website.* and digitalInfra.* keys', () => {
      const rawJson = { rawEvidence: { labResultV4: mockWebsiteLabResult } };
      const result = buildWebsiteLabCandidates(rawJson);

      const domains = new Set(result.candidates.map((c) => c.key.split('.')[0]));

      // Should only have website and digitalInfra
      expect(domains.has('website')).toBe(true);
      // Other domains should be filtered out
      expect(domains.has('brand')).toBe(false);
      expect(domains.has('content')).toBe(false);
      expect(domains.has('audience')).toBe(false);
      expect(domains.has('historical')).toBe(false);
    });

    it('should track skipped wrong-domain keys', () => {
      const rawJson = { rawEvidence: { labResultV4: mockWebsiteLabResult } };
      const result = buildWebsiteLabCandidates(rawJson);

      // Should have skipped cross-domain mappings (brand, content, audience, historical)
      expect(result.skipped.wrongDomain).toBeGreaterThan(0);
      expect(result.skippedWrongDomainKeys.length).toBeGreaterThan(0);

      // Check that skipped keys are from wrong domains
      for (const key of result.skippedWrongDomainKeys) {
        const domain = key.split('.')[0];
        expect(['website', 'digitalInfra']).not.toContain(domain);
      }
    });
  });

  describe('Value Extraction', () => {
    it('should extract website.websiteScore from siteAssessment.score', () => {
      const rawJson = { rawEvidence: { labResultV4: mockWebsiteLabResult } };
      const result = buildWebsiteLabCandidates(rawJson);

      const scoreCandidate = result.candidates.find((c) => c.key === 'website.websiteScore');
      expect(scoreCandidate).toBeDefined();
      expect(scoreCandidate?.value).toBe(72);
    });

    it('should extract website.executiveSummary', () => {
      const rawJson = { rawEvidence: { labResultV4: mockWebsiteLabResult } };
      const result = buildWebsiteLabCandidates(rawJson);

      const summaryCandidate = result.candidates.find(
        (c) => c.key === 'website.executiveSummary'
      );
      expect(summaryCandidate).toBeDefined();
      expect(summaryCandidate?.value).toContain('good foundations');
    });

    it('should extract website.conversionBlocks from siteAssessment.keyIssues', () => {
      const rawJson = { rawEvidence: { labResultV4: mockWebsiteLabResult } };
      const result = buildWebsiteLabCandidates(rawJson);

      const blocksCandidate = result.candidates.find(
        (c) => c.key === 'website.conversionBlocks'
      );
      expect(blocksCandidate).toBeDefined();
      expect(Array.isArray(blocksCandidate?.value)).toBe(true);
      expect((blocksCandidate?.value as string[])).toContain('No clear CTA above fold');
    });

    it('should skip empty values', () => {
      const emptyResult = {
        siteAssessment: {
          score: null, // Empty
          executiveSummary: '', // Empty string
          keyIssues: [], // Empty array
        },
        siteGraph: { pages: [], edges: [] },
      };

      const rawJson = { rawEvidence: { labResultV4: emptyResult } };
      const result = buildWebsiteLabCandidates(rawJson);

      expect(result.skipped.emptyValue).toBeGreaterThan(0);
      // Should not have candidates for empty values
      expect(result.candidates.find((c) => c.key === 'website.websiteScore')).toBeUndefined();
    });
  });

  describe('Evidence & Confidence', () => {
    it('should include rawPath in evidence', () => {
      const rawJson = { rawEvidence: { labResultV4: mockWebsiteLabResult } };
      const result = buildWebsiteLabCandidates(rawJson);

      const scoreCandidate = result.candidates.find((c) => c.key === 'website.websiteScore');
      expect(scoreCandidate?.evidence?.rawPath).toBe('siteAssessment.score');
    });

    it('should apply confidence multipliers', () => {
      const rawJson = { rawEvidence: { labResultV4: mockWebsiteLabResult } };
      const result = buildWebsiteLabCandidates(rawJson);

      // Fields with confidenceMultiplier < 1 should have lower confidence
      const mobileScoreCandidate = result.candidates.find(
        (c) => c.key === 'website.mobileScore'
      );
      if (mobileScoreCandidate) {
        // confidenceMultiplier: 0.7, so 0.8 * 0.7 = 0.56
        expect(mobileScoreCandidate.confidence).toBeLessThan(0.8);
      }
    });

    it('should include snippet in evidence for string values', () => {
      const rawJson = { rawEvidence: { labResultV4: mockWebsiteLabResult } };
      const result = buildWebsiteLabCandidates(rawJson);

      const summaryCandidate = result.candidates.find(
        (c) => c.key === 'website.executiveSummary'
      );
      expect(summaryCandidate?.evidence?.snippet).toBeDefined();
      expect(typeof summaryCandidate?.evidence?.snippet).toBe('string');
    });
  });

  describe('Transform Functions', () => {
    it('should apply transform for website.quickWins', () => {
      const rawJson = { rawEvidence: { labResultV4: mockWebsiteLabResult } };
      const result = buildWebsiteLabCandidates(rawJson);

      const quickWinsCandidate = result.candidates.find(
        (c) => c.key === 'website.quickWins'
      );
      if (quickWinsCandidate) {
        expect(Array.isArray(quickWinsCandidate.value)).toBe(true);
        // Transform should extract titles
        expect((quickWinsCandidate.value as string[])).toContain('Add hero CTA');
      }
    });

    it('should apply transform for website.hasContactForm', () => {
      const rawJson = { rawEvidence: { labResultV4: mockWebsiteLabResult } };
      const result = buildWebsiteLabCandidates(rawJson);

      const contactFormCandidate = result.candidates.find(
        (c) => c.key === 'website.hasContactForm'
      );
      if (contactFormCandidate) {
        expect(typeof contactFormCandidate.value).toBe('boolean');
        // Our mock has a contact page
        expect(contactFormCandidate.value).toBe(true);
      }
    });
  });
});

// ============================================================================
// proposeFromLabResult Tests
// ============================================================================

describe('proposeFromLabResult', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CONTEXT_V4_ENABLED = 'true';
  });

  afterEach(() => {
    delete process.env.CONTEXT_V4_ENABLED;
  });

  it('should propose valid candidates', async () => {
    const { proposeFromLabResult } = await import('@/lib/contextGraph/v4/propose');

    const result = await proposeFromLabResult({
      companyId: 'company-123',
      importerId: 'websiteLab',
      source: 'lab',
      sourceId: 'run-456',
      extractionPath: 'rawEvidence.labResultV4',
      candidates: [
        { key: 'website.websiteScore', value: 72 },
        { key: 'website.executiveSummary', value: 'Test summary' },
      ],
    });

    expect(result.proposed).toBe(2);
    expect(result.errors.length).toBe(0);
    expect(result.proposedKeys).toContain('website.websiteScore');
    expect(result.proposedKeys).toContain('website.executiveSummary');
  });

  it('should skip empty values', async () => {
    const { proposeFromLabResult } = await import('@/lib/contextGraph/v4/propose');

    const result = await proposeFromLabResult({
      companyId: 'company-123',
      importerId: 'websiteLab',
      source: 'lab',
      sourceId: 'run-456',
      extractionPath: 'test',
      candidates: [
        { key: 'website.websiteScore', value: 72 },
        { key: 'website.empty', value: null },
        { key: 'website.emptyString', value: '' },
        { key: 'website.emptyArray', value: [] },
      ],
    });

    // Should only propose the non-empty value
    expect(result.proposed).toBe(1);
    expect(result.proposedKeys).toContain('website.websiteScore');
  });

  it('should reject invalid key formats', async () => {
    const { proposeFromLabResult } = await import('@/lib/contextGraph/v4/propose');

    const result = await proposeFromLabResult({
      companyId: 'company-123',
      importerId: 'websiteLab',
      source: 'lab',
      sourceId: 'run-456',
      extractionPath: 'test',
      candidates: [
        { key: 'invalidKey', value: 'test' }, // No dot
        { key: '', value: 'test' }, // Empty
        { key: 'website.valid', value: 'test' }, // Valid
      ],
    });

    expect(result.proposed).toBe(1);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    expect(result.proposedKeys).toContain('website.valid');
  });

  it('should include evidence in proposed fields', async () => {
    const { proposeFromLabResult } = await import('@/lib/contextGraph/v4/propose');

    const result = await proposeFromLabResult({
      companyId: 'company-123',
      importerId: 'websiteLab',
      source: 'lab',
      sourceId: 'run-456',
      extractionPath: 'rawEvidence.labResultV4',
      candidates: [
        {
          key: 'website.websiteScore',
          value: 72,
          evidence: {
            rawPath: 'siteAssessment.score',
            snippet: 'Score: 72',
          },
        },
      ],
    });

    expect(result.proposed).toBe(1);
    // Evidence should be attached (validated by the field store)
  });

  it('should return empty result for no candidates', async () => {
    const { proposeFromLabResult } = await import('@/lib/contextGraph/v4/propose');

    const result = await proposeFromLabResult({
      companyId: 'company-123',
      importerId: 'websiteLab',
      source: 'lab',
      sourceId: 'run-456',
      extractionPath: 'test',
      candidates: [],
    });

    expect(result.proposed).toBe(0);
    expect(result.blocked).toBe(0);
    expect(result.errors.length).toBe(0);
  });

  it('should include deduped count in result summary', async () => {
    const { proposeFromLabResult } = await import('@/lib/contextGraph/v4/propose');

    const result = await proposeFromLabResult({
      companyId: 'company-123',
      importerId: 'websiteLab',
      source: 'lab',
      sourceId: 'run-456',
      extractionPath: 'test',
      candidates: [
        { key: 'website.websiteScore', value: 72 },
      ],
    });

    // deduped should be initialized
    expect(result.deduped).toBe(0);
    expect(result.dedupedKeys).toBeDefined();
    expect(Array.isArray(result.dedupedKeys)).toBe(true);
  });
});

// ============================================================================
// dedupeKey Tests
// ============================================================================

describe('generateDedupeKey', () => {
  it('should generate stable hash for same inputs', async () => {
    const { generateDedupeKey } = await import('@/lib/contextGraph/v4/propose');

    const key1 = generateDedupeKey({
      companyId: 'company-123',
      fieldKey: 'website.websiteScore',
      source: 'lab',
      sourceId: 'run-456',
      value: 72,
    });

    const key2 = generateDedupeKey({
      companyId: 'company-123',
      fieldKey: 'website.websiteScore',
      source: 'lab',
      sourceId: 'run-456',
      value: 72,
    });

    expect(key1).toBe(key2);
    expect(key1.length).toBe(40); // SHA1 hex length
  });

  it('should generate different hash for different values', async () => {
    const { generateDedupeKey } = await import('@/lib/contextGraph/v4/propose');

    const key1 = generateDedupeKey({
      companyId: 'company-123',
      fieldKey: 'website.websiteScore',
      source: 'lab',
      sourceId: 'run-456',
      value: 72,
    });

    const key2 = generateDedupeKey({
      companyId: 'company-123',
      fieldKey: 'website.websiteScore',
      source: 'lab',
      sourceId: 'run-456',
      value: 85, // Different value
    });

    expect(key1).not.toBe(key2);
  });

  it('should generate different hash for different sourceId (run)', async () => {
    const { generateDedupeKey } = await import('@/lib/contextGraph/v4/propose');

    const key1 = generateDedupeKey({
      companyId: 'company-123',
      fieldKey: 'website.websiteScore',
      source: 'lab',
      sourceId: 'run-456',
      value: 72,
    });

    const key2 = generateDedupeKey({
      companyId: 'company-123',
      fieldKey: 'website.websiteScore',
      source: 'lab',
      sourceId: 'run-789', // Different run
      value: 72,
    });

    expect(key1).not.toBe(key2);
  });

  it('should generate different hash for different fieldKey', async () => {
    const { generateDedupeKey } = await import('@/lib/contextGraph/v4/propose');

    const key1 = generateDedupeKey({
      companyId: 'company-123',
      fieldKey: 'website.websiteScore',
      source: 'lab',
      sourceId: 'run-456',
      value: 72,
    });

    const key2 = generateDedupeKey({
      companyId: 'company-123',
      fieldKey: 'website.executiveSummary', // Different field
      source: 'lab',
      sourceId: 'run-456',
      value: 72,
    });

    expect(key1).not.toBe(key2);
  });

  it('should normalize string values (case-insensitive, trimmed)', async () => {
    const { generateDedupeKey } = await import('@/lib/contextGraph/v4/propose');

    const key1 = generateDedupeKey({
      companyId: 'company-123',
      fieldKey: 'website.summary',
      source: 'lab',
      sourceId: 'run-456',
      value: '  The Website Summary  ',
    });

    const key2 = generateDedupeKey({
      companyId: 'company-123',
      fieldKey: 'website.summary',
      source: 'lab',
      sourceId: 'run-456',
      value: 'the website summary',
    });

    expect(key1).toBe(key2);
  });

  it('should handle object values with stable ordering', async () => {
    const { generateDedupeKey } = await import('@/lib/contextGraph/v4/propose');

    const key1 = generateDedupeKey({
      companyId: 'company-123',
      fieldKey: 'website.pages',
      source: 'lab',
      sourceId: 'run-456',
      value: { url: '/', score: 72 },
    });

    const key2 = generateDedupeKey({
      companyId: 'company-123',
      fieldKey: 'website.pages',
      source: 'lab',
      sourceId: 'run-456',
      value: { score: 72, url: '/' }, // Keys in different order
    });

    expect(key1).toBe(key2);
  });

  it('should handle array values with stable ordering', async () => {
    const { generateDedupeKey } = await import('@/lib/contextGraph/v4/propose');

    const key1 = generateDedupeKey({
      companyId: 'company-123',
      fieldKey: 'website.issues',
      source: 'lab',
      sourceId: 'run-456',
      value: ['Issue A', 'Issue B'],
    });

    const key2 = generateDedupeKey({
      companyId: 'company-123',
      fieldKey: 'website.issues',
      source: 'lab',
      sourceId: 'run-456',
      value: ['Issue B', 'Issue A'], // Different order
    });

    // Arrays are sorted for stable hashing
    expect(key1).toBe(key2);
  });
});

// ============================================================================
// findWebsiteLabRoot Tests
// ============================================================================

describe('findWebsiteLabRoot', () => {
  describe('JSON String Handling', () => {
    it('should parse stringified JSON and find WebsiteLab root', () => {
      const stringifiedJson = JSON.stringify({
        siteAssessment: { score: 72 },
        siteGraph: { pages: [] },
      });

      const result = findWebsiteLabRoot(stringifiedJson);

      expect(result).not.toBeNull();
      expect(result?.path).toBe('direct');
      expect(result?.matchedFields).toContain('siteAssessment');
    });

    it('should handle nested stringified JSON', () => {
      const data = {
        rawEvidence: {
          labResultV4: JSON.stringify({
            siteAssessment: { score: 72 },
            siteGraph: { pages: [] },
          }),
        },
      };

      // Note: Currently we don't recursively parse nested strings
      // This test documents current behavior
      const result = findWebsiteLabRoot(data);

      // findWebsiteLabRoot doesn't recursively parse nested strings
      // It looks at the object structure
      expect(result).toBeNull();
    });

    it('should return null for invalid JSON strings', () => {
      const result = findWebsiteLabRoot('{ invalid json }');

      expect(result).toBeNull();
    });

    it('should return null for non-object JSON strings', () => {
      const result = findWebsiteLabRoot(JSON.stringify([1, 2, 3]));

      expect(result).toBeNull();
    });
  });

  describe('Path Detection', () => {
    it('should find WebsiteLab at rawEvidence.labResultV4', () => {
      const data = {
        rawEvidence: {
          labResultV4: {
            siteAssessment: { score: 72 },
            siteGraph: { pages: [] },
          },
        },
      };

      const result = findWebsiteLabRoot(data);

      expect(result?.path).toBe('rawEvidence.labResultV4');
      expect(result?.matchedFields).toContain('siteAssessment');
    });

    it('should find WebsiteLab at websiteLab container', () => {
      const data = {
        websiteLab: {
          siteAssessment: { score: 72 },
          siteGraph: { pages: [] },
        },
      };

      const result = findWebsiteLabRoot(data);

      expect(result?.path).toBe('websiteLab');
      expect(result?.matchedFields).toContain('siteAssessment');
    });

    it('should find WebsiteLab at lab container', () => {
      const data = {
        lab: {
          siteAssessment: { score: 72 },
          trustAnalysis: { trustScore: 78 },
        },
      };

      const result = findWebsiteLabRoot(data);

      expect(result?.path).toBe('lab');
    });

    it('should find WebsiteLab at evidencePack.websiteLabV4', () => {
      const data = {
        evidencePack: {
          websiteLabV4: {
            siteAssessment: { score: 72 },
            ctaIntelligence: { summaryScore: 65 },
          },
        },
      };

      const result = findWebsiteLabRoot(data);

      expect(result?.path).toBe('evidencePack.websiteLabV4');
      expect(result?.matchedFields).toContain('siteAssessment');
    });

    it('should find WebsiteLab at result.websiteLab', () => {
      const data = {
        result: {
          websiteLab: {
            siteAssessment: { score: 72 },
            pages: [],
          },
        },
      };

      const result = findWebsiteLabRoot(data);

      expect(result?.path).toBe('result.websiteLab');
    });
  });

  describe('Fallback Detection', () => {
    it('should use fallback for secondary fields only', () => {
      const data = {
        result: {
          score: 72,
          summary: 'Website analysis summary',
          recommendations: ['Add CTA', 'Optimize images'],
        },
      };

      const result = findWebsiteLabRoot(data);

      // Should fall back to result with secondary fields
      expect(result).not.toBeNull();
      expect(result?.path).toContain('fallback');
    });

    it('should return null if no signature or secondary fields', () => {
      const data = {
        randomField: 'value',
        anotherField: { nested: 'data' },
      };

      const result = findWebsiteLabRoot(data);

      expect(result).toBeNull();
    });

    it('should detect WebsiteLab at root with signature fields', () => {
      const data = {
        siteAssessment: { score: 72 },
        contentIntelligence: { summaryScore: 70 },
        pages: [],
      };

      const result = findWebsiteLabRoot(data);

      expect(result?.path).toBe('direct');
      expect(result?.matchedFields.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should return null for null input', () => {
      expect(findWebsiteLabRoot(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(findWebsiteLabRoot(undefined)).toBeNull();
    });

    it('should return null for array input', () => {
      expect(findWebsiteLabRoot([1, 2, 3])).toBeNull();
    });

    it('should return null for primitive input', () => {
      expect(findWebsiteLabRoot(42)).toBeNull();
      expect(findWebsiteLabRoot('string')).toBeNull();
      expect(findWebsiteLabRoot(true)).toBeNull();
    });

    it('should handle empty object', () => {
      expect(findWebsiteLabRoot({})).toBeNull();
    });
  });
});

// ============================================================================
// buildWebsiteLabCandidates - Additional Extraction Path Tests
// ============================================================================

describe('buildWebsiteLabCandidates - Additional Paths', () => {
  it('should extract from websiteLab container', () => {
    const rawJson = {
      websiteLab: mockWebsiteLabResult,
    };

    const result = buildWebsiteLabCandidates(rawJson);

    expect(result.extractionPath).toBe('websiteLab');
    expect(result.candidates.length).toBeGreaterThan(0);
  });

  it('should extract from lab container', () => {
    const rawJson = {
      lab: mockWebsiteLabResult,
    };

    const result = buildWebsiteLabCandidates(rawJson);

    expect(result.extractionPath).toBe('lab');
    expect(result.candidates.length).toBeGreaterThan(0);
  });

  it('should extract from evidencePack.websiteLabV4', () => {
    const rawJson = {
      evidencePack: {
        websiteLabV4: mockWebsiteLabResult,
      },
    };

    const result = buildWebsiteLabCandidates(rawJson);

    expect(result.extractionPath).toBe('evidencePack.websiteLabV4');
    expect(result.candidates.length).toBeGreaterThan(0);
  });

  it('should handle stringified JSON at root', () => {
    const rawJson = JSON.stringify(mockWebsiteLabResult);

    const result = buildWebsiteLabCandidates(rawJson);

    expect(result.extractionPath).toBe('direct');
    expect(result.candidates.length).toBeGreaterThan(0);
  });

  it('should return EXTRACT_PATH_MISSING debug info for unrecognized structure', () => {
    const rawJson = {
      unknownWrapper: {
        deeplyNested: {
          data: mockWebsiteLabResult,
        },
      },
    };

    const result = buildWebsiteLabCandidates(rawJson);

    expect(result.extractionPath).toBe('unknown');
    expect(result.candidates.length).toBe(0);
    expect(result.extractionFailureReason).toBeDefined();
    expect(result.topLevelKeys).toContain('unknownWrapper');
  });
});

// ============================================================================
// Inference Mappings Tests
// ============================================================================

describe('buildWebsiteLabCandidates - Inference Mappings', () => {
  it('should infer productOffer.valueProposition from executiveSummary', () => {
    const rawJson = {
      siteAssessment: {
        executiveSummary: 'We provide innovative solutions for modern businesses.',
      },
    };

    const result = buildWebsiteLabCandidates(rawJson);

    const vpCandidate = result.candidates.find(c => c.key === 'productOffer.valueProposition');
    expect(vpCandidate).toBeDefined();
    expect(vpCandidate?.value).toContain('innovative solutions');
    expect(vpCandidate?.confidence).toBeLessThan(0.7); // Inferred = lower confidence
    expect(vpCandidate?.evidence?.isInferred).toBe(true);
  });

  it('should infer identity.companyDescription from executiveSummary', () => {
    const rawJson = {
      siteAssessment: {
        executiveSummary: 'Acme Corp is a leading provider of enterprise software solutions.',
      },
    };

    const result = buildWebsiteLabCandidates(rawJson);

    const descCandidate = result.candidates.find(c => c.key === 'identity.companyDescription');
    expect(descCandidate).toBeDefined();
    expect(descCandidate?.value).toContain('Acme Corp');
    expect(descCandidate?.confidence).toBeLessThan(0.6);
    expect(descCandidate?.evidence?.isInferred).toBe(true);
  });

  it('should produce >0 candidates from minimal WebsiteLab data', () => {
    // Minimal WebsiteLab output that should still produce candidates
    const rawJson = {
      siteAssessment: {
        score: 72,
        executiveSummary: 'This e-commerce website sells home furniture and decor.',
      },
      siteGraph: {
        pages: [{ url: '/', type: 'homepage' }],
      },
    };

    const result = buildWebsiteLabCandidates(rawJson);

    // Should have at least the inferred candidates
    expect(result.candidates.length).toBeGreaterThan(0);

    // Should include identity or productOffer inferences
    const inferredCandidates = result.candidates.filter(c => c.evidence?.isInferred);
    expect(inferredCandidates.length).toBeGreaterThan(0);
  });

  it('should include debug info when NO_CANDIDATES', () => {
    // Data that looks like WebsiteLab but has no extractable values
    const rawJson = {
      siteAssessment: {
        score: null,
        executiveSummary: '', // Empty
      },
      siteGraph: {
        pages: [], // Empty
      },
    };

    const result = buildWebsiteLabCandidates(rawJson);

    // Should have 0 candidates
    expect(result.candidates.length).toBe(0);

    // Should have debug info
    expect(result.debug).toBeDefined();
    expect(result.debug?.rootTopKeys).toContain('siteAssessment');
    expect(result.debug?.samplePathsFound.siteAssessment).toBe(true);
    expect(result.debug?.attemptedMappings.length).toBeGreaterThan(0);

    // Check that attempted mappings have proper structure
    const firstMapping = result.debug?.attemptedMappings[0];
    expect(firstMapping?.fieldKey).toBeDefined();
    expect(firstMapping?.attempted).toBe(true);
  });

  it('should not include debug info when candidates exist', () => {
    const rawJson = mockWebsiteLabResult;

    const result = buildWebsiteLabCandidates(rawJson);

    // Should have candidates
    expect(result.candidates.length).toBeGreaterThan(0);

    // Should NOT have debug info (only attached when 0 candidates)
    expect(result.debug).toBeUndefined();
  });

  it('should prioritize direct mappings over inference', () => {
    // If standard mapping produces a value, don't use inference
    const rawJson = {
      siteAssessment: {
        score: 85,
        executiveSummary: 'The first summary for value proposition.',
      },
      contentIntelligence: {
        valueProposition: 'Our unique value proposition is X.', // Direct path for inference
      },
    };

    const result = buildWebsiteLabCandidates(rawJson);

    // Inferred productOffer.valueProposition should prefer contentIntelligence.valueProposition
    const vpCandidate = result.candidates.find(c => c.key === 'productOffer.valueProposition');
    expect(vpCandidate).toBeDefined();
    expect(vpCandidate?.value).toContain('unique value proposition');
    expect(vpCandidate?.evidence?.rawPath).toBe('contentIntelligence.valueProposition');
  });
});

// ============================================================================
// Debug Info Structure Tests
// ============================================================================

// ============================================================================
// vNext Schema Support Tests
// ============================================================================

describe('buildWebsiteLabCandidates - vNext Schema', () => {
  // vNext schema mock data: root-level score, summary, recommendations, issues
  const vNextMockData = {
    module: 'websiteLab',
    status: 'completed',
    startedAt: '2024-01-15T10:00:00Z',
    completedAt: '2024-01-15T10:05:00Z',
    score: 72,
    summary: 'The website shows good performance but needs conversion optimization.',
    issues: [
      { title: 'No clear CTA', description: 'Homepage lacks prominent call-to-action', page: '/' },
      { title: 'Slow load time', description: 'Images not optimized', page: '/products' },
      'Missing mobile menu',
    ],
    recommendations: [
      { title: 'Add hero CTA', description: 'Place prominent CTA in hero section' },
      { title: 'Optimize images', description: 'Compress images for faster load' },
      { title: 'Improve navigation', quickWin: true },
      { title: 'Add testimonials', quickWin: true },
      'Simplify checkout form',
    ],
    rawEvidence: {},
  };

  it('should detect vNextRoot schema when score+summary+recommendations at root', () => {
    const result = buildWebsiteLabCandidates(vNextMockData);

    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.extractionPath).toContain('direct');
  });

  it('should extract website.websiteScore from root score', () => {
    const result = buildWebsiteLabCandidates(vNextMockData);

    const scoreCandidate = result.candidates.find((c) => c.key === 'website.websiteScore');
    expect(scoreCandidate).toBeDefined();
    expect(scoreCandidate?.value).toBe(72);
    expect(scoreCandidate?.evidence?.rawPath).toBe('score');
  });

  it('should extract website.websiteSummary from root summary', () => {
    const result = buildWebsiteLabCandidates(vNextMockData);

    const summaryCandidate = result.candidates.find((c) => c.key === 'website.websiteSummary');
    expect(summaryCandidate).toBeDefined();
    expect(summaryCandidate?.value).toContain('good performance');
  });

  it('should extract website.recommendations from root recommendations', () => {
    const result = buildWebsiteLabCandidates(vNextMockData);

    const recsCandidate = result.candidates.find((c) => c.key === 'website.recommendations');
    expect(recsCandidate).toBeDefined();
    expect(Array.isArray(recsCandidate?.value)).toBe(true);
    expect((recsCandidate?.value as string[])).toContain('Add hero CTA');
    expect((recsCandidate?.value as string[])).toContain('Simplify checkout form');
  });

  it('should extract website.quickWins from recommendations with quickWin flag', () => {
    const result = buildWebsiteLabCandidates(vNextMockData);

    const quickWinsCandidate = result.candidates.find((c) => c.key === 'website.quickWins');
    expect(quickWinsCandidate).toBeDefined();
    expect(Array.isArray(quickWinsCandidate?.value)).toBe(true);
    // Should include items tagged as quickWin
    expect((quickWinsCandidate?.value as string[])).toContain('Improve navigation');
    expect((quickWinsCandidate?.value as string[])).toContain('Add testimonials');
  });

  it('should extract website.conversionBlocks from root issues', () => {
    const result = buildWebsiteLabCandidates(vNextMockData);

    const blocksCandidate = result.candidates.find((c) => c.key === 'website.conversionBlocks');
    expect(blocksCandidate).toBeDefined();
    expect(Array.isArray(blocksCandidate?.value)).toBe(true);
    expect((blocksCandidate?.value as string[])).toContain('No clear CTA');
    expect((blocksCandidate?.value as string[])).toContain('Missing mobile menu');
  });

  it('should extract website.pageAssessments from issues with page info', () => {
    const result = buildWebsiteLabCandidates(vNextMockData);

    const pageCandidate = result.candidates.find((c) => c.key === 'website.pageAssessments');
    expect(pageCandidate).toBeDefined();
    expect(Array.isArray(pageCandidate?.value)).toBe(true);

    const pages = pageCandidate?.value as Array<{ url: string; issues: string[] }>;
    expect(pages.length).toBeGreaterThan(0);
    // Check homepage issues
    const homePage = pages.find((p) => p.url === '/');
    expect(homePage).toBeDefined();
    expect(homePage?.issues).toContain('No clear CTA');
  });

  it('should handle score=0 as meaningful value', () => {
    const zeroScoreData = {
      ...vNextMockData,
      score: 0,
    };

    const result = buildWebsiteLabCandidates(zeroScoreData);

    const scoreCandidate = result.candidates.find((c) => c.key === 'website.websiteScore');
    expect(scoreCandidate).toBeDefined();
    expect(scoreCandidate?.value).toBe(0);
  });

  it('should handle summary as object and stringify it', () => {
    const objectSummaryData = {
      ...vNextMockData,
      summary: {
        text: 'Summary text from object',
        rating: 'good',
      },
    };

    const result = buildWebsiteLabCandidates(objectSummaryData);

    const summaryCandidate = result.candidates.find((c) => c.key === 'website.websiteSummary');
    expect(summaryCandidate).toBeDefined();
    // Should extract .text property
    expect(summaryCandidate?.value).toBe('Summary text from object');
  });

  it('should include debug info with detectedSchema when 0 candidates', () => {
    // Data that matches labResultV4 signature (has siteAssessment) but all values empty
    // This tests an edge case where extraction works but no meaningful values found
    const emptyLabData = {
      siteAssessment: {
        score: null, // Empty
        executiveSummary: '', // Empty
        keyIssues: [], // Empty
      },
      siteGraph: {
        pages: [], // Empty
      },
    };

    const result = buildWebsiteLabCandidates(emptyLabData);

    // Should detect as labResultV4 but produce 0 candidates due to empty values
    expect(result.candidates.length).toBe(0);
    expect(result.debug).toBeDefined();
    expect(result.debug?.detectedSchema).toBe('labResultV4');
  });

  it('should include debug info for vNextRoot when values empty but schema detected', () => {
    // vNext schema detected via score presence, but recommendations/summary empty
    const emptyVNextData = {
      module: 'websiteLab',
      score: 50, // Score present triggers vNext detection
      summary: '', // Empty
      recommendations: [], // Empty
      issues: [], // Empty
    };

    const result = buildWebsiteLabCandidates(emptyVNextData);

    // Should have 1 candidate (score) but empty lists
    expect(result.candidates.length).toBe(1); // Just the score
    expect(result.candidates[0].key).toBe('website.websiteScore');
  });
});

describe('buildWebsiteLabCandidates - Old Schema Compatibility', () => {
  it('should still work with labResultV4 schema (siteAssessment)', () => {
    const rawJson = { rawEvidence: { labResultV4: mockWebsiteLabResult } };
    const result = buildWebsiteLabCandidates(rawJson);

    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.extractionPath).toBe('rawEvidence.labResultV4');

    // Should have website.websiteScore from siteAssessment.score
    const scoreCandidate = result.candidates.find((c) => c.key === 'website.websiteScore');
    expect(scoreCandidate).toBeDefined();
    expect(scoreCandidate?.value).toBe(72);
    expect(scoreCandidate?.evidence?.rawPath).toBe('siteAssessment.score');
  });

  it('should detect labResultV4 schema when siteAssessment present', () => {
    const rawJson = mockWebsiteLabResult;
    const result = buildWebsiteLabCandidates(rawJson);

    expect(result.candidates.length).toBeGreaterThan(0);
    // labResultV4 schema should be detected and standard mappings used
    const summaryCandidate = result.candidates.find((c) => c.key === 'website.executiveSummary');
    expect(summaryCandidate).toBeDefined();
    expect(summaryCandidate?.evidence?.rawPath).toBe('siteAssessment.executiveSummary');
  });
});

describe('buildWebsiteLabCandidates - Debug Info', () => {
  it('should track samplePathsFound correctly', () => {
    const rawJson = {
      siteAssessment: {
        score: null,
        executiveSummary: null,
        keyIssues: ['Issue 1'], // This is findings
      },
      contentIntelligence: {
        narrative: 'Some content summary', // This is summary
      },
      trustAnalysis: {
        trustScore: 80,
      },
      siteGraph: {
        pages: [{ url: '/' }],
      },
    };

    // Force 0 candidates by having only empty values for mapped fields
    const result = buildWebsiteLabCandidates({
      ...rawJson,
      siteAssessment: { ...rawJson.siteAssessment, score: null },
    });

    // If no candidates, check debug
    if (result.candidates.length === 0 && result.debug) {
      expect(result.debug.samplePathsFound.siteAssessment).toBe(true);
      expect(result.debug.samplePathsFound.contentIntelligence).toBe(true);
      expect(result.debug.samplePathsFound.trustAnalysis).toBe(true);
    }
  });

  it('should limit attemptedMappings to 20 entries', () => {
    // Create rawJson that triggers many attempted mappings
    const rawJson = {
      siteAssessment: {},
      siteGraph: {},
      contentIntelligence: {},
      trustAnalysis: {},
      ctaIntelligence: {},
      visualBrandEvaluation: {},
    };

    const result = buildWebsiteLabCandidates(rawJson);

    // If debug exists, check limit
    if (result.debug) {
      expect(result.debug.attemptedMappings.length).toBeLessThanOrEqual(20);
    }
  });
});
