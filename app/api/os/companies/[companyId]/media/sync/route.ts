// app/api/os/companies/[companyId]/media/sync/route.ts
// API route to trigger media data sync for a company
//
// POST /api/os/companies/[companyId]/media/sync
// Body (optional):
// {
//   "startDate": "2024-01-01",  // ISO date string
//   "endDate": "2024-01-31",    // ISO date string
//   "sources": ["GA4", "GBP"],  // Optional: only sync specific sources
//   "verbose": true             // Optional: enable verbose logging
// }

import { NextRequest, NextResponse } from 'next/server';
import { syncMediaForCompany } from '@/lib/media/sync';
import type { MediaDateRange, SourceSystem } from '@/lib/types/media';
import { getDateRangeFromPreset } from '@/lib/types/media';

interface SyncRequestBody {
  startDate?: string;
  endDate?: string;
  sources?: SourceSystem[];
  verbose?: boolean;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const resolvedParams = await params;
  const { companyId } = resolvedParams;

  if (!companyId) {
    return NextResponse.json(
      { error: 'Company ID is required' },
      { status: 400 }
    );
  }

  try {
    // Parse request body
    let body: SyncRequestBody = {};
    try {
      const text = await request.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch {
      // No body or invalid JSON, use defaults
    }

    // Build date range
    let dateRange: MediaDateRange;
    if (body.startDate && body.endDate) {
      dateRange = {
        start: new Date(body.startDate),
        end: new Date(body.endDate),
      };
    } else {
      // Default to last 30 days
      dateRange = getDateRangeFromPreset('last30');
    }

    console.log('[Media Sync API] Starting sync:', {
      companyId,
      dateRange: {
        start: dateRange.start.toISOString().split('T')[0],
        end: dateRange.end.toISOString().split('T')[0],
      },
      sources: body.sources,
    });

    // Run the sync
    const result = await syncMediaForCompany(companyId, dateRange, {
      sources: body.sources,
      verbose: body.verbose,
    });

    return NextResponse.json({
      ok: result.success,
      result: {
        companyId: result.companyId,
        dateRange: {
          start: result.dateRange.start.toISOString().split('T')[0],
          end: result.dateRange.end.toISOString().split('T')[0],
        },
        pointsCreated: result.pointsCreated,
        pointsUpdated: result.pointsUpdated,
        sourcesProcessed: result.sourcesProcessed,
        errors: result.errors,
        duration: result.duration,
      },
    });
  } catch (error) {
    console.error('[Media Sync API] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Sync failed',
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check sync status/info
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const resolvedParams = await params;
  const { companyId } = resolvedParams;

  return NextResponse.json({
    ok: true,
    companyId,
    message: 'Use POST to trigger a media sync',
    usage: {
      method: 'POST',
      body: {
        startDate: 'ISO date string (optional, defaults to 30 days ago)',
        endDate: 'ISO date string (optional, defaults to today)',
        sources: 'Array of source systems to sync (optional)',
        verbose: 'Enable verbose logging (optional)',
      },
      example: {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        sources: ['GA4', 'GBP'],
        verbose: true,
      },
    },
  });
}
