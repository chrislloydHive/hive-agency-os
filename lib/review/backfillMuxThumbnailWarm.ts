import { listAssetStatuses } from '@/lib/airtable/reviewAssetStatus';
import { muxPlaybackReadyForThumbnail } from '@/lib/review/muxThumbnail';
import { warmMuxThumbnailCache } from '@/lib/review/warmMuxThumbnail';

export interface BackfillMuxThumbnailWarmResult {
  considered: number;
  warmed: number;
  skipped: number;
  errors: string[];
  trace: Array<{
    crasRecordId: string;
    filename: string | null;
    playbackId: string;
    action: 'would-warm' | 'warmed' | 'skip-not-ready';
    urlCount?: number;
  }>;
}

const ASSET_CONCURRENCY = 3;

/**
 * For each client-visible CRAS row in this portal with muxStatus=ready and a playback ID,
 * await GETs for every portal poster variant on Mux's CDN.
 */
export async function backfillMuxThumbnailWarm(params: {
  token: string;
  dryRun?: boolean;
  limit?: number;
}): Promise<BackfillMuxThumbnailWarmResult> {
  const { token, dryRun = false, limit } = params;
  const result: BackfillMuxThumbnailWarmResult = {
    considered: 0,
    warmed: 0,
    skipped: 0,
    errors: [],
    trace: [],
  };

  const statusMap = await listAssetStatuses(token);
  const candidates = Array.from(statusMap.values()).filter(
    (rec) => rec.driveFileId && rec.showInClientPortal && !rec.hidden,
  );
  result.considered = candidates.length;

  const toWarm: typeof candidates = [];
  for (const rec of candidates) {
    const playbackId = rec.muxPlaybackId?.trim() ?? '';
    if (!muxPlaybackReadyForThumbnail(rec.muxStatus, playbackId)) {
      result.skipped += 1;
      result.trace.push({
        crasRecordId: rec.recordId,
        filename: rec.filename,
        playbackId,
        action: 'skip-not-ready',
      });
      continue;
    }
    toWarm.push(rec);
  }

  const capped = limit != null ? toWarm.slice(0, limit) : toWarm;

  if (dryRun) {
    for (const rec of capped) {
      result.warmed += 1;
      result.trace.push({
        crasRecordId: rec.recordId,
        filename: rec.filename,
        playbackId: rec.muxPlaybackId!.trim(),
        action: 'would-warm',
      });
    }
    return result;
  }

  for (let i = 0; i < capped.length; i += ASSET_CONCURRENCY) {
    const batch = capped.slice(i, i + ASSET_CONCURRENCY);
    await Promise.all(
      batch.map(async (rec) => {
        const playbackId = rec.muxPlaybackId!.trim();
        try {
          const warm = await warmMuxThumbnailCache(playbackId);
          if (warm.ok === 0 && warm.urls > 0) {
            result.errors.push(`${rec.recordId}: all ${warm.urls} thumbnail warm requests failed`);
          } else {
            result.warmed += 1;
            result.trace.push({
              crasRecordId: rec.recordId,
              filename: rec.filename,
              playbackId,
              action: 'warmed',
              urlCount: warm.urls,
            });
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.errors.push(`${rec.recordId}: ${msg}`);
        }
      }),
    );
  }

  return result;
}
