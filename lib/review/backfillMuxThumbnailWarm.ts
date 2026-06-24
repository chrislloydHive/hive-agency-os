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
  }>;
}

/**
 * For each client-visible CRAS row in this portal with muxStatus=ready and a playback ID,
 * fire a GET to warm the primary grid poster on Mux's CDN.
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

  let warmedCount = 0;
  for (const rec of candidates) {
    if (limit != null && warmedCount >= limit) break;

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

    if (dryRun) {
      result.warmed += 1;
      warmedCount += 1;
      result.trace.push({
        crasRecordId: rec.recordId,
        filename: rec.filename,
        playbackId,
        action: 'would-warm',
      });
      continue;
    }

    try {
      warmMuxThumbnailCache(playbackId);
      result.warmed += 1;
      warmedCount += 1;
      result.trace.push({
        crasRecordId: rec.recordId,
        filename: rec.filename,
        playbackId,
        action: 'warmed',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`${rec.recordId}: ${msg}`);
    }
  }

  return result;
}
