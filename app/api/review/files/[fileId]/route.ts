// app/api/review/files/[fileId]/route.ts
// Proxies Google Drive file content for the Client Review Portal.
// Requires a valid review token as a query parameter.
// Validates that the file's parent is one of the project's variant folders (Drive traversal: job → tactic → variant).

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { resolveReviewProject } from '@/lib/review/resolveProject';
import { getAllowedReviewFolderIds, getAllowedReviewFolderIdsFromJobFolder, getAllowedReviewFolderIdsFromClientProjectsFolder } from '@/lib/review/reviewFolders';
import type { Readable } from 'stream';

export const dynamic = 'force-dynamic';

// Basic rate limiting: track requests per IP per minute
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // 100 requests per minute per IP

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

  const { project, auth } = resolved;
  const drive = google.drive({ version: 'v3', auth });

  const download = req.nextUrl.searchParams.get('dl') === '1';

  const allowedFolderIds = project.jobFolderId
    ? await getAllowedReviewFolderIdsFromJobFolder(drive, project.jobFolderId)
    : await (async () => {
        const clientProjectsFolderId = process.env.CAR_TOYS_PROJECTS_FOLDER_ID ?? '1NLCt-piSxfAFeeINuFyzb3Pxp-kKXTw_';
        if (clientProjectsFolderId) {
          const fromClient = await getAllowedReviewFolderIdsFromClientProjectsFolder(drive, project.name, clientProjectsFolderId);
          if (fromClient?.length) return fromClient;
        }
        const rootFolderId = process.env.CAR_TOYS_PRODUCTION_ASSETS_FOLDER_ID;
        if (!rootFolderId) return null;
        return getAllowedReviewFolderIds(drive, project.hubName, rootFolderId);
      })();

  if (!allowedFolderIds || allowedFolderIds.length === 0) {
    return NextResponse.json({ error: 'No review folders configured' }, { status: 403 });
  }

  // Validate that fileId's parent is one of the allowed variant folders
  try {
    const fileMeta = await drive.files.get({
      fileId,
      fields: 'parents, mimeType, name',
      supportsAllDrives: true,
    });

    const parents = fileMeta.data.parents || [];
    const isAllowed = parents.some((parentId) => allowedFolderIds.includes(parentId));

    if (!isAllowed) {
      return NextResponse.json({ error: 'File not in allowed folders' }, { status: 403 });
    }

    var mimeType = fileMeta.data.mimeType || 'application/octet-stream';
    var fileName = fileMeta.data.name || fileId;
  } catch (err: any) {
    console.error('[review/files] Validation error:', err?.message ?? err);
    return NextResponse.json({ error: 'File not found or access denied' }, { status: 404 });
  }

  // Stream file content
  try {
    const res = await drive.files.get(
      { fileId, alt: 'media', supportsAllDrives: true },
      { responseType: 'stream' },
    );

    const stream = res.data as unknown as Readable;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const body = Buffer.concat(chunks);

    const headers: Record<string, string> = {
      'Content-Type': mimeType,
      'Cache-Control': 'public, max-age=300',
    };

    if (download) {
      // RFC 6266 — ASCII-safe filename + UTF-8 fallback
      const ascii = fileName.replace(/[^\x20-\x7E]/g, '_');
      headers['Content-Disposition'] =
        `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
    }

    return new NextResponse(body, { status: 200, headers });
  } catch (err: any) {
    console.error('[review/files] Drive stream error:', err?.message ?? err);
    return NextResponse.json({ error: 'Failed to fetch file' }, { status: 500 });
  }
}
