// app/api/os/analytics/overview/route.ts
// Workspace Analytics Overview API
// Returns comprehensive analytics overview with GA4, GSC, funnel, and alerts

import { NextRequest, NextResponse } from 'next/server';
import {
  getWorkspaceAnalyticsOverview,
  parseDateRangePreset,
} from '@/lib/os/analytics/overview';
import { createDateRange } from '@/lib/os/analytics/ga4';
import type { WorkspaceDateRange, DateRangePreset } from '@/lib/os/analytics/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse parameters
    const preset = searchParams.get('preset') as DateRangePreset | null;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const workspaceId = searchParams.get('workspaceId') || undefined;
    const includeFunnel = searchParams.get('includeFunnel') !== 'false';
    const includeAlerts = searchParams.get('includeAlerts') !== 'false';

    // Build date range
    let range: WorkspaceDateRange;

    if (startDate && endDate) {
      // Custom date range
      range = {
        startDate,
        endDate,
        preset: '30d', // Default for custom ranges
      };
    } else if (preset) {
      // Preset range
      range = createDateRange(parseDateRangePreset(preset));
    } else {
      // Default to 30 days
      range = createDateRange('30d');
    }

    console.log('[Overview API] Fetching analytics...', {
      range,
      workspaceId,
      includeFunnel,
      includeAlerts,
    });

    const overview = await getWorkspaceAnalyticsOverview({
      range,
      workspaceId,
      includeFunnel,
      includeAlerts,
    });

    return NextResponse.json({
      ok: true,
      overview,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Overview API] Error:', errorMessage);

    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}
