'use client';

import { muxPortalPosterUrls } from '@/lib/review/muxThumbnail';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

/**
 * Grid video poster from image.mux.com (lightweight; dozens of MuxPlayer instances
 * overload the browser and leave tiles blank).
 *
 * When {@link animated} is true (Display banner MP4s), prefers Mux animated.webp/gif
 * so the card loops like a GIF without mounting a player.
 */
export default function GridMuxPoster({
  playbackId,
  alt,
  className = 'absolute inset-0 h-full w-full object-cover',
  layout = 'grid',
  muxAspectRatio,
  animated = false,
  fallback,
}: {
  playbackId: string;
  alt: string;
  className?: string;
  layout?: 'grid' | 'carousel';
  muxAspectRatio?: string | null;
  /** Prefer Mux animated.webp/gif before static thumbnail frames. */
  animated?: boolean;
  /** Rendered when every Mux poster URL fails (e.g. signed playback id). */
  fallback?: ReactNode;
}) {
  const urls = useMemo(
    () => muxPortalPosterUrls(playbackId, layout, { muxAspectRatio, animated }),
    [playbackId, layout, muxAspectRatio, animated],
  );
  const [urlIndex, setUrlIndex] = useState(0);
  const [exhausted, setExhausted] = useState(false);

  useEffect(() => {
    setUrlIndex(0);
    setExhausted(false);
  }, [playbackId, urls]);

  if (exhausted && fallback) {
    return <>{fallback}</>;
  }

  const src = urls[urlIndex];
  if (!src) {
    return fallback ? <>{fallback}</> : null;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={src}
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={className}
      onError={() => {
        if (urlIndex < urls.length - 1) {
          setUrlIndex((i) => i + 1);
          return;
        }
        setExhausted(true);
      }}
    />
  );
}
