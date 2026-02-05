// app/api/partner-delivery/diag/route.ts
// POST: Diagnostic — confirm WIF/impersonated SA can see a Shared Drive folder. Debug only.
// Auth: X-Hive-Secret must match HIVE_INBOUND_SECRET or HIVE_INBOUND_EMAIL_SECRET.

import { NextRequest, NextResponse } from 'next/server';
import { getDriveClient, getAuthModeSummary } from '@/lib/google/driveWif';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;
const SECRET_HEADER = 'x-hive-secret';
const WIF_NOT_CONFIGURED_MSG =
  'Google ADC/WIF not configured on Vercel. See docs/vercel-gcp-wif-setup.md';
const FOLDER_ACCESS_MSG =
  'Service account cannot access this folder/Shared Drive. Add hive-os-drive@hive-os-479319.iam.gserviceaccount.com as a MEMBER of the Shared Drive (Content manager).';

function getRequestId(): string {
  return `diag-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
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
    console.warn(`[partner-delivery/diag] ${requestId} Unauthorized: missing or invalid ${SECRET_HEADER}`);
    return NextResponse.json(
      { ok: false, error: 'Unauthorized', requestId },
      { status: 401, headers: NO_STORE }
    );
  }

  let body: { folderId?: string };
  try {
    body = await req.json();
  } catch {
    console.warn(`[partner-delivery/diag] ${requestId} Invalid JSON`);
    return NextResponse.json(
      { ok: false, error: 'Invalid JSON', requestId },
      { status: 400, headers: NO_STORE }
    );
  }

  const folderId = (body.folderId ?? '').toString().trim();
  if (!folderId) {
    return NextResponse.json(
      { ok: false, error: 'folderId is required', requestId },
      { status: 400, headers: NO_STORE }
    );
  }

  let drive: Awaited<ReturnType<typeof getDriveClient>>;
  try {
    drive = await getDriveClient();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[partner-delivery/diag] ${requestId} Google auth failed:`, message);
    return NextResponse.json(
      { ok: false, error: WIF_NOT_CONFIGURED_MSG, requestId },
      { status: 401, headers: NO_STORE }
    );
  }

  try {
    const res = await drive.files.get({
      fileId: folderId,
      fields: 'id,name,mimeType,driveId,parents',
      supportsAllDrives: true,
    });
    const folder = {
      id: res.data.id,
      name: res.data.name,
      mimeType: res.data.mimeType,
      driveId: res.data.driveId,
      parents: res.data.parents,
    };
    console.log(
      JSON.stringify({
        requestId,
        folderId,
        ok: true,
        auth: getAuthModeSummary(),
      })
    );
    return NextResponse.json(
      {
        ok: true,
        folder,
        auth: getAuthModeSummary(),
        requestId,
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
    const is403404 = code === 403 || code === 404 || message.includes('403') || message.includes('404');
    if (is403404) {
      console.warn(`[partner-delivery/diag] ${requestId} Folder access denied (${code ?? 'error'}):`, message);
      return NextResponse.json(
        { ok: false, error: FOLDER_ACCESS_MSG, requestId },
        { status: 403, headers: NO_STORE }
      );
    }
    console.error(`[partner-delivery/diag] ${requestId} Error:`, message);
    return NextResponse.json(
      { ok: false, error: message, requestId },
      { status: 500, headers: NO_STORE }
    );
  }
}
