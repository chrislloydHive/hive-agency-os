// app/api/delivery/test-trigger/route.ts
// GET: Manually trigger pending deliveries (for testing/debugging only)
// No auth required - use only for debugging. Remove or add auth in production.

import { NextRequest, NextResponse } from 'next/server';
import { runPendingDeliveries } from '@/lib/delivery/runPendingDeliveries';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

// Support both GET and POST for flexibility
export async function GET(req: NextRequest) {
  return handleRequest();
}

export async function POST(req: NextRequest) {
  return handleRequest();
}

async function handleRequest() {
  try {
    console.log('[delivery/test-trigger] Manually triggering pending deliveries...');
    const result = await runPendingDeliveries({ oidcToken: undefined });
    
    return NextResponse.json(
      {
        ok: true,
        message: 'Delivery worker triggered',
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
    console.error('[delivery/test-trigger] Error:', message);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500, headers: NO_STORE }
    );
  }
}
