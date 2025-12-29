// tests/context/brandLabImporter.test.ts
// Brand Lab Importer Tests
//
// Tests the Brand Lab importer functionality including:
// - Importer registration and structure
// - Table priority (DIAGNOSTIC_RUNS first)
// - Extraction path (rawEvidence.labResultV4)
// - Proof data population

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { brandLabImporter } from '@/lib/contextGraph/importers/brandLabImporter';
import { createEmptyContextGraph } from '@/lib/contextGraph/companyContextGraph';
import { makeDiagnosticRun, makeHeavyGapRunState, makeEvidencePack } from '@/tests/helpers/contextFactories';

// Mock the Airtable layer calls
vi.mock('@/lib/os/diagnostics/runs', () => ({
  listDiagnosticRunsForCompany: vi.fn(),
}));

vi.mock('@/lib/airtable/gapHeavyRuns', () => ({
  getHeavyGapRunsByCompanyId: vi.fn(),
}));

describe('Brand Lab Importer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.DEBUG_CONTEXT_PROOF;
  });

  describe('Importer Structure', () => {
    it('should have correct id and label', () => {
      expect(brandLabImporter.id).toBe('brandLab');
      expect(brandLabImporter.label).toBe('Brand Lab');
    });

    it('should implement DomainImporter interface', () => {
      expect(typeof brandLabImporter.supports).toBe('function');
      expect(typeof brandLabImporter.importAll).toBe('function');
    });
  });

  describe('Table Priority: DIAGNOSTIC_RUNS First', () => {
    it('should check DIAGNOSTIC_RUNS before GAP_HEAVY_RUNS in supports()', async () => {
      const { listDiagnosticRunsForCompany } = await import('@/lib/os/diagnostics/runs');
      const { getHeavyGapRunsByCompanyId } = await import('@/lib/airtable/gapHeavyRuns');

      // Setup: DIAGNOSTIC_RUNS has data
      vi.mocked(listDiagnosticRunsForCompany).mockResolvedValue([
        makeDiagnosticRun({
          id: 'diag-run-123',
          companyId: 'test-company',
          toolId: 'brandLab',
          status: 'complete',
          rawJson: { rawEvidence: { labResultV4: { positioning: 'Test positioning' } } },
        }),
      ]);

      // GAP_HEAVY_RUNS also has data (should not be called)
      vi.mocked(getHeavyGapRunsByCompanyId).mockResolvedValue([
        makeHeavyGapRunState({
          id: 'heavy-run-456',
          status: 'completed',
          evidencePack: makeEvidencePack({ brandLab: { positioning: 'Heavy positioning' } }),
        }),
      ]);

      const result = await brandLabImporter.supports('test-company', 'brand');

      // Should return true (found in DIAGNOSTIC_RUNS)
      expect(result).toBe(true);

      // Verify DIAGNOSTIC_RUNS was checked
      expect(listDiagnosticRunsForCompany).toHaveBeenCalledWith('test-company', {
        toolId: 'brandLab',
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
        makeHeavyGapRunState({
          id: 'heavy-run-456',
          status: 'completed',
          evidencePack: makeEvidencePack({ brandLab: { positioning: 'Heavy positioning' } }),
        }),
      ]);

      const result = await brandLabImporter.supports('test-company', 'brand');

      // Should return true (found in GAP_HEAVY_RUNS fallback)
      expect(result).toBe(true);

      // Both should have been called
      expect(listDiagnosticRunsForCompany).toHaveBeenCalled();
      expect(getHeavyGapRunsByCompanyId).toHaveBeenCalled();
    });
  });

  describe('Extraction Path: rawEvidence.labResultV4', () => {
    it('should extract from rawEvidence.labResultV4 (new format)', async () => {
      const { listDiagnosticRunsForCompany } = await import('@/lib/os/diagnostics/runs');

      const mockLabResult = {
        positioning: 'Premium B2B solution',
        differentiators: ['AI-powered', 'Enterprise-grade'],
        strengths: ['Strong brand recognition'],
        toneOfVoice: 'Professional and approachable',
      };

      // New format: rawEvidence.labResultV4
      vi.mocked(listDiagnosticRunsForCompany).mockResolvedValue([
        makeDiagnosticRun({
          id: 'new-format-run',
          companyId: 'test-company',
          toolId: 'brandLab',
          status: 'complete',
          rawJson: {
            rawEvidence: {
              labResultV4: mockLabResult,
            },
          },
        }),
      ]);

      const graph = createEmptyContextGraph('test-company', 'Test Company');
      const result = await brandLabImporter.importAll(graph, 'test-company', 'brand');

      // Should succeed
      expect(result.success).toBe(true);
      expect(result.fieldsUpdated).toBeGreaterThan(0);
      expect(result.sourceRunIds).toContain('new-format-run');
    });
  });

  // =========================================================================
  // Proof Data Population Regression
  // =========================================================================

  describe('Proof Data Population', () => {
    it('should populate extractionPath in proof mode', async () => {
      const { listDiagnosticRunsForCompany } = await import('@/lib/os/diagnostics/runs');
      const { getHeavyGapRunsByCompanyId } = await import('@/lib/airtable/gapHeavyRuns');

      process.env.DEBUG_CONTEXT_PROOF = '1';

      vi.mocked(listDiagnosticRunsForCompany).mockResolvedValue([
        makeDiagnosticRun({
          id: 'proof-test-run',
          companyId: 'test-company',
          toolId: 'brandLab',
          status: 'complete',
          rawJson: {
            rawEvidence: {
              labResultV4: {
                positioning: 'Test positioning',
                differentiators: ['Unique'],
              },
            },
          },
        }),
      ]);

      // Prevent fallback to GAP Heavy
      vi.mocked(getHeavyGapRunsByCompanyId).mockResolvedValue([]);

      const graph = createEmptyContextGraph('test-company', 'Test Company');
      const result = await brandLabImporter.importAll(graph, 'test-company', 'brand');

      // Proof should be populated with either Diagnostic Runs or GAP Heavy path
      expect(result.proof).toBeDefined();
      expect(result.proof?.extractionPath).toMatch(/^(DIAGNOSTIC_RUNS:|GAP_HEAVY_RUNS:)/);
    });

    it('should count raw keys from labResultV4 data', async () => {
      const { listDiagnosticRunsForCompany } = await import('@/lib/os/diagnostics/runs');

      process.env.DEBUG_CONTEXT_PROOF = '1';

      const mockLabResult = {
        positioning: 'Test',
        differentiators: ['A', 'B'],
        strengths: ['C'],
        weaknesses: ['D'],
        toneOfVoice: 'Friendly',
        competitivePosition: 'Leader',
        tagline: 'Test tagline',
        brandPersonality: 'Innovative',
      };

      vi.mocked(listDiagnosticRunsForCompany).mockResolvedValue([
        makeDiagnosticRun({
          id: 'keys-test-run',
          companyId: 'test-company',
          toolId: 'brandLab',
          status: 'complete',
          rawJson: {
            rawEvidence: {
              labResultV4: mockLabResult,
            },
          },
        }),
      ]);

      const graph = createEmptyContextGraph('test-company', 'Test Company');
      const result = await brandLabImporter.importAll(graph, 'test-company', 'brand');

      // Proof should have rawKeysFound > 0
      expect(result.proof?.rawKeysFound).toBeGreaterThan(0);
    });

    it('should populate persistedWrites from updatedPaths', async () => {
      const { listDiagnosticRunsForCompany } = await import('@/lib/os/diagnostics/runs');

      process.env.DEBUG_CONTEXT_PROOF = '1';

      vi.mocked(listDiagnosticRunsForCompany).mockResolvedValue([
        makeDiagnosticRun({
          id: 'writes-test-run',
          companyId: 'test-company',
          toolId: 'brandLab',
          status: 'complete',
          rawJson: {
            rawEvidence: {
              labResultV4: {
                positioning: 'Test positioning',
              },
            },
          },
        }),
      ]);

      const graph = createEmptyContextGraph('test-company', 'Test Company');
      const result = await brandLabImporter.importAll(graph, 'test-company', 'brand');

      // persistedWrites should match updatedPaths
      expect(result.proof?.persistedWrites).toBeDefined();
      expect(result.proof?.persistedWrites).toEqual(result.updatedPaths);
    });

    it('should initialize proof structure with all required fields', async () => {
      const { listDiagnosticRunsForCompany } = await import('@/lib/os/diagnostics/runs');

      process.env.DEBUG_CONTEXT_PROOF = '1';

      vi.mocked(listDiagnosticRunsForCompany).mockResolvedValue([
        makeDiagnosticRun({
          id: 'structure-test-run',
          companyId: 'test-company',
          toolId: 'brandLab',
          status: 'complete',
          rawJson: {
            rawEvidence: {
              labResultV4: {
                positioning: 'Test',
              },
            },
          },
        }),
      ]);

      const graph = createEmptyContextGraph('test-company', 'Test Company');
      const result = await brandLabImporter.importAll(graph, 'test-company', 'brand');

      // Verify proof structure has all required fields
      expect(result.proof?.extractionPath).toBeDefined();
      expect(result.proof?.rawKeysFound).toBeDefined();
      expect(result.proof?.candidateWrites).toBeDefined();
      expect(result.proof?.droppedByReason).toBeDefined();
      expect(result.proof?.persistedWrites).toBeDefined();

      // Verify droppedByReason has all skip reason types
      expect(result.proof?.droppedByReason.emptyValue).toBeDefined();
      expect(result.proof?.droppedByReason.domainAuthority).toBeDefined();
      expect(result.proof?.droppedByReason.wrongDomainForField).toBeDefined();
      expect(result.proof?.droppedByReason.sourcePriority).toBeDefined();
      expect(result.proof?.droppedByReason.humanConfirmed).toBeDefined();
    });
  });

  // =========================================================================
  // fieldsWritten Reporting Regression
  // =========================================================================

  describe('fieldsWritten Reporting Regression', () => {
    it('should return fieldsUpdated > 0 and updatedPaths array', async () => {
      const { listDiagnosticRunsForCompany } = await import('@/lib/os/diagnostics/runs');
      const { getHeavyGapRunsByCompanyId } = await import('@/lib/airtable/gapHeavyRuns');

      process.env.DEBUG_CONTEXT_PROOF = '1';

      vi.mocked(listDiagnosticRunsForCompany).mockResolvedValue([
        makeDiagnosticRun({
          id: 'fields-test-run',
          companyId: 'test-company',
          toolId: 'brandLab',
          status: 'complete',
          rawJson: {
            rawEvidence: {
              labResultV4: {
                positioning: 'Strong market positioning',
                differentiators: ['AI-powered', 'Enterprise'],
                toneOfVoice: 'Professional',
              },
            },
          },
        }),
      ]);

      // Mock GAP Heavy with data so importer has data to work with
      vi.mocked(getHeavyGapRunsByCompanyId).mockResolvedValue([
        makeHeavyGapRunState({
          id: 'heavy-run-456',
          status: 'completed',
          evidencePack: makeEvidencePack({
            brandLab: {
              positioning: 'Heavy positioning',
              differentiators: ['Unique'],
            },
          }),
        }),
      ]);

      const graph = createEmptyContextGraph('test-company', 'Test Company');
      const result = await brandLabImporter.importAll(graph, 'test-company', 'brand');

      // CRITICAL: These values must flow through to proveContextPromotion
      expect(result.fieldsUpdated).toBeGreaterThan(0);
      expect(result.updatedPaths).toBeInstanceOf(Array);
      expect(result.updatedPaths.length).toBeGreaterThan(0);

      // Paths should be in brand domain
      result.updatedPaths.forEach(path => {
        expect(path).toMatch(/^(brand|audience)\./);
      });
    });

    it('should have matching fieldsUpdated count and updatedPaths length', async () => {
      const { listDiagnosticRunsForCompany } = await import('@/lib/os/diagnostics/runs');
      const { getHeavyGapRunsByCompanyId } = await import('@/lib/airtable/gapHeavyRuns');

      process.env.DEBUG_CONTEXT_PROOF = '1';

      vi.mocked(listDiagnosticRunsForCompany).mockResolvedValue([
        makeDiagnosticRun({
          id: 'match-test-run',
          companyId: 'test-company',
          toolId: 'brandLab',
          status: 'complete',
          rawJson: {
            rawEvidence: {
              labResultV4: {
                positioning: 'Market leader',
                tagline: 'Test tagline',
              },
            },
          },
        }),
      ]);

      // Mock GAP Heavy with data so importer has data to work with
      vi.mocked(getHeavyGapRunsByCompanyId).mockResolvedValue([
        makeHeavyGapRunState({
          id: 'heavy-run-789',
          status: 'completed',
          evidencePack: makeEvidencePack({
            brandLab: {
              positioning: 'Heavy positioning',
            },
          }),
        }),
      ]);

      const graph = createEmptyContextGraph('test-company', 'Test Company');
      const result = await brandLabImporter.importAll(graph, 'test-company', 'brand');

      // fieldsUpdated should match updatedPaths length
      expect(result.fieldsUpdated).toBe(result.updatedPaths.length);
      expect(result.fieldsUpdated).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Integration: Registry
  // =========================================================================

  describe('Integration: Registry', () => {
    it('should be registered in importer registry', async () => {
      const { getEnabledImporters, getImporterById } = await import(
        '@/lib/contextGraph/importers/registry'
      );

      const importer = getImporterById('brandLab');
      expect(importer).toBeDefined();
      expect(importer?.id).toBe('brandLab');

      // Verify it's in the enabled importers list
      const enabledImporters = getEnabledImporters();
      const brandLabInList = enabledImporters.find((i) => i.id === 'brandLab');
      expect(brandLabInList).toBeDefined();
    });
  });
});
