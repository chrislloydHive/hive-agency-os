// app/api/os/companies/[companyId]/artifacts/instantiate/route.ts
// Template Instantiation API - Creates artifact from template
//
// POST: Instantiate a template for this company
// - Copies template from Drive
// - Creates artifact index entry
// - Returns artifact metadata

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCompanyById } from '@/lib/airtable/companies';
import { getTemplateById } from '@/lib/airtable/templates';
import { createArtifactIndexEntry } from '@/lib/airtable/artifactIndex';
import { ArtifactStatus, ArtifactSource, ArtifactStorage, ArtifactPhase, ArtifactFileType } from '@/lib/types/artifactTaxonomy';
import { copyFile } from '@/lib/integrations/google/driveClient';
import { generateDocumentName, DESTINATION_FOLDER_NAMES } from '@/lib/types/template';

const InstantiateSchema = z.object({
  templateId: z.string(),
  jobCode: z.string().optional(),
});

/**
 * Extract Google Drive file ID from URL or return as-is if already an ID
 * Handles URLs like:
 * - https://docs.google.com/document/d/FILE_ID/edit
 * - https://drive.google.com/file/d/FILE_ID/view
 * - https://docs.google.com/spreadsheets/d/FILE_ID/edit
 */
function extractFileId(urlOrId: string): string {
  // If it doesn't look like a URL, assume it's already an ID
  if (!urlOrId.includes('/')) {
    return urlOrId;
  }

  // Try to extract ID from Google Docs/Drive URL patterns
  const patterns = [
    /\/d\/([a-zA-Z0-9_-]+)/,  // /d/FILE_ID/
    /id=([a-zA-Z0-9_-]+)/,    // ?id=FILE_ID
  ];

  for (const pattern of patterns) {
    const match = urlOrId.match(pattern);
    if (match) {
      return match[1];
    }
  }

  // Fallback: return as-is (will fail with clear error if invalid)
  return urlOrId;
}

type RouteContext = {
  params: Promise<{ companyId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { companyId } = await context.params;

    // Parse and validate body
    const body = await request.json();
    const { templateId, jobCode } = InstantiateSchema.parse(body);

    // Get company
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Check if company has Drive folder
    const driveFolderId = (company as any).driveClientFolderId;
    if (!driveFolderId) {
      return NextResponse.json(
        { error: 'Company does not have a Google Drive folder configured' },
        { status: 400 }
      );
    }

    // Get template
    const template = await getTemplateById(templateId);
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Generate document name
    const documentName = generateDocumentName(
      template.documentType,
      jobCode || company.name.substring(0, 6).toUpperCase(),
      company.name
    );

    // Determine destination folder
    let destinationFolderId = driveFolderId;
    const subfolderName = DESTINATION_FOLDER_NAMES[template.destinationFolderKey];

    // For now, just use root folder. TODO: Create/find subfolder
    // In production, you'd resolve the subfolder path here

    // Extract file ID from URL if needed
    const templateFileId = extractFileId(template.driveTemplateFileId);

    // Copy template to destination using ADC-based client
    let copiedFile;
    try {
      copiedFile = await copyFile(
        templateFileId,
        destinationFolderId,
        documentName
      );
    } catch (driveError: any) {
      console.error('[Instantiate] Drive copy failed:', driveError);
      return NextResponse.json(
        { error: `Failed to copy template: ${driveError.message}` },
        { status: 500 }
      );
    }

    // Create artifact index entry
    const artifactEntry = await createArtifactIndexEntry({
      companyId,
      title: documentName,
      artifactType: mapDocTypeToArtifactType(template.documentType),
      phase: ArtifactPhase.Deliver,
      status: ArtifactStatus.Draft,
      source: ArtifactSource.Template,
      storage: ArtifactStorage.GoogleDrive,
      fileType: ArtifactFileType.Doc,
      groupKey: `template:${template.documentType.toLowerCase()}`,
      googleFileId: copiedFile.id,
      url: `https://docs.google.com/document/d/${copiedFile.id}/edit`,
    });

    console.log('[Instantiate] Created artifact:', {
      companyId,
      templateId,
      artifactId: artifactEntry?.id,
      documentName,
    });

    return NextResponse.json({
      ok: true,
      artifact: {
        id: artifactEntry?.id || copiedFile.id,
        title: documentName,
        url: `https://docs.google.com/document/d/${copiedFile.id}/edit`,
        googleFileId: copiedFile.id,
      },
    });
  } catch (error: any) {
    console.error('[Instantiate] Error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

function mapDocTypeToArtifactType(docType: string): string {
  switch (docType) {
    case 'SOW':
      return 'sow_doc';
    case 'BRIEF':
      return 'brief_doc';
    case 'TIMELINE':
      return 'timeline_doc';
    case 'MSA':
      return 'msa_doc';
    default:
      return 'custom';
  }
}
