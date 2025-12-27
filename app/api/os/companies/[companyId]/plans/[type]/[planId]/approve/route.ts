// app/api/os/companies/[companyId]/plans/[type]/[planId]/approve/route.ts
// Approve a plan (in_review → approved with version increment)
//
// POST /api/os/companies/[companyId]/plans/[type]/[planId]/approve

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getMediaPlanById,
  getContentPlanById,
  updateMediaPlanStatus,
  updateContentPlanStatus,
  getApprovedPlan,
  archivePlan,
  setPlanSupersedes,
} from '@/lib/airtable/heavyPlans';
import {
  canTransition,
  validatePlanForApproval,
  isArchived,
} from '@/lib/os/plans/planTransitions';
import {
  computeContextHash,
  computeStrategyHash,
} from '@/lib/os/plans/planSnapshots';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { getActiveStrategy } from '@/lib/os/strategy';
import type { PlanType } from '@/lib/types/plan';

export const maxDuration = 60;

type Params = { params: Promise<{ companyId: string; type: string; planId: string }> };

// ============================================================================
// Validation Schemas
// ============================================================================

const PlanTypeSchema = z.enum(['media', 'content']);

const ApproveBodySchema = z.object({
  approvedBy: z.string().min(1, 'Approved by is required').optional(),
}).optional();

// ============================================================================
// POST - Approve plan
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
    let approvedBy: string | undefined;
    try {
      const body = await request.json();
      const bodyResult = ApproveBodySchema.safeParse(body);
      if (bodyResult.success && bodyResult.data?.approvedBy) {
        approvedBy = bodyResult.data.approvedBy;
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

    // Check if plan is archived (immutable)
    if (isArchived(plan.status)) {
      return NextResponse.json(
        {
          error: 'Cannot approve archived plan',
          hint: 'Archived plans are immutable. Create a new plan instead.',
          supersededBy: plan.supersededByPlanId || undefined,
        },
        { status: 400 }
      );
    }

    // Check if transition is allowed
    if (!canTransition(plan.status, 'approved')) {
      return NextResponse.json(
        {
          error: `Cannot approve plan in ${plan.status} status`,
          hint: plan.status === 'draft'
            ? 'Submit the plan for review first'
            : plan.status === 'approved'
              ? 'Plan is already approved'
              : 'Only plans in review can be approved',
        },
        { status: 400 }
      );
    }

    // Validate plan is ready for approval
    const validation = validatePlanForApproval(plan);
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: 'Plan is not ready for approval',
          issues: validation.issues,
        },
        { status: 400 }
      );
    }

    // Check for existing approved plan to supersede
    const existingApprovedPlan = await getApprovedPlan(planType, companyId, plan.strategyId);
    let supersededPlanId: string | undefined;

    // If there's an existing approved plan (that isn't this plan), archive it
    if (existingApprovedPlan && existingApprovedPlan.id !== planId) {
      supersededPlanId = existingApprovedPlan.id;
      // Archive the old plan with reference to the new one
      // Note: We'll set supersededByPlanId after we approve the new plan
    }

    // Compute current source snapshot to update on approval
    const context = await loadContextGraph(companyId);
    const strategy = await getActiveStrategy(companyId);
    const currentContextHash = computeContextHash(context);
    const currentStrategyHash = computeStrategyHash(strategy);

    // Increment version and set approval metadata
    const newVersion = plan.version + 1;
    const approvedAt = new Date().toISOString();

    // Update status to approved with version increment
    const updatedPlan = planType === 'media'
      ? await updateMediaPlanStatus(planId, 'approved', {
          version: newVersion,
          approvedAt,
          approvedBy,
          // Update source snapshot to current values (plan is now "fresh")
          sourceSnapshot: {
            contextHash: currentContextHash,
            strategyHash: currentStrategyHash,
            contextConfirmedAt: new Date().toISOString(),
            strategyLockedAt: strategy?.updatedAt ?? null,
          },
        })
      : await updateContentPlanStatus(planId, 'approved', {
          version: newVersion,
          approvedAt,
          approvedBy,
          sourceSnapshot: {
            contextHash: currentContextHash,
            strategyHash: currentStrategyHash,
            contextConfirmedAt: new Date().toISOString(),
            strategyLockedAt: strategy?.updatedAt ?? null,
          },
        });

    if (!updatedPlan) {
      return NextResponse.json(
        { error: 'Failed to approve plan' },
        { status: 500 }
      );
    }

    // Handle supersession: archive old plan and set links
    let archivedPlan: { id: string; version: number } | null = null;
    if (supersededPlanId) {
      // Archive the old approved plan with supersededByPlanId pointing to new plan
      const archived = await archivePlan(planType, supersededPlanId, {
        archivedReason: `Superseded by v${newVersion}`,
        supersededByPlanId: planId,
      });
      if (archived) {
        archivedPlan = { id: archived.id, version: archived.version };
      }

      // Set supersedesPlanId on the newly approved plan
      await setPlanSupersedes(planType, planId, supersededPlanId);
    }

    return NextResponse.json({
      plan: updatedPlan,
      message: `Plan approved (v${newVersion})${archivedPlan ? ` - supersedes v${archivedPlan.version}` : ''}`,
      version: newVersion,
      supersession: archivedPlan
        ? {
            archivedPlanId: archivedPlan.id,
            archivedPlanVersion: archivedPlan.version,
          }
        : null,
    });
  } catch (error) {
    console.error('[API] Plan approve error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
