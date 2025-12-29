// app/api/os/companies/[companyId]/work-items/[workItemId]/artifacts/route.ts
// Get artifacts attached to a work item
//
// GET - List attached artifacts grouped by relation

import { NextRequest, NextResponse } from 'next/server';
import { getWorkItemById } from '@/lib/airtable/workItems';
import { FEATURE_FLAGS, FEATURE_DISABLED_RESPONSE } from '@/lib/config/featureFlags';
import type { WorkItemArtifact } from '@/lib/types/work';

type Params = { params: Promise<{ companyId: string; workItemId: string }> };

// ============================================================================
// Response Types
// ============================================================================

interface ArtifactsByRelation {
  produces: WorkItemArtifact[];
  requires: WorkItemArtifact[];
  reference: WorkItemArtifact[];
}

interface GetWorkItemArtifactsResponse {
  success: boolean;
  workItemId: string;
  artifacts: WorkItemArtifact[];
  byRelation: ArtifactsByRelation;
  total: number;
  error?: string;
}

/**
 * GET /api/os/companies/[companyId]/work-items/[workItemId]/artifacts
 * List all artifacts attached to a work item, grouped by relation
 */
export async function GET(
  _request: NextRequest,
  { params }: Params
): Promise<NextResponse<GetWorkItemArtifactsResponse>> {
  try {
    if (!FEATURE_FLAGS.ARTIFACTS_ENABLED) {
      return NextResponse.json(
        {
          success: false,
          workItemId: '',
          artifacts: [],
          byRelation: { produces: [], requires: [], reference: [] },
          total: 0,
          error: FEATURE_DISABLED_RESPONSE.error,
        },
        { status: 403 }
      );
    }

    const { companyId, workItemId } = await params;

    // Verify work item exists and belongs to this company
    const workItem = await getWorkItemById(workItemId);
    if (!workItem) {
      return NextResponse.json(
        {
          success: false,
          workItemId,
          artifacts: [],
          byRelation: { produces: [], requires: [], reference: [] },
          total: 0,
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
          artifacts: [],
          byRelation: { produces: [], requires: [], reference: [] },
          total: 0,
          error: 'Work item not found',
        },
        { status: 404 }
      );
    }

    // Get attached artifacts (with backward compatibility for missing relation)
    const artifacts = (workItem.artifacts || []).map((a) => ({
      ...a,
      relation: a.relation || 'produces', // Default for legacy data
    }));

    // Group by relation
    const byRelation: ArtifactsByRelation = {
      produces: artifacts.filter((a) => a.relation === 'produces'),
      requires: artifacts.filter((a) => a.relation === 'requires'),
      reference: artifacts.filter((a) => a.relation === 'reference'),
    };

    return NextResponse.json({
      success: true,
      workItemId,
      artifacts,
      byRelation,
      total: artifacts.length,
    });
  } catch (error) {
    console.error('[API Work Items] Failed to get artifacts:', error);
    return NextResponse.json(
      {
        success: false,
        workItemId: '',
        artifacts: [],
        byRelation: { produces: [], requires: [], reference: [] },
        total: 0,
        error: 'Failed to get artifacts',
      },
      { status: 500 }
    );
  }
}
