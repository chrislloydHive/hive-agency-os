// app/api/os/companies/[companyId]/work-items/[workItemId]/artifacts/attach/route.ts
// Attach an artifact to a work item
//
// POST - Attach artifact (creates snapshot reference)
// Idempotent: If artifact already attached, updates relation if different

import { NextRequest, NextResponse } from 'next/server';
import { getWorkItemById, attachArtifactToWorkItem } from '@/lib/airtable/workItems';
import { getArtifactById } from '@/lib/airtable/artifacts';
import { FEATURE_FLAGS, FEATURE_DISABLED_RESPONSE } from '@/lib/config/featureFlags';
import { createArtifactSnapshot, type WorkArtifactRelation } from '@/lib/types/work';
import { recordArtifactAttached } from '@/lib/os/artifacts/usage';

type Params = { params: Promise<{ companyId: string; workItemId: string }> };

// ============================================================================
// Validation Helpers
// ============================================================================

const VALID_RELATIONS = ['produces', 'requires', 'reference'] as const;

/**
 * Coerce input to a valid WorkArtifactRelation, defaulting to 'produces'
 */
function coerceRelation(input: unknown): WorkArtifactRelation {
  if (
    typeof input === 'string' &&
    (VALID_RELATIONS as readonly string[]).includes(input)
  ) {
    return input as WorkArtifactRelation;
  }
  return 'produces';
}

// ============================================================================
// API Handler
// ============================================================================

/**
 * POST /api/os/companies/[companyId]/work-items/[workItemId]/artifacts/attach
 * Attach an artifact to a work item
 *
 * Body:
 * - artifactId: string (required) - ID of artifact to attach
 * - relation?: 'produces' | 'requires' | 'reference' (default: 'produces')
 * - userId?: string - Who is attaching
 *
 * Idempotency:
 * - If artifact already attached with same relation: no-op, returns existing
 * - If artifact already attached with different relation: updates relation
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    if (!FEATURE_FLAGS.ARTIFACTS_ENABLED) {
      return NextResponse.json(FEATURE_DISABLED_RESPONSE, { status: 403 });
    }

    const { companyId, workItemId } = await params;
    const body = await request.json();

    // Runtime validation with coercion
    const raw = body as { artifactId?: unknown; relation?: unknown; userId?: unknown };

    const artifactId = typeof raw.artifactId === 'string' ? raw.artifactId.trim() : '';
    if (!artifactId) {
      return NextResponse.json(
        { error: 'artifactId is required' },
        { status: 400 }
      );
    }

    const relation = coerceRelation(raw.relation);
    const userId = typeof raw.userId === 'string' ? raw.userId : undefined;

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

    // Create artifact snapshot with validated relation
    const artifactSnapshot = createArtifactSnapshot(
      artifact.id,
      artifact.type,
      artifact.title,
      artifact.status,
      relation,
      userId
    );

    // Attach artifact to work item (with upsert support)
    const result = await attachArtifactToWorkItem(workItemId, artifactSnapshot);

    // Track usage only for new attachments (not updates or no-ops)
    if (result.action === 'attached') {
      recordArtifactAttached(artifactId, workItemId).catch((err) => {
        console.error('[API Work Items] Failed to track artifact usage:', err);
      });
    }

    return NextResponse.json({
      workItem: result.workItem,
      attached: artifactSnapshot,
      action: result.action,
      previousRelation: result.previousRelation,
    });
  } catch (error) {
    console.error('[API Work Items] Failed to attach artifact:', error);
    return NextResponse.json(
      { error: 'Failed to attach artifact' },
      { status: 500 }
    );
  }
}
