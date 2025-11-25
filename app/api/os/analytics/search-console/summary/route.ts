// app/api/os/analytics/search-console/summary/route.ts
// Workspace-level Search Console Summary API
// Returns comprehensive GSC snapshot for the main OS site

import { NextRequest, NextResponse } from 'next/server';
import {
  fetchSearchConsoleSnapshot,
  resolveDateRange,
} from '@/lib/os/searchConsole/snapshot';
import { getGscConnectionStatus } from '@/lib/os/searchConsole/client';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse date range parameters
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const workspaceId = searchParams.get('workspaceId') || undefined;

    // Resolve date range (defaults to last 30 days)
    const range = resolveDateRange(start, end, 30);

    console.log('[SearchConsole Summary API] Fetching data...', {
      range,
      workspaceId,
    });

    // Check connection status first
    const connectionStatus = await getGscConnectionStatus(workspaceId);

    if (!connectionStatus.connected) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Search Console not configured',
          hint: 'Set SEARCH_CONSOLE_SITE_URL environment variable or configure via workspace settings.',
        },
        { status: 400 }
      );
    }

    const siteUrl = connectionStatus.siteUrl!;

    // Fetch snapshot
    const snapshot = await fetchSearchConsoleSnapshot({
      siteUrl,
      range,
      maxRows: 50,
      workspaceId,
    });

    return NextResponse.json({
      ok: true,
      snapshot,
      meta: {
        source: connectionStatus.source,
        connectedAt: connectionStatus.connectedAt,
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error('[SearchConsole Summary API] Error:', errorMessage);

    // Handle specific error types
    if (errorMessage.includes('Permission denied')) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Permission denied',
          detail: errorMessage,
          hint: 'Ensure the Google account has access to this Search Console property.',
        },
        { status: 403 }
      );
    }

    if (errorMessage.includes('not found')) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Site not found',
          detail: errorMessage,
          hint: 'Verify the Search Console site URL matches exactly with what appears in GSC.',
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}
