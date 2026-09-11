// Event-driven Mux ingest for review-portal videos that already have CRAS
// (typically created on first portal open) but no Mux playback ID yet.
// Uses the same company OAuth Drive client as /api/review/files, because that
// identity can already download the file — the ingest-cron service account often cannot.

import { google } from 'googleapis';
import { inngest } from '../client';
import { resolveReviewProject } from '@/lib/review/resolveProject';
import { backfillMux } from '@/lib/review/backfillMux';
import { REVIEW_MUX_BACKFILL_EVENT } from '@/lib/review/requestMuxBackfill';

export const reviewMuxBackfillOnDemand = inngest.createFunction(
  {
    id: 'review-mux-backfill',
    name: 'Review portal Mux backfill (OAuth Drive)',
    retries: 1,
    concurrency: {
      limit: 1,
      key: 'event.data.token',
    },
  },
  { event: REVIEW_MUX_BACKFILL_EVENT },
  async ({ event, step }) => {
    const token = typeof event.data?.token === 'string' ? event.data.token.trim() : '';
    if (!token) {
      console.warn('[review/mux-backfill] missing token');
      return { ok: false, error: 'missing_token' };
    }

    return step.run('backfill-mux', async () => {
      const resolved = await resolveReviewProject(token);
      if (!resolved) {
        console.warn('[review/mux-backfill] invalid token');
        return { ok: false, error: 'invalid_token' };
      }
      const drive = google.drive({ version: 'v3', auth: resolved.auth });
      const result = await backfillMux({ drive, token, limit: 12 });
      console.log('[review/mux-backfill] done', {
        triggered: result.triggered,
        alreadyHasMux: result.alreadyHasMux,
        notVideo: result.notVideo,
        errors: result.errors.length,
      });
      return {
        ok: true,
        triggered: result.triggered,
        alreadyHasMux: result.alreadyHasMux,
        notVideo: result.notVideo,
        errorCount: result.errors.length,
      };
    });
  },
);
