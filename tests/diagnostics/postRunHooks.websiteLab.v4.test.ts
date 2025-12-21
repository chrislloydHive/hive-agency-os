// tests/diagnostics/postRunHooks.websiteLab.v4.test.ts
// Integration tests for WebsiteLab V4 proposal flow in postRunHooks
//
// Tests:
// - When CONTEXT_V4_INGEST_WEBSITELAB=1: calls proposeFromLabResult, NOT legacy writer
// - When flag off: legacy behavior remains (writer called)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock feature flags
const mockIsContextV4IngestWebsiteLabEnabled = vi.fn();
vi.mock('@/lib/types/contextField', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/types/contextField')>();
  return {
    ...actual,
    isContextV4Enabled: vi.fn(() => true),
    isContextV4IngestWebsiteLabEnabled: mockIsContextV4IngestWebsiteLabEnabled,
  };
});

// Mock V4 proposal flow
const mockProposeFromLabResult = vi.fn().mockResolvedValue({
  proposed: 5,
  blocked: 0,
  replaced: 0,
  errors: [],
  proposedKeys: ['website.websiteScore', 'website.executiveSummary'],
  blockedKeys: [],
});

const mockBuildWebsiteLabCandidates = vi.fn().mockReturnValue({
  extractionPath: 'rawEvidence.labResultV4',
  rawKeysFound: 10,
  candidates: [
    { key: 'website.websiteScore', value: 72 },
    { key: 'website.executiveSummary', value: 'Test' },
  ],
  skipped: { wrongDomain: 3, emptyValue: 2, noMapping: 0 },
  skippedWrongDomainKeys: ['brand.toneOfVoice', 'content.contentScore'],
});

vi.mock('@/lib/contextGraph/v4', () => ({
  proposeFromLabResult: mockProposeFromLabResult,
  buildWebsiteLabCandidates: mockBuildWebsiteLabCandidates,
}));

// Mock legacy writer
const mockWriteWebsiteLabAndSave = vi.fn().mockResolvedValue({
  summary: {
    fieldsUpdated: 10,
    updatedPaths: ['website.websiteScore'],
    skippedPaths: [],
    errors: [],
  },
  graph: {},
});

vi.mock('@/lib/contextGraph/websiteLabWriter', () => ({
  writeWebsiteLabAndSave: mockWriteWebsiteLabAndSave,
  WEBSITE_LAB_MAPPINGS: [],
}));

// Mock other dependencies
vi.mock('@/lib/os/diagnostics/aiInsights', () => ({
  summarizeDiagnosticRunForBrain: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/os/companies/strategySnapshot', () => ({
  refreshCompanyStrategicSnapshot: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/contextGraph/fusion', () => ({
  runFusion: vi.fn().mockResolvedValue({
    fieldsUpdated: 5,
    sourcesUsed: ['websiteLab'],
    versionId: 'v1',
  }),
}));

vi.mock('@/lib/contextGraph/brandLabWriter', () => ({
  writeBrandLabAndSave: vi.fn().mockResolvedValue({
    summary: { fieldsUpdated: 0, updatedPaths: [], errors: [] },
  }),
}));

vi.mock('@/lib/contextGraph/gapIaWriter', () => ({
  writeGapIaAndSave: vi.fn().mockResolvedValue({
    summary: { fieldsUpdated: 0, updatedPaths: [], errors: [] },
  }),
}));

vi.mock('@/lib/insights/engine', () => ({
  processCompletedDiagnostic: vi.fn().mockResolvedValue({
    insightsCreated: 0,
    insightsSkipped: 0,
    duration: 100,
  }),
}));

vi.mock('@/lib/os/diagnostics/runs', () => ({
  getLabSlugForToolId: vi.fn().mockReturnValue('website_lab'),
}));

vi.mock('@/lib/os/diagnostics/findingsExtractors', () => ({
  extractFindingsForLab: vi.fn().mockReturnValue([]),
  getWorstSeverity: vi.fn().mockReturnValue(null),
}));

vi.mock('@/lib/airtable/diagnosticDetails', () => ({
  saveDiagnosticFindings: vi.fn().mockResolvedValue([]),
  deleteUnconvertedFindingsForCompanyLab: vi.fn().mockResolvedValue(0),
}));

vi.mock('@/lib/work/workItems', () => ({
  createWorkItem: vi.fn().mockResolvedValue({ id: 'work-1' }),
}));

vi.mock('@/lib/gap/socialWorkItems', () => ({
  createSocialLocalWorkItemsFromSnapshot: vi.fn().mockReturnValue({
    suggestions: [],
    skipped: [],
    dataConfidence: 'high',
  }),
  suggestionsToCreateInputs: vi.fn().mockReturnValue([]),
}));

// ============================================================================
// Test Data
// ============================================================================

// DiagnosticRun mock with required fields
const mockWebsiteLabRun = {
  id: 'run-123',
  companyId: 'company-123',
  toolId: 'websiteLab' as const,
  status: 'complete' as const,
  score: 72,
  summary: 'WebsiteLab run complete',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  rawJson: {
    rawEvidence: {
      labResultV4: {
        siteAssessment: {
          score: 72,
          executiveSummary: 'Test summary',
        },
        siteGraph: {
          pages: [],
          edges: [],
        },
      },
    },
  },
};

