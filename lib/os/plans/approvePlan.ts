// lib/os/plans/approvePlan.ts
// Shared plan approval logic
//
// Extracted to be reusable by both the approve route and the accept proposal endpoint.

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
import type { PlanType, MediaPlan, ContentPlan } from '@/lib/types/plan';

// ============================================================================
// Types
// ============================================================================

export interface ApprovePlanInput {
  planType: PlanType;
  planId: string;
  companyId: string;
  approvedBy?: string;
  /** Skip validation (for proposal accept where we trust the proposed plan) */
  skipValidation?: boolean;
}

export interface ApprovePlanResult {
  success: true;
  plan: MediaPlan | ContentPlan;
  version: number;
  message: string;
  supersession: {
    archivedPlanId: string;
    archivedPlanVersion: number;
  } | null;
  previousApprovedPlanId?: string;
}

export interface ApprovePlanError {
  success: false;
  error: string;
  hint?: string;
  issues?: string[];
  supersededBy?: string;
}

export type ApprovePlanOutcome = ApprovePlanResult | ApprovePlanError;

// ============================================================================
// Main Function
// ============================================================================

/**
 * Approve a plan with full supersession handling.
 * This is the core approval logic shared by the approve route and proposal acceptance.
 */
export async function approvePlan(input: ApprovePlanInput): Promise<ApprovePlanOutcome> {
  const { planType, planId, companyId, approvedBy, skipValidation } = input;

  // Get the plan
  const plan = planType === 'media'
    ? await getMediaPlanById(planId)
    : await getContentPlanById(planId);

  if (!plan) {
    return {
      success: false,
      error: 'Plan not found',
    };
  }

  // Verify ownership
  if (plan.companyId !== companyId) {
    return {
      success: false,
      error: 'Plan does not belong to this company',
    };
  }

  // Check if plan is archived (immutable)
  if (isArchived(plan.status)) {
    return {
      success: false,
      error: 'Cannot approve archived plan',
      hint: 'Archived plans are immutable. Create a new plan instead.',
      supersededBy: plan.supersededByPlanId,
    };
  }

  // Check if transition is allowed
  if (!canTransition(plan.status, 'approved')) {
    return {
      success: false,
      error: `Cannot approve plan in ${plan.status} status`,
      hint: plan.status === 'draft'
        ? 'Submit the plan for review first'
        : plan.status === 'approved'
          ? 'Plan is already approved'
          : 'Only plans in review can be approved',
    };
  }

  // Validate plan is ready for approval (unless skipped for proposal accept)
  if (!skipValidation) {
    const validation = validatePlanForApproval(plan);
    if (!validation.valid) {
      return {
        success: false,
        error: 'Plan is not ready for approval',
        issues: validation.issues,
      };
    }
  }

  // Check for existing approved plan to supersede
  const existingApprovedPlan = await getApprovedPlan(planType, companyId, plan.strategyId);
  let supersededPlanId: string | undefined;
  let previousApprovedPlanId: string | undefined;

  // If there's an existing approved plan (that isn't this plan), archive it
  if (existingApprovedPlan && existingApprovedPlan.id !== planId) {
    supersededPlanId = existingApprovedPlan.id;
    previousApprovedPlanId = existingApprovedPlan.id;
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
    return {
      success: false,
      error: 'Failed to approve plan',
    };
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

  return {
    success: true,
    plan: updatedPlan,
    version: newVersion,
    message: `Plan approved (v${newVersion})${archivedPlan ? ` - supersedes v${archivedPlan.version}` : ''}`,
    supersession: archivedPlan
      ? {
          archivedPlanId: archivedPlan.id,
          archivedPlanVersion: archivedPlan.version,
        }
      : null,
    previousApprovedPlanId,
  };
}
