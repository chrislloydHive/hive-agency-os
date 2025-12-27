// app/api/os/context/proposals/[proposalId]/reject/route.ts
// POST: Reject a proposal without modifying Context V4
//
// This endpoint:
// 1. Loads the proposal and verifies it's in proposed status
// 2. Marks the proposal as rejected with decidedAt timestamp
// 3. Does NOT touch Context V4 data

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import type { RejectProposalResponse } from '@/lib/types/contextProposal';
import type { PromotionSourceType } from '@/lib/contextGraph/v4/promotion/promotableFields';

// ============================================================================
// Request Validation
// ============================================================================

const rejectRequestSchema = z.object({
  reason: z.string().optional(),
  userId: z.string().optional(),
});

// ============================================================================
// Route Handler
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ proposalId: string }> }
) {
  try {
    const { proposalId } = await params;

    if (!proposalId) {
      return NextResponse.json(
        { success: false, error: 'Proposal ID is required' },
        { status: 400 }
      );
    }

    // Parse request body
    let reason: string | undefined;
    let userId: string | undefined;
    try {
      const body = await request.json().catch(() => ({}));
      const parsed = rejectRequestSchema.safeParse(body);
      if (parsed.success) {
        reason = parsed.data.reason;
        userId = parsed.data.userId;
      }
    } catch {
      // No body or invalid JSON - use defaults
    }

    console.log('[ProposalReject] Rejecting proposal:', {
      proposalId,
      hasReason: !!reason,
    });

    // 1. Load the proposal from Airtable
    const base = getBase();
    let proposalRecord;
    try {
      proposalRecord = await base(AIRTABLE_TABLES.CONTEXT_PROPOSALS).find(proposalId);
    } catch (error) {
      console.error('[ProposalReject] Proposal not found:', proposalId);
      return NextResponse.json(
        { success: false, error: 'Proposal not found' },
        { status: 404 }
      );
    }

    const proposal = {
      id: proposalRecord.id,
      companyId: (proposalRecord.fields['Company ID'] as string) || '',
      fieldKey: (proposalRecord.fields['Field Key'] as string) || '',
      proposedValue: (proposalRecord.fields['Proposed Value'] as string) || '',
      status: (proposalRecord.fields['Status'] as string) || 'proposed',
      sourceType: (proposalRecord.fields['Source Type'] as PromotionSourceType) || 'manual',
      sourceRunId: (proposalRecord.fields['Source Run ID'] as string) || undefined,
      evidence: (proposalRecord.fields['Evidence'] as string) || '',
      confidence: (proposalRecord.fields['Confidence'] as number) || 0,
      createdAt: (proposalRecord.fields['Created At'] as string) || new Date().toISOString(),
    };

    // 2. Validate proposal can be rejected
    if (proposal.status !== 'proposed') {
      return NextResponse.json(
        { success: false, error: `Proposal is already ${proposal.status}` },
        { status: 400 }
      );
    }

    // 3. Update the proposal status in Airtable (no Context V4 changes)
    const now = new Date().toISOString();
    const updateFields: { [key: string]: string } = {
      'Status': 'rejected',
      'Decided At': now,
      'Decided By': userId || 'system',
    };

    // Optionally store rejection reason if the table has that field
    if (reason) {
      updateFields['Rejection Reason'] = reason;
    }

    await base(AIRTABLE_TABLES.CONTEXT_PROPOSALS).update(proposalId, updateFields);

    console.log('[ProposalReject] Proposal rejected:', {
      proposalId,
      fieldKey: proposal.fieldKey,
      companyId: proposal.companyId,
    });

    // 4. Return success response
    const response: RejectProposalResponse = {
      success: true,
      proposal: {
        ...proposal,
        status: 'rejected',
        decidedAt: now,
        decidedBy: userId || 'system',
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[ProposalReject] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
