// POST /api/webhooks/mux — Mux Video webhook (configure in Mux dashboard → Webhooks).
// Verifies MUX_WEBHOOK_SIGNING_SECRET (or MUX_WEBHOOK_SECRET) and updates CRAS Mux fields.

import { NextRequest, NextResponse } from 'next/server';
import { processMuxWebhook } from '@/lib/mux/processMuxWebhook';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const headers = new Headers();
  req.headers.forEach((value, key) => {
    headers.set(key, value);
  });

  const result = await processMuxWebhook(rawBody, headers);

  if (!result.handled && result.reason.startsWith('signature:')) {
    return NextResponse.json({ ok: false, error: result.reason }, { status: 401, headers: NO_STORE });
  }

  if (!result.handled && result.reason.includes('not configured')) {
    return NextResponse.json({ ok: false, error: result.reason }, { status: 503, headers: NO_STORE });
  }

  if (!result.handled && result.reason === 'invalid JSON') {
    return NextResponse.json({ ok: false, error: result.reason }, { status: 400, headers: NO_STORE });
  }

  if (!result.handled) {
    return NextResponse.json({ ok: true, ignored: true, reason: result.reason }, { status: 200, headers: NO_STORE });
  }

  return NextResponse.json(
    { ok: true, type: result.type, crasRecordId: result.crasRecordId ?? null },
    { status: 200, headers: NO_STORE },
  );
}
