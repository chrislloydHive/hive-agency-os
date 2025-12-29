// app/api/os/case-studies/[id]/route.ts
// Case Study Detail API - Get, Update, Delete

import { NextRequest, NextResponse } from 'next/server';
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
 * GET /api/os/case-studies/[id]
 * Get a single case study by ID
 *
 * Query params:
 * - permission: 'public' | 'internal' - enforce permission level (optional)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const requiredPermission = searchParams.get('permission');

    const caseStudy = await getCaseStudyById(id);

    if (!caseStudy) {
      return NextResponse.json(
        { status: 'error', message: 'Case study not found' },
        { status: 404 }
      );
    }

    // Enforce permission if specified
    if (requiredPermission === 'public' && caseStudy.permissionLevel !== 'public') {
      return NextResponse.json(
        { status: 'error', message: 'Case study not accessible' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      status: 'ok',
      data: caseStudy,
    });
  } catch (error) {
    console.error('[os/case-studies/[id]] GET error:', error);
    return NextResponse.json(
      { status: 'error', message: 'Failed to fetch case study' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/os/case-studies/[id]
 * Update a case study
 *
 * Body: Partial<CaseStudyInput>
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Partial validation - allow any subset of fields
    const partialSchema = CaseStudyInputSchema.partial();
    const parsed = partialSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Invalid input',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const updated = await updateCaseStudy(id, parsed.data);

    if (!updated) {
      return NextResponse.json(
        { status: 'error', message: 'Case study not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      status: 'ok',
      data: updated,
    });
  } catch (error) {
    console.error('[os/case-studies/[id]] PATCH error:', error);
    return NextResponse.json(
      { status: 'error', message: 'Failed to update case study' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/os/case-studies/[id]
 * Delete a case study
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const success = await deleteCaseStudy(id);

    if (!success) {
      return NextResponse.json(
        { status: 'error', message: 'Failed to delete case study' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: 'ok',
      message: 'Case study deleted',
    });
  } catch (error) {
    console.error('[os/case-studies/[id]] DELETE error:', error);
    return NextResponse.json(
      { status: 'error', message: 'Failed to delete case study' },
      { status: 500 }
    );
  }
}
