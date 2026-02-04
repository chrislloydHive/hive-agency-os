// app/api/review/assets/deliver/route.ts
// POST: Copy one asset to a Partner Delivery folder (for Airtable automation).
// Input: recordId, fileId, destinationFolderId, batchId? (optional), token? (optional).
// If batchId is provided, ensures a child folder with that name exists under destinationFolderId
// and copies the file there; otherwise copies directly into destinationFolderId.
// Auth: optional REVIEW_DELIVERY_SECRET header (x-delivery-secret or Authorization: Bearer <secret>).

import { NextRequest, NextResponse } from 'next/server';
import { getDriveClient, copyFileToFolder, ensureChildFolder } from '@/lib/google/driveClient';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

function getDeliverySecret(req: NextRequest): string | null {
  const header = req.headers.get('x-delivery-secret') ?? req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  return header?.trim() || null;
}

export async function POST(req: NextRequest) {
  const secret = process.env.REVIEW_DELIVERY_SECRET;
  if (secret && getDeliverySecret(req) !== secret) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  }

  let body: {
    token?: string;
    recordId?: string;
    fileId?: string;
    destinationFolderId?: string;
    batchId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400, headers: NO_STORE });
  }

  const fileId = (body.fileId ?? '').toString().trim();
  const destinationFolderId = (body.destinationFolderId ?? '').toString().trim();
  const batchId = (body.batchId ?? '').toString().trim();

  if (!fileId) {
    return NextResponse.json({ ok: false, error: 'Missing fileId' }, { status: 400, headers: NO_STORE });
  }
  if (!destinationFolderId) {
    return NextResponse.json({ ok: false, error: 'Missing destinationFolderId' }, { status: 400, headers: NO_STORE });
  }

  try {
    const targetFolderId = batchId
      ? (await ensureChildFolder(destinationFolderId, batchId)).id
      : destinationFolderId;

    const result = await copyFileToFolder(fileId, targetFolderId);

    return NextResponse.json(
      {
        ok: true,
        deliveredFileId: result.id,
        deliveredFileUrl: result.url,
      },
      { headers: NO_STORE }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[review/assets/deliver] Error:', message);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500, headers: NO_STORE }
    );
  }
}
