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
  const drive = google.drive({ version: 'v3', auth });

  const download = req.nextUrl.searchParams.get('dl') === '1';

  // Authorize via CRAS record. Cached briefly to absorb thumbnail bursts.
  const authorized = await isFileAuthorized(token, fileId);
  if (!authorized) {
    return NextResponse.json({ error: 'File not found for this review' }, { status: 403 });
  }

  // Fetch Drive metadata; reject trashed files so stale CRAS rows can't leak content.
  let mimeType: string;
  let fileName: string;
  try {
    const fileMeta = await drive.files.get({
      fileId,
      fields: 'mimeType, name, trashed',
      supportsAllDrives: true,
    });

    if (fileMeta.data.trashed) {
      return NextResponse.json({ error: 'File not available' }, { status: 404 });
    }

    mimeType = fileMeta.data.mimeType || 'application/octet-stream';
    fileName = fileMeta.data.name || fileId;
  } catch (err: any) {
    console.error('[review/files] Drive metadata error:', err?.message ?? err);
    return NextResponse.json({ error: 'File not found or access denied' }, { status: 404 });
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

  // Stream file content (export for Google Docs, direct download for regular files)
  try {
    let stream: Readable;

    if (isGoogleDoc && exportMimeType) {
      stream = await exportGoogleWorkspaceFile(drive, fileId, exportMimeType);
    } else {
      const res = await drive.files.get(
        { fileId, alt: 'media', supportsAllDrives: true },
        { responseType: 'stream' },
      );
      stream = res.data as unknown as Readable;
    }

    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const body = Buffer.concat(chunks);

    const headers: Record<string, string> = {
      'Content-Type': finalMimeType,
      'Cache-Control': 'public, max-age=300',
    };

    // Add CORS headers for video files to allow VideoWithThumbnail component to load them
    if (finalMimeType.startsWith('video/') || fileName.toLowerCase().endsWith('.mp4') || fileName.toLowerCase().endsWith('.mov') || fileName.toLowerCase().endsWith('.webm')) {
      headers['Access-Control-Allow-Origin'] = '*';
      headers['Access-Control-Allow-Methods'] = 'GET, HEAD, OPTIONS';
      headers['Access-Control-Allow-Headers'] = 'Range';
      headers['Accept-Ranges'] = 'bytes';
    }

    if (download || isGoogleDoc) {
      const ascii = finalFileName.replace(/[^\x20-\x7E]/g, '_');
      headers['Content-Disposition'] =
        `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(finalFileName)}`;
    }

    return new NextResponse(body, { status: 200, headers });
  } catch (err: any) {
    console.error('[review/files] Drive stream/export error:', err?.message ?? err);
    const errorMsg = isGoogleDoc
      ? 'Failed to export Google Workspace file. Ensure the file is accessible and try a different format.'
      : 'Failed to fetch file';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
