// app/api/context-graph/route.ts
// API endpoints for Company Context Graph

import { NextRequest, NextResponse } from 'next/server';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { runFusion } from '@/lib/contextGraph/fusion';

/**
 * GET /api/context-graph?companyId=xxx
 * Get context graph for a company
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const companyId = searchParams.get('companyId');

  if (!companyId) {
    return NextResponse.json(
      { error: 'companyId is required' },
      { status: 400 }
    );
  }

  try {
    const graph = await loadContextGraph(companyId);

    if (!graph) {
      return NextResponse.json(
        { error: 'No context graph found for this company' },
        { status: 404 }
      );
    }

    return NextResponse.json({ graph });
  } catch (error) {
    console.error('[ContextGraph API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to load context graph' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/context-graph
 * Build or rebuild context graph for a company
 *
 * Body: { companyId: string, forceRebuild?: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, forceRebuild = false } = body;

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId is required' },
        { status: 400 }
      );
    }

    console.log(`[ContextGraph API] Running fusion for ${companyId} (forceRebuild: ${forceRebuild})`);

    const result = await runFusion(companyId, { forceRebuild });

    return NextResponse.json({
      success: result.success,
      runId: result.runId,
      fieldsUpdated: result.fieldsUpdated,
      sourcesUsed: result.sourcesUsed,
      completenessScore: result.graph.meta.completenessScore,
      durationMs: result.durationMs,
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (error) {
    console.error('[ContextGraph API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to run fusion' },
      { status: 500 }
    );
  }
}
