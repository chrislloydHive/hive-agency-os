// app/api/os/companies/[companyId]/artifacts/create-brief-doc/route.ts
// Create Brief Document artifact in Google Drive
//
// POST - Create a Google Doc from a brief and track it as an artifact

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import { getBriefById } from '@/lib/airtable/briefs';
import { createArtifact, linkArtifactToGoogleFile } from '@/lib/airtable/artifacts';
import { createGoogleDriveClient, isGoogleDriveAvailable } from '@/lib/integrations/googleDrive';
import type { DocumentContent, DocumentSection } from '@/lib/integrations/googleDrive';
import { FEATURE_FLAGS, FEATURE_DISABLED_RESPONSE } from '@/lib/config/featureFlags';
import type { Brief } from '@/lib/types/brief';

type Params = { params: Promise<{ companyId: string }> };

/**
 * POST /api/os/companies/[companyId]/artifacts/create-brief-doc
 * Create a Google Doc from a brief
 *
 * Body:
 * - briefId: string (required)
 * - title?: string (optional, defaults to brief title)
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    if (!FEATURE_FLAGS.ARTIFACTS_ENABLED) {
      return NextResponse.json(FEATURE_DISABLED_RESPONSE, { status: 403 });
    }

    const { companyId } = await params;
    const body = await request.json();

    if (!body.briefId) {
      return NextResponse.json(
        { error: 'Missing required field: briefId' },
        { status: 400 }
      );
    }

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

    // Get the brief
    const brief = await getBriefById(body.briefId);
    if (!brief) {
      return NextResponse.json(
        { error: 'Brief not found' },
        { status: 404 }
      );
    }

    if (brief.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Brief not found' },
        { status: 404 }
      );
    }

    // Get company for folder naming
    const company = await getCompanyById(companyId);
    const companyName = company?.name || 'Unknown Company';

    // Build document content from brief
    const documentTitle = body.title || `${brief.title} - Brief`;
    const content = buildBriefDocumentContent(brief);

    // Create the artifact record first
    const artifact = await createArtifact({
      companyId,
      title: documentTitle,
      type: 'brief_doc',
      source: 'brief_export',
      sourceBriefId: brief.id,
      projectId: brief.projectId || undefined,
      engagementId: brief.engagementId || undefined,
    });

    if (!artifact) {
      return NextResponse.json(
        { error: 'Failed to create artifact record' },
        { status: 500 }
      );
    }

    // If Google Drive is enabled, create the actual document
    if (FEATURE_FLAGS.ARTIFACTS_GOOGLE_ENABLED) {
      try {
        const driveClient = createGoogleDriveClient(companyId);

        // Get or create company folder
        const folder = await driveClient.getOrCreateCompanyFolder(companyName);

        // Create the document
        const file = await driveClient.createDocument({
          title: documentTitle,
          content,
          parentFolderId: folder.id,
        });

        // Link the artifact to the Google file
        await linkArtifactToGoogleFile(
          artifact.id,
          file.id,
          file.webViewLink,
          'document',
          folder.id
        );

        return NextResponse.json({
          artifact: {
            ...artifact,
            googleFileId: file.id,
            googleFileUrl: file.webViewLink,
            googleFileType: 'document',
            googleFolderId: folder.id,
          },
          googleFile: file,
        }, { status: 201 });
      } catch (driveError) {
        console.error('[API Artifacts] Failed to create Google Doc:', driveError);
        return NextResponse.json({
          artifact,
          warning: 'Artifact created but Google Doc creation failed',
          error: driveError instanceof Error ? driveError.message : 'Unknown error',
        }, { status: 201 });
      }
    }

    // Return artifact without Google file (Google not enabled)
    return NextResponse.json({ artifact }, { status: 201 });
  } catch (error) {
    console.error('[API Artifacts] Failed to create brief doc:', error);
    return NextResponse.json(
      { error: 'Failed to create brief document' },
      { status: 500 }
    );
  }
}

/**
 * Build document content from a brief
 */
function buildBriefDocumentContent(brief: Brief): DocumentContent {
  const sections: DocumentSection[] = [];
  const core = brief.core;

  // Title
  sections.push({
    heading: brief.title,
    headingLevel: 1,
    body: `Type: ${brief.type} | Status: ${brief.status}`,
  });

  // Objective
  if (core.objective) {
    sections.push({
      heading: 'Objective',
      headingLevel: 2,
      body: core.objective,
    });
  }

  // Target Audience
  if (core.targetAudience) {
    sections.push({
      heading: 'Target Audience',
      headingLevel: 2,
      body: core.targetAudience,
    });
  }

  // Problem to Solve
  if (core.problemToSolve) {
    sections.push({
      heading: 'Problem to Solve',
      headingLevel: 2,
      body: core.problemToSolve,
    });
  }

  // Single-Minded Focus
  if (core.singleMindedFocus) {
    sections.push({
      heading: 'Single-Minded Focus',
      headingLevel: 2,
      body: core.singleMindedFocus,
    });
  }

  // Constraints
  if (core.constraints && core.constraints.length > 0) {
    sections.push({
      heading: 'Constraints',
      headingLevel: 2,
      body: core.constraints.map(c => `- ${c}`).join('\n'),
    });
  }

  // Success Definition
  if (core.successDefinition) {
    sections.push({
      heading: 'Success Definition',
      headingLevel: 2,
      body: core.successDefinition,
    });
  }

  // Assumptions
  if (core.assumptions && core.assumptions.length > 0) {
    sections.push({
      heading: 'Assumptions',
      headingLevel: 2,
      body: core.assumptions.map(a => `- ${a}`).join('\n'),
    });
  }

  // Metadata footer
  sections.push({
    heading: 'Document Information',
    headingLevel: 3,
    body: [
      `Generated from Hive OS Brief`,
      `Brief ID: ${brief.id}`,
      `Status: ${brief.status}`,
      `Created: ${new Date().toISOString().split('T')[0]}`,
    ].join('\n'),
  });

  return { sections };
}
