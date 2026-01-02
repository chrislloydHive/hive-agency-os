// app/api/os/companies/[companyId]/drive/programs/route.ts
// Create a program folder (v1 sub-structure) under 03_Programs for a company

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById, updateCompanyDriveFolders } from '@/lib/airtable/companies';
import { ensureClientFolders, createProgramFolder } from '@/lib/os/folders/provisioning';
import { folderUrl } from '@/lib/integrations/google/driveClient';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { companyId } = await params;

  try {
    const body = await request.json();
    const programName = (body?.programName as string | undefined)?.trim();

    if (!programName) {
      return NextResponse.json({ ok: false, error: 'programName is required' }, { status: 400 });
    }

    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json({ ok: false, error: 'Company not found' }, { status: 404 });
    }

    // Ensure client folders exist (idempotent)
    const ensured = await ensureClientFolders(companyId);
    if (!ensured.ok || !ensured.projectsFolderId) {
      return NextResponse.json(
        { ok: false, error: ensured.error?.message || 'Failed to ensure client folders' },
        { status: 500 }
      );
    }

    // Create program folder + substructure
    const created = await createProgramFolder({
      programsFolderId: ensured.projectsFolderId,
      programName,
    });

    // Optionally persist program folder map under Drive Folder Map (append)
    await updateCompanyDriveFolders(companyId, {
      driveFolderMap: {
        ...(company as any).driveFolderMap,
        [`program:${programName}`]: created.subfolders,
      },
    });

    return NextResponse.json({
      ok: true,
      programFolderId: created.id,
      programFolderUrl: folderUrl(created.id),
      subfolders: created.subfolders,
    });
  } catch (error) {
    console.error('[drive/programs] Error creating program folder:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

