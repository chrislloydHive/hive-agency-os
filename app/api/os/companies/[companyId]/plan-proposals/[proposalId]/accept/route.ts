// app/api/os/companies/[companyId]/plan-proposals/[proposalId]/accept/route.ts
// Accept a plan proposal
//
// POST /api/os/companies/[companyId]/plan-proposals/[proposalId]/accept
//
// Validates:
// - Proposal exists and belongs to company
// - Proposal status is "pending"
// - proposedPlanId exists and plan exists
// - Proposed plan is not archived
//
// Behavior:
// - Approves the proposed plan using shared approval logic (handles supersession)
// - Marks proposal as accepted with resolution metadata
//
// Returns:
// - Updated proposal
// - Approved plan summary

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getPlanProposalById,
  isProposalResolvable,
  acceptProposal,
} from '@/lib/airtable/planProposals';
import {
  getMediaPlanById,
  getContentPlanById,
} from '@/lib/airtable/heavyPlans';
import { isArchived } from '@/lib/os/plans/planTransitions';
import { approvePlan } from '@/lib/os/plans/approvePlan';

export const maxDuration = 60;

type Params = { params: Promise<{ companyId: string; proposalId: string }> };

// ============================================================================
// Validation Schemas
// ============================================================================

const AcceptBodySchema = z.object({
  approvedBy: z.string().min(1).optional(),
}).optional();

// ============================================================================
// POST - Accept proposal
// ============================================================================

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { companyId, proposalId } = await params;

    // Parse optional body
    let approvedBy: string | undefined;
    try {
      const body = await request.json();
      const bodyResult = AcceptBodySchema.safeParse(body);
      if (bodyResult.success && bodyResult.data?.approvedBy) {
        approvedBy = bodyResult.data.approvedBy;
      }
    } catch {
      // Body is optional
    }

    // Get the proposal
    const proposal = await getPlanProposalById(proposalId);
    if (!proposal) {
      return NextResponse.json(
        { error: 'Proposal not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (proposal.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Proposal does not belong to this company' },
        { status: 403 }
      );
    }

    // Check if proposal is resolvable
    if (!isProposalResolvable(proposal)) {
      return NextResponse.json(
        {
          error: `Cannot accept proposal in "${proposal.status}" status`,
          hint: proposal.status === 'applied'
            ? 'This proposal has already been accepted'
            : 'This proposal has already been rejected',
        },
        { status: 400 }
      );
    }

    // For plan-based proposals, use proposedPlanId
    // For patch-based proposals, use planId (the target plan)
    const planIdToApprove = proposal.proposedPlanId || proposal.planId;
    if (!planIdToApprove) {
      return NextResponse.json(
        { error: 'No plan associated with this proposal' },
        { status: 400 }
      );
    }

    // Get the proposed plan
    const proposedPlan = proposal.planType === 'media'
      ? await getMediaPlanById(planIdToApprove)
      : await getContentPlanById(planIdToApprove);

    if (!proposedPlan) {
      return NextResponse.json(
        { error: 'Proposed plan not found' },
        { status: 404 }
      );
    }

    // Check if proposed plan is archived
    if (isArchived(proposedPlan.status)) {
      return NextResponse.json(
        {
          error: 'Cannot accept proposal - proposed plan is archived',
          hint: 'Create a new proposal with an active plan',
        },
        { status: 400 }
      );
    }

    // Approve the proposed plan using shared logic
    const approvalResult = await approvePlan({
      planType: proposal.planType,
      planId: planIdToApprove,
      companyId,
      approvedBy,
      // Skip validation for proposal accept - we trust the proposed plan
      skipValidation: true,
    });

    if (!approvalResult.success) {
      return NextResponse.json(
        {
          error: approvalResult.error,
          hint: approvalResult.hint,
          issues: approvalResult.issues,
        },
        { status: 400 }
      );
    }

    // Mark proposal as accepted
    const updatedProposal = await acceptProposal(proposalId, {
      resolvedBy: approvedBy,
      acceptedPlanId: approvalResult.plan.id,
      previousApprovedPlanId: approvalResult.previousApprovedPlanId,
    });

    if (!updatedProposal) {
      // Plan was approved but proposal update failed - log but don't fail
      console.error(`[API] Failed to update proposal status after accepting: ${proposalId}`);
    }

    return NextResponse.json({
      success: true,
      proposal: updatedProposal || { id: proposalId, status: 'applied' },
      plan: {
        id: approvalResult.plan.id,
        type: proposal.planType,
        version: approvalResult.version,
        status: approvalResult.plan.status,
      },
      message: approvalResult.message,
      supersession: approvalResult.supersession,
    });
  } catch (error) {
    console.error('[API] Proposal accept error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
