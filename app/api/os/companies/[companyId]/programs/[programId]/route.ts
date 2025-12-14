// app/api/os/companies/[companyId]/programs/[programId]/route.ts
// Program API - Read and Update a specific program
//
// GET: Get program details
// PATCH: Update program plan (user-authored only, no AI)

import { NextRequest, NextResponse } from 'next/server';
import {
  getProgramById,
  updateProgramPlan,
} from '@/lib/airtable/programs';
import type { UpdateProgramRequest } from '@/lib/types/program';

interface RouteParams {
  params: Promise<{ companyId: string; programId: string }>;
}

// ============================================================================
// GET - Get program by ID
// ============================================================================

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { companyId, programId } = await params;

    if (!companyId || !programId) {
      return NextResponse.json(
        { error: 'Company ID and Program ID are required' },
        { status: 400 }
      );
    }

    const program = await getProgramById(programId);

    if (!program) {
      return NextResponse.json(
        { error: 'Program not found' },
        { status: 404 }
      );
    }

    // Verify program belongs to company
    if (program.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Program does not belong to this company' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      program,
    });
  } catch (error) {
    console.error('[API] Program get error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH - Update program plan
// ============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { companyId, programId } = await params;

    if (!companyId || !programId) {
      return NextResponse.json(
        { error: 'Company ID and Program ID are required' },
        { status: 400 }
      );
    }

    // Verify program exists and belongs to company
    const existing = await getProgramById(programId);
    if (!existing) {
      return NextResponse.json(
        { error: 'Program not found' },
        { status: 404 }
      );
    }

    if (existing.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Program does not belong to this company' },
        { status: 403 }
      );
    }

    const body = await request.json() as UpdateProgramRequest;
    const { plan } = body;

    if (!plan || typeof plan !== 'object') {
      return NextResponse.json(
        { error: 'Plan object is required' },
        { status: 400 }
      );
    }

    // Only allow updating specific plan fields (including AI-generated fields)
    const allowedFields = [
      'title',
      'summary',
      'objectiveFraming',
      'currentStateSummary',
      'priorities',
      'sequencing',
      'exclusions',
      'readinessGates',
      'assumptions',
      'unknowns',
      'dependencies',
    ];
    const updateFields: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (field in plan) {
        updateFields[field] = plan[field as keyof typeof plan];
      }
    }

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    console.log(`[Programs] Updating program ${programId}:`, {
      fields: Object.keys(updateFields),
    });

    const updated = await updateProgramPlan(programId, updateFields);

    if (!updated) {
      return NextResponse.json(
        { error: 'Failed to update program' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      program: updated,
      message: 'Program updated successfully',
    });
  } catch (error) {
    console.error('[API] Program update error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
