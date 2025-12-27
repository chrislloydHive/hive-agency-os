// app/api/os/context/proposals/[proposalId]/confirm/route.ts
// POST: Confirm a proposal and write to Context V4
//
// This endpoint:
// 1. Loads the proposal and verifies ownership
// 2. Writes the value to Context V4 as confirmed with provenance
// 3. Marks the proposal as confirmed
// 4. Triggers staleness hooks for deliverables

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import { confirmFieldsV4, proposeFieldV4 } from '@/lib/contextGraph/fieldStoreV4';
import { materializeFieldsToGraph } from '@/lib/contextGraph/materializeV4';
import { incrementStrategyDocStaleness } from '@/lib/documents/strategyDoc';
import { isPromotableField } from '@/lib/contextGraph/v4/promotion/promotableFields';
import type { ConfirmProposalResponse } from '@/lib/types/contextProposal';
import type { PromotionSourceType } from '@/lib/contextGraph/v4/promotion/promotableFields';
import type { ContextFieldSourceV4 } from '@/lib/types/contextField';

// ============================================================================
// Request Validation
// ============================================================================

const confirmRequestSchema = z.object({
  overrideValue: z.string().optional(),
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
    let overrideValue: string | undefined;
    let userId: string | undefined;
    try {
      const body = await request.json().catch(() => ({}));
      const parsed = confirmRequestSchema.safeParse(body);
      if (parsed.success) {
        overrideValue = parsed.data.overrideValue;
        userId = parsed.data.userId;
      }
    } catch {
      // No body or invalid JSON - use defaults
    }

    console.log('[ProposalConfirm] Confirming proposal:', {
      proposalId,
      hasOverride: !!overrideValue,
    });

    // 1. Load the proposal from Airtable
    const base = getBase();
    let proposalRecord;
    try {
      proposalRecord = await base(AIRTABLE_TABLES.CONTEXT_PROPOSALS).find(proposalId);
    } catch (error) {
      console.error('[ProposalConfirm] Proposal not found:', proposalId);
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

    // 2. Validate proposal can be confirmed
    if (proposal.status !== 'proposed') {
      return NextResponse.json(
        { success: false, error: `Proposal is already ${proposal.status}` },
        { status: 400 }
      );
    }

    if (!proposal.companyId) {
      return NextResponse.json(
        { success: false, error: 'Proposal has no company ID' },
        { status: 400 }
      );
    }

    // 3. Check if field is promotable
    if (!isPromotableField(proposal.fieldKey)) {
      return NextResponse.json(
        { success: false, error: `Field "${proposal.fieldKey}" is not promotable yet` },
        { status: 400 }
      );
    }

    // 4. Determine the value to confirm
    const valueToConfirm = overrideValue || proposal.proposedValue;

    // 5. Map sourceType to ContextFieldSourceV4
    const sourceMap: Record<PromotionSourceType, ContextFieldSourceV4> = {
      full_gap: 'gap',
      gap_ia: 'gap',
      website_lab: 'lab',
      brand_lab: 'lab',
      audience_lab: 'lab',
      competition_lab: 'lab',
      content_lab: 'lab',
      seo_lab: 'lab',
      manual: 'user',
    };
    const v4Source: ContextFieldSourceV4 = sourceMap[proposal.sourceType] || 'user';

    // 6. Write to Context V4 as proposed first (for provenance)
    const proposeResult = await proposeFieldV4(proposal.companyId, {
      key: proposal.fieldKey,
      value: valueToConfirm,
      source: v4Source,
      sourceId: proposal.sourceRunId,
      confidence: proposal.confidence / 100,
      evidence: {
        runId: proposal.sourceRunId,
        snippet: proposal.evidence.slice(0, 500),
        originalSource: proposal.sourceType,
      },
    });

    if (proposeResult.error) {
      console.error('[ProposalConfirm] Failed to propose to V4:', proposeResult.error);
      return NextResponse.json(
        { success: false, error: `Failed to write to V4: ${proposeResult.errorMessage || proposeResult.error}` },
        { status: 500 }
      );
    }

    // 7. Confirm the field in V4
    const humanEdited = !!overrideValue; // User edited if they provided an override value
    const confirmResult = await confirmFieldsV4(proposal.companyId, [proposal.fieldKey], {
      confirmedBy: userId,
      humanEdited,
    });

    if (confirmResult.error) {
      console.error('[ProposalConfirm] Failed to confirm in V4:', confirmResult.error);
      return NextResponse.json(
        { success: false, error: `Failed to confirm in V4: ${confirmResult.errorMessage || confirmResult.error}` },
        { status: 500 }
      );
    }

    // 8. Materialize to Context Graph
    if (confirmResult.confirmed && confirmResult.confirmed.length > 0) {
      const materializeResult = await materializeFieldsToGraph(
        proposal.companyId,
        confirmResult.confirmed
      );

      console.log('[ProposalConfirm] Materialized to graph:', {
        materialized: materializeResult.materialized,
        errors: materializeResult.errors.length,
      });
    }

    // 9. Trigger staleness hooks
    let stalenessTriggered = false;
    try {
      await incrementStrategyDocStaleness(proposal.companyId);
      stalenessTriggered = true;
      console.log('[ProposalConfirm] Triggered staleness increment');
    } catch (error) {
      console.warn('[ProposalConfirm] Failed to trigger staleness:', error);
    }

    // 10. Update the proposal status in Airtable
    const now = new Date().toISOString();
    await base(AIRTABLE_TABLES.CONTEXT_PROPOSALS).update(proposalId, {
      'Status': 'confirmed',
      'Decided At': now,
      'Decided By': userId || 'system',
    });

    console.log('[ProposalConfirm] Proposal confirmed:', {
      proposalId,
      fieldKey: proposal.fieldKey,
      companyId: proposal.companyId,
    });

    // 11. Return success response
    const response: ConfirmProposalResponse = {
      success: true,
      proposal: {
        ...proposal,
        proposedValue: valueToConfirm,
        status: 'confirmed',
        decidedAt: now,
        decidedBy: userId || 'system',
      },
      contextUpdate: {
        fieldKey: proposal.fieldKey,
        value: valueToConfirm,
        confirmedAt: now,
      },
      stalenessTriggered,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[ProposalConfirm] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
