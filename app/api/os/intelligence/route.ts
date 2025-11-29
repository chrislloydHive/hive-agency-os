// app/api/os/intelligence/route.ts
// API route for OS Intelligence data

import { NextResponse } from 'next/server';
import { computeOSIntelligence, invalidateOSHealthCache } from '@/lib/intelligence/osIntelligence';

export async function GET() {
  try {
    const data = await computeOSIntelligence();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[OS Intelligence API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to compute OS intelligence' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Handle cache invalidation
    if (body.action === 'invalidate') {
      invalidateOSHealthCache();
      return NextResponse.json({ success: true, message: 'Cache invalidated' });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[OS Intelligence API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
