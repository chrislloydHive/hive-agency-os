// app/api/os/analytics/blueprint/data/route.ts
// API Route: Fetch data for an Analytics Blueprint
//
// Given a company ID and date range, fetches the GA4/GSC data
// for all metrics defined in the company's Analytics Blueprint.

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import { fetchBlueprintData } from '@/lib/analytics/blueprintDataFetcher';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');

    // Validate required params
    if (!companyId) {
      return NextResponse.json(
        { ok: false, error: 'Missing companyId query parameter' },
        { status: 400 }
      );
    }

    // Default to last 30 days if no dates provided
    const now = new Date();
    const defaultEnd = now.toISOString().split('T')[0];
    const defaultStart = new Date(now.setDate(now.getDate() - 30)).toISOString().split('T')[0];

    const resolvedStartDate = startDate || defaultStart;
    const resolvedEndDate = endDate || defaultEnd;

    console.log('[Blueprint Data API] Fetching data...', {
      companyId,
      startDate: resolvedStartDate,
      endDate: resolvedEndDate,
    });

    // Fetch company
    const company = await getCompanyById(companyId);

    console.log('[Blueprint Data API] Company analytics config:', {
      companyName: company?.name,
      ga4PropertyId: company?.ga4PropertyId,
      searchConsoleSiteUrl: company?.searchConsoleSiteUrl,
      hasBlueprint: !!company?.analyticsBlueprint,
      blueprintMetrics: company?.analyticsBlueprint?.primaryMetrics?.map((m: any) => m.id),
    });

    if (!company) {
      return NextResponse.json(
        { ok: false, error: 'Company not found' },
        { status: 404 }
      );
    }

    // Check for blueprint
    if (!company.analyticsBlueprint) {
      return NextResponse.json(
        {
          ok: false,
          error: 'No Analytics Blueprint configured for this company',
          hint: 'Generate a blueprint first using POST /api/os/analytics/blueprint',
        },
        { status: 400 }
      );
    }

    // Resolve GA4 property ID (from company or fallback)
    const ga4PropertyId = company.ga4PropertyId
      ? (company.ga4PropertyId.startsWith('properties/')
          ? company.ga4PropertyId
          : `properties/${company.ga4PropertyId}`)
      : process.env.GA4_PROPERTY_ID;

    // Resolve GSC site URL (from company or fallback)
    const gscSiteUrl = company.searchConsoleSiteUrl || process.env.SEARCH_CONSOLE_SITE_URL;

    // Fetch data for all metrics in the blueprint (with caching)
    const result = await fetchBlueprintData(company.analyticsBlueprint, {
      companyId,
      ga4PropertyId,
      gscSiteUrl,
      startDate: resolvedStartDate,
      endDate: resolvedEndDate,
    });

    console.log('[Blueprint Data API] Data fetched:', {
      companyId,
      companyName: company.name,
      primaryMetrics: result.primaryMetrics.length,
      secondaryMetrics: result.secondaryMetrics.length,
      errors: result.errors.length,
    });

    // Log details about the fetched data
    console.log('[Blueprint Data API] Primary metrics details:',
      result.primaryMetrics.map(m => ({
        id: m.metric.id,
        chartType: m.metric.chartType,
        pointsCount: m.points.length,
        currentValue: m.currentValue,
        firstPoint: m.points[0],
      }))
    );

    return NextResponse.json({
      ok: true,
      data: result,
      dateRange: {
        startDate: resolvedStartDate,
        endDate: resolvedEndDate,
      },
      company: {
        id: company.id,
        name: company.name,
        hasGa4: !!ga4PropertyId,
        hasGsc: !!gscSiteUrl,
      },
    });
  } catch (error) {
    console.error('[Blueprint Data API] Error:', error);

    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
