// app/api/os/companies/[companyId]/competition/run/route.ts
// Competition Discovery API - Trigger a new competition discovery run (V3)

import { NextRequest, NextResponse } from 'next/server';
import { runCompetitionV3 } from '@/lib/competition-v3';
import { loadContextGraph } from '@/lib/contextGraph/storage';

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

    // Require confirmed business archetype before running
    const graph = await loadContextGraph(companyId);
    const archetypeMeta = (graph as any)?.identity?.businessArchetype;
    const archetypeValue: string | null = archetypeMeta?.value || null;
    const provenanceSource = archetypeMeta?.provenance?.[0]?.source;
    const isConfirmed = provenanceSource === 'user';

    if (!archetypeValue || !isConfirmed) {
      const message = 'Business Archetype is required and must be confirmed before running Competition Lab. Set Business Archetype under Business Reality (e.g., Local Service, Regional / Multi-location Service, National Retail Brand, E-commerce Only, Marketplace, SaaS) and confirm it.';
      console.warn(`[competition/api] BLOCKED - missing confirmed businessArchetype for ${companyId}`);
      return NextResponse.json(
        { success: false, error: message },
        { status: 400 }
      );
    }

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
        jtbdMatches: c.jtbdMatches,
        offerOverlapScore: c.offerOverlapScore,
        signalsVerified: c.signalsVerified,
        businessModelCategory: c.businessModelCategory,
        geoScore: c.geoScore,
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
