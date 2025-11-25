// app/api/os/analytics/gsc/route.ts
// Raw Google Search Console Data API - Layer A
// Returns GSC search analytics data for specified date range

import { NextRequest, NextResponse } from 'next/server';
import { getSearchConsoleSnapshot } from '@/lib/analytics/searchConsoleAnalytics';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Get date range from query params (default to last 30 days)
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];
    const startDateParam = searchParams.get('startDate');
    let startDate: string;

    if (startDateParam) {
      startDate = startDateParam;
    } else {
      const start = new Date();
      start.setDate(start.getDate() - 30);
      startDate = start.toISOString().split('T')[0];
    }

    // Optional site ID for multi-site support
    const siteId = searchParams.get('siteId') || undefined;

    console.log('[GSC API] Fetching data...', { startDate, endDate, siteId });

    const data = await getSearchConsoleSnapshot(startDate, endDate, siteId);

    // Calculate summary metrics
    const totalClicks = data.queries.reduce((sum, q) => sum + q.clicks, 0);
    const totalImpressions = data.queries.reduce((sum, q) => sum + q.impressions, 0);
    const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
    const avgPosition = data.queries.length > 0
      ? data.queries.reduce((sum, q) => sum + (q.position || 0), 0) / data.queries.length
      : 0;

    return NextResponse.json({
      ok: true,
      period: { startDate, endDate },
      generatedAt: new Date().toISOString(),
      summary: {
        totalClicks,
        totalImpressions,
        avgCtr,
        avgPosition,
      },
      queries: data.queries,
      pages: data.pages,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[GSC API] Error:', errorMessage);

    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}
