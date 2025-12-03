// app/api/os/media-lab/plans/[planId]/route.ts
// API routes for updating and deleting media plans

import { NextRequest, NextResponse } from 'next/server';
import {
  getMediaPlanById,
  updateMediaPlan,
  deleteMediaPlan,
  type UpdateMediaPlanInput,
} from '@/lib/airtable/mediaLab';

type RouteParams = {
  params: Promise<{ planId: string }>;
};

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { planId } = await params;

    const plan = await getMediaPlanById(planId);
    if (!plan) {
      return NextResponse.json(
        { success: false, error: 'Plan not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, plan });
  } catch (error) {
    console.error('[API] Failed to get media plan:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { planId } = await params;
    const body = await request.json();

    // Validate plan exists
    const existing = await getMediaPlanById(planId);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Plan not found' },
        { status: 404 }
      );
    }

    // Build update input from body
    const input: UpdateMediaPlanInput = {};

    if (body.name !== undefined) input.name = body.name;
    if (body.status !== undefined) input.status = body.status;
    if (body.objective !== undefined) input.objective = body.objective;
    if (body.timeframeStart !== undefined) input.timeframeStart = body.timeframeStart;
    if (body.timeframeEnd !== undefined) input.timeframeEnd = body.timeframeEnd;
    if (body.totalBudget !== undefined) input.totalBudget = body.totalBudget;
    if (body.primaryMarkets !== undefined) input.primaryMarkets = body.primaryMarkets;
    if (body.hasSeasonalFlights !== undefined) input.hasSeasonalFlights = body.hasSeasonalFlights;
    if (body.notes !== undefined) input.notes = body.notes;

    const plan = await updateMediaPlan(planId, input);

    if (!plan) {
      return NextResponse.json(
        { success: false, error: 'Failed to update media plan' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, plan });
  } catch (error) {
    console.error('[API] Failed to update media plan:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { planId } = await params;

    // Validate plan exists
    const existing = await getMediaPlanById(planId);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Plan not found' },
        { status: 404 }
      );
    }

    await deleteMediaPlan(planId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Failed to delete media plan:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
