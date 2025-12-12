// app/api/os/analytics/snapshot-lite/route.ts
// Get lightweight analytics snapshot

import { NextRequest, NextResponse } from 'next/server';
import { getAnalyticsSnapshotLite } from '@/lib/os/analyticsLite';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
    }

    const snapshot = await getAnalyticsSnapshotLite(companyId);

    return NextResponse.json({ snapshot });
  } catch (error) {
    console.error('[API] analytics/snapshot-lite error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get analytics snapshot' },
      { status: 500 }
    );
  }
}
