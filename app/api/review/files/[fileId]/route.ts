// app/api/review/files/[fileId]/route.ts
// Proxies Google Drive file content for the Client Review Portal.
// Requires a valid review token as a query parameter.
//
// Authorization model: a file is servable iff there exists a CRAS (Creative
// Review Asset Status) record for (token, fileId). CRAS is the source of
// truth for which files belong to a review — files can live anywhere in
// Drive (the new ingestion path supports arbitrary subfolders under each
// project's Creative Review Hub folder). A short-TTL in-process cache
// collapses bursts of thumbnail requests for the same review so we don't
// hammer Airtable.

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { Readable } from 'stream';
import { resolveReviewProject } from '@/lib/review/resolveProject';
import { isDriveFileDirectChildOfAllowedReviewFolders } from '@/lib/review/reviewFolders';
import {
  getCrasRecordIdByProjectAndFileId,
  getCrasRecordIdByTokenAndFileId,
} from '@/lib/airtable/reviewAssetStatus';
import { getDriveClientWithServiceAccount } from '@/lib/google/driveClient';
import {
  isGoogleWorkspaceFile,
  getDefaultExportFormat,
  getExportFileExtension,
  exportGoogleWorkspaceFile,
} from '@/lib/google/driveClient';

export const dynamic = 'force-dynamic';
/** Node required: googleapis streams, Readable.toWeb, Drive proxy. */
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

function jsonError(status: number, error: string): NextResponse {
  return NextResponse.json({ error }, { status, headers: NO_STORE });
}

// Basic rate limiting: track requests per IP per minute
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // 100 requests per minute per IP

// Short-TTL cache for CRAS authorization lookups.
// Bursts of thumbnail requests (same token, many fileIds) and repeated requests
// for the same fileId (carousel re-renders, lightbox open/close) all collapse
// here so we don't rate-limit ourselves against Airtable.
const AUTH_CACHE_TTL_MS = 5 * 60_000;
const authCache = new Map<string, number>(); // key = `${token}::${fileId}` → expiresAt

async function isFileAuthorized(
  token: string,
  fileId: string,
  projectRecordId: string,
): Promise<boolean> {
  const key = `${token}::${fileId}`;
  const now = Date.now();
  const cached = authCache.get(key);
  if (cached && cached > now) return true;

  let recordId = await getCrasRecordIdByTokenAndFileId(token, fileId);
  if (!recordId) {
    recordId = await getCrasRecordIdByProjectAndFileId(projectRecordId, fileId);
  }
  if (!recordId) return false;

  authCache.set(key, now + AUTH_CACHE_TTL_MS);
  // Periodic cleanup
  if (authCache.size > 2000) {
    for (const [k, exp] of authCache.entries()) {
      if (exp <= now) authCache.delete(k);
    }
  }
  return true;
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    // Periodic cleanup: remove expired entries
    if (rateLimitMap.size > 1000) {
      for (const [key, val] of rateLimitMap.entries()) {
        if (now > val.resetAt) rateLimitMap.delete(key);
      }
    }
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  entry.count += 1;
  return true;
}

/** Axios/gaxios mixes header casing; normalize lookup. */
function getRespHeader(
  headers: Record<string, unknown> | undefined,
  name: string,
): string | undefined {
  if (!headers) return undefined;
  const want = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() !== want) continue;
    if (v == null) return undefined;
    if (Array.isArray(v)) return v[0] != null ? String(v[0]) : undefined;
    return String(v);
  }
  return undefined;
}

