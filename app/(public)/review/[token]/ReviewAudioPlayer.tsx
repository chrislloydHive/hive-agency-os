'use client';

import { useEffect, useState } from 'react';
import { inferMimeTypeFromFilename } from '@/lib/review/reviewMediaDisplay';

type ReviewAudioPlayerProps = {
  src: string;
  fileName: string;
  className?: string;
};

/**
 * Loads review audio via fetch (no Range probe) into a blob URL so playback
 * does not depend on the proxy's Range/206 behavior in <audio src>.
 */
export function ReviewAudioPlayer({ src, fileName, className }: ReviewAudioPlayerProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    const ac = new AbortController();
    setPhase('loading');
    setObjectUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });

    (async () => {
      try {
        const res = await fetch(src, { signal: ac.signal, cache: 'no-store' });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        let blob = await res.blob();
        const inferred = inferMimeTypeFromFilename(fileName);
        if (
          inferred &&
          (!blob.type || blob.type === 'application/octet-stream')
        ) {
          blob = new Blob([await blob.arrayBuffer()], { type: inferred });
        }
        if (ac.signal.aborted) return;
        setObjectUrl(URL.createObjectURL(blob));
        setPhase('ready');
      } catch {
        if (ac.signal.aborted) return;
        setPhase('error');
      }
    })();

    return () => {
      ac.abort();
      setObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [src, fileName]);

  if (phase === 'loading') {
    return <p className="text-sm text-gray-400">Loading audio…</p>;
  }

  if (phase === 'error' || !objectUrl) {
    return (
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-sm text-red-400">Could not load audio preview.</p>
        <a
          href={`${src}${src.includes('?') ? '&' : '?'}dl=1`}
          className="text-sm text-amber-400 hover:text-amber-300"
        >
          Download file
        </a>
      </div>
    );
  }

  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption
    <audio src={objectUrl} controls preload="metadata" className={className} />
  );
}
