// app/api/review/assets/download/route.ts
// GET: Stream asset file content. Query: dlId, exp, sig (from POST download-link; no token in URL).
// Verifies HMAC(dlId, exp), resolves token+assetId from one-time session store, then streams from Drive.
// Tracking: Partner Download Started At before stream; Partner Downloaded At only on successful stream completion.

import { NextRequest, NextResponse } from 'next/server';
import { Readable } from 'stream';
import { PassThrough } from 'stream';
import { google } from 'googleapis';
import { resolveReviewProject } from '@/lib/review/resolveProject';
import { getAllowedReviewFolderIdsFromJobFolder, getAllowedReviewFolderIdsFromClientProjectsFolder } from '@/lib/review/reviewFolders';
import {
  getCrasRecordIdByTokenAndFileId,
  setPartnerDownloadedAt,
  setPartnerDownloadStartedAt,
} from '@/lib/airtable/reviewAssetStatus';
import { verifyDownloadSignature } from '@/lib/review/downloadSignature';
import { getAndDeleteDownloadSession } from '@/lib/review/downloadSessionStore';
import {
  isGoogleWorkspaceFile,
  getDefaultExportFormat,
  getExportFileExtension,
  exportGoogleWorkspaceFile,
} from '@/lib/google/driveClient';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;
const EXTRA_HEADERS = { 'Referrer-Policy': 'no-referrer' as const };
const MAX_INLINE_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB

function safeFilename(name: string): string {
  const ascii = name.replace(/[^\x20-\x7E]/g, '_');
  return ascii || 'download';
}

interface DownloadLogContext {
  assetId: string;
  recordId: string | undefined;
  startedAtWritten: boolean;
  completedAtWritten: boolean;
  aborted: boolean;
}

function logDownload(context: DownloadLogContext, message: string) {
  console.log('[review/assets/download]', message, JSON.stringify(context));
}

