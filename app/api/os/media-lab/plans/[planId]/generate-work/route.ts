// app/api/os/media-lab/plans/[planId]/generate-work/route.ts
// Generate Work Items from a Media Plan

import { NextRequest, NextResponse } from 'next/server';
import { getMediaPlanWithDetails } from '@/lib/airtable/mediaLab';
import { generateWorkItemsFromMediaPlan } from '@/lib/mediaLab/work';

type RouteParams = {
  params: Promise<{ planId: string }>;
};

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { planId } = await params;

    // Get the plan with all details
    const plan = await getMediaPlanWithDetails(planId);
    if (!plan) {
      return NextResponse.json(
        { success: false, error: 'Media plan not found' },
        { status: 404 }
      );
    }

    if (!plan.companyId) {
      return NextResponse.json(
        { success: false, error: 'Media plan has no linked company' },
        { status: 400 }
      );
    }

    // Generate work items
    const result = await generateWorkItemsFromMediaPlan(plan.companyId, plan);

    return NextResponse.json({
      success: true,
      count: result.count,
      workItems: result.workItems,
    });
  } catch (error) {
    console.error('[API] Failed to generate work items from media plan:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
