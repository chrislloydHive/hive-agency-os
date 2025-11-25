import { NextRequest, NextResponse } from 'next/server';
import { getAuditFunnelSnapshot } from '@/lib/ga4Client';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing start or end date parameters' },
        { status: 400 }
      );
    }

    const snapshot = await getAuditFunnelSnapshot(startDate, endDate);

    return NextResponse.json({ snapshot });
  } catch (error) {
    console.error('[DMA Metrics API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}
