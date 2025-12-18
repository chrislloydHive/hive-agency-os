// app/api/os/companies/[companyId]/programs/discard-draft/route.ts
// Strategy → Programs → Work Handoff: Discard Draft
//
// Deletes a program handoff draft without applying it.
// This is the "cancel" action for the AI-first handoff flow.

import { NextRequest, NextResponse } from 'next/server';
import {
  getHandoffDraftById,
  deleteHandoffDraft,
  deleteHandoffDraftsForStrategy,
} from '@/lib/os/programs/handoffDrafts';
import type { DiscardHandoffResponse } from '@/lib/types/programHandoff';

// ============================================================================
// DELETE Handler - Discard Draft
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const { searchParams } = new URL(request.url);

    const draftId = searchParams.get('draftId');
    const strategyId = searchParams.get('strategyId');

    // Must provide either draftId or strategyId
    if (!draftId && !strategyId) {
      return NextResponse.json(
        { error: 'Missing draftId or strategyId query param' },
        { status: 400 }
      );
    }

    // If strategyId is provided, delete all drafts for that strategy
    if (strategyId) {
      console.log('[discard-draft] Discarding all drafts for strategy:', { companyId, strategyId });

      const deletedCount = await deleteHandoffDraftsForStrategy(companyId, strategyId);

      console.log('[discard-draft] Deleted drafts:', deletedCount);

      return NextResponse.json({
        success: true,
        deletedCount,
        strategyId,
      });
    }

    // Otherwise delete specific draft by ID
    console.log('[discard-draft] Discarding draft:', { companyId, draftId });

    // Verify draft exists and belongs to company
    const draft = await getHandoffDraftById(draftId!);

    if (!draft) {
      return NextResponse.json(
        { error: 'Draft not found' },
        { status: 404 }
      );
    }

    if (draft.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Draft does not belong to this company' },
        { status: 403 }
      );
    }

    // Delete the draft
    const deleted = await deleteHandoffDraft(draftId!);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Failed to delete draft' },
        { status: 500 }
      );
    }

    console.log('[discard-draft] Draft discarded successfully:', draftId);

    const response: DiscardHandoffResponse = {
      success: true,
      draftId: draftId!,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[discard-draft] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to discard draft' },
      { status: 500 }
    );
  }
}
