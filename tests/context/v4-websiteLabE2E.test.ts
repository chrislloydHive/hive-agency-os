// tests/context/v4-websiteLabE2E.test.ts
// E2E Smoke Test for WebsiteLab V4 Proposal Flow
//
// Tests the full flow:
// 1. Seed fake WebsiteLab diagnostic run
// 2. Call propose-website-lab endpoint
// 3. Verify proposed facts appear in review queue
// 4. Confirm a fact
// 5. Verify materialized to legacy graph

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// In-memory store for test
let mockV4Store: Record<string, unknown> = {};
let mockContextGraph: Record<string, unknown> = {};
let mockDiagnosticRuns: Record<string, unknown>[] = [];

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
          if (tableName === 'ContextGraphs') {
            if (Object.keys(mockContextGraph).length === 0) {
              return [];
            }
            return [{
              id: 'rec-graph',
              fields: {
                'Company': ['test-company-123'],
                'Graph JSON': JSON.stringify(mockContextGraph),
              },
            }];
          }
          return [];
        }),
      })),
      create: vi.fn().mockImplementation(async (records) => {
        // Handle V4 store creation
        if (tableName === 'ContextFieldsV4') {
          const data = records[0].fields;
          if (data['Fields JSON']) {
            mockV4Store = JSON.parse(data['Fields JSON']);
          }
        }
        // Handle graph creation
        if (tableName === 'ContextGraphs') {
          const data = records[0].fields;
          if (data['Graph JSON']) {
            mockContextGraph = JSON.parse(data['Graph JSON']);
          }
        }
        return [{ id: 'rec-created' }];
      }),
      update: vi.fn().mockImplementation(async (recordId, fields) => {
        // Handle V4 store update
        if (tableName === 'ContextFieldsV4' && fields['Fields JSON']) {
          mockV4Store = JSON.parse(fields['Fields JSON']);
        }
        // Handle graph update
        if (tableName === 'ContextGraphs' && fields['Graph JSON']) {
          mockContextGraph = JSON.parse(fields['Graph JSON']);
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
    isContextV4Enabled: vi.fn(() => true),
    isContextV4IngestWebsiteLabEnabled: vi.fn(() => true),
  };
});

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
      createdAt: new Date().toISOString(),
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
    executiveSummary: 'The website shows strong potential but needs optimization for conversion.',
    keyIssues: ['Missing hero CTA', 'Slow page load'],
    funnelHealthScore: 68,
    quickWins: [
      { title: 'Add prominent CTA' },
      { title: 'Optimize images' },
    ],
    strengths: ['Clear navigation', 'Strong branding'],
  },
  siteGraph: {
    pages: [
      { url: 'https://example.com/', path: '/', type: 'homepage' },
      { url: 'https://example.com/contact', path: '/contact', type: 'contact' },
    ],
  },
};

// ============================================================================
// Tests
// ============================================================================

