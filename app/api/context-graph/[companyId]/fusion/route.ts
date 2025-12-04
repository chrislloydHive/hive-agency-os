// app/api/context-graph/[companyId]/fusion/route.ts
// API route to run context graph fusion for a company

import { NextRequest, NextResponse } from 'next/server';
import { runFusion } from '@/lib/contextGraph/fusion';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;

  if (!companyId) {
    return NextResponse.json(
      { error: 'companyId is required' },
      { status: 400 }
    );
  }

  try {
    console.log(`[Fusion API] Starting fusion for ${companyId}`);

    const result = await runFusion(companyId, {
      forceRebuild: false,
      createSnapshot: true,
      snapshotReason: 'manual_rebuild',
      snapshotDescription: 'Manual fusion triggered from Context Graph UI',
    });

    if (!result.success) {
      console.error(`[Fusion API] Fusion failed for ${companyId}:`, result.errors);
      return NextResponse.json(
        {
          error: 'Fusion failed',
          details: result.errors,
          fieldsUpdated: result.fieldsUpdated,
        },
        { status: 500 }
      );
    }

    console.log(`[Fusion API] Fusion complete for ${companyId}:`, {
      fieldsUpdated: result.fieldsUpdated,
      sources: result.sourcesUsed,
      durationMs: result.durationMs,
    });

    return NextResponse.json({
      success: true,
      fieldsUpdated: result.fieldsUpdated,
      sourcesUsed: result.sourcesUsed,
      durationMs: result.durationMs,
      versionId: result.versionId,
    });
  } catch (error) {
    console.error(`[Fusion API] Error running fusion for ${companyId}:`, error);
    return NextResponse.json(
      { error: 'Failed to run fusion' },
      { status: 500 }
    );
  }
}
