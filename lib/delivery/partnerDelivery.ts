// lib/delivery/partnerDelivery.ts
// Core partner delivery logic: resolve destination, copy folder tree, update Airtable.
// Source Folder ID (Airtable) = source folder ID; entire folder tree is copied into destination.
// Used by POST /api/delivery/partner and /api/delivery/partner/test.
// Auth: token -> OAuth; no token -> WIF service account impersonation (no 400 for missing token when WIF configured).

import {
  copyDriveFolderTree,
  copyFileToFolder,
  folderUrl,
  getDriveClientWithOAuth,
  getDriveClientWithServiceAccount,
  preflightFolderCopy,
} from '@/lib/google/driveClient';
import { getAuthModeSummary, getDriveClient as getWifDriveClient } from '@/lib/google/driveWif';
import {
  getDestinationFolderIdByBatchId,
  updateDeliveryResultToRecord,
} from '@/lib/airtable/partnerDeliveryBatches';
import {
  getApprovedAssetDriveIdsByBatchId,
  getApprovedAndNotDeliveredByBatchId,
  getRecordIdsByBatchIdAndFileIds,
} from '@/lib/airtable/reviewAssetStatus';
import {
  writeDeliveryToRecord,
  CREATIVE_REVIEW_ASSET_STATUS_TABLE,
} from '@/lib/airtable/deliveryWriteBack';
import {
  getAssetStatusRecordById,
  isAlreadyDelivered,
  updateAssetStatusDeliverySuccess,
  updateAssetStatusDeliveryErrorFireAndForget,
  withTimeout,
} from '@/lib/airtable/reviewAssetDelivery';
import { resolveReviewProject } from '@/lib/review/resolveProject';
import type { drive_v3 } from 'googleapis';

const FOLDER_MIMETYPE = 'application/vnd.google-apps.folder';

const AIRTABLE_UPDATE_TIMEOUT_MS = 9000;

const WIF_DOCS = 'docs/vercel-gcp-wif-setup.md';

/**
 * True when the error indicates WIF/OIDC is unavailable (e.g. OIDC token file missing in local or wrong env).
 * These often surface as "Source not accessible" from the first Drive call when credentials are resolved lazily.
 */
function isWifOidcUnavailableError(message: string): boolean {
  const s = message.toLowerCase();
  return (
    (s.includes('oidc') && (s.includes('token') || s.includes('enoent'))) ||
    s.includes('unable to impersonate') ||
    (s.includes('enoent') && (s.includes('/run/secrets') || s.includes('vercel-oidc')))
  );
}

const WIF_UNAVAILABLE_MESSAGE = `Workload Identity Federation unavailable: OIDC token not found. This usually means the request is not running in Vercel with the GCP OIDC integration configured (e.g. local dev or missing integration). Use a review portal token for OAuth delivery, or deploy to Vercel and configure WIF. See ${WIF_DOCS}.`;

/** Detect request/client abort so we can log one line instead of a stack trace. Exported for tests. */
export function isAbortError(err: unknown): boolean {
  if (err instanceof Error && err.name === 'AbortError') return true;
  if (typeof err === 'object' && err !== null && (err as { type?: string }).type === 'aborted') return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /aborted|AbortError/i.test(msg);
}

export type PartnerDeliveryResult =
  | {
      ok: true;
      deliveredFileUrl: string;
      deliveredRootFolderId: string;
      foldersCreated: number;
      filesCopied: number;
      failures: Array<{ id: string; name?: string; reason: string }>;
      authMode: AuthMode;
      result: 'ok';
    }
  | { ok: true; dryRun: true; resolvedDestinationFolderId: string; wouldCopyFileId: string; authMode: AuthMode; result: 'dry_run' }
  | { ok: true; deliveredFileUrl: string; result: 'idempotent' }
  | { ok: false; error: string; statusCode: 400 | 404 | 500; result: 'error'; authMode?: AuthMode };

