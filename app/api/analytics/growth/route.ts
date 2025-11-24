// app/api/os/analytics/growth/route.ts
// API endpoint for fetching growth analytics snapshot

import { NextRequest, NextResponse } from 'next/server';
import { getGrowthAnalyticsSnapshot, getDefaultDateRange } from '@/lib/analytics/growthAnalytics';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    // Use provided dates or default to last 30 days
    let startDate: string;
    let endDate: string;

    if (start && end) {
      startDate = start;
      endDate = end;
    } else {
      const defaultRange = getDefaultDateRange(30);
      startDate = defaultRange.startDate;
      endDate = defaultRange.endDate;
    }

    console.log('[API /os/analytics/growth] Fetching snapshot', { startDate, endDate });

    const snapshot = await getGrowthAnalyticsSnapshot(startDate, endDate);

    return NextResponse.json({ snapshot });
  } catch (error) {
    console.error('[API /os/analytics/growth] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
