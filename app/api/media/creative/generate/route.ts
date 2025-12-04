// app/api/media/creative/generate/route.ts
// API route for generating creative packages

import { NextRequest, NextResponse } from 'next/server';
import {
  generateCreativePackage,
  type CreativeLabInput,
  type CreativeObjective,
} from '@/lib/media/creativeLab';
import type { MediaChannel } from '@/lib/media/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const {
      objective,
      channels,
      targetAudience,
      promotionContext,
      brandVoice,
      competitorDifferentiators,
      companyId,
    } = body;

    if (!objective || !channels || !Array.isArray(channels) || channels.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: objective and channels' },
        { status: 400 }
      );
    }

    // Build input for creative generation
    const input: CreativeLabInput = {
      companyId: companyId || 'unknown',
      objective: objective as CreativeObjective,
      channels: channels as MediaChannel[],
      targetAudience: targetAudience || undefined,
      promotionContext: promotionContext || undefined,
      brandVoice: brandVoice || undefined,
      competitorDifferentiators: competitorDifferentiators || undefined,
    };

    // Generate creative package
    const creativePackage = await generateCreativePackage(input);

    return NextResponse.json(creativePackage);
  } catch (error) {
    console.error('[API] Creative generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate creative' },
      { status: 500 }
    );
  }
}
