// app/api/gap/lookup/route.ts
// Lookup GAP run data by domain/URL for auto-filling company creation
// Returns company name, scores, maturity stage, and company type from GAP data

import { NextRequest, NextResponse } from 'next/server';
import { base } from '@/lib/airtable/client';
import { extractDomain } from '@/lib/utils/extractDomain';

export interface GapLookupResult {
  found: boolean;
  source?: 'gap-plan' | 'gap-ia';
  data?: {
    companyName?: string;
    domain: string;
    url: string;
    overallScore?: number;
    maturityStage?: string;
    companyType?: string;
    scores?: {
      brand?: number;
      content?: number;
      seo?: number;
      website?: number;
    };
    createdAt?: string;
    // If already linked to a company
    existingCompanyId?: string;
  };
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'url parameter required' }, { status: 400 });
  }

  const domain = extractDomain(url);
  if (!domain) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  console.log('[GAP Lookup] Searching for domain:', domain);

  try {
    // First try GAP-Plan Run table (more complete data)
    const gapPlanResult = await searchGapPlanRuns(domain);
    if (gapPlanResult.found) {
      console.log('[GAP Lookup] Found in GAP-Plan Run:', gapPlanResult.data?.companyName);
      return NextResponse.json(gapPlanResult);
    }

    // Fall back to GAP-IA Run table
    const gapIaResult = await searchGapIaRuns(domain);
    if (gapIaResult.found) {
      console.log('[GAP Lookup] Found in GAP-IA Run:', gapIaResult.data?.companyName);
      return NextResponse.json(gapIaResult);
    }

    // Not found
    console.log('[GAP Lookup] No GAP data found for domain:', domain);
    return NextResponse.json({ found: false });

  } catch (error) {
    console.error('[GAP Lookup] Error:', error);
    return NextResponse.json({ error: 'Failed to lookup GAP data' }, { status: 500 });
  }
}

async function searchGapPlanRuns(domain: string): Promise<GapLookupResult> {
  try {
    // Search for completed GAP-Plan runs with matching domain
    const records = await base('GAP-Plan Run')
      .select({
        filterByFormula: `AND({Status} = 'completed', FIND('${domain}', {URL}))`,
        sort: [{ field: 'Created At', direction: 'desc' }],
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) {
      return { found: false };
    }

    const record = records[0];
    const fields = record.fields;

    // Parse Data JSON if available
    let dataJson: any = {};
    const dataJsonStr = fields['Data JSON'] as string | undefined;
    if (dataJsonStr) {
      try {
        dataJson = JSON.parse(dataJsonStr);
      } catch {
        console.warn('[GAP Lookup] Failed to parse Data JSON');
      }
    }

    // Extract company name from various possible locations
    const companyName =
      dataJson.companyName ||
      dataJson.growthPlan?.companyName ||
      dataJson.company?.name ||
      (fields['Company Name'] as string) ||
      undefined;

    // Extract company type
    const companyType =
      (fields['Company Type'] as string) ||
      dataJson.companyType ||
      dataJson.businessModel ||
      undefined;

    // Get existing company ID if linked (must be Airtable record ID starting with 'rec')
    const companyLinks = fields['Company'] as string[] | undefined;
    const rawCompanyId = companyLinks?.[0] || (fields['Company ID'] as string);
    const existingCompanyId = typeof rawCompanyId === 'string' && rawCompanyId.startsWith('rec')
      ? rawCompanyId
      : undefined;

    return {
      found: true,
      source: 'gap-plan',
      data: {
        companyName,
        domain,
        url: fields['URL'] as string || `https://${domain}`,
        overallScore: fields['Overall Score'] as number | undefined,
        maturityStage: (fields['Maturity Stage'] as string) || dataJson.maturityStage,
        companyType,
        scores: {
          brand: fields['Brand Score'] as number | undefined,
          content: fields['Content Score'] as number | undefined,
          seo: fields['SEO Score'] as number | undefined,
          website: fields['Website Score'] as number | undefined,
        },
        createdAt: fields['Created At'] as string | undefined,
        existingCompanyId,
      },
    };
  } catch (error) {
    console.error('[GAP Lookup] Error searching GAP-Plan runs:', error);
    return { found: false };
  }
}

async function searchGapIaRuns(domain: string): Promise<GapLookupResult> {
  try {
    // Search for completed GAP-IA runs with matching domain
    const records = await base('GAP-IA Run')
      .select({
        filterByFormula: `AND({Status} = 'completed', FIND('${domain}', {Website URL}))`,
        sort: [{ field: 'Created At', direction: 'desc' }],
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) {
      return { found: false };
    }

    const record = records[0];
    const fields = record.fields;

    // Parse Data JSON if available
    let dataJson: any = {};
    const dataJsonStr = fields['Data JSON'] as string | undefined;
    if (dataJsonStr) {
      try {
        dataJson = JSON.parse(dataJsonStr);
      } catch {
        console.warn('[GAP Lookup] Failed to parse GAP-IA Data JSON');
      }
    }

    // Extract company name from core context
    const companyName =
      dataJson.core?.companyName ||
      dataJson.companyName ||
      (fields['Company Name'] as string) ||
      undefined;

    // Extract company type from core context
    const companyType =
      dataJson.core?.businessModel ||
      dataJson.companyType ||
      undefined;

    // Get existing company ID if linked (must be Airtable record ID starting with 'rec')
    const rawCompanyId = dataJson.companyId;
    const existingCompanyId = typeof rawCompanyId === 'string' && rawCompanyId.startsWith('rec')
      ? rawCompanyId
      : undefined;

    // Extract scores from dataJson
    const scores = dataJson.scores || {};

    return {
      found: true,
      source: 'gap-ia',
      data: {
        companyName,
        domain: (fields['Domain'] as string) || domain,
        url: (fields['Website URL'] as string) || `https://${domain}`,
        overallScore: scores.overall || dataJson.overallScore,
        maturityStage: dataJson.maturityStage,
        companyType,
        scores: {
          brand: scores.brand,
          content: scores.content,
          seo: scores.seo,
          website: scores.website,
        },
        createdAt: fields['Created At'] as string | undefined,
        existingCompanyId,
      },
    };
  } catch (error) {
    console.error('[GAP Lookup] Error searching GAP-IA runs:', error);
    return { found: false };
  }
}
