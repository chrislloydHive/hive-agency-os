// app/api/partner-delivery/diag/route.ts
// POST: Diagnostic — confirm service account can see a Shared Drive folder. Debug only.
// Auth: X-Hive-Secret must match HIVE_INBOUND_SECRET or HIVE_INBOUND_EMAIL_SECRET.

import { NextRequest, NextResponse } from 'next/server';
import { getDriveClient } from '@/src/lib/google/drive';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;
const SECRET_HEADER = 'x-hive-secret';

function getExpectedSecret(): string {
  return (
    process.env.HIVE_INBOUND_SECRET?.trim() ||
    process.env.HIVE_INBOUND_EMAIL_SECRET?.trim() ||
    ''
  );
}

export async function GET() {
  return NextResponse.json(
    { ok: false, error: 'Use POST with body: { "folderId": "DriveFolderId" }' },
    { status: 405, headers: NO_STORE }
  );
}

export async function POST(req: NextRequest) {
  const expectedSecret = getExpectedSecret();
  const headerSecret = req.headers.get(SECRET_HEADER)?.trim();

  if (!expectedSecret || headerSecret !== expectedSecret) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  }

  let body: { folderId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400, headers: NO_STORE });
  }

  const folderId = (body.folderId ?? '').toString().trim();
  if (!folderId) {
    return NextResponse.json(
      { ok: false, error: 'folderId is required' },
      { status: 400, headers: NO_STORE }
    );
  }

  try {
    const drive = getDriveClient();
    const res = await drive.files.get({
      fileId: folderId,
      fields: 'id,name,mimeType,driveId,parents',
      supportsAllDrives: true,
    });
    return NextResponse.json(
      {
        ok: true,
        id: res.data.id,
        name: res.data.name,
        mimeType: res.data.mimeType,
        driveId: res.data.driveId,
        parents: res.data.parents,
      },
      { headers: NO_STORE }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const code =
      (typeof err === 'object' && err !== null && 'code' in err ? (err as { code: number }).code : undefined) ??
      (typeof err === 'object' && err !== null && 'response' in err
        ? (err as { response?: { status?: number } }).response?.status
        : undefined);
    const is403 = code === 403 || message.includes('403');
    if (is403) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Service account cannot access this folder. Add it as a member of the Shared Drive or share the folder directly.',
        },
        { status: 403, headers: NO_STORE }
      );
    }
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500, headers: NO_STORE }
    );
  }
}
