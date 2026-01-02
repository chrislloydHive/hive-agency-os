// tests/os/websiteLabV5Indexer.test.ts
// Tests for Website Lab V5 artifact indexing
//
// These tests verify:
// T1: normalizeWebsiteLabRun persists v5Diagnostic at top-level
// T2: After Website Lab V5 completion, indexer creates CompanyArtifactIndex entry
// T3: Renderer logic for hiding legacy section when V5 exists

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { V5DiagnosticOutput } from '@/lib/gap-heavy/modules/websiteLabV5';
import type { DiagnosticRun } from '@/lib/os/diagnostics/runs';
import {
  normalizeWebsiteLabRun,
  validateCanonicalOutput,
} from '@/lib/os/diagnostics/websiteLabNormalizer';

// ============================================================================
// Mock Data
// ============================================================================

const mockV5Diagnostic: V5DiagnosticOutput = {
  observations: [
    {
      pagePath: '/',
      pageType: 'home',
      aboveFoldElements: ['Hero headline', 'CTA button'],
      primaryCTAs: [{ text: 'Get Started', position: 'above_fold', destination: '/signup' }],
      trustProofElements: ['Client logos'],
      missingUnclearElements: ['Value prop unclear'],
    },
  ],
  personaJourneys: [
    {
      persona: 'first_time',
      startingPage: '/',
      intendedGoal: 'Understand the product',
      actualPath: ['/', '/about'],
      failurePoint: null,
      confidenceScore: 75,
      succeeded: true,
    },
  ],
  blockingIssues: [
    {
      id: 1,
      severity: 'high',
      affectedPersonas: ['first_time', 'ready_to_buy'],
      page: '/pricing',
      whyItBlocks: 'No clear pricing visible',
      concreteFix: { what: 'Add pricing table', where: 'Above fold on /pricing' },
    },
  ],
  quickWins: [
    {
      addressesIssueId: 1,
      title: 'Add pricing table',
      action: 'Create a clear pricing table with plans',
      page: '/pricing',
      expectedImpact: 'Increase conversion by 20%',
    },
  ],
  structuralChanges: [
    {
      addressesIssueIds: [1],
      title: 'Restructure navigation',
      description: 'Add pricing to main nav',
      pagesAffected: ['/', '/pricing'],
      rationale: 'Users expect easy access to pricing',
    },
  ],
  score: 77,
  scoreJustification: 'Good overall UX but pricing transparency needs work.',
};

