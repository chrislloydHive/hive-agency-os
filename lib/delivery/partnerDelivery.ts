// lib/delivery/partnerDelivery.ts
// Core partner delivery logic: resolve destination, copy folder tree, update Airtable.
// Source Folder ID (Airtable) = source folder ID; entire folder tree is copied into destination.
// Used by POST /api/delivery/partner and /api/delivery/partner/test.
// Auth: token -> OAuth; no token -> WIF service account impersonation (no 400 for missing token when WIF configured).

import {
  copyDriveFolderTree,
  copyFileToFolder,
  folderUrl,
  getDriveClient,
  getDriveClientWithOAuth,
  preflightFolderCopy,
  ensureSubfolderPath,
  findChildFolderWithDrive,
  createFolderWithDrive,
} from '@/lib/google/driveClient';
import {
  getDestinationFolderIdByBatchId,
  updateDeliveryResultToRecord,
  getBatchDetails,
  getBatchDetailsByRecordId,
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
import type { OAuth2Client } from 'google-auth-library';

const FOLDER_MIMETYPE = 'application/vnd.google-apps.folder';

const AIRTABLE_UPDATE_TIMEOUT_MS = 9000;

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
  const { airtableRecordId, deliveryBatchId, destinationFolderId: paramDestinationFolderId, dryRun = false, projectName, token, oidcToken } = params;

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
  let oauthClient: OAuth2Client | null = null;
  
  if (tokenTrimmed) {
    const resolved = await resolveReviewProject(tokenTrimmed);
    if (!resolved?.auth) {
      return fail('Invalid review portal token (could not resolve project/oauth).', 400, true);
    }
    oauthClient = resolved.auth;
    authMode = 'oauth';
  } else {
    authMode = 'wif_service_account';
  }

  // Debug logging (optional, safe, temporary)
  try {
    const credsJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    const credsType = credsJson ? JSON.parse(credsJson).type : 'unknown';
    const vercelOidcTokenToUse = oidcToken ?? process.env.VERCEL_OIDC_TOKEN;
    console.log(`[delivery/partner] ${requestId} Auth context:`, {
      useServiceAccount: process.env.USE_SERVICE_ACCOUNT,
      hasOidcToken: Boolean(vercelOidcTokenToUse),
      credsType,
      authMode,
    });
  } catch {
    // Ignore parse errors in debug logging
  }

  try {
    const vercelOidcTokenToUse = oidcToken ?? process.env.VERCEL_OIDC_TOKEN ?? null;
    // Use getDriveClient from driveClient.ts (requires options parameter)
    drive = await getDriveClient({
      oauthToken: oauthClient ?? null,
      vercelOidcToken: vercelOidcTokenToUse,
    });
    console.log(`[delivery/partner] ${requestId} ✅ Drive client initialized (authMode=${authMode})`);
  } catch (authError) {
    const authMsg = authError instanceof Error ? authError.message : String(authError);
    console.error(`[delivery/partner] ${requestId} ❌ Drive client initialization failed:`, authMsg);
    return fail(`Drive client initialization failed: ${authMsg}`, 500, true, authMode);
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

  // Auto subfolder routing: {Destination Folder}/{Tactic}/{Variant?}; fallback to root if no Tactic
  let effectiveDestinationFolderId = destinationFolderId;
  const tacticValue = record.tactic?.trim() || '';
  const variantValue = record.variant?.trim() || '';
  let resolvedTacticFolderId: string | null = null;
  let resolvedVariantFolderId: string | null = null;
  
  if (tacticValue) {
    console.log(`[delivery/partner] ${requestId} Resolving subfolder path: ${tacticValue}${variantValue ? `/${variantValue}` : ''} under ${destinationFolderId} (tactic="${tacticValue}", variant="${variantValue}")`);
    try {
      // Resolve tactic folder first (find or create)
      const existingTactic = await findChildFolderWithDrive(drive, destinationFolderId, tacticValue);
      if (existingTactic) {
        resolvedTacticFolderId = existingTactic.id;
      } else {
        const createdTactic = await createFolderWithDrive(drive, destinationFolderId, tacticValue);
        resolvedTacticFolderId = createdTactic.id;
      }
      
      // Resolve variant folder if provided
      if (variantValue && resolvedTacticFolderId) {
        const existingVariant = await findChildFolderWithDrive(drive, resolvedTacticFolderId, variantValue);
        if (existingVariant) {
          resolvedVariantFolderId = existingVariant.id;
        } else {
          const createdVariant = await createFolderWithDrive(drive, resolvedTacticFolderId, variantValue);
          resolvedVariantFolderId = createdVariant.id;
        }
        effectiveDestinationFolderId = resolvedVariantFolderId;
      } else {
        effectiveDestinationFolderId = resolvedTacticFolderId;
      }
      console.log(`[delivery/partner] ${requestId} Subfolder resolved: ${effectiveDestinationFolderId}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[delivery/partner] ${requestId} ensureSubfolderPath failed, using root destination:`, msg);
      // Continue with root destination
    }
  } else {
    console.warn(`[delivery/partner] ${requestId} WARNING: No Tactic found on CRAS record ${airtableRecordId} (tactic="${tacticValue}", variant="${variantValue}"). Files will be delivered to root destination: ${destinationFolderId}. Set Tactic/Variant on CRAS records to enable subfolder routing.`);
  }

  // Check if source is a file or folder - if it's a file, copy only that file (not the entire folder)
  let resolvedSourceFolderId = sourceFolderId;
  let sourceMimeType: string | null = null;
  let isSourceFile = false;
  try {
    const sourceMeta = await drive.files.get({
      fileId: sourceFolderId,
      fields: 'id,name,mimeType,parents',
      supportsAllDrives: true,
    });
    sourceMimeType = sourceMeta.data.mimeType ?? null;
    
    if (sourceMimeType !== FOLDER_MIMETYPE) {
      // Source is a file - keep it as a file, don't resolve to parent folder
      // This ensures we copy only the approved file, not all files in the folder
      isSourceFile = true;
      resolvedSourceFolderId = sourceFolderId; // Keep original file ID
      console.log(`[delivery/partner] ${requestId} Source is a file - will copy only this file: sourceId=${sourceFolderId}, sourceMimeType=${sourceMimeType}`);
    } else {
      // Source is a folder - copy entire folder tree
      isSourceFile = false;
      resolvedSourceFolderId = sourceFolderId;
      console.log(`[delivery/partner] ${requestId} Source is a folder - will copy entire folder tree: sourceId=${sourceFolderId}, sourceMimeType=${sourceMimeType}`);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return fail(`Failed to resolve source: ${message}`, 400, true, authMode);
  }

  // Log source resolution details
  console.log(`[delivery/partner] ${requestId} Source resolution:`, {
    sourceId: sourceFolderId,
    sourceMimeType,
    resolvedFolderId: resolvedSourceFolderId,
  });

  // TEMPORARY debug log before delivery
  console.log(`[delivery/partner] ${requestId} Pre-delivery debug:`, {
    sourceId: resolvedSourceFolderId,
    destinationFolderId: destinationFolderId,
    resolvedTacticFolderId,
    resolvedVariantFolderId,
    effectiveDestinationFolderId,
  });

  // Per-record preflight: explicit drive.files.get() calls with raw error logging
  let sourceMeta: drive_v3.Schema$File;
  let destMeta: drive_v3.Schema$File;
  
  // Check SOURCE access (use original sourceFolderId for file, resolvedSourceFolderId for folder)
  try {
    const sourceRes = await drive.files.get({
      fileId: sourceFolderId, // Use original ID to get file metadata
      fields: 'id,name,mimeType,driveId,parents',
      supportsAllDrives: true,
    });
    sourceMeta = sourceRes.data;
    console.log(`[drive-access] SOURCE:`, {
      id: sourceMeta.id,
      name: sourceMeta.name,
      mimeType: sourceMeta.mimeType,
      driveId: sourceMeta.driveId ?? 'null (My Drive)',
      parents: sourceMeta.parents ?? null,
    });
  } catch (sourceError: any) {
    const statusCode = sourceError?.response?.status ?? sourceError?.code ?? 'unknown';
    const responseData = sourceError?.response?.data ?? sourceError?.errors ?? null;
    console.error(`[drive-access] SOURCE FAILED:`, {
      fileId: resolvedSourceFolderId,
      statusCode,
      responseData,
      errorMessage: sourceError?.message,
      errorCode: sourceError?.code,
    });
    return fail(
      `SOURCE access failed: status=${statusCode}, fileId=${resolvedSourceFolderId}. Check service account membership in Shared Drive.`,
      400,
      true,
      authMode
    );
  }
  
  // Check DEST access
  try {
    const destRes = await drive.files.get({
      fileId: effectiveDestinationFolderId,
      fields: 'id,name,mimeType,driveId,parents',
      supportsAllDrives: true,
    });
    destMeta = destRes.data;
    console.log(`[drive-access] DEST:`, {
      id: destMeta.id,
      name: destMeta.name,
      mimeType: destMeta.mimeType,
      driveId: destMeta.driveId ?? 'null (My Drive)',
      parents: destMeta.parents ?? null,
    });
    
    // Drive context log: compare source and destination drive locations
    console.log(`[drive-context] SOURCE { id: ${sourceMeta.id}, driveId: ${sourceMeta.driveId ?? 'null (My Drive)'}, parents: ${JSON.stringify(sourceMeta.parents ?? null)} }`);
    console.log(`[drive-context] DEST   { id: ${destMeta.id}, driveId: ${destMeta.driveId ?? 'null (My Drive)'}, parents: ${JSON.stringify(destMeta.parents ?? null)} }`);
  } catch (destError: any) {
    const statusCode = destError?.response?.status ?? destError?.code ?? 'unknown';
    const responseData = destError?.response?.data ?? destError?.errors ?? null;
    console.error(`[drive-access] DEST FAILED:`, {
      fileId: effectiveDestinationFolderId,
      statusCode,
      responseData,
      errorMessage: destError?.message,
      errorCode: destError?.code,
    });
    return fail(
      `DEST access failed: status=${statusCode}, fileId=${effectiveDestinationFolderId}. Check service account membership in Shared Drive.`,
      400,
      true,
      authMode
    );
  }
  
  // Run the actual preflight validation (type checks) - only for folders
  if (!isSourceFile) {
    try {
      await preflightFolderCopy(drive, resolvedSourceFolderId, effectiveDestinationFolderId);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return fail(message, 400, true, authMode);
    }
  }

  if (dryRun) {
    logStructured({
      requestId,
      airtableRecordId,
      sourceFolderId,
      destinationFolderId: effectiveDestinationFolderId,
      dryRun: true,
      result: 'dry_run',
      authMode,
    });
    return {
      ok: true,
      dryRun: true,
      resolvedDestinationFolderId: effectiveDestinationFolderId,
      wouldCopyFileId: sourceFolderId,
      authMode,
      result: 'dry_run',
    };
  }

  // Use the isSourceFile flag we determined earlier
  const isFolder = !isSourceFile;
  const dateStr = new Date().toISOString().slice(0, 10);
  const deliveredFolderName = projectName 
    ? `Delivered – ${projectName.trim()} – ${dateStr}`
    : `Delivered – ${dateStr}`;
  
  console.log(`[delivery/partner] ${requestId} Source type: ${isFolder ? 'folder' : 'file'}, sourceId=${sourceFolderId}, resolvedSourceId=${resolvedSourceFolderId}, destination=${effectiveDestinationFolderId}, folderName="${deliveredFolderName}"`);
  console.log(`[delivery/partner] ${requestId} Destination folder URL: ${folderUrl(effectiveDestinationFolderId)}`);

  try {
    if (isFolder) {
      // Copy entire folder tree
      console.log(`[delivery/copy] START`, {
        sourceId: resolvedSourceFolderId,
        destFolderId: effectiveDestinationFolderId,
        destFolderUrl: folderUrl(effectiveDestinationFolderId),
        reason: 'copying folder tree',
        sourceType: 'folder',
      });
      const result = await copyDriveFolderTree(drive, resolvedSourceFolderId, effectiveDestinationFolderId, {
        deliveredFolderName,
        drive,
      });
      console.log(`[delivery/copy] DONE`, {
        sourceId: resolvedSourceFolderId,
        createdFileOrFolderId: result.deliveredRootFolderId,
        deliveredFolderUrl: result.deliveredRootFolderUrl,
      });
      console.log(`[delivery/partner] ${requestId} Copy completed: filesCopied=${result.filesCopied}, foldersCreated=${result.foldersCreated}, failures=${result.failures.length}, deliveredFolderId=${result.deliveredRootFolderId}`);
      console.log(`[delivery/partner] ${requestId} Delivered folder URL: ${result.deliveredRootFolderUrl}`);
      
      if (result.filesCopied === 0) {
        console.warn(`[delivery/partner] ${requestId} WARNING: Copy succeeded but 0 files were copied. Source folder ${resolvedSourceFolderId} may be empty or inaccessible. Check source folder: ${folderUrl(resolvedSourceFolderId)}`);
      }
      
      if (result.failures.length > 0) {
        console.warn(`[delivery/partner] ${requestId} Copy had ${result.failures.length} failures:`, result.failures);
      }
      
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
        destinationFolderId: effectiveDestinationFolderId,
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
    } else {
      // Copy single file (use original sourceFolderId, not resolvedSourceFolderId)
      console.log(`[delivery/partner] ${requestId} Copying single file: sourceFileId=${sourceFolderId}, destinationFolderId=${effectiveDestinationFolderId}`);
      console.log(`[delivery/copy] START`, {
        sourceId: sourceFolderId,
        destFolderId: effectiveDestinationFolderId,
        destFolderUrl: folderUrl(effectiveDestinationFolderId),
        reason: 'copying single file',
        sourceType: 'file',
      });
      const fileResult = await copyFileToFolder(sourceFolderId, effectiveDestinationFolderId, {
        drive,
        requestId,
      });
      console.log(`[delivery/copy] DONE`, {
        sourceId: sourceFolderId,
        createdFileOrFolderId: fileResult.id,
        fileName: fileResult.name,
        fileUrl: fileResult.url,
      });
      console.log(`[delivery/partner] ${requestId} File copy completed: fileId=${fileResult.id}, fileName="${fileResult.name}", fileUrl=${fileResult.url}`);
      
      await updateAssetStatusDeliverySuccess(airtableRecordId, {
        deliveredFolderId: effectiveDestinationFolderId,
        deliveredFolderUrl: fileResult.url,
        filesCopied: 1,
        foldersCreated: 0,
      });
      logStructured({
        requestId,
        airtableRecordId,
        sourceFolderId,
        destinationFolderId: effectiveDestinationFolderId,
        dryRun: false,
        result: 'ok',
        authMode,
      });
      return {
        ok: true,
        deliveredFileUrl: fileResult.url,
        deliveredRootFolderId: effectiveDestinationFolderId,
        foldersCreated: 0,
        filesCopied: 1,
        failures: [],
        authMode,
        result: 'ok',
      };
    }
  } catch (e: any) {
    const raw = e instanceof Error ? e.message : String(e);
    const statusCode = e?.response?.status ?? e?.code ?? 'unknown';
    const responseData = e?.response?.data ?? e?.errors ?? null;
    
    // Log raw error details for diagnosis
    console.error(`[delivery/partner] ${requestId} Copy operation failed:`, {
      errorMessage: raw,
      statusCode,
      responseData,
      errorCode: e?.code,
      authMode,
      sourceId: resolvedSourceFolderId,
      destId: effectiveDestinationFolderId,
    });
    
    const is403404 =
      statusCode === 403 ||
      statusCode === 404 ||
      raw.includes('403') ||
      raw.includes('404') ||
      raw.includes('not found') ||
      raw.toLowerCase().includes('permission');

    let message: string;
    if (authMode === 'oauth' && is403404) {
      message = `OAuth copy failed (status=${statusCode})—check token validity and source folder permissions.`;
    } else if (authMode === 'wif_service_account' && is403404) {
      message = `Service account cannot access source/destination (status=${statusCode}). Ensure the service account is a MEMBER of the Shared Drive. Raw error: ${JSON.stringify(responseData)}`;
    } else {
      message = `${raw} (status=${statusCode})`;
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
  const tokenTrimmed = (token ?? '').trim();
  if (tokenTrimmed) {
    // Priority 1: OAuth token provided
    const resolved = await resolveReviewProject(tokenTrimmed);
    if (!resolved?.auth) {
      return { ok: false, error: 'Invalid review portal token (could not resolve project/oauth).', statusCode: 400 };
    }
    authMode = 'oauth';
    drive = getDriveClientWithOAuth(resolved.auth);
  } else {
    // Priority 2: WIF with USE_SERVICE_ACCOUNT flag
    if (process.env.USE_SERVICE_ACCOUNT === 'true') {
      const vercelOidcTokenToUse = oidcToken ?? process.env.VERCEL_OIDC_TOKEN;
      if (!vercelOidcTokenToUse) {
        return {
          ok: false,
          error: 'USE_SERVICE_ACCOUNT=true requires VERCEL_OIDC_TOKEN to be set or passed explicitly.',
          statusCode: 500,
          authMode: 'wif_service_account',
        };
      }
      try {
        drive = await getDriveClient({ vercelOidcToken: vercelOidcTokenToUse });
        authMode = 'wif_service_account';
      } catch (wifError) {
        const wifMsg = wifError instanceof Error ? wifError.message : String(wifError);
        console.error(`[delivery/partner-by-batch] WIF authentication failed:`, wifMsg);
        return {
          ok: false,
          error: `WIF authentication failed: ${wifMsg}`,
          statusCode: 500,
          authMode: 'wif_service_account',
        };
      }
    } else {
      // Priority 3: Hard error
      return {
        ok: false,
        error: 'No OAuth token provided and USE_SERVICE_ACCOUNT is not enabled. Set USE_SERVICE_ACCOUNT=true to use WIF, or provide an OAuth token.',
        statusCode: 500,
        authMode: 'wif_service_account',
      };
    }
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  const deliveredFolderName = `Delivered – ${dateStr}`;

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

  // Idempotency check: check if folder with same name already exists
  const escapedFolderName = deliveredFolderName.replace(/'/g, "\\'");
  let createdFolderId: string;
  try {
    const existingRes = await drive.files.list({
      q: `'${destinationFolderId.replace(/'/g, "\\'")}' in parents and name = '${escapedFolderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      pageSize: 1,
    });
    const existingFolders = existingRes.data.files ?? [];
    if (existingFolders.length > 0) {
      createdFolderId = existingFolders[0].id!;
      console.log(`[drive] reuse folder: name="${deliveredFolderName}", folderId=${createdFolderId}`);
    } else {
      // Create new folder
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
    }
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Failed to create or find delivered folder: ${raw}`, statusCode: 500, authMode };
  }

  const failures: Array<{ id: string; name?: string; reason: string }> = [];
  let filesCopied = 0;
  console.log(`[delivery/copy] BATCH_COPY_START`, {
    approvedCount: approved.length,
    destFolderId: createdFolderId,
    destFolderUrl: folderUrl(createdFolderId),
    fileIds: approved.map(a => a.driveId),
  });
  for (const { driveId } of approved) {
    try {
      console.log(`[delivery/copy] START`, {
        sourceId: driveId,
        destFolderId: createdFolderId,
        destFolderUrl: folderUrl(createdFolderId),
        reason: 'copying approved asset',
      });
      await copyFileToFolder(driveId, createdFolderId, { drive });
      console.log(`[delivery/copy] DONE`, {
        sourceId: driveId,
        createdFileOrFolderId: 'copied',
      });
      filesCopied++;
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      console.log(`[delivery/copy] SKIPPING`, {
        sourceId: driveId,
        destFolderId: createdFolderId,
        reason: `copy failed: ${reason}`,
      });
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
  oidcToken?: string | null;
}): Promise<PartnerDeliveryFromPortalResult> {
  const {
    airtableRecordId,
    deliveryBatchId,
    destinationFolderId,
    approvedFileIds,
    dryRun = false,
    oidcToken,
  } = params;

  // Use unified factory for WIF auth
  const drive = await getDriveClient({ vercelOidcToken: oidcToken ?? process.env.VERCEL_OIDC_TOKEN ?? null });
  const dateStr = new Date().toISOString().slice(0, 10);
  
  // Get batch record ID for stable folder key (not the editable Batch ID name)
  let batchRecordId: string | null = null;
  let batchName: string | null = null;
  if (deliveryBatchId) {
    // Check if deliveryBatchId is already a record ID (starts with 'rec')
    if (deliveryBatchId.trim().startsWith('rec')) {
      batchRecordId = deliveryBatchId.trim();
      const batchDetails = await getBatchDetailsByRecordId(batchRecordId);
      batchName = batchDetails?.deliveryBatchId || null;
    } else {
      // It's a Batch ID string (name) - look up the record ID
      const batchDetails = await getBatchDetails(deliveryBatchId.trim());
      batchRecordId = batchDetails?.recordId || null;
      batchName = batchDetails?.deliveryBatchId || deliveryBatchId.trim();
    }
  }
  
  // Use stable batch record ID for folder key, but human-readable name for display
  const folderKey = batchRecordId ? `delivery-batch-${batchRecordId}` : airtableRecordId;
  const folderNameSuffix = batchName || airtableRecordId;
  const deliveredFolderName = `Delivered – ${folderNameSuffix} – ${dateStr}`;
  
  console.log("[delivery/batch]", {
    batchRecordId,
    batchName,
    folderKey,
    deliveredFolderName,
  });

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

  // Idempotency check: use stable folder key for lookup (not the display name)
  // This ensures folder lookup works even if batch name changes
  const stableFolderName = `Delivered – ${folderKey} – ${dateStr}`;
  const escapedStableFolderName = stableFolderName.replace(/'/g, "\\'");
  let createdFolderId: string;
  try {
    // First try to find folder by stable key
    const existingRes = await drive.files.list({
      q: `'${destinationFolderId.replace(/'/g, "\\'")}' in parents and name = '${escapedStableFolderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      pageSize: 1,
    });
    const existingFolders = existingRes.data.files ?? [];
    if (existingFolders.length > 0) {
      createdFolderId = existingFolders[0].id!;
      console.log(`[drive] reuse folder: stableKey="${stableFolderName}", folderId=${createdFolderId}`);
      // Update folder name to current batch name if it changed
      if (deliveredFolderName !== stableFolderName) {
        try {
          await drive.files.update({
            fileId: createdFolderId,
            requestBody: { name: deliveredFolderName },
            supportsAllDrives: true,
          });
          console.log(`[drive] updated folder name to current batch name: "${deliveredFolderName}"`);
        } catch (updateErr) {
          console.warn(`[drive] failed to update folder name (non-critical):`, updateErr instanceof Error ? updateErr.message : updateErr);
        }
      }
    } else {
      // Create new folder with human-readable name
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
      console.log(`[drive] created new folder: name="${deliveredFolderName}", folderId=${createdFolderId}`);
    }
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error: `Failed to create or find delivered folder: ${raw}`,
      statusCode: 500,
    };
  }

  const failures: PortalDeliveryFailure[] = [];
  let filesCopied = 0;
  console.log(`[delivery/copy] PORTAL_BATCH_COPY_START`, {
    approvedCount: approvedFileIds.length,
    destFolderId: createdFolderId,
    destFolderUrl: folderUrl(createdFolderId),
    fileIds: approvedFileIds,
  });
  for (const fileId of approvedFileIds) {
    try {
      console.log(`[delivery/copy] START`, {
        sourceId: fileId,
        destFolderId: createdFolderId,
        destFolderUrl: folderUrl(createdFolderId),
        reason: 'copying approved asset from portal',
      });
      await copyFileToFolder(fileId, createdFolderId, { drive });
      console.log(`[delivery/copy] DONE`, {
        sourceId: fileId,
        createdFileOrFolderId: 'copied',
      });
      filesCopied++;
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      console.log(`[delivery/copy] SKIPPING`, {
        sourceId: fileId,
        destFolderId: createdFolderId,
        reason: `copy failed: ${reason}`,
      });
      failures.push({ fileId, reason });
    }
  }

  const deliveredFolderUrl = folderUrl(createdFolderId);
  const deliverySummary = {
    approvedCount: approvedFileIds.length,
    filesCopied,
    failures,
  };

  // Best-effort Airtable write-back - don't fail delivery if it fails
  try {
    await updateDeliveryResultToRecord(airtableRecordId, {
      deliveredFolderId: createdFolderId,
      deliveredFolderUrl,
      approvedCount: approvedFileIds.length,
      filesCopied,
      failures,
    });
    console.log('[delivery/partner] Successfully wrote delivery result to Airtable batch record:', airtableRecordId);
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    // IMPORTANT: Log warning but don't fail delivery - Drive copy succeeded
    console.warn('[delivery/partner] Failed to write back delivery result to Airtable (non-blocking):', raw, {
      batchRecordId: airtableRecordId,
      deliveredFolderId: createdFolderId,
    });
    // Continue - delivery is successful even if Airtable write-back fails
  }

  const now = new Date().toISOString();
  if (deliveryBatchId) {
    const failedFileIds = new Set(failures.map((f) => f.fileId));
    const successfullyCopiedFileIds = approvedFileIds.filter((id) => !failedFileIds.has(id));
    const recordsToMark = await getRecordIdsByBatchIdAndFileIds(
      deliveryBatchId,
      successfullyCopiedFileIds
    );
    // Build summary object for "Deliver Summary (text/json)" field
    const summaryObj = {
      approvedCount: approvedFileIds.length,
      filesCopied,
      failures: failures.length > 0 ? failures.map(f => ({ fileId: f.fileId, reason: f.reason })) : [],
    };
    
    const assetPayload = {
      kind: 'success' as const,
      deliveryStatus: 'Delivered' as const,
      deliveredAt: now,
      deliveredCheckbox: true as const,
      deliveredFolderId: createdFolderId,
      deliveredFolderUrl,
      deliverySummary: summaryObj, // Will be JSON stringified in writeDeliveryToRecord
    };
    for (const { recordId } of recordsToMark) {
      try {
        const result = await writeDeliveryToRecord(
          CREATIVE_REVIEW_ASSET_STATUS_TABLE,
          recordId,
          assetPayload
        );
        if (!result.ok) {
          console.warn(`[delivery/partner] Airtable write-back failed for asset ${recordId} (non-blocking):`, result.error);
        }
      } catch (e) {
        // IMPORTANT: Don't fail delivery - log warning but continue
        console.warn(`[delivery/partner] Failed to mark asset ${recordId} delivered (non-blocking):`, e instanceof Error ? e.message : e);
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
