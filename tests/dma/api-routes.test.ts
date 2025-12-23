// tests/dma/api-routes.test.ts
// Integration tests for DMA API routes
//
// Tests the DMA activity and company runs API endpoints
// Uses mocked Airtable calls

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { DMARun, DMACompanySummary } from '@/lib/types/dma';

// Mock data
const mockGapIaRuns = [
  {
    id: 'ia-1',
    companyId: 'company-1',
    domain: 'example.com',
    source: 'lead-magnet',
    createdAt: new Date().toISOString(),
    url: 'https://example.com',
    core: {
      businessName: 'Example Company',
      quickSummary: 'Test summary',
    },
  },
  {
    id: 'ia-2',
    companyId: 'company-1',
    domain: 'example.com',
    source: 'internal',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    url: 'https://example.com',
    core: {
      businessName: 'Example Company',
      quickSummary: 'Another summary',
    },
  },
];

const mockGapPlanRuns = [
  {
    id: 'plan-1',
    companyId: 'company-2',
    domain: 'another.com',
    overallScore: 65,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    url: 'https://another.com',
    dataJson: {
      companyName: 'Another Company',
      source: 'dma_audit',
    },
  },
];

const mockCompanies = [
  { id: 'company-1', name: 'Example Company', domain: 'example.com' },
  { id: 'company-2', name: 'Another Company', domain: 'another.com' },
];

// Mock Airtable calls
vi.mock('@/lib/airtable/gapIaRuns', () => ({
  listRecentGapIaRuns: vi.fn().mockResolvedValue(mockGapIaRuns),
  getGapIaRunsForCompanyOrDomain: vi.fn().mockResolvedValue(mockGapIaRuns),
}));

vi.mock('@/lib/airtable/gapPlanRuns', () => ({
  listRecentGapPlanRuns: vi.fn().mockResolvedValue(mockGapPlanRuns),
  getGapPlanRunsForCompanyOrDomain: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/airtable/companies', () => ({
  getAllCompanies: vi.fn().mockResolvedValue(mockCompanies),
  getCompanyById: vi.fn().mockImplementation((id: string) => {
    const company = mockCompanies.find((c) => c.id === id);
    return Promise.resolve(company || null);
  }),
}));

describe('DMA Normalize Layer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchRecentDMARuns', () => {
    it('should fetch and normalize GAP-IA and GAP-Plan runs', async () => {
      const { fetchRecentDMARuns } = await import('@/lib/dma/normalize');

      const runs = await fetchRecentDMARuns({ days: 7 });

      expect(runs.length).toBeGreaterThan(0);
      expect(runs[0]).toHaveProperty('id');
      expect(runs[0]).toHaveProperty('runType');
      expect(runs[0]).toHaveProperty('scoreBand');
    });

    it('should filter by runType when specified', async () => {
      const { fetchRecentDMARuns } = await import('@/lib/dma/normalize');

      // Mock reset for this specific test
      const { listRecentGapIaRuns } = await import('@/lib/airtable/gapIaRuns');
      const { listRecentGapPlanRuns } = await import('@/lib/airtable/gapPlanRuns');

      const runs = await fetchRecentDMARuns({ days: 7, runType: 'GAP_FULL' });

      // GAP-IA should not be fetched when filtering for GAP_FULL
      expect(listRecentGapIaRuns).not.toHaveBeenCalled;
    });

    it('should respect limit parameter', async () => {
      const { fetchRecentDMARuns } = await import('@/lib/dma/normalize');

      const runs = await fetchRecentDMARuns({ days: 30, limit: 1 });

      expect(runs.length).toBeLessThanOrEqual(1);
    });
  });

  describe('fetchDMARunsForCompany', () => {
    it('should fetch runs for a specific company', async () => {
      const { fetchDMARunsForCompany } = await import('@/lib/dma/normalize');

      const runs = await fetchDMARunsForCompany('company-1', 'example.com');

      expect(runs.length).toBeGreaterThan(0);
      expect(runs.every((r) => r.companyId === 'company-1' || r.domain === 'example.com')).toBe(true);
    });
  });

  describe('buildCompanySummaries', () => {
    it('should group runs by company and derive intent', async () => {
      const { fetchRecentDMARuns, buildCompanySummaries } = await import('@/lib/dma/normalize');

      const runs = await fetchRecentDMARuns({ days: 30 });
      const summaries = await buildCompanySummaries(runs);

      expect(summaries.length).toBeGreaterThan(0);
      expect(summaries[0]).toHaveProperty('companyId');
      expect(summaries[0]).toHaveProperty('intentLevel');
      expect(summaries[0]).toHaveProperty('totalRuns');
    });

    it('should calculate intent level correctly', async () => {
      const { buildSingleCompanySummary } = await import('@/lib/dma/normalize');
      const { deriveIntentLevel } = await import('@/lib/dma/intentLevel');

      // Create a mock Full GAP run (should be High intent)
      const fullGapRun: DMARun = {
        id: 'test-1',
        companyId: 'company-1',
        companyName: 'Test Company',
        domain: 'test.com',
        runType: 'GAP_FULL',
        score: 70,
        createdAt: new Date().toISOString(),
        source: 'DMA',
        runUrl: null,
        notes: null,
        websiteUrl: 'https://test.com',
        scoreBand: 'Mid',
        isRerun: false,
        daysSincePreviousRun: null,
      };

      const summary = buildSingleCompanySummary('company-1', 'Test Company', 'test.com', [fullGapRun]);

      expect(summary.intentLevel).toBe('High');
      expect(summary.intentReasons).toContain('Full GAP run');
    });

    it('should return empty array for empty runs', async () => {
      const { buildCompanySummaries } = await import('@/lib/dma/normalize');

      const summaries = await buildCompanySummaries([]);

      expect(summaries).toEqual([]);
    });
  });

  describe('buildSingleCompanySummary', () => {
    it('should return None intent for empty runs array', async () => {
      const { buildSingleCompanySummary } = await import('@/lib/dma/normalize');

      const summary = buildSingleCompanySummary('company-1', 'Test', 'test.com', []);

      expect(summary.intentLevel).toBe('None');
      expect(summary.totalRuns).toBe(0);
      expect(summary.hasRecentRun).toBe(false);
    });

    it('should detect high intent for 2+ runs in 14 days', async () => {
      const { buildSingleCompanySummary } = await import('@/lib/dma/normalize');

      const runs: DMARun[] = [
        {
          id: 'run-1',
          companyId: 'company-1',
          companyName: 'Test',
          domain: 'test.com',
          runType: 'GAP_IA',
          score: 70,
          createdAt: new Date().toISOString(),
          source: 'DMA',
          runUrl: null,
          notes: null,
          websiteUrl: 'https://test.com',
          scoreBand: 'Mid',
          isRerun: false,
          daysSincePreviousRun: null,
        },
        {
          id: 'run-2',
          companyId: 'company-1',
          companyName: 'Test',
          domain: 'test.com',
          runType: 'GAP_IA',
          score: 65,
          createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          source: 'DMA',
          runUrl: null,
          notes: null,
          websiteUrl: 'https://test.com',
          scoreBand: 'Mid',
          isRerun: true,
          daysSincePreviousRun: 5,
        },
      ];

      const summary = buildSingleCompanySummary('company-1', 'Test', 'test.com', runs);

      expect(summary.intentLevel).toBe('High');
      expect(summary.totalRuns).toBe(2);
    });
  });
});

