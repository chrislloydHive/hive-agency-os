// app/api/os/companies/[companyId]/labs/competitor/route.ts
// Competitor Lab API Endpoint
//
// POST - Run Competitor Lab refinement
// GET - Get last run metadata

import { NextRequest, NextResponse } from 'next/server';
import { runCompetitorLabRefinement } from '@/lib/labs/competitor';
import { loadContextGraph } from '@/lib/contextGraph/storage';

// ============================================================================
// POST - Run Competitor Lab Refinement
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const body = await request.json().catch(() => ({}));

    const { run = true, forceRun = false, dryRun = false } = body;

    if (!run) {
      return NextResponse.json({ error: 'Set run: true to execute' }, { status: 400 });
    }

    console.log(`[CompetitorLabAPI] Running for ${companyId}, forceRun: ${forceRun}, dryRun: ${dryRun}`);

    const result = await runCompetitorLabRefinement({
      companyId,
      forceRun,
      dryRun,
    });

    return NextResponse.json({
      status: 'ok',
      success: result.success,
      refined: result.refinedContext,
      diagnostics: result.diagnostics,
      apply: result.applyResult,
      summary: result.summary,
      durationMs: result.durationMs,
      runAt: result.runAt,
    });

  } catch (error) {
    console.error('[CompetitorLabAPI] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET - Get Competitor Lab Metadata
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;

    // Load context graph to get current competitive data
    const graph = await loadContextGraph(companyId);

    const competitive = graph?.competitive;
    const competitors = competitive?.competitors?.value || competitive?.primaryCompetitors?.value || [];
    const hasAxes = !!(competitive?.primaryAxis?.value && competitive?.secondaryAxis?.value);

    // Get last update info from provenance
    let lastUpdatedAt: string | null = null;
    let lastUpdatedBy: string | null = null;

    if (competitive?.competitors?.provenance?.[0]) {
      lastUpdatedAt = competitive.competitors.provenance[0].updatedAt || null;
      lastUpdatedBy = competitive.competitors.provenance[0].source || null;
    }

    return NextResponse.json({
      status: 'ok',
      competitorCount: competitors.length,
      hasAxes,
      primaryAxis: competitive?.primaryAxis?.value || null,
      secondaryAxis: competitive?.secondaryAxis?.value || null,
      hasWhitespace: (competitive?.whitespaceOpportunities?.value?.length || 0) > 0,
      whitespaceCount: competitive?.whitespaceOpportunities?.value?.length || 0,
      lastUpdatedAt,
      lastUpdatedBy,
    });

  } catch (error) {
    console.error('[CompetitorLabAPI] GET Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
