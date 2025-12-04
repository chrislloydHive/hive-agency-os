// app/api/autopilot/generate-quarter-plan/route.ts
// Generate a quarterly strategic plan

import { NextRequest, NextResponse } from 'next/server';
import { generateQuarterlyPlan, storeQuarterlyPlan, getQuarterlyPlans } from '@/lib/autopilot/quarterlyPlanner';
import { loadContextGraph } from '@/lib/contextGraph';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      companyId,
      startDate,
      totalBudget,
      focusAreas,
      constraints,
      previousPlanId,
    } = body;

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId is required' },
        { status: 400 }
      );
    }

    // Load company context
    const graph = await loadContextGraph(companyId);
    if (!graph) {
      return NextResponse.json(
        { error: 'Company context not found' },
        { status: 404 }
      );
    }

    // Generate the plan
    const plan = await generateQuarterlyPlan(companyId, graph, {
      startDate,
      totalBudget,
      focusAreas,
      constraints,
      previousPlanId,
    });

    // Store the plan
    storeQuarterlyPlan(plan);

    return NextResponse.json({
      success: true,
      plan,
    });
  } catch (error) {
    console.error('Error generating quarterly plan:', error);
    return NextResponse.json(
      { error: 'Failed to generate quarterly plan', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const planId = searchParams.get('planId');

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId is required' },
        { status: 400 }
      );
    }

    const plans = getQuarterlyPlans(companyId);

    if (planId) {
      const plan = plans.find(p => p.id === planId);
      if (!plan) {
        return NextResponse.json(
          { error: 'Plan not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ plan });
    }

    return NextResponse.json({ plans });
  } catch (error) {
    console.error('Error fetching quarterly plans:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quarterly plans' },
      { status: 500 }
    );
  }
}
