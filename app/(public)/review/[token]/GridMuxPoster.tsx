'use client';

import { muxCarouselPosterUrls, muxGridPosterUrls } from '@/lib/review/muxThumbnail';
import { useEffect, useMemo, useState } from 'react';

/**
 * Grid video poster from image.mux.com (lightweight; dozens of MuxPlayer instances
 * overload the browser and leave tiles blank).
 */
export default function GridMuxPoster({
  playbackId,
  alt,
  className = 'absolute inset-0 h-full w-full object-cover',
  layout = 'grid',
}: {
  playbackId: string;
  alt: string;
  className?: string;
  layout?: 'grid' | 'carousel';
}) {
  const urls = useMemo(
    () => (layout === 'carousel' ? muxCarouselPosterUrls(playbackId) : muxGridPosterUrls(playbackId)),
    [playbackId, layout],
  );
  const [urlIndex, setUrlIndex] = useState(0);

  useEffect(() => {
    setUrlIndex(0);
  }, [playbackId, urls]);

  const src = urls[urlIndex];
  if (!src) return null;

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
        }
      }}
    />
  );
}
