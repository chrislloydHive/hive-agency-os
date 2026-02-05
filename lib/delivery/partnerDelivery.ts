// lib/delivery/partnerDelivery.ts
// Core partner delivery logic: resolve destination, copy file, update Airtable.
// Used by POST /api/delivery/partner and /api/delivery/partner/test.

import { copyFileToFolder, type CopyFileToFolderOptions } from '@/lib/google/driveClient';
import { getDestinationFolderIdByBatchId } from '@/lib/airtable/partnerDeliveryBatches';
import {
  getAssetStatusRecordById,
  isAlreadyDelivered,
  updateAssetStatusDeliverySuccess,
  updateAssetStatusDeliveryErrorFireAndForget,
  withTimeout,
} from '@/lib/airtable/reviewAssetDelivery';
import { resolveReviewProject } from '@/lib/review/resolveProject';

const AIRTABLE_UPDATE_TIMEOUT_MS = 9000;

/** Detect request/client abort so we can log one line instead of a stack trace. Exported for tests. */
export function isAbortError(err: unknown): boolean {
  if (err instanceof Error && err.name === 'AbortError') return true;
  if (typeof err === 'object' && err !== null && (err as { type?: string }).type === 'aborted') return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /aborted|AbortError/i.test(msg);
}

export type PartnerDeliveryResult =
  | { ok: true; deliveredFileUrl: string; result: 'ok' }
  | { ok: true; dryRun: true; resolvedDestinationFolderId: string; wouldCopyFileId: string; result: 'dry_run' }
  | { ok: true; deliveredFileUrl: string; result: 'idempotent' }
  | { ok: false; error: string; statusCode: 400 | 404 | 500; result: 'error' };

export interface PartnerDeliveryParams {
  airtableRecordId: string;
  driveFileId: string;
  deliveryBatchId?: string;
  destinationFolderId?: string;
  dryRun?: boolean;
  /** Review portal token; when set, copy uses company OAuth so the source file (in company Drive) is accessible. */
  token?: string;
}

export interface PartnerDeliveryLog {
  requestId: string;
  airtableRecordId: string;
  driveFileId: string;
  destinationFolderId: string | null;
  dryRun: boolean;
  result: 'ok' | 'dry_run' | 'idempotent' | 'error';
  error?: string;
}

function logStructured(log: PartnerDeliveryLog): void {
  const payload: Record<string, unknown> = {
    requestId: log.requestId,
    airtableRecordId: log.airtableRecordId,
    driveFileId: log.driveFileId,
    destinationFolderId: log.destinationFolderId,
    dryRun: log.dryRun,
    result: log.result,
  };
  if (log.error != null) payload.error = log.error;
  console.log('[delivery/partner]', JSON.stringify(payload));
}

/**
 * Run partner delivery: validate, resolve destination, optionally copy and update Airtable.
 * When dryRun is true: no copy, no Airtable updates; returns resolvedDestinationFolderId and wouldCopyFileId.
 */
