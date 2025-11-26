// app/api/os/companies/[companyId]/analytics/ai-insights/route.ts
// Company Analytics AI Insights API
// Generates actionable insights for a specific company

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import { buildCompanyAnalyticsInput } from '@/lib/os/companies/analyticsData';
import { generateCompanyAnalyticsInsights } from '@/lib/os/companies/analyticsAi';
import type {
  CompanyAnalyticsDateRangePreset,
  CompanyAnalyticsApiResponse,
} from '@/lib/os/companies/analyticsTypes';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

/**
 * GET /api/os/companies/[companyId]/analytics/ai-insights
 * Query params:
 * - range: "7d" | "30d" | "90d" (default: "30d")
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  console.log('[CompanyAnalyticsInsights API] Request received');

  try {
    const { companyId } = await params;
    const searchParams = request.nextUrl.searchParams;

    // Parse range parameter
    const rangeParam = searchParams.get('range');
    let preset: CompanyAnalyticsDateRangePreset = '30d';
    if (rangeParam === '7d' || rangeParam === '30d' || rangeParam === '90d') {
      preset = rangeParam;
    }

    console.log('[CompanyAnalyticsInsights API] Params:', { companyId, preset });

    // Fetch company
    const company = await getCompanyById(companyId);
    if (!company) {
      const response: CompanyAnalyticsApiResponse = {
        ok: false,
        error: 'Company not found',
      };
      return NextResponse.json(response, { status: 404 });
    }

    console.log('[CompanyAnalyticsInsights API] Company:', {
      name: company.name,
      hasGa4: !!company.ga4PropertyId,
      hasGsc: !!company.searchConsoleSiteUrl,
    });

    // Build analytics input
    const input = await buildCompanyAnalyticsInput(company, preset);

    // Generate AI insights (using aiForCompany for memory-aware AI)
    const insights = await generateCompanyAnalyticsInsights(companyId, input);

    console.log('[CompanyAnalyticsInsights API] Insights generated:', {
      company: company.name,
      keyInsights: insights.keyInsights.length,
      workSuggestions: insights.workSuggestions.length,
    });

    const response: CompanyAnalyticsApiResponse = {
      ok: true,
      input,
      insights,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error('[CompanyAnalyticsInsights API] Error:', errorMessage);

    const response: CompanyAnalyticsApiResponse = {
      ok: false,
      error: 'Failed to generate company analytics insights',
    };

    return NextResponse.json(response, { status: 500 });
  }
}
