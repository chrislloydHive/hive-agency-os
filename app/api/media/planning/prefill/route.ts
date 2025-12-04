// app/api/media/planning/prefill/route.ts
// API route to get prefilled media planning inputs for a company
// V2: Enhanced with AI-powered diagnostics fusion

import { NextRequest, NextResponse } from 'next/server';
import {
  buildPrefilledMediaPlanningInputs,
  buildPrefilledMediaPlanningInputsV2,
} from '@/lib/media/planningInputPrefill';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const useV2 = searchParams.get('v2') === 'true';

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId is required' },
        { status: 400 }
      );
    }

    console.log(`[API] Getting prefilled planning inputs for company: ${companyId}, v2: ${useV2}`);

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
