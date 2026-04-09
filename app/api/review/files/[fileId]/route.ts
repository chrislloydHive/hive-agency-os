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
import type { drive_v3 } from 'googleapis';
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
    return jsonError(401, 'Missing token');
  }

  // Basic rate limiting by IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown';
  if (!checkRateLimit(ip)) {
    return jsonError(429, 'Rate limit exceeded');
  }

  console.log(`[review/files] v=sa-only fileId=${fileId}`);

  // Validate the token. We only need this to confirm the review session
  // exists; we no longer use the per-company OAuth client because it has
  // narrower Drive visibility than the service account that ingests files.
  const resolved = await resolveReviewProject(token);
  if (!resolved) {
    return jsonError(401, 'Invalid token');
  }

  // Authorize via CRAS record. This IS the authorization gate — Drive identity
  // below only controls which credentials Google uses to look up the file.
  const authorized = await isFileAuthorized(token, fileId);
  if (!authorized) {
    return jsonError(403, 'File not found for this review');
  }

  // Build a service-account / WIF Drive client. This is the SAME identity the
  // ingest cron uses, so anything that exists as a CRAS row is reachable.
  // Eliminates the OAuth-vs-SA visibility mismatch that was producing 404s on
  // partner-uploaded files (videos, .mov, etc.) which the per-company OAuth
  // user couldn't see.
  let drive: drive_v3.Drive;
  try {
    // Vercel OIDC token comes from the per-request header, not env. Fall back
    // to env for local dev where the header isn't injected.
    const oidcToken =
      req.headers.get('x-vercel-oidc-token')?.trim() ||
      process.env.VERCEL_OIDC_TOKEN ||
      undefined;
    drive = await getDriveClient({ vercelOidcToken: oidcToken });
  } catch (err: any) {
    console.error('[review/files] failed to build SA drive client:', err?.message ?? err);
    return jsonError(500, 'Drive client unavailable');
  }

  const download = req.nextUrl.searchParams.get('dl') === '1';

  // Fetch Drive metadata; reject trashed files so stale CRAS rows can't leak content.
  let mimeType: string;
  let fileName: string;
  try {
    const fileMeta: { data: drive_v3.Schema$File } = await withTimeout(
      drive.files.get({
        fileId,
        fields: 'mimeType, name, trashed',
        supportsAllDrives: true,
      }),
      15_000,
      `drive.files.get meta fileId=${fileId}`
    );

    if (fileMeta.data.trashed) {
      return jsonError(404, 'File not available');
    }
    mimeType = fileMeta.data.mimeType || 'application/octet-stream';
    fileName = fileMeta.data.name || fileId;
    console.log(`[review/files] meta ok fileId=${fileId} mime=${mimeType}`);
  } catch (err: any) {
    const code = err?.code ?? err?.response?.status;
    console.error(
      `[review/files] SA metadata fetch failed code=${code} fileId=${fileId} msg=${err?.message ?? err}`
    );
    return jsonError(code === 404 ? 404 : 502, 'File not accessible');
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
      return jsonError(400, `Unsupported Google Workspace file type: ${mimeType}. Use ?format=pdf or ?format=docx`);
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
        validateStatus: () => true,
      } as any
    );

    const upstreamStatus = (upstream as { status?: number }).status ?? 200;
    console.log(
      `[review/files] body fetch status=${upstreamStatus} fileId=${fileId} range=${rangeHeader ?? 'none'}`
    );

    if (upstreamStatus >= 400) {
      return jsonError(upstreamStatus === 404 ? 404 : 502, 'File not accessible');
    }

    const upstreamHeaders = upstream.headers as Record<string, string | undefined>;

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
    return jsonError(500, errorMsg);
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
