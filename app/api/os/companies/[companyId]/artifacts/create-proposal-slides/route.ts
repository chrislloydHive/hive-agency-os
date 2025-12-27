// app/api/os/companies/[companyId]/artifacts/create-proposal-slides/route.ts
// Create a Proposal Slides artifact in Google Drive
//
// POST - Create a Google Slides presentation from Context V4 and track it as an artifact

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import { createArtifact, linkArtifactToGoogleFile } from '@/lib/airtable/artifacts';
import { createGoogleDriveClient, isGoogleDriveAvailable } from '@/lib/integrations/googleDrive';
import { FEATURE_FLAGS, FEATURE_DISABLED_RESPONSE } from '@/lib/config/featureFlags';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { isStrategyReady } from '@/lib/contextGraph/readiness/strategyReady';
import { createContextSnapshot } from '@/lib/contextGraph/snapshots';

type Params = { params: Promise<{ companyId: string }> };

/**
 * POST /api/os/companies/[companyId]/artifacts/create-proposal-slides
 * Create a Google Slides presentation for proposals from Context V4
 *
 * Body:
 * - title?: string (optional, defaults to "Proposal - [Company Name]")
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    if (!FEATURE_FLAGS.ARTIFACTS_ENABLED) {
      return NextResponse.json(FEATURE_DISABLED_RESPONSE, { status: 403 });
    }

    const { companyId } = await params;
    const body = await request.json().catch(() => ({}));

    // Check if Google Drive is available
    if (FEATURE_FLAGS.ARTIFACTS_GOOGLE_ENABLED) {
      const driveAvailable = await isGoogleDriveAvailable(companyId);
      if (!driveAvailable) {
        return NextResponse.json(
          { error: 'Google Drive is not connected. Please connect Google first.' },
          { status: 400 }
        );
      }
    }

    // Load context graph and check readiness
    const graph = await loadContextGraph(companyId);
    if (!graph) {
      return NextResponse.json(
        { error: 'No context found for this company' },
        { status: 400 }
      );
    }

    const readiness = isStrategyReady(graph);
    if (!readiness.ready) {
      return NextResponse.json(
        {
          error: 'Context is not ready for proposal generation',
          missing: readiness.missing.map(m => m.label),
          completenessPercent: readiness.completenessPercent,
        },
        { status: 400 }
      );
    }

    // Get company for naming
    const company = await getCompanyById(companyId);
    const companyName = company?.name || 'Unknown Company';

    // Create a snapshot for this proposal artifact
    const snapshot = await createContextSnapshot({
      companyId,
      snapshotType: 'manual',
      label: 'Proposal Slides Snapshot',
      description: 'Snapshot created for Proposal Slides',
    });

    // Build presentation title
    const presentationTitle = body.title || `Proposal - ${companyName}`;

    // Create the artifact record first
    const artifact = await createArtifact({
      companyId,
      title: presentationTitle,
      type: 'proposal_slides',
      source: 'rfp_export',
      snapshotId: snapshot.snapshotId,
      lastSyncedAt: new Date().toISOString(),
    });

    if (!artifact) {
      return NextResponse.json(
        { error: 'Failed to create artifact record' },
        { status: 500 }
      );
    }

    // If Google Drive is enabled, create the actual presentation
    if (FEATURE_FLAGS.ARTIFACTS_GOOGLE_ENABLED) {
      try {
        const driveClient = createGoogleDriveClient(companyId);

        // Get or create company folder
        const folder = await driveClient.getOrCreateCompanyFolder(companyName);

        // Create the presentation (skeleton deck)
        // Note: Google Slides API creates with a blank title slide by default
        const file = await driveClient.createPresentation({
          title: presentationTitle,
          parentFolderId: folder.id,
        });

        // Link the artifact to the Google file
        await linkArtifactToGoogleFile(
          artifact.id,
          file.id,
          file.webViewLink,
          'presentation',
          folder.id
        );

        return NextResponse.json({
          artifact: {
            ...artifact,
            googleFileId: file.id,
            googleFileUrl: file.webViewLink,
            googleFileType: 'presentation',
            googleFolderId: folder.id,
          },
          googleFile: file,
          snapshotId: snapshot.snapshotId,
          note: 'Presentation created with default structure. Add slides for: Title, Agenda, Approach, Timeline, Next Steps.',
        }, { status: 201 });
      } catch (driveError) {
        console.error('[API Artifacts] Failed to create Proposal Slides:', driveError);
        return NextResponse.json({
          artifact,
          warning: 'Artifact created but Google Slides creation failed',
          error: driveError instanceof Error ? driveError.message : 'Unknown error',
        }, { status: 201 });
      }
    }

    // Return artifact without Google file (Google not enabled)
    return NextResponse.json({ artifact, snapshotId: snapshot.snapshotId }, { status: 201 });
  } catch (error) {
    console.error('[API Artifacts] Failed to create proposal slides:', error);
    return NextResponse.json(
      { error: 'Failed to create proposal slides' },
      { status: 500 }
    );
  }
}
