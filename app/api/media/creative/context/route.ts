// app/api/media/creative/context/route.ts
// API route to get the CreativeBriefContext for a company
//
// This returns the unified context view from the Context Graph,
// ready for use by the Creative Lab and AI creative generation.

import { NextRequest, NextResponse } from 'next/server';
import {
  getCreativeBriefContext,
  buildCreativePromptContext,
} from '@/lib/contextGraph/views/creativeContext';

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

    console.log(`[API] Getting creative brief context for company: ${companyId}`);

    const context = await getCreativeBriefContext(companyId);

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
        brand: context.brand,
        productOffer: context.productOffer,
        audience: context.audience,
        personas: context.personas,
        mediaHints: context.mediaHints,
        competitive: context.competitive,
        contextHealthScore: context.contextHealthScore,
        needsRefresh: context.needsRefresh,
      },
    };

    // Optionally include the formatted prompt context
    if (includePromptContext) {
      response.promptContext = buildCreativePromptContext(context);
    }

    console.log(`[API] Creative brief context retrieved:`, {
      companyId,
      healthScore: context.contextHealthScore,
      needsRefreshCount: context.needsRefresh.length,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error('[API] Failed to get creative brief context:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get context',
      },
      { status: 500 }
    );
  }
}
