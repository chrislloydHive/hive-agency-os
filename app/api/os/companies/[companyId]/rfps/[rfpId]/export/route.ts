// app/api/os/companies/[companyId]/rfps/[rfpId]/export/route.ts
// Export RFP to Google Docs artifact
//
// Creates a Google Doc from all approved/ready RFP sections and registers as an artifact.

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import { getRfpWithDetails, updateRfp } from '@/lib/airtable/rfp';
import { getFirmBrainSnapshot } from '@/lib/airtable/firmBrain';
import type { SubmissionSnapshot } from '@/components/os/rfp/SubmissionReadinessModal';
import { createArtifact, linkArtifactToGoogleFile } from '@/lib/airtable/artifacts';
import { createGoogleDriveClient, isGoogleDriveAvailable } from '@/lib/integrations/googleDrive';
import type { DocumentContent, DocumentSection } from '@/lib/integrations/googleDrive';
import { FEATURE_FLAGS, FEATURE_DISABLED_RESPONSE } from '@/lib/config/featureFlags';
import { computeRfpProgress, RFP_SECTION_ORDER, RFP_SECTION_LABELS } from '@/lib/types/rfp';
import type { RfpSection, RfpSectionKey } from '@/lib/types/rfp';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ companyId: string; rfpId: string }>;
}

/**
 * POST /api/os/companies/[companyId]/rfps/[rfpId]/export
 * Export RFP to Google Docs
 *
 * Body:
 * - title?: string (optional, defaults to RFP title)
 * - includeAllSections?: boolean (default false, requires all ready/approved)
 * - snapshot?: SubmissionSnapshot (optional, captures bid readiness at export time)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    if (!FEATURE_FLAGS.ARTIFACTS_ENABLED) {
      return NextResponse.json(FEATURE_DISABLED_RESPONSE, { status: 403 });
    }

    const { companyId, rfpId } = await params;
    const body = await request.json().catch(() => ({}));

    // Load RFP with details
    const rfpDetails = await getRfpWithDetails(rfpId);
    if (!rfpDetails) {
      return NextResponse.json({ error: 'RFP not found' }, { status: 404 });
    }

    const { rfp, sections, bindings } = rfpDetails;

    // Check that this RFP belongs to the company
    if (rfp.companyId !== companyId) {
      return NextResponse.json({ error: 'RFP not found for this company' }, { status: 404 });
    }

    // Check RFP progress
    const progress = computeRfpProgress(sections);

    // By default, all sections must be ready or approved
    const includeAllSections = body.includeAllSections === true;
    if (!includeAllSections && !progress.canSubmit) {
      return NextResponse.json({
        error: 'RFP is not ready for export',
        blockers: progress.blockers,
        emptySections: progress.emptySections,
        draftSections: progress.draftSections,
        staleSections: progress.staleSections,
      }, { status: 400 });
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

    // Get company and agency profile for naming
    const [company, firmBrain] = await Promise.all([
      getCompanyById(companyId),
      getFirmBrainSnapshot(),
    ]);

    const companyName = company?.name || 'Unknown Company';
    const agencyName = firmBrain.agencyProfile?.name || 'Hive Agency';

    // Build document content from sections
    const documentTitle = body.title || rfp.title || `RFP Response - ${companyName}`;
    const content = buildRfpDocumentContent({
      sections,
      rfpTitle: rfp.title,
      companyName,
      agencyName,
      scopeSummary: rfp.scopeSummary || undefined,
      includeAllSections,
    });

    // Create the artifact record
    const artifact = await createArtifact({
      companyId,
      title: documentTitle,
      type: 'rfp_response_doc',
      source: 'rfp_export',
      description: `RFP Response for ${companyName} - ${rfp.title}`,
      lastSyncedAt: new Date().toISOString(),
    });

    if (!artifact) {
      return NextResponse.json(
        { error: 'Failed to create artifact record' },
        { status: 500 }
      );
    }

    // Store submission snapshot if provided
    const snapshot = body.snapshot as SubmissionSnapshot | undefined;
    if (snapshot) {
      try {
        await updateRfp(rfpId, { submissionSnapshot: snapshot });
      } catch (snapshotError) {
        console.error('[API RFP Export] Failed to store submission snapshot:', snapshotError);
        // Non-blocking - continue with export even if snapshot fails
      }
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
          success: true,
          artifact: {
            ...artifact,
            googleFileId: file.id,
            googleFileUrl: file.webViewLink,
            googleFileType: 'document',
            googleFolderId: folder.id,
          },
          googleFile: file,
          rfpId: rfp.id,
          sectionsIncluded: sections.filter(s => s.contentApproved || s.contentWorking).length,
          submissionSnapshotStored: !!snapshot,
        }, { status: 201 });
      } catch (driveError) {
        console.error('[API RFP Export] Failed to create Google Doc:', driveError);
        return NextResponse.json({
          artifact,
          warning: 'Artifact created but Google Doc creation failed',
          error: driveError instanceof Error ? driveError.message : 'Unknown error',
          submissionSnapshotStored: !!snapshot,
        }, { status: 201 });
      }
    }

    // Return artifact without Google file (Google not enabled)
    return NextResponse.json({
      success: true,
      artifact,
      rfpId: rfp.id,
      sectionsIncluded: sections.filter(s => s.contentApproved || s.contentWorking).length,
      submissionSnapshotStored: !!snapshot,
    }, { status: 201 });
  } catch (error) {
    console.error('[API RFP Export] Failed to export RFP:', error);
    return NextResponse.json(
      { error: 'Failed to export RFP' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Document Building
// ============================================================================

interface BuildDocumentArgs {
  sections: RfpSection[];
  rfpTitle: string;
  companyName: string;
  agencyName: string;
  scopeSummary?: string;
  includeAllSections: boolean;
}

/**
 * Build RFP document content from sections
 */
