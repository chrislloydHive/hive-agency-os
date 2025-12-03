// app/api/os/media-lab/flights/route.ts
// API routes for creating media plan flights

import { NextRequest, NextResponse } from 'next/server';
import {
  getMediaPlanById,
  createMediaPlanFlight,
  type CreateMediaPlanFlightInput,
} from '@/lib/airtable/mediaLab';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mediaPlanId, name, season, startDate, endDate, budget, primaryChannels, marketsStores } = body;

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

    const input: CreateMediaPlanFlightInput = {
      mediaPlanId,
      name: name || 'New Flight',
      season: season || 'other',
    };

    if (startDate !== undefined) input.startDate = startDate;
    if (endDate !== undefined) input.endDate = endDate;
    if (budget !== undefined) input.budget = budget;
    if (primaryChannels !== undefined) input.primaryChannels = primaryChannels;
    if (marketsStores !== undefined) input.marketsStores = marketsStores;

    const flight = await createMediaPlanFlight(input);

    if (!flight) {
      return NextResponse.json(
        { success: false, error: 'Failed to create flight' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      flight,
    });
  } catch (error) {
    console.error('[API] Failed to create flight:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
