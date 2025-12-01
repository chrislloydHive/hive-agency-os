// app/api/analytics/v2/workspace/route.ts
// Workspace-level Analytics API
//
// Returns aggregated analytics across all companies for the global OS dashboard.

import { NextRequest, NextResponse } from 'next/server';
import { buildWorkspaceAnalyticsSummary } from '@/lib/analytics/workspaceService';
import type { AnalyticsDateRangePreset } from '@/lib/analytics/types';

export const maxDuration = 300; // 5 minutes timeout for aggregating all companies

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const range = (searchParams.get('range') || '30d') as AnalyticsDateRangePreset;

    // Validate range parameter
    if (!['7d', '30d', '90d'].includes(range)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid range parameter. Must be 7d, 30d, or 90d.' },
        { status: 400 }
      );
    }

    console.log('[API /analytics/v2/workspace] Fetching workspace analytics for range:', range);

    const summary = await buildWorkspaceAnalyticsSummary(range);

    return NextResponse.json({
      ok: true,
      summary,
    });
  } catch (error) {
    console.error('[API /analytics/v2/workspace] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
