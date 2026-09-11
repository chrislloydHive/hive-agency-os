import { inngest } from '@/lib/inngest/client';

export const REVIEW_MUX_BACKFILL_EVENT = 'review/mux-backfill.requested' as const;

/** Queue Mux ingest for portal videos missing a playback ID. Never throws. */
export async function requestReviewMuxBackfill(token: string): Promise<void> {
  const trimmed = token.trim();
  if (!trimmed) return;
  try {
    await inngest.send({
      name: REVIEW_MUX_BACKFILL_EVENT,
      data: { token: trimmed },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[review/mux-backfill] inngest.send failed:', msg);
  }
}
