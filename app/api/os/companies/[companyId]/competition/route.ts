// app/api/os/companies/[companyId]/competition/route.ts
// Competition Lab API - Get latest run and list runs

import { NextRequest, NextResponse } from 'next/server';
import { getLatestCompetitionRun, listCompetitionRuns } from '@/lib/competition';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

/**
 * GET /api/os/companies/[companyId]/competition
 * Get the latest competition run for a company, or list all runs
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { companyId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const list = searchParams.get('list') === 'true';
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    if (list) {
      // List all runs
      const runs = await listCompetitionRuns(companyId, limit);
      return NextResponse.json({
        success: true,
        runs: runs.map((run) => ({
          id: run.id,
          status: run.status,
          startedAt: run.startedAt,
          completedAt: run.completedAt,
          competitorCount: run.competitors.filter((c) => !c.provenance.removed).length,
          dataConfidenceScore: run.dataConfidenceScore,
        })),
      });
    }

    // Get latest run
    const run = await getLatestCompetitionRun(companyId);

    if (!run) {
      return NextResponse.json({
        success: true,
        run: null,
        message: 'No competition run found for this company',
      });
    }

    // Calculate summary
    const activeCompetitors = run.competitors.filter((c) => !c.provenance.removed);
    const summary = {
      totalDiscovered: activeCompetitors.length,
      coreCount: activeCompetitors.filter((c) => c.role === 'core').length,
      secondaryCount: activeCompetitors.filter((c) => c.role === 'secondary').length,
      alternativeCount: activeCompetitors.filter((c) => c.role === 'alternative').length,
      avgOfferSimilarity:
        activeCompetitors.length > 0
          ? Math.round(
              activeCompetitors.reduce((sum, c) => sum + c.offerSimilarity, 0) /
                activeCompetitors.length
            )
          : 0,
      avgAudienceSimilarity:
        activeCompetitors.length > 0
          ? Math.round(
              activeCompetitors.reduce((sum, c) => sum + c.audienceSimilarity, 0) /
                activeCompetitors.length
            )
          : 0,
      topThreat:
        activeCompetitors
          .filter((c) => c.threatLevel !== null)
          .sort((a, b) => (b.threatLevel || 0) - (a.threatLevel || 0))[0]?.competitorName || null,
      dataConfidence: run.dataConfidenceScore,
      humanOverrideCount: activeCompetitors.filter((c) => c.provenance.humanOverride).length,
    };

    return NextResponse.json({
      success: true,
      run: {
        id: run.id,
        status: run.status,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        competitors: activeCompetitors,
        summary,
        querySet: run.querySet,
        candidatesDiscovered: run.candidatesDiscovered,
        candidatesEnriched: run.candidatesEnriched,
        candidatesScored: run.candidatesScored,
      },
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