/** Result for batch delivery (approved assets only, files.copy into one folder). */
export type PartnerDeliveryByBatchResult =
  | {
      ok: true;
      deliveredFolderId: string;
      deliveredFolderUrl: string;
      deliverySummary: {
        approvedCount: number;
        filesCopied: number;
        failures: Array<{ id: string; name?: string; reason: string }>;
        /** File IDs excluded (no longer approved or already delivered). */
        excluded?: Array<{ fileId: string; reason: string }>;
      };
      authMode: AuthMode;
      dryRun?: boolean;
    }
  | { ok: false; error: string; statusCode: 400 | 500; authMode?: AuthMode };

export interface PartnerDeliveryParams {
  airtableRecordId: string;
  /** Source folder ID (Google Drive folder to copy). Accepts sourceFolderId or legacy driveFileId from route. */
  sourceFolderId: string;
  /** @deprecated Use sourceFolderId. Kept for backward compat when calling from test route. */
  driveFileId?: string;
  deliveryBatchId?: string;
  destinationFolderId?: string;
  dryRun?: boolean;
  /** Optional project name for delivered folder name: "Delivered – {projectName} – {date}". */
  projectName?: string;
  /** Review portal token; when set, copy uses company OAuth. */
  token?: string;
  /** OIDC token from request header x-vercel-oidc-token; when set, WIF uses this instead of ADC file. */
  oidcToken?: string | null;
}

export type AuthMode = 'oauth' | 'wif_service_account';

export interface PartnerDeliveryLog {
  requestId: string;
  airtableRecordId: string;
  sourceFolderId: string;
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
    sourceFolderId: log.sourceFolderId,
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
  const sourceFolderId = (params.sourceFolderId ?? params.driveFileId ?? '').trim();
  const { airtableRecordId, deliveryBatchId, destinationFolderId: paramDestinationFolderId, dryRun = false, projectName, token } = params;

  let destinationFolderId = (paramDestinationFolderId ?? '').trim();
  if (!destinationFolderId && (deliveryBatchId ?? '').trim()) {
    const fromBatch = await getDestinationFolderIdByBatchId((deliveryBatchId ?? '').trim());
    destinationFolderId = fromBatch ?? '';
  }

