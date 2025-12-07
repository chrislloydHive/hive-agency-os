// app/api/os/companies/[companyId]/competition/route.ts
// Competition Lab API - Get latest run and list runs
//
// Returns full run state including steps, stats, querySummary, and errorMessage
// for UI observability.

import { NextRequest, NextResponse } from 'next/server';
import { getLatestCompetitionRun, listCompetitionRuns } from '@/lib/competition';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

/**
 * GET /api/os/companies/[companyId]/competition
 * Get the latest competition run for a company, or list all runs
 *
 * Query params:
 * - list=true: Return list of runs instead of latest
 * - limit=N: Limit number of runs in list (default 10)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { companyId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const list = searchParams.get('list') === 'true';
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    if (list) {
      // List all runs (limited summary)
      const runs = await listCompetitionRuns(companyId, { limit });
      return NextResponse.json({
        success: true,
        runs: runs.map((run) => ({
          id: run.id,
          status: run.status,
          startedAt: run.startedAt,
          completedAt: run.completedAt,
          competitorCount: run.competitors.filter((c) => !c.provenance?.removed).length,
          dataConfidenceScore: run.dataConfidenceScore,
          errorMessage: run.errorMessage,
        })),
      });
    }

    // Get latest run
    const run = await getLatestCompetitionRun(companyId);

    if (!run) {
      return NextResponse.json({
        success: true,
        run: null,
        runs: [],
        message: 'No competition run found for this company',
      });
    }

    // Get recent runs for history
    const runs = await listCompetitionRuns(companyId, { limit: 5 });

    // Filter active competitors (not removed)
    const activeCompetitors = run.competitors.filter((c) => !c.provenance?.removed);

    // Return full run data - UI needs all fields for observability
    return NextResponse.json({
      success: true,
      run: {
        id: run.id,
        companyId: run.companyId,
        status: run.status,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        updatedAt: run.updatedAt,
        // Full competitors list (active only)
        competitors: activeCompetitors,
        // Step tracking for UI progress indicator
        steps: run.steps || [],
        // Stats for summary display
        stats: run.stats || null,
        // Query summary for transparency
        querySummary: run.querySummary || null,
        // Error info for failure states
        errorMessage: run.errorMessage || null,
        errors: run.errors || [],
        // Data quality
        dataConfidenceScore: run.dataConfidenceScore,
        // Legacy fields for backwards compatibility
        querySet: run.querySet,
        candidatesDiscovered: run.stats?.candidatesDiscovered ?? run.candidatesDiscovered,
        candidatesEnriched: run.stats?.candidatesEnriched ?? run.candidatesEnriched,
        candidatesScored: run.stats?.candidatesScored ?? run.candidatesScored,
      },
      // Include recent runs for history selector
      runs: runs.map((r) => ({
        id: r.id,
        status: r.status,
        startedAt: r.startedAt,
        completedAt: r.completedAt,
        competitorCount: r.competitors.filter((c) => !c.provenance?.removed).length,
        errorMessage: r.errorMessage,
      })),
    });
  } catch (error) {
    console.error('[competition/api] Error fetching competition run:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
