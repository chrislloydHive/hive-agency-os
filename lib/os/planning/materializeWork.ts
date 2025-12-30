/**
 * lib/os/planning/materializeWork.ts
 *
 * Full-sync materialization from Program to Work Items.
 * Supports create, update, and mark-removed operations.
 */

import { buildProgramWorkPlan, type WorkPlanItem } from './programToWork';
import { getPlanningProgram, updatePlanningProgram } from '@/lib/airtable/planningPrograms';
import {
  createWorkItem,
  getWorkItemsByProgramId,
  updateWorkItem,
  type CreateWorkItemInput,
  type WorkItemRecord,
} from '@/lib/airtable/workItems';
import { getCompanyByCanonicalId } from '@/lib/airtable/companies';
import type { PlanningProgram } from '@/lib/types/program';
import type { WorkSource, StrategyLink } from '@/lib/types/work';

// ============================================================================
// Helper: Resolve Airtable Record ID for Company
// ============================================================================

/**
 * Resolve the Airtable record ID for a company.
 *
 * If companyId looks like an Airtable rec ID (starts with "rec"), return as-is.
 * Otherwise, look up the company by canonical ID and return its Airtable record ID.
 */
async function resolveCompanyRecordId(companyId: string): Promise<string | null> {
  // If it already looks like an Airtable record ID, return it
  if (companyId.startsWith('rec')) {
    return companyId;
  }

  // Look up the company by canonical ID
  console.log('[Materialize] Looking up company by canonical ID:', companyId);
  const company = await getCompanyByCanonicalId(companyId);

  if (!company) {
    console.error('[Materialize] Company not found by canonical ID:', companyId);
    return null;
  }

  console.log('[Materialize] Resolved company canonical ID to Airtable ID:', {
    canonicalId: companyId,
    airtableId: company.id,
    companyName: company.name,
  });

  return company.id; // This is the Airtable record ID
}

// ============================================================================
// Types
// ============================================================================

/**
 * Sync mode for work materialization:
 * - 'additive': Only creates new work items, never updates or removes existing
 * - 'update': Creates new + updates existing, but never removes
 * - 'full': Full sync - creates, updates, and marks removed items (default)
 */
export type SyncMode = 'additive' | 'update' | 'full';

export interface MaterializationOptions {
  mode?: SyncMode;
}

