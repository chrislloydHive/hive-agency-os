'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Defer mounting heavy review sections until near the viewport.
 * Entering the pending queue can mount many tactics at once; this avoids a
 * burst of Mux poster / image requests for sections still far off-screen.
 */
export default function LazyMountSection({
  children,
  eager = false,
  placeholderMinHeightPx = 280,
  rootMargin = '600px 0px',
}: {
  children: ReactNode;
  /** Mount immediately (use for the first section above the fold). */
  eager?: boolean;
  placeholderMinHeightPx?: number;
  rootMargin?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(eager);

  useEffect(() => {
    const el = ref.current;
    if (!el || mounted) return;

    if (typeof IntersectionObserver === 'undefined') {
      setMounted(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setMounted(true);
          io.disconnect();
        }
      },
      { root: null, rootMargin, threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [mounted, rootMargin]);

  return (
    <div
      ref={ref}
      className="[content-visibility:auto] [contain-intrinsic-size:auto_280px]"
      style={mounted ? undefined : { minHeight: placeholderMinHeightPx }}
    >
      {mounted ? (
        children
      ) : (
        <div
          className="mb-4 animate-pulse rounded-xl border border-gray-800 bg-gray-900/60"
          style={{ minHeight: placeholderMinHeightPx }}
          aria-hidden
        />
      )}
    </div>
  );
}
