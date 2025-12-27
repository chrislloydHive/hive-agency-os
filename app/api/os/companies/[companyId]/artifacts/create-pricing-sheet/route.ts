// app/api/os/companies/[companyId]/artifacts/create-pricing-sheet/route.ts
// Create a Pricing Sheet artifact in Google Drive
//
// POST - Create a Google Sheet for pricing from Context V4 and track it as an artifact

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
 * POST /api/os/companies/[companyId]/artifacts/create-pricing-sheet
 * Create a Google Sheet for pricing from Context V4
 *
 * Body:
 * - title?: string (optional, defaults to "Pricing - [Company Name]")
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
          error: 'Context is not ready for pricing sheet generation',
          missing: readiness.missing.map(m => m.label),
          completenessPercent: readiness.completenessPercent,
        },
        { status: 400 }
      );
    }

    // Get company for naming
    const company = await getCompanyById(companyId);
    const companyName = company?.name || 'Unknown Company';

    // Create a snapshot for this pricing artifact
    const snapshot = await createContextSnapshot({
      companyId,
      snapshotType: 'manual',
      label: 'Pricing Sheet Snapshot',
      description: 'Snapshot created for Pricing Sheet',
    });

    // Build spreadsheet title
    const spreadsheetTitle = body.title || `Pricing - ${companyName}`;

    // Create the artifact record first
    const artifact = await createArtifact({
      companyId,
      title: spreadsheetTitle,
      type: 'pricing_sheet',
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

    // If Google Drive is enabled, create the actual spreadsheet
    if (FEATURE_FLAGS.ARTIFACTS_GOOGLE_ENABLED) {
      try {
        const driveClient = createGoogleDriveClient(companyId);

        // Get or create company folder
        const folder = await driveClient.getOrCreateCompanyFolder(companyName);

        // Create the spreadsheet (skeleton with default sheet)
        // Note: Google Sheets API creates with a default "Sheet1"
        const file = await driveClient.createSpreadsheet({
          title: spreadsheetTitle,
          parentFolderId: folder.id,
        });

        // Link the artifact to the Google file
        await linkArtifactToGoogleFile(
          artifact.id,
          file.id,
          file.webViewLink,
          'spreadsheet',
          folder.id
        );

        return NextResponse.json({
          artifact: {
            ...artifact,
            googleFileId: file.id,
            googleFileUrl: file.webViewLink,
            googleFileType: 'spreadsheet',
            googleFolderId: folder.id,
          },
          googleFile: file,
          snapshotId: snapshot.snapshotId,
          note: 'Spreadsheet created with default structure. Add tabs for: Summary, Line Items, Assumptions.',
        }, { status: 201 });
      } catch (driveError) {
        console.error('[API Artifacts] Failed to create Pricing Sheet:', driveError);
        return NextResponse.json({
          artifact,
          warning: 'Artifact created but Google Sheet creation failed',
          error: driveError instanceof Error ? driveError.message : 'Unknown error',
        }, { status: 201 });
      }
    }

    // Return artifact without Google file (Google not enabled)
    return NextResponse.json({ artifact, snapshotId: snapshot.snapshotId }, { status: 201 });
  } catch (error) {
    console.error('[API Artifacts] Failed to create pricing sheet:', error);
    return NextResponse.json(
      { error: 'Failed to create pricing sheet' },
      { status: 500 }
    );
  }
}
