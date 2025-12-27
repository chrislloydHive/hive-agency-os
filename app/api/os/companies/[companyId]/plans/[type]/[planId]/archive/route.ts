// app/api/os/companies/[companyId]/plans/[type]/[planId]/archive/route.ts
// Archive a Heavy Plan
//
// POST /api/os/companies/[companyId]/plans/[type]/[planId]/archive
//
// Validates:
// - Plan exists and belongs to company
// - Plan is not already archived
// - Valid transition (any non-archived → archived)
//
// Body (optional):
// - reason: string - Why the plan is being archived
//
// Returns the archived plan

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getMediaPlanById,
  getContentPlanById,
  archivePlan,
} from '@/lib/airtable/heavyPlans';
import { canTransition } from '@/lib/os/plans/planTransitions';
import type { PlanType } from '@/lib/types/plan';

export const maxDuration = 30;

type Params = { params: Promise<{ companyId: string; type: string; planId: string }> };

// ============================================================================
// Validation Schemas
// ============================================================================

const PlanTypeSchema = z.enum(['media', 'content']);

const ArchiveBodySchema = z.object({
  reason: z.string().max(500).optional(),
}).optional();

// ============================================================================
// POST - Archive plan
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

    // Parse optional body
    let reason: string | undefined;
    try {
      const body = await request.json();
      const bodyResult = ArchiveBodySchema.safeParse(body);
      if (bodyResult.success && bodyResult.data?.reason) {
        reason = bodyResult.data.reason;
      }
    } catch {
      // Body is optional, ignore parse errors
    }

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

    // Check if already archived
    if (plan.status === 'archived') {
      return NextResponse.json(
        { error: 'Plan is already archived' },
        { status: 400 }
      );
    }

    // Validate transition
    if (!canTransition(plan.status, 'archived')) {
      return NextResponse.json(
        {
          error: `Cannot archive plan from "${plan.status}" status`,
          hint: 'Plans can be archived from any active status',
        },
        { status: 400 }
      );
    }

    // Archive the plan
    const archivedPlan = await archivePlan(planType, planId, {
      archivedReason: reason,
    });

    if (!archivedPlan) {
      return NextResponse.json(
        { error: 'Failed to archive plan' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      plan: {
        id: archivedPlan.id,
        status: archivedPlan.status,
        archivedAt: archivedPlan.archivedAt,
        archivedReason: archivedPlan.archivedReason,
        version: archivedPlan.version,
      },
      message: `${planType === 'media' ? 'Media' : 'Content'} plan v${archivedPlan.version} has been archived`,
    });
  } catch (error) {
    console.error('[API] Plan archive error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