  const fail = (
    error: string,
    statusCode: 400 | 404 | 500,
    updateAirtable: boolean,
    authMode?: AuthMode
  ): PartnerDeliveryResult => {
    if (!dryRun && updateAirtable) {
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
      sourceFolderId,
      destinationFolderId: destinationFolderId || null,
      dryRun,
      result: 'error',
      error,
      authMode,
    });
    return { ok: false, error, statusCode, result: 'error', authMode };
  };

  if (!sourceFolderId) {
    return fail('Missing source folder ID', 400, true);
  }

  if (!destinationFolderId) {
    return fail(
      'Missing destination folder: set destinationFolderId in the webhook payload or configure Destination Folder ID for the batch in Partner Delivery Batches',
      400,
      true
    );
  }

  // Resolve auth: token -> OAuth; else WIF (never 400 for missing token when WIF configured).
  let drive: drive_v3.Drive;
  let authMode: AuthMode;

  const tokenTrimmed = (token ?? '').trim();
  if (tokenTrimmed) {
    const resolved = await resolveReviewProject(tokenTrimmed);
    if (!resolved?.auth) {
      return fail('Invalid review portal token (could not resolve project/oauth).', 400, true);
    }
    authMode = 'oauth';
    drive = getDriveClientWithOAuth(resolved.auth);
  } else {
    try {
      drive = await getWifDriveClient({ oidcToken: params.oidcToken ?? undefined });
      authMode = 'wif_service_account';
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[delivery/partner] ${requestId} WIF getDriveClient failed:`, msg);
      return fail(
        'Google ADC/WIF not configured. Set GOOGLE_IMPERSONATE_SERVICE_ACCOUNT_EMAIL and configure Workload Identity Federation per docs/vercel-gcp-wif-setup.md.',
        500,
        true
      );
    }
  }

  console.log(
    JSON.stringify({
      requestId,
      authMode,
      sourceFolderId,
      destinationFolderId,
      supportsAllDrives: true,
    })
  );

  try {
    await preflightFolderCopy(drive, sourceFolderId, destinationFolderId);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (authMode === 'wif_service_account' && isWifOidcUnavailableError(message)) {
      return fail(WIF_UNAVAILABLE_MESSAGE, 500, true, authMode);
    }
    return fail(message, 400, true, authMode);
  }

  if (dryRun) {
    logStructured({
      requestId,
      airtableRecordId,
      sourceFolderId,
      destinationFolderId,
      dryRun: true,
      result: 'dry_run',
      authMode,
    });
    return {
      ok: true,
      dryRun: true,
      resolvedDestinationFolderId: destinationFolderId,
      wouldCopyFileId: sourceFolderId,
      authMode,
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
      sourceFolderId,
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
      sourceFolderId,
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

  const deliveredFolderName = `Delivered – ${(projectName ?? 'Delivery').trim() || 'Delivery'} – ${new Date().toISOString().slice(0, 10)}`;

  try {
    const result = await copyDriveFolderTree(drive, sourceFolderId, destinationFolderId, {
      deliveredFolderName,
      drive,
    });
    await updateAssetStatusDeliverySuccess(airtableRecordId, {
      deliveredFolderId: result.deliveredRootFolderId,
      deliveredFolderUrl: result.deliveredRootFolderUrl,
      filesCopied: result.filesCopied,
      foldersCreated: result.foldersCreated,
      failures: result.failures.length > 0 ? result.failures : undefined,
    });
    logStructured({
      requestId,
      airtableRecordId,
      sourceFolderId,
      destinationFolderId,
      dryRun: false,
      result: 'ok',
      authMode,
    });
    return {
      ok: true,
      deliveredFileUrl: result.deliveredRootFolderUrl,
      deliveredRootFolderId: result.deliveredRootFolderId,
      foldersCreated: result.foldersCreated,
      filesCopied: result.filesCopied,
      failures: result.failures,
      authMode,
      result: 'ok',
    };
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    if (authMode === 'wif_service_account' && isWifOidcUnavailableError(raw)) {
      return fail(WIF_UNAVAILABLE_MESSAGE, 500, true, authMode);
    }
    const is403404 =
      raw.includes('403') ||
      raw.includes('404') ||
      raw.includes('not found') ||
      raw.toLowerCase().includes('permission');

    let message: string;
    if (authMode === 'oauth' && is403404) {
      message = 'OAuth copy failed—check token validity and source folder permissions.';
    } else if (authMode === 'wif_service_account' && is403404) {
      const { impersonateEmail } = getAuthModeSummary();
      message = `Service account cannot access source/destination. Ensure ${impersonateEmail} is a MEMBER of the Shared Drive.`;
    } else {
      message = raw;
    }
    return fail(message, 500, true, authMode);
  }
}

/**
 * Run partner delivery for a batch: copy only approved assets (from Hive OS DB) into
 * a single delivered folder. Does not list or scan Drive; DB is the approval truth.
 */
export async function runPartnerDeliveryByBatch(params: {
  deliveryBatchId: string;
  destinationFolderId?: string;
  /** When set, use this list as the files to copy (portal sends approved + not-delivered). Otherwise resolve from DB. */
  approvedFileIds?: string[];
  dryRun?: boolean;
  oidcToken?: string | null;
  token?: string;
}): Promise<PartnerDeliveryByBatchResult> {
  const {
    deliveryBatchId,
    destinationFolderId: bodyDestinationFolderId,
    approvedFileIds: clientApprovedFileIds,
    dryRun = false,
    oidcToken,
    token,
  } = params;

  let approved: Array<{ recordId: string; driveId: string }>;
  let excluded: Array<{ fileId: string; reason: string }> = [];

  if (clientApprovedFileIds?.length) {
    const approvedNotDelivered = await getApprovedAndNotDeliveredByBatchId(deliveryBatchId);
    const allowedSet = new Set(approvedNotDelivered.map((r) => r.driveId));
    const toCopy = clientApprovedFileIds.filter((id) => allowedSet.has(id));
    excluded = clientApprovedFileIds
      .filter((id) => !allowedSet.has(id))
      .map((fileId) => ({ fileId, reason: 'not_approved_or_already_delivered' }));
    approved = approvedNotDelivered.filter((r) => toCopy.includes(r.driveId));
  } else {
    approved = await getApprovedAssetDriveIdsByBatchId(deliveryBatchId);
  }

  if (approved.length === 0) {
    return {
      ok: false,
      error: clientApprovedFileIds?.length
        ? (excluded.length > 0 ? 'No assets to copy (all excluded: not approved or already delivered)' : 'No approved assets to deliver')
        : 'No approved assets found for batch',
      statusCode: 400,
    };
  }

  const destinationFolderId =
    bodyDestinationFolderId ?? (await getDestinationFolderIdByBatchId(deliveryBatchId));
  if (!destinationFolderId) {
    return {
      ok: false,
      error: 'Destination folder not found for batch and none provided',
      statusCode: 400,
    };
  }

  let drive: drive_v3.Drive;
  let authMode: AuthMode;
  try {
    const tokenTrimmed = (token ?? '').trim();
    if (tokenTrimmed) {
      const resolved = await resolveReviewProject(tokenTrimmed);
      if (!resolved?.auth) {
        return { ok: false, error: 'Invalid review portal token (could not resolve project/oauth).', statusCode: 400 };
      }
      authMode = 'oauth';
      drive = getDriveClientWithOAuth(resolved.auth);
    } else {
      drive = await getWifDriveClient({ oidcToken: oidcToken ?? undefined });
      authMode = 'wif_service_account';
    }
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    const inferredMode: AuthMode = (token ?? '').trim() ? 'oauth' : 'wif_service_account';
    if (inferredMode === 'wif_service_account' && isWifOidcUnavailableError(raw)) {
      return { ok: false, error: WIF_UNAVAILABLE_MESSAGE, statusCode: 500, authMode: inferredMode };
    }
    return { ok: false, error: raw, statusCode: 500, authMode: inferredMode };
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  const deliveredFolderName = `Delivered – ${deliveryBatchId} – ${dateStr}`;

  if (dryRun) {
    return {
      ok: true,
      deliveredFolderId: '',
      deliveredFolderUrl: '',
      deliverySummary: {
        approvedCount: approved.length,
        filesCopied: 0,
        failures: [],
        ...(excluded.length > 0 && { excluded }),
      },
      authMode,
      dryRun: true,
    };
  }

  let createdFolderId: string;
  try {
    const createRes = await drive.files.create({
      requestBody: {
        name: deliveredFolderName,
        mimeType: FOLDER_MIMETYPE,
        parents: [destinationFolderId],
      },
      fields: 'id',
      supportsAllDrives: true,
    });
    createdFolderId = createRes.data.id!;
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Failed to create delivered folder: ${raw}`, statusCode: 500, authMode };
  }

  const failures: Array<{ id: string; name?: string; reason: string }> = [];
  let filesCopied = 0;
  for (const { driveId } of approved) {
    try {
      await copyFileToFolder(driveId, createdFolderId, { drive });
      filesCopied++;
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      failures.push({ id: driveId, reason });
    }
  }

  const folderPayload = {
    deliveredFolderId: createdFolderId,
    deliveredFolderUrl: folderUrl(createdFolderId),
    filesCopied,
    foldersCreated: 1,
    failures: failures.length ? failures : undefined,
  };

  // When portal sent approvedFileIds, mark only successfully copied assets as delivered.
  if (clientApprovedFileIds?.length) {
    const failedIds = new Set(failures.map((f) => f.id));
    const successfullyCopiedFileIds = clientApprovedFileIds.filter((id) => !failedIds.has(id));
    const recordsToMark = await getRecordIdsByBatchIdAndFileIds(
      deliveryBatchId,
      successfullyCopiedFileIds
    );
    for (const { recordId } of recordsToMark) {
      try {
        await updateAssetStatusDeliverySuccess(recordId, folderPayload);
      } catch (e) {
        console.warn(`[delivery/partner] Failed to mark record ${recordId} delivered:`, e);
      }
    }
  }

  return {
    ok: true,
    deliveredFolderId: createdFolderId,
    deliveredFolderUrl: folderUrl(createdFolderId),
    deliverySummary: {
      approvedCount: approved.length,
      filesCopied,
      failures,
      ...(excluded.length > 0 && { excluded }),
    },
    authMode,
  };
}

