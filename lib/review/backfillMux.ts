// lib/review/backfillMux.ts
// Backfill Mux ingest for an existing review portal token.
//
// Walks every CRAS row for the token (created previously by backfillCras / live ingest)
// and, for any visible row that has no Mux identifier yet, calls createMuxAssetFromDrive
// — the same entry point the live Inngest pipeline uses. Idempotent: rows that already
// have any Mux identifier are skipped.

import type { drive_v3 } from 'googleapis';

import { getProjectsBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import { listAssetStatuses } from '@/lib/airtable/reviewAssetStatus';
import {
  CRAS_MUX_IDENTIFIER_FIELD_NAMES,
  crasFieldsHaveAnyMuxIdentifier,
} from '@/lib/mux/crasMuxFields';
import { createMuxAssetFromDrive, isCrasAssetEligibleForMux } from '@/lib/mux/createMuxAsset';
import { inferMimeTypeFromFilename } from '@/lib/review/reviewMediaDisplay';

const CRAS_TABLE = AIRTABLE_TABLES.CREATIVE_REVIEW_ASSET_STATUS;

export interface BackfillMuxResult {
  /** Total CRAS rows considered after token + visibility filter. */
  considered: number;
  /** Mux upload was kicked off. */
  triggered: number;
  /** Already had a Mux identifier — left alone. */
  alreadyHasMux: number;
  /** Mux client decided this file isn't a video and skipped it. */
  notVideo: number;
  /** Mux not configured (MUX_TOKEN_ID / MUX_TOKEN_SECRET missing). */
  muxNotConfigured: number;
  /** Hard errors during ingest. */
  errors: string[];
  /** Per-row trace for dry-run / verbose output. */
  trace: Array<{
    crasRecordId: string;
    filename: string | null;
    driveFileId: string;
    action: 'would-trigger' | 'triggered' | 'skip-existing' | 'skip-not-video' | 'skip-mux-unconfigured' | 'error';
    detail?: string;
  }>;
}

/**
 * For each CRAS row in this portal that's visible to clients and has no Mux identifier,
 * trigger Mux ingest. The webhook fills in playbackId / status / aspect ratio asynchronously.
 *
 * @param drive Drive client (must have access to the same files the live ingest uses)
 * @param token Review portal token
 * @param dryRun If true, log what would happen but make no Mux/Airtable writes
 * @param limit Optional cap on how many rows to actually trigger (useful for smoke tests)
 */
export async function backfillMux(params: {
  drive: drive_v3.Drive;
  token: string;
  dryRun?: boolean;
  limit?: number;
}): Promise<BackfillMuxResult> {
  const { drive, token, dryRun = false, limit } = params;
  const result: BackfillMuxResult = {
    considered: 0,
    triggered: 0,
    alreadyHasMux: 0,
    notVideo: 0,
    muxNotConfigured: 0,
    errors: [],
    trace: [],
  };

  // 1. Pull all CRAS rows for this portal (visible + hidden).
  const statusMap = await listAssetStatuses(token);

  // 2. Keep only client-visible rows with a Drive file id.
  const candidates = Array.from(statusMap.values()).filter(
    (rec) => rec.driveFileId && rec.showInClientPortal && !rec.hidden,
  );
  result.considered = candidates.length;

  if (candidates.length === 0) return result;

  // 3. Single batched Airtable read of Mux identifier fields for the candidates.
  //    Cheaper than per-row lookups and matches the read shape ingestFileToCras uses.
  const recordIds = candidates.map((c) => c.recordId);
  const muxFieldsByRecordId = await fetchMuxIdentifierFieldsForRecords(recordIds);

  // `limit` caps actual Mux uploads (or `would-trigger` traces in dry-run mode).
  // Non-video skips and already-has-Mux skips do NOT consume the limit, so
  // `--limit 1` reliably triggers exactly one real video upload.
  let used = 0;

  for (const rec of candidates) {
    const muxFields = muxFieldsByRecordId.get(rec.recordId) ?? {};

    if (crasFieldsHaveAnyMuxIdentifier(muxFields)) {
      result.alreadyHasMux += 1;
      result.trace.push({
        crasRecordId: rec.recordId,
        filename: rec.filename,
        driveFileId: rec.driveFileId,
        action: 'skip-existing',
      });
      continue;
    }

    // Cheap upfront video check: classify by filename-inferred MIME. Saves a
    // Drive metadata round-trip per non-video and keeps dry-run output focused
    // on rows that would actually be uploaded. createMuxAssetFromDrive does
    // the same check authoritatively against Drive metadata, so anything
    // with an ambiguous extension (no inferred MIME) falls through to it.
    const fileName = rec.filename ?? '';
    const inferredMime = inferMimeTypeFromFilename(fileName) ?? '';
    if (inferredMime && !isCrasAssetEligibleForMux(inferredMime, fileName)) {
      result.notVideo += 1;
      result.trace.push({
        crasRecordId: rec.recordId,
        filename: rec.filename,
        driveFileId: rec.driveFileId,
        action: 'skip-not-video',
        detail: `inferred mime: ${inferredMime}`,
      });
      continue;
    }

    if (limit != null && used >= limit) {
      // Reached the smoke-test cap.
      break;
    }
    used += 1;

    if (dryRun) {
      result.trace.push({
        crasRecordId: rec.recordId,
        filename: rec.filename,
        driveFileId: rec.driveFileId,
        action: 'would-trigger',
      });
      continue;
    }

    try {
      const res = await createMuxAssetFromDrive({
        drive,
        driveFileId: rec.driveFileId,
        crasRecordId: rec.recordId,
        fileName: rec.filename ?? '',
      });
      if (res.ok) {
        result.triggered += 1;
        result.trace.push({
          crasRecordId: rec.recordId,
          filename: rec.filename,
          driveFileId: rec.driveFileId,
          action: 'triggered',
          detail: `uploadId=${res.uploadId}`,
        });
      } else if (res.skipped) {
        // createMuxAssetFromDrive skipped because either the file wasn't a video
        // or Mux env vars aren't set. Distinguish via the error string.
        if (res.error === 'Mux not configured') {
          result.muxNotConfigured += 1;
          result.trace.push({
            crasRecordId: rec.recordId,
            filename: rec.filename,
            driveFileId: rec.driveFileId,
            action: 'skip-mux-unconfigured',
          });
        } else {
          result.notVideo += 1;
          result.trace.push({
            crasRecordId: rec.recordId,
            filename: rec.filename,
            driveFileId: rec.driveFileId,
            action: 'skip-not-video',
            detail: res.error,
          });
        }
      } else {
        result.errors.push(`${rec.recordId} (${rec.filename ?? rec.driveFileId}): ${res.error}`);
        result.trace.push({
          crasRecordId: rec.recordId,
          filename: rec.filename,
          driveFileId: rec.driveFileId,
          action: 'error',
          detail: res.error,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`${rec.recordId} (${rec.filename ?? rec.driveFileId}): ${msg}`);
      result.trace.push({
        crasRecordId: rec.recordId,
        filename: rec.filename,
        driveFileId: rec.driveFileId,
        action: 'error',
        detail: msg,
      });
    }
  }

  return result;
}

/**
 * Fetch Mux identifier fields (Asset/Upload/Playback ID) for a batch of CRAS record IDs.
 * Uses one or more `OR(RECORD_ID()=...)` filterByFormula reads — Airtable caps formula
 * length, so we chunk to stay safely under it.
 */
async function fetchMuxIdentifierFieldsForRecords(
  recordIds: string[],
): Promise<Map<string, Record<string, unknown>>> {
  const out = new Map<string, Record<string, unknown>>();
  if (recordIds.length === 0) return out;

  const base = getProjectsBase();
  const table = base(CRAS_TABLE);
  const CHUNK = 50;

  for (let i = 0; i < recordIds.length; i += CHUNK) {
    const batch = recordIds.slice(i, i + CHUNK);
    const formula = `OR(${batch.map((id) => `RECORD_ID()='${id.replace(/'/g, "\\'")}'`).join(',')})`;
    const rows = await table
      .select({
        filterByFormula: formula,
        fields: [...CRAS_MUX_IDENTIFIER_FIELD_NAMES],
      })
      .all();
    for (const r of rows) {
      out.set(r.id, (r.fields as Record<string, unknown>) ?? {});
    }
  }
  return out;
}
