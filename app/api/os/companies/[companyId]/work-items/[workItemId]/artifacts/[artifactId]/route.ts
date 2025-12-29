// app/api/os/companies/[companyId]/work-items/[workItemId]/artifacts/[artifactId]/route.ts
// Remove an artifact from a work item
//
// DELETE - Detach artifact (idempotent)

import { NextRequest, NextResponse } from 'next/server';
import { getWorkItemById, detachArtifactFromWorkItem } from '@/lib/airtable/workItems';
import { FEATURE_FLAGS, FEATURE_DISABLED_RESPONSE } from '@/lib/config/featureFlags';
import { recordArtifactDetached } from '@/lib/os/artifacts/usage';

type Params = { params: Promise<{ companyId: string; workItemId: string; artifactId: string }> };

// ============================================================================
// Response Types
// ============================================================================

interface DetachArtifactResponse {
  success: boolean;
  workItemId: string;
  artifactId: string;
  removed: boolean; // true if artifact was actually removed, false if not found
  error?: string;
}

/**
 * DELETE /api/os/companies/[companyId]/work-items/[workItemId]/artifacts/[artifactId]
 * Detach an artifact from a work item (idempotent)
 */
export async function DELETE(
  _request: NextRequest,
  { params }: Params
): Promise<NextResponse<DetachArtifactResponse>> {
  try {
    if (!FEATURE_FLAGS.ARTIFACTS_ENABLED) {
      return NextResponse.json(
        {
          success: false,
          workItemId: '',
          artifactId: '',
          removed: false,
          error: FEATURE_DISABLED_RESPONSE.error,
        },
        { status: 403 }
      );
    }

    const { companyId, workItemId, artifactId } = await params;

    // Verify work item exists and belongs to this company
    const workItem = await getWorkItemById(workItemId);
    if (!workItem) {
      return NextResponse.json(
        {
          success: false,
          workItemId,
          artifactId,
          removed: false,
          error: 'Work item not found',
        },
        { status: 404 }
      );
    }

    if (workItem.companyId !== companyId) {
      return NextResponse.json(
        {
          success: false,
          workItemId,
          artifactId,
          removed: false,
          error: 'Work item not found',
        },
        { status: 404 }
      );
    }

    // Check if artifact is actually attached
    const wasAttached = (workItem.artifacts || []).some(
      (a) => a.artifactId === artifactId
    );

    if (!wasAttached) {
      // Idempotent - already not attached, return success
      return NextResponse.json({
        success: true,
        workItemId,
        artifactId,
        removed: false,
      });
    }

    // Detach artifact from work item
    await detachArtifactFromWorkItem(workItemId, artifactId);

    // Track usage (fire-and-forget, don't block response)
    recordArtifactDetached(artifactId).catch((err) => {
      console.error('[API Work Items] Failed to track artifact detachment:', err);
    });

    return NextResponse.json({
      success: true,
      workItemId,
      artifactId,
      removed: true,
    });
  } catch (error) {
    console.error('[API Work Items] Failed to detach artifact:', error);
    return NextResponse.json(
      {
        success: false,
        workItemId: '',
        artifactId: '',
        removed: false,
        error: 'Failed to detach artifact',
      },
      { status: 500 }
    );
  }
}
