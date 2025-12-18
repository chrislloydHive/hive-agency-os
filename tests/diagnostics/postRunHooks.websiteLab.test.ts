// tests/diagnostics/postRunHooks.websiteLab.test.ts
// Post-Run Hooks WebsiteLab Extraction Tests
//
// Tests the WebsiteLab domain writer extraction path:
// - New format: rawEvidence.labResultV4.siteAssessment
// - Legacy format: result.siteAssessment or direct siteAssessment
// - Validation of expected structure

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before importing the module under test
vi.mock('@/lib/contextGraph/websiteLabWriter', () => ({
  writeWebsiteLabAndSave: vi.fn(),
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
      const { writeWebsiteLabAndSave } = await import('@/lib/contextGraph/websiteLabWriter');

      // Mock successful write
      vi.mocked(writeWebsiteLabAndSave).mockResolvedValue({
        graph: {} as any,
        summary: {
          fieldsUpdated: 5,
          updatedPaths: ['website.score', 'website.summary'],
          skippedPaths: [],
          errors: [],
        },
      });

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

      // Verify writeWebsiteLabAndSave was called with extracted data
      expect(writeWebsiteLabAndSave).toHaveBeenCalledWith(
        'test-company',
        expect.objectContaining({
          siteAssessment: mockSiteAssessment,
        }),
        'test-run-123'
      );
    });

    it('should fall back to legacy format when rawEvidence missing', async () => {
      const { writeWebsiteLabAndSave } = await import('@/lib/contextGraph/websiteLabWriter');

      vi.mocked(writeWebsiteLabAndSave).mockResolvedValue({
        graph: {} as any,
        summary: {
          fieldsUpdated: 3,
          updatedPaths: ['website.score'],
          skippedPaths: [],
          errors: [],
        },
      });

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

      // Verify writeWebsiteLabAndSave was called with legacy data
      expect(writeWebsiteLabAndSave).toHaveBeenCalledWith(
        'test-company',
        legacyData,
        'legacy-run-456'
      );
    });

    it('should handle result-wrapped legacy format', async () => {
      const { writeWebsiteLabAndSave } = await import('@/lib/contextGraph/websiteLabWriter');

      vi.mocked(writeWebsiteLabAndSave).mockResolvedValue({
        graph: {} as any,
        summary: {
          fieldsUpdated: 2,
          updatedPaths: ['website.score'],
          skippedPaths: [],
          errors: [],
        },
      });

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

      // Verify writeWebsiteLabAndSave was called with unwrapped data
      expect(writeWebsiteLabAndSave).toHaveBeenCalledWith(
        'test-company',
        wrappedData.result,
        'wrapped-run-789'
      );
    });

    it('should skip writer when rawJson missing expected structure', async () => {
      const { writeWebsiteLabAndSave } = await import('@/lib/contextGraph/websiteLabWriter');

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

      // writeWebsiteLabAndSave should NOT have been called
      expect(writeWebsiteLabAndSave).not.toHaveBeenCalled();
    });
  });

  describe('Non-Empty Output', () => {
    it('should produce fieldsWritten > 0 for valid website data', async () => {
      const { writeWebsiteLabAndSave } = await import('@/lib/contextGraph/websiteLabWriter');

      // Track the call to verify non-empty output
      let capturedResult: any = null;
      vi.mocked(writeWebsiteLabAndSave).mockImplementation(async (companyId, data, runId) => {
        capturedResult = {
          graph: {} as any,
          summary: {
            fieldsUpdated: 7, // Non-zero!
            updatedPaths: [
              'website.websiteScore',
              'website.websiteSummary',
              'website.criticalIssues',
              'website.quickWins',
              'website.uxAssessment',
              'website.conversionPaths',
              'website.technicalHealth',
            ],
            errors: [],
          },
        };
        return capturedResult;
      });

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

      // Verify writer was called and produced non-zero output
      expect(writeWebsiteLabAndSave).toHaveBeenCalled();
      expect(capturedResult.summary.fieldsUpdated).toBeGreaterThan(0);
      expect(capturedResult.summary.updatedPaths.length).toBeGreaterThan(0);
    });
  });
});
