// lib/os/driveUploadBinaryToFolder.ts
// Idempotent binary upload into a Drive folder (list by name → update or create).

import type { drive_v3 } from 'googleapis';
import { Readable } from 'node:stream';

/** Escape a string for use inside a Drive API `q` single-quoted literal. */
export function escapeDriveQueryLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export function buildListFilesByNameQuery(folderId: string, fileName: string): string {
  return `'${escapeDriveQueryLiteral(folderId)}' in parents and name = '${escapeDriveQueryLiteral(fileName)}' and trashed = false`;
}

function bufferToStream(buf: Buffer): Readable {
  return Readable.from(Buffer.from(buf));
}

export async function uploadOrUpdateFileInFolder(
  drive: drive_v3.Drive,
  params: { folderId: string; fileName: string; mimeType: string; body: Buffer },
): Promise<{ fileId: string; fileUrl: string; action: 'Uploaded' | 'Updated' }> {
  const { folderId, fileName, mimeType, body } = params;
  const q = buildListFilesByNameQuery(folderId, fileName);

  const listRes = await drive.files.list({
    q,
    fields: 'files(id, name, webViewLink)',
    pageSize: 5,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const existing = listRes.data.files?.[0];

  async function resolveWebViewLink(fileId: string, link?: string | null): Promise<string> {
    if (link) return link;
    const meta = await drive.files.get({
      fileId,
      fields: 'webViewLink',
      supportsAllDrives: true,
    });
    return meta.data.webViewLink ?? `https://drive.google.com/file/d/${fileId}/view`;
  }

  if (existing?.id) {
    const up = await drive.files.update({
      fileId: existing.id,
      media: { mimeType, body: bufferToStream(body) },
      fields: 'id, webViewLink',
      supportsAllDrives: true,
    });
    const fileId = up.data.id ?? existing.id;
    const fileUrl = await resolveWebViewLink(fileId, up.data.webViewLink);
    return { fileId, fileUrl, action: 'Updated' };
  }

  const cr = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: { mimeType, body: bufferToStream(body) },
    fields: 'id, webViewLink',
    supportsAllDrives: true,
  });

  const fileId = cr.data.id;
  if (!fileId) {
    throw new Error('Drive did not return a file id after create');
  }
  const fileUrl = await resolveWebViewLink(fileId, cr.data.webViewLink);
  return { fileId, fileUrl, action: 'Uploaded' };
}
