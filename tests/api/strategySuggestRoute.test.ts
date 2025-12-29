import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/os/companies/[companyId]/strategy/fields/suggest/route';

vi.mock('@/lib/airtable/companies', () => ({
  getCompanyById: vi.fn().mockResolvedValue({ id: 'rec1', name: 'TestCo' }),
}));

vi.mock('@/lib/os/strategy', () => ({
  getStrategyById: vi.fn().mockResolvedValue({ id: 'strat1', companyId: 'rec1', goalStatement: 'Grow' }),
}));

vi.mock('@/lib/contextGraph/fieldStoreV4', () => ({
  getFieldCountsV4: vi.fn().mockResolvedValue({ confirmed: 3 }),
  getConfirmedFieldsV4: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/os/ai/gapBusinessSummary', () => ({
  getGapBusinessSummary: vi.fn().mockResolvedValue({ summary: 'GAP summary about the business connecting trainers and clients.', source: 'gapIa' }),
}));

vi.mock('@/lib/os/ai/buildStrategyFieldPrompt', () => ({
  buildStrategyFieldPrompt: vi.fn().mockReturnValue({
    systemPrompt: 'sys',
    userPrompt: 'user',
    contract: { id: 'valueProp', outputSpec: { variants: 3 } },
    variantCount: 3,
    generatedUsing: {
      primaryLabels: [],
      constraintLabels: [],
      missingPrimaryKeys: [],
      missingBusinessDefinitionKeys: ['audience.icpDescription'],
      categorySafetyMode: false,
      goalAlignmentActive: false,
      businessDefinitionMissing: true,
      usedFallbackKeys: ['gap.businessSummary'],
      fallbackLabels: ['GAP summary'],
      usedPrimaryKeys: [],
      usedConstraintKeys: [],
      usedSecondaryKeys: [],
    },
  }),
  createSnapshotFromFields: vi.fn().mockReturnValue({ fields: {} }),
}));

vi.mock('@/lib/ai/safeCall', () => ({
  safeAiCall: vi.fn().mockResolvedValue({
    ok: true,
    value: { content: [{ type: 'text', text: '{"variants":[{"text":"One"}]}' }] },
  }),
}));

vi.mock('@/lib/os/ai/validateGeneratedVariants', () => ({
  validateGeneratedVariants: vi.fn().mockReturnValue({ valid: true, warnings: [], summary: null }),
  parseVariantsFromOutput: vi.fn().mockReturnValue({ variants: ['One'], parseMethod: 'json' }),
}));

describe('strategy suggest route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('includes GAP fallback metadata in response', async () => {
    const body = {
      strategyId: 'strat1',
      fieldKey: 'valueProp',
    };

    const request = {
      json: async () => body,
    } as any;

    const response = await POST(request, { params: Promise.resolve({ companyId: 'rec1' }) });
    const data = await response.json();

    expect(data.generatedUsing.usedFallback).toContain('GAP summary');
    expect(data.generatedUsing.businessDefinitionMissing).toBe(true);
  });
});




