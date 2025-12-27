// app/api/os/companies/[companyId]/work-items/[workItemId]/artifacts/detach/route.ts
// Detach an artifact from a work item
//
// POST - Detach artifact (removes snapshot reference)

import { NextRequest, NextResponse } from 'next/server';
import { getWorkItemById, detachArtifactFromWorkItem } from '@/lib/airtable/workItems';
import { FEATURE_FLAGS, FEATURE_DISABLED_RESPONSE } from '@/lib/config/featureFlags';
import { recordArtifactDetached } from '@/lib/os/artifacts/usage';

type Params = { params: Promise<{ companyId: string; workItemId: string }> };

/**
 * POST /api/os/companies/[companyId]/work-items/[workItemId]/artifacts/detach
 * Detach an artifact from a work item
 *
 * Body:
 * - artifactId: string (required) - ID of artifact to detach
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    if (!FEATURE_FLAGS.ARTIFACTS_ENABLED) {
      return NextResponse.json(FEATURE_DISABLED_RESPONSE, { status: 403 });
    }

    const { companyId, workItemId } = await params;
    const body = await request.json();

    const { artifactId } = body;

    if (!artifactId) {
      return NextResponse.json(
        { error: 'artifactId is required' },
        { status: 400 }
      );
    }

    // Verify work item exists and belongs to this company
    const workItem = await getWorkItemById(workItemId);
    if (!workItem) {
      return NextResponse.json(
        { error: 'Work item not found' },
        { status: 404 }
      );
    }

    if (workItem.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Work item not found' },
        { status: 404 }
      );
    }

    // Detach artifact from work item
    const updatedWorkItem = await detachArtifactFromWorkItem(workItemId, artifactId);

    // Track usage (fire-and-forget, don't block response)
    recordArtifactDetached(artifactId).catch((err) => {
      console.error('[API Work Items] Failed to track artifact detachment:', err);
    });

    return NextResponse.json({
      workItem: updatedWorkItem,
      detached: artifactId,
    });
  } catch (error) {
    console.error('[API Work Items] Failed to detach artifact:', error);
    return NextResponse.json(
      { error: 'Failed to detach artifact' },
      { status: 500 }
    );
  }
}
