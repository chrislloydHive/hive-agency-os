// app/api/os/companies/[companyId]/proposals/[proposalId]/route.ts
// API routes for single proposal operations

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getProposalById,
  getProposalWithSections,
  updateProposal,
  deleteProposal,
} from '@/lib/airtable/proposals';

interface RouteParams {
  params: Promise<{ companyId: string; proposalId: string }>;
}

// GET /api/os/companies/[companyId]/proposals/[proposalId]
// Get a single proposal with all sections
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { companyId, proposalId } = await params;

    if (!companyId || !proposalId) {
      return NextResponse.json(
        { error: 'Company ID and Proposal ID are required' },
        { status: 400 }
      );
    }

    const result = await getProposalWithSections(proposalId);

    if (!result) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    // Verify ownership
    if (result.proposal.companyId !== companyId) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[proposals] GET single error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch proposal' },
      { status: 500 }
    );
  }
}

// PUT /api/os/companies/[companyId]/proposals/[proposalId]
// Update a proposal
const UpdateProposalSchema = z.object({
  title: z.string().min(1).optional(),
  status: z.enum(['draft', 'approved']).optional(),
});

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { companyId, proposalId } = await params;

    if (!companyId || !proposalId) {
      return NextResponse.json(
        { error: 'Company ID and Proposal ID are required' },
        { status: 400 }
      );
    }

    // Verify ownership first
    const existing = await getProposalById(proposalId);
    if (!existing || existing.companyId !== companyId) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = UpdateProposalSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updated = await updateProposal(proposalId, parsed.data);

    if (!updated) {
      return NextResponse.json(
        { error: 'Failed to update proposal' },
        { status: 500 }
      );
    }

    return NextResponse.json({ proposal: updated });
  } catch (error) {
    console.error('[proposals] PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update proposal' },
      { status: 500 }
    );
  }
}

// DELETE /api/os/companies/[companyId]/proposals/[proposalId]
// Delete a proposal and its sections
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { companyId, proposalId } = await params;

    if (!companyId || !proposalId) {
      return NextResponse.json(
        { error: 'Company ID and Proposal ID are required' },
        { status: 400 }
      );
    }

    // Verify ownership first
    const existing = await getProposalById(proposalId);
    if (!existing || existing.companyId !== companyId) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    const success = await deleteProposal(proposalId);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete proposal' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[proposals] DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete proposal' },
      { status: 500 }
    );
  }
}
