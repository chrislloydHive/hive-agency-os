// app/api/os/companies/[companyId]/programs/apply-draft/route.ts
// Strategy → Programs → Work Handoff: Apply Draft
//
// Applies a program handoff draft to create/update canonical Programs and Work Items.
// Uses stable keys for deduplication to prevent duplicates on re-run.
//
// DEDUPE STRATEGY:
// - Programs: Upsert by programKey (companyId + strategyId + programType)
// - Work Items: Check by workKey in Source JSON, skip if exists
//
// TRACEABILITY:
// - Every Work Item includes WorkSourceStrategyHandoff with full provenance chain

import { NextRequest, NextResponse } from 'next/server';
import { base } from '@/lib/airtable/client';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import {
  getHandoffDraftById,
  deleteHandoffDraft,
} from '@/lib/os/programs/handoffDrafts';
import {
  createWorkItem,
  getWorkItemsForCompany,
  type WorkItemArea,
  type WorkItemSeverity,
} from '@/lib/airtable/workItems';
import type { WorkSourceStrategyHandoff } from '@/lib/types/work';
import type {
  DraftProgram,
  DraftInitiative,
  DraftWorkItem,
  ApplyHandoffResponse,
} from '@/lib/types/programHandoff';

// ============================================================================
// Types
// ============================================================================

interface ApplyDraftRequest {
  draftId: string;
  /** Force apply even if strategy has changed (bypass staleness check) */
  forceApply?: boolean;
}

// ============================================================================
// POST Handler - Apply Draft
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const body = (await request.json()) as ApplyDraftRequest;

    const { draftId, forceApply = false } = body;

    if (!draftId) {
      return NextResponse.json(
        { error: 'Missing draftId' },
        { status: 400 }
      );
    }

    console.log('[apply-draft] Applying draft:', { companyId, draftId, forceApply });

    // 1. Load the draft
    const draft = await getHandoffDraftById(draftId);

    if (!draft) {
      return NextResponse.json(
        { error: 'Draft not found' },
        { status: 404 }
      );
    }

    if (draft.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Draft does not belong to this company' },
        { status: 403 }
      );
    }

    // 2. Get existing work items for dedupe check
    const existingWorkItems = await getWorkItemsForCompany(companyId);
    const existingWorkKeys = new Set<string>();

    // Build set of existing work keys from Source JSON
    for (const item of existingWorkItems) {
      if (item.source?.sourceType === 'strategy_handoff') {
        const handoffSource = item.source as WorkSourceStrategyHandoff;
        if (handoffSource.initiativeKey) {
          // Store the full workKey if we can derive it
          const workKey = `${handoffSource.initiativeKey}:${normalizeForKey(item.title)}`;
          existingWorkKeys.add(workKey);
        }
      }
    }

    // 3. Process programs and create work items
    const programIds: string[] = [];
    const workItemIds: string[] = [];
    let skippedCount = 0;
    const errors: string[] = [];

    const handoffTimestamp = new Date().toISOString();

    for (const program of draft.programs) {
      // For now, we don't create canonical Program records (they have different schema)
      // Just create the work items
      // TODO: Add Program record creation if needed

      for (const initiative of program.initiatives) {
        for (const workItem of initiative.workItems) {
          // Check if work item already exists (dedupe)
          if (existingWorkKeys.has(workItem.workKey)) {
            console.log('[apply-draft] Skipping existing work item:', workItem.workKey);
            skippedCount++;
            continue;
          }

          // Build source with full traceability
          const source: WorkSourceStrategyHandoff = {
            sourceType: 'strategy_handoff',
            strategyId: draft.strategyId,
            strategyTitle: draft.strategyTitle,
            programType: program.programType,
            initiativeTitle: initiative.title,
            initiativeKey: initiative.initiativeKey,
            linkedObjectiveIds: draft.linkedObjectiveIds,
            linkedPriorityIds: draft.linkedPriorityIds,
            linkedTacticIds: program.tacticIds,
            handoffAt: handoffTimestamp,
          };

          // Map category to WorkItemArea
          const area = mapCategoryToArea(workItem.category);

          // Map impact level to severity
          const severity = mapImpactToSeverity(initiative.impactLevel);

          // Build notes with context
          const notes = buildWorkItemNotes(draft, program, initiative, workItem);

          try {
            const created = await createWorkItem({
              title: workItem.title,
              companyId,
              notes,
              area,
              severity,
              status: 'Backlog',
              source,
              aiAdditionalInfo: workItem.description,
            });

            if (created) {
              workItemIds.push(created.id);
              existingWorkKeys.add(workItem.workKey); // Prevent dupes within same batch
              console.log('[apply-draft] Created work item:', {
                id: created.id,
                title: workItem.title,
              });
            } else {
              errors.push(`Failed to create work item: ${workItem.title}`);
            }
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : 'Unknown error';
            errors.push(`Error creating "${workItem.title}": ${errMsg}`);
            console.error('[apply-draft] Work item creation error:', err);
          }
        }
      }
    }

    // 4. Delete the draft after successful apply
    if (workItemIds.length > 0 || skippedCount > 0) {
      await deleteHandoffDraft(draftId);
      console.log('[apply-draft] Deleted draft after apply:', draftId);
    }

    // 5. Return response
    const response: ApplyHandoffResponse = {
      success: errors.length === 0,
      programIds,
      workItemIds,
      skippedCount,
      errors,
    };

    console.log('[apply-draft] Apply complete:', {
      programsCreated: programIds.length,
      workItemsCreated: workItemIds.length,
      skipped: skippedCount,
      errors: errors.length,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error('[apply-draft] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to apply draft' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function normalizeForKey(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 50);
}

function mapCategoryToArea(category: string): WorkItemArea {
  const categoryLower = category.toLowerCase();

  if (categoryLower.includes('brand')) return 'Brand';
  if (categoryLower.includes('content')) return 'Content';
  if (categoryLower.includes('seo')) return 'SEO';
  if (categoryLower.includes('website') || categoryLower.includes('ux')) return 'Website UX';
  if (categoryLower.includes('funnel') || categoryLower.includes('analytics')) return 'Analytics';
  if (categoryLower.includes('demand') || categoryLower.includes('media')) return 'Funnel';
  if (categoryLower.includes('strategy')) return 'Strategy';
  if (categoryLower.includes('ops') || categoryLower.includes('operation')) return 'Operations';

  return 'Other';
}

function mapImpactToSeverity(impactLevel: 'high' | 'medium' | 'low'): WorkItemSeverity {
  switch (impactLevel) {
    case 'high':
      return 'High';
    case 'low':
      return 'Low';
    default:
      return 'Medium';
  }
}

function buildWorkItemNotes(
  draft: { strategyId: string; strategyTitle: string },
  program: DraftProgram,
  initiative: DraftInitiative,
  workItem: DraftWorkItem
): string {
  const lines: string[] = [];

  lines.push(`**From Strategy Handoff**`);
  lines.push(`Strategy: ${draft.strategyTitle}`);
  lines.push(`Program: ${program.title} (${program.programType})`);
  lines.push(`Initiative: ${initiative.title}`);
  lines.push('');
  lines.push(`**Expected Impact:** ${initiative.expectedImpact}`);
  lines.push(`**Sequence:** ${initiative.sequence}`);
  lines.push(`**Effort:** ${workItem.effort}`);

  if (workItem.description) {
    lines.push('');
    lines.push(`**Description:**`);
    lines.push(workItem.description);
  }

  return lines.join('\n');
}
