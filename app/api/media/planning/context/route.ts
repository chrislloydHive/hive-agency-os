// app/api/media/planning/context/route.ts
// API route to get the MediaPlanningContext for a company
//
// This returns the unified context view from the Context Graph,
// ready for use by the Media Lab planner and AI prompts.

import { NextRequest, NextResponse } from 'next/server';
import {
  getMediaPlanningContext,
  buildMediaPlanningPromptContext,
} from '@/lib/contextGraph/views/mediaContext';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const includePromptContext = searchParams.get('includePrompt') === 'true';

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId is required' },
        { status: 400 }
      );
    }

    console.log(`[API] Getting media planning context for company: ${companyId}`);

    const context = await getMediaPlanningContext(companyId);

    if (!context) {
      return NextResponse.json({
        success: false,
        error: 'No context graph found for this company',
        context: null,
      });
    }

    // Build the response
    const response: {
      success: boolean;
      context: Omit<typeof context, 'graph'>;
      promptContext?: string;
    } = {
      success: true,
      // Exclude full graph from response to reduce payload size
      context: {
        company: context.company,
        objectives: context.objectives,
        brand: context.brand,
        audience: context.audience,
        digitalInfra: context.digitalInfra,
        historical: context.historical,
        mediaHints: context.mediaHints,
        budget: context.budget,
        contextHealthScore: context.contextHealthScore,
        needsRefresh: context.needsRefresh,
      },
    };

    // Optionally include the formatted prompt context
    if (includePromptContext) {
      response.promptContext = buildMediaPlanningPromptContext(context);
    }

    console.log(`[API] Media planning context retrieved:`, {
      companyId,
      healthScore: context.contextHealthScore,
      needsRefreshCount: context.needsRefresh.length,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error('[API] Failed to get media planning context:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get context',
      },
      { status: 500 }
    );
  }
}
