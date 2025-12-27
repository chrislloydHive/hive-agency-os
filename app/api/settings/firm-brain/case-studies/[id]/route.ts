// app/api/settings/firm-brain/case-studies/[id]/route.ts
// Individual Case Study API - Get, Update, Delete

import { NextResponse } from 'next/server';
import {
  getCaseStudyById,
  updateCaseStudy,
  deleteCaseStudy,
} from '@/lib/airtable/firmBrain';
import { CaseStudyInputSchema } from '@/lib/types/firmBrain';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/settings/firm-brain/case-studies/[id]
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const caseStudy = await getCaseStudyById(id);

    if (!caseStudy) {
      return NextResponse.json({ error: 'Case study not found' }, { status: 404 });
    }

    return NextResponse.json({ caseStudy });
  } catch (error) {
    console.error('[firm-brain/case-studies/[id]] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch case study' }, { status: 500 });
  }
}

/**
 * PUT /api/settings/firm-brain/case-studies/[id]
 */
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = CaseStudyInputSchema.partial().safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const caseStudy = await updateCaseStudy(id, parsed.data);

    if (!caseStudy) {
      return NextResponse.json({ error: 'Case study not found' }, { status: 404 });
    }

    return NextResponse.json({ caseStudy });
  } catch (error) {
    console.error('[firm-brain/case-studies/[id]] PUT error:', error);
    return NextResponse.json({ error: 'Failed to update case study' }, { status: 500 });
  }
}

/**
 * DELETE /api/settings/firm-brain/case-studies/[id]
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const deleted = await deleteCaseStudy(id);

    if (!deleted) {
      return NextResponse.json({ error: 'Failed to delete case study' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[firm-brain/case-studies/[id]] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete case study' }, { status: 500 });
  }
}
