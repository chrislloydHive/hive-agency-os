// tests/context/websiteLabImporter.test.ts
// Website Lab Importer Tests
//
// Tests the Website Lab importer functionality including:
// - Table priority (DIAGNOSTIC_RUNS before GAP_HEAVY_RUNS)
// - Extraction path (rawEvidence.labResultV4.siteAssessment)
// - Fallback behavior for legacy formats

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { websiteLabImporter } from '@/lib/contextGraph/importers/websiteLabImporter';
import { createEmptyContextGraph } from '@/lib/contextGraph/companyContextGraph';

// Mock the Airtable layer calls
vi.mock('@/lib/os/diagnostics/runs', () => ({
  listDiagnosticRunsForCompany: vi.fn(),
}));

vi.mock('@/lib/airtable/gapHeavyRuns', () => ({
  getHeavyGapRunsByCompanyId: vi.fn(),
}));

// Mock the WebsiteLabWriter to track what data it receives
vi.mock('@/lib/contextGraph/websiteLabWriter', () => ({
  writeWebsiteLabToGraph: vi.fn(),
}));

describe('Website Lab Importer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Importer Structure', () => {
    it('should have correct id and label', () => {
      expect(websiteLabImporter.id).toBe('websiteLab');
      expect(websiteLabImporter.label).toBe('Website Lab');
    });

    it('should implement DomainImporter interface', () => {
      expect(typeof websiteLabImporter.supports).toBe('function');
      expect(typeof websiteLabImporter.importAll).toBe('function');
    });
  });

  describe('Table Priority: DIAGNOSTIC_RUNS First', () => {
    it('should check DIAGNOSTIC_RUNS before GAP_HEAVY_RUNS in supports()', async () => {
      const { listDiagnosticRunsForCompany } = await import('@/lib/os/diagnostics/runs');
      const { getHeavyGapRunsByCompanyId } = await import('@/lib/airtable/gapHeavyRuns');

      // Setup: DIAGNOSTIC_RUNS has data
      vi.mocked(listDiagnosticRunsForCompany).mockResolvedValue([
        {
          id: 'diag-run-123',
          companyId: 'test-company',
          toolId: 'websiteLab',
          status: 'complete',
          rawJson: { rawEvidence: { labResultV4: { siteAssessment: {} } } },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ] as any);

      // GAP_HEAVY_RUNS also has data (should not be called)
      vi.mocked(getHeavyGapRunsByCompanyId).mockResolvedValue([
        {
          id: 'heavy-run-456',
          status: 'completed',
          evidencePack: { websiteLabV4: { siteAssessment: {} } },
        },
      ] as any);

      const result = await websiteLabImporter.supports('test-company', 'website');

      // Should return true (found in DIAGNOSTIC_RUNS)
      expect(result).toBe(true);

      // Verify DIAGNOSTIC_RUNS was checked
      expect(listDiagnosticRunsForCompany).toHaveBeenCalledWith('test-company', {
        toolId: 'websiteLab',
        limit: 5,
      });

      // GAP_HEAVY_RUNS should NOT be called since DIAGNOSTIC_RUNS had data
      expect(getHeavyGapRunsByCompanyId).not.toHaveBeenCalled();
    });

    it('should fall back to GAP_HEAVY_RUNS when DIAGNOSTIC_RUNS empty', async () => {
      const { listDiagnosticRunsForCompany } = await import('@/lib/os/diagnostics/runs');
      const { getHeavyGapRunsByCompanyId } = await import('@/lib/airtable/gapHeavyRuns');

      // Setup: DIAGNOSTIC_RUNS is empty
      vi.mocked(listDiagnosticRunsForCompany).mockResolvedValue([]);

      // GAP_HEAVY_RUNS has data
      vi.mocked(getHeavyGapRunsByCompanyId).mockResolvedValue([
        {
          id: 'heavy-run-456',
          status: 'completed',
          evidencePack: { websiteLabV4: { siteAssessment: {} } },
        },
      ] as any);

      const result = await websiteLabImporter.supports('test-company', 'website');

      // Should return true (found in GAP_HEAVY_RUNS fallback)
      expect(result).toBe(true);

      // Both should have been called
      expect(listDiagnosticRunsForCompany).toHaveBeenCalled();
      expect(getHeavyGapRunsByCompanyId).toHaveBeenCalled();
    });

    it('should use DIAGNOSTIC_RUNS data in importAll() when available', async () => {
      const { listDiagnosticRunsForCompany } = await import('@/lib/os/diagnostics/runs');
      const { getHeavyGapRunsByCompanyId } = await import('@/lib/airtable/gapHeavyRuns');
      const { writeWebsiteLabToGraph } = await import('@/lib/contextGraph/websiteLabWriter');

      const mockSiteAssessment = {
        score: 75,
        summary: 'Good website',
        issues: [],
        recommendations: [],
      };

      // Setup: DIAGNOSTIC_RUNS has data with new format
      vi.mocked(listDiagnosticRunsForCompany).mockResolvedValue([
        {
          id: 'diag-run-123',
          companyId: 'test-company',
          toolId: 'websiteLab',
          status: 'complete',
          rawJson: {
            rawEvidence: {
              labResultV4: {
                siteAssessment: mockSiteAssessment,
                siteGraph: { pages: [] },
              },
            },
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ] as any);

      // Mock writer to return success
      vi.mocked(writeWebsiteLabToGraph).mockReturnValue({
        fieldsUpdated: 5,
        updatedPaths: ['website.score', 'website.summary'],
        errors: [],
      } as any);

      const graph = createEmptyContextGraph('test-company', 'Test Company');
      const result = await websiteLabImporter.importAll(graph, 'test-company', 'website');

      // Should succeed
      expect(result.success).toBe(true);
      expect(result.fieldsUpdated).toBe(5);
      expect(result.sourceRunIds).toContain('diag-run-123');

      // GAP_HEAVY_RUNS should NOT have been called
      expect(getHeavyGapRunsByCompanyId).not.toHaveBeenCalled();

      // Verify writer received correct data (extracted from rawEvidence.labResultV4)
      expect(writeWebsiteLabToGraph).toHaveBeenCalledWith(
        graph,
        expect.objectContaining({
          siteAssessment: mockSiteAssessment,
        }),
        'diag-run-123'
      );
    });
  });

  describe('Extraction Path: rawEvidence.labResultV4', () => {
    it('should extract from rawEvidence.labResultV4 (new format)', async () => {
      const { listDiagnosticRunsForCompany } = await import('@/lib/os/diagnostics/runs');
      const { writeWebsiteLabToGraph } = await import('@/lib/contextGraph/websiteLabWriter');

      const mockLabResult = {
        siteAssessment: {
          score: 85,
          summary: 'Excellent website',
          issues: [{ title: 'Minor issue' }],
          recommendations: ['Add CTA'],
        },
        siteGraph: {
          pages: [{ url: '/', title: 'Home' }],
        },
      };

      // New format: rawEvidence.labResultV4
      vi.mocked(listDiagnosticRunsForCompany).mockResolvedValue([
        {
          id: 'new-format-run',
          companyId: 'test-company',
          toolId: 'websiteLab',
          status: 'complete',
          rawJson: {
            module: 'website',
            status: 'completed',
            score: 85,
            summary: 'Test summary',
            rawEvidence: {
              labResultV4: mockLabResult,
            },
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ] as any);

      vi.mocked(writeWebsiteLabToGraph).mockReturnValue({
        fieldsUpdated: 3,
        updatedPaths: ['website.score'],
        errors: [],
      } as any);

      const graph = createEmptyContextGraph('test-company', 'Test Company');
      await websiteLabImporter.importAll(graph, 'test-company', 'website');

      // Writer should receive the extracted labResultV4 data
      expect(writeWebsiteLabToGraph).toHaveBeenCalledWith(
        graph,
        mockLabResult,
        'new-format-run'
      );
    });

    it('should fall back to legacy format when rawEvidence.labResultV4 missing', async () => {
      const { listDiagnosticRunsForCompany } = await import('@/lib/os/diagnostics/runs');
      const { writeWebsiteLabToGraph } = await import('@/lib/contextGraph/websiteLabWriter');

      const legacyData = {
        siteAssessment: {
          score: 70,
          summary: 'Legacy format',
        },
        siteGraph: { pages: [] },
      };

      // Legacy format: direct structure
      vi.mocked(listDiagnosticRunsForCompany).mockResolvedValue([
        {
          id: 'legacy-format-run',
          companyId: 'test-company',
          toolId: 'websiteLab',
          status: 'complete',
          rawJson: legacyData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ] as any);

      vi.mocked(writeWebsiteLabToGraph).mockReturnValue({
        fieldsUpdated: 2,
        updatedPaths: ['website.score'],
        errors: [],
      } as any);

      const graph = createEmptyContextGraph('test-company', 'Test Company');
      await websiteLabImporter.importAll(graph, 'test-company', 'website');

      // Writer should receive the legacy data directly
      expect(writeWebsiteLabToGraph).toHaveBeenCalledWith(
        graph,
        legacyData,
        'legacy-format-run'
      );
    });

    it('should return error when rawJson missing expected structure', async () => {
      const { listDiagnosticRunsForCompany } = await import('@/lib/os/diagnostics/runs');

      // Invalid structure: no siteAssessment or siteGraph
      vi.mocked(listDiagnosticRunsForCompany).mockResolvedValue([
        {
          id: 'bad-format-run',
          companyId: 'test-company',
          toolId: 'websiteLab',
          status: 'complete',
          rawJson: {
            someOtherField: 'data',
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ] as any);

      const graph = createEmptyContextGraph('test-company', 'Test Company');
      const result = await websiteLabImporter.importAll(graph, 'test-company', 'website');

      // Should fail with appropriate error
      expect(result.success).toBe(false);
      expect(result.errors).toContain('WebsiteLab rawJson missing siteAssessment or siteGraph');
    });
  });

  describe('Non-Empty Output', () => {
    it('should not no-op when rawJson has valid data', async () => {
      const { listDiagnosticRunsForCompany } = await import('@/lib/os/diagnostics/runs');
      const { writeWebsiteLabToGraph } = await import('@/lib/contextGraph/websiteLabWriter');

      vi.mocked(listDiagnosticRunsForCompany).mockResolvedValue([
        {
          id: 'valid-run',
          companyId: 'test-company',
          toolId: 'websiteLab',
          status: 'complete',
          rawJson: {
            rawEvidence: {
              labResultV4: {
                siteAssessment: { score: 80, summary: 'Good' },
                siteGraph: { pages: [] },
              },
            },
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ] as any);

      // Writer produces output
      vi.mocked(writeWebsiteLabToGraph).mockReturnValue({
        fieldsUpdated: 5,
        updatedPaths: ['website.score', 'website.summary', 'website.issues'],
        errors: [],
      } as any);

      const graph = createEmptyContextGraph('test-company', 'Test Company');
      const result = await websiteLabImporter.importAll(graph, 'test-company', 'website');

      // Should have non-zero fields written
      expect(result.fieldsUpdated).toBeGreaterThan(0);
      expect(result.success).toBe(true);
    });
  });
});
