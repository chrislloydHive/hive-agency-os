/**
 * Server-side: stream a Drive file into a Mux Direct Upload, then mark CRAS Mux fields.
 * Requires MUX_TOKEN_ID, MUX_TOKEN_SECRET, and a service-account–capable Drive client.
 */

import type { drive_v3 } from 'googleapis';

import { getProjectsBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import { inferMimeTypeFromFilename, reviewAssetIsVideo } from '@/lib/review/reviewMediaDisplay';
import {
  CRAS_MUX_ASSET_ID_FIELD,
  CRAS_MUX_ERROR_FIELD,
  CRAS_MUX_STATUS_FIELD,
  CRAS_MUX_UPLOAD_ID_FIELD,
} from '@/lib/mux/crasMuxFields';
import { getMuxClient } from '@/lib/mux/client';

const CRAS_TABLE = AIRTABLE_TABLES.CREATIVE_REVIEW_ASSET_STATUS;

export function isCrasAssetEligibleForMux(mimeType: string, fileName: string): boolean {
  return reviewAssetIsVideo(mimeType, fileName);
}

async function writeCrasMuxFields(
  crasRecordId: string,
  airtablePatch: Record<string, string | undefined>,
): Promise<void> {
  const base = getProjectsBase();
  const payload: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(airtablePatch)) {
    if (v !== undefined) payload[k] = v;
  }
  if (Object.keys(payload).length === 0) return;
  try {
    await base(CRAS_TABLE).update(crasRecordId, payload as any);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[mux] CRAS Mux field update failed (add Airtable columns if missing):', msg);
  }
}

export type CreateMuxAssetFromDriveResult =
  | { ok: true; uploadId: string; assetId?: string }
  | { ok: false; error: string; skipped?: boolean };

/**
 * Create a Mux direct upload, stream the Drive file into it, and set CRAS Mux Upload ID + Status.
 */
export async function createMuxAssetFromDrive(args: {
  drive: drive_v3.Drive;
  driveFileId: string;
  crasRecordId: string;
  fileName: string;
  mimeTypeHint?: string;
}): Promise<CreateMuxAssetFromDriveResult> {
  const client = getMuxClient();
  if (!client) {
    console.log('[mux] skipped — MUX_TOKEN_ID / MUX_TOKEN_SECRET not configured');
    return { ok: false, error: 'Mux not configured', skipped: true };
  }

  const { drive, driveFileId, crasRecordId, fileName } = args;
  const meta = await drive.files.get({
    fileId: driveFileId,
    fields: 'id,mimeType,size,name',
    supportsAllDrives: true,
  });
  const mime =
    (meta.data.mimeType && meta.data.mimeType.trim()) ||
    inferMimeTypeFromFilename(fileName) ||
    'application/octet-stream';

  if (!isCrasAssetEligibleForMux(mime, fileName)) {
    return { ok: false, error: 'Not a video asset for Mux', skipped: true };
  }

  const sizeStr = meta.data.size;
  const sizeNum = sizeStr && /^\d+$/.test(sizeStr) ? Number(sizeStr) : undefined;

  let upload;
  try {
    upload = await client.video.uploads.create({
      cors_origin: '*',
      timeout: 3600,
      new_asset_settings: {
        playback_policies: ['public'],
        passthrough: crasRecordId,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[mux] uploads.create failed:', msg);
    await writeCrasMuxFields(crasRecordId, {
      [CRAS_MUX_STATUS_FIELD]: 'errored',
      [CRAS_MUX_ERROR_FIELD]: `uploads.create: ${msg}`,
    });
    return { ok: false, error: msg };
  }

  const uploadId = upload.id;
  const uploadUrl = upload.url;
  if (!uploadUrl) {
    const msg = 'Mux upload missing signed URL';
    await writeCrasMuxFields(crasRecordId, {
      [CRAS_MUX_STATUS_FIELD]: 'errored',
      [CRAS_MUX_ERROR_FIELD]: msg,
    });
    return { ok: false, error: msg };
  }

  await writeCrasMuxFields(crasRecordId, {
    [CRAS_MUX_UPLOAD_ID_FIELD]: uploadId,
    [CRAS_MUX_STATUS_FIELD]: 'preparing',
    ...(upload.asset_id ? { [CRAS_MUX_ASSET_ID_FIELD]: upload.asset_id } : {}),
  });

  console.log('[mux] Asset created (direct upload)', { uploadId, crasRecordId, driveFileId });

  try {
    const media = await drive.files.get(
      { fileId: driveFileId, alt: 'media', supportsAllDrives: true },
      { responseType: 'stream' },
    );
    const stream = media.data as NodeJS.ReadableStream;
    const headers: Record<string, string> = {
      'Content-Type': mime,
    };
    if (sizeNum != null && Number.isFinite(sizeNum)) {
      headers['Content-Length'] = String(sizeNum);
    }

    const put = await fetch(uploadUrl, {
      method: 'PUT',
      headers,
      body: stream as unknown as BodyInit,
      duplex: 'half',
    } as RequestInit & { duplex: 'half' });

    if (!put.ok) {
      const text = await put.text().catch(() => '');
      const msg = `Mux upload PUT failed: ${put.status} ${text.slice(0, 500)}`;
      console.error('[mux]', msg);
      await writeCrasMuxFields(crasRecordId, {
        [CRAS_MUX_STATUS_FIELD]: 'errored',
        [CRAS_MUX_ERROR_FIELD]: msg,
      });
      return { ok: false, error: msg };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[mux] Drive→Mux stream failed:', msg);
    await writeCrasMuxFields(crasRecordId, {
      [CRAS_MUX_STATUS_FIELD]: 'errored',
      [CRAS_MUX_ERROR_FIELD]: msg,
    });
    return { ok: false, error: msg };
  }

  let assetId = upload.asset_id;
  try {
    const refreshed = await client.video.uploads.retrieve(uploadId);
    if (refreshed.asset_id) assetId = refreshed.asset_id;
  } catch {
    // non-fatal — webhooks will fill asset id
  }

  if (assetId) {
    await writeCrasMuxFields(crasRecordId, { [CRAS_MUX_ASSET_ID_FIELD]: assetId });
  }

  return { ok: true, uploadId, assetId };
}
