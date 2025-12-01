// app/api/analytics/v2/company/[companyId]/insights/route.ts
// AI-powered analytics insights for a company
//
// This endpoint generates strategic insights from the company's analytics data
// using the AI Gateway with company memory integration.

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import { buildCompanyAnalyticsSnapshot } from '@/lib/analytics/service';
import { generateAnalyticsInsights } from '@/lib/analytics/insights';
import type { AnalyticsDateRangePreset } from '@/lib/analytics/types';

export const maxDuration = 120; // 2 minutes timeout for AI processing

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

    console.log('[API /analytics/v2/company/insights] Generating insights for:', {
      companyId,
      companyName: company.name,
      range,
    });

    // Build the analytics snapshot first
    const snapshot = await buildCompanyAnalyticsSnapshot(company, range);

    // Generate AI insights
    const insights = await generateAnalyticsInsights(companyId, snapshot);

    return NextResponse.json({
      ok: true,
      snapshot,
      insights,
    });
  } catch (error) {
    console.error('[API /analytics/v2/company/insights] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
