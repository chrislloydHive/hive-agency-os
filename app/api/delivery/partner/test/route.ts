// app/api/delivery/partner/test/route.ts
// POST: Internal test harness for partner delivery. Uses env vars for record + batch.
// Requires X-DELIVERY-SECRET. Defaults to dryRun=true unless DELIVERY_TEST_DRY_RUN=false.

import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getAssetStatusRecordById } from '@/lib/airtable/reviewAssetDelivery';
import { runPartnerDelivery } from '@/lib/delivery/partnerDelivery';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

const DELIVERY_SECRET_HEADER = 'x-delivery-secret';

function getRequestId(): string {
  return randomUUID();
}

export async function POST(req: NextRequest) {
  const requestId = getRequestId();
  const secret = process.env.DELIVERY_WEBHOOK_SECRET;
  const headerSecret = req.headers.get(DELIVERY_SECRET_HEADER)?.trim();

  if (!secret || headerSecret !== secret) {
    console.warn(`[delivery/partner/test] ${requestId} Unauthorized: missing or invalid ${DELIVERY_SECRET_HEADER}`);
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  }

  const testRecordId = (process.env.DELIVERY_TEST_RECORD_ID ?? '').trim();
  const testBatchId = (process.env.DELIVERY_TEST_BATCH_ID ?? '').trim();
  const testToken = (process.env.DELIVERY_TEST_TOKEN ?? '').trim() || undefined;
  const testProjectName = (process.env.DELIVERY_TEST_PROJECT_NAME ?? '').trim() || undefined;
  const dryRunEnv = process.env.DELIVERY_TEST_DRY_RUN;
  const dryRun = dryRunEnv === 'false' || dryRunEnv === '0' ? false : true;

  if (!testRecordId) {
    return NextResponse.json(
      { ok: false, error: 'DELIVERY_TEST_RECORD_ID is not set' },
      { status: 500, headers: NO_STORE }
    );
  }

  let driveFileId: string;
  try {
    const record = await getAssetStatusRecordById(testRecordId);
    if (!record) {
      return NextResponse.json(
        { ok: false, error: `Test record not found: ${testRecordId}` },
        { status: 404, headers: NO_STORE }
      );
    }
    driveFileId = record.driveFileId ?? '';
    if (!driveFileId) {
      return NextResponse.json(
        { ok: false, error: 'Test record has no Source Folder ID' },
        { status: 400, headers: NO_STORE }
      );
    }
  } catch (e) {
    console.error(`[delivery/partner/test] ${requestId} getAssetStatusRecordById failed:`, e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Failed to load test record' },
      { status: 500, headers: NO_STORE }
    );
  }

  const result = await runPartnerDelivery(
    {
      airtableRecordId: testRecordId,
      driveFileId,
      deliveryBatchId: testBatchId || undefined,
      dryRun,
      projectName: testProjectName,
      token: testToken,
    },
    requestId
  );

  if (result.ok && result.result === 'dry_run') {
    return NextResponse.json(
      {
        ok: true,
        dryRun: true,
        resolvedDestinationFolderId: result.resolvedDestinationFolderId,
        wouldCopyFileId: result.wouldCopyFileId,
        authMode: result.authMode,
        message: 'Dry run: no copy or Airtable update. Set DELIVERY_TEST_DRY_RUN=false to run for real.',
      },
      { headers: NO_STORE }
    );
  }

  if (result.ok) {
    if (result.result === 'idempotent') {
      return NextResponse.json(
        { ok: true, deliveredFileUrl: result.deliveredFileUrl, result: 'idempotent' },
        { headers: NO_STORE }
      );
    }
    return NextResponse.json(
      {
        ok: true,
        deliveredFileUrl: result.deliveredFileUrl,
        deliveredRootFolderId: result.deliveredRootFolderId,
        foldersCreated: result.foldersCreated,
        filesCopied: result.filesCopied,
        failures: result.failures,
        authMode: result.authMode,
        result: 'ok',
      },
      { headers: NO_STORE }
    );
  }

  return NextResponse.json(
    {
      ok: false,
      error: result.error,
      authMode: result.authMode,
      requestId,
    },
    { status: result.statusCode, headers: NO_STORE }
  );
}