function buildRfpDocumentContent(args: BuildDocumentArgs): DocumentContent {
  const {
    sections,
    rfpTitle,
    companyName,
    agencyName,
    scopeSummary,
    includeAllSections,
  } = args;

  const documentSections: DocumentSection[] = [];

  // Title page
  documentSections.push({
    heading: rfpTitle,
    headingLevel: 1,
    body: [
      `Prepared for: ${companyName}`,
      `Prepared by: ${agencyName}`,
      `Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
    ].join('\n'),
  });

  // Optional scope summary
  if (scopeSummary) {
    documentSections.push({
      heading: 'Scope Overview',
      headingLevel: 2,
      body: scopeSummary,
    });
  }

  // Add each section in order
  for (const sectionKey of RFP_SECTION_ORDER) {
    const section = sections.find(s => s.sectionKey === sectionKey);
    if (!section) continue;

    // Get content - prefer approved, fall back to working if includeAllSections
    const content = section.contentApproved || (includeAllSections ? section.contentWorking : null);
    if (!content) continue;

    documentSections.push({
      heading: section.title || RFP_SECTION_LABELS[sectionKey],
      headingLevel: 2,
      body: content,
    });
  }

  // Footer with generation info
  documentSections.push({
    heading: 'Document Information',
    headingLevel: 3,
    body: [
      `Generated: ${new Date().toISOString().split('T')[0]}`,
      `Source: Hive Agency OS - RFP Builder`,
      '',
      'This document was generated from approved RFP sections.',
      'For the latest version, please contact the agency team.',
    ].join('\n'),
  });

  return { sections: documentSections };
}

/**
 * GET /api/os/companies/[companyId]/rfps/[rfpId]/export
 * Get preview of what would be exported (without creating artifact)
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { companyId, rfpId } = await params;

    // Load RFP with details
    const rfpDetails = await getRfpWithDetails(rfpId);
    if (!rfpDetails) {
      return NextResponse.json({ error: 'RFP not found' }, { status: 404 });
    }

    const { rfp, sections } = rfpDetails;

    // Check that this RFP belongs to the company
    if (rfp.companyId !== companyId) {
      return NextResponse.json({ error: 'RFP not found for this company' }, { status: 404 });
    }

    // Build preview
    const progress = computeRfpProgress(sections);
    const sectionPreviews = RFP_SECTION_ORDER.map(sectionKey => {
      const section = sections.find(s => s.sectionKey === sectionKey);
      if (!section) {
        return {
          sectionKey,
          title: RFP_SECTION_LABELS[sectionKey],
          status: 'missing' as const,
          hasContent: false,
          isStale: false,
        };
      }

      return {
        sectionKey,
        title: section.title,
        status: section.status,
        hasContent: !!(section.contentApproved || section.contentWorking),
        hasApprovedContent: !!section.contentApproved,
        isStale: section.isStale,
        staleReason: section.staleReason,
        sourceType: section.sourceType,
      };
    });

    return NextResponse.json({
      rfpId: rfp.id,
      title: rfp.title,
      canExport: progress.canSubmit,
      progress,
      sections: sectionPreviews,
    });
  } catch (error) {
    console.error('[API RFP Export] Failed to get preview:', error);
    return NextResponse.json(
      { error: 'Failed to get export preview' },
      { status: 500 }
    );
  }
}
