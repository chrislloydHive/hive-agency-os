'use client';

// ReviewSection.tsx
// Client component: per-tactic approval toggle + comment textarea.
// Debounced auto-save for comments; inputs disabled after approval.
// Assets can be clicked to open a lightbox for expanded preview.

import { useCallback, useEffect, useRef, useState } from 'react';
import AssetLightbox from './AssetLightbox';

interface ReviewAsset {
  fileId: string;
  name: string;
  mimeType: string;
}

interface TacticFeedback {
  approved: boolean;
  comments: string;
}

interface ReviewSectionProps {
  variant: string;
  tactic: string;
  assets: ReviewAsset[];
  fileCount: number;
  token: string;
  initialFeedback: TacticFeedback;
}

const DEBOUNCE_MS = 800;

export default function ReviewSection({
  variant,
  tactic,
  assets,
  fileCount,
  token,
  initialFeedback,
}: ReviewSectionProps) {
  const [approved, setApproved] = useState(initialFeedback.approved);
  const [comments, setComments] = useState(initialFeedback.comments);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Lightbox state
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const openLightbox = (index: number) => setLightboxIndex(index);
  const closeLightbox = () => setLightboxIndex(null);

  const save = useCallback(
    async (fields: { approved?: boolean; comments?: string }) => {
      setSaving(true);
      try {
        const res = await fetch(`/api/review/feedback?token=${encodeURIComponent(token)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ variant, tactic, ...fields }),
        });
        if (res.ok) {
          setLastSaved(new Date().toLocaleTimeString());
        }
      } catch {
        // silent — user sees stale "last saved" timestamp
      } finally {
        setSaving(false);
      }
    },
    [variant, tactic, token],
  );

  const handleApprovalToggle = () => {
    const next = !approved;
    setApproved(next);
    save({ approved: next });
  };

  const handleCommentsChange = (value: string) => {
    setComments(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      save({ comments: value });
    }, DEBOUNCE_MS);
  };

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <section className="mb-10">
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-lg font-semibold text-amber-400">{tactic}</h2>
        <span className="rounded-full bg-gray-800 px-2.5 py-0.5 text-xs font-medium text-gray-400">
          {fileCount} {fileCount === 1 ? 'file' : 'files'}
        </span>
        {approved && (
          <span className="rounded-full bg-emerald-900/60 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
            Approved
          </span>
        )}
      </div>

      {/* Asset grid */}
      {assets.length === 0 ? (
        <p className="text-sm text-gray-500">(no files yet)</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((asset, index) => (
            <AssetCard
              key={asset.fileId}
              asset={asset}
              token={token}
              onClick={() => openLightbox(index)}
            />
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <AssetLightbox
          assets={assets}
          currentIndex={lightboxIndex}
          variant={variant}
          tactic={tactic}
          token={token}
          onClose={closeLightbox}
          onNavigate={setLightboxIndex}
        />
      )}

      {/* Feedback controls */}
      <div className="mt-4 rounded-lg border border-gray-700 bg-gray-800/50 p-4">
        <div className="flex items-start gap-4 sm:items-center">
          {/* Approve toggle */}
          <button
            type="button"
            onClick={handleApprovalToggle}
            className={`shrink-0 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              approved
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'border border-gray-600 bg-gray-700 text-gray-200 hover:bg-gray-600'
            }`}
          >
            {approved ? 'Approved' : 'Approve'}
          </button>

          {/* Save indicator */}
          <div className="hidden shrink-0 sm:block">
            {saving && <span className="text-xs text-gray-500">Saving...</span>}
            {!saving && lastSaved && (
              <span className="text-xs text-gray-600">Saved {lastSaved}</span>
            )}
          </div>
        </div>

        {/* Comments */}
        <textarea
          value={comments}
          onChange={(e) => handleCommentsChange(e.target.value)}
          disabled={approved}
          placeholder={approved ? 'Comments locked after approval — toggle off to edit' : 'Add comments or feedback...'}
          rows={3}
          className={`mt-3 w-full rounded-md border bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 ${
            approved
              ? 'cursor-not-allowed border-gray-700 opacity-60'
              : 'border-gray-600 focus:ring-amber-500'
          }`}
        />

        {/* Mobile save indicator */}
        <div className="mt-1 sm:hidden">
          {saving && <span className="text-xs text-gray-500">Saving...</span>}
          {!saving && lastSaved && (
            <span className="text-xs text-gray-600">Saved {lastSaved}</span>
          )}
        </div>
      </div>
    </section>
  );
}

function AssetCard({
  asset,
  token,
  onClick,
}: {
  asset: { fileId: string; name: string; mimeType: string };
  token: string;
  onClick: () => void;
}) {
  const src = `/api/review/files/${asset.fileId}?token=${encodeURIComponent(token)}`;
  const isImage = asset.mimeType.startsWith('image/');
  const isVideo = asset.mimeType.startsWith('video/');
  const isAudio = asset.mimeType.startsWith('audio/');

  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full overflow-hidden rounded-lg border border-gray-700 bg-gray-800 text-left transition-colors hover:border-amber-500/50 hover:bg-gray-750 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
    >
      <div className="relative flex aspect-video items-center justify-center bg-gray-900">
        {isImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={asset.name}
            className="h-full w-full object-contain"
          />
        )}
        {isVideo && (
          <div className="relative h-full w-full">
            <video src={src} className="h-full w-full object-contain" muted />
            {/* Play icon overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="rounded-full bg-black/60 p-3 transition-transform group-hover:scale-110">
                <svg className="h-8 w-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          </div>
        )}
        {isAudio && (
          <div className="flex flex-col items-center gap-2">
            <div className="rounded-full bg-gray-700 p-4">
              <svg className="h-8 w-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <span className="text-xs text-gray-400">Audio</span>
          </div>
        )}
        {!isImage && !isVideo && !isAudio && (
          <div className="flex flex-col items-center gap-2">
            <svg className="h-10 w-10 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-xs text-gray-500">File</span>
          </div>
        )}
        {/* Expand hint */}
        <div className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-1 text-xs text-gray-300 opacity-0 transition-opacity group-hover:opacity-100">
          Click to expand
        </div>
      </div>
      <div className="px-3 py-2">
        <p className="truncate text-xs text-gray-300" title={asset.name}>
          {asset.name}
        </p>
      </div>
    </button>
  );
}

