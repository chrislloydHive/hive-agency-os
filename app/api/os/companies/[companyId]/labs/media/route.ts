// app/api/os/companies/[companyId]/labs/media/route.ts
// Media Lab API Endpoint
//
// POST - Run Media Lab
// GET - Get lab status/input availability

import { NextRequest, NextResponse } from 'next/server';
import { FEATURE_FLAGS, FEATURE_DISABLED_RESPONSE } from '@/lib/config/featureFlags';
import { getCompanyById } from '@/lib/airtable/companies';
import { getCompanyContext } from '@/lib/os/context';
import { getActiveStrategy } from '@/lib/os/strategy';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { getLatestCompetitionRunV3 } from '@/lib/competition-v3/store';
import {
  runMediaLab,
  buildMediaLabInput,
  type MediaLabInput,
} from '@/lib/os/labs/media';

// ============================================================================
// POST - Run Media Lab
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

    console.log(`[MediaLabAPI] Running for ${companyId}`);

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

    // Extract creative strategy from context graph if available
    const creativeStrategy = extractCreativeStrategyFromGraph(graph);

    // Extract audience lab data from context graph
    const audienceLab = extractAudienceLabFromGraph(graph);

    // Build input from gathered data
    const input: MediaLabInput = buildMediaLabInput({
      companyId,
      companyName: company.name || 'Unknown Company',
      domain: company.domain || company.website || undefined,

      // Context
      context: context ? {
        businessModel: context.businessModel || undefined,
        valueProposition: context.valueProposition || undefined,
        primaryAudience: context.primaryAudience || undefined,
        secondaryAudience: context.secondaryAudience || undefined,
        constraints: context.constraints || undefined,
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
      audienceLab,

      // Creative Strategy (from context graph)
      creativeStrategy,

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

      // Budget - not currently available, could be added later
      budget: undefined,
    });

    // Run the lab
    const result = await runMediaLab(input);

    return NextResponse.json({
      status: 'ok',
      ...result,
    });

  } catch (error) {
    console.error('[MediaLabAPI] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET - Get Lab Status/Input Availability
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
    const hasCreativeStrategy = !!(graph?.creative?.messaging?.value?.coreValueProp || graph?.creative?.coreMessages?.value?.length);
    const hasCompetition = !!(competitionRun?.competitors?.length);

    return NextResponse.json({
      status: 'ok',
      ready: hasContext || hasStrategy || hasAudienceLab,
      inputs: {
        hasContext,
        hasStrategy,
        hasAudienceLab,
        hasCreativeStrategy,
        hasCompetition,
      },
      // TODO: Add lastRun info if we persist runs
      lastRun: null,
    });

  } catch (error) {
    console.error('[MediaLabAPI] GET Error:', error);
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
 * Extract audience lab data from context graph
 */
function extractAudienceLabFromGraph(
  graph: Awaited<ReturnType<typeof loadContextGraph>>
): MediaLabInput['audienceLab'] {
  if (!graph?.audience) {
    return undefined;
  }

  const segments = graph.audience.segmentDetails?.value?.map((segment: {
    name: string;
    description?: string | null;
    priority?: string | null;
  }) => ({
    name: segment.name || 'Unknown',
    description: segment.description || undefined,
    priority: segment.priority || undefined,
  })) || [];

  const preferredChannels = graph.audience.preferredChannels?.value || [];

  return {
    segments: segments.length > 0 ? segments : undefined,
    primarySegmentName: graph.audience.primaryAudience?.value || undefined,
    mediaHabits: graph.audience.mediaHabits?.value || undefined,
    preferredChannels: preferredChannels.length > 0 ? preferredChannels : undefined,
  };
}

/**
 * Extract creative strategy from context graph
 */
function extractCreativeStrategyFromGraph(
  graph: Awaited<ReturnType<typeof loadContextGraph>>
): MediaLabInput['creativeStrategy'] {
  if (!graph?.creative) {
    return undefined;
  }

  // Extract from messaging architecture (Phase 2) or legacy fields
  const messaging = graph.creative.messaging?.value;
  const guidelines = graph.creative.guidelines?.value;

  // Try to get core message from messaging architecture or legacy coreMessages
  const coreMessage = messaging?.coreValueProp ||
    (graph.creative.coreMessages?.value?.length ? graph.creative.coreMessages.value[0] : undefined);

  // Get supporting narrative from supporting points
  const supportingNarrative = messaging?.supportingPoints?.length
    ? messaging.supportingPoints.join('. ')
    : undefined;

  // Get tone and voice from guidelines
  const toneAndVoice = guidelines
    ? [guidelines.voice, guidelines.tone].filter(Boolean).join(' - ')
    : undefined;

  // Get priority themes from key pillars or differentiators
  const priorityThemes = messaging?.keyPillars?.length
    ? messaging.keyPillars
    : messaging?.differentiators?.length
      ? messaging.differentiators
      : undefined;

  if (!coreMessage && !supportingNarrative && !toneAndVoice && !priorityThemes) {
    return undefined;
  }

  return {
    coreMessage: coreMessage || undefined,
    supportingNarrative: supportingNarrative || undefined,
    toneAndVoice: toneAndVoice || undefined,
    priorityThemes: priorityThemes || undefined,
  };
}
