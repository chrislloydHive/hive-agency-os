/**
 * Mux webhook event handling → CRAS row updates (passthrough = CRAS record id).
 */

import { getProjectsBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import {
  CRAS_MUX_ASPECT_RATIO_FIELD,
  CRAS_MUX_ASSET_ID_FIELD,
  CRAS_MUX_DURATION_FIELD,
  CRAS_MUX_ERROR_FIELD,
  CRAS_MUX_PLAYBACK_ID_FIELD,
  CRAS_MUX_STATUS_FIELD,
  CRAS_MUX_UPLOAD_ID_FIELD,
} from '@/lib/mux/crasMuxFields';
import { getMuxClient, getMuxWebhookSecret } from '@/lib/mux/client';

const CRAS_TABLE = AIRTABLE_TABLES.CREATIVE_REVIEW_ASSET_STATUS;

export type MuxWebhookProcessResult =
  | { handled: true; type: string; crasRecordId?: string }
  | { handled: false; reason: string };

function isRecordId(s: string): boolean {
  return /^rec[a-zA-Z0-9]{14,}$/.test(s.trim());
}

function playbackIdFromAsset(asset: { playback_ids?: Array<{ id?: string; policy?: string }> }): string | null {
  const ids = asset.playback_ids;
  if (!Array.isArray(ids) || ids.length === 0) return null;
  const pub = ids.find((p) => p.policy === 'public' && p.id);
  const first = ids.find((p) => p.id);
  return (pub?.id ?? first?.id ?? null) as string | null;
}

/**
 * Verify signature and apply CRAS updates for supported Mux event types.
 */
function escapeFormulaValue(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

async function findCrasIdByMuxUploadId(uploadId: string): Promise<string | null> {
  const id = uploadId.trim();
  if (!id) return null;
  const base = getProjectsBase();
  const formula = `{${CRAS_MUX_UPLOAD_ID_FIELD}} = "${escapeFormulaValue(id)}"`;
  try {
    const recs = await base(CRAS_TABLE).select({ filterByFormula: formula, maxRecords: 1 }).firstPage();
    return recs[0]?.id ?? null;
  } catch {
    return null;
  }
}

export async function processMuxWebhook(
  rawBody: string,
  headers: Headers,
): Promise<MuxWebhookProcessResult> {
  const secret = getMuxWebhookSecret();
  if (!secret) {
    return { handled: false, reason: 'MUX_WEBHOOK_SIGNING_SECRET not configured' };
  }

  const client = getMuxClient();
  if (!client) {
    return { handled: false, reason: 'Mux client not configured' };
  }

  try {
    await client.webhooks.verifySignature(rawBody, headers, secret);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { handled: false, reason: `signature: ${msg}` };
  }

  let event: { type?: string; data?: unknown };
  try {
    event = JSON.parse(rawBody) as { type?: string; data?: unknown };
  } catch {
    return { handled: false, reason: 'invalid JSON' };
  }

  const type = event.type ?? '';
  const base = getProjectsBase();

  if (type === 'video.asset.ready') {
    const asset = event.data as {
      id?: string;
      passthrough?: string;
      duration?: number;
      aspect_ratio?: string;
      playback_ids?: Array<{ id?: string; policy?: string }>;
    };
    const crasId = typeof asset.passthrough === 'string' && isRecordId(asset.passthrough) ? asset.passthrough.trim() : null;
    if (!crasId) {
      console.warn('[mux/webhook] video.asset.ready missing passthrough CRAS id', { assetId: asset.id });
      return { handled: true, type };
    }
    const playbackId = playbackIdFromAsset(asset);
    const fields: Record<string, unknown> = {
      [CRAS_MUX_STATUS_FIELD]: 'ready',
    };
    if (asset.id) fields[CRAS_MUX_ASSET_ID_FIELD] = asset.id;
    if (playbackId) fields[CRAS_MUX_PLAYBACK_ID_FIELD] = playbackId;
    if (typeof asset.duration === 'number' && Number.isFinite(asset.duration)) {
      fields[CRAS_MUX_DURATION_FIELD] = asset.duration;
    }
    if (typeof asset.aspect_ratio === 'string' && asset.aspect_ratio.trim()) {
      fields[CRAS_MUX_ASPECT_RATIO_FIELD] = asset.aspect_ratio.trim();
    }
    await base(CRAS_TABLE).update(crasId, fields as any);
    console.log('[mux/webhook] video.asset.ready', { crasRecordId: crasId, playbackId, assetId: asset.id });
    return { handled: true, type, crasRecordId: crasId };
  }

  if (type === 'video.asset.errored') {
    const asset = event.data as {
      id?: string;
      passthrough?: string;
      errors?: { type?: string; messages?: string[] };
    };
    const crasId = typeof asset.passthrough === 'string' && isRecordId(asset.passthrough) ? asset.passthrough.trim() : null;
    const errParts = asset.errors?.messages?.length
      ? asset.errors.messages.join('; ')
      : asset.errors?.type || 'unknown error';
    if (!crasId) {
      console.warn('[mux/webhook] video.asset.errored missing passthrough', { assetId: asset.id });
      return { handled: true, type };
    }
    await base(CRAS_TABLE).update(crasId, {
      [CRAS_MUX_STATUS_FIELD]: 'errored',
      [CRAS_MUX_ERROR_FIELD]: errParts,
      ...(asset.id ? { [CRAS_MUX_ASSET_ID_FIELD]: asset.id } : {}),
    } as any);
    console.log('[mux/webhook] video.asset.errored', { crasRecordId: crasId, errParts });
    return { handled: true, type, crasRecordId: crasId };
  }

  if (type === 'video.upload.asset_created') {
    const data = event.data as {
      id?: string;
      asset_id?: string;
      passthrough?: string;
    };
    let crasId =
      typeof data.passthrough === 'string' && isRecordId(data.passthrough)
        ? data.passthrough.trim()
        : null;
    if (!crasId && data.id) {
      crasId = await findCrasIdByMuxUploadId(data.id);
    }
    if (crasId && data.asset_id) {
      await base(CRAS_TABLE).update(crasId, {
        [CRAS_MUX_ASSET_ID_FIELD]: data.asset_id,
        ...(data.id ? { [CRAS_MUX_UPLOAD_ID_FIELD]: data.id } : {}),
      } as any);
      console.log('[mux/webhook] video.upload.asset_created', { crasRecordId: crasId, assetId: data.asset_id });
      return { handled: true, type, crasRecordId: crasId };
    }
    return { handled: true, type };
  }

  return { handled: false, reason: `ignored event: ${type}` };
}
