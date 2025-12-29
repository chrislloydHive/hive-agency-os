// app/api/os/programs/[programId]/commit/route.ts
// Commit a Planning Program to create Work items
//
// This is the final step in the Strategy → Program → Work flow.
// When a program is committed, its deliverables are converted to Work items.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getPlanningProgram,
  commitPlanningProgram,
} from '@/lib/airtable/planningPrograms';
import {
  createWorkItem,
  type CreateWorkItemInput,
} from '@/lib/airtable/workItems';
import {
  buildWorkItemsFromProgram,
  draftsToCreateInputs,
  filterDuplicateDrafts,
  findExistingWorkKeys,
} from '@/lib/os/planning/programToWork';
import { canCommitPlanningProgram } from '@/lib/types/program';

// ============================================================================
// Types
// ============================================================================

type Params = { params: Promise<{ programId: string }> };

// ============================================================================
// Validation Schemas
// ============================================================================

const CommitRequestSchema = z.object({
  /** Optional notes about the commitment */
  notes: z.string().optional(),
  /** Optional user ID who is committing */
  committedBy: z.string().optional(),
  /** Skip creating work items (for testing) */
  dryRun: z.boolean().optional().default(false),
});

// ============================================================================
// POST - Commit program and create work items
// ============================================================================

/**
 * POST /api/os/programs/[programId]/commit
 * Commit a program and create Work items from deliverables
 *
 * Flow:
 * 1. Validate program is in "ready" status
 * 2. Build work item drafts from program deliverables
 * 3. Filter out duplicates (if any work items already exist)
 * 4. Create work items in Airtable
 * 5. Update program status to "committed" with work item IDs
 *
 * Idempotent: If program is already committed, returns existing work items.
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

    const { notes, committedBy, dryRun } = parseResult.data;

    // 1. Get program
    const program = await getPlanningProgram(programId);

    if (!program) {
      return NextResponse.json(
        { error: 'Program not found' },
        { status: 404 }
      );
    }

    // Check if already committed
    if (program.status === 'committed') {
      return NextResponse.json({
        success: true,
        alreadyCommitted: true,
        program,
        workItemIds: program.commitment.workItemIds || [],
        message: 'Program was already committed',
      });
    }

    // 2. Validate program can be committed
    if (!canCommitPlanningProgram(program)) {
      return NextResponse.json(
        {
          error: 'Program cannot be committed',
          reason: program.status !== 'ready'
            ? `Program must be in "ready" status (current: ${program.status})`
            : 'Program has no deliverables',
          status: program.status,
          deliverablesCount: program.scope.deliverables.length,
        },
        { status: 400 }
      );
    }

    // 3. Build work item drafts
    const { workItemDrafts, summary } = buildWorkItemsFromProgram(program);

    console.log('[commit] Built work item drafts:', {
      programId,
      total: summary.totalItems,
      fromDeliverables: summary.fromDeliverables,
      fromMilestones: summary.fromMilestones,
      setupItems: summary.setupItems,
    });

    // 4. Filter duplicates
    const existingKeys = findExistingWorkKeys(program);
    const newDrafts = filterDuplicateDrafts(workItemDrafts, existingKeys);

    console.log('[commit] Filtered duplicates:', {
      original: workItemDrafts.length,
      new: newDrafts.length,
      filtered: workItemDrafts.length - newDrafts.length,
    });

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        program,
        workItemDrafts: newDrafts,
        summary: {
          ...summary,
          newItems: newDrafts.length,
          existingItems: workItemDrafts.length - newDrafts.length,
        },
        message: 'Dry run completed. No work items created.',
      });
    }

    // 5. Create work items
    const createInputs = draftsToCreateInputs(newDrafts, program.companyId);
    const createdWorkItemIds: string[] = [];
    const errors: Array<{ title: string; error: string }> = [];

    for (const input of createInputs) {
      try {
        const workItem = await createWorkItem(input);
        if (workItem) {
          createdWorkItemIds.push(workItem.id);
        } else {
          errors.push({
            title: input.title,
            error: 'Failed to create work item',
          });
        }
      } catch (err) {
        errors.push({
          title: input.title,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    console.log('[commit] Created work items:', {
      programId,
      created: createdWorkItemIds.length,
      errors: errors.length,
    });

    // Include any previously created work item IDs
    const allWorkItemIds = [
      ...(program.commitment.workItemIds || []),
      ...createdWorkItemIds,
    ];

    // 6. Update program to committed status
    const committedProgram = await commitPlanningProgram(
      programId,
      allWorkItemIds,
      committedBy,
      notes
    );

    if (!committedProgram) {
      return NextResponse.json(
        {
          error: 'Failed to update program status',
          workItemsCreated: createdWorkItemIds.length,
          workItemIds: createdWorkItemIds,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      program: committedProgram,
      workItemIds: allWorkItemIds,
      summary: {
        totalDeliverables: summary.fromDeliverables,
        totalMilestones: summary.fromMilestones,
        totalSetupItems: summary.setupItems,
        workItemsCreated: createdWorkItemIds.length,
        workItemsExisting: program.commitment.workItemIds?.length || 0,
        errors: errors.length,
      },
      errors: errors.length > 0 ? errors : undefined,
      message: `Program committed. Created ${createdWorkItemIds.length} work items.`,
    });
  } catch (error) {
    console.error('[API] Failed to commit program:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to commit program' },
      { status: 500 }
    );
  }
}
