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
import { resolveReviewProject } from '@/lib/review/resolveProject';
import { getCrasRecordIdByTokenAndFileId } from '@/lib/airtable/reviewAssetStatus';
import { getDriveClient } from '@/lib/google/driveClient';
import {
  isGoogleWorkspaceFile,
  getDefaultExportFormat,
  getExportFileExtension,
  exportGoogleWorkspaceFile,
} from '@/lib/google/driveClient';
import type { Readable } from 'stream';

export const dynamic = 'force-dynamic';

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

async function isFileAuthorized(token: string, fileId: string): Promise<boolean> {
  const key = `${token}::${fileId}`;
  const now = Date.now();
  const cached = authCache.get(key);
  if (cached && cached > now) return true;

  const recordId = await getCrasRecordIdByTokenAndFileId(token, fileId);
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;
  const token = req.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 401 });
  }

  // Basic rate limiting by IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown';
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const resolved = await resolveReviewProject(token);
  if (!resolved) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const { auth } = resolved;
  let drive = google.drive({ version: 'v3', auth });
  let usingFallback = false;

  const download = req.nextUrl.searchParams.get('dl') === '1';

  // Authorize via CRAS record. Cached briefly to absorb thumbnail bursts.
  const authorized = await isFileAuthorized(token, fileId);
  if (!authorized) {
    return NextResponse.json({ error: 'File not found for this review' }, { status: 403 });
  }

  // Fetch Drive metadata. The portal proxy uses per-company OAuth, but the
  // ingest cron uses the service account / WIF identity. Some files (typically
  // those uploaded directly to a shared drive by a partner) are visible to the
  // service account but NOT the per-company OAuth — Drive returns 404 for them.
  // To fix that without breaking files OAuth can see, fall back to the service
  // account when OAuth gets 404. The CRAS auth check above is the real
  // authorization gate, so swapping the Drive identity doesn't relax security.
  let mimeType: string;
  let fileName: string;
  try {
    const fileMeta = await fetchMetaWithFallback();
    if (fileMeta.data.trashed) {
      return NextResponse.json({ error: 'File not available' }, { status: 404 });
    }
    mimeType = fileMeta.data.mimeType || 'application/octet-stream';
    fileName = fileMeta.data.name || fileId;
  } catch (err: any) {
    console.error('[review/files] Drive metadata error:', err?.message ?? err);
    return NextResponse.json({ error: 'File not found or access denied' }, { status: 504 });
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
        `drive.files.get meta fileId=${fileId}`
      );
    } catch (err: any) {
      const code = err?.code ?? err?.response?.status;
      if (code === 404 || code === 403) {
        console.warn(
          `[review/files] OAuth got ${code} for ${fileId}; retrying with service account`
        );
        const oidcToken = process.env.VERCEL_OIDC_TOKEN || undefined;
        const saDrive = await getDriveClient({ vercelOidcToken: oidcToken });
        const meta = await withTimeout(
          saDrive.files.get({
            fileId,
            fields: 'mimeType, name, trashed',
            supportsAllDrives: true,
          }),
          15_000,
          `drive.files.get meta(SA) fileId=${fileId}`
        );
        // Switch the active drive client to the service account so the
        // subsequent body fetch also uses it.
        drive = saDrive;
        usingFallback = true;
        return meta;
      }
      throw err;
    }
  }

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
      console.log(`[review/files] Exporting Google Workspace file: ${mimeType} -> ${exportMimeType}, filename: ${fileName} -> ${finalFileName}`);
    } else {
      return NextResponse.json(
        { error: `Unsupported Google Workspace file type: ${mimeType}. Use ?format=pdf or ?format=docx` },
        { status: 400 }
      );
    }
  }

  // Stream file content directly. Critical:
  //   1) Forward the Range header so video players get partial content.
  //   2) Stream straight through without buffering (no Buffer.concat) so we
  //      don't OOM the serverless function on large videos.
  try {
    if (isGoogleDoc && exportMimeType) {
      // Google Docs export: small enough to buffer, no Range support upstream.
      const stream = await exportGoogleWorkspaceFile(drive, fileId, exportMimeType);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const body = Buffer.concat(chunks);
      const headers: Record<string, string> = {
        'Content-Type': finalMimeType,
        'Cache-Control': 'no-store',
      };
      const ascii = finalFileName.replace(/[^\x20-\x7E]/g, '_');
      headers['Content-Disposition'] =
        `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(finalFileName)}`;
      return new NextResponse(body, { status: 200, headers });
    }

    // Regular Drive file: pass Range through and stream the response body.
    const rangeHeader = req.headers.get('range') ?? undefined;
    const upstream = await drive.files.get(
      { fileId, alt: 'media', supportsAllDrives: true },
      {
        responseType: 'stream',
        headers: rangeHeader ? { Range: rangeHeader } : undefined,
      }
    );

    const upstreamHeaders = upstream.headers as Record<string, string | undefined>;
    const upstreamStatus = (upstream as { status?: number }).status ?? 200;

    const headers: Record<string, string> = {
      'Content-Type': finalMimeType,
      'Cache-Control': 'public, max-age=300',
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range',
    };

    // Forward content length / range from upstream when present.
    if (upstreamHeaders['content-length']) {
      headers['Content-Length'] = upstreamHeaders['content-length'] as string;
    }
    if (upstreamHeaders['content-range']) {
      headers['Content-Range'] = upstreamHeaders['content-range'] as string;
    }

    if (download) {
      const ascii = finalFileName.replace(/[^\x20-\x7E]/g, '_');
      headers['Content-Disposition'] =
        `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(finalFileName)}`;
    }

    // Convert the Node Readable stream to a Web ReadableStream so we can hand
    // it directly to NextResponse without buffering.
    const nodeStream = upstream.data as unknown as Readable;
    const webStream = nodeReadableToWebStream(nodeStream);

    return new Response(webStream, { status: upstreamStatus, headers });
  } catch (err: any) {
    console.error('[review/files] Drive stream/export error:', err?.message ?? err);
    const errorMsg = isGoogleDoc
      ? 'Failed to export Google Workspace file. Ensure the file is accessible and try a different format.'
      : 'Failed to fetch file';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

/* ----------------------------- helpers ----------------------------- */

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`[timeout] ${label} exceeded ${ms}ms`)),
      ms
    );
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}

function nodeReadableToWebStream(node: Readable): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      node.on('data', (chunk: Buffer | string) => {
        controller.enqueue(
          typeof chunk === 'string' ? new TextEncoder().encode(chunk) : new Uint8Array(chunk)
        );
      });
      node.on('end', () => controller.close());
      node.on('error', (err) => controller.error(err));
    },
    cancel() {
      node.destroy();
    },
  });
}
