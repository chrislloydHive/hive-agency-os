// app/api/os/companies/[companyId]/rfps/[rfpId]/sections/[sectionKey]/route.ts
// Individual RFP Section API - Get and Update

import { NextResponse } from 'next/server';
import { getRfpSectionByKey, updateRfpSection } from '@/lib/airtable/rfp';
import type { RfpSectionKey } from '@/lib/types/rfp';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ companyId: string; rfpId: string; sectionKey: string }>;
}

const VALID_SECTION_KEYS: RfpSectionKey[] = [
  'agency_overview',
  'approach',
  'team',
  'work_samples',
  'plan_timeline',
  'pricing',
  'references',
];

const SectionUpdateSchema = z.object({
  title: z.string().optional(),
  status: z.enum(['empty', 'draft', 'ready', 'approved']).optional(),
  contentWorking: z.string().nullable().optional(),
  contentApproved: z.string().nullable().optional(),
  sourceType: z.enum(['firm_brain', 'generated', 'manual']).nullable().optional(),
  needsReview: z.boolean().optional(),
  reviewNotes: z.string().nullable().optional(),
});

/**
 * GET /api/os/companies/[companyId]/rfps/[rfpId]/sections/[sectionKey]
 * Get a specific RFP section
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { rfpId, sectionKey } = await params;

    if (!VALID_SECTION_KEYS.includes(sectionKey as RfpSectionKey)) {
      return NextResponse.json({ error: 'Invalid section key' }, { status: 400 });
    }

    const section = await getRfpSectionByKey(rfpId, sectionKey as RfpSectionKey);

    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }

    return NextResponse.json({ section });
  } catch (error) {
    console.error('[rfps/sections/[sectionKey]] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch section' }, { status: 500 });
  }
}

/**
 * PUT /api/os/companies/[companyId]/rfps/[rfpId]/sections/[sectionKey]
 * Update a specific RFP section
 */
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { rfpId, sectionKey } = await params;

    if (!VALID_SECTION_KEYS.includes(sectionKey as RfpSectionKey)) {
      return NextResponse.json({ error: 'Invalid section key' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = SectionUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Get the section to get its ID
    const existing = await getRfpSectionByKey(rfpId, sectionKey as RfpSectionKey);
    if (!existing) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }

    const section = await updateRfpSection(existing.id, parsed.data);

    if (!section) {
      return NextResponse.json({ error: 'Failed to update section' }, { status: 500 });
    }

    return NextResponse.json({ section });
  } catch (error) {
    console.error('[rfps/sections/[sectionKey]] PUT error:', error);
    return NextResponse.json({ error: 'Failed to update section' }, { status: 500 });
  }
}