// ============================================================================
// Tests
// ============================================================================

describe('postRunHooks WebsiteLab V4 Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CONTEXT_V4_ENABLED = 'true';
  });

  afterEach(() => {
    delete process.env.CONTEXT_V4_ENABLED;
    delete process.env.CONTEXT_V4_INGEST_WEBSITELAB;
  });

  describe('When V4 ingestion is ENABLED', () => {
    beforeEach(() => {
      mockIsContextV4IngestWebsiteLabEnabled.mockReturnValue(true);
    });

    it('should call proposeFromLabResult', async () => {
      const { processDiagnosticRunCompletion } = await import(
        '@/lib/os/diagnostics/postRunHooks'
      );

      await processDiagnosticRunCompletion('company-123', mockWebsiteLabRun);

      expect(mockBuildWebsiteLabCandidates).toHaveBeenCalledWith(mockWebsiteLabRun.rawJson);
      expect(mockProposeFromLabResult).toHaveBeenCalledWith({
        companyId: 'company-123',
        importerId: 'websiteLab',
        source: 'lab',
        sourceId: 'run-123',
        extractionPath: 'rawEvidence.labResultV4',
        candidates: expect.any(Array),
      });
    });

    it('should NOT call legacy writeWebsiteLabAndSave', async () => {
      const { processDiagnosticRunCompletion } = await import(
        '@/lib/os/diagnostics/postRunHooks'
      );

      await processDiagnosticRunCompletion('company-123', mockWebsiteLabRun);

      expect(mockWriteWebsiteLabAndSave).not.toHaveBeenCalled();
    });

    it('should handle empty candidates gracefully', async () => {
      mockBuildWebsiteLabCandidates.mockReturnValueOnce({
        extractionPath: 'rawEvidence.labResultV4',
        rawKeysFound: 0,
        candidates: [],
        skipped: { wrongDomain: 0, emptyValue: 0, noMapping: 0 },
        skippedWrongDomainKeys: [],
      });

      const { processDiagnosticRunCompletion } = await import(
        '@/lib/os/diagnostics/postRunHooks'
      );

      // Should not throw
      await processDiagnosticRunCompletion('company-123', mockWebsiteLabRun);

      // proposeFromLabResult should NOT be called since no candidates
      expect(mockProposeFromLabResult).not.toHaveBeenCalled();
    });
  });

  describe('When V4 ingestion is DISABLED', () => {
    beforeEach(() => {
      mockIsContextV4IngestWebsiteLabEnabled.mockReturnValue(false);
    });

    it('should call legacy writeWebsiteLabAndSave', async () => {
      const { processDiagnosticRunCompletion } = await import(
        '@/lib/os/diagnostics/postRunHooks'
      );

      await processDiagnosticRunCompletion('company-123', mockWebsiteLabRun);

      expect(mockWriteWebsiteLabAndSave).toHaveBeenCalledWith(
        'company-123',
        expect.any(Object), // WebsiteUXLabResultV4
        'run-123'
      );
    });

    it('should NOT call V4 proposal flow', async () => {
      const { processDiagnosticRunCompletion } = await import(
        '@/lib/os/diagnostics/postRunHooks'
      );

      await processDiagnosticRunCompletion('company-123', mockWebsiteLabRun);

      expect(mockBuildWebsiteLabCandidates).not.toHaveBeenCalled();
      expect(mockProposeFromLabResult).not.toHaveBeenCalled();
    });
  });

  describe('Feature Flag Behavior', () => {
    it('should respect CONTEXT_V4_INGEST_WEBSITELAB flag', async () => {
      // Enable flag
      mockIsContextV4IngestWebsiteLabEnabled.mockReturnValue(true);

      const { processDiagnosticRunCompletion } = await import(
        '@/lib/os/diagnostics/postRunHooks'
      );

      await processDiagnosticRunCompletion('company-123', mockWebsiteLabRun);

      expect(mockProposeFromLabResult).toHaveBeenCalled();
      expect(mockWriteWebsiteLabAndSave).not.toHaveBeenCalled();
    });
  });
});

describe('postRunHooks Other Tools (Non-WebsiteLab)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsContextV4IngestWebsiteLabEnabled.mockReturnValue(true);
  });

  it('should not use V4 flow for brandLab', async () => {
    const brandLabRun = {
      id: 'run-456',
      companyId: 'company-123',
      toolId: 'brandLab' as const,
      status: 'complete' as const,
      score: 80,
      summary: 'BrandLab run complete',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      rawJson: {
        positioningSummary: 'Test',
        valueProps: ['Value 1'],
      },
    };

    const { processDiagnosticRunCompletion } = await import(
      '@/lib/os/diagnostics/postRunHooks'
    );

    await processDiagnosticRunCompletion('company-123', brandLabRun);

    // V4 flow should not be called for brandLab
    expect(mockBuildWebsiteLabCandidates).not.toHaveBeenCalled();
    expect(mockProposeFromLabResult).not.toHaveBeenCalled();
  });
});
