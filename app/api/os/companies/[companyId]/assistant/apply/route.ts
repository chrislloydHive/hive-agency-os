// app/api/os/companies/[companyId]/assistant/apply/route.ts
// Apply proposed changes from the assistant
//
// POST - Apply changes with a change token

import { NextRequest, NextResponse } from 'next/server';
import { loadContextGraph, saveContextGraph } from '@/lib/contextGraph/storage';
import { setFieldUntypedWithResult, createProvenance } from '@/lib/contextGraph/mutate';
import { isValidFieldPath } from '@/lib/contextGraph/schema';
import { isHumanSource } from '@/lib/contextGraph/sourcePriority';
import { createWorkItem } from '@/lib/work/workItems';
import { getStoredChanges, removeStoredChanges } from '@/lib/assistant/changeStore';
import type { ApplyRequest, ApplyResult, ProposedChanges } from '@/lib/assistant/types';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

/**
 * POST /api/os/companies/[companyId]/assistant/apply
 * Apply proposed changes from the assistant
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { companyId } = await params;
    const body = await request.json() as ApplyRequest;
    const { changeToken, selectedUpdates, selectedWorkItems, selectedActions } = body;

    if (!changeToken) {
      return NextResponse.json(
        { error: 'Change token is required' },
        { status: 400 }
      );
    }

    console.log(`[AssistantApply] Applying changes for ${companyId} with token ${changeToken}`);

    // Retrieve stored changes
    const proposedChanges = getStoredChanges(changeToken, companyId);
    if (!proposedChanges) {
      return NextResponse.json(
        { error: 'Change token not found or expired' },
        { status: 404 }
      );
    }

    const result: ApplyResult = {
      updatedFields: [],
      skippedFields: [],
      createdWorkItems: [],
      triggeredActions: [],
    };

    // Apply context updates
    if (proposedChanges.contextUpdates && proposedChanges.contextUpdates.length > 0) {
      const graph = await loadContextGraph(companyId);
      if (!graph) {
        return NextResponse.json(
          { error: 'Failed to load context graph' },
          { status: 500 }
        );
      }

      // Filter to selected updates if specified
      const updatesToApply = selectedUpdates
        ? proposedChanges.contextUpdates.filter(u => selectedUpdates.includes(u.path))
        : proposedChanges.contextUpdates;

      for (const update of updatesToApply) {
        const { path, newValue, confidence, reason } = update;

        // Validate path
        if (!isValidFieldPath(path)) {
          result.skippedFields.push({ path, reason: 'Invalid field path' });
          console.log(`[AssistantApply] Skipped invalid path: ${path}`);
          continue;
        }

        // Parse path
        const [domain, ...fieldParts] = path.split('.');
        const field = fieldParts.join('.');

        if (!field) {
          result.skippedFields.push({ path, reason: 'Invalid path format' });
          continue;
        }

        // Check if field has human override
        const domainObj = graph[domain as keyof typeof graph] as Record<string, { provenance?: Array<{ source: string }> }>;
        const fieldData = domainObj?.[field];
        const topProvenance = fieldData?.provenance?.[0];

        if (topProvenance && isHumanSource(topProvenance.source)) {
          result.skippedFields.push({
            path,
            reason: `Protected by human override (${topProvenance.source})`,
          });
          console.log(`[AssistantApply] Skipped human override: ${path}`);
          continue;
        }

        // Create provenance for assistant
        const provenance = createProvenance('brain', {
          confidence: confidence || 0.7,
          notes: reason ? `Assistant: ${reason}` : 'Applied by Company Assistant',
        });

        // Apply the update
        const { result: setResult } = setFieldUntypedWithResult(
          graph,
          domain,
          field,
          newValue,
          provenance
        );

        if (setResult.updated) {
          result.updatedFields.push(path);
          console.log(`[AssistantApply] Updated: ${path}`);
        } else {
          result.skippedFields.push({
            path,
            reason: setResult.reason || 'Update blocked by priority rules',
          });
          console.log(`[AssistantApply] Blocked: ${path} - ${setResult.reason}`);
        }
      }

      // Save the graph if any fields were updated
      if (result.updatedFields.length > 0) {
        await saveContextGraph(graph, 'brain');
        console.log(`[AssistantApply] Saved graph with ${result.updatedFields.length} updates`);
      }
    }

    // Create work items
    if (proposedChanges.workItems && proposedChanges.workItems.length > 0) {
      // Filter to selected items if specified
      const itemsToCreate = selectedWorkItems
        ? proposedChanges.workItems.filter((_, i) => selectedWorkItems.includes(i))
        : proposedChanges.workItems;

      for (const item of itemsToCreate) {
        try {
          const workItem = await createWorkItem({
            companyId,
            title: item.title,
            description: item.description,
            area: item.area,
            priority: item.priority,
            sourceType: 'company_assistant',
          });

          if (workItem) {
            result.createdWorkItems.push({ id: workItem.id, title: workItem.title });
            console.log(`[AssistantApply] Created work item: ${workItem.id}`);
          }
        } catch (error) {
          console.error(`[AssistantApply] Failed to create work item:`, error);
        }
      }
    }

    // Trigger actions (labs, GAP, FCB)
    if (proposedChanges.actions && proposedChanges.actions.length > 0) {
      // Filter to selected actions if specified
      const actionsToTrigger = selectedActions
        ? proposedChanges.actions.filter((_, i) => selectedActions.includes(i))
        : proposedChanges.actions;

      for (const action of actionsToTrigger) {
        try {
          let status = 'triggered';

          switch (action.type) {
            case 'run_lab':
              if (action.labId) {
                // Trigger lab refinement (async, don't wait)
                fetch(`${getBaseUrl()}/api/os/companies/${companyId}/labs/refine`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ labId: action.labId }),
                }).catch(e => console.error('[AssistantApply] Lab trigger failed:', e));

                status = 'triggered';
              }
              break;

            case 'run_gap':
              // Trigger GAP orchestrator (async)
              fetch(`${getBaseUrl()}/api/os/companies/${companyId}/gap/full`, {
                method: 'POST',
              }).catch(e => console.error('[AssistantApply] GAP trigger failed:', e));

              status = 'triggered';
              break;

            case 'run_fcb':
              // Trigger FCB (async)
              fetch(`${getBaseUrl()}/api/os/companies/${companyId}/onboarding/run-fcb`, {
                method: 'POST',
              }).catch(e => console.error('[AssistantApply] FCB trigger failed:', e));

              status = 'triggered';
              break;
          }

          result.triggeredActions.push({
            type: action.type + (action.labId ? `_${action.labId}` : ''),
            status,
          });
        } catch (error) {
          console.error(`[AssistantApply] Failed to trigger action:`, error);
          result.triggeredActions.push({
            type: action.type,
            status: 'failed',
          });
        }
      }
    }

    // Clean up the stored changes
    removeStoredChanges(changeToken);

    console.log(`[AssistantApply] Complete for ${companyId}:`, {
      updated: result.updatedFields.length,
      skipped: result.skippedFields.length,
      workItems: result.createdWorkItems.length,
      actions: result.triggeredActions.length,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[AssistantApply] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to apply changes',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Get the base URL for internal API calls
 */
function getBaseUrl(): string {
  // In production, use the actual domain
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  // In development, use localhost
  return process.env.NEXTAUTH_URL || 'http://localhost:3000';
}
