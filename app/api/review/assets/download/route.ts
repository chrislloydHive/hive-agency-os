// app/api/review/assets/download/route.ts
// GET: Stream asset file content. Query: assetId, token, exp, sig (from POST download-link).
// Verifies HMAC + exp, checks file size (reject >500MB), streams from Drive, records downloadedAt on success.

import { NextRequest, NextResponse } from 'next/server';
import { Readable } from 'stream';
import { google } from 'googleapis';
import { resolveReviewProject } from '@/lib/review/resolveProject';
import { getAllowedReviewFolderIdsFromJobFolder, getAllowedReviewFolderIdsFromClientProjectsFolder } from '@/lib/review/reviewFolders';
import { listAssetStatuses, setPartnerDownloadedAt } from '@/lib/airtable/reviewAssetStatus';
import { verifySignature } from '@/lib/review/downloadSignature';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;
const MAX_INLINE_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB

function keyFrom(token: string, fileId: string): string {
  return `${token}::${fileId}`;
}

function safeFilename(name: string): string {
  const ascii = name.replace(/[^\x20-\x7E]/g, '_');
  return ascii || 'download';
}

export async function GET(req: NextRequest) {
  const assetId = req.nextUrl.searchParams.get('assetId')?.trim() ?? '';
  const token = req.nextUrl.searchParams.get('token')?.trim() ?? '';
  const expStr = req.nextUrl.searchParams.get('exp')?.trim() ?? '';
  const sig = req.nextUrl.searchParams.get('sig')?.trim() ?? '';

  if (!assetId || !token || !expStr || !sig) {
    return NextResponse.json(
      { error: 'Missing assetId, token, exp, or sig' },
      { status: 400, headers: NO_STORE }
    );
  }

  const exp = parseInt(expStr, 10);
  if (Number.isNaN(exp) || exp <= 0) {
    return NextResponse.json(
      { error: 'Invalid exp' },
      { status: 400, headers: NO_STORE }
    );
  }

  if (Math.floor(Date.now() / 1000) > exp) {
    return NextResponse.json(
      { error: 'Download link expired' },
      { status: 403, headers: NO_STORE }
    );
  }

  if (!verifySignature(assetId, token, exp, sig)) {
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 403, headers: NO_STORE }
    );
  }

  const resolved = await resolveReviewProject(token);
  if (!resolved) {
    return NextResponse.json(
      { error: 'Invalid or expired token' },
      { status: 401, headers: NO_STORE }
    );
  }

  const { project, auth } = resolved;
  const drive = google.drive({ version: 'v3', auth });

  const allowedFolderIds = project.jobFolderId
    ? await getAllowedReviewFolderIdsFromJobFolder(drive, project.jobFolderId)
    : await (async () => {
        const clientProjectsFolderId = process.env.CAR_TOYS_PROJECTS_FOLDER_ID ?? '1NLCt-piSxfAFeeINuFyzb3Pxp-kKXTw_';
        if (clientProjectsFolderId) {
          const fromClient = await getAllowedReviewFolderIdsFromClientProjectsFolder(
            drive,
            project.name,
            clientProjectsFolderId
          );
          if (fromClient?.length) return fromClient;
        }
        return null;
      })();

  if (!allowedFolderIds || allowedFolderIds.length === 0) {
    return NextResponse.json(
      { error: 'No review folders configured' },
      { status: 403, headers: NO_STORE }
    );
  }

  let mimeType: string;
  let fileName: string;
  let size: number | undefined;

  try {
    const meta = await drive.files.get({
      fileId: assetId,
      fields: 'id,name,mimeType,size,parents',
      supportsAllDrives: true,
    });

    const parents = meta.data.parents ?? [];
    const isAllowed = parents.some((p) => allowedFolderIds.includes(p));
    if (!isAllowed) {
      return NextResponse.json(
        { error: 'File not in allowed folders' },
        { status: 403, headers: NO_STORE }
      );
    }

    mimeType = (meta.data.mimeType as string) || 'application/octet-stream';
    fileName = (meta.data.name as string) || assetId;
    size = meta.data.size != null ? Number(meta.data.size) : undefined;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[review/assets/download] Drive metadata error:', msg);
    return NextResponse.json(
      { error: 'File not found or access denied' },
      { status: 404, headers: NO_STORE }
    );
  }

  if (size != null && size > MAX_INLINE_SIZE_BYTES) {
    return NextResponse.json(
      {
        ok: false,
        error: 'File too large for inline download',
        maxSizeMB: 500,
        message: 'This file exceeds 500 MB. Use Drive directly or contact the project owner.',
      },
      { status: 413, headers: NO_STORE }
    );
  }

  const statusMap = await listAssetStatuses(token);
  const record = statusMap.get(keyFrom(token, assetId));
  const recordId = record?.recordId;

  try {
    const res = await drive.files.get(
      { fileId: assetId, alt: 'media', supportsAllDrives: true },
      { responseType: 'stream' }
    );

    const nodeStream = res.data as unknown as Readable;
    const webReadable = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

    const transform = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        controller.enqueue(chunk);
      },
      flush() {
        if (recordId) {
          setPartnerDownloadedAt(recordId).catch((e) => {
            console.warn('[review/assets/download] setPartnerDownloadedAt failed:', e);
          });
        }
      },
    });

    const headers: Record<string, string> = {
      ...NO_STORE,
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${safeFilename(fileName)}"`,
    };

    return new NextResponse(webReadable.pipeThrough(transform), {
      status: 200,
      headers,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[review/assets/download] Drive stream error:', msg);
    return NextResponse.json(
      { error: 'Failed to fetch file' },
      { status: 500, headers: NO_STORE }
    );
  }
}