/** Failure item for portal-explicit delivery (fileId + reason). */
export interface PortalDeliveryFailure {
  fileId: string;
  reason: string;
}

export type PartnerDeliveryFromPortalResult =
  | {
      ok: true;
      deliveredFolderId: string;
      deliveredFolderUrl: string;
      deliverySummary: {
        approvedCount: number;
        filesCopied: number;
        failures: PortalDeliveryFailure[];
      };
    }
  | { ok: false; error: string; statusCode: 400 | 500 };

/**
 * Run partner delivery from Portal UI: approved file IDs only, service account auth, no OIDC/WIF.
 * Creates delivered folder, copies each file, writes back to the given Airtable record.
 */
export async function runPartnerDeliveryFromPortal(params: {
  airtableRecordId: string;
  deliveryBatchId?: string;
  destinationFolderId: string;
  approvedFileIds: string[];
  dryRun?: boolean;
}): Promise<PartnerDeliveryFromPortalResult> {
  const {
    airtableRecordId,
    deliveryBatchId,
    destinationFolderId,
    approvedFileIds,
    dryRun = false,
  } = params;

  const drive = getDriveClientWithServiceAccount();
  const dateStr = new Date().toISOString().slice(0, 10);
  const folderNameSuffix = deliveryBatchId || airtableRecordId;
  const deliveredFolderName = `Delivered – ${folderNameSuffix} – ${dateStr}`;

  if (dryRun) {
    return {
      ok: true,
      deliveredFolderId: '',
      deliveredFolderUrl: '',
      deliverySummary: {
        approvedCount: approvedFileIds.length,
        filesCopied: 0,
        failures: [],
      },
    };
  }

  let createdFolderId: string;
  try {
    const createRes = await drive.files.create({
      requestBody: {
        name: deliveredFolderName,
        mimeType: FOLDER_MIMETYPE,
        parents: [destinationFolderId],
      },
      fields: 'id',
      supportsAllDrives: true,
    });
    createdFolderId = createRes.data.id!;
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error: `Failed to create delivered folder: ${raw}`,
      statusCode: 500,
    };
  }

  const failures: PortalDeliveryFailure[] = [];
  let filesCopied = 0;
  for (const fileId of approvedFileIds) {
    try {
      await copyFileToFolder(fileId, createdFolderId, { drive });
      filesCopied++;
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      failures.push({ fileId, reason });
    }
  }

  const deliveredFolderUrl = folderUrl(createdFolderId);
  const deliverySummary = {
    approvedCount: approvedFileIds.length,
    filesCopied,
    failures,
  };

  try {
    await updateDeliveryResultToRecord(airtableRecordId, {
      deliveredFolderId: createdFolderId,
      deliveredFolderUrl,
      approvedCount: approvedFileIds.length,
      filesCopied,
      failures,
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    console.warn('[delivery/partner] Failed to write back delivery result to Airtable:', raw);
    return {
      ok: false,
      error: `Delivery completed but Airtable update failed: ${raw}`,
      statusCode: 500,
    };
  }

  const now = new Date().toISOString();
  if (deliveryBatchId) {
    const failedFileIds = new Set(failures.map((f) => f.fileId));
    const successfullyCopiedFileIds = approvedFileIds.filter((id) => !failedFileIds.has(id));
    const recordsToMark = await getRecordIdsByBatchIdAndFileIds(
      deliveryBatchId,
      successfullyCopiedFileIds
    );
    const assetPayload = {
      kind: 'success' as const,
      deliveryStatus: 'Delivered' as const,
      deliveredAt: now,
      deliveredCheckbox: true as const,
      deliveredFolderId: createdFolderId,
      deliveredFolderUrl,
      deliverySummary: '',
    };
    for (const { recordId } of recordsToMark) {
      try {
        await writeDeliveryToRecord(
          CREATIVE_REVIEW_ASSET_STATUS_TABLE,
          recordId,
          assetPayload
        );
      } catch (e) {
        console.warn(`[delivery/partner] Failed to mark asset ${recordId} delivered:`, e instanceof Error ? e.message : e);
      }
    }
  }

  return {
    ok: true,
    deliveredFolderId: createdFolderId,
    deliveredFolderUrl,
    deliverySummary,
  };
}
