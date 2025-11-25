// app/api/os/analytics/workspace/route.ts
// Workspace Analytics API - Layer B
// Returns aggregated analytics with anomaly detection and insights

import { NextRequest, NextResponse } from 'next/server';
import {
  getWorkspaceAnalytics,
  getWorkspaceAnalyticsLast7Days,
  getWorkspaceAnalyticsLast30Days,
} from '@/lib/os/analytics/workspace';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Shortcut periods
    const period = searchParams.get('period');
    const siteId = searchParams.get('siteId') || undefined;

    if (period === '7d') {
      const analytics = await getWorkspaceAnalyticsLast7Days(siteId);
      return NextResponse.json({ ok: true, analytics });
    }

    if (period === '30d') {
      const analytics = await getWorkspaceAnalyticsLast30Days(siteId);
      return NextResponse.json({ ok: true, analytics });
    }

    // Custom date range
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

    const includePreviousPeriod = searchParams.get('comparePrevious') !== 'false';

    console.log('[Workspace Analytics API] Fetching...', { startDate, endDate, siteId });

    const analytics = await getWorkspaceAnalytics({
      startDate,
      endDate,
      siteId,
      includePreviousPeriod,
    });

    return NextResponse.json({ ok: true, analytics });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Workspace Analytics API] Error:', errorMessage);

    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}
