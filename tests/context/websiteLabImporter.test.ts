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
        'diag-run-123',
        expect.any(Object) // options with proofMode
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
        'new-format-run',
        expect.any(Object) // options with proofMode
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
        'legacy-format-run',
        expect.any(Object) // options with proofMode
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

// ============================================================================
// Domain Authority Compliance Tests
// ============================================================================
// Tests that websiteLab only writes to authorized domains (website, digitalInfra)
// and that cross-domain keys are reported as wrongDomainForField
//
// NOTE: These tests directly import the real modules without mocking to test
// the actual domain authority enforcement.

describe('WebsiteLab Domain Authority Compliance', () => {
  beforeEach(() => {
    // Unmock the websiteLabWriter to get the real implementation
    vi.doUnmock('@/lib/contextGraph/websiteLabWriter');
    vi.resetModules();
    // Enable proof mode for these tests
    process.env.DEBUG_CONTEXT_PROOF = '1';
  });

  afterEach(() => {
    delete process.env.DEBUG_CONTEXT_PROOF;
    // Re-mock for other tests
    vi.doMock('@/lib/contextGraph/websiteLabWriter', () => ({
      writeWebsiteLabToGraph: vi.fn(),
    }));
  });

  describe('websiteLabWriter Domain Filtering', () => {
    it('should only write to website and digitalInfra domains', async () => {
      // Fresh imports without mocks - uses real implementation
      const { writeWebsiteLabToGraph } = await import('@/lib/contextGraph/websiteLabWriter');
      const { createEmptyContextGraph: createGraph } = await import('@/lib/contextGraph/companyContextGraph');

      const graph = createGraph('test-company', 'Test Company');

      // Fixture with data that maps to multiple domains
      // Use exact paths from WEBSITE_LAB_MAPPINGS
      const labResultV4 = {
        siteAssessment: {
          score: 75, // → website.websiteScore
          executiveSummary: 'Website assessment summary', // → website.executiveSummary
          quickWins: [{ title: 'Add CTA', description: 'Add call to action' }], // → website.quickWins
        },
        siteGraph: { pages: [] },
        // This data maps to brand domain (should be skipped)
        visualBrandEvaluation: {
          brandConsistencyScore: 80, // → brand.brandConsistencyScore
          colorHarmony: { primaryColors: ['#000', '#fff'] }, // → brand.colorHarmony
        },
        // This data maps to content domain (should be skipped)
        contentIntelligence: {
          summaryScore: 70, // → content.contentScore
          narrative: 'Content analysis', // → content.contentNarrative
        },
      };

      const result = writeWebsiteLabToGraph(graph, labResultV4 as any, 'test-run', { proofMode: true });

      // Verify proof data is captured
      expect(result.proof).toBeDefined();

      // The key assertion: wrongDomainForField should catch cross-domain writes
      expect(result.proof?.droppedByReason.wrongDomainForField).toBeGreaterThan(0);

      // No domainAuthority skips for website_lab on website domain
      expect(result.proof?.droppedByReason.domainAuthority).toBe(0);

      // All updated paths (if any) should be in website or digitalInfra
      for (const path of result.updatedPaths) {
        const domain = path.split('.')[0];
        expect(['website', 'digitalInfra']).toContain(domain);
      }
    });

    it('should report cross-domain keys as wrongDomainForField not domainAuthority', async () => {
      const { writeWebsiteLabToGraph } = await import('@/lib/contextGraph/websiteLabWriter');
      const { createEmptyContextGraph: createGraph } = await import('@/lib/contextGraph/companyContextGraph');

      const graph = createGraph('test-company', 'Test Company');

      // Fixture with data that should trigger wrongDomainForField
      const labResultV4 = {
        siteAssessment: {
          score: 75,
        },
        siteGraph: { pages: [] },
        // These map to brand/content/audience domains
        visualBrandEvaluation: {
          brandConsistencyScore: 80,
          narrative: 'Visual brand assessment',
        },
        contentIntelligence: {
          summaryScore: 70,
        },
        personas: [
          { persona: 'Developer', goal: 'Learn', success: true },
        ],
      };

      const result = writeWebsiteLabToGraph(graph, labResultV4 as any, 'test-run', { proofMode: true });

      // Proof should show wrongDomainForField skips
      expect(result.proof?.droppedByReason.wrongDomainForField).toBeGreaterThan(0);

      // Should have offendingFields populated
      expect(result.proof?.offendingFields).toBeDefined();
      expect(result.proof?.offendingFields?.length).toBeGreaterThan(0);

      // Verify the offending fields are for non-website domains
      const offendingDomains = result.proof?.offendingFields?.map(f => f.path.split('.')[0]) || [];
      for (const domain of offendingDomains) {
        expect(['brand', 'content', 'audience', 'historical']).toContain(domain);
      }
    });

    it('should achieve fieldsWritten > 0 with valid website data', async () => {
      const { writeWebsiteLabToGraph } = await import('@/lib/contextGraph/websiteLabWriter');
      const { createEmptyContextGraph: createGraph } = await import('@/lib/contextGraph/companyContextGraph');

      const graph = createGraph('test-company', 'Test Company');

      // Fixture with only website/digitalInfra data - exact paths from WEBSITE_LAB_MAPPINGS
      const labResultV4 = {
        siteAssessment: {
          score: 85, // → website.websiteScore
          executiveSummary: 'Excellent website with good UX', // → website.executiveSummary
          keyIssues: ['Minor accessibility issues'], // → website.conversionBlocks
          quickWins: [{ title: 'Add alt text', description: 'Images need alt text' }], // → website.quickWins
          funnelHealthScore: 75, // → website.funnelHealthScore
        },
        siteGraph: {
          pages: [
            { path: '/', type: 'home', evidenceV3: { ctas: ['Get Started'] } },
          ],
        },
        strategistViews: {
          conversion: {
            funnelBlockers: ['No clear CTA'], // → website.conversionBlocks
            opportunities: ['Add testimonials'], // → website.conversionOpportunities
          },
        },
      };

      const result = writeWebsiteLabToGraph(graph, labResultV4 as any, 'test-run', { proofMode: true });

      // Proof should be captured
      expect(result.proof).toBeDefined();

      // Key assertion: No domainAuthority blocks (website_lab is authorized for website)
      expect(result.proof?.droppedByReason.domainAuthority).toBe(0);

      // No wrongDomainForField (all data is for website domain)
      expect(result.proof?.droppedByReason.wrongDomainForField).toBe(0);

      // Should have written at least some fields (the core website fields)
      // Note: If there are errors, log them for debugging
      if (result.errors.length > 0) {
        console.log('[Test] Errors during write:', result.errors);
      }

      // We expect writes to succeed - if they don't, we should investigate errors
      expect(result.fieldsUpdated).toBeGreaterThan(0);
    });
  });
});

