// app/api/os/today/route.ts
// API route for Today Intelligence data (Daily Briefing)

import { NextResponse } from 'next/server';
import { computeDailyBriefing, invalidateDailyBriefingCache } from '@/lib/intelligence/osIntelligence';

export async function GET() {
  try {
    const data = await computeDailyBriefing();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Today Intelligence API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to compute daily briefing' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Handle cache invalidation
    if (body.action === 'invalidate') {
      invalidateDailyBriefingCache();
      return NextResponse.json({ success: true, message: 'Cache invalidated' });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[Today Intelligence API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
