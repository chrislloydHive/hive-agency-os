'use client';

import { buildReviewFileThumbnailUrl } from '@/lib/review/reviewMediaDisplay';
import { useState } from 'react';

export function FileTypePlaceholder({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`flex items-center justify-center text-gray-500 ${compact ? 'h-full w-full' : 'flex-col gap-2'}`}
    >
      <svg
        className={compact ? 'h-8 w-8' : 'h-10 w-10'}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={compact ? 1.5 : 2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      {!compact ? <span className="text-xs text-gray-500">File</span> : null}
    </div>
  );
}

export default function DriveFileThumbnail({
  fileId,
  token,
  crasRecordId,
  alt,
  className = 'h-full w-full object-cover object-top',
  compact = false,
}: {
  fileId: string;
  token: string;
  crasRecordId?: string | null;
  alt: string;
  className?: string;
  compact?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const src = buildReviewFileThumbnailUrl(fileId, token, { crasRecordId });

  if (failed) {
    return <FileTypePlaceholder compact={compact} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
