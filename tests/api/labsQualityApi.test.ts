import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/os/companies/[companyId]/labs/quality/route';
import type { LabQuality } from '@/lib/os/quality/computeLabQuality';

const computeContextLabQuality = vi.fn();
const getLatestRunForCompanyAndTool = vi.fn();
const getCanonicalCompetitionRun = vi.fn();

vi.mock('@/lib/os/quality/contextLabQuality', () => ({
  computeContextLabQuality: (...args: unknown[]) => computeContextLabQuality(...args),
}));

vi.mock('@/lib/os/diagnostics/runs', () => ({
  getLatestRunForCompanyAndTool: (...args: unknown[]) => getLatestRunForCompanyAndTool(...args),
}));

vi.mock('@/lib/competition/getCanonicalCompetitionRun', () => ({
  getCanonicalCompetitionRun: (...args: unknown[]) => getCanonicalCompetitionRun(...args),
}));

const makeQuality = (label: LabQuality['label'], score: number | null, reason: string): LabQuality => ({
  label,
  score,
  reasons: [{ code: 'test', label: reason }],
  metrics: {
    evidenceCoverage: 0.5,
    avgConfidence: 0.5,
    specificity: 0.5,
    conflictRate: 0,
    factCount: score === null ? 0 : 3,
  },
});

describe('labs/quality API', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns lab quality with label, score, and top reason for each lab', async () => {
    computeContextLabQuality.mockResolvedValue({
      websiteLab: makeQuality('Good', 78, 'Strong evidence'),
      competitionLab: makeQuality('Excellent', 90, 'High coverage'),
      brandLab: makeQuality('Fair', 62, 'Generic phrasing'),
      gapPlan: makeQuality('Good', 75, 'Balanced'),
      audienceLab: makeQuality('Insufficient', null, 'No proposed facts yet'),
    });

    getLatestRunForCompanyAndTool
      .mockResolvedValueOnce({ id: 'web-run', status: 'complete' })
      .mockResolvedValueOnce({ id: 'brand-run', status: 'complete' })
      .mockResolvedValueOnce({ id: 'gap-run', status: 'complete' })
      .mockResolvedValueOnce({ id: 'aud-run', status: 'complete' });

    getCanonicalCompetitionRun.mockResolvedValue({ runId: 'comp-v4', status: 'completed', version: 4 });

    const res = await GET(new NextRequest('http://localhost'), {
      params: Promise.resolve({ companyId: 'company-123' }),
    });

    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.current.websiteLab.label).toBe('Good');
    expect(json.current.websiteLab.score).toBe(78);
    expect(json.current.websiteLab.reasons?.[0]?.label).toBe('Strong evidence');
    expect(json.current.competitionLab.runId).toBe('comp-v4');
    expect(json.current.audienceLab.label).toBe('Insufficient');
    expect(json.current.audienceLab.score).toBeNull();
  });

  it('marks labs as insufficient when no facts and prefers competition v4 run id', async () => {
    computeContextLabQuality.mockResolvedValue({
      websiteLab: makeQuality('Insufficient', null, 'No proposed facts yet'),
      competitionLab: makeQuality('Good', 70, 'Balanced'),
      brandLab: makeQuality('Insufficient', null, 'No proposed facts yet'),
      gapPlan: makeQuality('Insufficient', null, 'No proposed facts yet'),
      audienceLab: makeQuality('Insufficient', null, 'No proposed facts yet'),
    });

    getLatestRunForCompanyAndTool
      .mockResolvedValueOnce({ id: 'web-run', status: 'complete' })
      .mockResolvedValueOnce({ id: 'brand-run', status: 'complete' })
      .mockResolvedValueOnce({ id: 'gap-run', status: 'complete' })
      .mockResolvedValueOnce({ id: 'aud-run', status: 'complete' });

    getCanonicalCompetitionRun.mockResolvedValue({ runId: 'competition-v4', status: 'completed', version: 4 });

    const res = await GET(new NextRequest('http://localhost'), {
      params: Promise.resolve({ companyId: 'company-123' }),
    });

    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.current.websiteLab.label).toBe('Insufficient');
    expect(json.current.websiteLab.score).toBeNull();
    expect(json.current.brandLab.label).toBe('Insufficient');
    expect(json.current.competitionLab.runId).toBe('competition-v4');
    expect(json.current.audienceLab.label).toBe('Insufficient');
  });
});