describe('DMA Activity Stats', () => {
  it('should calculate run counts by type', async () => {
    const { getDMAActivityStats } = await import('@/lib/dma/normalize');

    const runs: DMARun[] = [
      {
        id: 'run-1',
        companyId: 'company-1',
        companyName: 'Test',
        domain: 'test.com',
        runType: 'GAP_IA',
        score: 70,
        createdAt: new Date().toISOString(),
        source: 'DMA',
        runUrl: null,
        notes: null,
        websiteUrl: null,
        scoreBand: 'Mid',
        isRerun: false,
        daysSincePreviousRun: null,
      },
      {
        id: 'run-2',
        companyId: 'company-2',
        companyName: 'Test 2',
        domain: 'test2.com',
        runType: 'GAP_FULL',
        score: 80,
        createdAt: new Date().toISOString(),
        source: 'DMA',
        runUrl: null,
        notes: null,
        websiteUrl: null,
        scoreBand: 'High',
        isRerun: false,
        daysSincePreviousRun: null,
      },
    ];

    const summaries: DMACompanySummary[] = [
      {
        companyId: 'company-1',
        companyName: 'Test',
        domain: 'test.com',
        lastRunAt: new Date().toISOString(),
        lastRunType: 'GAP_IA',
        totalRuns: 1,
        latestScore: 70,
        latestScoreBand: 'Mid',
        intentLevel: 'Medium',
        intentReasons: ['Recent IA run'],
        hasRecentRun: true,
        runs: [],
      },
      {
        companyId: 'company-2',
        companyName: 'Test 2',
        domain: 'test2.com',
        lastRunAt: new Date().toISOString(),
        lastRunType: 'GAP_FULL',
        totalRuns: 1,
        latestScore: 80,
        latestScoreBand: 'High',
        intentLevel: 'High',
        intentReasons: ['Full GAP run'],
        hasRecentRun: true,
        runs: [],
      },
    ];

    const stats = getDMAActivityStats(runs, summaries);

    expect(stats.countByType.GAP_IA).toBe(1);
    expect(stats.countByType.GAP_FULL).toBe(1);
    expect(stats.countByIntent.High).toBe(1);
    expect(stats.countByIntent.Medium).toBe(1);
  });
});
