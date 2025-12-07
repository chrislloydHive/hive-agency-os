// app/api/os/companies/[companyId]/context/graph/route.ts
// Context Graph v3 API
//
// Returns the structured Context Graph v3 snapshot for visualization.
// Supports snapshot selection and comparison.

import { NextRequest, NextResponse } from 'next/server';
import {
  buildContextGraphV3Snapshot,
  listAvailableSnapshots,
} from '@/lib/contextGraph/contextGraphV3Engine';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

/**
 * GET /api/os/companies/[companyId]/context/graph
 *
 * Query params:
 * - snapshot: "live" (default) or specific snapshot ID
 * - compareTo: Optional snapshot ID to compare against
 *
 * Returns: ContextGraphV3Snapshot
 */
export async function GET(
  req: NextRequest,
  { params }: RouteParams
) {
  try {
    const { companyId } = await params;

    const snapshotId = req.nextUrl.searchParams.get('snapshot') ?? 'live';
    const compareTo = req.nextUrl.searchParams.get('compareTo') ?? undefined;

    const graph = await buildContextGraphV3Snapshot({
      companyId,
      snapshotId,
      compareToSnapshotId: compareTo,
    });

    return NextResponse.json(graph);
  } catch (error) {
    console.error('[ContextGraphV3] Error building snapshot:', error);
    return NextResponse.json(
      { error: 'Failed to build context graph snapshot' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/os/companies/[companyId]/context/graph/snapshots
 *
 * Returns list of available snapshots for the company
 */
export async function OPTIONS(
  req: NextRequest,
  { params }: RouteParams
) {
  // For CORS preflight
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
