'use client';

// ReviewSection.tsx
// Client component: per-tactic approval toggle + comment textarea.
// Debounced auto-save for comments; inputs disabled after approval.

import { useCallback, useEffect, useRef, useState } from 'react';

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
  tactic: string;
  assets: ReviewAsset[];
  finalAssets: ReviewAsset[];
  token: string;
  initialFeedback: TacticFeedback;
}

const DEBOUNCE_MS = 800;

export default function ReviewSection({
  tactic,
  assets,
  finalAssets,
  token,
  initialFeedback,
}: ReviewSectionProps) {
  const [approved, setApproved] = useState(initialFeedback.approved);
  const [comments, setComments] = useState(initialFeedback.comments);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(
    async (fields: { approved?: boolean; comments?: string }) => {
      setSaving(true);
      try {
        const res = await fetch(`/api/review/feedback?token=${encodeURIComponent(token)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tactic, ...fields }),
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
    [tactic, token],
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
        {approved && (
          <span className="rounded-full bg-emerald-900/60 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
            Approved
          </span>
        )}
      </div>

      {/* Asset grid */}
      {assets.length === 0 ? (
        <p className="text-sm text-gray-500">(no review assets yet)</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((asset) => (
            <AssetCard key={asset.fileId} asset={asset} token={token} />
          ))}
        </div>
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

      {/* Final Downloads — visible only when approved and FINAL_ files exist */}
      {approved && finalAssets.length > 0 && (
        <div className="mt-4 rounded-lg border border-emerald-800 bg-emerald-950/40 p-4">
          <h3 className="mb-3 text-sm font-semibold text-emerald-300">
            Final Downloads
          </h3>
          <ul className="space-y-2">
            {finalAssets.map((file) => (
              <li key={file.fileId}>
                <a
                  href={`/api/review/files/${file.fileId}?token=${encodeURIComponent(token)}&dl=1`}
                  download
                  className="inline-flex items-center gap-2 rounded-md border border-emerald-700 bg-emerald-900/50 px-3 py-1.5 text-sm text-emerald-200 transition-colors hover:bg-emerald-800/60"
                >
                  <DownloadIcon />
                  <span className="truncate">{file.name}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function AssetCard({ asset, token }: { asset: { fileId: string; name: string; mimeType: string }; token: string }) {
  const src = `/api/review/files/${asset.fileId}?token=${encodeURIComponent(token)}`;
  const isImage = asset.mimeType.startsWith('image/');
  const isVideo = asset.mimeType.startsWith('video/');
  const isAudio = asset.mimeType.startsWith('audio/');

  return (
    <div className="overflow-hidden rounded-lg border border-gray-700 bg-gray-800">
      <div className="flex aspect-video items-center justify-center bg-gray-900">
        {isImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={asset.name}
            className="h-full w-full object-contain"
          />
        )}
        {isVideo && (
          <video src={src} controls className="h-full w-full object-contain" />
        )}
        {isAudio && (
          <audio src={src} controls className="mx-auto" />
        )}
        {!isImage && !isVideo && !isAudio && (
          <span className="text-sm text-gray-500">No preview available</span>
        )}
      </div>
      <div className="px-3 py-2">
        <p className="truncate text-xs text-gray-300" title={asset.name}>
          {asset.name}
        </p>
      </div>
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4 shrink-0"
    >
      <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
      <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
    </svg>
  );
}
