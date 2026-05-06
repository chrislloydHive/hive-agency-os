// POST /api/os/drive/upload-file
// Multipart upload of an arbitrary file into a Google Drive folder using the same
// company OAuth path as /api/os/drive/publish (createGoogleDriveClient).

import { NextRequest, NextResponse } from 'next/server';
import { createGoogleDriveClient, GoogleDriveError } from '@/lib/integrations/googleDrive';
import { uploadOrUpdateFileInFolder } from '@/lib/os/driveUploadBinaryToFolder';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function stripTokenLeak(message: string): string {
  if (/Bearer\s+/i.test(message) || /refresh_token/i.test(message)) {
    return 'Drive API request failed';
  }
  return message;
}

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Expected multipart/form-data' },
      { status: 400 },
    );
  }

  const folderIdRaw = formData.get('folderId');
  const folderId = typeof folderIdRaw === 'string' ? folderIdRaw.trim() : '';
  if (!folderId) {
    return NextResponse.json({ ok: false, error: 'folderId is required' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: 'file is required' }, { status: 400 });
  }

  const fileNameOverride = formData.get('fileName');
  const override =
    typeof fileNameOverride === 'string' && fileNameOverride.trim() ? fileNameOverride.trim() : '';
  const fileName = override || file.name?.trim() || 'upload';
  if (!fileName) {
    return NextResponse.json({ ok: false, error: 'fileName could not be determined' }, { status: 400 });
  }

  const companyIdRaw = formData.get('companyId');
  const companyId =
    (typeof companyIdRaw === 'string' && companyIdRaw.trim() ? companyIdRaw.trim() : null) ||
    process.env.DMA_DEFAULT_COMPANY_ID ||
    '';
  if (!companyId) {
    return NextResponse.json(
      { ok: false, error: 'companyId is required (or set DMA_DEFAULT_COMPANY_ID env var)' },
      { status: 400 },
    );
  }

  try {
    const driveClient = createGoogleDriveClient(companyId);
    const drive = await driveClient.getDrive();
    const body = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type?.trim() || 'application/octet-stream';

    const result = await uploadOrUpdateFileInFolder(drive, {
      folderId,
      fileName,
      mimeType,
      body,
    });

    console.log(
      `[drive/upload-file] ${result.action} name="${fileName}" folderId=${folderId} fileId=${result.fileId}`,
    );

    return NextResponse.json({
      ok: true,
      fileId: result.fileId,
      fileUrl: result.fileUrl,
      action: result.action,
    });
  } catch (err: unknown) {
    console.error('[drive/upload-file] Error:', err);
    const message =
      err instanceof GoogleDriveError
        ? err.message
        : err instanceof Error
          ? stripTokenLeak(err.message)
          : 'Upload failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