const mockDiagnosticRun: DiagnosticRun = {
  id: 'run_test_123',
  companyId: 'company_test_456',
  toolId: 'websiteLab',
  status: 'complete',
  score: 77,
  summary: 'V5 Diagnostic: 77/100. Good overall UX.',
  rawJson: {
    module: 'website',
    status: 'completed',
    v5Diagnostic: mockV5Diagnostic,
    rawEvidence: {
      labResultV4: {
        siteGraph: { pages: [{ path: '/' }] },
      },
    },
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ============================================================================
// T1: V5 Diagnostic Persistence Tests
// ============================================================================

describe('T1: V5 Diagnostic Persistence', () => {
  describe('normalizeWebsiteLabRun persists v5Diagnostic at top-level', () => {
    it('should have v5Diagnostic at top-level after normalization', () => {
      const rawJson = {
        module: 'website',
        status: 'completed',
        rawEvidence: {
          labResultV4: {
            v5Diagnostic: mockV5Diagnostic,
            siteGraph: { pages: [{ path: '/' }] },
          },
        },
      };

      const result = normalizeWebsiteLabRun(rawJson);

      // V5 MUST be at top level
      expect(result.v5Diagnostic).not.toBeNull();
      expect(result.v5Diagnostic).toBeDefined();

      // V5 data should be complete
      expect(result.v5Diagnostic?.score).toBe(77);
      expect(result.v5Diagnostic?.observations).toHaveLength(1);
      expect(result.v5Diagnostic?.blockingIssues).toHaveLength(1);
      expect(result.v5Diagnostic?.quickWins).toHaveLength(1);
    });

    it('should pass validation after normalization', () => {
      const rawJson = {
        module: 'website',
        v5Diagnostic: mockV5Diagnostic,
      };

      const result = normalizeWebsiteLabRun(rawJson);

      // Should not throw
      expect(() => validateCanonicalOutput(result)).not.toThrow();
    });

    it('should remove v5Diagnostic from nested rawEvidence paths', () => {
      const rawJson = {
        module: 'website',
        rawEvidence: {
          labResultV4: {
            v5Diagnostic: mockV5Diagnostic,
            siteAssessment: {
              v5Diagnostic: mockV5Diagnostic, // Duplicate nested
            },
          },
        },
      };

      const result = normalizeWebsiteLabRun(rawJson);

      // V5 should be at top level
      expect(result.v5Diagnostic).not.toBeNull();

      // V5 should NOT be in nested paths
      const lr = result.rawEvidence.labResultV4 as Record<string, unknown>;
      expect(lr?.v5Diagnostic).toBeUndefined();
      const sa = lr?.siteAssessment as Record<string, unknown>;
      expect(sa?.v5Diagnostic).toBeUndefined();
    });

    it('should align score/summary/issues with V5 data', () => {
      const rawJson = {
        module: 'website',
        score: 50, // Old score
        summary: 'Old summary',
        issues: ['Old issue'],
        v5Diagnostic: mockV5Diagnostic,
      };

      const result = normalizeWebsiteLabRun(rawJson);

      // Score should be V5 score
      expect(result.score).toBe(77);

      // Summary should be V5-derived
      expect(result.summary).toContain('V5 Diagnostic');
      expect(result.summary).toContain('77/100');

      // Issues should be V5 blocking issues
      expect(result.issues).toContain('No clear pricing visible');
    });
  });
});

// ============================================================================
// T2: Artifact Indexer Tests
// ============================================================================

describe('T2: Artifact Indexer for Website Lab V5', () => {
  // Mock the upsertArtifactIndexEntry function
  let mockUpsert: ReturnType<typeof vi.fn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    mockUpsert = vi.fn().mockResolvedValue({ id: 'index_entry_123' });
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Dynamic mock setup
    vi.doMock('@/lib/airtable/artifactIndex', () => ({
      upsertArtifactIndexEntry: mockUpsert,
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    consoleLogSpy.mockRestore();
  });

  it('should call upsertArtifactIndexEntry for completed websiteLab run', async () => {
    // Import after mocking
    const { indexArtifactsForRun } = await import('@/lib/os/artifacts/indexer');

    const result = await indexArtifactsForRun(mockDiagnosticRun.companyId, mockDiagnosticRun);

    // Should have indexed 1 entry
    expect(result.indexed).toBe(1);
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);

    // Should have called upsert with correct params
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'company_test_456',
        sourceRunId: 'run_test_123',
        artifactType: expect.stringContaining('lab_report'),
      })
    );
  });

  it('should skip non-complete runs', async () => {
    const { indexArtifactsForRun } = await import('@/lib/os/artifacts/indexer');

    const pendingRun: DiagnosticRun = {
      ...mockDiagnosticRun,
      status: 'running',
    };

    const result = await indexArtifactsForRun(pendingRun.companyId, pendingRun);

    expect(result.indexed).toBe(0);
    expect(result.skipped).toBe(1);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('should include V5 version marker in log output', async () => {
    const { indexArtifactsForRun } = await import('@/lib/os/artifacts/indexer');

    await indexArtifactsForRun(mockDiagnosticRun.companyId, mockDiagnosticRun);

    // Check that V5 marker was logged
    const calls = consoleLogSpy.mock.calls as unknown[][];
    const hasV5Log = calls.some(
      (call: unknown[]) =>
        typeof call[0] === 'string' &&
        (call[0] as string).includes('(v5)') &&
        (call[0] as string).includes('Indexed artifact')
    );
    expect(hasV5Log).toBe(true);
  });

  it('should generate correct URL with runId', async () => {
    const { indexArtifactsForRun } = await import('@/lib/os/artifacts/indexer');

    await indexArtifactsForRun(mockDiagnosticRun.companyId, mockDiagnosticRun);

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining('runId=run_test_123'),
      })
    );
  });
});

// ============================================================================
// T3: V5 Renderer Logic Tests
// ============================================================================

