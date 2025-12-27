// app/api/os/companies/[companyId]/plans/[type]/route.ts
// List and create plans (Media or Content)
//
// GET  /api/os/companies/[companyId]/plans/[type] - List plans
// POST /api/os/companies/[companyId]/plans/[type] - Create a new plan

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getMediaPlansForCompany,
  getContentPlansForCompany,
  createMediaPlan,
  createContentPlan,
  getActiveMediaPlan,
  getActiveContentPlan,
} from '@/lib/airtable/heavyPlans';
import { computeSourceSnapshot } from '@/lib/os/plans/planSnapshots';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { getActiveStrategy } from '@/lib/os/strategy';
import type { PlanType, CreateMediaPlanInput, CreateContentPlanInput } from '@/lib/types/plan';

export const maxDuration = 60;

type Params = { params: Promise<{ companyId: string; type: string }> };

// ============================================================================
// Validation Schemas
// ============================================================================

const PlanTypeSchema = z.enum(['media', 'content']);

const CreatePlanSchema = z.object({
  strategyId: z.string().min(1, 'Strategy ID is required'),
  sections: z.record(z.unknown()).optional(),
});

// ============================================================================
// GET - List plans for company
// ============================================================================

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { companyId, type } = await params;

    // Validate plan type
    const typeResult = PlanTypeSchema.safeParse(type);
    if (!typeResult.success) {
      return NextResponse.json(
        { error: 'Invalid plan type. Must be "media" or "content"' },
        { status: 400 }
      );
    }

    const planType: PlanType = typeResult.data;

    // Get all plans for the company
    const plans = planType === 'media'
      ? await getMediaPlansForCompany(companyId)
      : await getContentPlansForCompany(companyId);

    // Optionally filter by strategyId
    const strategyId = request.nextUrl.searchParams.get('strategyId');
    const filteredPlans = strategyId
      ? plans.filter((p) => p.strategyId === strategyId)
      : plans;

    return NextResponse.json({ plans: filteredPlans });
  } catch (error) {
    console.error('[API] Plans list error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Create a new plan
// ============================================================================

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { companyId, type } = await params;

    // Validate plan type
    const typeResult = PlanTypeSchema.safeParse(type);
    if (!typeResult.success) {
      return NextResponse.json(
        { error: 'Invalid plan type. Must be "media" or "content"' },
        { status: 400 }
      );
    }

    const planType: PlanType = typeResult.data;

    // Parse and validate body
    const body = await request.json();
    const parseResult = CreatePlanSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { strategyId, sections } = parseResult.data;

    // Check if an active plan already exists
    const existingPlan = planType === 'media'
      ? await getActiveMediaPlan(companyId, strategyId)
      : await getActiveContentPlan(companyId, strategyId);

    if (existingPlan) {
      return NextResponse.json(
        {
          error: `An active ${planType} plan already exists for this strategy`,
          existingPlanId: existingPlan.id,
        },
        { status: 409 }
      );
    }

    // Verify strategy exists and belongs to company
    const strategy = await getActiveStrategy(companyId);
    if (!strategy || strategy.id !== strategyId) {
      return NextResponse.json(
        { error: 'Strategy not found or does not belong to this company' },
        { status: 404 }
      );
    }

    // Compute source snapshot
    const context = await loadContextGraph(companyId);
    const sourceSnapshot = computeSourceSnapshot(context, strategy);

    // Create the plan
    let plan;
    if (planType === 'media') {
      const input: CreateMediaPlanInput = {
        companyId,
        strategyId,
        sections: sections as CreateMediaPlanInput['sections'],
      };
      plan = await createMediaPlan(input, sourceSnapshot);
    } else {
      const input: CreateContentPlanInput = {
        companyId,
        strategyId,
        sections: sections as CreateContentPlanInput['sections'],
      };
      plan = await createContentPlan(input, sourceSnapshot);
    }

    if (!plan) {
      return NextResponse.json(
        { error: 'Failed to create plan' },
        { status: 500 }
      );
    }

    return NextResponse.json({ plan }, { status: 201 });
  } catch (error) {
    console.error('[API] Plan create error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
