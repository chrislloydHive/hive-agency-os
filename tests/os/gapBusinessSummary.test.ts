import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getGapBusinessSummary } from '@/lib/os/ai/gapBusinessSummary';

const { mockGetGapFullReportsForCompany, mockGetGapIaRunsForCompany } = vi.hoisted(() => ({
  mockGetGapFullReportsForCompany: vi.fn(),
  mockGetGapIaRunsForCompany: vi.fn(),
}));

vi.mock('@/lib/airtable/gapFullReports', () => ({
  getGapFullReportsForCompany: mockGetGapFullReportsForCompany,
}));

vi.mock('@/lib/airtable/gapIaRuns', () => ({
  getGapIaRunsForCompany: mockGetGapIaRunsForCompany,
}));

describe('getGapBusinessSummary', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('prefers GAP Full Report summary when available', async () => {
    mockGetGapFullReportsForCompany.mockResolvedValue([
      {
        id: 'rec1',
        companyId: 'rec123',
        summary: 'TrainrHub connects people with certified personal trainers for tailored sessions online and in person.',
        diagnosticsJson: {},
        scores: {},
        status: 'ready',
      } as any,
    ]);
    mockGetGapIaRunsForCompany.mockResolvedValue([]);

    const result = await getGapBusinessSummary('rec123');

    expect(result.source).toBe('gapFull');
    expect(result.summary).toContain('TrainrHub connects people');
  });

  it('falls back to GAP IA narrative when full report is missing', async () => {
    mockGetGapFullReportsForCompany.mockResolvedValue([]);
    mockGetGapIaRunsForCompany.mockResolvedValue([
      {
        id: 'ia1',
        companyId: 'rec123',
        summary: {
          narrative: 'TrainrHub is a marketplace that matches personal trainers with clients seeking flexible sessions.',
        },
        core: {
          businessName: 'TrainrHub',
          primaryOffer: 'personal training sessions',
          primaryAudience: 'clients seeking trainers',
          quickSummary: 'Marketplace connecting trainers and clients',
        },
      } as any,
    ]);

    const result = await getGapBusinessSummary('rec123');

    expect(result.source).toBe('gapIa');
    expect(result.summary).toContain('TrainrHub');
    expect(result.summary?.split(' ').length).toBeLessThanOrEqual(60);
  });

  it('returns null when no GAP data is available', async () => {
    mockGetGapFullReportsForCompany.mockResolvedValue([]);
    mockGetGapIaRunsForCompany.mockResolvedValue([]);

    const result = await getGapBusinessSummary('rec123');

    expect(result.source).toBeNull();
    expect(result.summary).toBeNull();
  });
});