export interface MaterializationResult {
  success: boolean;
  programId: string;
  workPlanVersion: number;
  syncMode: SyncMode;
  counts: {
    created: number;
    updated: number;
    unchanged: number;
    removed: number;
    skipped: number;
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
 * Sync modes:
 * - 'additive': Only creates new work items (safe for preserving edits)
 * - 'update': Creates new + updates existing (preserves work item data)
 * - 'full': Full sync - creates, updates, and marks removed (default)
 *
 * The operation is idempotent: running twice with same program
 * state and mode produces the same result.
 */
export async function materializeWorkFromProgram(
  programId: string,
  options: MaterializationOptions = {}
): Promise<MaterializationResult> {
  const mode = options.mode || 'full';
  console.log('[Materialize] Starting materialization:', { programId, mode });

  // 1. Fetch program
  const program = await getPlanningProgram(programId);
  if (!program) {
    console.error('[Materialize] Program not found:', programId);
    return {
      success: false,
      programId,
      workPlanVersion: 0,
      syncMode: mode,
      counts: { created: 0, updated: 0, unchanged: 0, removed: 0, skipped: 0 },
      workItemIds: [],
      errors: [{ workKey: '', error: 'Program not found' }],
    };
  }

  // 2. Build work plan
  const workPlan = buildProgramWorkPlan(program);
  const workPlanJson = JSON.stringify(workPlan);

  // Resolve company Airtable record ID (handles both rec IDs and canonical IDs)
  const companyRecordId = await resolveCompanyRecordId(program.companyId);
  if (!companyRecordId) {
    console.error('[Materialize] Failed to resolve company ID:', program.companyId);
    return {
      success: false,
      programId,
      workPlanVersion: 0,
      syncMode: mode,
      counts: { created: 0, updated: 0, unchanged: 0, removed: 0, skipped: 0 },
      workItemIds: [],
      errors: [{ workKey: '', error: `Company not found: ${program.companyId}` }],
    };
  }

  // Log deliverable/milestone status for debugging
  const deliverableStatuses = program.scope.deliverables.map(d => ({ title: d.title, status: d.status }));
  const milestoneStatuses = program.planDetails.milestones.map(m => ({ title: m.title, status: m.status }));

  console.log('[Materialize] Built work plan:', {
    programId,
    itemCount: workPlan.items.length,
    inputHash: workPlan.inputHash,
    deliverableCount: program.scope.deliverables.length,
    milestoneCount: program.planDetails.milestones.length,
    deliverableStatuses,
    milestoneStatuses,
    workPlanItems: workPlan.items.map(i => i.workKey),
    companyId: program.companyId,
    companyRecordId,
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
  let skipped = 0;
  const allWorkItemIds: string[] = [];
  const errors: Array<{ workKey: string; error: string }> = [];

  // 5. Process each work plan item
  for (const planItem of workPlan.items) {
    const existing = existingByKey.get(planItem.workKey);

    if (!existing) {
      // Create new work item
      const input: CreateWorkItemInput = {
        title: planItem.title,
        companyId: companyRecordId, // Use resolved Airtable record ID
        notes: planItem.notes,
        area: planItem.area,
        workstreamType: planItem.workstreamType,
        dueDate: planItem.dueDate,
        status: 'Backlog',
        programId: programId,
        programWorkKey: planItem.workKey,
        source: buildWorkSource(program, planItem.workKey, planItem.workstreamType),
        strategyLink: buildStrategyLink(program),
        // Note: serviceCoverageSnapshot omitted - field may not exist in Airtable
      };

      try {
        console.log('[Materialize] Creating work item:', {
          workKey: planItem.workKey,
          title: planItem.title,
          companyId: companyRecordId,
          programId: programId,
        });
        const newItem = await createWorkItem(input);
        if (newItem) {
          allWorkItemIds.push(newItem.id);
          created++;
          console.log('[Materialize] Created work item:', {
            id: newItem.id,
            workKey: planItem.workKey,
          });
        } else {
          const errorMsg = 'Failed to create work item - createWorkItem returned null. Check Airtable has "Program ID" and "Program Work Key" fields.';
          errors.push({ workKey: planItem.workKey, error: errorMsg });
          console.error('[Materialize] createWorkItem returned null for:', planItem.workKey);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        errors.push({ workKey: planItem.workKey, error: errorMessage });
        console.error('[Materialize] Error creating work item:', planItem.workKey, err);
      }
    } else {
      // Existing item found - handle based on sync mode
      if (mode === 'additive') {
        // Additive mode: never update existing items
        skipped++;
        console.log('[Materialize] Skipped existing (additive mode):', planItem.workKey);
      } else {
        // Update or full mode: check if update needed
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
      }

      allWorkItemIds.push(existing.id);
      existingByKey.delete(planItem.workKey); // Mark as processed
    }
  }

  // 6. Handle removed items (items in existing but not in plan)
  // Only in 'full' mode - other modes preserve existing items
  if (mode === 'full') {
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
  } else {
    // In additive/update mode, count orphaned items as skipped
    for (const [workKey] of existingByKey) {
      skipped++;
      console.log('[Materialize] Preserved orphaned item (mode: %s):', mode, workKey);
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
    syncMode: mode,
    counts: { created, updated, unchanged, removed, skipped },
    workItemIds: allWorkItemIds,
    errors,
  };

  console.log('[Materialize] Completed:', { mode, ...result.counts });

  return result;
}
