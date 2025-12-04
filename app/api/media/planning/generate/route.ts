// app/api/media/planning/generate/route.ts
// API route to generate enhanced media plan options

import { NextRequest, NextResponse } from 'next/server';
import { generateEnhancedMediaPlanOptions } from '@/lib/media/aiPlannerV2';
import { composeComprehensivePlanSummary, formatPlanAsMarkdownV2 } from '@/lib/media/planComposerV2';
import { validateForGeneration, type MediaPlanningInputs } from '@/lib/media/planningInput';

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
