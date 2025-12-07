// app/api/os/companies/[companyId]/competition/run/route.ts
// Competition Discovery API - Trigger a new competition discovery run (V3)

import { NextRequest, NextResponse } from 'next/server';
import { runCompetitionV3 } from '@/lib/competition-v3';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

/**
 * POST /api/os/companies/[companyId]/competition/run
 * Trigger a new competition discovery run using V3 pipeline
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { companyId } = await params;

    console.log(`[competition/api] Starting Competition Discovery V3 for company: ${companyId}`);

    // Run the V3 competition discovery pipeline
    const result = await runCompetitionV3({ companyId });

    console.log(`[competition/api] Competition Discovery V3 completed: ${result.run.id}`);
    console.log(`[competition/api] Found ${result.competitors.length} competitors (status: ${result.run.status})`);

    return NextResponse.json({
      success: result.run.status === 'completed',
      runId: result.run.id,
      status: result.run.status,
      summary: {
        totalCandidates: result.run.summary.totalCandidates,
        totalCompetitors: result.run.summary.totalCompetitors,
        byType: result.run.summary.byType,
        avgThreatScore: result.run.summary.avgThreatScore,
        quadrantDistribution: result.run.summary.quadrantDistribution,
      },
      competitors: result.competitors.map(c => ({
        id: c.id,
        name: c.name,
        domain: c.domain,
        summary: c.summary,
        type: c.classification.type,
        confidence: c.classification.confidence,
        threatScore: c.scores.threatScore,
        relevanceScore: c.scores.relevanceScore,
        positioning: c.positioning,
        metadata: c.metadata,
      })),
      insights: result.insights,
      recommendations: result.recommendations,
      error: result.run.error,
    });
  } catch (error) {
    console.error('[competition/api] Error running Competition Discovery V3:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
