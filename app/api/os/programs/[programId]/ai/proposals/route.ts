// app/api/os/programs/[programId]/ai/proposals/route.ts
// AI Co-planner: Proposal Management
//
// GET - List pending proposals for a program
// POST - Apply or reject a proposal

import { NextRequest, NextResponse } from 'next/server';
import { getPlanningProgram, updatePlanningProgram } from '@/lib/airtable/planningPrograms';
import {
  getProposals,
  getPendingProposals,
  applyProposal,
  rejectProposal,
} from '@/lib/os/programs/proposals';
import type { ApplyProposalOptions, ProposalType } from '@/lib/types/program';

// ============================================================================
// Types
// ============================================================================

type RouteParams = {
  params: Promise<{ programId: string }>;
};

interface ApplyRequest {
  action: 'apply' | 'reject';
  proposalId: string;
  options?: ApplyProposalOptions;
}

// ============================================================================
// GET - List proposals
// ============================================================================

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { programId } = await params;
    const url = new URL(request.url);
    const status = url.searchParams.get('status'); // 'pending' | 'all'

    // Verify program exists
    const program = await getPlanningProgram(programId);
    if (!program) {
      return NextResponse.json(
        { error: 'Program not found' },
        { status: 404 }
      );
    }

    const proposals = status === 'pending'
      ? getPendingProposals(programId)
      : getProposals(programId);

    return NextResponse.json({
      proposals,
      count: proposals.length,
      pendingCount: getPendingProposals(programId).length,
    });
  } catch (error) {
    console.error('[ai/proposals] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get proposals' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Apply or reject a proposal
// ============================================================================

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { programId } = await params;
    const body = (await request.json()) as ApplyRequest;

    // Validate request
    if (!body.action || !['apply', 'reject'].includes(body.action)) {
      return NextResponse.json(
        { error: 'action must be "apply" or "reject"' },
        { status: 400 }
      );
    }

    if (!body.proposalId) {
      return NextResponse.json(
        { error: 'proposalId is required' },
        { status: 400 }
      );
    }

    // Load program
    const program = await getPlanningProgram(programId);
    if (!program) {
      return NextResponse.json(
        { error: 'Program not found' },
        { status: 404 }
      );
    }

    // GUARDRAIL: Cannot modify committed programs
    if (program.status === 'committed') {
      return NextResponse.json(
        { error: 'Cannot modify committed program. Pause or archive it first.' },
        { status: 400 }
      );
    }

    // Handle rejection
    if (body.action === 'reject') {
      const rejected = rejectProposal(programId, body.proposalId);
      if (!rejected) {
        return NextResponse.json(
          { error: 'Proposal not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        proposal: rejected,
        message: 'Proposal rejected',
      });
    }

    // Handle apply
    const result = applyProposal(program, body.proposalId, body.options || {});

    if (!result.success) {
      console.error('[ai/proposals] Apply failed:', {
        proposalId: body.proposalId,
        warnings: result.warnings,
        stats: result.stats,
      });
      return NextResponse.json(
        {
          error: 'Failed to apply proposal',
          warnings: result.warnings,
          debug: { proposalId: body.proposalId, stats: result.stats },
        },
        { status: 400 }
      );
    }

    // Persist the patch to Airtable
    if (Object.keys(result.patch).length > 0) {
      const updated = await updatePlanningProgram(programId, result.patch);

      if (!updated) {
        return NextResponse.json(
          { error: 'Failed to save changes to program' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        proposal: result.proposal,
        program: updated,
        stats: result.stats,
        warnings: result.warnings,
        message: buildSuccessMessage(result.stats),
      });
    }

    // Nothing to apply (all duplicates skipped)
    return NextResponse.json({
      success: true,
      proposal: result.proposal,
      stats: result.stats,
      warnings: result.warnings,
      message: 'No new content to apply (all items already exist)',
    });
  } catch (error) {
    console.error('[ai/proposals] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process proposal' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helpers
// ============================================================================

function buildSuccessMessage(stats: {
  deliverables: { added: number; skipped: number };
  milestones: { added: number; skipped: number };
  kpis: { added: number; skipped: number };
  summaryUpdated: boolean;
  assumptionsAdded: number;
  constraintsAdded: number;
  dependenciesAdded: number;
  risksAdded: number;
}): string {
  const parts: string[] = [];

  if (stats.deliverables.added > 0) {
    parts.push(`${stats.deliverables.added} deliverable${stats.deliverables.added > 1 ? 's' : ''}`);
  }
  if (stats.milestones.added > 0) {
    parts.push(`${stats.milestones.added} milestone${stats.milestones.added > 1 ? 's' : ''}`);
  }
  if (stats.kpis.added > 0) {
    parts.push(`${stats.kpis.added} KPI${stats.kpis.added > 1 ? 's' : ''}`);
  }
  if (stats.summaryUpdated) {
    parts.push('summary');
  }
  if (stats.risksAdded > 0) {
    parts.push(`${stats.risksAdded} risk${stats.risksAdded > 1 ? 's' : ''}`);
  }
  if (stats.dependenciesAdded > 0) {
    parts.push(`${stats.dependenciesAdded} dependenc${stats.dependenciesAdded > 1 ? 'ies' : 'y'}`);
  }

  if (parts.length === 0) {
    return 'Draft applied';
  }

  return `Added ${parts.join(', ')}`;
}