/** Try Drive with the service account when OAuth returns 403/404 or refresh fails (invalid_grant). */
function driveErrorsSuggestServiceAccountFallback(err: unknown): boolean {
  const code =
    err && typeof err === 'object' && 'code' in err
      ? (err as { code?: number }).code
      : (err as { response?: { status?: number } })?.response?.status;
  if (code === 404 || code === 403) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /invalid_grant/i.test(msg);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;
  const token = req.nextUrl.searchParams.get('token');
  const rangeHeader = req.headers.get('range');
  const download = req.nextUrl.searchParams.get('dl') === '1';

  if (!token) {
    return jsonError(401, 'Missing token');
  }

  // Basic rate limiting by IP
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown';
  if (!checkRateLimit(ip)) {
    return jsonError(429, 'Rate limit exceeded');
  }

  const resolved = await resolveReviewProject(token);
  if (!resolved) {
    console.warn('[review/files] token ok: false', { fileId: fileId.slice(0, 12) });
    return jsonError(401, 'Invalid token');
  }
  console.log('[review/files] token ok: true', { fileId: fileId.slice(0, 12) });

  const { project, auth } = resolved;
  let drive = google.drive({ version: 'v3', auth });
  let usingFallback = false;

  // Authorize via CRAS record (preferred). Cached briefly to absorb thumbnail bursts.
  // Fallback: same Drive folder allowlist as review/assets/download when CRAS row is
  // missing (e.g. cross-base Project link prevented CRAS create) — still requires valid token.
  let authorized = await isFileAuthorized(token, fileId, project.recordId);
  let authorizedViaDriveAllowlist = false;
  if (!authorized) {
    try {
      authorizedViaDriveAllowlist = await isDriveFileDirectChildOfAllowedReviewFolders(
        drive,
        project,
        fileId,
      );
      if (authorizedViaDriveAllowlist) {
        authorized = true;
        console.log('[review/files] authorized via Drive allowlist (CRAS miss)', {
          fileId: fileId.slice(0, 12),
        });
      }
    } catch (allowErr: unknown) {
      const m = allowErr instanceof Error ? allowErr.message : String(allowErr);
      console.warn('[review/files] Drive allowlist check failed:', m);
    }
  }
  console.log('[review/files] authorized', authorized, 'viaDriveAllowlist', authorizedViaDriveAllowlist, {
    fileId: fileId.slice(0, 12),
  });
  if (!authorized) {
    return jsonError(403, 'File not found for this review');
  }

  // Fetch Drive metadata. The portal proxy uses per-company OAuth, but the
  // ingest cron uses the service account / WIF identity. Some files (typically
  // those uploaded directly to a shared drive by a partner) are visible to the
  // service account but NOT the per-company OAuth — Drive returns 404 for them.
  // To fix that without breaking files OAuth can see, fall back to the service
  // account when OAuth gets 403/404 or invalid_grant. CRAS auth above is the gate.
  let mimeType: string;
  let fileName: string;
  try {
    const fileMeta = await fetchMetaWithFallback();
    if (fileMeta.data.trashed) {
      return jsonError(404, 'File not available');
    }
    mimeType = fileMeta.data.mimeType || 'application/octet-stream';
    fileName = fileMeta.data.name || fileId;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[review/files] Drive metadata error:', msg);
    return jsonError(504, 'File not found or access denied');
  }

  async function fetchMetaWithFallback() {
    try {
      return await withTimeout(
        drive.files.get({
          fileId,
          fields: 'mimeType, name, trashed',
          supportsAllDrives: true,
        }),
        15_000,
        `drive.files.get meta fileId=${fileId}`,
      );
    } catch (err: unknown) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? (err as { code?: number }).code
          : (err as { response?: { status?: number } })?.response?.status;
      if (driveErrorsSuggestServiceAccountFallback(err)) {
        console.warn(
          `[review/files] OAuth Drive metadata failed (${String(code ?? 'n/a')}) for ${fileId}; retrying with service account`,
        );
        const saDrive = getDriveClientWithServiceAccount();
        const meta = await withTimeout(
          saDrive.files.get({
            fileId,
            fields: 'mimeType, name, trashed',
            supportsAllDrives: true,
          }),
          15_000,
          `drive.files.get meta(SA) fileId=${fileId}`,
        );
        drive = saDrive;
        usingFallback = true;
        return meta;
      }
      throw err;
    }
  }

  console.log('[review/files] mimeType', mimeType, 'fileName', fileName, '[review/files] usingFallback', usingFallback);

  // Check if this is a Google Workspace file that needs export
  const isGoogleDoc = isGoogleWorkspaceFile(mimeType);
  const exportFormat = req.nextUrl.searchParams.get('format')?.trim() || null;

  // Determine export mimeType if needed
  let exportMimeType: string | null = null;
  let finalFileName = fileName;
  let finalMimeType = mimeType;

  if (isGoogleDoc) {
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

    if (!exportMimeType) {
      exportMimeType = getDefaultExportFormat(mimeType);
    }

    if (exportMimeType) {
      finalMimeType = exportMimeType;
      finalFileName = getExportFileExtension(exportMimeType, fileName);
      console.log(
        `[review/files] Exporting Google Workspace file: ${mimeType} -> ${exportMimeType}, filename: ${fileName} -> ${finalFileName}`,
      );
    } else {
      return jsonError(
        400,
        `Unsupported Google Workspace file type: ${mimeType}. Use ?format=pdf or ?format=docx`,
      );
    }
  }

  const asciiName = finalFileName.replace(/[^\x20-\x7E]/g, '_');

  try {
    if (isGoogleDoc && exportMimeType) {
      // Google Docs export: stream (no Range support upstream). Inline unless dl=1.
      const stream = await exportGoogleWorkspaceFile(drive, fileId, exportMimeType);
      const webStream = Readable.toWeb(stream) as ReadableStream<Uint8Array>;
      const headers: Record<string, string> = {
        'Content-Type': finalMimeType,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Range',
      };
      if (download) {
        headers['Content-Disposition'] =
          `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(finalFileName)}`;
      } else {
        headers['Content-Disposition'] =
          `inline; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(finalFileName)}`;
      }
      console.log('[review/files] upstream status', 200, '[review/files] final status', 200, '[review/files] range header', rangeHeader ?? '(none)');
      return new NextResponse(webStream, { status: 200, headers });
    }

    // Regular binary: forward Range to Drive, stream body, preserve 206 + Content-Range for media.
    const streamOpts = {
      responseType: 'stream' as const,
      validateStatus: (): boolean => true,
      ...(rangeHeader ? { headers: { Range: rangeHeader } } : {}),
    };

    let mediaRes;
    let upstreamStatus: number;
    try {
      mediaRes = await withTimeout(
        drive.files.get({ fileId, alt: 'media', supportsAllDrives: true }, streamOpts),
        120_000,
        `drive.files.get media fileId=${fileId}`,
      );
      upstreamStatus = mediaRes.status;
    } catch (err: unknown) {
      if (!usingFallback && driveErrorsSuggestServiceAccountFallback(err)) {
        console.warn(
          `[review/files] OAuth media GET threw for ${fileId}; retrying with service account`,
        );
        const saDrive = getDriveClientWithServiceAccount();
        drive = saDrive;
        usingFallback = true;
        mediaRes = await withTimeout(
          saDrive.files.get({ fileId, alt: 'media', supportsAllDrives: true }, streamOpts),
          120_000,
          `drive.files.get media(SA) fileId=${fileId}`,
        );
        upstreamStatus = mediaRes.status;
      } else {
        throw err;
      }
    }

    console.log('[review/files] upstream status (first)', upstreamStatus, '[review/files] range header', rangeHeader ?? '(none)');

    if (
      !usingFallback &&
      (upstreamStatus === 404 || upstreamStatus === 403)
    ) {
      destroyIfStream(mediaRes.data);
      console.warn(
        `[review/files] body fetch returned HTTP ${upstreamStatus} for ${fileId}; retrying body with service account`,
      );
      try {
        const saDrive = getDriveClientWithServiceAccount();
        drive = saDrive;
        mediaRes = await withTimeout(
          saDrive.files.get({ fileId, alt: 'media', supportsAllDrives: true }, streamOpts),
          120_000,
          `drive.files.get media(SA) fileId=${fileId}`,
        );
        upstreamStatus = mediaRes.status;
        usingFallback = true;
        console.log('[review/files] usingFallback', true, '[review/files] upstream status (SA)', upstreamStatus);
      } catch (saErr: unknown) {
        const m = saErr instanceof Error ? saErr.message : String(saErr);
        console.error('[review/files] service account body fetch threw:', m);
      }
    }

    if (upstreamStatus === 416) {
      const raw416 = mediaRes.headers as Record<string, unknown>;
      const cr = getRespHeader(raw416, 'content-range');
      destroyIfStream(mediaRes.data);
      console.warn('[review/files] upstream status 416 Range Not Satisfiable', { fileId: fileId.slice(0, 12) });
      return new NextResponse(null, {
        status: 416,
        headers: {
          ...NO_STORE,
          ...(cr ? { 'Content-Range': cr } : {}),
        },
      });
    }

    if (upstreamStatus !== 200 && upstreamStatus !== 206) {
      destroyIfStream(mediaRes.data);
      console.error(
        `[review/files] giving up; final upstream status ${upstreamStatus} for ${fileId}`,
      );
      return jsonError(upstreamStatus === 404 ? 404 : 502, 'File not accessible');
    }

    const rawHeaders = mediaRes.headers as Record<string, unknown>;
    const upstreamLen = getRespHeader(rawHeaders, 'content-length');
    const upstreamRange = getRespHeader(rawHeaders, 'content-range');
    const upstreamAcceptRanges = getRespHeader(rawHeaders, 'accept-ranges');

    const stream = mediaRes.data as Readable;
    const webStream = Readable.toWeb(stream) as ReadableStream<Uint8Array>;

    const headers: Record<string, string> = {
      'Content-Type': finalMimeType,
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range',
      'X-Content-Type-Options': 'nosniff',
    };

    if (upstreamLen) {
      headers['Content-Length'] = upstreamLen;
    }
    if (upstreamRange) {
      headers['Content-Range'] = upstreamRange;
    }
    headers['Accept-Ranges'] = upstreamAcceptRanges || 'bytes';

    if (download) {
      headers['Content-Disposition'] =
        `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(finalFileName)}`;
    } else {
      headers['Content-Disposition'] =
        `inline; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(finalFileName)}`;
    }

    const finalStatus = upstreamStatus === 206 ? 206 : 200;
    console.log(
      '[review/files] final status',
      finalStatus,
      'mimeType',
      finalMimeType,
      '[review/files] usingFallback',
      usingFallback,
      'contentLength',
      upstreamLen ?? '(chunked/unknown)',
      'contentRange',
      upstreamRange ?? '(none)',
    );

    return new NextResponse(webStream, { status: finalStatus, headers });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[review/files] Drive stream/export error:', msg);
    const errorMsg = isGoogleDoc
      ? 'Failed to export Google Workspace file. Ensure the file is accessible and try a different format.'
      : 'Failed to fetch file';
    return jsonError(500, errorMsg);
  }
}

/* ----------------------------- helpers ----------------------------- */

function destroyIfStream(data: unknown): void {
  if (data && typeof (data as Readable).destroy === 'function') {
    try {
      (data as Readable).destroy();
    } catch {
      /* ignore */
    }
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`[timeout] ${label} exceeded ${ms}ms`)),
      ms,
    );
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}
