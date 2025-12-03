// app/api/os/media-lab/plans/route.ts
// API routes for creating media plans

import { NextRequest, NextResponse } from 'next/server';
import { createMediaPlan, type CreateMediaPlanInput } from '@/lib/airtable/mediaLab';
import { getCompanyById } from '@/lib/airtable/companies';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, name, objective } = body as {
      companyId: string;
      name?: string;
      objective?: string;
    };

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'companyId is required' },
        { status: 400 }
      );
    }

    // Verify company exists
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 }
      );
    }

    const input: CreateMediaPlanInput = {
      companyId,
      name: name || 'New Media Plan',
      status: 'draft',
      objective: (objective as CreateMediaPlanInput['objective']) || 'installs',
    };

    const plan = await createMediaPlan(input);

    if (!plan) {
      return NextResponse.json(
        { success: false, error: 'Failed to create media plan' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      plan,
    });
  } catch (error) {
    console.error('[API] Failed to create media plan:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
