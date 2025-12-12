// app/api/os/analytics/ai-narrative/route.ts
// Generate AI narrative from analytics snapshot

import { NextRequest, NextResponse } from 'next/server';
import { getAnalyticsSnapshotLite, generateAnalyticsNarrative } from '@/lib/os/analyticsLite';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId } = body;

    if (!companyId) {
      return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
    }

    // First get the snapshot
    const snapshot = await getAnalyticsSnapshotLite(companyId);

    if (!snapshot) {
      return NextResponse.json(
        { error: 'No analytics data available' },
        { status: 404 }
      );
    }

    // Generate narrative from snapshot
    const narrative = await generateAnalyticsNarrative(companyId, snapshot);

    return NextResponse.json({
      narrative,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API] analytics/ai-narrative error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate narrative' },
      { status: 500 }
    );
  }
}
