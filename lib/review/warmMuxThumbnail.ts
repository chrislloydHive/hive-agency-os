import { muxPortalPosterWarmUrls } from '@/lib/review/muxThumbnail';

export interface WarmMuxThumbnailResult {
  urls: number;
  ok: number;
  failed: number;
}

const WARM_TIMEOUT_MS = 20_000;

async function warmSingleUrl(url: string, signal?: AbortSignal): Promise<void> {
  const res = await fetch(url, { method: 'GET', signal });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
}

/**
 * Await GETs for every portal poster variant (grid + carousel fallbacks) so Mux
 * generates and CDN-caches frames before clients open the review portal.
 * Logs failures; never throws.
 */
export async function warmMuxThumbnailCache(
  playbackId: string,
  muxAspectRatio?: string | null,
): Promise<WarmMuxThumbnailResult> {
  const id = playbackId?.trim();
  if (!id) return { urls: 0, ok: 0, failed: 0 };

  const urls = muxPortalPosterWarmUrls(id, muxAspectRatio);
  if (urls.length === 0) return { urls: 0, ok: 0, failed: 0 };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WARM_TIMEOUT_MS);

  try {
    const results = await Promise.allSettled(
      urls.map((url) => warmSingleUrl(url, controller.signal)),
    );

    let ok = 0;
    let failed = 0;
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled') {
        ok += 1;
        continue;
      }
      failed += 1;
      const url = urls[i];
      const error =
        result.reason instanceof Error ? result.reason.message : String(result.reason);
      console.warn('[mux/thumbnail-warm] fetch failed', { playbackId: id, url, error });
    }

    return { urls: urls.length, ok, failed };
  } finally {
    clearTimeout(timeout);
  }
}
