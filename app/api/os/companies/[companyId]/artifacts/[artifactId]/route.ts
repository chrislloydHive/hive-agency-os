// app/api/os/companies/[companyId]/artifacts/[artifactId]/route.ts
// Single Artifact API - Get, update, delete an artifact
//
// GET    - Get artifact by ID
// PATCH  - Update artifact
// DELETE - Delete artifact

import { NextRequest, NextResponse } from 'next/server';
import {
  getArtifactById,
  updateArtifact,
  deleteArtifact,
} from '@/lib/airtable/artifacts';
import { FEATURE_FLAGS, FEATURE_DISABLED_RESPONSE } from '@/lib/config/featureFlags';
import type { UpdateArtifactInput } from '@/lib/types/artifact';

type Params = { params: Promise<{ companyId: string; artifactId: string }> };

/**
 * GET /api/os/companies/[companyId]/artifacts/[artifactId]
 * Get a single artifact by ID
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    if (!FEATURE_FLAGS.ARTIFACTS_ENABLED) {
      return NextResponse.json(FEATURE_DISABLED_RESPONSE, { status: 403 });
    }

    const { companyId, artifactId } = await params;

    const artifact = await getArtifactById(artifactId);

    if (!artifact) {
      return NextResponse.json(
        { error: 'Artifact not found' },
        { status: 404 }
      );
    }

    // Verify artifact belongs to this company
    if (artifact.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Artifact not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ artifact });
  } catch (error) {
    console.error('[API Artifacts] Failed to get artifact:', error);
    return NextResponse.json(
      { error: 'Failed to get artifact' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/os/companies/[companyId]/artifacts/[artifactId]
 * Update an artifact
 *
 * Body:
 * - title?: string
 * - status?: ArtifactStatus
 * - description?: string
 * - tags?: string[]
 * - googleFileId?: string
 * - googleFileUrl?: string
 * - googleFileType?: GoogleFileType
 * - googleFolderId?: string
 * - googleModifiedAt?: string
 * - isStale?: boolean
 * - stalenessReason?: string | null
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    if (!FEATURE_FLAGS.ARTIFACTS_ENABLED) {
      return NextResponse.json(FEATURE_DISABLED_RESPONSE, { status: 403 });
    }

    const { companyId, artifactId } = await params;
    const body = await request.json();

    // Verify artifact exists and belongs to this company
    const existing = await getArtifactById(artifactId);
    if (!existing || existing.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Artifact not found' },
        { status: 404 }
      );
    }

    const updates: UpdateArtifactInput = {};

    if (body.title !== undefined) updates.title = body.title;
    if (body.status !== undefined) updates.status = body.status;
    if (body.description !== undefined) updates.description = body.description;
    if (body.tags !== undefined) updates.tags = body.tags;
    if (body.googleFileId !== undefined) updates.googleFileId = body.googleFileId;
    if (body.googleFileUrl !== undefined) updates.googleFileUrl = body.googleFileUrl;
    if (body.googleFileType !== undefined) updates.googleFileType = body.googleFileType;
    if (body.googleFolderId !== undefined) updates.googleFolderId = body.googleFolderId;
    if (body.googleModifiedAt !== undefined) updates.googleModifiedAt = body.googleModifiedAt;
    if (body.isStale !== undefined) updates.isStale = body.isStale;
    if (body.stalenessReason !== undefined) updates.stalenessReason = body.stalenessReason;
    if (body.stalenessCheckedAt !== undefined) updates.stalenessCheckedAt = body.stalenessCheckedAt;

    const artifact = await updateArtifact(artifactId, updates);

    if (!artifact) {
      return NextResponse.json(
        { error: 'Failed to update artifact' },
        { status: 500 }
      );
    }

    return NextResponse.json({ artifact });
  } catch (error) {
    console.error('[API Artifacts] Failed to update artifact:', error);
    return NextResponse.json(
      { error: 'Failed to update artifact' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/os/companies/[companyId]/artifacts/[artifactId]
 * Delete an artifact
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    if (!FEATURE_FLAGS.ARTIFACTS_ENABLED) {
      return NextResponse.json(FEATURE_DISABLED_RESPONSE, { status: 403 });
    }

    const { companyId, artifactId } = await params;

    // Verify artifact exists and belongs to this company
    const existing = await getArtifactById(artifactId);
    if (!existing || existing.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Artifact not found' },
        { status: 404 }
      );
    }

    const success = await deleteArtifact(artifactId);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete artifact' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API Artifacts] Failed to delete artifact:', error);
    return NextResponse.json(
      { error: 'Failed to delete artifact' },
      { status: 500 }
    );
  }
}
