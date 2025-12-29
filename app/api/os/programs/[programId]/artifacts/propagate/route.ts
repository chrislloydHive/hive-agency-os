// app/api/os/programs/[programId]/artifacts/propagate/route.ts
// Propagate program artifact links to work item artifact attachments
//
// When a program has linked artifacts and committed work items, this endpoint
// syncs those artifact links to the appropriate work items based on relation type:
// - produces (output): Attach to the last work item (final deliverable)
// - requires (input): Attach to the first work item (setup/start)
// - reference: Attach to the first work item
//
// Idempotent: relies on attachArtifactToWorkItem upsert behavior

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getPlanningProgram } from '@/lib/airtable/planningPrograms';
import {
  getWorkItemsByIds,
  attachArtifactToWorkItem,
  type AttachArtifactResult,
} from '@/lib/airtable/workItems';
import {
  mapProgramLinkToCanonical,
  type ProgramArtifactLink,
} from '@/lib/types/program';
import { createArtifactSnapshot } from '@/lib/types/work';

// ============================================================================
// Types
// ============================================================================

interface RouteParams {
  params: Promise<{ programId: string }>;
}

const PropagateRequestSchema = z.object({
  /** Only propagate specific artifact IDs (optional, defaults to all) */
  artifactIds: z.array(z.string()).optional(),
  /** Dry run mode - don't actually attach, just preview */
  dryRun: z.boolean().optional().default(false),
});

interface PropagationItem {
  artifactId: string;
  artifactTitle: string;
  relation: string;
  targetWorkItemId: string;
  targetWorkItemTitle: string;
}

interface PropagateResponse {
  success: boolean;
  programId: string;
  attempted: number;
  attached: number;
  updated: number;
  unchanged: number;
  errors: Array<{ artifactId: string; error: string }>;
  items?: PropagationItem[];
  dryRun?: boolean;
  error?: string;
}

// ============================================================================
// POST /api/os/programs/[programId]/artifacts/propagate
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<PropagateResponse>> {
  try {
    const { programId } = await params;

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const parseResult = PropagateRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          programId,
          attempted: 0,
          attached: 0,
          updated: 0,
          unchanged: 0,
          errors: [],
          error: 'Invalid request body',
        },
        { status: 400 }
      );
    }

    const { artifactIds, dryRun } = parseResult.data;

    // Get program
    const program = await getPlanningProgram(programId);
    if (!program) {
      return NextResponse.json(
        {
          success: false,
          programId,
          attempted: 0,
          attached: 0,
          updated: 0,
          unchanged: 0,
          errors: [],
          error: 'Program not found',
        },
        { status: 404 }
      );
    }

    // Check program is committed
    if (program.status !== 'committed') {
      return NextResponse.json(
        {
          success: false,
          programId,
          attempted: 0,
          attached: 0,
          updated: 0,
          unchanged: 0,
          errors: [],
          error: `Program must be committed to propagate artifacts (current status: ${program.status})`,
        },
        { status: 400 }
      );
    }

    // Get work items
    const workItemIds = program.commitment.workItemIds || [];
    if (workItemIds.length === 0) {
      return NextResponse.json({
        success: true,
        programId,
        attempted: 0,
        attached: 0,
        updated: 0,
        unchanged: 0,
        errors: [],
        error: 'Program has no work items to attach artifacts to',
      });
    }

    const workItems = await getWorkItemsByIds(workItemIds);
    if (workItems.length === 0) {
      return NextResponse.json({
        success: true,
        programId,
        attempted: 0,
        attached: 0,
        updated: 0,
        unchanged: 0,
        errors: [],
        error: 'No work items found for program',
      });
    }

    // Determine first and last work items
    // Work items come back sorted by status then date, so we use array order
    const firstWorkItem = workItems[0];
    const lastWorkItem = workItems[workItems.length - 1];

    // Filter artifacts to propagate
    let artifactsToPropagate: ProgramArtifactLink[] = program.linkedArtifacts || [];
    if (artifactIds && artifactIds.length > 0) {
      const idSet = new Set(artifactIds);
      artifactsToPropagate = artifactsToPropagate.filter(a => idSet.has(a.artifactId));
    }

    if (artifactsToPropagate.length === 0) {
      return NextResponse.json({
        success: true,
        programId,
        attempted: 0,
        attached: 0,
        updated: 0,
        unchanged: 0,
        errors: [],
      });
    }

    // Track results
    let attached = 0;
    let updated = 0;
    let unchanged = 0;
    const errors: Array<{ artifactId: string; error: string }> = [];
    const items: PropagationItem[] = [];

    // Process each artifact
    for (const artifact of artifactsToPropagate) {
      // Determine target work item based on relation type
      const canonicalRelation = mapProgramLinkToCanonical(artifact.linkType);

      let targetWorkItem;
      switch (canonicalRelation) {
        case 'produces':
          // Output artifacts go to the last work item (final deliverable)
          targetWorkItem = lastWorkItem;
          break;
        case 'requires':
        case 'reference':
        default:
          // Input and reference artifacts go to the first work item
          targetWorkItem = firstWorkItem;
          break;
      }

      items.push({
        artifactId: artifact.artifactId,
        artifactTitle: artifact.artifactTitle,
        relation: canonicalRelation,
        targetWorkItemId: targetWorkItem.id,
        targetWorkItemTitle: targetWorkItem.title,
      });

      if (dryRun) {
        // In dry run mode, count as would-be attached
        attached++;
        continue;
      }

      // Create artifact snapshot for work item
      const workItemArtifact = createArtifactSnapshot(
        artifact.artifactId,
        artifact.artifactType,
        artifact.artifactTitle,
        artifact.artifactStatus,
        canonicalRelation
      );

      try {
        const result: AttachArtifactResult = await attachArtifactToWorkItem(
          targetWorkItem.id,
          workItemArtifact
        );

        switch (result.action) {
          case 'attached':
            attached++;
            break;
          case 'updated':
            updated++;
            break;
          case 'unchanged':
            unchanged++;
            break;
        }
      } catch (err) {
        errors.push({
          artifactId: artifact.artifactId,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    console.log('[Programs/Artifacts/Propagate] Completed:', {
      programId,
      attempted: artifactsToPropagate.length,
      attached,
      updated,
      unchanged,
      errors: errors.length,
      dryRun,
    });

    return NextResponse.json({
      success: true,
      programId,
      attempted: artifactsToPropagate.length,
      attached,
      updated,
      unchanged,
      errors,
      items: dryRun ? items : undefined,
      dryRun: dryRun || undefined,
    });
  } catch (error) {
    console.error('[Programs/Artifacts/Propagate] Error:', error);
    return NextResponse.json(
      {
        success: false,
        programId: '',
        attempted: 0,
        attached: 0,
        updated: 0,
        unchanged: 0,
        errors: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
