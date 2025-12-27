// app/api/os/companies/[companyId]/proposals/[proposalId]/sections/[sectionKey]/route.ts
// API routes for proposal section operations

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getProposalById,
  getProposalSectionByKey,
  updateProposalSection,
} from '@/lib/airtable/proposals';
import type { ProposalSectionKey } from '@/lib/types/proposal';

interface RouteParams {
  params: Promise<{ companyId: string; proposalId: string; sectionKey: string }>;
}

const VALID_SECTION_KEYS: ProposalSectionKey[] = [
  'scope',
  'approach',
  'deliverables',
  'timeline',
  'pricing',
  'proof',
  'team',
];

// GET /api/os/companies/[companyId]/proposals/[proposalId]/sections/[sectionKey]
// Get a single proposal section
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { companyId, proposalId, sectionKey } = await params;

    if (!companyId || !proposalId || !sectionKey) {
      return NextResponse.json(
        { error: 'Company ID, Proposal ID, and Section Key are required' },
        { status: 400 }
      );
    }

    if (!VALID_SECTION_KEYS.includes(sectionKey as ProposalSectionKey)) {
      return NextResponse.json(
        { error: 'Invalid section key' },
        { status: 400 }
      );
    }

    // Verify ownership
    const proposal = await getProposalById(proposalId);
    if (!proposal || proposal.companyId !== companyId) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    const section = await getProposalSectionByKey(proposalId, sectionKey as ProposalSectionKey);

    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }

    return NextResponse.json({ section });
  } catch (error) {
    console.error('[proposals] GET section error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch section' },
      { status: 500 }
    );
  }
}

// PUT /api/os/companies/[companyId]/proposals/[proposalId]/sections/[sectionKey]
// Update a proposal section
const UpdateSectionSchema = z.object({
  content: z.string().nullable().optional(),
  status: z.enum(['empty', 'draft', 'approved']).optional(),
  sourceType: z.enum(['rfp_converted', 'manual', 'library']).nullable().optional(),
  sourceLibrarySectionId: z.string().nullable().optional(),
});

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { companyId, proposalId, sectionKey } = await params;

    if (!companyId || !proposalId || !sectionKey) {
      return NextResponse.json(
        { error: 'Company ID, Proposal ID, and Section Key are required' },
        { status: 400 }
      );
    }

    if (!VALID_SECTION_KEYS.includes(sectionKey as ProposalSectionKey)) {
      return NextResponse.json(
        { error: 'Invalid section key' },
        { status: 400 }
      );
    }

    // Verify ownership
    const proposal = await getProposalById(proposalId);
    if (!proposal || proposal.companyId !== companyId) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    const existingSection = await getProposalSectionByKey(proposalId, sectionKey as ProposalSectionKey);
    if (!existingSection) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = UpdateSectionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Auto-update status based on content
    const updates = { ...parsed.data };
    if (updates.content !== undefined && !updates.status) {
      const hasContent = updates.content && updates.content.trim().length > 0;
      // If adding content and status is empty, move to draft
      if (hasContent && existingSection.status === 'empty') {
        updates.status = 'draft';
      }
      // If clearing content, move to empty
      if (!hasContent) {
        updates.status = 'empty';
      }
    }

    // If manually editing, set sourceType to manual
    if (updates.content !== undefined && updates.sourceType === undefined) {
      updates.sourceType = 'manual';
    }

    const updated = await updateProposalSection(existingSection.id, updates);

    if (!updated) {
      return NextResponse.json(
        { error: 'Failed to update section' },
        { status: 500 }
      );
    }

    return NextResponse.json({ section: updated });
  } catch (error) {
    console.error('[proposals] PUT section error:', error);
    return NextResponse.json(
      { error: 'Failed to update section' },
      { status: 500 }
    );
  }
}
