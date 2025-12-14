// app/api/os/hive-brain/apply-proposal/route.ts
// Apply AI Copilot proposal to Hive Brain
//
// Takes a proposal and selected paths, applies the changes,
// and returns the updated graph.

import { NextRequest, NextResponse } from 'next/server';
import { getHiveGlobalContextGraph, updateHiveGlobalContextGraph } from '@/lib/contextGraph/globalGraph';
import { applyProposal, type Proposal, type JsonPointer } from '@/lib/os/writeContract';
import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';

// ============================================================================
// Types
// ============================================================================

interface ApplyProposalRequest {
  /** The proposal ID (for logging/audit) */
  proposalId: string;
  /** The selected paths to apply */
  selectedPaths: string[];
  /** The full proposal (passed from client since we don't persist proposals yet) */
  proposal?: Proposal;
}

interface ApplyProposalResponse {
  success: boolean;
  updatedGraph?: Record<string, unknown>;
  applied?: string[];
  skipped?: Array<{ path: string; reason: string; message: string }>;
  error?: string;
}

// ============================================================================
// Handler
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse<ApplyProposalResponse>> {
  try {
    const body = await request.json() as ApplyProposalRequest;
    const { proposalId, selectedPaths, proposal } = body;

    if (!selectedPaths || selectedPaths.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No paths selected to apply',
      }, { status: 400 });
    }

    // If no proposal provided, we can't apply changes
    // In the future, proposals might be stored server-side
    if (!proposal) {
      return NextResponse.json({
        success: false,
        error: 'Proposal data required. Pass the full proposal from the client.',
      }, { status: 400 });
    }

    // Get current Hive Brain state
    const currentGraph = await getHiveGlobalContextGraph();

    console.log('[apply-proposal] Applying proposal:', {
      proposalId,
      selectedPathsCount: selectedPaths.length,
      selectedPaths: selectedPaths.slice(0, 5),
      patchCount: proposal.patch?.length || 0,
      patchPaths: proposal.patch?.slice(0, 5).map(p => p.path),
    });

    // Apply the proposal with selected paths
    const result = applyProposal(currentGraph, proposal, {
      selectedPaths: selectedPaths as JsonPointer[],
      trustProposal: true, // We trust the conflict detection from proposal generation
    });

    console.log('[apply-proposal] Result:', {
      success: result.success,
      appliedCount: result.applied.length,
      skippedCount: result.skipped.length,
      skippedReasons: result.skipped.slice(0, 3),
    });

    if (!result.success) {
      return NextResponse.json({
        success: false,
        applied: result.applied,
        skipped: result.skipped,
        error: 'Failed to apply any changes',
      });
    }

    // Save the updated graph (source: 'manual' since human approved the AI proposal)
    const savedGraph = await updateHiveGlobalContextGraph(
      result.updatedState as CompanyContextGraph,
      'manual'
    );

    if (!savedGraph) {
      return NextResponse.json({
        success: false,
        applied: result.applied,
        skipped: result.skipped,
        error: 'Failed to save updated graph',
      }, { status: 500 });
    }

    console.log('[apply-proposal] Applied proposal', proposalId, {
      applied: result.applied.length,
      skipped: result.skipped.length,
    });

    return NextResponse.json({
      success: true,
      updatedGraph: result.updatedState as Record<string, unknown>,
      applied: result.applied,
      skipped: result.skipped,
    });

  } catch (error) {
    console.error('[apply-proposal] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to apply proposal',
    }, { status: 500 });
  }
}
