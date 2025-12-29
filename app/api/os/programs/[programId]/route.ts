// app/api/os/programs/[programId]/route.ts
// CRUD operations for a specific Planning Program
//
// Programs are the bridge between Strategy Tactics and executable Work Items.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getPlanningProgram,
  updatePlanningProgram,
  archivePlanningProgram,
} from '@/lib/airtable/planningPrograms';
import {
  PlanningProgramPatchSchema,
  isPlanningProgramReady,
  canCommitPlanningProgram,
} from '@/lib/types/program';

// ============================================================================
// Types
// ============================================================================

type Params = { params: Promise<{ programId: string }> };

// ============================================================================
// GET - Get program by ID
// ============================================================================

/**
 * GET /api/os/programs/[programId]
 * Get a specific Planning Program with readiness status
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { programId } = await params;

    const program = await getPlanningProgram(programId);

    if (!program) {
      return NextResponse.json(
        { error: 'Program not found' },
        { status: 404 }
      );
    }

    // Add readiness checks
    const isReady = isPlanningProgramReady(program);
    const canCommit = canCommitPlanningProgram(program);

    return NextResponse.json({
      program,
      readiness: {
        isReady,
        canCommit,
        status: program.status,
        hasDeliverables: program.scope.deliverables.length > 0,
        hasMilestones: program.planDetails.milestones.length > 0,
        hasKPIs: program.success.kpis.length > 0,
      },
    });
  } catch (error) {
    console.error('[API] Failed to get program:', error);
    return NextResponse.json(
      { error: 'Failed to get program' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH - Update program
// ============================================================================

/**
 * PATCH /api/os/programs/[programId]
 * Update program fields
 *
 * Supports partial updates to:
 * - title
 * - status (draft -> ready -> committed)
 * - origin
 * - scope (deliverables, workstreams, etc.)
 * - success (KPIs)
 * - planDetails (milestones, horizon)
 * - commitment (workItemIds, notes)
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { programId } = await params;

    // Check if program exists
    const existing = await getPlanningProgram(programId);
    if (!existing) {
      return NextResponse.json(
        { error: 'Program not found' },
        { status: 404 }
      );
    }

    // Parse request body once
    const rawBody = await request.json();

    // Prevent modification of committed programs (except for status rollback)
    if (existing.status === 'committed') {
      // Only allow status change for committed programs
      if (Object.keys(rawBody).some(k => k !== 'status')) {
        return NextResponse.json(
          { error: 'Cannot modify committed program. Archive or pause it first.' },
          { status: 400 }
        );
      }
    }

    // Validate request body
    const parseResult = PlanningProgramPatchSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const patch = parseResult.data;

    // Validate status transitions
    if (patch.status) {
      const validTransitions: Record<string, string[]> = {
        draft: ['ready', 'archived'],
        ready: ['draft', 'committed', 'archived'],
        committed: ['paused', 'archived'],
        paused: ['ready', 'archived'],
        archived: [], // No transitions out of archived
      };

      const allowed = validTransitions[existing.status] || [];
      if (!allowed.includes(patch.status)) {
        return NextResponse.json(
          {
            error: `Invalid status transition from ${existing.status} to ${patch.status}`,
            allowed: allowed,
          },
          { status: 400 }
        );
      }

      // Validate ready transition requires minimum content
      if (patch.status === 'ready') {
        const checkProgram = { ...existing, ...patch };
        if (!isPlanningProgramReady(checkProgram)) {
          return NextResponse.json(
            {
              error: 'Program is not ready. Ensure it has at least one deliverable.',
              requirements: ['At least one deliverable required'],
            },
            { status: 400 }
          );
        }
      }
    }

    const updated = await updatePlanningProgram(programId, patch);

    if (!updated) {
      return NextResponse.json(
        { error: 'Failed to update program' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      program: updated,
      readiness: {
        isReady: isPlanningProgramReady(updated),
        canCommit: canCommitPlanningProgram(updated),
      },
    });
  } catch (error) {
    console.error('[API] Failed to update program:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update program' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE - Archive program
// ============================================================================

/**
 * DELETE /api/os/programs/[programId]
 * Archive a program (soft delete)
 *
 * Committed programs can be archived but their work items remain.
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { programId } = await params;

    // Check if program exists
    const existing = await getPlanningProgram(programId);
    if (!existing) {
      return NextResponse.json(
        { error: 'Program not found' },
        { status: 404 }
      );
    }

    // Archive the program
    const archived = await archivePlanningProgram(programId);

    if (!archived) {
      return NextResponse.json(
        { error: 'Failed to archive program' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      program: archived,
      message: existing.status === 'committed'
        ? 'Committed program archived. Work items remain active.'
        : 'Program archived.',
    });
  } catch (error) {
    console.error('[API] Failed to archive program:', error);
    return NextResponse.json(
      { error: 'Failed to archive program' },
      { status: 500 }
    );
  }
}
