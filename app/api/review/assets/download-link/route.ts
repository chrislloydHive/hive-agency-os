// app/api/review/assets/download-link/route.ts
// POST: Return a short-lived signed URL for GET /api/review/assets/download.
// Auth: token in body (same as deliver-batch). Asset must be approved and visible to that partner.
// URL contains dlId, exp, sig only (no token). Session stored server-side (Upstash or in-memory fallback).

import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { resolveReviewProject } from '@/lib/review/resolveProject';
import { listAssetStatuses } from '@/lib/airtable/reviewAssetStatus';
import { signDownloadPayload, isDownloadSigningConfigured } from '@/lib/review/downloadSignature';
import { setDownloadSession } from '@/lib/review/downloadSessionStore';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;
const DOWNLOAD_TTL_SEC = 5 * 60; // 5 minutes

function keyFrom(token: string, fileId: string): string {
  return `${token}::${fileId}`;
}

export async function POST(req: NextRequest) {
  let body: { token?: string; assetId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400, headers: NO_STORE });
  }

  const token = (body.token ?? '').toString().trim();
  const assetId = (body.assetId ?? '').toString().trim();

  if (!token) {
    return NextResponse.json({ ok: false, error: 'Missing token' }, { status: 400, headers: NO_STORE });
  }
  if (!assetId) {
    return NextResponse.json({ ok: false, error: 'Missing assetId' }, { status: 400, headers: NO_STORE });
  }

  if (!isDownloadSigningConfigured()) {
    return NextResponse.json(
      { ok: false, error: 'Download signing not configured' },
      { status: 503, headers: NO_STORE }
    );
  }

  const resolved = await resolveReviewProject(token);
  if (!resolved) {
    return NextResponse.json({ ok: false, error: 'Invalid or expired token' }, { status: 401, headers: NO_STORE });
  }

  const statusMap = await listAssetStatuses(token);
  const key = keyFrom(token, assetId);
  const record = statusMap.get(key);
  if (!record) {
    return NextResponse.json(
      { ok: false, error: 'Asset not found or not visible' },
      { status: 403, headers: NO_STORE }
    );
  }
  if (!record.assetApprovedClient) {
    return NextResponse.json(
      { ok: false, error: 'Asset is not approved for download' },
      { status: 403, headers: NO_STORE }
    );
  }

  const exp = Math.floor(Date.now() / 1000) + DOWNLOAD_TTL_SEC;
  const dlId = randomBytes(16).toString('hex');
  const stored = await setDownloadSession(dlId, { token, assetId, exp }, DOWNLOAD_TTL_SEC);
  if (!stored) {
    return NextResponse.json(
      { ok: false, error: 'Failed to create download session' },
      { status: 503, headers: NO_STORE }
    );
  }

  const sig = signDownloadPayload(dlId, exp);
  if (!sig) {
    return NextResponse.json(
      { ok: false, error: 'Signing failed' },
      { status: 500, headers: NO_STORE }
    );
  }

  const origin = req.nextUrl.origin;
  const params = new URLSearchParams({
    dlId,
    exp: String(exp),
    sig,
  });
  const url = `${origin}/api/review/assets/download?${params.toString()}`;

  return NextResponse.json({ ok: true, url }, { headers: NO_STORE });
}
