// app/api/media/scenarios/[companyId]/route.ts
// API routes for media scenario planning
//
// GET /api/media/scenarios/[companyId] - List all scenarios
// POST /api/media/scenarios/[companyId] - Create new scenario

import { NextRequest, NextResponse } from 'next/server';
import {
  getMediaScenariosForCompany,
  createMediaScenario,
  createScenarioFromMediaPlan,
} from '@/lib/media/scenarios';
import type { CreateMediaScenarioInput } from '@/lib/media/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;

  if (!companyId) {
    return NextResponse.json({ error: 'Company ID required' }, { status: 400 });
  }

  try {
    const scenarios = await getMediaScenariosForCompany(companyId);
    return NextResponse.json({ scenarios });
  } catch (error) {
    console.error('Error fetching scenarios:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scenarios' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;

  if (!companyId) {
    return NextResponse.json({ error: 'Company ID required' }, { status: 400 });
  }

  try {
    const body = await request.json();

    // Check if creating from media plan
    if (body.fromMediaPlanId) {
      const scenario = await createScenarioFromMediaPlan(
        companyId,
        body.fromMediaPlanId,
        body.name
      );
      return NextResponse.json({ scenario });
    }

    // Create new scenario
    const input: CreateMediaScenarioInput = {
      companyId,
      name: body.name || 'New Scenario',
      description: body.description,
      timeHorizon: body.timeHorizon || 'month',
      periodLabel: body.periodLabel,
      totalBudget: body.totalBudget || 0,
      allocations: body.allocations,
      goal: body.goal,
    };

    const scenario = await createMediaScenario(input);
    return NextResponse.json({ scenario });
  } catch (error) {
    console.error('Error creating scenario:', error);
    return NextResponse.json(
      { error: 'Failed to create scenario' },
      { status: 500 }
    );
  }
}
