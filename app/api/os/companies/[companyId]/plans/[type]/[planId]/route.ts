// app/api/os/companies/[companyId]/plans/[type]/[planId]/route.ts
// Get and update a specific plan
//
// GET   /api/os/companies/[companyId]/plans/[type]/[planId] - Get plan
// PATCH /api/os/companies/[companyId]/plans/[type]/[planId] - Update plan sections

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getMediaPlanById,
  getContentPlanById,
  updateMediaPlanSections,
  updateContentPlanSections,
} from '@/lib/airtable/heavyPlans';
import { countPendingProposals } from '@/lib/airtable/planProposals';
import {
  computeContextHash,
  computeStrategyHash,
  checkPlanStaleness,
} from '@/lib/os/plans/planSnapshots';
import { isPlanEditable, isArchived } from '@/lib/os/plans/planTransitions';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { getActiveStrategy } from '@/lib/os/strategy';
import type { PlanType } from '@/lib/types/plan';

export const maxDuration = 60;

type Params = { params: Promise<{ companyId: string; type: string; planId: string }> };

// ============================================================================
// Validation Schemas
// ============================================================================

const PlanTypeSchema = z.enum(['media', 'content']);

const UpdateSectionsSchema = z.object({
  sections: z.record(z.unknown()),
});

// ============================================================================
// GET - Get a specific plan with staleness check
// ============================================================================

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { companyId, type, planId } = await params;

    // Validate plan type
    const typeResult = PlanTypeSchema.safeParse(type);
    if (!typeResult.success) {
      return NextResponse.json(
        { error: 'Invalid plan type. Must be "media" or "content"' },
        { status: 400 }
      );
    }

    const planType: PlanType = typeResult.data;

    // Get the plan
    const plan = planType === 'media'
      ? await getMediaPlanById(planId)
      : await getContentPlanById(planId);

    if (!plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (plan.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Plan does not belong to this company' },
        { status: 403 }
      );
    }

    // Check staleness
    const context = await loadContextGraph(companyId);
    const strategy = await getActiveStrategy(companyId);
    const currentContextHash = computeContextHash(context);
    const currentStrategyHash = computeStrategyHash(strategy);
    const staleness = checkPlanStaleness(plan, currentContextHash, currentStrategyHash);

    // Get pending proposals count
    const pendingProposalCount = await countPendingProposals(planId, planType);

    return NextResponse.json({
      plan,
      staleness: {
        isStale: staleness.isStale,
        reason: staleness.reason,
        contextStale: staleness.contextStale,
        strategyStale: staleness.strategyStale,
      },
      pendingProposalCount,
    });
  } catch (error) {
    console.error('[API] Plan get error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH - Update plan sections
// ============================================================================

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { companyId, type, planId } = await params;

    // Validate plan type
    const typeResult = PlanTypeSchema.safeParse(type);
    if (!typeResult.success) {
      return NextResponse.json(
        { error: 'Invalid plan type. Must be "media" or "content"' },
        { status: 400 }
      );
    }

    const planType: PlanType = typeResult.data;

    // Get the existing plan
    const existingPlan = planType === 'media'
      ? await getMediaPlanById(planId)
      : await getContentPlanById(planId);

    if (!existingPlan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (existingPlan.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Plan does not belong to this company' },
        { status: 403 }
      );
    }

    // Check if plan is archived (immutable)
    if (isArchived(existingPlan.status)) {
      return NextResponse.json(
        {
          error: 'Cannot modify archived plan',
          hint: 'Archived plans are immutable. Create a new plan instead.',
          supersededBy: existingPlan.supersededByPlanId || undefined,
        },
        { status: 400 }
      );
    }

    // Check if plan is editable
    if (!isPlanEditable(existingPlan.status)) {
      return NextResponse.json(
        {
          error: `Cannot edit plan in ${existingPlan.status} status`,
          hint: existingPlan.status === 'approved'
            ? 'Use the proposal workflow to update approved plans'
            : 'Submit the plan for review first',
        },
        { status: 400 }
      );
    }

    // Parse and validate body
    const body = await request.json();
    const parseResult = UpdateSectionsSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { sections } = parseResult.data;

    // Update the plan
    const updatedPlan = planType === 'media'
      ? await updateMediaPlanSections(planId, sections)
      : await updateContentPlanSections(planId, sections);

    if (!updatedPlan) {
      return NextResponse.json(
        { error: 'Failed to update plan' },
        { status: 500 }
      );
    }

    return NextResponse.json({ plan: updatedPlan });
  } catch (error) {
    console.error('[API] Plan update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