export async function GET(req: NextRequest) {
  const dlId = req.nextUrl.searchParams.get('dlId')?.trim() ?? '';
  const expStr = req.nextUrl.searchParams.get('exp')?.trim() ?? '';
  const sig = req.nextUrl.searchParams.get('sig')?.trim() ?? '';

  if (!dlId || !expStr || !sig) {
    return NextResponse.json(
      { error: 'Missing dlId, exp, or sig' },
      { status: 400, headers: { ...NO_STORE, ...EXTRA_HEADERS } }
    );
  }

  const exp = parseInt(expStr, 10);
  if (Number.isNaN(exp) || exp <= 0) {
    return NextResponse.json(
      { error: 'Invalid exp' },
      { status: 400, headers: { ...NO_STORE, ...EXTRA_HEADERS } }
    );
  }

  if (Math.floor(Date.now() / 1000) > exp) {
    return NextResponse.json(
      { error: 'Download link expired' },
      { status: 403, headers: { ...NO_STORE, ...EXTRA_HEADERS } }
    );
  }

  if (!verifyDownloadSignature(dlId, exp, sig)) {
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 403, headers: { ...NO_STORE, ...EXTRA_HEADERS } }
    );
  }

  const session = await getAndDeleteDownloadSession(dlId);
  if (!session) {
    return NextResponse.json(
      { error: 'Download link invalid or already used' },
      { status: 403, headers: { ...NO_STORE, ...EXTRA_HEADERS } }
    );
  }

  const { token, assetId } = session;

  const resolved = await resolveReviewProject(token);
  if (!resolved) {
    return NextResponse.json(
      { error: 'Invalid or expired token' },
      { status: 401, headers: { ...NO_STORE, ...EXTRA_HEADERS } }
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
      { status: 403, headers: { ...NO_STORE, ...EXTRA_HEADERS } }
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
        { status: 403, headers: { ...NO_STORE, ...EXTRA_HEADERS } }
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
      { status: 404, headers: { ...NO_STORE, ...EXTRA_HEADERS } }
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
      { status: 413, headers: { ...NO_STORE, ...EXTRA_HEADERS } }
    );
  }

  const recordId = await getCrasRecordIdByTokenAndFileId(token, assetId);

  const logContext: DownloadLogContext = {
    assetId,
    recordId: recordId ?? undefined,
    startedAtWritten: false,
    completedAtWritten: false,
    aborted: false,
  };

  if (recordId) {
    const startedOk = await setPartnerDownloadStartedAt(recordId);
    logContext.startedAtWritten = startedOk;
    logDownload(logContext, 'startedAt written');
  }

  // Check if this is a Google Workspace file that needs export
  const isGoogleDoc = isGoogleWorkspaceFile(mimeType);
  const exportFormat = req.nextUrl.searchParams.get('format')?.trim() || null; // Optional: pdf, docx, etc.
  
  // Determine export mimeType if needed
  let exportMimeType: string | null = null;
  let finalFileName = fileName;
  let finalMimeType = mimeType;
  
  if (isGoogleDoc) {
    // If format specified, use it; otherwise use default
    if (exportFormat) {
      const formats = {
        pdf: 'application/pdf',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        txt: 'text/plain',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        csv: 'text/csv',
        pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        png: 'image/png',
      };
      exportMimeType = formats[exportFormat as keyof typeof formats] || null;
    }
    
    // If no format specified or invalid format, use default
    if (!exportMimeType) {
      exportMimeType = getDefaultExportFormat(mimeType);
    }
    
    if (exportMimeType) {
      finalMimeType = exportMimeType;
      finalFileName = getExportFileExtension(exportMimeType, fileName);
      console.log(`[review/assets/download] Exporting Google Workspace file: ${mimeType} -> ${exportMimeType}, filename: ${fileName} -> ${finalFileName}`);
      logDownload(logContext, `exporting Google Workspace file: ${mimeType} -> ${exportMimeType}`);
    } else {
      return NextResponse.json(
        { error: `Unsupported Google Workspace file type: ${mimeType}. Use ?format=pdf or ?format=docx` },
        { status: 400, headers: { ...NO_STORE, ...EXTRA_HEADERS } }
      );
    }
  }

  try {
    let driveStream: Readable;
    
    if (isGoogleDoc && exportMimeType) {
      // Export Google Workspace file
      driveStream = await exportGoogleWorkspaceFile(drive, assetId, exportMimeType);
    } else {
      // Regular file download
      const res = await drive.files.get(
        { fileId: assetId, alt: 'media', supportsAllDrives: true },
        { responseType: 'stream' }
      );
      driveStream = res.data as unknown as Readable;
    }

    const passThrough = new PassThrough();

    driveStream.pipe(passThrough);

    let streamCompleted = false;
    passThrough.on('end', () => {
      streamCompleted = true;
      if (recordId) {
        setPartnerDownloadedAt(recordId).then((ok) => {
          logContext.completedAtWritten = ok;
          logDownload(logContext, 'completedAt written');
        });
      }
    });

    passThrough.on('error', () => {
      logContext.aborted = true;
      logDownload(logContext, 'stream error');
    });

    passThrough.on('close', () => {
      if (!streamCompleted) {
        logContext.aborted = true;
      }
      logDownload(logContext, 'stream close');
    });

    const webReadable = Readable.toWeb(passThrough) as ReadableStream<Uint8Array>;

    const headers: Record<string, string> = {
      ...NO_STORE,
      ...EXTRA_HEADERS,
      'Content-Type': finalMimeType,
      'Content-Disposition': `attachment; filename="${safeFilename(finalFileName)}"`,
    };

    return new NextResponse(webReadable, {
      status: 200,
      headers,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[review/assets/download] Drive stream/export error:', msg);
    logContext.aborted = true;
    logDownload(logContext, 'setup or drive error');
    const errorMsg = isGoogleDoc 
      ? 'Failed to export Google Workspace file. Ensure the file is accessible and try a different format.'
      : 'Failed to fetch file';
    return NextResponse.json(
      { error: errorMsg },
      { status: 500, headers: { ...NO_STORE, ...EXTRA_HEADERS } }
    );
  }
}
