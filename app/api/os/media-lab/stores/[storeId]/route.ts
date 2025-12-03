// app/api/os/media-lab/stores/[storeId]/route.ts
// API route for store-level analytics

import { NextRequest, NextResponse } from 'next/server';
import { getStoreAnalyticsDetail } from '@/lib/mediaLab/storeAnalytics';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string }> }
) {
  try {
    const { storeId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const companyId = searchParams.get('companyId');
    const days = parseInt(searchParams.get('days') || '30', 10);

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'companyId is required' },
        { status: 400 }
      );
    }

    const storeAnalytics = await getStoreAnalyticsDetail(companyId, storeId, days);

    if (!storeAnalytics) {
      return NextResponse.json(
        { success: false, error: 'Store not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: storeAnalytics });
  } catch (error) {
    console.error('[API] Failed to fetch store analytics:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
