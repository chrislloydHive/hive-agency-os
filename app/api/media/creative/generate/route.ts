// app/api/media/creative/generate/route.ts
// API route for generating creative packages
// V2: Now includes Context Graph integration for richer AI prompts

import { NextRequest, NextResponse } from 'next/server';
import {
  generateCreativePackage,
  type CreativeLabInput,
  type CreativeObjective,
} from '@/lib/media/creativeLab';
import type { MediaChannel } from '@/lib/media/types';
import { getCreativeBriefContext } from '@/lib/contextGraph/views/creativeContext';

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

    // Load context from Context Graph if companyId is provided
    let creativeContext = null;
    if (companyId) {
      try {
        creativeContext = await getCreativeBriefContext(companyId);
      } catch (err) {
        console.warn('[API] Could not load creative context:', err);
      }
    }

    // Build input for creative generation
    // Enrich with context if available
    const input: CreativeLabInput = {
      companyId: companyId || 'unknown',
      objective: objective as CreativeObjective,
      channels: channels as MediaChannel[],
      // Use provided values, or fall back to context values
      targetAudience: targetAudience || (creativeContext?.audience.coreSegments.join(', ')) || undefined,
      promotionContext: promotionContext || undefined,
      brandVoice: brandVoice || creativeContext?.brand.toneOfVoice || undefined,
      competitorDifferentiators: competitorDifferentiators || creativeContext?.brand.differentiators || undefined,
    };

    // Generate creative package
    const creativePackage = await generateCreativePackage(input);

    // Include context health score in response
    return NextResponse.json({
      ...creativePackage,
      contextHealthScore: creativeContext?.contextHealthScore,
      contextUsed: !!creativeContext,
    });
  } catch (error) {
    console.error('[API] Creative generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate creative' },
      { status: 500 }
    );
  }
}