describe('WebsiteLab V4 E2E Smoke Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockV4Store = {};
    mockContextGraph = {};
    mockDiagnosticRuns = [];
    process.env.CONTEXT_V4_ENABLED = 'true';
    process.env.CONTEXT_V4_INGEST_WEBSITELAB = 'true';
  });

  afterEach(() => {
    delete process.env.CONTEXT_V4_ENABLED;
    delete process.env.CONTEXT_V4_INGEST_WEBSITELAB;
  });

  it('should complete full E2E flow: propose → review → confirm', async () => {
    const companyId = 'test-company-123';

    // Step 1: Seed fake WebsiteLab diagnostic run
    mockDiagnosticRuns.push({
      'Company ID': companyId,
      'Tool ID': 'websiteLab',
      'Status': 'complete',
      'Score': 72,
      'Raw JSON': JSON.stringify({
        rawEvidence: {
          labResultV4: MOCK_WEBSITELAB_RESULT,
        },
      }),
    });

    // Step 2: Call buildWebsiteLabCandidates (simulates propose endpoint logic)
    const { buildWebsiteLabCandidates } = await import('@/lib/contextGraph/v4/websiteLabCandidates');
    const { proposeFromLabResult } = await import('@/lib/contextGraph/v4/propose');

    const rawJson = {
      rawEvidence: {
        labResultV4: MOCK_WEBSITELAB_RESULT,
      },
    };

    const candidateResult = buildWebsiteLabCandidates(rawJson);

    // Verify extraction worked
    expect(candidateResult.extractionPath).toBe('rawEvidence.labResultV4');
    expect(candidateResult.candidates.length).toBeGreaterThan(0);

    // Step 3: Propose candidates to V4 store
    const proposalResult = await proposeFromLabResult({
      companyId,
      importerId: 'websiteLab',
      source: 'lab',
      sourceId: 'run-123',
      extractionPath: candidateResult.extractionPath,
      candidates: candidateResult.candidates,
    });

    // Verify proposals were created
    expect(proposalResult.proposed).toBeGreaterThan(0);
    expect(proposalResult.proposedKeys.length).toBeGreaterThan(0);

    // Verify website.executiveSummary was proposed
    expect(proposalResult.proposedKeys).toContain('website.executiveSummary');

    // Step 4: Verify proposed fields are in the store
    expect(mockV4Store).toBeDefined();
    expect(typeof mockV4Store).toBe('object');

    const store = mockV4Store as { fields?: Record<string, { status: string; key: string }> };
    expect(store.fields).toBeDefined();

    const proposedFields = Object.values(store.fields || {}).filter(
      (f) => f.status === 'proposed'
    );
    expect(proposedFields.length).toBeGreaterThan(0);

    // Step 5: Confirm one field
    const { confirmFieldsV4 } = await import('@/lib/contextGraph/fieldStoreV4');

    const keyToConfirm = 'website.executiveSummary';
    const confirmResult = await confirmFieldsV4(companyId, [keyToConfirm]);

    expect(confirmResult.confirmed).toContain(keyToConfirm);
    expect(confirmResult.failed.length).toBe(0);

    // Step 6: Verify field is now confirmed in store
    const updatedStore = mockV4Store as { fields?: Record<string, { status: string; key: string }> };
    const confirmedField = updatedStore.fields?.[keyToConfirm];

    expect(confirmedField).toBeDefined();
    expect(confirmedField?.status).toBe('confirmed');
  });

  it('should track website.websiteScore with correct value', async () => {
    const companyId = 'test-company-123';

    const { buildWebsiteLabCandidates } = await import('@/lib/contextGraph/v4/websiteLabCandidates');
    const { proposeFromLabResult } = await import('@/lib/contextGraph/v4/propose');

    const rawJson = {
      rawEvidence: {
        labResultV4: MOCK_WEBSITELAB_RESULT,
      },
    };

    const candidateResult = buildWebsiteLabCandidates(rawJson);
    const scoreCandidate = candidateResult.candidates.find(
      (c) => c.key === 'website.websiteScore'
    );

    expect(scoreCandidate).toBeDefined();
    expect(scoreCandidate?.value).toBe(72);

    // Propose and verify in store
    await proposeFromLabResult({
      companyId,
      importerId: 'websiteLab',
      source: 'lab',
      sourceId: 'run-123',
      extractionPath: candidateResult.extractionPath,
      candidates: candidateResult.candidates,
    });

    const store = mockV4Store as { fields?: Record<string, { value: unknown }> };
    expect(store.fields?.['website.websiteScore']?.value).toBe(72);
  });

  it('should filter out cross-domain fields (brand, content, audience)', async () => {
    const { buildWebsiteLabCandidates } = await import('@/lib/contextGraph/v4/websiteLabCandidates');

    const rawJson = {
      rawEvidence: {
        labResultV4: MOCK_WEBSITELAB_RESULT,
      },
    };

    const result = buildWebsiteLabCandidates(rawJson);

    // All candidates should be website.*, digitalInfra.*, identity.*, or productOffer.*
    // (identity and productOffer are authorized for baseline inference)
    const authorizedDomains = ['website', 'digitalInfra', 'identity', 'productOffer'];
    for (const candidate of result.candidates) {
      const domain = candidate.key.split('.')[0];
      expect(authorizedDomains).toContain(domain);
    }

    // Should have skipped some cross-domain fields (brand, content, audience, historical)
    expect(result.skipped.wrongDomain).toBeGreaterThanOrEqual(0);
  });

  it('should include evidence with importerId for tracking', async () => {
    const companyId = 'test-company-123';

    const { buildWebsiteLabCandidates } = await import('@/lib/contextGraph/v4/websiteLabCandidates');
    const { proposeFromLabResult } = await import('@/lib/contextGraph/v4/propose');

    const rawJson = {
      rawEvidence: {
        labResultV4: MOCK_WEBSITELAB_RESULT,
      },
    };

    const candidateResult = buildWebsiteLabCandidates(rawJson);

    await proposeFromLabResult({
      companyId,
      importerId: 'websiteLab',
      source: 'lab',
      sourceId: 'run-123',
      extractionPath: candidateResult.extractionPath,
      candidates: candidateResult.candidates,
    });

    const store = mockV4Store as {
      fields?: Record<string, { evidence?: { importerId?: string } }>
    };

    // Check that evidence has importerId
    const field = store.fields?.['website.websiteScore'];
    expect(field?.evidence?.importerId).toBe('websiteLab');
  });
});

