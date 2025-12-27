// app/api/os/companies/[companyId]/plan-proposals/[proposalId]/reject/route.ts
// Reject a plan proposal
//
// POST /api/os/companies/[companyId]/plan-proposals/[proposalId]/reject
//
// Validates:
// - Proposal exists and belongs to company
// - Proposal status is "pending"
//
// Behavior:
// - Marks proposal as rejected with resolution metadata
// - Archives the proposed plan with reason "Rejected proposal"
//
// Returns:
// - Updated proposal

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getPlanProposalById,
  isProposalResolvable,
  rejectProposal,
} from '@/lib/airtable/planProposals';
import { archivePlan } from '@/lib/airtable/heavyPlans';

export const maxDuration = 60;

type Params = { params: Promise<{ companyId: string; proposalId: string }> };

// ============================================================================
// Validation Schemas
// ============================================================================

const RejectBodySchema = z.object({
  rejectionReason: z.string().optional(),
  rejectedBy: z.string().min(1).optional(),
}).optional();

// ============================================================================
// POST - Reject proposal
// ============================================================================

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { companyId, proposalId } = await params;

    // Parse optional body
    let rejectionReason: string | undefined;
    let rejectedBy: string | undefined;
    try {
      const body = await request.json();
      const bodyResult = RejectBodySchema.safeParse(body);
      if (bodyResult.success && bodyResult.data) {
        rejectionReason = bodyResult.data.rejectionReason;
        rejectedBy = bodyResult.data.rejectedBy;
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
          error: `Cannot reject proposal in "${proposal.status}" status`,
          hint: proposal.status === 'applied'
            ? 'This proposal has already been accepted'
            : 'This proposal has already been rejected',
        },
        { status: 400 }
      );
    }

    // Archive the proposed plan if it exists
    const planIdToArchive = proposal.proposedPlanId;
    if (planIdToArchive) {
      await archivePlan(proposal.planType, planIdToArchive, {
        archivedReason: rejectionReason
          ? `Rejected proposal: ${rejectionReason}`
          : 'Rejected proposal',
      });
    }

    // Mark proposal as rejected
    const updatedProposal = await rejectProposal(proposalId, {
      resolvedBy: rejectedBy,
      rejectionReason,
    });

    if (!updatedProposal) {
      return NextResponse.json(
        { error: 'Failed to update proposal status' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      proposal: updatedProposal,
      message: 'Proposal rejected' + (planIdToArchive ? ' and proposed plan archived' : ''),
    });
  } catch (error) {
    console.error('[API] Proposal reject error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
