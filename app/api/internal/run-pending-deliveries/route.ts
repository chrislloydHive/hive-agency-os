// app/api/internal/run-pending-deliveries/route.ts
// POST: Run pending partner deliveries (CRAS records where Ready to Deliver (Webhook) = true).
// Replaces Airtable automations that called fetch() — Airtable now only sets flags; this endpoint runs delivery.
// Auth: x-run-pending-deliveries-secret or Authorization: Bearer <secret> must match RUN_PENDING_DELIVERIES_SECRET.
// Call from Vercel Cron, Inngest, or any scheduler. Idempotent; safe to re-run.

import { NextRequest, NextResponse } from 'next/server';
import { runPendingDeliveries } from '@/lib/delivery/runPendingDeliveries';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;
const SECRET_HEADER = 'x-run-pending-deliveries-secret';

function getSecret(req: NextRequest): string | null {
  const header = req.headers.get(SECRET_HEADER)?.trim();
  if (header) return header;
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  return bearer || null;
}

export async function POST(req: NextRequest) {
  const secret = process.env.RUN_PENDING_DELIVERIES_SECRET?.trim();
  const provided = getSecret(req);

  if (!secret || provided !== secret) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized' },
      { status: 401, headers: NO_STORE }
    );
  }

  const oidcToken = req.headers.get('x-vercel-oidc-token')?.trim() || undefined;

  try {
    const result = await runPendingDeliveries({ oidcToken });
    return NextResponse.json(
      {
        ok: true,
        processed: result.processed,
        succeeded: result.succeeded,
        failed: result.failed,
        skipped: result.skipped,
        results: result.results,
      },
      { headers: NO_STORE }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[run-pending-deliveries]', message);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500, headers: NO_STORE }
    );
  }
}
