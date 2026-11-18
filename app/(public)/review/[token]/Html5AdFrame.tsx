'use client';

import { useEffect, useRef, useState } from 'react';
import { html5PreviewUrl, html5SizeFromEntry, parseHtml5PortalFileId } from '@/lib/review/html5PortalIds';

/**
 * Plays one HTML5 size from a delivery package. The iframe is the ad's real
 * pixel size, scaled down to fit the box.
 */
export function Html5AdFrame({
  token,
  fileId,
  title,
  interactive = false,
}: {
  token: string;
  fileId: string;
  title: string;
  interactive?: boolean;
}) {
  const parsed = parseHtml5PortalFileId(fileId);
  const size = parsed ? html5SizeFromEntry(parsed.entry) : null;
  const src = html5PreviewUrl(token, fileId);
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || !size) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      setScale(Math.min(rect.width / size.width, rect.height / size.height));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [size]);

  if (!src || !size) return null;

  return (
    <div ref={boxRef} className="absolute inset-0 overflow-hidden bg-white">
      <iframe
        src={src}
        title={title}
        scrolling="no"
        style={{
          width: size.width,
          height: size.height,
          border: 0,
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: `translate(-50%, -50%) scale(${scale})`,
          pointerEvents: interactive ? 'auto' : 'none',
        }}
      />
    </div>
  );
}
