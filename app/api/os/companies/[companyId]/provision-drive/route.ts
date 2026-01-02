// app/api/os/companies/[companyId]/provision-drive/route.ts
// Provision Google Drive folder structure for a company
//
// POST - Trigger Drive provisioning for client folders
//
// This uses ADC-based Drive client (no JSON keys required).
// Creates: {ClientName} / *Projects folder structure
// Idempotent: if company already has driveProjectsFolderId, returns existing

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import { provisionClientFolders } from '@/lib/os/folders/provisioning';
import { folderUrl } from '@/lib/integrations/google/driveClient';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

// ============================================================================
// POST /api/os/companies/[companyId]/provision-drive
// ============================================================================

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { companyId } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const mode = (body?.mode as 'initialize' | 'upgrade' | undefined) || 'upgrade';
    const force = body?.force === true;

    console.log(`[Company Provision API] Starting provisioning for company: ${companyId}`);

    // 1. Load company
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json(
        { ok: false, error: 'Company not found' },
        { status: 404 }
      );
    }

    // 2. Eligibility gate (clients/opportunities only, unless forced)
    const isEligible =
      (company as any).isClient ||
      (company as any).driveEligible ||
      (company as any).driveProvisioningAllowed;
    if (!isEligible && !force) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Drive provisioning is restricted to clients/eligible opportunities. Set "Is Client" or "Drive Eligible" in Airtable, or pass force=true.',
        },
        { status: 400 }
      );
    }

    // 3. Idempotency check: if already provisioned, return success (upgrade is safe)
    if (company.driveClientFolderId && company.driveProjectsFolderId && mode === 'upgrade') {
      console.log(`[Company Provision API] Company ${company.name} already provisioned`);
      return NextResponse.json({
        ok: true,
        company: {
          id: company.id,
          name: company.name,
          driveClientFolderId: company.driveClientFolderId,
          driveProjectsFolderId: company.driveProjectsFolderId,
        },
        clientFolderUrl: folderUrl(company.driveClientFolderId),
        projectsFolderUrl: folderUrl(company.driveProjectsFolderId),
        message: 'Already provisioned',
      });
    }

    // 4. Provision/upgrade client folders using ADC-based service
    const result = await provisionClientFolders({
      companyId,
      companyName: company.name,
      mode: mode === 'initialize' ? 'initialize' : 'upgrade',
    });

    if (!result.ok) {
      console.error(`[Company Provision API] Provisioning failed:`, result.error);
      return NextResponse.json(
        {
          ok: false,
          error: result.error?.message || 'Failed to provision Drive folders',
          code: result.error?.code,
          howToFix: result.error?.howToFix,
        },
        { status: 500 }
      );
    }

    console.log(`[Company Provision API] Successfully provisioned ${company.name}`);

    return NextResponse.json({
      ok: true,
      company: {
        id: company.id,
        name: company.name,
        driveClientFolderId: result.clientFolderId,
        driveProjectsFolderId: result.projectsFolderId,
      },
      clientFolderUrl: result.clientFolderId ? folderUrl(result.clientFolderId) : null,
      projectsFolderUrl: result.projectsFolderId ? folderUrl(result.projectsFolderId) : null,
    });
  } catch (error: any) {
    console.error(`[Company Provision API] Unexpected error for company ${companyId}:`, error);
    return NextResponse.json(
      { ok: false, error: 'Failed to provision Drive folders' },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET /api/os/companies/[companyId]/provision-drive - Check status
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

    const isProvisioned = !!(company.driveClientFolderId && company.driveProjectsFolderId);

    return NextResponse.json({
      ok: true,
      company: {
        id: company.id,
        name: company.name,
        clientCode: company.clientCode,
      },
      provisioned: isProvisioned,
      driveClientFolderId: company.driveClientFolderId || null,
      driveProjectsFolderId: company.driveProjectsFolderId || null,
      clientFolderUrl: company.driveClientFolderId
        ? folderUrl(company.driveClientFolderId)
        : null,
      projectsFolderUrl: company.driveProjectsFolderId
        ? folderUrl(company.driveProjectsFolderId)
        : null,
    });
  } catch (error: any) {
    console.error(`[Company Provision API] Error checking status for ${companyId}:`, error);
    return NextResponse.json(
      { ok: false, error: 'Failed to check provisioning status' },
      { status: 500 }
    );
  }
}
