// app/api/os/companies/[companyId]/labs/media-scenarios/route.ts
// Media Scenarios API Endpoint
//
// POST - Run Media Scenarios (requires Media Lab output in body)

import { NextRequest, NextResponse } from 'next/server';
import { FEATURE_FLAGS, FEATURE_DISABLED_RESPONSE } from '@/lib/config/featureFlags';
import { getCompanyById } from '@/lib/airtable/companies';
import { getCompanyContext } from '@/lib/os/context';
import { getActiveStrategy } from '@/lib/os/strategy';
import {
  runMediaScenarios,
  buildMediaScenariosInput,
  type MediaScenariosInput,
} from '@/lib/os/labs/mediaScenarios';
import type { MediaLabOutput } from '@/lib/os/labs/media';

// ============================================================================
// POST - Run Media Scenarios
// ============================================================================

interface RequestBody {
  mediaLabOutput: MediaLabOutput;
  budget?: {
    monthlyBudget?: number;
    annualBudget?: number;
    budgetTier?: 'small' | 'medium' | 'large' | 'enterprise';
  };
}

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
    const body = await request.json() as RequestBody;

    console.log(`[MediaScenariosAPI] Running for ${companyId}`);

    // Validate required input
    if (!body.mediaLabOutput) {
      return NextResponse.json(
        { error: 'Media Lab output is required' },
        { status: 400 }
      );
    }

    if (!body.mediaLabOutput.recommendedChannels?.length) {
      return NextResponse.json(
        { error: 'Media Lab output must have recommended channels' },
        { status: 400 }
      );
    }

    // Get company info
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Gather additional context in parallel
    const [context, strategy] = await Promise.all([
      getCompanyContext(companyId),
      getActiveStrategy(companyId),
    ]);

    // Build input from gathered data
    const input: MediaScenariosInput = buildMediaScenariosInput({
      companyId,
      companyName: company.name || 'Unknown Company',
      domain: company.domain || company.website || undefined,

      // Media Lab output (required)
      mediaLab: {
        mediaObjective: body.mediaLabOutput.mediaObjective,
        recommendedChannels: body.mediaLabOutput.recommendedChannels,
        excludedChannels: body.mediaLabOutput.excludedChannels,
        budgetAllocation: body.mediaLabOutput.budgetAllocation,
      },

      // Context
      context: context ? {
        businessModel: context.businessModel || undefined,
        valueProposition: context.valueProposition || undefined,
        constraints: context.constraints || undefined,
      } : undefined,

      // Strategy
      strategy: strategy ? {
        title: strategy.title || undefined,
        summary: strategy.summary || undefined,
        objectives: strategy.objectives || undefined,
      } : undefined,

      // Audience (from context)
      audienceLab: context ? {
        primaryAudience: context.primaryAudience || undefined,
        coreNeeds: undefined, // Could be extracted from audience lab if stored
      } : undefined,

      // Budget (from request body)
      budget: body.budget,
    });

    // Run the scenarios
    const result = await runMediaScenarios(input);

    return NextResponse.json({
      status: 'ok',
      ...result,
    });

  } catch (error) {
    console.error('[MediaScenariosAPI] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
