// app/api/briefing/daily/route.ts
// API route for AI-enhanced Daily Briefing

import { NextResponse } from 'next/server';
import {
  generateDailyBriefing,
  invalidateBriefingCache,
  filterBriefingForRole,
  type BriefingRole,
} from '@/lib/intelligence/dailyBriefing';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get('refresh') === 'true';
    const useAI = url.searchParams.get('ai') !== 'false'; // Default true
    const role = url.searchParams.get('role') as BriefingRole | null;

    console.log('[Briefing API] GET:', { forceRefresh, useAI, role });

    const briefing = await generateDailyBriefing({
      forceRefresh,
      useAI,
    });

    // Apply role filter if specified
    const result = role ? filterBriefingForRole(briefing, role) : briefing;

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Briefing API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate daily briefing' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Handle cache invalidation
    if (body.action === 'invalidate') {
      invalidateBriefingCache();
      return NextResponse.json({ success: true, message: 'Cache invalidated' });
    }

    // Handle force refresh
    if (body.action === 'refresh') {
      const briefing = await generateDailyBriefing({
        forceRefresh: true,
        useAI: body.useAI !== false,
        role: body.role,
      });

      const result = body.role ? filterBriefingForRole(briefing, body.role) : briefing;
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[Briefing API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
