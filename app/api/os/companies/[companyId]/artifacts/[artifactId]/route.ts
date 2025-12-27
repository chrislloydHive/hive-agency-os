// app/api/os/companies/[companyId]/artifacts/[artifactId]/route.ts
// Single Artifact API - Get, update, delete an artifact
//
// GET    - Get artifact by ID
// PATCH  - Update artifact (with lifecycle validation)
// DELETE - Delete artifact

import { NextRequest, NextResponse } from 'next/server';
import {
  getArtifactById,
  updateArtifact,
  finalizeArtifact,
  archiveArtifact,
  deleteArtifact,
} from '@/lib/airtable/artifacts';
import { FEATURE_FLAGS, FEATURE_DISABLED_RESPONSE } from '@/lib/config/featureFlags';
import { validateArtifactUpdate } from '@/lib/os/artifacts/lifecycle';
import { recordArtifactViewed } from '@/lib/os/artifacts/usage';
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

    // Track view (fire-and-forget, don't block response)
    recordArtifactViewed(artifactId).catch((err) => {
      console.error('[API Artifacts] Failed to track artifact view:', err);
    });

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
 * Update an artifact with lifecycle validation
 *
 * Body:
 * - title?: string
 * - status?: ArtifactStatus (validated: draft→final, draft→archived, final→archived)
 * - description?: string
 * - tags?: string[]
 * - archivedReason?: string (when archiving)
 * - googleFileId?: string
 * - googleFileUrl?: string
 * - googleFileType?: GoogleFileType
 * - googleFolderId?: string
 * - googleModifiedAt?: string
 * - isStale?: boolean
 * - stalenessReason?: string | null
 * - generatedContent?: unknown (draft only)
 * - generatedMarkdown?: string (draft only)
 * - generatedFormat?: string (draft only)
 * - userId?: string (for tracking who made the change)
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

    // Build updates object
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
    if (body.generatedContent !== undefined) updates.generatedContent = body.generatedContent;
    if (body.generatedMarkdown !== undefined) updates.generatedMarkdown = body.generatedMarkdown;
    if (body.generatedFormat !== undefined) updates.generatedFormat = body.generatedFormat;
    if (body.archivedReason !== undefined) updates.archivedReason = body.archivedReason;
    if (body.userId !== undefined) updates.updatedBy = body.userId;

    // Validate the update against lifecycle rules
    const validation = validateArtifactUpdate(existing, updates);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.errors.join('; ') },
        { status: 400 }
      );
    }

    // Handle status transitions with appropriate functions
    let artifact;
    if (updates.status === 'final' && existing.status === 'draft') {
      // Use finalizeArtifact to set timestamps
      artifact = await finalizeArtifact(artifactId, body.userId);
      // Apply any other updates
      if (Object.keys(updates).length > 1) {
        const otherUpdates = { ...updates };
        delete otherUpdates.status;
        if (Object.keys(otherUpdates).length > 0) {
          artifact = await updateArtifact(artifactId, otherUpdates);
        }
      }
    } else if (updates.status === 'archived' && existing.status !== 'archived') {
      // Use archiveArtifact to set timestamps
      artifact = await archiveArtifact(artifactId, body.archivedReason, body.userId);
    } else {
      // Standard update
      artifact = await updateArtifact(artifactId, updates);
    }

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
