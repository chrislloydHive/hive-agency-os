// app/api/media/planning/prefill/route.ts
// API route to get prefilled media planning inputs for a company
// V2: Enhanced with AI-powered diagnostics fusion
// V3: Added Context Graph integration for unified context

import { NextRequest, NextResponse } from 'next/server';
import {
  buildPrefilledMediaPlanningInputs,
  buildPrefilledMediaPlanningInputsV2,
} from '@/lib/media/planningInputPrefill';
import { getMediaPlanningContext } from '@/lib/contextGraph/views/mediaContext';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const useV2 = searchParams.get('v2') === 'true';
    const useV3 = searchParams.get('v3') === 'true';

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId is required' },
        { status: 400 }
      );
    }

    console.log(`[API] Getting prefilled planning inputs for company: ${companyId}, v2: ${useV2}, v3: ${useV3}`);

    // V3: Context Graph-based prefill (recommended)
    if (useV3) {
      const [v2Result, contextResult] = await Promise.all([
        buildPrefilledMediaPlanningInputsV2(companyId),
        getMediaPlanningContext(companyId),
      ]);

      console.log(`[API] V3 prefill complete:`, {
        companyId,
        hasContext: !!contextResult,
        contextHealthScore: contextResult?.contextHealthScore,
      });

      return NextResponse.json({
        success: true,
        data: {
          inputs: v2Result.inputs,
          metadata: v2Result.metadata,
          sourceTags: v2Result.sourceTags,
          sources: v2Result.sources,
          // Include the unified context for AI prompts
          context: contextResult ? {
            company: contextResult.company,
            objectives: contextResult.objectives,
            brand: contextResult.brand,
            audience: contextResult.audience,
            digitalInfra: contextResult.digitalInfra,
            historical: contextResult.historical,
            mediaHints: contextResult.mediaHints,
            budget: contextResult.budget,
            contextHealthScore: contextResult.contextHealthScore,
            needsRefresh: contextResult.needsRefresh,
          } : null,
        },
      });
    }

    if (useV2) {
      // V2: Enhanced prefill with AI-powered diagnostics fusion
      const result = await buildPrefilledMediaPlanningInputsV2(companyId);

      // Log diagnostics info
      if (result.diagnosticsBundle) {
        const availableSources = Object.entries(result.diagnosticsBundle.availableSources)
          .filter(([, available]) => available)
          .map(([source]) => source);
        console.log(`[API] V2 prefill complete:`, {
          companyId,
          diagnosticSources: availableSources,
          sourceTagCount: Object.keys(result.sourceTags).length,
        });
      }

      return NextResponse.json({
        success: true,
        data: {
          inputs: result.inputs,
          metadata: result.metadata,
          sourceTags: result.sourceTags,
          sources: result.sources,
        },
      });
    }

    // V1: Original prefill (Brain + Profile + basic diagnostics)
    const result = await buildPrefilledMediaPlanningInputs(companyId);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[API] Failed to get prefilled inputs:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get prefilled inputs',
      },
      { status: 500 }
    );
  }
}
