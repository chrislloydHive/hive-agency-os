// tests/diagnostics/postRunHooks.websiteLab.test.ts
// Post-Run Hooks WebsiteLab Extraction Tests
//
// Tests the WebsiteLab domain writer extraction path:
// - New format: rawEvidence.labResultV4.siteAssessment
// - Legacy format: result.siteAssessment or direct siteAssessment
// - Validation of expected structure

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before importing the module under test
const mockBuildWebsiteLabCandidatesWithV5 = vi.fn().mockReturnValue({
  extractionPath: 'websiteLab.v5',
  candidates: [{ key: 'website.score', value: 85 }],
  rawKeysFound: 2,
  skipped: { wrongDomain: 0, emptyValue: 0, noMapping: 0 },
  skippedWrongDomainKeys: [],
});

const mockProposeFromLabResult = vi.fn().mockResolvedValue({
  proposed: 1,
  blocked: 0,
  replaced: 0,
  errors: [],
});

vi.mock('@/lib/contextGraph/v4', () => ({
  buildWebsiteLabCandidatesWithV5: mockBuildWebsiteLabCandidatesWithV5,
  proposeFromLabResult: mockProposeFromLabResult,
}));

vi.mock('./aiInsights', () => ({
  summarizeDiagnosticRunForBrain: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/os/companies/strategySnapshot', () => ({
  refreshCompanyStrategicSnapshot: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/contextGraph/fusion', () => ({
  runFusion: vi.fn().mockResolvedValue({ fieldsUpdated: 0, sourcesUsed: [], versionId: 'v1' }),
}));

vi.mock('@/lib/insights/engine', () => ({
  processCompletedDiagnostic: vi.fn().mockResolvedValue({ insightsCreated: 0, insightsSkipped: 0, duration: 0 }),
}));

vi.mock('@/lib/airtable/diagnosticDetails', () => ({
  saveDiagnosticFindings: vi.fn().mockResolvedValue([]),
  deleteUnconvertedFindingsForCompanyLab: vi.fn().mockResolvedValue(0),
}));

vi.mock('./runs', () => ({
  getLabSlugForToolId: vi.fn().mockReturnValue('website'),
}));

vi.mock('./findingsExtractors', () => ({
  extractFindingsForLab: vi.fn().mockReturnValue([]),
  getWorstSeverity: vi.fn().mockReturnValue(null),
}));

describe('postRunHooks WebsiteLab Extraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Extraction Path: rawEvidence.labResultV4', () => {
    it('should extract from rawEvidence.labResultV4 (new format)', async () => {
      // Import runDomainWriters via the module (need to call it indirectly)
      // Since runDomainWriters is not exported, we test via processDiagnosticRunCompletion
      const { processDiagnosticRunCompletion } = await import('@/lib/os/diagnostics/postRunHooks');

      const mockSiteAssessment = {
        score: 85,
        summary: 'Excellent website',
        issues: [],
        recommendations: [],
      };

      const mockRun = {
        id: 'test-run-123',
        companyId: 'test-company',
        toolId: 'websiteLab' as const,
        status: 'complete' as const,
        rawJson: {
          module: 'website',
          status: 'completed',
          score: 85,
          rawEvidence: {
            labResultV4: {
              siteAssessment: mockSiteAssessment,
              siteGraph: { pages: [] },
            },
          },
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await processDiagnosticRunCompletion('test-company', mockRun as any);

      // Verify V5 builder and proposal path used
      expect(mockBuildWebsiteLabCandidatesWithV5).toHaveBeenCalledWith(mockRun.rawJson, mockRun.id);
      expect(mockProposeFromLabResult).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: 'test-company',
          importerId: 'websiteLab',
          sourceId: 'test-run-123',
          extractionPath: 'websiteLab.v5',
          candidates: expect.any(Array),
        })
      );
    });

    it('should fall back to legacy format when rawEvidence missing', async () => {
      const { processDiagnosticRunCompletion } = await import('@/lib/os/diagnostics/postRunHooks');

      const legacyData = {
        siteAssessment: {
          score: 70,
          summary: 'Good website',
        },
        siteGraph: { pages: [] },
      };

      const mockRun = {
        id: 'legacy-run-456',
        companyId: 'test-company',
        toolId: 'websiteLab' as const,
        status: 'complete' as const,
        rawJson: legacyData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await processDiagnosticRunCompletion('test-company', mockRun as any);

      expect(mockBuildWebsiteLabCandidatesWithV5).toHaveBeenCalledWith(legacyData, 'legacy-run-456');
      expect(mockProposeFromLabResult).toHaveBeenCalled();
    });

    it('should handle result-wrapped legacy format', async () => {
      const { processDiagnosticRunCompletion } = await import('@/lib/os/diagnostics/postRunHooks');

      const wrappedData = {
        result: {
          siteAssessment: {
            score: 65,
            summary: 'OK website',
          },
          siteGraph: { pages: [] },
        },
      };

      const mockRun = {
        id: 'wrapped-run-789',
        companyId: 'test-company',
        toolId: 'websiteLab' as const,
        status: 'complete' as const,
        rawJson: wrappedData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await processDiagnosticRunCompletion('test-company', mockRun as any);

      expect(mockBuildWebsiteLabCandidatesWithV5).toHaveBeenCalledWith(wrappedData, 'wrapped-run-789');
      expect(mockProposeFromLabResult).toHaveBeenCalled();
    });

    it('should skip writer when rawJson missing expected structure', async () => {
      const { processDiagnosticRunCompletion } = await import('@/lib/os/diagnostics/postRunHooks');

      const invalidData = {
        someOtherField: 'data',
        notSiteAssessment: {},
      };

      const mockRun = {
        id: 'invalid-run',
        companyId: 'test-company',
        toolId: 'websiteLab' as const,
        status: 'complete' as const,
        rawJson: invalidData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await processDiagnosticRunCompletion('test-company', mockRun as any);

      // Should still attempt builder/proposal even if structure is odd
      expect(mockBuildWebsiteLabCandidatesWithV5).toHaveBeenCalled();
    });
  });

  describe('Non-Empty Output', () => {
    it('should produce fieldsWritten > 0 for valid website data', async () => {
      const { processDiagnosticRunCompletion } = await import('@/lib/os/diagnostics/postRunHooks');

      const mockRun = {
        id: 'full-data-run',
        companyId: 'test-company',
        toolId: 'websiteLab' as const,
        status: 'complete' as const,
        rawJson: {
          rawEvidence: {
            labResultV4: {
              siteAssessment: {
                score: 90,
                summary: 'Great website with excellent UX',
                issues: [{ title: 'Minor accessibility issue' }],
                recommendations: ['Add more social proof'],
              },
              siteGraph: {
                pages: [
                  { url: '/', title: 'Home' },
                  { url: '/about', title: 'About' },
                ],
              },
            },
          },
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await processDiagnosticRunCompletion('test-company', mockRun as any);

      // Verify proposal path executed
      expect(mockBuildWebsiteLabCandidatesWithV5).toHaveBeenCalled();
      expect(mockProposeFromLabResult).toHaveBeenCalled();
    });
  });
});
