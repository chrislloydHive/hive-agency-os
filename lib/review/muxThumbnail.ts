/**
 * CRAS Mux fields: aspect strings (e.g. "9:16") and image.mux.com thumbnail URLs for review UI.
 */

export type MuxThumbnailFitMode = 'preserve' | 'smartcrop';

/** Parse CRAS "Mux Aspect Ratio" (e.g. 9:16, 4:5) for CSS and layout; default 16:9. */
export function parseMuxAspectDimensions(muxAspectRatio: string | null | undefined): {
  cssRatio: string;
  widthNum: number;
  heightNum: number;
} {
  const raw = muxAspectRatio?.trim();
  if (!raw) return { cssRatio: '16/9', widthNum: 16, heightNum: 9 };
  const compact = raw.replace(/\s+/g, '').replace(/×/g, ':');
  const parts = compact.includes(':') ? compact.split(':') : compact.split('/');
  if (parts.length === 2) {
    const widthNum = parseFloat(parts[0]);
    const heightNum = parseFloat(parts[1]);
    if (widthNum > 0 && heightNum > 0) {
      return { cssRatio: `${widthNum}/${heightNum}`, widthNum, heightNum };
    }
  }
  return { cssRatio: '16/9', widthNum: 16, heightNum: 9 };
}

/** CSS `aspect-ratio` value (e.g. for grid / lightbox containers). */
export function muxAspectRatioCssString(muxAspectRatio: string | null | undefined): string {
  return parseMuxAspectDimensions(muxAspectRatio).cssRatio;
}

/**
 * Mux static thumbnail for a playback ID. Uses 2× logical px for retina, clamped for CDN.
 * @see https://docs.mux.com/guides/video/get-images-from-a-video
 */
export function muxThumbnailImageUrl(
  playbackId: string,
  opts: {
    /** Non-square: logical width of the tile in CSS px (request uses 2×). */
    logicalWidthPx?: number;
    /** Square tiles: logical edge length in CSS px (width & height use 2×). */
    squareLogicalPx?: number;
    fitMode: MuxThumbnailFitMode;
  },
): string {
  const id = encodeURIComponent(playbackId.trim());
  const params = new URLSearchParams();
  if (opts.squareLogicalPx != null) {
    const edge = Math.round(Math.min(1280, Math.max(120, opts.squareLogicalPx * 2)));
    params.set('width', String(edge));
    params.set('height', String(edge));
  } else {
    const logical = opts.logicalWidthPx ?? 320;
    const w = Math.round(Math.min(1280, Math.max(240, logical * 2)));
    params.set('width', String(w));
  }
  params.set('fit_mode', opts.fitMode);
  return `https://image.mux.com/${id}/thumbnail.jpg?${params.toString()}`;
}

/** True when CRAS Mux pipeline has a playable asset and we can use image.mux.com posters. */
export function muxPlaybackReadyForThumbnail(
  muxStatus: string | null | undefined,
  muxPlaybackId: string | null | undefined,
): boolean {
  const ms = (muxStatus ?? '').toLowerCase();
  const pid = muxPlaybackId?.trim();
  return ms === 'ready' && Boolean(pid);
}
