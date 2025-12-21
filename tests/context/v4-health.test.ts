// tests/context/v4-health.test.ts
// Context V4 Health Endpoint Tests
//
// Tests the health status computation logic:
// - RED when flags disabled or store unavailable
// - YELLOW when WebsiteLab run missing or stale
// - GREEN when all systems operational

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// In-memory stores for tests
let mockV4Store: Record<string, unknown> = {};
let mockDiagnosticRuns: Record<string, unknown>[] = [];
let mockFeatureFlags = {
  CONTEXT_V4_ENABLED: true,
  CONTEXT_V4_INGEST_WEBSITELAB: true,
};

// Mock Airtable
vi.mock('@/lib/airtable', () => ({
  getBase: vi.fn(() => {
    return (tableName: string) => ({
      select: vi.fn(() => ({
        firstPage: vi.fn().mockImplementation(async () => {
          if (tableName === 'ContextFieldsV4') {
            if (Object.keys(mockV4Store).length === 0) {
              return [];
            }
            return [{
              id: 'rec-v4-store',
              fields: {
                'Company ID': 'test-company-123',
                'Fields JSON': JSON.stringify(mockV4Store),
              },
            }];
          }
          if (tableName === 'Diagnostic Runs') {
            return mockDiagnosticRuns.map((run, i) => ({
              id: `rec-diag-${i}`,
              fields: run,
            }));
          }
          return [];
        }),
      })),
      create: vi.fn().mockImplementation(async (records) => {
        if (tableName === 'ContextFieldsV4') {
          const data = records[0].fields;
          if (data['Fields JSON']) {
            mockV4Store = JSON.parse(data['Fields JSON']);
          }
        }
        return [{ id: 'rec-created' }];
      }),
      update: vi.fn().mockImplementation(async (recordId, fields) => {
        if (tableName === 'ContextFieldsV4' && fields['Fields JSON']) {
          mockV4Store = JSON.parse(fields['Fields JSON']);
        }
        return { id: recordId };
      }),
    });
  }),
}));

// Mock feature flags
vi.mock('@/lib/types/contextField', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/types/contextField')>();
  return {
    ...actual,
    isContextV4Enabled: vi.fn(() => mockFeatureFlags.CONTEXT_V4_ENABLED),
    isContextV4IngestWebsiteLabEnabled: vi.fn(() => mockFeatureFlags.CONTEXT_V4_INGEST_WEBSITELAB),
  };
});

// Mock companies
vi.mock('@/lib/airtable/companies', () => ({
  getCompanyById: vi.fn().mockImplementation(async (companyId: string) => {
    if (companyId === 'test-company-123') {
      return { id: companyId, name: 'Test Company' };
    }
    return null;
  }),
}));

// Mock diagnostic runs
vi.mock('@/lib/os/diagnostics/runs', () => ({
  getLatestRunForCompanyAndTool: vi.fn().mockImplementation(async (companyId: string, toolId: string) => {
    if (toolId !== 'websiteLab') return null;
    const run = mockDiagnosticRuns.find(r =>
      r['Company ID'] === companyId && r['Tool ID'] === 'websiteLab'
    );
    if (!run) return null;
    return {
      id: 'run-123',
      companyId,
      toolId: 'websiteLab',
      status: 'complete',
      score: 72,
      createdAt: run['Created At'] as string || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      rawJson: run['Raw JSON'] ? JSON.parse(run['Raw JSON'] as string) : null,
    };
  }),
}));

// ============================================================================
// Test Data
// ============================================================================

const MOCK_WEBSITELAB_RESULT = {
  siteAssessment: {
    score: 72,
    executiveSummary: 'Test summary',
    keyIssues: ['Issue 1'],
    funnelHealthScore: 68,
    quickWins: [{ title: 'Quick win 1' }],
    strengths: ['Strength 1'],
  },
  siteGraph: {
    pages: [{ url: 'https://example.com/', path: '/', type: 'homepage' }],
  },
};

// ============================================================================
// Tests
// ============================================================================