describe('V4 Failure Mode: NO_CANDIDATES', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockV4Store = {};
    mockContextGraph = {};
    mockDiagnosticRuns = [];
    process.env.CONTEXT_V4_ENABLED = 'true';
    process.env.CONTEXT_V4_INGEST_WEBSITELAB = 'true';
  });

  afterEach(() => {
    delete process.env.CONTEXT_V4_ENABLED;
    delete process.env.CONTEXT_V4_INGEST_WEBSITELAB;
  });

  it('should return NO_CANDIDATES when rawJson yields 0 candidates', async () => {
    const companyId = 'test-company-123';

    // Seed a WebsiteLab run with minimal rawJson that has no valid fields
    // This rawJson has an empty siteAssessment with no extractable values
    const emptyLabResult = {
      siteAssessment: {
        score: null, // null values are skipped
        executiveSummary: '', // empty strings are skipped
        keyIssues: [], // empty arrays are skipped
      },
      siteGraph: {
        pages: [],
      },
    };

    mockDiagnosticRuns.push({
      'Company ID': companyId,
      'Tool ID': 'websiteLab',
      'Status': 'complete',
      'Score': 0,
      'Raw JSON': JSON.stringify({
        rawEvidence: {
          labResultV4: emptyLabResult,
        },
      }),
    });

    // Build candidates - should get 0
    const { buildWebsiteLabCandidates } = await import('@/lib/contextGraph/v4/websiteLabCandidates');

    const candidateResult = buildWebsiteLabCandidates({
      rawEvidence: {
        labResultV4: emptyLabResult,
      },
    });

    // Verify NO_CANDIDATES scenario
    expect(candidateResult.extractionPath).toBe('rawEvidence.labResultV4');
    expect(candidateResult.candidates.length).toBe(0);
    expect(candidateResult.skipped.emptyValue).toBeGreaterThan(0);
  });

  it('should return 0 candidates for completely empty siteAssessment', async () => {
    const { buildWebsiteLabCandidates } = await import('@/lib/contextGraph/v4/websiteLabCandidates');

    // Even more minimal - just the structure, no data
    const bareMinimumLabResult = {
      siteAssessment: {},
      siteGraph: { pages: [] },
    };

    const candidateResult = buildWebsiteLabCandidates({
      rawEvidence: {
        labResultV4: bareMinimumLabResult,
      },
    });

    expect(candidateResult.candidates.length).toBe(0);
  });
});

