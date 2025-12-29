// app/api/os/programs/[programId]/commit/route.ts
// Commit a Planning Program to create/sync Work items
//
// This is the final step in the Strategy → Program → Work flow.
// When a program is committed, its deliverables are materialized to Work items.
// Supports re-syncing to update existing work items.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getPlanningProgram } from '@/lib/airtable/planningPrograms';
import { materializeWorkFromProgram, type SyncMode } from '@/lib/os/planning/materializeWork';
import { buildProgramWorkPlan } from '@/lib/os/planning/programToWork';
import { canCommitPlanningProgram } from '@/lib/types/program';

// ============================================================================
// Types
// ============================================================================

type Params = { params: Promise<{ programId: string }> };

// ============================================================================
// Validation Schemas
// ============================================================================

const SyncModeSchema = z.enum(['additive', 'update', 'full']);

const CommitRequestSchema = z.object({
  /** Optional notes about the commitment */
  notes: z.string().optional(),
  /** Optional user ID who is committing */
  committedBy: z.string().optional(),
  /** Skip creating work items (for testing) */
  dryRun: z.boolean().optional().default(false),
  /** Force re-sync even if already committed */
  resync: z.boolean().optional().default(false),
  /** Sync mode for re-sync operations (default: 'full') */
  syncMode: SyncModeSchema.optional().default('full'),
});

// ============================================================================
// POST - Commit program and create/sync work items
// ============================================================================

/**
 * POST /api/os/programs/[programId]/commit
 * Commit a program and create/sync Work items from deliverables
 *
 * Flow:
 * 1. Validate program is in "ready" status (or allow resync for "committed")
 * 2. Build work plan from program deliverables
 * 3. Materialize work items (create new, update existing, mark removed)
 * 4. Update program status to "committed" with work item IDs
 * 5. Propagate artifacts to work items
 *
 * Idempotent: Running twice with same program state produces same result.
 * Use resync: true to update work items for an already committed program.
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { programId } = await params;

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const parseResult = CommitRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { dryRun, resync, syncMode } = parseResult.data;

    // 1. Get program
    const program = await getPlanningProgram(programId);

    if (!program) {
      return NextResponse.json(
        { error: 'Program not found' },
        { status: 404 }
      );
    }

    // Check if already committed
    const isCommitted = program.status === 'committed';
    if (isCommitted && !resync) {
      return NextResponse.json({
        success: true,
        alreadyCommitted: true,
        program,
        workItemIds: program.commitment.workItemIds || [],
        workPlanVersion: program.workPlanVersion || 0,
        message: 'Program was already committed. Pass resync: true to re-materialize.',
      });
    }

    // 2. Validate program can be committed (skip for resync of committed programs)
    if (!isCommitted && !canCommitPlanningProgram(program)) {
      // For programs without structure, we still allow commit (will use default items)
      const hasNoStructure = program.scope.deliverables.length === 0 &&
                             program.planDetails.milestones.length === 0;

      if (program.status !== 'ready' && !hasNoStructure) {
        return NextResponse.json(
          {
            error: 'Program cannot be committed',
            reason: `Program must be in "ready" status (current: ${program.status})`,
            status: program.status,
            deliverablesCount: program.scope.deliverables.length,
          },
          { status: 400 }
        );
      }
    }

    // 3. Build work plan (for dry run preview)
    if (dryRun) {
      const workPlan = buildProgramWorkPlan(program);
      return NextResponse.json({
        success: true,
        dryRun: true,
        program,
        workPlan,
        summary: {
          totalItems: workPlan.items.length,
          inputHash: workPlan.inputHash,
        },
        message: 'Dry run completed. No work items created.',
      });
    }

    // 4. Materialize work items
    console.log('[commit] Materializing work items for program:', programId, 'mode:', syncMode);
    const result = await materializeWorkFromProgram(programId, { mode: syncMode as SyncMode });

    if (!result.success && result.errors.length > 0) {
      // Partial success - some items may have been created
      console.warn('[commit] Materialization completed with errors:', result.errors);
    }

    console.log('[commit] Materialization complete:', {
      programId,
      workPlanVersion: result.workPlanVersion,
      counts: result.counts,
    });

    // 5. Propagate artifacts after successful materialization
    if (result.workItemIds.length > 0 && program.linkedArtifacts?.length) {
      try {
        // Get the base URL from the request
        const baseUrl = request.nextUrl.origin;
        await fetch(`${baseUrl}/api/os/programs/${programId}/artifacts/propagate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        console.log('[commit] Artifact propagation triggered');
      } catch (err) {
        console.warn('[commit] Artifact propagation failed (non-blocking):', err);
      }
    }

    // 6. Fetch updated program
    const updatedProgram = await getPlanningProgram(programId);

    return NextResponse.json({
      success: result.success,
      program: updatedProgram || program,
      workItemIds: result.workItemIds,
      workPlanVersion: result.workPlanVersion,
      syncMode: result.syncMode,
      counts: result.counts,
      errors: result.errors.length > 0 ? result.errors : undefined,
      message: resync
        ? `Work re-synced (${syncMode}). Created: ${result.counts.created}, Updated: ${result.counts.updated}, Unchanged: ${result.counts.unchanged}, Removed: ${result.counts.removed}, Skipped: ${result.counts.skipped}`
        : `Program committed. Created ${result.counts.created} work items.`,
    });
  } catch (error) {
    console.error('[API] Failed to commit program:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to commit program' },
      { status: 500 }
    );
  }
}
