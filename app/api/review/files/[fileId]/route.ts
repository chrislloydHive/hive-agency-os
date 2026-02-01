// app/api/review/files/[fileId]/route.ts
// Proxies Google Drive file content for the Client Review Portal.
// Requires a valid review token as a query parameter.

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { resolveReviewProject } from '@/lib/review/resolveProject';
import type { Readable } from 'stream';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;
  const token = req.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 401 });
  }

  const resolved = await resolveReviewProject(token);
  if (!resolved) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const { auth } = resolved;
  const drive = google.drive({ version: 'v3', auth });

  const download = req.nextUrl.searchParams.get('dl') === '1';

  // Fetch file metadata for Content-Type (and filename when downloading)
  let mimeType = 'application/octet-stream';
  let fileName = fileId;
  try {
    const meta = await drive.files.get({
      fileId,
      fields: 'mimeType, name',
      supportsAllDrives: true,
    });
    mimeType = meta.data.mimeType || mimeType;
    fileName = meta.data.name || fileName;
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
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
