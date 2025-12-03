// app/api/os/media-lab/flights/[flightId]/route.ts
// API routes for updating and deleting media plan flights

import { NextRequest, NextResponse } from 'next/server';
import {
  updateMediaPlanFlight,
  deleteMediaPlanFlight,
  type UpdateMediaPlanFlightInput,
} from '@/lib/airtable/mediaLab';

type RouteParams = {
  params: Promise<{ flightId: string }>;
};

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { flightId } = await params;
    const body = await request.json();

    const input: UpdateMediaPlanFlightInput = {};

    if (body.name !== undefined) input.name = body.name;
    if (body.season !== undefined) input.season = body.season;
    if (body.startDate !== undefined) input.startDate = body.startDate;
    if (body.endDate !== undefined) input.endDate = body.endDate;
    if (body.budget !== undefined) input.budget = body.budget;
    if (body.primaryChannels !== undefined) input.primaryChannels = body.primaryChannels;
    if (body.marketsStores !== undefined) input.marketsStores = body.marketsStores;
    if (body.notes !== undefined) input.notes = body.notes;

    const flight = await updateMediaPlanFlight(flightId, input);

    if (!flight) {
      return NextResponse.json(
        { success: false, error: 'Failed to update flight' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, flight });
  } catch (error) {
    console.error('[API] Failed to update flight:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { flightId } = await params;

    await deleteMediaPlanFlight(flightId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Failed to delete flight:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
