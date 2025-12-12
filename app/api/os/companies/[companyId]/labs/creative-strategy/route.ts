// app/api/os/companies/[companyId]/labs/creative-strategy/route.ts
// Creative Strategy Lab API Endpoint
//
// POST - Run Creative Strategy Lab
// GET - Get last run (if stored)

import { NextRequest, NextResponse } from 'next/server';
import { FEATURE_FLAGS, FEATURE_DISABLED_RESPONSE } from '@/lib/config/featureFlags';
import { getCompanyById } from '@/lib/airtable/companies';
import { getCompanyContext } from '@/lib/os/context';
import { getActiveStrategy } from '@/lib/os/strategy';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { getLatestCompetitionRunV3 } from '@/lib/competition-v3/store';
import {
  runCreativeStrategyLab,
  buildCreativeStrategyInput,
  type CreativeStrategyLabInput,
} from '@/lib/os/labs/creativeStrategy';

// ============================================================================
// POST - Run Creative Strategy Lab
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  // Feature gate: Labs must be explicitly enabled
  if (!FEATURE_FLAGS.LABS_ENABLED) {
    return NextResponse.json(FEATURE_DISABLED_RESPONSE, { status: 403 });
  }

  try {
    const { companyId } = await params;

    console.log(`[CreativeStrategyLabAPI] Running for ${companyId}`);

    // Get company info
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Gather inputs in parallel
    const [context, strategy, graph, competitionRun] = await Promise.all([
      getCompanyContext(companyId),
      getActiveStrategy(companyId),
      loadContextGraph(companyId),
      getLatestCompetitionRunV3(companyId).catch(() => null),
    ]);

    // Build input from gathered data
    const input: CreativeStrategyLabInput = buildCreativeStrategyInput({
      companyId,
      companyName: company.name || 'Unknown Company',
      domain: company.domain || company.website || undefined,

      // Context
      context: context ? {
        businessModel: context.businessModel || undefined,
        valueProposition: context.valueProposition || undefined,
        primaryAudience: context.primaryAudience || undefined,
        secondaryAudience: context.secondaryAudience || undefined,
        icpDescription: context.icpDescription || undefined,
        constraints: context.constraints || undefined,
        differentiators: context.differentiators || undefined,
      } : undefined,

      // Strategy
      strategy: strategy ? {
        title: strategy.title || undefined,
        summary: strategy.summary || undefined,
        objectives: strategy.objectives || undefined,
        pillars: strategy.pillars?.map(p => ({
          title: p.title,
          description: p.description,
          priority: p.priority,
        })) || undefined,
      } : undefined,

      // Audience Lab (from context graph)
      audienceLab: graph?.audience ? {
        segments: extractSegmentsFromGraph(graph),
        primarySegmentName: graph.audience.primaryAudience?.value || undefined,
      } : undefined,

      // Competition (V3 format)
      competition: competitionRun ? {
        categoryName: undefined, // V3 doesn't have category
        categoryDescription: undefined,
        competitors: competitionRun.competitors?.slice(0, 10).map(c => ({
          name: c.name,
          domain: c.domain || c.homepageUrl || undefined,
          type: c.classification?.type,
          reason: c.analysis?.whyCompetitor || c.summary,
        })),
        positioning: competitionRun.insights?.[0]?.description || undefined,
      } : undefined,
    });

    // Run the lab
    const result = await runCreativeStrategyLab(input);

    return NextResponse.json({
      status: 'ok',
      ...result,
    });

  } catch (error) {
    console.error('[CreativeStrategyLabAPI] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET - Get Lab Status/Last Run
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  // Feature gate: Labs must be explicitly enabled
  if (!FEATURE_FLAGS.LABS_ENABLED) {
    return NextResponse.json(FEATURE_DISABLED_RESPONSE, { status: 403 });
  }

  try {
    const { companyId } = await params;

    // Check what inputs are available
    const [context, strategy, graph, competitionRun] = await Promise.all([
      getCompanyContext(companyId),
      getActiveStrategy(companyId),
      loadContextGraph(companyId),
      getLatestCompetitionRunV3(companyId).catch(() => null),
    ]);

    const hasContext = !!(context && (context.businessModel || context.valueProposition));
    const hasStrategy = !!(strategy && (strategy.pillars?.length || strategy.objectives?.length));
    const hasAudienceLab = !!(graph?.audience?.segmentDetails?.value?.length);
    const hasCompetition = !!(competitionRun?.competitors?.length);

    return NextResponse.json({
      status: 'ok',
      ready: hasContext || hasStrategy,
      inputs: {
        hasContext,
        hasStrategy,
        hasAudienceLab,
        hasCompetition,
      },
      // TODO: Add lastRun info if we persist runs
      lastRun: null,
    });

  } catch (error) {
    console.error('[CreativeStrategyLabAPI] GET Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract audience segments from context graph
 */
function extractSegmentsFromGraph(graph: Awaited<ReturnType<typeof loadContextGraph>>): NonNullable<CreativeStrategyLabInput['audienceLab']>['segments'] {
  const segmentDetails = graph?.audience?.segmentDetails?.value;
  if (!segmentDetails?.length) {
    return [];
  }

  return segmentDetails.map((segment: { name: string; description?: string | null; priority?: string | null }) => ({
    name: segment.name || 'Unknown',
    description: segment.description || undefined,
    painPoints: undefined, // AudienceSegment doesn't have painPoints in the type
    goals: undefined, // AudienceSegment doesn't have goals in the type
    priority: segment.priority || undefined,
  }));
}
