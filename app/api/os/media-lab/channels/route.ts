// app/api/os/media-lab/channels/route.ts
// API routes for creating media plan channels

import { NextRequest, NextResponse } from 'next/server';
import {
  getMediaPlanById,
  createMediaPlanChannel,
  type CreateMediaPlanChannelInput,
} from '@/lib/airtable/mediaLab';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mediaPlanId, channel, budgetSharePct, budgetAmount, expectedVolume, expectedCpl, priority } = body;

    if (!mediaPlanId) {
      return NextResponse.json(
        { success: false, error: 'mediaPlanId is required' },
        { status: 400 }
      );
    }

    // Verify plan exists
    const plan = await getMediaPlanById(mediaPlanId);
    if (!plan) {
      return NextResponse.json(
        { success: false, error: 'Media plan not found' },
        { status: 404 }
      );
    }

    const input: CreateMediaPlanChannelInput = {
      mediaPlanId,
      channel: channel || 'google_search',
      priority: priority || 'core',
    };

    if (budgetSharePct !== undefined) input.budgetSharePct = budgetSharePct;
    if (budgetAmount !== undefined) input.budgetAmount = budgetAmount;
    if (expectedVolume !== undefined) input.expectedVolume = expectedVolume;
    if (expectedCpl !== undefined) input.expectedCpl = expectedCpl;

    const channelRecord = await createMediaPlanChannel(input);

    if (!channelRecord) {
      return NextResponse.json(
        { success: false, error: 'Failed to create channel' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      channel: channelRecord,
    });
  } catch (error) {
    console.error('[API] Failed to create channel:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
