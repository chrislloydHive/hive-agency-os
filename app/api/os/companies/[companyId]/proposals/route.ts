// app/api/os/companies/[companyId]/proposals/route.ts
// API routes for proposals list and creation

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getProposalsForCompany,
  createProposal,
  initializeProposalSections,
} from '@/lib/airtable/proposals';
import { ProposalInputSchema } from '@/lib/types/proposal';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

// GET /api/os/companies/[companyId]/proposals
// List all proposals for a company
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { companyId } = await params;

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 });
    }

    const proposals = await getProposalsForCompany(companyId);

    return NextResponse.json({ proposals });
  } catch (error) {
    console.error('[proposals] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch proposals' },
      { status: 500 }
    );
  }
}

// POST /api/os/companies/[companyId]/proposals
// Create a new proposal (not from RFP conversion - use convert endpoint for that)
const CreateProposalSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  sourceRfpId: z.string().optional(),
});

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { companyId } = await params;

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = CreateProposalSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { title, sourceRfpId } = parsed.data;

    // Create the proposal
    const proposal = await createProposal({
      companyId,
      title,
      status: 'draft',
      sourceRfpId: sourceRfpId || null,
      firmBrainSnapshot: null,
      createdBy: null,
    });

    // Initialize empty sections
    await initializeProposalSections(proposal.id);

    return NextResponse.json({ proposal }, { status: 201 });
  } catch (error) {
    console.error('[proposals] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create proposal' },
      { status: 500 }
    );
  }
}