export async function runPartnerDelivery(
  params: PartnerDeliveryParams,
  requestId: string
): Promise<PartnerDeliveryResult> {
  const { airtableRecordId, driveFileId, deliveryBatchId, destinationFolderId: paramDestinationFolderId, dryRun = false, token } = params;

  let destinationFolderId = (paramDestinationFolderId ?? '').trim();
  if (!destinationFolderId && (deliveryBatchId ?? '').trim()) {
    const fromBatch = await getDestinationFolderIdByBatchId((deliveryBatchId ?? '').trim());
    destinationFolderId = fromBatch ?? '';
  }

  const fail = (error: string, statusCode: 400 | 404 | 500, updateAirtable: boolean): PartnerDeliveryResult => {
    if (!dryRun && updateAirtable) {
      // Fire-and-forget Airtable update uses own timeout (no request AbortSignal) to avoid AbortError stack traces when client disconnects.
      withTimeout(
        (signal) => updateAssetStatusDeliveryErrorFireAndForget(airtableRecordId, error, signal),
        AIRTABLE_UPDATE_TIMEOUT_MS
      ).catch((e) => {
        if (isAbortError(e)) {
          console.warn(`[delivery/partner] ${requestId} Airtable update skipped (request aborted)`);
          return;
        }
        console.error(`[delivery/partner] ${requestId} Failed to update Airtable error:`, e);
      });
    }
    logStructured({
      requestId,
      airtableRecordId,
      driveFileId,
      destinationFolderId: destinationFolderId || null,
      dryRun,
      result: 'error',
      error,
    });
    return { ok: false, error, statusCode, result: 'error' };
  };

  if (!driveFileId) {
    return fail('Missing driveFileId', 400, true);
  }

  if (!destinationFolderId) {
    return fail(
      'Missing destination folder: set destinationFolderId in the webhook payload or configure Destination Folder ID for the batch in Partner Delivery Batches',
      400,
      true
    );
  }

  if (dryRun) {
    logStructured({
      requestId,
      airtableRecordId,
      driveFileId,
      destinationFolderId,
      dryRun: true,
      result: 'dry_run',
    });
    return {
      ok: true,
      dryRun: true,
      resolvedDestinationFolderId: destinationFolderId,
      wouldCopyFileId: driveFileId,
      result: 'dry_run',
    };
  }

  let record: Awaited<ReturnType<typeof getAssetStatusRecordById>>;
  try {
    record = await getAssetStatusRecordById(airtableRecordId);
  } catch (e) {
    console.error(`[delivery/partner] ${requestId} getAssetStatusRecordById failed:`, e);
    logStructured({
      requestId,
      airtableRecordId,
      driveFileId,
      destinationFolderId,
      dryRun: false,
      result: 'error',
      error: e instanceof Error ? e.message : 'Failed to load record',
    });
    return { ok: false, error: e instanceof Error ? e.message : 'Failed to load record', statusCode: 500, result: 'error' };
  }

  if (!record) {
    return fail(`Airtable record not found: ${airtableRecordId}`, 404, false);
  }

  if (isAlreadyDelivered(record)) {
    logStructured({
      requestId,
      airtableRecordId,
      driveFileId,
      destinationFolderId,
      dryRun: false,
      result: 'idempotent',
    });
    return {
      ok: true,
      deliveredFileUrl: record.deliveredFileUrl ?? '',
      result: 'idempotent',
    };
  }

  // If token present: OAuth only. If no token: only use service account when USE_SERVICE_ACCOUNT=true and credentials exist.
  let copyOptions: CopyFileToFolderOptions | undefined;
  const tokenTrimmed = (token ?? '').trim();
  if (tokenTrimmed) {
    console.log('[partner-delivery] token_present=true token_len=', tokenTrimmed.length);
    const resolved = await resolveReviewProject(tokenTrimmed);
    if (!resolved?.auth) {
      return fail('Invalid review portal token (could not resolve project/oauth).', 400, true);
    }
    copyOptions = { auth: resolved.auth };
    console.log('[partner-delivery] auth=oauth');
  } else {
    const useServiceAccount = process.env.USE_SERVICE_ACCOUNT === 'true';
    if (!useServiceAccount) {
      return fail(
        'Missing Google OAuth token; cannot access Drive. Provide token or configure service account.',
        400,
        true
      );
    }
    console.log('[partner-delivery] auth=service_account');
  }

  try {
    const result = await copyFileToFolder(driveFileId, destinationFolderId, copyOptions);
    await updateAssetStatusDeliverySuccess(airtableRecordId, result.url);
    logStructured({
      requestId,
      airtableRecordId,
      driveFileId,
      destinationFolderId,
      dryRun: false,
      result: 'ok',
    });
    return { ok: true, deliveredFileUrl: result.url, result: 'ok' };
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    const is403404 =
      raw.includes('403') ||
      raw.includes('404') ||
      raw.includes('not found') ||
      raw.toLowerCase().includes('permission');
    const isCredentialsError = raw.includes('credentials not configured') || raw.includes('not configured');

    let message: string;
    if (copyOptions?.auth && is403404) {
      message = 'OAuth copy failed—check token validity and source file permissions.';
    } else if (!copyOptions?.auth && isCredentialsError) {
      message = 'Google Drive credentials not configured (service account). Provide token or configure service account.';
    } else {
      message = raw;
    }
    return fail(message, 500, true);
  }
}
