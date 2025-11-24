import { NextRequest, NextResponse } from 'next/server';
import { getAuditFunnelSnapshot } from '@/lib/ga4Client';

/**
 * GET /api/os/dma/metrics
 * Returns GA4 audit funnel metrics for a date range
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Get date range from query params or default to last 30 days
    let startDate = searchParams.get('start');
    let endDate = searchParams.get('end');

    if (!startDate || !endDate) {
      const today = new Date();
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(today.getDate() - 29);

      endDate = today.toISOString().split('T')[0];
      startDate = thirtyDaysAgo.toISOString().split('T')[0];
    }

    // Fetch snapshot from GA4
    const snapshot = await getAuditFunnelSnapshot(startDate, endDate);

    return NextResponse.json({ snapshot });
  } catch (error) {
    console.error('Error fetching DMA metrics:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return NextResponse.json(
      { error: `Failed to fetch metrics: ${errorMessage}` },
      { status: 500 }
    );
  }
}
