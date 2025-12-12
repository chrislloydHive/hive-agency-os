// app/api/os/companies/[companyId]/labs/execution/route.ts
// Execution Lab API Endpoint
//
// POST - Run Execution Lab
// GET - Get lab status/input availability

import { NextRequest, NextResponse } from 'next/server';
import { FEATURE_FLAGS, FEATURE_DISABLED_RESPONSE } from '@/lib/config/featureFlags';
import { getCompanyById } from '@/lib/airtable/companies';
import { getCompanyContext } from '@/lib/os/context';
import { getActiveStrategy } from '@/lib/os/strategy';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import {
  runExecutionLab,
  buildExecutionLabInput,
  type ExecutionLabInput,
  type MediaScenarioType,
} from '@/lib/os/labs/execution';
import { generateWorkFromExecutionLab } from '@/lib/os/work';

// ============================================================================
// POST - Run Execution Lab
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

    // Parse request body for scenario selection
    let selectedScenario: MediaScenarioType | undefined;
    try {
      const body = await request.json();
      if (body.scenario && ['conservative', 'core', 'aggressive'].includes(body.scenario)) {
        selectedScenario = body.scenario as MediaScenarioType;
      }
    } catch {
      // No body or invalid JSON - that's fine, scenario is optional
    }

    console.log(`[ExecutionLabAPI] Running for ${companyId}, scenario: ${selectedScenario || 'none'}`);

    // Get company info
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Gather inputs in parallel
    const [context, strategy, graph] = await Promise.all([
      getCompanyContext(companyId),
      getActiveStrategy(companyId),
      loadContextGraph(companyId),
    ]);

    // Extract creative strategy from context graph
    const creativeStrategy = extractCreativeStrategyFromGraph(graph);

    // Extract audience lab data from context graph
    const audienceLab = extractAudienceLabFromGraph(graph);

    // Extract media lab data from context graph (if stored there)
    // For now, we'll pass what we have - media lab output could be passed in body in future
    const mediaLab = extractMediaLabFromGraph(graph);

    // Build input from gathered data
    const input: ExecutionLabInput = buildExecutionLabInput({
      companyId,
      companyName: company.name || 'Unknown Company',
      domain: company.domain || company.website || undefined,

      // Context
      context: context ? {
        businessModel: context.businessModel || undefined,
        valueProposition: context.valueProposition || undefined,
        primaryAudience: context.primaryAudience || undefined,
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

      // Media Lab (from context graph or passed in)
      mediaLab,

      // Selected scenario
      selectedScenario,
    });

    // Run the lab
    const result = await runExecutionLab(input);

    // If successful, generate work items from the output
    let workGeneration = null;
    if (result.success && result.output) {
      try {
        console.log(`[ExecutionLabAPI] Generating work items from run ${result.runId}`);
        workGeneration = await generateWorkFromExecutionLab(
          companyId,
          result.runId,
          result.output
        );
        console.log(`[ExecutionLabAPI] Work generation: ${workGeneration.created.length} created, ${workGeneration.skipped.length} skipped`);
      } catch (workError) {
        console.error('[ExecutionLabAPI] Work generation error (non-fatal):', workError);
        // Don't fail the request if work generation fails
      }
    }

    return NextResponse.json({
      status: 'ok',
      ...result,
      workGeneration: workGeneration ? {
        created: workGeneration.created.length,
        skipped: workGeneration.skipped.length,
      } : null,
    });

  } catch (error) {
    console.error('[ExecutionLabAPI] Error:', error);
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
    const [context, strategy, graph] = await Promise.all([
      getCompanyContext(companyId),
      getActiveStrategy(companyId),
      loadContextGraph(companyId),
    ]);

    const hasContext = !!(context && (context.businessModel || context.valueProposition));
    const hasStrategy = !!(strategy && (strategy.pillars?.length || strategy.objectives?.length));
    const hasAudienceLab = !!(graph?.audience?.segmentDetails?.value?.length);
    const hasCreativeStrategy = !!(graph?.creative?.messaging?.value?.coreValueProp || graph?.creative?.coreMessages?.value?.length);
    // Check for media data from context graph
    const hasMediaLab = !!(graph?.performanceMedia?.activeChannels?.value?.length || graph?.performanceMedia?.mediaSummary?.value);

    return NextResponse.json({
      status: 'ok',
      ready: hasStrategy || hasMediaLab,
      inputs: {
        hasContext,
        hasStrategy,
        hasAudienceLab,
        hasCreativeStrategy,
        hasMediaLab,
      },
      // TODO: Add lastRun info if we persist runs
      lastRun: null,
    });

  } catch (error) {
    console.error('[ExecutionLabAPI] GET Error:', error);
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
): ExecutionLabInput['audienceLab'] {
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

  return {
    segments: segments.length > 0 ? segments : undefined,
    primarySegmentName: graph.audience.primaryAudience?.value || undefined,
  };
}

/**
 * Extract creative strategy from context graph
 */
function extractCreativeStrategyFromGraph(
  graph: Awaited<ReturnType<typeof loadContextGraph>>
): ExecutionLabInput['creativeStrategy'] {
  if (!graph?.creative) {
    return undefined;
  }

  const messaging = graph.creative.messaging?.value;
  const guidelines = graph.creative.guidelines?.value;

  const coreMessage = messaging?.coreValueProp ||
    (graph.creative.coreMessages?.value?.length ? graph.creative.coreMessages.value[0] : undefined);

  const supportingNarrative = messaging?.supportingPoints?.length
    ? messaging.supportingPoints.join('. ')
    : undefined;

  const toneAndVoice = guidelines
    ? [guidelines.voice, guidelines.tone].filter(Boolean).join(' - ')
    : undefined;

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

/**
 * Extract media lab data from context graph
 * Note: Media Lab output is not persisted to context graph yet,
 * so we extract what we can from performanceMedia domain
 */
function extractMediaLabFromGraph(
  graph: Awaited<ReturnType<typeof loadContextGraph>>
): ExecutionLabInput['mediaLab'] {
  if (!graph?.performanceMedia) {
    return undefined;
  }

  const activeChannels = graph.performanceMedia.activeChannels?.value;
  const mediaSummary = graph.performanceMedia.mediaSummary?.value;
  const topChannel = graph.performanceMedia.topPerformingChannel?.value;

  // Extract recommended channels from active channels
  const recommendedChannels = activeChannels?.length ? activeChannels.map((channel) => ({
    channel: channel,
    role: channel === topChannel ? 'Top performing channel' : 'Active channel',
    priority: channel === topChannel ? 'High' : 'Medium',
  })) : undefined;

  if (!recommendedChannels && !mediaSummary) {
    return undefined;
  }

  return {
    mediaObjective: mediaSummary || undefined,
    recommendedChannels,
  };
}
