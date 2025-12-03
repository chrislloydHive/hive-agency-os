// app/api/os/media-lab/analytics/route.ts
// API route for Media Analytics summary

import { NextRequest, NextResponse } from 'next/server';
import { getMediaAnalyticsSummary, getPerformanceSnapshot } from '@/lib/mediaLab/analytics';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const companyId = searchParams.get('companyId');
    const mode = searchParams.get('mode') || 'full'; // 'full' or 'snapshot'
    const days = parseInt(searchParams.get('days') || '30', 10);

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'companyId is required' },
        { status: 400 }
      );
    }

    if (mode === 'snapshot') {
      const snapshot = await getPerformanceSnapshot(companyId);
      return NextResponse.json({ success: true, snapshot });
    }

    const summary = await getMediaAnalyticsSummary(companyId, days);
    return NextResponse.json({ success: true, summary });
  } catch (error) {
    console.error('[API] Failed to fetch media analytics:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
