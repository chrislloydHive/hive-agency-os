// app/api/os/companies/[companyId]/context/graph/snapshots/route.ts
// List available snapshots for Context Graph v3 comparison

import { NextRequest, NextResponse } from 'next/server';
import { listAvailableSnapshots } from '@/lib/contextGraph/contextGraphV3Engine';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

/**
 * GET /api/os/companies/[companyId]/context/graph/snapshots
 *
 * Returns list of available snapshots for comparison
 */
export async function GET(
  req: NextRequest,
  { params }: RouteParams
) {
  try {
    const { companyId } = await params;

    const snapshots = await listAvailableSnapshots(companyId);

    return NextResponse.json({ snapshots });
  } catch (error) {
    console.error('[ContextGraphV3] Error listing snapshots:', error);
    return NextResponse.json(
      { error: 'Failed to list snapshots' },
      { status: 500 }
    );
  }
}
