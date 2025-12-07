// app/api/os/companies/[companyId]/brain/summary/route.ts
// API endpoint for Brain Summary - consumed by QBR Story and Blueprint
//
// GET /api/os/companies/[companyId]/brain/summary
// Query params:
//   - snapshot: Snapshot ID (default: "current")
//   - compareTo: Snapshot ID to compare against (optional)

import { NextRequest, NextResponse } from 'next/server';
import { buildBrainSummary } from '@/lib/brain/buildBrainSummary';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const searchParams = req.nextUrl.searchParams;

    const snapshotId = searchParams.get('snapshot') ?? 'current';
    const compareToSnapshotId = searchParams.get('compareTo') ?? undefined;

    console.log('[BrainSummary API] Building summary', {
      companyId,
      snapshotId,
      compareToSnapshotId,
    });

    const summary = await buildBrainSummary({
      companyId,
      snapshotId,
      compareToSnapshotId,
    });

    return NextResponse.json(summary);
  } catch (error) {
    console.error('[BrainSummary API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to build brain summary' },
      { status: 500 }
    );
  }
}