describe('fieldsWritten Reporting Regression', () => {
  /**
   * Regression test: Ensure fieldsUpdated and updatedPaths are correctly
   * returned from the writer and importer, not just logged.
   *
   * This test catches the bug where proveContextPromotion.ts showed
   * fieldsWritten: 0 even though WebsiteLabWriter logged "Updated 16 fields"
   */
  beforeEach(() => {
    vi.doUnmock('@/lib/contextGraph/websiteLabWriter');
    vi.resetModules();
    process.env.DEBUG_CONTEXT_PROOF = '1';
  });

  afterEach(() => {
    delete process.env.DEBUG_CONTEXT_PROOF;
  });

  it('should return fieldsUpdated > 0 and updatedPaths array from writeWebsiteLabToGraph', async () => {
    const { writeWebsiteLabToGraph } = await import('@/lib/contextGraph/websiteLabWriter');
    const { createEmptyContextGraph } = await import('@/lib/contextGraph/companyContextGraph');

    const graph = createEmptyContextGraph('test-company', 'Test Company');

    const labResultV4 = {
      siteAssessment: {
        score: 85,
        executiveSummary: 'Test website assessment',
        keyIssues: ['Issue 1', 'Issue 2'],
        quickWins: [{ title: 'Quick win 1', description: 'Description' }],
      },
      siteGraph: { pages: [] },
    };

    const result = writeWebsiteLabToGraph(graph, labResultV4 as any, 'test-run', { proofMode: true });

    // CRITICAL ASSERTIONS: These are the values that must flow through to proveContextPromotion
    expect(result.fieldsUpdated).toBeGreaterThan(0);
    expect(result.updatedPaths).toBeInstanceOf(Array);
    expect(result.updatedPaths.length).toBeGreaterThan(0);

    // Verify the paths are in the expected format
    result.updatedPaths.forEach(path => {
      expect(path).toMatch(/^(website|digitalInfra)\./);
    });

    // Verify proof data is also populated
    expect(result.proof).toBeDefined();
    expect(result.proof?.droppedByReason.domainAuthority).toBe(0);
  });

  it('should have matching fieldsUpdated count in writer result and updatedPaths length', async () => {
    const { writeWebsiteLabToGraph } = await import('@/lib/contextGraph/websiteLabWriter');
    const { createEmptyContextGraph } = await import('@/lib/contextGraph/companyContextGraph');

    const graph = createEmptyContextGraph('test-company', 'Test Company');

    const labResultV4 = {
      siteAssessment: {
        score: 75,
        executiveSummary: 'Website summary',
        funnelHealthScore: 60,
      },
      siteGraph: { pages: [] },
    };

    const result = writeWebsiteLabToGraph(graph, labResultV4 as any, 'test-run', { proofMode: true });

    // fieldsUpdated should match the length of updatedPaths
    expect(result.fieldsUpdated).toBe(result.updatedPaths.length);

    // Both should be > 0
    expect(result.fieldsUpdated).toBeGreaterThan(0);
  });
});
