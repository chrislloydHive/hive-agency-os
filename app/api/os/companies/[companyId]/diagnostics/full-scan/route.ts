// app/api/os/companies/[companyId]/diagnostics/full-scan/route.ts
// Run Full Intelligence Scan for a company (core diagnostics set).

import { NextRequest, NextResponse } from 'next/server';
import { runFullIntelligenceScan } from '@/lib/os/diagnostics/fullScanRunner';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    if (!companyId) {
      return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
    }

    let force = false;
    try {
      const body = await request.json();
      force = !!body?.force;
    } catch {
      force = false;
    }

    const origin = request.nextUrl?.origin;
    const result = await runFullIntelligenceScan(companyId, {
      force,
      baseUrl: origin,
    });

    return NextResponse.json({
      success: true,
      companyId,
      toolsScheduled: result.toolsScheduled,
      runIds: result.runIds,
    });
  } catch (error) {
    console.error('[FullScan API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to start full intelligence scan',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
