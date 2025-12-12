// app/api/os/analytics/get/route.ts
// GET endpoint for Analytics Lab data
//
// Returns the latest analytics snapshot and 90-day trend data
// for the Analytics Lab visualization.

import { NextRequest, NextResponse } from 'next/server';
import { getAnalyticsSnapshot } from '@/lib/analytics/getAnalyticsSnapshot';
import { getAnalyticsFindings } from '@/lib/os/analyticsAi/getAnalyticsFindings';
import type { AnalyticsRange } from '@/lib/types/companyAnalytics';
import type { AnalyticsLabResponse, AnalyticsNarrative } from '@/lib/analytics/analyticsTypes';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const companyId = searchParams.get('companyId');
  const range = (searchParams.get('range') || '28d') as AnalyticsRange;
  const includeFindings = searchParams.get('includeFindings') !== 'false';
  const includeTrends = searchParams.get('includeTrends') !== 'false';

  if (!companyId) {
    return NextResponse.json(
      { ok: false, error: 'Missing companyId parameter' },
      { status: 400 }
    );
  }

  try {
    console.log('[Analytics GET] Fetching analytics:', { companyId, range });

    // Fetch snapshot and trends
    const { snapshot, trends } = await getAnalyticsSnapshot({
      companyId,
      range,
      includeTrends,
    });

    // Fetch findings if requested
    let findings: AnalyticsLabResponse['findings'] = [];
    if (includeFindings) {
      try {
        findings = await getAnalyticsFindings(companyId);
      } catch (error) {
        console.error('[Analytics GET] Error fetching findings:', error);
        // Continue without findings
      }
    }

    // Build response
    const response: AnalyticsLabResponse = {
      snapshot,
      trends: trends ?? {
        sessions: [],
        conversions: [],
        organicClicks: [],
        organicImpressions: [],
        gbpActions: [],
        mediaSpend: [],
        cpa: [],
        roas: [],
      },
      findings,
    };

    // Try to get cached narrative if available
    // For now, narrative is generated on refresh only
    const narrative: AnalyticsNarrative | undefined = undefined;
    if (narrative) {
      response.narrative = narrative;
    }

    console.log('[Analytics GET] Success:', {
      companyId,
      hasGa4: snapshot.hasGa4,
      hasGsc: snapshot.hasGsc,
      findingsCount: findings.length,
    });

    return NextResponse.json({
      ok: true,
      data: response,
    });
  } catch (error) {
    console.error('[Analytics GET] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to fetch analytics',
      },
      { status: 500 }
    );
  }
}
