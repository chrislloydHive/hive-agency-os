// app/api/os/jobs/[jobId]/provision-docs/route.ts
// Provision documents from templates for a job
//
// POST - Create documents from templates
//
// This is idempotent:
// - If a document already exists (same name in same folder), it's skipped
// - Returns both new and existing documents

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import { getJobById } from '@/lib/airtable/jobs';
import {
  getTemplatesByIds,
  getDefaultTemplatePackWithTemplates,
  getTemplatePackWithTemplates,
} from '@/lib/airtable/templates';
import { createJobDocuments, listJobDocuments } from '@/lib/airtable/jobDocuments';
import { generateDocumentName, DESTINATION_FOLDER_NAMES } from '@/lib/types/template';
import type { TemplateRecord, DocumentType, DestinationFolderKey } from '@/lib/types/template';
import {
  ensureDocumentFromTemplate,
  ensureChildFolder,
  type DriveDocument,
} from '@/lib/google/driveClient';
import { ProvisionDocsInputSchema } from '@/lib/types/template';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // Allow up to 2 minutes for document operations

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

// ============================================================================
// POST /api/os/jobs/[jobId]/provision-docs - Provision documents from templates
// ============================================================================

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { jobId } = await params;

  try {
    // Parse and validate request body
    const body = await request.json().catch(() => ({}));
    const parseResult = ProvisionDocsInputSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { ok: false, error: 'Invalid request body', details: parseResult.error.errors },
        { status: 400 }
      );
    }

    const { templatePackId, templateIds } = parseResult.data;

    console.log(`[Jobs Provision Docs] Starting provisioning for job: ${jobId}`);

    // 1. Load job
    const job = await getJobById(jobId);
    if (!job) {
      return NextResponse.json(
        { ok: false, error: 'Job not found' },
        { status: 404 }
      );
    }

    // 2. Verify job has Drive folder provisioned
    if (!job.driveJobFolderId || job.status !== 'ready') {
      return NextResponse.json(
        { ok: false, error: 'Job must be provisioned with Drive folder first' },
        { status: 400 }
      );
    }

    // 3. Load company
    const company = await getCompanyById(job.companyId);
    if (!company) {
      return NextResponse.json(
        { ok: false, error: 'Company not found' },
        { status: 404 }
      );
    }

    // 4. Get templates to provision
    let templates: TemplateRecord[] = [];

    if (templateIds && templateIds.length > 0) {
      // Use specific templates
      templates = await getTemplatesByIds(templateIds);
    } else if (templatePackId) {
      // Use template pack
      const pack = await getTemplatePackWithTemplates(templatePackId);
      if (!pack) {
        return NextResponse.json(
          { ok: false, error: 'Template pack not found' },
          { status: 404 }
        );
      }
      templates = pack.templates || [];
    } else {
      // Use default template pack
      const defaultPack = await getDefaultTemplatePackWithTemplates();
      if (defaultPack && defaultPack.templates) {
        templates = defaultPack.templates;
      }
    }

    // Filter to only job-scoped templates (not client-level like MSA)
    templates = templates.filter((t) => t.scope === 'job');

    if (templates.length === 0) {
      return NextResponse.json({
        ok: true,
        documents: [],
        message: 'No job-scoped templates to provision',
      });
    }

    console.log(`[Jobs Provision Docs] Provisioning ${templates.length} templates for ${job.jobCode}`);

    // 5. Get existing documents for this job
    const existingDocs = await listJobDocuments(jobId);
    const existingByType = new Map(existingDocs.map((d) => [d.documentType, d]));

    // 6. Provision each template
    const results: Array<{
      template: TemplateRecord;
      document: DriveDocument;
      isNew: boolean;
    }> = [];

    for (const template of templates) {
      try {
        // Skip if document of this type already exists
        if (existingByType.has(template.documentType)) {
          console.log(`[Jobs Provision Docs] Skipping ${template.documentType} - already exists`);
          continue;
        }

        // Get destination folder ID
        const destFolderId = await getDestinationFolderId(
          job.driveJobFolderId,
          template.destinationFolderKey
        );

        // Generate document name
        const docName = generateDocumentName(
          template.documentType,
          job.jobCode,
          company.name
        );

        // Copy template (idempotent)
        const doc = await ensureDocumentFromTemplate(
          template.driveTemplateFileId,
          destFolderId,
          docName
        );

        results.push({
          template,
          document: doc,
          isNew: true,
        });

        console.log(`[Jobs Provision Docs] Provisioned ${template.documentType}: ${doc.name}`);
      } catch (error: any) {
        console.error(
          `[Jobs Provision Docs] Failed to provision ${template.documentType}:`,
          error?.message || error
        );
        // Continue with other templates
      }
    }

    // 7. Create JobDocument records for new documents
    if (results.length > 0) {
      const docsToCreate = results.map((r) => ({
        jobId,
        documentType: r.template.documentType as DocumentType,
        driveFileId: r.document.id,
        driveUrl: r.document.url,
        name: r.document.name,
        status: 'draft' as const,
      }));

      const createdDocs = await createJobDocuments(docsToCreate);
      console.log(`[Jobs Provision Docs] Created ${createdDocs.length} JobDocument records`);

      return NextResponse.json({
        ok: true,
        documents: createdDocs,
        message: `Provisioned ${createdDocs.length} documents`,
      });
    }

    return NextResponse.json({
      ok: true,
      documents: [],
      message: 'All requested documents already exist',
    });
  } catch (error: any) {
    console.error(`[Jobs Provision Docs] Unexpected error for job ${jobId}:`, error);

    return NextResponse.json(
      { ok: false, error: 'Failed to provision documents' },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET /api/os/jobs/[jobId]/provision-docs - List documents for a job
// ============================================================================

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { jobId } = await params;

  try {
    const job = await getJobById(jobId);
    if (!job) {
      return NextResponse.json(
        { ok: false, error: 'Job not found' },
        { status: 404 }
      );
    }

    const documents = await listJobDocuments(jobId);

    return NextResponse.json({
      ok: true,
      documents,
    });
  } catch (error: any) {
    console.error(`[Jobs Docs] Failed to list documents for job ${jobId}:`, error);

    return NextResponse.json(
      { ok: false, error: 'Failed to list documents' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get the destination folder ID for a document based on destinationFolderKey
 */
async function getDestinationFolderId(
  jobFolderId: string,
  destinationFolderKey: DestinationFolderKey
): Promise<string> {
  const folderName = DESTINATION_FOLDER_NAMES[destinationFolderKey];

  // If no folder name (e.g., client_root), return job folder
  if (!folderName) {
    return jobFolderId;
  }

  // Ensure subfolder exists and return its ID
  const subfolder = await ensureChildFolder(jobFolderId, folderName);
  return subfolder.id;
}
