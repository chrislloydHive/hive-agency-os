// app/api/partner-delivery/copy/route.ts
// POST: Copy Drive files into a partner folder (Shared Drive safe). Called by Airtable.
// Auth: X-Hive-Secret must match HIVE_INBOUND_SECRET or HIVE_INBOUND_EMAIL_SECRET.

import { NextRequest, NextResponse } from 'next/server';
import { getDriveClient } from '@/src/lib/google/drive';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;
const SECRET_HEADER = 'x-hive-secret';

function getRequestId(): string {
  return `partner-copy-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function getExpectedSecret(): string {
  return (
    process.env.HIVE_INBOUND_SECRET?.trim() ||
    process.env.HIVE_INBOUND_EMAIL_SECRET?.trim() ||
    ''
  );
}

export async function GET() {
  return NextResponse.json(
    { ok: false, error: 'Method not allowed. Use POST.' },
    { status: 405, headers: NO_STORE }
  );
}

export async function POST(req: NextRequest) {
  const requestId = getRequestId();
  const expectedSecret = getExpectedSecret();
  const headerSecret = req.headers.get(SECRET_HEADER)?.trim();

  if (!expectedSecret || headerSecret !== expectedSecret) {
    console.warn(`[partner-delivery/copy] ${requestId} Unauthorized: missing or invalid ${SECRET_HEADER}`);
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  }

  let body: {
    batchId?: string;
    partnerId?: string;
    destinationFolderId?: string;
    sourceFileIds?: string[];
    renamePrefix?: string;
  };
  try {
    body = await req.json();
  } catch {
    console.warn(`[partner-delivery/copy] ${requestId} Invalid JSON`);
    return NextResponse.json(
      { ok: false, error: 'Invalid JSON', requestId },
      { status: 400, headers: NO_STORE }
    );
  }

  const destinationFolderId = (body.destinationFolderId ?? '').toString().trim();
  const sourceFileIds = Array.isArray(body.sourceFileIds)
    ? (body.sourceFileIds as string[]).map((id) => String(id).trim()).filter(Boolean)
    : [];
  const renamePrefix = body.renamePrefix != null ? String(body.renamePrefix) : '';

  if (!destinationFolderId) {
    console.warn(`[partner-delivery/copy] ${requestId} Validation failed: destinationFolderId required`);
    return NextResponse.json(
      { ok: false, error: 'destinationFolderId is required', requestId },
      { status: 400, headers: NO_STORE }
    );
  }
  if (sourceFileIds.length === 0) {
    console.warn(`[partner-delivery/copy] ${requestId} Validation failed: sourceFileIds must be non-empty`);
    return NextResponse.json(
      { ok: false, error: 'sourceFileIds must be a non-empty array', requestId },
      { status: 400, headers: NO_STORE }
    );
  }

  const batchId = body.batchId != null ? String(body.batchId) : '';
  const partnerId = body.partnerId != null ? String(body.partnerId) : '';

  console.log(
    JSON.stringify({
      requestId,
      batchId,
      partnerId,
      destinationFolderId,
      sourceFileCount: sourceFileIds.length,
    })
  );

  const copied: { sourceFileId: string; newFileId: string; newName: string }[] = [];
  const failed: { sourceFileId: string; error: string }[] = [];

  try {
    const drive = getDriveClient();

    for (const sourceFileId of sourceFileIds) {
      try {
        const getRes = await drive.files.get({
          fileId: sourceFileId,
          fields: 'name,mimeType',
          supportsAllDrives: true,
        });
        const originalName = getRes.data.name ?? 'Copy';
        const newName = `${renamePrefix}${originalName}`;

        const copyRes = await drive.files.copy({
          fileId: sourceFileId,
          supportsAllDrives: true,
          fields: 'id,name',
          requestBody: {
            name: newName,
            parents: [destinationFolderId],
          },
        });

        const newFileId = copyRes.data.id ?? '';
        const copiedName = copyRes.data.name ?? newName;
        copied.push({ sourceFileId, newFileId, newName: copiedName });
        console.log(
          JSON.stringify({
            requestId,
            sourceFileId,
            newFileId,
            newName: copiedName,
            result: 'copied',
          })
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        failed.push({ sourceFileId, error: message });
        console.warn(
          JSON.stringify({
            requestId,
            sourceFileId,
            result: 'failed',
            error: message,
          })
        );
      }
    }

    return NextResponse.json(
      {
        ok: true,
        batchId,
        partnerId,
        destinationFolderId,
        copied,
        failed,
      },
      { headers: NO_STORE }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[partner-delivery/copy] ${requestId} Error:`, message);
    return NextResponse.json(
      { ok: false, error: 'Copy failed', requestId, details: message },
      { status: 500, headers: NO_STORE }
    );
  }
}