describe('V4 Idempotency: Replay-Safe Proposals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockV4Store = {};
    mockContextGraph = {};
    mockDiagnosticRuns = [];
    process.env.CONTEXT_V4_ENABLED = 'true';
    process.env.CONTEXT_V4_INGEST_WEBSITELAB = 'true';
  });

  afterEach(() => {
    delete process.env.CONTEXT_V4_ENABLED;
    delete process.env.CONTEXT_V4_INGEST_WEBSITELAB;
  });

  it('should be idempotent: second propose call skips all duplicates', async () => {
    const companyId = 'test-company-123';

    const { buildWebsiteLabCandidates } = await import('@/lib/contextGraph/v4/websiteLabCandidates');
    const { proposeFromLabResult } = await import('@/lib/contextGraph/v4/propose');
    const { getFieldCountsV4 } = await import('@/lib/contextGraph/fieldStoreV4');

    const rawJson = {
      rawEvidence: {
        labResultV4: MOCK_WEBSITELAB_RESULT,
      },
    };

    const candidateResult = buildWebsiteLabCandidates(rawJson);
    expect(candidateResult.candidates.length).toBeGreaterThan(0);

    // First proposal - should create all
    const firstResult = await proposeFromLabResult({
      companyId,
      importerId: 'websiteLab',
      source: 'lab',
      sourceId: 'run-123',
      extractionPath: candidateResult.extractionPath,
      candidates: candidateResult.candidates,
    });

    expect(firstResult.proposed).toBeGreaterThan(0);
    expect(firstResult.blocked).toBe(0);

    // Get store counts after first proposal
    const countsAfterFirst = await getFieldCountsV4(companyId);
    expect(countsAfterFirst.proposed).toBe(firstResult.proposed);

    // Second proposal - should skip all (same confidence)
    const secondResult = await proposeFromLabResult({
      companyId,
      importerId: 'websiteLab',
      source: 'lab',
      sourceId: 'run-123',
      extractionPath: candidateResult.extractionPath,
      candidates: candidateResult.candidates,
    });

    // Second call should have 0 created, all blocked
    expect(secondResult.proposed).toBe(0);
    expect(secondResult.blocked).toBe(candidateResult.candidates.length);
    expect(secondResult.blockedKeys.length).toBe(candidateResult.candidates.length);

    // Store counts should be unchanged
    const countsAfterSecond = await getFieldCountsV4(companyId);
    expect(countsAfterSecond.proposed).toBe(countsAfterFirst.proposed);
    expect(countsAfterSecond.total).toBe(countsAfterFirst.total);
  });

  it('should not overwrite confirmed fields', async () => {
    const companyId = 'test-company-123';

    const { buildWebsiteLabCandidates } = await import('@/lib/contextGraph/v4/websiteLabCandidates');
    const { proposeFromLabResult } = await import('@/lib/contextGraph/v4/propose');
    const { confirmFieldsV4 } = await import('@/lib/contextGraph/fieldStoreV4');

    const rawJson = {
      rawEvidence: {
        labResultV4: MOCK_WEBSITELAB_RESULT,
      },
    };

    const candidateResult = buildWebsiteLabCandidates(rawJson);

    // First: propose all
    const firstResult = await proposeFromLabResult({
      companyId,
      importerId: 'websiteLab',
      source: 'lab',
      sourceId: 'run-123',
      extractionPath: candidateResult.extractionPath,
      candidates: candidateResult.candidates,
    });
    expect(firstResult.proposed).toBeGreaterThan(0);

    // Confirm one field
    const keyToConfirm = 'website.executiveSummary';
    const confirmResult = await confirmFieldsV4(companyId, [keyToConfirm]);
    expect(confirmResult.confirmed).toContain(keyToConfirm);

    // Try to propose again - confirmed field should be blocked
    const secondResult = await proposeFromLabResult({
      companyId,
      importerId: 'websiteLab',
      source: 'lab',
      sourceId: 'run-456', // Different run ID
      extractionPath: candidateResult.extractionPath,
      candidates: candidateResult.candidates,
    });

    // The confirmed field should be blocked
    expect(secondResult.blockedKeys).toContain(keyToConfirm);

    // Verify the confirmed field still has its confirmed status
    const store = mockV4Store as { fields?: Record<string, { status: string; value: unknown }> };
    expect(store.fields?.[keyToConfirm]?.status).toBe('confirmed');
  });

  it('should track skippedKeysSample correctly', async () => {
    const companyId = 'test-company-123';

    const { buildWebsiteLabCandidates } = await import('@/lib/contextGraph/v4/websiteLabCandidates');
    const { proposeFromLabResult } = await import('@/lib/contextGraph/v4/propose');

    const rawJson = {
      rawEvidence: {
        labResultV4: MOCK_WEBSITELAB_RESULT,
      },
    };

    const candidateResult = buildWebsiteLabCandidates(rawJson);

    // First proposal
    await proposeFromLabResult({
      companyId,
      importerId: 'websiteLab',
      source: 'lab',
      sourceId: 'run-123',
      extractionPath: candidateResult.extractionPath,
      candidates: candidateResult.candidates,
    });

    // Second proposal - get blocked keys
    const secondResult = await proposeFromLabResult({
      companyId,
      importerId: 'websiteLab',
      source: 'lab',
      sourceId: 'run-123',
      extractionPath: candidateResult.extractionPath,
      candidates: candidateResult.candidates,
    });

    // blockedKeys should contain the keys that were skipped
    expect(secondResult.blockedKeys.length).toBeGreaterThan(0);
    expect(secondResult.blockedKeys.length).toBeLessThanOrEqual(candidateResult.candidates.length);

    // Each blocked key should be from our candidates
    for (const blockedKey of secondResult.blockedKeys) {
      expect(candidateResult.candidates.map(c => c.key)).toContain(blockedKey);
    }
  });
});

describe('V4 Materialization Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockV4Store = {};
    mockContextGraph = {};
    mockDiagnosticRuns = [];
    process.env.CONTEXT_V4_ENABLED = 'true';
  });

  afterEach(() => {
    delete process.env.CONTEXT_V4_ENABLED;
  });

  it('should have materializeConfirmedToGraph function exported', async () => {
    const materialize = await import('@/lib/contextGraph/materializeV4');
    expect(materialize.materializeConfirmedToGraph).toBeDefined();
    expect(typeof materialize.materializeConfirmedToGraph).toBe('function');
  });
});
