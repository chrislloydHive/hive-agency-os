// app/api/os/companies/[companyId]/competition/strategist/route.ts
// Competition Lab V4 API - Get strategist model
//
// Generates structured strategic intelligence from the latest competition run.
// Uses AI to transform raw data into an executive-friendly briefing.

import { NextRequest, NextResponse } from 'next/server';
import { getLatestCompetitionRunV3 } from '@/lib/competition-v3/store';
import { buildCompetitionStrategistModel } from '@/lib/competition-v3/strategist-orchestrator';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { getCompanyById } from '@/lib/airtable/companies';
import type { CompetitionRunV3Response, CompetitionCompetitor } from '@/lib/competition-v3/ui-types';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

/**
 * Helper to extract string value from context graph field
 */
function extractValue(field: any): string | undefined {
  if (!field) return undefined;
  if (typeof field === 'string') return field;
  if (typeof field.value === 'string') return field.value;
  return undefined;
}

/**
 * GET /api/os/companies/[companyId]/competition/strategist
 * Get the strategist model for the latest competition run
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { companyId } = await params;

    console.log(`[competition/strategist] Building strategist model for: ${companyId}`);

    // 1. Load latest V3 run
    const v3Run = await getLatestCompetitionRunV3(companyId);

    if (!v3Run) {
      return NextResponse.json(
        {
          success: false,
          error: 'No competition analysis found. Run an analysis first.',
        },
        { status: 404 }
      );
    }

    // 2. Load company context
    const [company, contextGraph] = await Promise.all([
      getCompanyById(companyId),
      loadContextGraph(companyId),
    ]);

    // Build company context for the orchestrator
    // Use fields that actually exist in the context graph schema
    const companyContext = {
      name: company?.name || 'Unknown Company',
      description: extractValue(contextGraph?.identity?.icpDescription),
      valueProposition: extractValue(contextGraph?.brand?.positioning),
      targetAudience: extractValue(contextGraph?.audience?.primaryAudience),
      industry: extractValue(contextGraph?.identity?.industry),
      stage: extractValue(contextGraph?.identity?.marketMaturity),
    };

    // 3. Convert stored run to UI response format (same as /latest endpoint)
    const competitors: CompetitionCompetitor[] = v3Run.competitors.map((c) => ({
      id: c.id,
      name: c.name,
      url: c.homepageUrl || undefined,
      domain: c.domain || undefined,
      type: c.classification.type,
      summary: c.summary,
      coordinates: {
        valueModelFit: c.positioning.x,
        icpFit: c.positioning.y,
      },
      scores: {
        icp: c.scores.icpFit,
        businessModel: c.scores.businessModelFit,
        services: c.scores.serviceOverlap,
        valueModel: c.scores.valueModelFit,
        aiOrientation: c.scores.aiOrientation,
        geography: c.scores.geographyFit,
        threat: c.scores.threatScore,
        relevance: c.scores.relevanceScore,
      },
      classification: {
        confidence: c.classification.confidence,
        reasoning: c.classification.reasoning,
      },
      meta: {
        teamSize: c.metadata.teamSizeEstimate ? String(c.metadata.teamSizeEstimate) : undefined,
        priceBand: c.metadata.pricingTier || undefined,
        regions: c.metadata.serviceRegions.length > 0 ? c.metadata.serviceRegions : undefined,
        hasAI: c.metadata.hasAICapabilities || undefined,
        businessModel: c.metadata.businessModel || undefined,
      },
      analysis: {
        strengths: c.analysis.strengths,
        weaknesses: c.analysis.weaknesses,
        whyCompetitor: c.analysis.whyCompetitor || undefined,
      },
      // V3.5 signals for alignment with Data view
      geoScope: (c as any).geoScope,
      signals: {
        businessModelCategory: c.businessModelCategory,
        jtbdMatches: c.jtbdMatches,
        offerOverlapScore: c.offerOverlapScore,
        signalsVerified: c.signalsVerified,
        geoScore: c.geoScore,
      },
      offerGraph: (c as any).offerGraph,
    }));

    // Build insights
    const threatInsights = v3Run.insights.filter(i => i.category === 'threat');
    const opportunityInsights = v3Run.insights.filter(
      i => i.category === 'opportunity' || i.category === 'white-space'
    );

    const sortedRecs = [...v3Run.recommendations].sort((a, b) => a.priority - b.priority);

    const runResponse: CompetitionRunV3Response = {
      runId: v3Run.runId,
      companyId: v3Run.companyId,
      status: v3Run.status,
      createdAt: v3Run.createdAt,
      completedAt: v3Run.completedAt || v3Run.createdAt,
      competitors,
      insights: {
        landscapeSummary: v3Run.insights.find(i => i.category === 'trend')?.description ||
          `Analyzed ${v3Run.summary.totalCompetitors} competitors.`,
        categoryBreakdown: formatCategoryBreakdown(v3Run.summary.byType),
        keyRisks: threatInsights.map(i => i.description).slice(0, 5),
        keyOpportunities: opportunityInsights.map(i => i.description).slice(0, 5),
        recommendedMoves: {
          now: sortedRecs.filter(r => r.priority === 1).map(r => r.title).slice(0, 3),
          next: sortedRecs.filter(r => r.priority === 2).map(r => r.title).slice(0, 3),
          later: sortedRecs.filter(r => r.priority === 3).map(r => r.title).slice(0, 3),
        },
      },
      summary: {
        totalCandidates: v3Run.summary.totalCandidates,
        totalCompetitors: v3Run.summary.totalCompetitors,
        byType: v3Run.summary.byType,
        avgThreatScore: v3Run.summary.avgThreatScore,
      },
    };

    // 4. Build strategist model
    const strategistModel = await buildCompetitionStrategistModel(runResponse, companyContext);

    console.log(`[competition/strategist] Generated model: "${strategistModel.headline}"`);

    return NextResponse.json({
      success: true,
      strategist: strategistModel,
    });
  } catch (error) {
    console.error('[competition/strategist] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate strategist model',
      },
      { status: 500 }
    );
  }
}

/**
 * Format category breakdown for display
 */
function formatCategoryBreakdown(byType: Record<string, number>): string {
  const parts: string[] = [];
  if (byType.direct > 0) parts.push(`${byType.direct} direct`);
  if (byType.partial > 0) parts.push(`${byType.partial} partial`);
  if (byType.fractional > 0) parts.push(`${byType.fractional} fractional`);
  if (byType.platform > 0) parts.push(`${byType.platform} platform`);
  if (byType.internal > 0) parts.push(`${byType.internal} internal`);
  return parts.join(', ') || 'No competitors classified';
}
