// lib/gap/airtable.ts
import { airtableBase } from '@/lib/airtable';

export type GapRunRecord = {
  id: string;
  planId: string;
  snapshotId?: string;
  url: string;
  businessName: string;
  overallScore: number;
  brandScore: number;
  websiteScore: number;
  contentScore: number;
  seoScore: number;
  maturityStage: string;
  quickWinsCount: number;
  initiativesCount: number;
  createdAt?: string;
};

export async function fetchRecentGapRuns(limit = 10): Promise<GapRunRecord[]> {
  const table = airtableBase('GAP Runs');

  const records = await table
    .select({
      maxRecords: limit,
      sort: [{ field: 'Created At', direction: 'desc' }],
    })
    .all();

  return records.map((r) => ({
    id: r.id,
    planId: (r.get('Plan ID') as string) ?? '',
    snapshotId: (r.get('Snapshot ID') as string) ?? undefined,
    url: (r.get('URL') as string) ?? '',
    businessName: (r.get('Business Name') as string) ?? '',
    overallScore: (r.get('Overall Score') as number) ?? 0,
    brandScore: (r.get('Brand Score') as number) ?? 0,
    websiteScore: (r.get('Website Score') as number) ?? 0,
    contentScore: (r.get('Content Score') as number) ?? 0,
    seoScore: (r.get('SEO Score') as number) ?? 0,
    maturityStage: (r.get('Maturity Stage') as string) ?? '',
    quickWinsCount: (r.get('Quick Wins Count') as number) ?? 0,
    initiativesCount: (r.get('Initiatives Count') as number) ?? 0,
    createdAt: (r.get('Created At') as string) ?? undefined,
  }));
}
