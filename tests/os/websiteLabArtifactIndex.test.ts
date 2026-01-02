// tests/os/websiteLabArtifactIndex.test.ts
// Tests for Website Lab artifact creation and indexing
//
// These tests verify:
// 1. postRunHooks creates CompanyArtifactIndex for Website Lab
// 2. Artifact type is lab_report_website (canonical)
// 3. Artifact URL is the canonical report route

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { indexArtifactsForRun } from '@/lib/os/artifacts/indexer';
import { getPrimaryRunViewHref } from '@/lib/os/diagnostics/navigation';
import { ArtifactType, ArtifactPhase, ArtifactSource } from '@/lib/types/artifactTaxonomy';
import type { DiagnosticRun } from '@/lib/os/diagnostics/runs';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock the Airtable module - use the correct function name
vi.mock('@/lib/airtable/artifactIndex', () => ({
  upsertArtifactIndexEntry: vi.fn().mockResolvedValue({
    id: 'idx_mock_123',
    companyId: 'company_123',
    title: 'Website Lab Report (V5)',
    artifactType: 'lab_report_website',
    phase: 'Discover',
    source: 'diagnostic_website_lab',
    storage: 'internal',
    groupKey: 'diagnostic-run_456',
    url: '/c/company_123/diagnostics/website?runId=run_456',
    status: 'final',
    primary: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  }),
}));

// ============================================================================
// Test Data
// ============================================================================

const mockV5Diagnostic = {
  observations: [],
  personaJourneys: [],
  blockingIssues: [
    {
      id: 1,
      severity: 'high',
      affectedPersonas: ['first_time'],
      page: '/',
      whyItBlocks: 'Test issue',
      concreteFix: { what: 'Fix it', where: 'Homepage' },
    },
  ],
  quickWins: [],
  structuralChanges: [],
  score: 77,
  scoreJustification: 'Test score',
};

const mockWebsiteLabRun: DiagnosticRun = {
  id: 'run_456',
  companyId: 'company_123',
  toolId: 'websiteLab',
  status: 'complete',
  score: 77,
  summary: 'Website Lab V5 analysis complete',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  rawJson: {
    module: 'website',
    status: 'completed',
    v5Diagnostic: mockV5Diagnostic,
    rawEvidence: {
      labResultV4: {
        siteGraph: { pages: [{ path: '/', type: 'home' }] },
      },
    },
  },
};

// ============================================================================
// Tests
// ============================================================================

describe('Website Lab Artifact Indexing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('indexArtifactsForRun', () => {
    it('should create at least one CompanyArtifactIndex record for a completed Website Lab run', async () => {
      const { upsertArtifactIndexEntry } = await import('@/lib/airtable/artifactIndex');

      const result = await indexArtifactsForRun('company_123', mockWebsiteLabRun);

      expect(result.ok).toBe(true);
      expect(result.indexed).toBeGreaterThanOrEqual(1);
      expect(upsertArtifactIndexEntry).toHaveBeenCalled();
    });

    it('should use canonical artifact type lab_report_website', async () => {
      const { upsertArtifactIndexEntry } = await import('@/lib/airtable/artifactIndex');

      await indexArtifactsForRun('company_123', mockWebsiteLabRun);

      expect(upsertArtifactIndexEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          artifactType: ArtifactType.LabReportWebsite,
        })
      );
    });

    it('should use canonical URL from getPrimaryRunViewHref', async () => {
      const { upsertArtifactIndexEntry } = await import('@/lib/airtable/artifactIndex');

      await indexArtifactsForRun('company_123', mockWebsiteLabRun);

      const expectedUrl = getPrimaryRunViewHref({
        companyId: 'company_123',
        toolId: 'websiteLab',
        runId: 'run_456',
      });

      expect(upsertArtifactIndexEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expectedUrl,
        })
      );
    });

    it('should set phase to Discover for lab reports', async () => {
      const { upsertArtifactIndexEntry } = await import('@/lib/airtable/artifactIndex');

      await indexArtifactsForRun('company_123', mockWebsiteLabRun);

      expect(upsertArtifactIndexEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: ArtifactPhase.Discover,
        })
      );
    });

    it('should set source to DiagnosticWebsiteLab', async () => {
      const { upsertArtifactIndexEntry } = await import('@/lib/airtable/artifactIndex');

      await indexArtifactsForRun('company_123', mockWebsiteLabRun);

      expect(upsertArtifactIndexEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          source: ArtifactSource.DiagnosticWebsiteLab,
        })
      );
    });

    it('should not index incomplete runs', async () => {
      const { upsertArtifactIndexEntry } = await import('@/lib/airtable/artifactIndex');

      const incompleteRun: DiagnosticRun = {
        ...mockWebsiteLabRun,
        status: 'running',
      };

      const result = await indexArtifactsForRun('company_123', incompleteRun);

      expect(result.ok).toBe(true);
      expect(result.skipped).toBe(1);
      expect(upsertArtifactIndexEntry).not.toHaveBeenCalled();
    });
  });
});

describe('getPrimaryRunViewHref for Website Lab', () => {
  it('should return canonical URL with runId query param', () => {
    const href = getPrimaryRunViewHref({
      companyId: 'company_123',
      toolId: 'websiteLab',
      runId: 'run_456',
    });

    expect(href).toBe('/c/company_123/diagnostics/website?runId=run_456');
  });

  it('should normalize "website" alias to canonical route', () => {
    const href = getPrimaryRunViewHref({
      companyId: 'company_123',
      toolId: 'website',
      runId: 'run_456',
    });

    expect(href).toBe('/c/company_123/diagnostics/website?runId=run_456');
  });

  it('should normalize "website-lab" alias to canonical route', () => {
    const href = getPrimaryRunViewHref({
      companyId: 'company_123',
      toolId: 'website-lab',
      runId: 'run_456',
    });

    expect(href).toBe('/c/company_123/diagnostics/website?runId=run_456');
  });

  it('should normalize "websiteLabV5" alias to canonical route', () => {
    const href = getPrimaryRunViewHref({
      companyId: 'company_123',
      toolId: 'websiteLabV5',
      runId: 'run_456',
    });

    expect(href).toBe('/c/company_123/diagnostics/website?runId=run_456');
  });

  it('should return hub URL when no runId provided', () => {
    const href = getPrimaryRunViewHref({
      companyId: 'company_123',
      toolId: 'websiteLab',
    });

    expect(href).toBe('/c/company_123/diagnostics/website');
  });
});
