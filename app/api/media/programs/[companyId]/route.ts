// app/api/media/programs/[companyId]/route.ts
// API route for media program CRUD
//
// GET /api/media/programs/[companyId] - Get program for company
// POST /api/media/programs/[companyId] - Create new program
// PATCH /api/media/programs/[companyId] - Update existing program

import { NextRequest, NextResponse } from 'next/server';
import {
  getMediaProgram,
  createMediaProgram,
  updateMediaProgram,
  setMediaProgramStatus,
  deleteMediaProgram,
} from '@/lib/media/programs';
import type { CreateMediaProgramInput, UpdateMediaProgramInput, MediaProgramStatus } from '@/lib/media/programs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;

  if (!companyId) {
    return NextResponse.json({ error: 'Company ID required' }, { status: 400 });
  }

  try {
    const program = await getMediaProgram(companyId);
    return NextResponse.json({ program });
  } catch (error) {
    console.error('Error fetching media program:', error);
    return NextResponse.json(
      { error: 'Failed to fetch media program' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;

  if (!companyId) {
    return NextResponse.json({ error: 'Company ID required' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const input: CreateMediaProgramInput = {
      name: body.name,
      channels: body.channels,
      totalMonthlyBudget: body.totalMonthlyBudget,
      planId: body.planId,
      notes: body.notes,
    };

    const program = await createMediaProgram(companyId, input);
    return NextResponse.json({ program }, { status: 201 });
  } catch (error) {
    console.error('Error creating media program:', error);
    return NextResponse.json(
      { error: 'Failed to create media program' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;

  if (!companyId) {
    return NextResponse.json({ error: 'Company ID required' }, { status: 400 });
  }

  try {
    const body = await request.json();

    // Handle status change action
    if (body.action === 'setStatus' && body.programId && body.status) {
      const status = body.status as MediaProgramStatus;
      const program = await setMediaProgramStatus(companyId, body.programId, status);
      return NextResponse.json({ program });
    }

    // Handle delete action
    if (body.action === 'delete' && body.programId) {
      await deleteMediaProgram(companyId, body.programId);
      return NextResponse.json({ success: true });
    }

    // Regular update
    if (!body.programId) {
      return NextResponse.json({ error: 'Program ID required for update' }, { status: 400 });
    }

    const input: UpdateMediaProgramInput = {
      name: body.name,
      channels: body.channels,
      totalMonthlyBudget: body.totalMonthlyBudget,
      planId: body.planId,
      forecastId: body.forecastId,
      notes: body.notes,
    };

    const program = await updateMediaProgram(companyId, body.programId, input);
    return NextResponse.json({ program });
  } catch (error) {
    console.error('Error updating media program:', error);
    return NextResponse.json(
      { error: 'Failed to update media program' },
      { status: 500 }
    );
  }
}
