// app/api/os/analytics/ga4/route.ts
// Raw GA4 Data API - Layer A
// Returns GA4 analytics data for specified date range

import { NextRequest, NextResponse } from 'next/server';
import { getGa4AnalyticsSnapshot } from '@/lib/analytics/ga4Analytics';

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

    console.log('[GA4 API] Fetching data...', { startDate, endDate, siteId });

    const data = await getGa4AnalyticsSnapshot(startDate, endDate, siteId);

    return NextResponse.json({
      ok: true,
      period: { startDate, endDate },
      generatedAt: new Date().toISOString(),
      traffic: data.traffic,
      channels: data.channels,
      landingPages: data.topLandingPages,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[GA4 API] Error:', errorMessage);

    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}
