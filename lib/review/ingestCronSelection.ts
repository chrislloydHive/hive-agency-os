// lib/review/ingestCronSelection.ts
// Decide which Drive files the creative ingest cron should send to ingestFileToCras.
//
// Portal SSR creates CRAS via batchEnsureCrasRecords without starting Mux.
// The cron used to skip every file that already had a CRAS row, so Display
// (and other) videos never received a playback ID and the portal fell back to
// native <video> → "Download to view".

import { crasFieldsHaveAnyMuxIdentifier } from '@/lib/mux/crasMuxFields';
import { reviewAssetIsVideo } from '@/lib/review/reviewMediaDisplay';

export interface ExistingCrasIndexEntry {
  hasMuxIdentifier: boolean;
  filename: string | null;
}

export const INGEST_CRON_MAX_MUX_BACKFILL_PER_PROJECT = 25;

export function driveFileIdFromCrasSourceField(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const t = raw.trim();
  if (!t) return '';
  const fromUrl = t.match(/\/d\/([a-zA-Z0-9_-]{15,})/) ?? t.match(/[?&]id=([a-zA-Z0-9_-]{15,})/);
  return fromUrl?.[1] ?? t;
}

export function existingCrasEntryFromFields(fields: Record<string, unknown>): ExistingCrasIndexEntry {
  const filenameRaw = fields.Filename;
  return {
    hasMuxIdentifier: crasFieldsHaveAnyMuxIdentifier(fields),
    filename: typeof filenameRaw === 'string' && filenameRaw.trim() ? filenameRaw.trim() : null,
  };
}

export type IngestCronFileAction = 'new' | 'mux-backfill' | 'skip';

export function ingestCronFileAction(
  file: { id: string; name: string },
  existingByFileId: Map<string, ExistingCrasIndexEntry>,
): IngestCronFileAction {
  const existing = existingByFileId.get(file.id);
  if (!existing) return 'new';
  if (existing.hasMuxIdentifier) return 'skip';
  const name = file.name || existing.filename || '';
  if (reviewAssetIsVideo('', name)) return 'mux-backfill';
  return 'skip';
}

export function selectIngestCronFiles<T extends { id: string; name: string }>(
  files: T[],
  existingByFileId: Map<string, ExistingCrasIndexEntry>,
  muxBackfillLimit = INGEST_CRON_MAX_MUX_BACKFILL_PER_PROJECT,
): { toProcess: T[]; newCount: number; muxBackfillCount: number; skipped: number } {
  const toProcess: T[] = [];
  let newCount = 0;
  let muxBackfillCount = 0;
  let skipped = 0;

  for (const file of files) {
    const action = ingestCronFileAction(file, existingByFileId);
    if (action === 'new') {
      toProcess.push(file);
      newCount += 1;
      continue;
    }
    if (action === 'mux-backfill') {
      if (muxBackfillCount >= muxBackfillLimit) {
        skipped += 1;
        continue;
      }
      toProcess.push(file);
      muxBackfillCount += 1;
      continue;
    }
    skipped += 1;
  }

  return { toProcess, newCount, muxBackfillCount, skipped };
}
