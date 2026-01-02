// app/api/os/companies/[companyId]/competition/strategist/route.ts
// Competition Lab V4 API - Get strategist model
//
// Generates structured strategic intelligence from the latest competition run.
// Uses AI to transform raw data into an executive-friendly briefing.

import { NextRequest, NextResponse } from 'next/server';
import { getLatestCompetitionRunV3 } from '@/lib/competition-v3/store';
import { getLatestCompetitionRunV4 } from '@/lib/competition-v4/store';
import { buildCompetitionStrategistModel } from '@/lib/competition-v3/strategist-orchestrator';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { getCompanyById } from '@/lib/airtable/companies';
import type { CompetitionRunV3Response, CompetitionCompetitor, GeoScope, CompetitorType } from '@/lib/competition-v3/ui-types';

/**
 * Map V4 competitor type strings to CompetitorType union
 */
function mapV4TypeToCompetitorType(v4Type: string | undefined): CompetitorType {
  const normalized = (v4Type || 'direct').toLowerCase();
  switch (normalized) {
    case 'direct':
      return 'direct';
    case 'indirect':
    case 'adjacent':
    case 'partial':
      return 'partial';
    case 'fractional':
      return 'fractional';
    case 'internal':
      return 'internal';
    case 'platform':
      return 'platform';
    default:
      return 'direct';
  }
}

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

/**
 * Helper to extract string value from context graph field
 */
function extractValue(field: unknown): string | undefined {
  if (!field) return undefined;
  if (typeof field === 'string') return field;
  if (typeof field === 'object' && field !== null && 'value' in field) {
    const fieldObj = field as { value: unknown };
    if (typeof fieldObj.value === 'string') return fieldObj.value;
  }
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

    // 1. Try V4 first, then fall back to V3
    const v4Record = await getLatestCompetitionRunV4(companyId);
    const v3Run = v4Record ? null : await getLatestCompetitionRunV3(companyId);

    if (!v4Record && !v3Run) {
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
    const companyContext = {
      name: company?.name || 'Unknown Company',
      description: extractValue(contextGraph?.audience?.icpDescription),
      valueProposition: extractValue(contextGraph?.brand?.positioning),
      targetAudience: extractValue(contextGraph?.audience?.primaryAudience),
      industry: extractValue(contextGraph?.identity?.industry),
      stage: extractValue(contextGraph?.identity?.marketMaturity),
    };

    // 3. Build runResponse from V4 or V3 data
    let runResponse: CompetitionRunV3Response;

    if (v4Record) {
      // V4 path: Convert V4 data to V3-compatible format
      const v4 = v4Record.payload;
      const validated = v4.competitors?.validated || [];

      const competitors: CompetitionCompetitor[] = validated.map((c, idx) => ({
        id: `${v4.runId}-${idx}`,
        name: c.name,
        domain: c.domain,
        type: mapV4TypeToCompetitorType(c.type),
        summary: c.reason || '',
        coordinates: { valueModelFit: 50, icpFit: 50 },
        scores: {
          icp: 50,
          businessModel: 50,
          services: 50,
          valueModel: 50,
          aiOrientation: 50,
          geography: 50,
          threat: c.confidence || 50,
          relevance: c.confidence || 50,
        },
        classification: { confidence: (c.confidence || 50) / 100 },
        analysis: {
          strengths: [],
          weaknesses: [],
          whyCompetitor: c.reason || undefined,
        },
      }));

      runResponse = {
        runId: v4.runId,
        companyId: v4.companyId,
        status: v4.execution?.status === 'completed' ? 'completed' : 'failed',
        createdAt: v4.execution?.startedAt || new Date().toISOString(),
        completedAt: v4.execution?.completedAt || new Date().toISOString(),
        competitors,
        insights: {
          landscapeSummary:
            v4.summary?.competitive_positioning ||
            `Analyzed ${validated.length} competitors in the ${v4.category?.category_name || 'market'} space.`,
          categoryBreakdown: v4.category?.category_description || '',
          keyRisks: v4.summary?.competitive_risks || [],
          keyOpportunities: v4.summary?.key_differentiation_axes || [],
          recommendedMoves: { now: [], next: [], later: [] },
        },
        summary: {
          totalCandidates: validated.length,
          totalCompetitors: validated.length,
          byType: {
            direct: validated.filter((c) => c.type?.toLowerCase() === 'direct').length,
            partial: validated.filter(
              (c) => c.type?.toLowerCase() === 'indirect' || c.type?.toLowerCase() === 'adjacent'
            ).length,
            fractional: 0,
            platform: 0,
            internal: 0,
          },
          avgThreatScore:
            validated.length > 0
              ? Math.round(validated.reduce((sum, c) => sum + (c.confidence || 50), 0) / validated.length)
              : 50,
        },
      };

      console.log(`[competition/strategist] Using V4 data: ${validated.length} competitors`);
    } else if (v3Run) {
      // V3 path: Convert stored run to UI response format
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
        geoScope: 'geoScope' in c ? (c as { geoScope?: GeoScope }).geoScope : undefined,
        signals: {
          businessModelCategory: c.businessModelCategory,
          jtbdMatches: c.jtbdMatches,
          offerOverlapScore: c.offerOverlapScore,
          signalsVerified: c.signalsVerified,
          geoScore: c.geoScore,
        },
        offerGraph: 'offerGraph' in c ? (c as { offerGraph?: string[] }).offerGraph : undefined,
      }));

      const threatInsights = v3Run.insights.filter((i) => i.category === 'threat');
      const opportunityInsights = v3Run.insights.filter(
        (i) => i.category === 'opportunity' || i.category === 'white-space'
      );
      const sortedRecs = [...v3Run.recommendations].sort((a, b) => a.priority - b.priority);

      runResponse = {
        runId: v3Run.runId,
        companyId: v3Run.companyId,
        status: v3Run.status,
        createdAt: v3Run.createdAt,
        completedAt: v3Run.completedAt || v3Run.createdAt,
        competitors,
        insights: {
          landscapeSummary:
            v3Run.insights.find((i) => i.category === 'trend')?.description ||
            `Analyzed ${v3Run.summary.totalCompetitors} competitors.`,
          categoryBreakdown: formatCategoryBreakdown(v3Run.summary.byType),
          keyRisks: threatInsights.map((i) => i.description).slice(0, 5),
          keyOpportunities: opportunityInsights.map((i) => i.description).slice(0, 5),
          recommendedMoves: {
            now: sortedRecs.filter((r) => r.priority === 1).map((r) => r.title).slice(0, 3),
            next: sortedRecs.filter((r) => r.priority === 2).map((r) => r.title).slice(0, 3),
            later: sortedRecs.filter((r) => r.priority === 3).map((r) => r.title).slice(0, 3),
          },
        },
        summary: {
          totalCandidates: v3Run.summary.totalCandidates,
          totalCompetitors: v3Run.summary.totalCompetitors,
          byType: v3Run.summary.byType,
          avgThreatScore: v3Run.summary.avgThreatScore,
        },
      };

      console.log(`[competition/strategist] Using V3 data: ${v3Run.summary.totalCompetitors} competitors`);
    } else {
      // This shouldn't happen - we checked earlier
      return NextResponse.json(
        { success: false, error: 'No competition analysis found.' },
        { status: 404 }
      );
    }

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
