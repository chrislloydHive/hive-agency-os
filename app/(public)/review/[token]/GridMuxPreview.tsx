'use client';

import MuxPlayer from '@mux/mux-player-react';
import { useEffect, useRef, useState } from 'react';

/**
 * Grid card video preview — same Mux stream as the lightbox (static image.mux.com posters
 * often show blank first frames or unreadable ultra-wide strips).
 */
export default function GridMuxPreview({
  playbackId,
  thumbnailTime = 1,
}: {
  playbackId: string;
  thumbnailTime?: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShouldLoad(true);
          obs.disconnect();
        }
      },
      { rootMargin: '160px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const pid = playbackId.trim();
  if (!pid) return null;

  return (
    <div ref={hostRef} className="absolute inset-0 bg-gray-900">
      {shouldLoad ? (
        <MuxPlayer
          playbackId={pid}
          streamType="on-demand"
          muted
          playsInline
          preload="metadata"
          thumbnailTime={thumbnailTime}
          // @ts-expect-error Mux CSS custom properties
          style={{
            width: '100%',
            height: '100%',
            '--controls': 'none',
            '--media-object-fit': 'cover',
            pointerEvents: 'none',
          }}
        />
      ) : null}
    </div>
  );
}
