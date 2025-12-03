// app/api/os/media-lab/channels/[channelId]/route.ts
// API routes for updating and deleting media plan channels

import { NextRequest, NextResponse } from 'next/server';
import {
  updateMediaPlanChannel,
  deleteMediaPlanChannel,
  type UpdateMediaPlanChannelInput,
} from '@/lib/airtable/mediaLab';

type RouteParams = {
  params: Promise<{ channelId: string }>;
};

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { channelId } = await params;
    const body = await request.json();

    const input: UpdateMediaPlanChannelInput = {};

    if (body.channel !== undefined) input.channel = body.channel;
    if (body.budgetSharePct !== undefined) input.budgetSharePct = body.budgetSharePct;
    if (body.budgetAmount !== undefined) input.budgetAmount = body.budgetAmount;
    if (body.expectedVolume !== undefined) input.expectedVolume = body.expectedVolume;
    if (body.expectedCpl !== undefined) input.expectedCpl = body.expectedCpl;
    if (body.priority !== undefined) input.priority = body.priority;
    if (body.notes !== undefined) input.notes = body.notes;

    const channel = await updateMediaPlanChannel(channelId, input);

    if (!channel) {
      return NextResponse.json(
        { success: false, error: 'Failed to update channel' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, channel });
  } catch (error) {
    console.error('[API] Failed to update channel:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { channelId } = await params;

    await deleteMediaPlanChannel(channelId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Failed to delete channel:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
