// app/api/os/companies/[companyId]/brain/regenerate/route.ts
// ============================================================================
// Brain Regenerate API Route
// ============================================================================
//
// Regenerates the Company Brain narrative using AI.
// Called from the client-side when user clicks "Regenerate" button.

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyBrainData } from '@/lib/brain/getCompanyBrainData';
import {
  generateCompanyBrainNarrative,
  generateFallbackNarrative,
} from '@/lib/brain/generateCompanyBrainNarrative';

type RouteContext = {
  params: Promise<{ companyId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { companyId } = await context.params;

  if (!companyId) {
    return NextResponse.json(
      { error: 'Company ID is required' },
      { status: 400 }
    );
  }

  console.log('[BrainRegenerate] Regenerating brain for company:', companyId);

  try {
    // Fetch fresh company brain data
    const data = await getCompanyBrainData(companyId);

    // Generate new narrative
    let narrative;
    try {
      narrative = await generateCompanyBrainNarrative(data);
    } catch (aiError) {
      console.error('[BrainRegenerate] AI failed, using fallback:', aiError);
      narrative = generateFallbackNarrative(data);
    }

    console.log('[BrainRegenerate] Generated narrative:', {
      companyId,
      confidenceScore: narrative.dataConfidence.score,
      narrativeLength: narrative.narrativeMarkdown.length,
    });

    return NextResponse.json({
      success: true,
      narrative,
      data: {
        company: data.company,
        insightsCount: data.insights.length,
        documentsCount: data.documents.length,
      },
    });
  } catch (error) {
    console.error('[BrainRegenerate] Failed:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to regenerate brain narrative',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
