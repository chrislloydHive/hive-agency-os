// app/api/os/companies/[companyId]/artifacts/[artifactId]/convert-to-work/route.ts
// API route for converting artifacts to work items
//
// GET: Preview conversion (dry run) - returns proposedWorkItems + existingCount
// POST: Execute conversion - creates work items with idempotency

import { NextRequest, NextResponse } from 'next/server';
import { getArtifactById, updateArtifact } from '@/lib/airtable/artifacts';
import {
  createWorkItemsFromArtifact,
  getExistingWorkKeysForArtifact,
  type ArtifactWorkItemInput,
} from '@/lib/airtable/workItems';
import {
  convertArtifactToWorkItems,
  validateArtifactForConversion,
  extractWorkKeys,
} from '@/lib/os/artifacts/convert';
import { createDefaultUsage } from '@/lib/types/artifact';

interface RouteParams {
  params: Promise<{
    companyId: string;
    artifactId: string;
  }>;
}

// ============================================================================
// GET: Preview Conversion (Dry Run)
// ============================================================================

export async function GET(
  request: NextRequest,
  context: RouteParams
): Promise<NextResponse> {
  const { companyId, artifactId } = await context.params;

  console.log('[convert-to-work] GET preview:', { companyId, artifactId });

  try {
    // 1. Load and validate artifact
    const artifact = await getArtifactById(artifactId);

    if (!artifact) {
      return NextResponse.json(
        { error: 'Artifact not found' },
        { status: 404 }
      );
    }

    if (artifact.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Artifact does not belong to this company' },
        { status: 403 }
      );
    }

    // 2. Validate artifact can be converted
    const validation = validateArtifactForConversion(artifact);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // 3. Convert to proposed work items
    const conversionResult = await convertArtifactToWorkItems({
      companyId,
      artifact,
    });

    // 4. Check for existing work keys (for idempotency display)
    const existingKeys = await getExistingWorkKeysForArtifact(artifactId);
    const proposedKeys = extractWorkKeys(conversionResult);
    const alreadyExistingCount = proposedKeys.filter(key => existingKeys.has(key)).length;

    return NextResponse.json({
      artifactId: artifact.id,
      artifactType: artifact.type,
      artifactStatus: artifact.status,
      artifactTitle: artifact.title,
      proposedWorkItems: conversionResult.proposedWorkItems.map(item => ({
        title: item.title,
        description: item.description,
        priority: item.priority,
        area: item.area,
        sectionName: item.sectionName,
        workKey: item.source.workKey,
        alreadyExists: existingKeys.has(item.source.workKey),
      })),
      stats: {
        total: conversionResult.stats.total,
        fromSections: conversionResult.stats.fromSections,
        fromAi: conversionResult.stats.fromAi,
        alreadyExisting: alreadyExistingCount,
        willBeCreated: conversionResult.stats.total - alreadyExistingCount,
      },
      warning: validation.warning,
    });
  } catch (error) {
    console.error('[convert-to-work] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Preview failed' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST: Execute Conversion
// ============================================================================

interface ConvertRequestBody {
  /** Allow conversion of draft artifacts (default: false) */
  includeDraft?: boolean;
  /** Optional tactic IDs to filter by */
  selectedTacticIds?: string[];
  /** Attach artifact to created work items (default: true) */
  attachArtifactToCreatedWorkItems?: boolean;
}

export async function POST(
  request: NextRequest,
  context: RouteParams
): Promise<NextResponse> {
  const { companyId, artifactId } = await context.params;

  console.log('[convert-to-work] POST execute:', { companyId, artifactId });

  try {
    // 1. Parse request body
    const body: ConvertRequestBody = await request.json().catch(() => ({}));
    const {
      includeDraft = false,
      selectedTacticIds,
      attachArtifactToCreatedWorkItems = true,
    } = body;

    // 2. Load and validate artifact
    const artifact = await getArtifactById(artifactId);

    if (!artifact) {
      return NextResponse.json(
        { error: 'Artifact not found' },
        { status: 404 }
      );
    }

    if (artifact.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Artifact does not belong to this company' },
        { status: 403 }
      );
    }

    // 3. Validate artifact can be converted
    const validation = validateArtifactForConversion(artifact);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // 4. Check draft status
    if (artifact.status === 'draft' && !includeDraft) {
      return NextResponse.json(
        {
          error: 'Cannot convert draft artifact without confirmation',
          code: 'DRAFT_REQUIRES_CONFIRMATION',
          message: 'This artifact is still a draft. Set includeDraft=true to proceed.',
        },
        { status: 400 }
      );
    }

    // 5. Convert to proposed work items
    const conversionResult = await convertArtifactToWorkItems({
      companyId,
      artifact,
      selectedTacticIds,
    });

    if (conversionResult.proposedWorkItems.length === 0) {
      return NextResponse.json({
        success: true,
        createdCount: 0,
        skippedCount: 0,
        message: 'No work items to create from this artifact',
        workItems: [],
      });
    }

    // 6. Prepare work item inputs
    const workItemInputs: ArtifactWorkItemInput[] = conversionResult.proposedWorkItems.map(item => ({
      title: item.title,
      notes: item.description,
      area: item.area,
      severity: item.severity,
      source: item.source,
    }));

    // 7. Create work items with idempotency
    const createResult = await createWorkItemsFromArtifact({
      companyId,
      items: workItemInputs,
      attachArtifact: attachArtifactToCreatedWorkItems ? {
        artifactId: artifact.id,
        artifactTypeId: artifact.type,
        artifactTitle: artifact.title,
        artifactStatus: artifact.status,
      } : undefined,
    });

    // 8. Update artifact usage stats
    if (createResult.created.length > 0 && attachArtifactToCreatedWorkItems) {
      const currentUsage = artifact.usage ?? createDefaultUsage();
      const now = new Date().toISOString();

      await updateArtifact(artifact.id, {
        usage: {
          ...currentUsage,
          attachedWorkCount: currentUsage.attachedWorkCount + createResult.created.length,
          lastAttachedAt: now,
          firstAttachedAt: currentUsage.firstAttachedAt ?? now,
        },
      }).catch((err: unknown) => {
        console.warn('[convert-to-work] Failed to update usage:', err);
      });
    }

    return NextResponse.json({
      success: true,
      createdCount: createResult.created.length,
      skippedCount: createResult.skippedCount,
      workItems: createResult.created.map(wi => ({
        id: wi.id,
        title: wi.title,
        status: wi.status,
        area: wi.area,
      })),
      artifactId: artifact.id,
      message: createResult.created.length > 0
        ? `Created ${createResult.created.length} work item${createResult.created.length > 1 ? 's' : ''}`
        : 'All work items already exist (skipped)',
    });
  } catch (error) {
    console.error('[convert-to-work] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Conversion failed' },
      { status: 500 }
    );
  }
}
