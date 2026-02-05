// lib/delivery/partnerDelivery.ts
// Core partner delivery logic: resolve destination, copy file, update Airtable.
// Used by POST /api/delivery/partner and /api/delivery/partner/test.
// Auth: token -> OAuth; no token -> WIF service account impersonation (no 400 for missing token when WIF configured).

import {
  copyFileToFolder,
  getDriveClientWithOAuth,
  preflightCopy,
  type CopyFileToFolderOptions,
} from '@/lib/google/driveClient';
import { getDriveClient as getWifDriveClient } from '@/src/lib/google/driveWif';
import { getDestinationFolderIdByBatchId } from '@/lib/airtable/partnerDeliveryBatches';
import {
  getAssetStatusRecordById,
  isAlreadyDelivered,
  updateAssetStatusDeliverySuccess,
  updateAssetStatusDeliveryErrorFireAndForget,
  withTimeout,
} from '@/lib/airtable/reviewAssetDelivery';
import { resolveReviewProject } from '@/lib/review/resolveProject';
import type { drive_v3 } from 'googleapis';

const AIRTABLE_UPDATE_TIMEOUT_MS = 9000;

/** Detect request/client abort so we can log one line instead of a stack trace. Exported for tests. */
export function isAbortError(err: unknown): boolean {
  if (err instanceof Error && err.name === 'AbortError') return true;
  if (typeof err === 'object' && err !== null && (err as { type?: string }).type === 'aborted') return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /aborted|AbortError/i.test(msg);
}

export type PartnerDeliveryResult =
  | { ok: true; deliveredFileUrl: string; newFileId?: string; newName?: string; result: 'ok' }
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

export type AuthMode = 'oauth' | 'wif_service_account';

export interface PartnerDeliveryLog {
  requestId: string;
  airtableRecordId: string;
  driveFileId: string;
  destinationFolderId: string | null;
  dryRun: boolean;
  result: 'ok' | 'dry_run' | 'idempotent' | 'error';
  authMode?: AuthMode;
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
  if (log.authMode != null) payload.authMode = log.authMode;
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

  // Auth: token -> OAuth; no token -> WIF (never error solely for missing token if WIF works).
  let drive: drive_v3.Drive;
  let copyOptions: CopyFileToFolderOptions;
  let authMode: AuthMode;

  const tokenTrimmed = (token ?? '').trim();
  if (tokenTrimmed) {
    const resolved = await resolveReviewProject(tokenTrimmed);
    if (!resolved?.auth) {
      return fail('Invalid review portal token (could not resolve project/oauth).', 400, true);
    }
    authMode = 'oauth';
    drive = getDriveClientWithOAuth(resolved.auth);
    copyOptions = { auth: resolved.auth };
  } else {
    try {
      drive = await getWifDriveClient();
      authMode = 'wif_service_account';
      copyOptions = { drive };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[delivery/partner] ${requestId} WIF getDriveClient failed:`, msg);
      return fail(
        'Google ADC/WIF not configured on Vercel. See docs/vercel-gcp-wif-setup.md',
        500,
        true
      );
    }
  }

  console.log(
    JSON.stringify({
      requestId,
      authMode,
      sourceFileId: driveFileId,
      destinationFolderId,
            })
  );

  try {
    await preflightCopy(drive, driveFileId, destinationFolderId);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return fail(message, 400, true);
  }

  try {
    const result = await copyFileToFolder(driveFileId, destinationFolderId, {
      ...copyOptions,
      requestId,
    });
    await updateAssetStatusDeliverySuccess(airtableRecordId, result.url);
    logStructured({
      requestId,
      airtableRecordId,
      driveFileId,
      destinationFolderId,
      dryRun: false,
      result: 'ok',
      authMode,
    });
    return {
      ok: true,
      deliveredFileUrl: result.url,
      newFileId: result.id,
      newName: result.name,
      result: 'ok',
    };
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    const is403404 =
      raw.includes('403') ||
      raw.includes('404') ||
      raw.includes('not found') ||
      raw.toLowerCase().includes('permission');

    let message: string;
    if (copyOptions.auth && is403404) {
      message = 'OAuth copy failed—check token validity and source file permissions.';
    } else if (authMode === 'wif_service_account' && is403404) {
      message =
        'Service account cannot access this folder/Shared Drive. Add hive-os-drive@hive-os-479319.iam.gserviceaccount.com as a MEMBER of the Shared Drive (Content manager).';
    } else {
      message = raw;
    }
    return fail(message, 500, true);
  }
}
