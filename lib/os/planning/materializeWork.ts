/**
 * lib/os/planning/materializeWork.ts
 *
 * Full-sync materialization from Program to Work Items.
 * Supports create, update, and mark-removed operations.
 */

import { buildProgramWorkPlan, type WorkPlan, type WorkPlanItem } from './programToWork';
import { getPlanningProgram, updatePlanningProgram } from '@/lib/airtable/planningPrograms';
import {
  createWorkItem,
  getWorkItemsByProgramId,
  updateWorkItem,
  type CreateWorkItemInput,
  type WorkItemRecord,
} from '@/lib/airtable/workItems';
import type { PlanningProgram } from '@/lib/types/program';
import type { WorkSource, StrategyLink } from '@/lib/types/work';

// ============================================================================
// Types
// ============================================================================

export interface MaterializationResult {
  success: boolean;
  programId: string;
  workPlanVersion: number;
  counts: {
    created: number;
    updated: number;
    unchanged: number;
    removed: number;
  };
  workItemIds: string[];
  errors: Array<{ workKey: string; error: string }>;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build WorkSource for a work item
 */
function buildWorkSource(program: PlanningProgram, workKey: string, workstreamType: string): WorkSource {
  return {
    sourceType: 'strategy_handoff',
    strategyId: program.strategyId,
    strategyTitle: program.title,
    programId: program.id,
    programType: workstreamType,
    initiativeTitle: program.title,
    workKey: `${program.id}::${workKey}`,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Build StrategyLink from program origin
 */
function buildStrategyLink(program: PlanningProgram): StrategyLink {
  return {
    strategyId: program.origin.strategyId,
    objectiveId: program.origin.objectiveId,
    betId: program.origin.betId,
    tacticId: program.origin.tacticId,
    tacticTitle: program.origin.tacticTitle,
  };
}

/**
 * Check if a work item needs updating based on plan item
 */
function needsUpdate(existing: WorkItemRecord, planItem: WorkPlanItem): boolean {
  // Compare key fields that might have changed
  if (existing.title !== planItem.title) return true;
  if (existing.notes !== planItem.notes) return true;
  if (existing.dueDate !== planItem.dueDate) return true;
  return false;
}

// ============================================================================
// Main Materialization Function
// ============================================================================

/**
 * Materialize work items from a program.
 *
 * This is a full-sync operation:
 * - Creates new work items for new work keys
 * - Updates existing work items if data changed
 * - Marks removed work items (prefixes title with "[Removed]")
 *
 * The operation is idempotent: running twice with same program
 * state produces the same result.
 */
export async function materializeWorkFromProgram(
  programId: string
): Promise<MaterializationResult> {
  console.log('[Materialize] Starting materialization for program:', programId);

  // 1. Fetch program
  const program = await getPlanningProgram(programId);
  if (!program) {
    console.error('[Materialize] Program not found:', programId);
    return {
      success: false,
      programId,
      workPlanVersion: 0,
      counts: { created: 0, updated: 0, unchanged: 0, removed: 0 },
      workItemIds: [],
      errors: [{ workKey: '', error: 'Program not found' }],
    };
  }

  // 2. Build work plan
  const workPlan = buildProgramWorkPlan(program);
  const workPlanJson = JSON.stringify(workPlan);

  console.log('[Materialize] Built work plan:', {
    programId,
    itemCount: workPlan.items.length,
    inputHash: workPlan.inputHash,
  });

  // 3. Fetch existing work items for this program
  const existingItems = await getWorkItemsByProgramId(programId);
  const existingByKey = new Map<string, WorkItemRecord>();
  for (const item of existingItems) {
    if (item.programWorkKey) {
      existingByKey.set(item.programWorkKey, item);
    }
  }

  console.log('[Materialize] Found existing work items:', existingItems.length);

  // 4. Track results
  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let removed = 0;
  const allWorkItemIds: string[] = [];
  const errors: Array<{ workKey: string; error: string }> = [];

  // 5. Process each work plan item
  for (const planItem of workPlan.items) {
    const existing = existingByKey.get(planItem.workKey);

    if (!existing) {
      // Create new work item
      const input: CreateWorkItemInput = {
        title: planItem.title,
        companyId: program.companyId,
        notes: planItem.notes,
        area: planItem.area,
        workstreamType: planItem.workstreamType,
        dueDate: planItem.dueDate,
        status: 'Backlog',
        programId: programId,
        programWorkKey: planItem.workKey,
        source: buildWorkSource(program, planItem.workKey, planItem.workstreamType),
        strategyLink: buildStrategyLink(program),
      };

      try {
        const newItem = await createWorkItem(input);
        if (newItem) {
          allWorkItemIds.push(newItem.id);
          created++;
          console.log('[Materialize] Created work item:', {
            id: newItem.id,
            workKey: planItem.workKey,
          });
        } else {
          errors.push({ workKey: planItem.workKey, error: 'Failed to create work item' });
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        errors.push({ workKey: planItem.workKey, error: errorMessage });
        console.error('[Materialize] Error creating work item:', planItem.workKey, err);
      }
    } else {
      // Check if update needed
      if (needsUpdate(existing, planItem)) {
        try {
          const updatedItem = await updateWorkItem(existing.id, {
            title: planItem.title,
            notes: planItem.notes,
            dueDate: planItem.dueDate,
          });
          if (updatedItem) {
            updated++;
            console.log('[Materialize] Updated work item:', {
              id: existing.id,
              workKey: planItem.workKey,
            });
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          errors.push({ workKey: planItem.workKey, error: errorMessage });
          console.error('[Materialize] Error updating work item:', planItem.workKey, err);
        }
      } else {
        unchanged++;
      }

      allWorkItemIds.push(existing.id);
      existingByKey.delete(planItem.workKey); // Mark as processed
    }
  }

  // 6. Handle removed items (items in existing but not in plan)
  for (const [workKey, item] of existingByKey) {
    // Skip items that are already marked as removed
    if (item.title.startsWith('[Removed]')) {
      continue;
    }

    try {
      await updateWorkItem(item.id, {
        title: `[Removed] ${item.title}`,
      });
      removed++;
      console.log('[Materialize] Marked work item as removed:', {
        id: item.id,
        workKey,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      errors.push({ workKey, error: `Failed to mark as removed: ${errorMessage}` });
      console.error('[Materialize] Error marking work item as removed:', workKey, err);
    }
  }

  // 7. Update program with work plan and version
  const newVersion = (program.workPlanVersion || 0) + 1;

  try {
    await updatePlanningProgram(programId, {
      workPlanJson,
      workPlanVersion: newVersion,
      commitment: {
        ...program.commitment,
        workItemIds: allWorkItemIds,
        committedAt: new Date().toISOString(),
      },
      status: 'committed',
    });

    console.log('[Materialize] Updated program:', {
      programId,
      workPlanVersion: newVersion,
      workItemCount: allWorkItemIds.length,
    });
  } catch (err) {
    console.error('[Materialize] Error updating program:', err);
    errors.push({ workKey: '', error: 'Failed to update program status' });
  }

  const result: MaterializationResult = {
    success: errors.length === 0,
    programId,
    workPlanVersion: newVersion,
    counts: { created, updated, unchanged, removed },
    workItemIds: allWorkItemIds,
    errors,
  };

  console.log('[Materialize] Completed:', result.counts);

  return result;
}
