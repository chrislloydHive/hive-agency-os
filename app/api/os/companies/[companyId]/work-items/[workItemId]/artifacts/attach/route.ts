// app/api/os/companies/[companyId]/work-items/[workItemId]/artifacts/attach/route.ts
// Attach an artifact to a work item
//
// POST - Attach artifact (creates snapshot reference)

import { NextRequest, NextResponse } from 'next/server';
import { getWorkItemById, attachArtifactToWorkItem } from '@/lib/airtable/workItems';
import { getArtifactById } from '@/lib/airtable/artifacts';
import { FEATURE_FLAGS, FEATURE_DISABLED_RESPONSE } from '@/lib/config/featureFlags';
import { createArtifactSnapshot } from '@/lib/types/work';
import { recordArtifactAttached } from '@/lib/os/artifacts/usage';

type Params = { params: Promise<{ companyId: string; workItemId: string }> };

/**
 * POST /api/os/companies/[companyId]/work-items/[workItemId]/artifacts/attach
 * Attach an artifact to a work item
 *
 * Body:
 * - artifactId: string (required) - ID of artifact to attach
 * - userId?: string - Who is attaching
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    if (!FEATURE_FLAGS.ARTIFACTS_ENABLED) {
      return NextResponse.json(FEATURE_DISABLED_RESPONSE, { status: 403 });
    }

    const { companyId, workItemId } = await params;
    const body = await request.json();

    const { artifactId, userId } = body;

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

    // Verify artifact exists and belongs to this company
    const artifact = await getArtifactById(artifactId);
    if (!artifact) {
      return NextResponse.json(
        { error: 'Artifact not found' },
        { status: 404 }
      );
    }

    if (artifact.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Artifact not found' },
        { status: 404 }
      );
    }

    // Create artifact snapshot
    const artifactSnapshot = createArtifactSnapshot(
      artifact.id,
      artifact.type,
      artifact.title,
      artifact.status,
      userId
    );

    // Attach artifact to work item
    const updatedWorkItem = await attachArtifactToWorkItem(workItemId, artifactSnapshot);

    // Track usage (fire-and-forget, don't block response)
    recordArtifactAttached(artifactId, workItemId).catch((err) => {
      console.error('[API Work Items] Failed to track artifact usage:', err);
    });

    return NextResponse.json({
      workItem: updatedWorkItem,
      attached: artifactSnapshot,
    });
  } catch (error) {
    console.error('[API Work Items] Failed to attach artifact:', error);
    return NextResponse.json(
      { error: 'Failed to attach artifact' },
      { status: 500 }
    );
  }
}
