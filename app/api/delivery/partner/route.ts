// app/api/delivery/partner/route.ts
// POST: Partner delivery webhook. Airtable automation sends one asset per request.
// Copies entire Drive folder (Source Folder ID = source folder ID) into destination; updates Creative Review Asset Status.
// Auth: X-DELIVERY-SECRET must match DELIVERY_WEBHOOK_SECRET.
// dryRun: true = validate only, no copy, no Airtable updates.

import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  runPartnerDelivery,
  runPartnerDeliveryByBatch,
  runPartnerDeliveryFromPortal,
} from '@/lib/delivery/partnerDelivery';

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
    console.warn(`[delivery/partner] ${requestId} Unauthorized: missing or invalid ${DELIVERY_SECRET_HEADER}`);
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  }

  let body: {
    airtableRecordId?: string;
    sourceFolderId?: string;
    driveFileId?: string;
    deliveryBatchId?: string;
    destinationFolderId?: string;
    approvedFileIds?: string[];
    projectName?: string;
    token?: string;
    dryRun?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    console.warn(`[delivery/partner] ${requestId} Invalid JSON`);
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400, headers: NO_STORE });
  }

  const airtableRecordIdRaw = (body.airtableRecordId ?? '').toString().trim();
  const deliveryBatchId = (body.deliveryBatchId ?? '').toString().trim();
  const destinationFolderId = (body.destinationFolderId ?? '').toString().trim() || undefined;
  const approvedFileIds = Array.isArray(body.approvedFileIds)
    ? body.approvedFileIds.map((id) => String(id).trim()).filter(Boolean)
    : undefined;
  const dryRun = body.dryRun === true;
  const oidcToken = req.headers.get('x-vercel-oidc-token')?.trim() || undefined;

  // Portal-explicit delivery: airtableRecordId + destinationFolderId + approvedFileIds (service account only, no OIDC).
  if (airtableRecordIdRaw) {
    if (!destinationFolderId) {
      return NextResponse.json(
        { ok: false, error: 'destinationFolderId required' },
        { status: 400, headers: NO_STORE }
      );
    }
    if (!approvedFileIds || approvedFileIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'approvedFileIds must be a non-empty array' },
        { status: 400, headers: NO_STORE }
      );
    }
    const portalResult = await runPartnerDeliveryFromPortal({
      airtableRecordId: airtableRecordIdRaw,
      deliveryBatchId: deliveryBatchId || undefined,
      destinationFolderId,
      approvedFileIds,
      dryRun,
    });
    if (!portalResult.ok) {
      return NextResponse.json(
        { ok: false, error: portalResult.error },
        { status: portalResult.statusCode, headers: NO_STORE }
      );
    }
    return NextResponse.json(
      {
        ok: true,
        deliveredFolderId: portalResult.deliveredFolderId,
        deliveredFolderUrl: portalResult.deliveredFolderUrl,
        deliverySummary: portalResult.deliverySummary,
      },
      { headers: NO_STORE }
    );
  }

  // Batch delivery: approved assets (from DB or from portal approvedFileIds); uses token or WIF.
  if (deliveryBatchId) {
    const token = (body.token ?? '').toString().trim() || undefined;
    const batchResult = await runPartnerDeliveryByBatch({
      deliveryBatchId,
      destinationFolderId,
      approvedFileIds,
      dryRun,
      oidcToken,
      token,
    });
    if (!batchResult.ok) {
      return NextResponse.json(
        { ok: false, error: batchResult.error, authMode: batchResult.authMode, requestId },
        { status: batchResult.statusCode, headers: NO_STORE }
      );
    }
    return NextResponse.json(
      {
        ok: true,
        deliveredFolderId: batchResult.deliveredFolderId,
        deliveredFolderUrl: batchResult.deliveredFolderUrl,
        deliverySummary: batchResult.deliverySummary,
        authMode: batchResult.authMode,
        ...(batchResult.dryRun && { dryRun: true }),
      },
      { headers: NO_STORE }
    );
  }

  // Single-asset folder delivery (legacy).
  const sourceFolderId = (body.sourceFolderId ?? body.driveFileId ?? '').toString().trim();
  if (!sourceFolderId) {
    return NextResponse.json(
      { ok: false, error: 'Missing source folder ID, deliveryBatchId, or (airtableRecordId + destinationFolderId + approvedFileIds)' },
      { status: 400, headers: NO_STORE }
    );
  }
  const airtableRecordId = airtableRecordIdRaw;
  if (!airtableRecordId) {
    console.warn(`[delivery/partner] ${requestId} Missing airtableRecordId`);
    return NextResponse.json({ ok: false, error: 'Missing airtableRecordId' }, { status: 400, headers: NO_STORE });
  }
  const projectName = (body.projectName ?? '').toString().trim() || undefined;
  const token = (body.token ?? '').toString().trim() || undefined;

  const result = await runPartnerDelivery(
    {
      airtableRecordId,
      sourceFolderId,
      deliveryBatchId: deliveryBatchId || undefined,
      destinationFolderId: destinationFolderId || undefined,
      dryRun,
      projectName,
      token,
      oidcToken,
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
      },
      { headers: NO_STORE }
    );
  }

  if (result.ok) {
    if (result.result === 'idempotent') {
      return NextResponse.json(
        { ok: true, deliveredFileUrl: result.deliveredFileUrl },
        { headers: NO_STORE }
      );
    }
    // result.result === 'ok' (folder delivery)
    return NextResponse.json(
      {
        ok: true,
        deliveredFolderId: result.deliveredRootFolderId,
        deliveredFolderUrl: result.deliveredFileUrl,
        deliveredFileUrl: result.deliveredFileUrl,
        deliveredRootFolderId: result.deliveredRootFolderId,
        deliverySummary: {
          foldersCreated: result.foldersCreated,
          filesCopied: result.filesCopied,
          failures: result.failures,
        },
        authMode: result.authMode,
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
