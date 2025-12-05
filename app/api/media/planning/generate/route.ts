// app/api/media/planning/generate/route.ts
// API route to generate enhanced media plan options
// BRAIN-FIRST: Now loads context from Brain before generating

import { NextRequest, NextResponse } from 'next/server';
import { generateEnhancedMediaPlanOptions } from '@/lib/media/aiPlannerV2';
import { composeComprehensivePlanSummary, formatPlanAsMarkdownV2 } from '@/lib/media/planComposerV2';
import { validateForGeneration, type MediaPlanningInputs } from '@/lib/media/planningInput';
import { getLabContext, checkLabReadiness } from '@/lib/contextGraph/labContext';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, inputs, format } = body as {
      companyId: string;
      inputs: MediaPlanningInputs;
      format?: 'json' | 'markdown';
    };

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId is required' },
        { status: 400 }
      );
    }

    if (!inputs) {
      return NextResponse.json(
        { error: 'inputs are required' },
        { status: 400 }
      );
    }

    // Validate inputs
    const validation = validateForGeneration(inputs);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid inputs',
          validationErrors: validation.errors,
        },
        { status: 400 }
      );
    }

    console.log(`[API] Generating media plan options for company: ${companyId}`);

    // BRAIN-FIRST: Load context before generating
    let labContext;
    try {
      labContext = await getLabContext(companyId, 'media');
      const readiness = checkLabReadiness(labContext);

      console.log(`[API Media Generate] Brain context loaded:`, {
        integrity: labContext.contextIntegrity,
        hasICP: labContext.hasCanonicalICP,
        hasObjectives: labContext.hasObjectives,
        hasBudget: labContext.hasBudget,
      });

      if (readiness.warning) {
        console.log(`[API Media Generate] Context warning: ${readiness.warning}`);
      }
    } catch (error) {
      console.warn('[API Media Generate] Could not load Brain context:', error);
    }

    // Generate enhanced plan options
    const result = await generateEnhancedMediaPlanOptions(companyId, inputs);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 500 }
      );
    }

    // Compose comprehensive summaries for each option
    const planSummaries = result.options.map((option, index) => {
      const planName = `${option.label} Plan`;
      const summary = composeComprehensivePlanSummary(option, inputs, planName);

      if (format === 'markdown') {
        return {
          ...summary,
          markdownContent: formatPlanAsMarkdownV2(summary),
        };
      }

      return summary;
    });

    return NextResponse.json({
      success: true,
      data: {
        options: result.options,
        summaries: planSummaries,
        inputSummary: result.inputSummary,
        contextNotes: result.contextNotes,
        generatedAt: result.generatedAt,
        // BRAIN-FIRST: Include context integrity info
        contextIntegrity: labContext?.contextIntegrity || 'none',
        hasCanonicalICP: labContext?.hasCanonicalICP || false,
        hasObjectives: labContext?.hasObjectives || false,
      },
    });
  } catch (error) {
    console.error('[API] Failed to generate plan options:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate plan options',
      },
      { status: 500 }
    );
  }
}
