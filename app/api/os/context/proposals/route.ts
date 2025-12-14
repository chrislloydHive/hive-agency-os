// app/api/os/context/proposals/route.ts
// Context Proposals API
//
// GET: Load pending proposals for a company
// POST: Create a new proposal batch

import { NextRequest, NextResponse } from 'next/server';
import {
  loadPendingProposals,
  loadAllProposals,
  saveProposalBatch,
  createProposalBatch,
  getProposalSummary,
} from '@/lib/contextGraph/nodes';
import type { ContextProposal } from '@/lib/contextGraph/nodes';

// ============================================================================
// GET - Load proposals
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const includeResolved = searchParams.get('includeResolved') === 'true';
    const summaryOnly = searchParams.get('summary') === 'true';

    if (!companyId) {
      return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
    }

    // If summary only, return just the counts
    if (summaryOnly) {
      const summary = await getProposalSummary(companyId);
      return NextResponse.json({
        success: true,
        summary,
      });
    }

    // Load proposals
    const batches = includeResolved
      ? await loadAllProposals(companyId)
      : await loadPendingProposals(companyId);

    return NextResponse.json({
      success: true,
      batches,
      pendingCount: batches.reduce(
        (count, batch) =>
          count + batch.proposals.filter((p) => p.status === 'pending').length,
        0
      ),
    });
  } catch (error) {
    console.error('[API] context/proposals GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load proposals' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Create proposal batch
// ============================================================================

interface CreateProposalRequest {
  companyId: string;
  proposals: Array<{
    fieldPath: string;
    fieldLabel: string;
    proposedValue: unknown;
    currentValue: unknown | null;
    reasoning: string;
    confidence: number;
  }>;
  trigger: ContextProposal['trigger'];
  batchReasoning: string;
  triggerSource?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateProposalRequest;

    const { companyId, proposals, trigger, batchReasoning, triggerSource } = body;

    // Validation
    if (!companyId) {
      return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
    }

    if (!proposals || !Array.isArray(proposals) || proposals.length === 0) {
      return NextResponse.json(
        { error: 'Missing or empty proposals array' },
        { status: 400 }
      );
    }

    if (!trigger) {
      return NextResponse.json({ error: 'Missing trigger' }, { status: 400 });
    }

    // Validate each proposal
    for (const p of proposals) {
      if (!p.fieldPath || !p.fieldLabel) {
        return NextResponse.json(
          { error: 'Each proposal must have fieldPath and fieldLabel' },
          { status: 400 }
        );
      }
      if (p.confidence === undefined || p.confidence < 0 || p.confidence > 1) {
        return NextResponse.json(
          { error: 'Each proposal must have confidence between 0 and 1' },
          { status: 400 }
        );
      }
    }

    // Create the proposal batch
    const batch = createProposalBatch(
      companyId,
      proposals,
      trigger,
      batchReasoning || 'AI-generated proposals',
      triggerSource
    );

    // Save to storage
    const saved = await saveProposalBatch(batch);

    if (!saved) {
      return NextResponse.json(
        { error: 'Failed to save proposal batch' },
        { status: 500 }
      );
    }

    console.log(
      `[API] context/proposals: Created batch ${batch.id} with ${proposals.length} proposals for ${companyId}`
    );

    return NextResponse.json({
      success: true,
      batch: {
        id: batch.id,
        companyId: batch.companyId,
        proposalCount: batch.proposals.length,
        trigger: batch.trigger,
        status: batch.status,
        createdAt: batch.createdAt,
      },
    });
  } catch (error) {
    console.error('[API] context/proposals POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create proposals' },
      { status: 500 }
    );
  }
}
