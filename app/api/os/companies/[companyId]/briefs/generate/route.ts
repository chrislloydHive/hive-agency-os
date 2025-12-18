// app/api/os/companies/[companyId]/briefs/generate/route.ts
// Generate a canonical brief using AI
//
// POST /api/os/companies/[companyId]/briefs/generate
//
// Gating (NON-NEGOTIABLE):
// - Full GAP must be complete
// - At least 1 accepted strategic bet required

import { NextRequest, NextResponse } from 'next/server';
import { generateBrief } from '@/lib/os/briefs/generation';
import { validateBriefGeneration, getBlockingMessage } from '@/lib/os/briefs/validation';
import type { BriefType, BriefGenerationMode } from '@/lib/types/brief';

export const maxDuration = 120;

type Params = { params: Promise<{ companyId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { companyId } = await params;
    const body = await request.json();

    // Validate required fields
    // Note: engagementId is optional - briefs are project/work-centric
    const {
      engagementId,
      projectId,
      workItemId,
      type,
      mode = 'create',
      guidance,
    } = body as {
      engagementId?: string;
      projectId?: string;
      workItemId?: string;
      type: BriefType;
      mode?: BriefGenerationMode;
      guidance?: string;
    };

    if (!type) {
      return NextResponse.json(
        { error: 'type is required' },
        { status: 400 }
      );
    }

    // Validate brief generation requirements
    const validation = await validateBriefGeneration({
      companyId,
      projectId,
      type,
    });

    if (!validation.valid) {
      return NextResponse.json(
        {
          error: validation.error || 'Brief generation validation failed',
          blockedReason: getBlockingMessage(validation),
          missingRequirements: validation.missingRequirements,
        },
        { status: 400 }
      );
    }

    // Generate the brief
    // Note: engagementId is optional - briefs are project/work-centric
    const result = await generateBrief(
      companyId,
      engagementId, // Optional
      projectId,
      workItemId,
      type,
      mode,
      guidance
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to generate brief' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      brief: result.brief,
      inputsUsed: result.inputsUsed,
    });
  } catch (error) {
    console.error('[API] Brief generation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
