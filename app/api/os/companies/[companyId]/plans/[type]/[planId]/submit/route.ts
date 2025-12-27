// app/api/os/companies/[companyId]/plans/[type]/[planId]/submit/route.ts
// Submit a plan for review (draft → in_review)
//
// POST /api/os/companies/[companyId]/plans/[type]/[planId]/submit

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getMediaPlanById,
  getContentPlanById,
  updateMediaPlanStatus,
  updateContentPlanStatus,
} from '@/lib/airtable/heavyPlans';
import {
  canTransition,
  validatePlanForSubmit,
  isArchived,
} from '@/lib/os/plans/planTransitions';
import type { PlanType } from '@/lib/types/plan';

export const maxDuration = 60;

type Params = { params: Promise<{ companyId: string; type: string; planId: string }> };

// ============================================================================
// Validation Schemas
// ============================================================================

const PlanTypeSchema = z.enum(['media', 'content']);

// ============================================================================
// POST - Submit plan for review
// ============================================================================

export async function POST(request: NextRequest, { params }: Params) {
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

    // Check if plan is archived (immutable)
    if (isArchived(plan.status)) {
      return NextResponse.json(
        {
          error: 'Cannot submit archived plan',
          hint: 'Archived plans are immutable. Create a new plan instead.',
          supersededBy: plan.supersededByPlanId || undefined,
        },
        { status: 400 }
      );
    }

    // Check if transition is allowed
    if (!canTransition(plan.status, 'in_review')) {
      return NextResponse.json(
        {
          error: `Cannot submit plan in ${plan.status} status`,
          hint: plan.status === 'in_review'
            ? 'Plan is already submitted for review'
            : plan.status === 'approved'
              ? 'Plan is already approved'
              : 'Only draft plans can be submitted',
        },
        { status: 400 }
      );
    }

    // Validate plan is ready for submission
    const validation = validatePlanForSubmit(plan);
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: 'Plan is not ready for submission',
          issues: validation.issues,
        },
        { status: 400 }
      );
    }

    // Update status to in_review
    const updatedPlan = planType === 'media'
      ? await updateMediaPlanStatus(planId, 'in_review', {
          submittedAt: new Date().toISOString(),
        })
      : await updateContentPlanStatus(planId, 'in_review', {
          submittedAt: new Date().toISOString(),
        });

    if (!updatedPlan) {
      return NextResponse.json(
        { error: 'Failed to submit plan' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      plan: updatedPlan,
      message: 'Plan submitted for review',
    });
  } catch (error) {
    console.error('[API] Plan submit error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
