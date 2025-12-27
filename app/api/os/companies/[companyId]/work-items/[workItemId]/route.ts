// app/api/os/companies/[companyId]/work-items/[workItemId]/route.ts
// Individual Work Item CRUD operations

import { NextRequest, NextResponse } from 'next/server';
import {
  updateWorkItem,
  deleteWorkItem,
  UpdateWorkItemInput,
} from '@/lib/work/workItems';
import { getWorkItemById } from '@/lib/airtable/workItems';
import { recordWorkItemCompletedForArtifacts } from '@/lib/os/artifacts/usage';

// PATCH /api/os/companies/[companyId]/work-items/[workItemId]
// Update a work item
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string; workItemId: string }> }
) {
  const { workItemId } = await params;

  try {
    const body = await request.json();

    const updates: UpdateWorkItemInput = {};

    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.area !== undefined) updates.area = body.area;
    if (body.priority !== undefined) updates.priority = body.priority;
    if (body.status !== undefined) updates.status = body.status;
    if (body.dueDate !== undefined) updates.dueDate = body.dueDate;

    // Check if this is a transition to completed status
    const isCompletingWork = body.status === 'done';
    let existingWorkItem: Awaited<ReturnType<typeof getWorkItemById>> | null = null;

    if (isCompletingWork) {
      // Get existing work item to check if it has artifacts
      existingWorkItem = await getWorkItemById(workItemId);
    }

    const workItem = await updateWorkItem(workItemId, updates);

    if (!workItem) {
      return NextResponse.json(
        { error: 'Failed to update work item' },
        { status: 500 }
      );
    }

    // Track artifact completion if transitioning to done and work item has artifacts
    if (isCompletingWork && existingWorkItem?.artifacts?.length) {
      const artifactIds = existingWorkItem.artifacts.map((a) => a.artifactId);
      recordWorkItemCompletedForArtifacts(workItemId, artifactIds).catch((err) => {
        console.error('[WorkItems API] Failed to track artifact completion:', err);
      });
    }

    return NextResponse.json({
      success: true,
      workItem,
    });
  } catch (error) {
    console.error('[WorkItems API] Error updating work item:', error);
    return NextResponse.json(
      { error: 'Failed to update work item' },
      { status: 500 }
    );
  }
}

// DELETE /api/os/companies/[companyId]/work-items/[workItemId]
// Delete a work item
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string; workItemId: string }> }
) {
  const { workItemId } = await params;

  try {
    const success = await deleteWorkItem(workItemId);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete work item' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Work item deleted',
    });
  } catch (error) {
    console.error('[WorkItems API] Error deleting work item:', error);
    return NextResponse.json(
      { error: 'Failed to delete work item' },
      { status: 500 }
    );
  }
}