describe('Context V4 Health Endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockV4Store = {};
    mockDiagnosticRuns = [];
    mockFeatureFlags = {
      CONTEXT_V4_ENABLED: true,
      CONTEXT_V4_INGEST_WEBSITELAB: true,
    };
    process.env.CONTEXT_V4_ENABLED = 'true';
    process.env.CONTEXT_V4_INGEST_WEBSITELAB = 'true';
  });

  afterEach(() => {
    delete process.env.CONTEXT_V4_ENABLED;
    delete process.env.CONTEXT_V4_INGEST_WEBSITELAB;
  });

  describe('RED Status', () => {
    it('should return RED when CONTEXT_V4_INGEST_WEBSITELAB is disabled', async () => {
      // Disable the ingest flag
      mockFeatureFlags.CONTEXT_V4_INGEST_WEBSITELAB = false;

      const { computeHealthStatus } = await import('./health-helpers');
      const result = await computeHealthStatus('test-company-123');

      expect(result.status).toBe('RED');
      expect(result.reasons).toContain('FLAG_DISABLED');
    });
  });

  describe('YELLOW Status', () => {
    it('should return YELLOW when no WebsiteLab run exists', async () => {
      // No runs in the mock
      mockDiagnosticRuns = [];

      const { computeHealthStatus } = await import('./health-helpers');
      const result = await computeHealthStatus('test-company-123');

      expect(result.status).toBe('YELLOW');
      expect(result.reasons).toContain('NO_WEBSITELAB_RUN');
    });

    it('should return YELLOW when WebsiteLab run is stale (>7 days)', async () => {
      // Create a run that's 8 days old
      const eightDaysAgo = new Date();
      eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);

      mockDiagnosticRuns = [{
        'Company ID': 'test-company-123',
        'Tool ID': 'websiteLab',
        'Status': 'complete',
        'Score': 72,
        'Created At': eightDaysAgo.toISOString(),
        'Raw JSON': JSON.stringify({
          rawEvidence: {
            labResultV4: MOCK_WEBSITELAB_RESULT,
          },
        }),
      }];

      const { computeHealthStatus } = await import('./health-helpers');
      const result = await computeHealthStatus('test-company-123');

      expect(result.status).toBe('YELLOW');
      expect(result.reasons).toContain('WEBSITELAB_STALE');
      expect(result.websiteLab.ageMinutes).toBeGreaterThan(10080); // 7 days in minutes
    });
  });

  describe('GREEN Status', () => {
    it('should return GREEN when all systems operational', async () => {
      // Set up a fresh WebsiteLab run
      const now = new Date();
      mockDiagnosticRuns = [{
        'Company ID': 'test-company-123',
        'Tool ID': 'websiteLab',
        'Status': 'complete',
        'Score': 72,
        'Created At': now.toISOString(),
        'Raw JSON': JSON.stringify({
          rawEvidence: {
            labResultV4: MOCK_WEBSITELAB_RESULT,
          },
        }),
      }];

      // Set up V4 store with some data
      mockV4Store = {
        companyId: 'test-company-123',
        fields: {
          'website.websiteScore': {
            key: 'website.websiteScore',
            value: 72,
            status: 'proposed',
          },
        },
        meta: { lastUpdated: now.toISOString(), version: 1 },
      };

      const { computeHealthStatus } = await import('./health-helpers');
      const result = await computeHealthStatus('test-company-123');

      expect(result.status).toBe('GREEN');
      expect(result.reasons.length).toBe(0);
      expect(result.websiteLab.hasRun).toBe(true);
    });

    it('should include store counts in response', async () => {
      const now = new Date();
      mockDiagnosticRuns = [{
        'Company ID': 'test-company-123',
        'Tool ID': 'websiteLab',
        'Status': 'complete',
        'Score': 72,
        'Created At': now.toISOString(),
        'Raw JSON': JSON.stringify({
          rawEvidence: {
            labResultV4: MOCK_WEBSITELAB_RESULT,
          },
        }),
      }];

      mockV4Store = {
        companyId: 'test-company-123',
        fields: {
          'website.field1': { key: 'website.field1', value: 'a', status: 'proposed' },
          'website.field2': { key: 'website.field2', value: 'b', status: 'confirmed' },
          'website.field3': { key: 'website.field3', value: 'c', status: 'rejected' },
        },
        meta: { lastUpdated: now.toISOString(), version: 1 },
      };

      const { computeHealthStatus } = await import('./health-helpers');
      const result = await computeHealthStatus('test-company-123');

      expect(result.store.proposed).toBe(1);
      expect(result.store.confirmed).toBe(1);
      expect(result.store.rejected).toBe(1);
      expect(result.store.total).toBe(3);
    });
  });

  describe('Response Structure', () => {
    it('should include healthVersion in response', async () => {
      const { computeHealthStatus } = await import('./health-helpers');
      const result = await computeHealthStatus('test-company-123');

      expect(result.healthVersion).toBe(1);
    });

    it('should include feature flags in response', async () => {
      const { computeHealthStatus } = await import('./health-helpers');
      const result = await computeHealthStatus('test-company-123');

      expect(result.flags).toBeDefined();
      expect(typeof result.flags.CONTEXT_V4_ENABLED).toBe('boolean');
      expect(typeof result.flags.CONTEXT_V4_INGEST_WEBSITELAB).toBe('boolean');
    });

    it('should include links in response', async () => {
      const { computeHealthStatus } = await import('./health-helpers');
      const result = await computeHealthStatus('test-company-123');

      expect(result.links).toBeDefined();
      expect(result.links.inspectorPath).toContain('test-company-123');
      expect(result.links.proposeApiPath).toContain('test-company-123');
    });
  });
});

describe('Health Status Priority', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockV4Store = {};
    mockDiagnosticRuns = [];
    mockFeatureFlags = {
      CONTEXT_V4_ENABLED: true,
      CONTEXT_V4_INGEST_WEBSITELAB: true,
    };
  });

  it('should prioritize RED over YELLOW', async () => {
    // FLAG_DISABLED (RED) + NO_WEBSITELAB_RUN (YELLOW)
    mockFeatureFlags.CONTEXT_V4_INGEST_WEBSITELAB = false;
    mockDiagnosticRuns = []; // No runs

    const { computeHealthStatus } = await import('./health-helpers');
    const result = await computeHealthStatus('test-company-123');

    expect(result.status).toBe('RED');
    expect(result.reasons).toContain('FLAG_DISABLED');
    expect(result.reasons).toContain('NO_WEBSITELAB_RUN');
  });

  it('should include multiple reasons when applicable', async () => {
    // Create a stale run with no candidates
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

    mockDiagnosticRuns = [{
      'Company ID': 'test-company-123',
      'Tool ID': 'websiteLab',
      'Status': 'complete',
      'Score': 0,
      'Created At': tenDaysAgo.toISOString(),
      'Raw JSON': JSON.stringify({
        rawEvidence: {
          labResultV4: {
            siteAssessment: {}, // Empty - no candidates
            siteGraph: { pages: [] },
          },
        },
      }),
    }];

    const { computeHealthStatus } = await import('./health-helpers');
    const result = await computeHealthStatus('test-company-123');

    expect(result.status).toBe('YELLOW');
    expect(result.reasons).toContain('WEBSITELAB_STALE');
    expect(result.reasons).toContain('PROPOSE_ZERO_NO_CANDIDATES');
  });
});
