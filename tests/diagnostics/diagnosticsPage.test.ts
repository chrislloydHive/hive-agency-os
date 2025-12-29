// tests/diagnostics/diagnosticsPage.test.ts
// Tests for the Diagnostics page and runs API

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { getPrimaryCompanyTabs, getCompanyTabFromPath } from '@/lib/nav/companyNav';
import { makeCompanyRecord } from '@/tests/helpers/factories';

// ============================================================================
// Navigation Tests
// ============================================================================

describe('Diagnostics Navigation', () => {
  describe('getPrimaryCompanyTabs', () => {
    it('should include Discover (Phase 1) in primary tabs', () => {
      const primaryTabs = getPrimaryCompanyTabs();
      const discoverTab = primaryTabs.find(tab => tab.id === 'discover');

      expect(discoverTab).toBeDefined();
      expect(discoverTab?.name).toBe('Discover');
      expect(discoverTab?.primary).toBe(true);
      expect(discoverTab?.phase).toBe(1);
    });

    it('should have Discover after Overview', () => {
      const primaryTabs = getPrimaryCompanyTabs();
      const overviewIndex = primaryTabs.findIndex(tab => tab.id === 'overview');
      const discoverIndex = primaryTabs.findIndex(tab => tab.id === 'discover');

      expect(discoverIndex).toBeGreaterThan(overviewIndex);
    });

    it('should not include diagnostics in primary tabs (hidden)', () => {
      const primaryTabs = getPrimaryCompanyTabs();
      const diagnosticsTab = primaryTabs.find(tab => tab.id === 'diagnostics');

      expect(diagnosticsTab).toBeUndefined();
    });
  });

  describe('getCompanyTabFromPath', () => {
    it('should return discover for /c/[companyId]/diagnostics', () => {
      const result = getCompanyTabFromPath('/c/recABC123/diagnostics', 'recABC123');
      expect(result).toBe('discover');
    });

    it('should return discover for /c/[companyId]/diagnostics/website', () => {
      const result = getCompanyTabFromPath('/c/recABC123/diagnostics/website', 'recABC123');
      expect(result).toBe('discover');
    });

    it('should return discover for /c/[companyId]/blueprint (legacy)', () => {
      const result = getCompanyTabFromPath('/c/recABC123/blueprint', 'recABC123');
      expect(result).toBe('discover');
    });

    it('should return discover for /c/[companyId]/labs (legacy)', () => {
      const result = getCompanyTabFromPath('/c/recABC123/labs', 'recABC123');
      expect(result).toBe('discover');
    });
  });

  describe('Discover tab href', () => {
    it('should generate correct href for Discover tab (points to diagnostics route)', () => {
      const primaryTabs = getPrimaryCompanyTabs();
      const discoverTab = primaryTabs.find(tab => tab.id === 'discover');

      expect(discoverTab?.href('recABC123')).toBe('/c/recABC123/diagnostics');
    });
  });
});

// ============================================================================
// Runs API Tests
// ============================================================================

// Mock the Airtable functions
vi.mock('@/lib/airtable/companies', () => ({
  getCompanyById: vi.fn(),
}));

vi.mock('@/lib/os/diagnostics/runs', () => ({
  listDiagnosticRunsForCompany: vi.fn(),
  getToolLabel: vi.fn((toolId: string) => {
    const labels: Record<string, string> = {
      websiteLab: 'Website Lab',
      brandLab: 'Brand Lab',
      seoLab: 'SEO Lab',
      gapSnapshot: 'GAP IA',
    };
    return labels[toolId] || toolId;
  }),
}));

describe('Diagnostics Runs API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 404 for non-existent company', async () => {
    const { getCompanyById } = await import('@/lib/airtable/companies');
    vi.mocked(getCompanyById).mockResolvedValue(null);

    // Import the route handler
    const { GET } = await import('@/app/api/os/companies/[companyId]/diagnostics/runs/route');

    const request = new NextRequest('http://localhost/api/os/companies/recNONEXIST/diagnostics/runs');
    const response = await GET(request, { params: Promise.resolve({ companyId: 'recNONEXIST' }) });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Company not found');
  });

  it('should return runs grouped by tool for existing company', async () => {
    const { getCompanyById } = await import('@/lib/airtable/companies');
    const { listDiagnosticRunsForCompany } = await import('@/lib/os/diagnostics/runs');

    vi.mocked(getCompanyById).mockResolvedValue(
      makeCompanyRecord({
        id: 'recABC123',
        name: 'Test Company',
        website: 'https://example.com',
      })
    );

    vi.mocked(listDiagnosticRunsForCompany).mockResolvedValue([
      {
        id: 'run1',
        toolId: 'websiteLab',
        status: 'complete',
        createdAt: '2024-01-01T00:00:00Z',
        score: 75,
        summary: 'Website analysis complete',
        companyId: 'recABC123',
        updatedAt: '2024-01-01T01:00:00Z',
        metadata: null,
        rawJson: undefined,
      },
      {
        id: 'run2',
        toolId: 'brandLab',
        status: 'running',
        createdAt: '2024-01-02T00:00:00Z',
        score: null,
        summary: null,
        companyId: 'recABC123',
        updatedAt: '2024-01-02T00:00:00Z',
        metadata: null,
        rawJson: undefined,
      },
    ]);

    const { GET } = await import('@/app/api/os/companies/[companyId]/diagnostics/runs/route');

    const request = new NextRequest('http://localhost/api/os/companies/recABC123/diagnostics/runs');
    const response = await GET(request, { params: Promise.resolve({ companyId: 'recABC123' }) });

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.ok).toBe(true);
    expect(data.companyId).toBe('recABC123');
    expect(data.companyName).toBe('Test Company');
    expect(Array.isArray(data.runs)).toBe(true);

    // Find websiteLab run
    const websiteRun = data.runs.find((r: { toolId: string; status: string; score: number | null }) => r.toolId === 'websiteLab');
    expect(websiteRun).toBeDefined();
    expect(websiteRun.status).toBe('complete');
    expect(websiteRun.score).toBe(75);

    // Find brandLab run
    const brandRun = data.runs.find((r: { toolId: string; status: string; score: number | null }) => r.toolId === 'brandLab');
    expect(brandRun).toBeDefined();
    expect(brandRun.status).toBe('running');
  });

  it('should return idle status for tools without runs', async () => {
    const { getCompanyById } = await import('@/lib/airtable/companies');
    const { listDiagnosticRunsForCompany } = await import('@/lib/os/diagnostics/runs');

    vi.mocked(getCompanyById).mockResolvedValue(
      makeCompanyRecord({
        id: 'recABC123',
        name: 'Test Company',
        website: 'https://example.com',
      })
    );

    // Return empty array - no runs
    vi.mocked(listDiagnosticRunsForCompany).mockResolvedValue([]);

    const { GET } = await import('@/app/api/os/companies/[companyId]/diagnostics/runs/route');

    const request = new NextRequest('http://localhost/api/os/companies/recABC123/diagnostics/runs');
    const response = await GET(request, { params: Promise.resolve({ companyId: 'recABC123' }) });

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.ok).toBe(true);
    expect(Array.isArray(data.runs)).toBe(true);

    // All tools should have idle status
    for (const run of data.runs) {
      expect(run.status).toBe('idle');
      expect(run.runId).toBeNull();
      expect(run.score).toBeNull();
    }
  });
});
