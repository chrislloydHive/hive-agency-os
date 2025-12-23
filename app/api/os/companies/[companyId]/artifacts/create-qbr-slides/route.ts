// app/api/os/companies/[companyId]/artifacts/create-qbr-slides/route.ts
// Create QBR Slides artifact in Google Drive
//
// POST - Create a Google Slides presentation for a QBR story and track it as an artifact

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import { createArtifact, linkArtifactToGoogleFile } from '@/lib/airtable/artifacts';
import { createGoogleDriveClient, isGoogleDriveAvailable } from '@/lib/integrations/googleDrive';
import { FEATURE_FLAGS, FEATURE_DISABLED_RESPONSE } from '@/lib/config/featureFlags';
import { listQbrStories, loadQbrStory } from '@/lib/qbr/qbrStore';

type Params = { params: Promise<{ companyId: string }> };

/**
 * Get current quarter label (e.g., "Q1 2025")
 */
function getCurrentQuarter(): string {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3) + 1;
  return `Q${q} ${now.getFullYear()}`;
}

/**
 * POST /api/os/companies/[companyId]/artifacts/create-qbr-slides
 * Create a Google Slides presentation from a QBR story
 *
 * Body:
 * - qbrStoryId?: string (optional, uses latest if not provided)
 * - quarter?: string (optional, for title)
 * - title?: string (optional, defaults to "Q{quarter} Business Review")
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    if (!FEATURE_FLAGS.ARTIFACTS_ENABLED) {
      return NextResponse.json(FEATURE_DISABLED_RESPONSE, { status: 403 });
    }

    const { companyId } = await params;
    const body = await request.json();

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

    // Get QBR story - find the latest or use provided quarter
    const quarter = body.quarter || getCurrentQuarter();
    let qbrStory = null;

    if (body.qbrStoryId) {
      // Load specific story if ID provided
      qbrStory = await loadQbrStory(companyId, body.qbrStoryId);
    } else {
      // Try to load by quarter
      qbrStory = await loadQbrStory(companyId, quarter);
    }

    if (!qbrStory) {
      // Try to find any story for this company
      const stories = await listQbrStories(companyId);
      if (stories.length > 0) {
        qbrStory = await loadQbrStory(companyId, stories[0].quarter);
      }
    }

    if (!qbrStory) {
      return NextResponse.json(
        { error: 'No QBR story found for this company. Generate a QBR first.' },
        { status: 404 }
      );
    }

    // Get company for naming
    const company = await getCompanyById(companyId);
    const companyName = company?.name || 'Unknown Company';

    // Build presentation title
    const storyQuarter = qbrStory.meta.quarter || quarter;
    const presentationTitle = body.title || `${companyName} - ${storyQuarter} Business Review`;

    // Create the artifact record first
    const artifact = await createArtifact({
      companyId,
      title: presentationTitle,
      type: 'qbr_slides',
      source: 'qbr_export',
      sourceQbrStoryId: body.qbrStoryId || `${companyId}-${storyQuarter}`,
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

        // Create the presentation
        const file = await driveClient.createPresentation({
          title: presentationTitle,
          parentFolderId: folder.id,
        });

        // TODO: Populate slides with QBR content
        // This requires using the Slides API to add slides with proper formatting
        // For now, we create an empty presentation that the user can edit

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
          note: 'Presentation created. Content population coming in future update.',
        }, { status: 201 });
      } catch (driveError) {
        console.error('[API Artifacts] Failed to create Google Slides:', driveError);
        return NextResponse.json({
          artifact,
          warning: 'Artifact created but Google Slides creation failed',
          error: driveError instanceof Error ? driveError.message : 'Unknown error',
        }, { status: 201 });
      }
    }

    // Return artifact without Google file (Google not enabled)
    return NextResponse.json({ artifact }, { status: 201 });
  } catch (error) {
    console.error('[API Artifacts] Failed to create QBR slides:', error);
    return NextResponse.json(
      { error: 'Failed to create QBR slides' },
      { status: 500 }
    );
  }
}
