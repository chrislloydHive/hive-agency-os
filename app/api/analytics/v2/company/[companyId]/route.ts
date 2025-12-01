// app/api/analytics/v2/company/[companyId]/route.ts
// Unified Analytics API v2 for Company-level analytics
//
// This endpoint returns the complete CompanyAnalyticsSnapshot including:
// - GA4 metrics, traffic sources, top pages, device breakdown, time series
// - Search Console metrics, queries, pages, time series
// - DMA/GAP-IA funnel metrics with attribution
// - Period-over-period comparison

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import { buildCompanyAnalyticsSnapshot } from '@/lib/analytics/service';
import type { AnalyticsDateRangePreset, CompanyAnalyticsApiResponse } from '@/lib/analytics/types';

export const maxDuration = 60; // 60 seconds timeout

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { companyId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const range = (searchParams.get('range') || '30d') as AnalyticsDateRangePreset;

    // Validate range parameter
    if (!['7d', '30d', '90d'].includes(range)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid range parameter. Must be 7d, 30d, or 90d.' },
        { status: 400 }
      );
    }

    // Get company details
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json(
        { ok: false, error: 'Company not found' },
        { status: 404 }
      );
    }

    console.log('[API /analytics/v2/company] Fetching analytics for:', {
      companyId,
      companyName: company.name,
      range,
      ga4PropertyId: company.ga4PropertyId,
      searchConsoleSiteUrl: company.searchConsoleSiteUrl,
    });

    // Build the complete analytics snapshot
    const snapshot = await buildCompanyAnalyticsSnapshot(company, range);

    const response: CompanyAnalyticsApiResponse = {
      ok: true,
      snapshot,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[API /analytics/v2/company] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