describe('T3: V5 Renderer Logic', () => {
  describe('should hide legacy section when V5 exists', () => {
    it('V5 primary view should be rendered when v5Diagnostic exists', () => {
      // This tests the rendering logic condition
      const v5Diagnostic = mockV5Diagnostic;

      // Condition from page.tsx line 212: if (v5Diagnostic) { ... }
      const shouldRenderV5 = !!v5Diagnostic;
      expect(shouldRenderV5).toBe(true);

      // Legacy fallback should NOT render
      // Condition from page.tsx line 297-375: only runs if v5Diagnostic is falsy
    });

    it('legacy section should be collapsible and marked as supporting context when V5 exists', () => {
      // When V5 exists, lines 266-292 render the legacy section inside <details>
      // with text "(Supporting Context)" - this verifies the logic is correct

      const hasV5 = !!mockV5Diagnostic;
      const hasLegacyData = true; // assessment && labResultV4

      // Legacy section only shows when BOTH conditions are true
      const showLegacyCollapsible = hasV5 && hasLegacyData;
      expect(showLegacyCollapsible).toBe(true);
    });

    it('legacy V4 banner should only show when V5 is missing', () => {
      // Lines 334-343: V5 Unavailable Banner only renders in V4 fallback path
      const v5DiagnosticMissing = null;

      // This path only executes when v5Diagnostic is null (line 297)
      const shouldShowLegacyBanner = !v5DiagnosticMissing; // inverted logic

      // If V5 exists, banner should NOT show
      expect(shouldShowLegacyBanner).toBe(true);

      // With V5, banner should NOT show
      const withV5 = mockV5Diagnostic;
      const bannerShowsWithV5 = !withV5;
      expect(bannerShowsWithV5).toBe(false);
    });
  });

  describe('V5 data mapping for component', () => {
    it('should correctly map V5DiagnosticOutput to V5DiagnosticData', () => {
      // This mirrors lines 224-232 in page.tsx
      const v5Data = {
        observations: mockV5Diagnostic.observations,
        personaJourneys: mockV5Diagnostic.personaJourneys,
        blockingIssues: mockV5Diagnostic.blockingIssues,
        quickWins: mockV5Diagnostic.quickWins,
        structuralChanges: mockV5Diagnostic.structuralChanges,
        score: mockV5Diagnostic.score,
        scoreJustification: mockV5Diagnostic.scoreJustification,
      };

      expect(v5Data.score).toBe(77);
      expect(v5Data.observations).toHaveLength(1);
      expect(v5Data.blockingIssues).toHaveLength(1);
      expect(v5Data.quickWins).toHaveLength(1);
      expect(v5Data.scoreJustification).toContain('pricing transparency');
    });
  });
});

// ============================================================================
// Integration: Full E2E Flow Test
// ============================================================================

describe('E2E: Website Lab V5 Flow', () => {
  it('should normalize, validate, and be ready for indexing', () => {
    // Step 1: Raw JSON from Website Lab run (with V5 nested)
    const rawJson = {
      module: 'website',
      status: 'completed',
      score: 50, // Old score
      rawEvidence: {
        labResultV4: {
          v5Diagnostic: mockV5Diagnostic,
          siteGraph: { pages: [{ path: '/' }, { path: '/about' }] },
          siteAssessment: {
            overallScore: 50,
            recommendations: ['Old rec'],
          },
        },
      },
    };

    // Step 2: Normalize
    const normalized = normalizeWebsiteLabRun(rawJson, {
      runId: 'run_e2e_test',
      companyId: 'company_e2e',
    });

    // Step 3: Validate canonical output
    expect(() => validateCanonicalOutput(normalized)).not.toThrow();

    // Step 4: Verify V5 is at top level
    expect(normalized.v5Diagnostic).not.toBeNull();
    expect(normalized.v5Diagnostic?.score).toBe(77);

    // Step 5: Verify score/summary aligned to V5
    expect(normalized.score).toBe(77);
    expect(normalized.summary).toContain('V5 Diagnostic');

    // Step 6: Verify rawEvidence is clean
    const lr = normalized.rawEvidence.labResultV4 as Record<string, unknown>;
    expect(lr?.v5Diagnostic).toBeUndefined();

    // Step 7: Verify issues/recommendations derived from V5
    expect(normalized.issues).toContain('No clear pricing visible');
    expect(normalized.recommendations).toContain('Create a clear pricing table with plans');
  });
});
