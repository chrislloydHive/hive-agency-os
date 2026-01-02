// app/api/os/companies/[companyId]/provision-msa/route.ts
// Provision Master Services Agreement (MSA) document for a company
//
// POST - Create MSA from template
//
// This is idempotent:
// - If company already has MSA provisioned, returns existing document
// - Otherwise creates new MSA from template

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById, updateCompanyMsa } from '@/lib/airtable/companies';
import { listTemplates } from '@/lib/airtable/templates';
import { generateDocumentName, DESTINATION_FOLDER_NAMES } from '@/lib/types/template';
import {
  ensureDocumentFromTemplate,
  ensureChildFolder,
  getDocument,
} from '@/lib/google/driveClient';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60s for document operations

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

// ============================================================================
// POST /api/os/companies/[companyId]/provision-msa - Provision MSA document
// ============================================================================

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { companyId } = await params;

  try {
    console.log(`[MSA Provision] Starting MSA provisioning for company: ${companyId}`);

    // 1. Load company
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json(
        { ok: false, error: 'Company not found' },
        { status: 404 }
      );
    }

    // 2. Idempotency check: if MSA already provisioned, return existing
    if (company.msaDriveFileId) {
      console.log(`[MSA Provision] Company ${company.name} already has MSA provisioned`);

      // Optionally verify the document still exists
      const existingDoc = await getDocument(company.msaDriveFileId);
      if (existingDoc) {
        return NextResponse.json({
          ok: true,
          msaDocId: company.msaDriveFileId,
          msaDocUrl: company.msaDriveUrl,
          message: 'MSA already provisioned',
        });
      }

      // Document was deleted, clear the reference
      console.log(`[MSA Provision] MSA document no longer exists, will recreate`);
    }

    // 3. Validate Drive configuration
    if (!company.driveClientFolderId) {
      return NextResponse.json(
        { ok: false, error: `Company "${company.name}" does not have Drive Client Folder ID configured` },
        { status: 400 }
      );
    }

    // 4. Find MSA template
    const msaTemplates = await listTemplates({ scope: 'client', documentType: 'MSA' });
    if (msaTemplates.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'No MSA template configured' },
        { status: 400 }
      );
    }

    const msaTemplate = msaTemplates[0]; // Use first MSA template

    // 5. Get or create MSA folder under client root
    const msaFolderName = DESTINATION_FOLDER_NAMES.client_msa_folder;
    let msaFolderId = company.msaFolderId;

    if (!msaFolderId && msaFolderName) {
      const msaFolder = await ensureChildFolder(company.driveClientFolderId, msaFolderName);
      msaFolderId = msaFolder.id;
    } else if (!msaFolderId) {
      // Use client root folder directly
      msaFolderId = company.driveClientFolderId;
    }

    // 6. Generate MSA document name
    const msaDocName = generateDocumentName('MSA', '', company.name);

    // 7. Copy template (idempotent)
    console.log(`[MSA Provision] Creating MSA document: ${msaDocName}`);

    const msaDoc = await ensureDocumentFromTemplate(
      msaTemplate.driveTemplateFileId,
      msaFolderId,
      msaDocName
    );

    // 8. Update company with MSA info
    const updatedCompany = await updateCompanyMsa(companyId, {
      msaDriveFileId: msaDoc.id,
      msaDriveUrl: msaDoc.url,
      msaFolderId: msaFolderId,
    });

    console.log(`[MSA Provision] Successfully provisioned MSA for ${company.name}: ${msaDoc.url}`);

    return NextResponse.json({
      ok: true,
      msaDocId: msaDoc.id,
      msaDocUrl: msaDoc.url,
      company: updatedCompany,
    });
  } catch (error: any) {
    console.error(`[MSA Provision] Unexpected error for company ${companyId}:`, error);

    return NextResponse.json(
      { ok: false, error: 'Failed to provision MSA document' },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET /api/os/companies/[companyId]/provision-msa - Get MSA status
// ============================================================================

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { companyId } = await params;

  try {
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json(
        { ok: false, error: 'Company not found' },
        { status: 404 }
      );
    }

    const hasMsa = !!company.msaDriveFileId;

    return NextResponse.json({
      ok: true,
      hasMsa,
      msaDocId: company.msaDriveFileId || null,
      msaDocUrl: company.msaDriveUrl || null,
    });
  } catch (error: any) {
    console.error(`[MSA] Failed to get MSA status for company ${companyId}:`, error);

    return NextResponse.json(
      { ok: false, error: 'Failed to get MSA status' },
      { status: 500 }
    );
  }
}
