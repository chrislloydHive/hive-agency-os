// app/api/os/companies/[companyId]/programs/[programId]/activate/route.ts
// Activate Program API
//
// POST: Activate this program and archive other active programs of the same type

import { NextRequest, NextResponse } from 'next/server';
import {
  getProgramById,
  activateProgram,
} from '@/lib/airtable/programs';

interface RouteParams {
  params: Promise<{ companyId: string; programId: string }>;
}

// ============================================================================
// POST - Activate program
// ============================================================================

export async function POST(
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

    // Can't activate an already active program
    if (existing.status === 'active') {
      return NextResponse.json({
        success: true,
        program: existing,
        message: 'Program is already active',
        archived: [],
      });
    }

    // Can't activate an archived program
    if (existing.status === 'archived') {
      return NextResponse.json(
        { error: 'Cannot activate an archived program. Create a new draft instead.' },
        { status: 400 }
      );
    }

    console.log(`[Programs] Activating program ${programId} for company ${companyId}`);

    const { activated, archived } = await activateProgram(
      programId,
      companyId,
      existing.type
    );

    if (!activated) {
      return NextResponse.json(
        { error: 'Failed to activate program' },
        { status: 500 }
      );
    }

    console.log(`[Programs] Activated program ${programId}, archived: ${archived.join(', ') || 'none'}`);

    return NextResponse.json({
      success: true,
      program: activated,
      message: 'Program activated successfully',
      archived,
    });
  } catch (error) {
    console.error('[API] Program activate error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
