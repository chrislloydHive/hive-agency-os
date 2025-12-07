// app/api/os/companies/[companyId]/competition/latest/route.ts
// Competition Lab V3 API - Get latest run in full V3 format
//
// Returns:
// - Full V3 run data from Competition Runs table
// - Includes all competitors, insights, recommendations

import { NextRequest, NextResponse } from 'next/server';
import { getLatestCompetitionRunV3 } from '@/lib/competition-v3/store';
import type {
  CompetitionCompetitor,
  CompetitionInsights,
  CompetitionRunV3Response,
} from '@/lib/competition-v3/ui-types';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

/**
 * GET /api/os/companies/[companyId]/competition/latest
 * Get the latest competition analysis - FULL V3 data from Competition Runs table
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { companyId } = await params;

    console.log(`[competition/latest] Loading V3 run data for: ${companyId}`);

    // Load full V3 run from Competition Runs table
    const v3Run = await getLatestCompetitionRunV3(companyId);

    if (!v3Run) {
      return NextResponse.json({
        success: true,
        run: null,
        message: 'No competition analysis found. Run a new analysis to get started.',
      });
    }

    // Convert stored V3 payload to UI response format
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
    }));

    // Build insights from stored data
    const threatInsights = v3Run.insights.filter(i => i.category === 'threat');
    const opportunityInsights = v3Run.insights.filter(
      i => i.category === 'opportunity' || i.category === 'white-space'
    );

    // Extract recommended moves from recommendations
    const sortedRecs = [...v3Run.recommendations].sort((a, b) => a.priority - b.priority);
    const nowMoves = sortedRecs.filter(r => r.priority === 1).map(r => r.title);
    const nextMoves = sortedRecs.filter(r => r.priority === 2).map(r => r.title);
    const laterMoves = sortedRecs.filter(r => r.priority === 3).map(r => r.title);

    const insights: CompetitionInsights = {
      landscapeSummary: v3Run.insights.find(i => i.category === 'trend')?.description ||
        `Analyzed ${v3Run.summary.totalCompetitors} competitors. ${v3Run.summary.byType.direct} direct threats, ${v3Run.summary.byType.partial} category neighbors. Avg threat: ${v3Run.summary.avgThreatScore}/100.`,
      categoryBreakdown: formatCategoryBreakdown(v3Run.summary.byType),
      keyRisks: threatInsights.map(i => i.description).slice(0, 5),
      keyOpportunities: opportunityInsights.map(i => i.description).slice(0, 5),
      recommendedMoves: {
        now: nowMoves.slice(0, 3),
        next: nextMoves.slice(0, 3),
        later: laterMoves.slice(0, 3),
      },
    };

    const response: CompetitionRunV3Response = {
      runId: v3Run.runId,
      companyId: v3Run.companyId,
      status: v3Run.status,
      createdAt: v3Run.createdAt,
      completedAt: v3Run.completedAt || v3Run.createdAt,
      competitors,
      insights,
      summary: {
        totalCandidates: v3Run.summary.totalCandidates,
        totalCompetitors: v3Run.summary.totalCompetitors,
        byType: v3Run.summary.byType,
        avgThreatScore: v3Run.summary.avgThreatScore,
      },
    };

    console.log(`[competition/latest] Returning full V3 data: ${competitors.length} competitors`);

    return NextResponse.json({
      success: true,
      run: response,
    });
  } catch (error) {
    console.error('[competition/latest] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
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
