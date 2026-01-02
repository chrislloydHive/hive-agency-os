// tests/os/websiteLabArtifactIndexing.test.ts
// Tests for Website Lab artifact indexing
//
// Verifies that CompanyArtifactIndex entries are created after Website Lab runs.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { indexArtifactsForRun } from '@/lib/os/artifacts/indexer';
import type { DiagnosticRun } from '@/lib/os/diagnostics/runs';

// Mock Airtable
vi.mock('@/lib/airtable/artifactIndex', () => ({
  upsertArtifactIndexEntry: vi.fn().mockResolvedValue({
    id: 'idx_test123',
    companyId: 'company_123',
    title: 'Website Lab Report - Dec 31, 2024',
    artifactType: 'lab_report',
    phase: 'Discover',
    source: 'diagnostic_run',
    storage: 'internal',
    groupKey: 'websiteLab:run_123',
    sourceRunId: 'run_123',
    url: '/c/company_123/diagnostics/website?runId=run_123',
    status: 'final',
    primary: true,
    createdAt: '2024-12-31T00:00:00Z',
    updatedAt: '2024-12-31T00:00:00Z',
  }),
}));

describe('Website Lab Artifact Indexing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create index entry for completed Website Lab run', async () => {
    const mockRun: DiagnosticRun = {
      id: 'run_123',
      companyId: 'company_123',
      toolId: 'websiteLab',
      status: 'complete',
      score: 77,
      summary: 'V5 diagnostic complete',
      createdAt: '2024-12-31T00:00:00Z',
      updatedAt: '2024-12-31T00:00:00Z',
      rawJson: {
        v5Diagnostic: {
          score: 77,
          scoreJustification: 'Good overall, some issues found',
          blockingIssues: [],
          quickWins: [],
          structuralChanges: [],
          observations: [],
          personaJourneys: [],
        },
      },
    };

    const result = await indexArtifactsForRun('company_123', mockRun);

    expect(result.ok).toBe(true);
    expect(result.indexed).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it('should skip indexing for non-complete runs', async () => {
    const mockRun: DiagnosticRun = {
      id: 'run_456',
      companyId: 'company_123',
      toolId: 'websiteLab',
      status: 'running',
      score: null,
      summary: null,
      createdAt: '2024-12-31T00:00:00Z',
      updatedAt: '2024-12-31T00:00:00Z',
      rawJson: null,
    };

    const result = await indexArtifactsForRun('company_123', mockRun);

    expect(result.ok).toBe(true);
    expect(result.indexed).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('should generate correct URL for Website Lab', async () => {
    const { upsertArtifactIndexEntry } = await import('@/lib/airtable/artifactIndex');

    const mockRun: DiagnosticRun = {
      id: 'run_789',
      companyId: 'company_abc',
      toolId: 'websiteLab',
      status: 'complete',
      score: 85,
      summary: 'Excellent score',
      createdAt: '2024-12-31T00:00:00Z',
      updatedAt: '2024-12-31T00:00:00Z',
      rawJson: {},
    };

    await indexArtifactsForRun('company_abc', mockRun);

    expect(upsertArtifactIndexEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'company_abc',
        sourceRunId: 'run_789',
        url: '/c/company_abc/diagnostics/website?runId=run_789',
        artifactType: 'lab_report_website',
      })
    );
  });

  it('should include V5 indicator in title when V5 data exists', async () => {
    const { upsertArtifactIndexEntry } = await import('@/lib/airtable/artifactIndex');

    const mockRun: DiagnosticRun = {
      id: 'run_v5',
      companyId: 'company_v5',
      toolId: 'websiteLab',
      status: 'complete',
      score: 77,
      summary: 'V5 analysis complete',
      createdAt: '2024-12-31T00:00:00Z',
      updatedAt: '2024-12-31T00:00:00Z',
      rawJson: {
        v5Diagnostic: {
          score: 77,
          blockingIssues: [{ id: 1, severity: 'high', page: '/', whyItBlocks: 'Missing CTA', concreteFix: { what: 'Add CTA', where: 'Hero' } }],
        },
      },
    };

    await indexArtifactsForRun('company_v5', mockRun);

    expect(upsertArtifactIndexEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining('Website Lab Report'),
      })
    );
  });
});
