import { muxThumbnailUrl } from '@/lib/review/muxThumbnail';

/**
 * Fire-and-forget GET to Mux's image CDN so the primary grid poster is cached
 * before a client opens the review portal. Logs failures; never throws.
 */
export function warmMuxThumbnailCache(playbackId: string): void {
  const id = playbackId?.trim();
  if (!id) return;

  const url = muxThumbnailUrl(id);

  void fetch(url, { method: 'GET' })
    .then((res) => {
      if (!res.ok) {
        console.warn('[mux/thumbnail-warm] non-ok response', {
          playbackId: id,
          status: res.status,
          url,
        });
      }
    })
    .catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[mux/thumbnail-warm] fetch failed', { playbackId: id, error: msg, url });
    });
}
