'use client';

import { muxAnimatedPreviewUrls, muxPortalPosterDisplayUrls } from '@/lib/review/muxThumbnail';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

/**
 * Grid video poster from image.mux.com (lightweight; dozens of MuxPlayer instances
 * overload the browser and leave tiles blank).
 *
 * Display banners ({@link animated}) use Mux animated WebP/GIF. Those files loop
 * infinitely. Do not remount them after load — that restarts the clip and looks
 * like a flash/pause. Progressive MP4s (`stream.mux.com/{id}/medium.mp4`) 404
 * because CRAS Mux assets are HLS-only.
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
  /** Loop the creative in-grid (Display banner animated preview). */
  animated?: boolean;
  /** Rendered when every Mux poster URL fails (e.g. signed playback id). */
  fallback?: ReactNode;
}) {
  const staticUrls = useMemo(
    () => muxPortalPosterDisplayUrls(playbackId, layout, muxAspectRatio),
    [playbackId, layout, muxAspectRatio],
  );
  const animUrls = useMemo(
    () =>
      animated
        ? muxAnimatedPreviewUrls(playbackId, { width: layout === 'carousel' ? 280 : 480 })
        : [],
    [animated, playbackId, layout],
  );

  const [staticIndex, setStaticIndex] = useState(0);
  const [staticExhausted, setStaticExhausted] = useState(false);
  const [animIndex, setAnimIndex] = useState(0);
  const [animFailed, setAnimFailed] = useState(false);

  useEffect(() => {
    setStaticIndex(0);
    setStaticExhausted(false);
    setAnimIndex(0);
    setAnimFailed(false);
  }, [playbackId]);

  const poster = staticUrls[staticIndex];
  const animSrc = animUrls[animIndex];

  if (animated && animSrc && !animFailed) {
    return (
      <div className="absolute inset-0 overflow-hidden">
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={animSrc}
          alt={alt}
          className={className}
          loading="eager"
          decoding="async"
          onError={() => {
            if (animIndex < animUrls.length - 1) {
              setAnimIndex((i) => i + 1);
              return;
            }
            setAnimFailed(true);
          }}
        />
      </div>
    );
  }

  if (staticExhausted && fallback) {
    return <>{fallback}</>;
  }

  if (!poster) {
    return fallback ? <>{fallback}</> : null;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={poster}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={className}
      onError={() => {
        if (staticIndex < staticUrls.length - 1) {
          setStaticIndex((i) => i + 1);
          return;
        }
        setStaticExhausted(true);
      }}
    />
  );
}
