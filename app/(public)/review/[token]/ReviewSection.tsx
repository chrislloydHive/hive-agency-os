'use client';

// ReviewSection.tsx
// Client component: per-tactic approval toggle + comment textarea.
// Requires author identity before approval or commenting.
// Assets can be clicked to open a lightbox for expanded preview.

import { useCallback, useEffect, useRef, useState } from 'react';
import AssetLightbox from './AssetLightbox';
import { useAuthorIdentity } from './AuthorIdentityContext';
import type { ReviewState } from './ReviewPortalClient';

interface ReviewAsset {
  fileId: string;
  name: string;
  mimeType: string;
  reviewState?: ReviewState;
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
  onAssetStatusChange?: (variant: string, tactic: string, fileId: string, reviewState: ReviewState) => void;
  /** As-of group approval from Creative Review Group Approvals (section data from API). */
  groupApprovalApprovedAt?: string | null;
  groupApprovalApprovedByName?: string | null;
  newSinceApprovalCount?: number;
  onGroupApproved?: (variant: string, tactic: string, approvedAt: string, approvedByName: string, approvedByEmail: string) => void;
}

const DEBOUNCE_MS = 800;

function formatApprovedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function ReviewSection({
  variant,
  tactic,
  assets,
  fileCount,
  token,
  initialFeedback,
  onAssetStatusChange,
  groupApprovalApprovedAt,
  groupApprovalApprovedByName,
  newSinceApprovalCount = 0,
  onGroupApproved,
}: ReviewSectionProps) {
  const [comments, setComments] = useState(initialFeedback.comments);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [approvingGroup, setApprovingGroup] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingCommentRef = useRef<string | null>(null);

  // Lightbox state
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // For empty tactics: collapse feedback by default; expand on "Add feedback"
  const [feedbackExpanded, setFeedbackExpanded] = useState(false);
  const hasFiles = assets.length > 0;
  const isGroupApproved = !!groupApprovalApprovedAt;

  const { identity, requireIdentity } = useAuthorIdentity();

  const openLightbox = (index: number) => setLightboxIndex(index);
  const closeLightbox = () => setLightboxIndex(null);

  const saveComments = useCallback(
    async (fields: { comments?: string }) => {
      if (!identity) return;

      setSaving(true);
      try {
        const res = await fetch(`/api/review/feedback?token=${encodeURIComponent(token)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            variant,
            tactic,
            authorName: identity.name,
            authorEmail: identity.email,
            ...fields,
          }),
        });
        if (res.ok) {
          setLastSaved(new Date().toLocaleTimeString());
        }
      } catch {
        // silent
      } finally {
        setSaving(false);
      }
    },
    [variant, tactic, token, identity],
  );

  const handleGroupApprove = () => {
    requireIdentity(async () => {
      if (!identity) return;
      setApprovingGroup(true);
      try {
        const res = await fetch('/api/review/groups/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({
            token,
            tactic,
            variant,
            approvedByName: identity.name,
            approvedByEmail: identity.email,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const approvedAt = (data && data.approvedAt) || new Date().toISOString();
          onGroupApproved?.(variant, tactic, approvedAt, identity.name, identity.email);
        }
      } catch {
        // silent
      } finally {
        setApprovingGroup(false);
      }
    });
  };

  const handleCommentsChange = (value: string) => {
    setComments(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    pendingCommentRef.current = value;

    debounceRef.current = setTimeout(() => {
      if (pendingCommentRef.current && pendingCommentRef.current.trim()) {
        requireIdentity(() => {
          if (pendingCommentRef.current) {
            saveComments({ comments: pendingCommentRef.current });
            pendingCommentRef.current = null;
          }
        });
      }
    }, DEBOUNCE_MS);
  };

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const showFeedbackControls = hasFiles || feedbackExpanded;

  return (
    <section className={hasFiles ? 'mb-10' : 'mb-4'}>
      {/* Header: compact for empty tactics */}
      <div className={`flex flex-wrap items-center gap-3 ${hasFiles ? 'mb-4' : ''}`}>
        <h2 className="text-lg font-semibold text-amber-400">{tactic}</h2>
        <span className="rounded-full bg-gray-800 px-2.5 py-0.5 text-xs font-medium text-gray-400">
          {fileCount} {fileCount === 1 ? 'file' : 'files'}
        </span>
        {isGroupApproved && (
          <span className="rounded-full bg-emerald-900/60 px-2.5 py-0.5 text-xs font-medium text-emerald-300" title={groupApprovalApprovedByName ?? undefined}>
            Approved as of {formatApprovedAt(groupApprovalApprovedAt!)}
          </span>
        )}
        {newSinceApprovalCount > 0 && (
          <span className="rounded-full bg-amber-900/60 px-2.5 py-0.5 text-xs font-medium text-amber-200">
            {newSinceApprovalCount} new since approval
          </span>
        )}
        {!hasFiles && (
          <span className="text-sm text-gray-500">— No files yet</span>
        )}
      </div>

      {/* Asset grid — only when files exist */}
      {hasFiles ? (
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
      ) : null}

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
          onAssetStatusChange={onAssetStatusChange}
        />
      )}

      {/* Feedback controls: visible when files exist, or behind "Add feedback" when empty */}
      {!hasFiles && !feedbackExpanded ? (
        <button
          type="button"
          onClick={() => setFeedbackExpanded(true)}
          className="mt-2 text-sm text-amber-400 hover:text-amber-300 hover:underline"
        >
          Add feedback
        </button>
      ) : showFeedbackControls ? (
        <div className={`rounded-lg border border-gray-700 bg-gray-800/50 p-4 ${hasFiles ? 'mt-4' : 'mt-2'}`}>
          {!hasFiles && (
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs text-gray-500">Feedback for empty tactic</span>
              <button
                type="button"
                onClick={() => setFeedbackExpanded(false)}
                className="text-xs text-gray-500 hover:text-gray-300"
              >
                Collapse
              </button>
            </div>
          )}
          <div className="flex items-start gap-4 sm:items-center">
            <button
              type="button"
              onClick={handleGroupApprove}
              disabled={approvingGroup}
              className={`shrink-0 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                isGroupApproved
                  ? 'border border-emerald-600 bg-emerald-900/40 text-emerald-200 hover:bg-emerald-800/40'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
            >
              {approvingGroup ? 'Saving…' : isGroupApproved ? 'Re-approve' : 'Approve'}
            </button>
            <div className="hidden shrink-0 sm:block">
              {saving && <span className="text-xs text-gray-500">Saving...</span>}
              {!saving && lastSaved && (
                <span className="text-xs text-gray-600">Saved {lastSaved}</span>
              )}
            </div>
          </div>
          <textarea
            value={comments}
            onChange={(e) => handleCommentsChange(e.target.value)}
            disabled={isGroupApproved}
            placeholder={isGroupApproved ? 'Comments locked after group approval' : 'Add comments or feedback...'}
            rows={3}
            className={`mt-3 w-full rounded-md border bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 ${
              isGroupApproved
                ? 'cursor-not-allowed border-gray-700 opacity-60'
                : 'border-gray-600 focus:ring-amber-500'
            }`}
          />
          <div className="mt-1 sm:hidden">
            {saving && <span className="text-xs text-gray-500">Saving...</span>}
            {!saving && lastSaved && (
              <span className="text-xs text-gray-600">Saved {lastSaved}</span>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function statusBadgeLabel(state: ReviewState | undefined): string {
  if (!state || state === 'new') return 'New';
  if (state === 'seen') return 'Seen';
  if (state === 'approved') return 'Approved';
  if (state === 'needs_changes') return 'Needs Changes';
  return 'New';
}

function statusBadgeClass(state: ReviewState | undefined): string {
  if (!state || state === 'new') return 'bg-gray-700 text-gray-300';
  if (state === 'seen') return 'bg-blue-900/60 text-blue-200';
  if (state === 'approved') return 'bg-emerald-900/60 text-emerald-200';
  if (state === 'needs_changes') return 'bg-amber-900/60 text-amber-200';
  return 'bg-gray-700 text-gray-300';
}

function AssetCard({
  asset,
  token,
  onClick,
}: {
  asset: { fileId: string; name: string; mimeType: string; reviewState?: ReviewState; clickThroughUrl?: string | null };
  token: string;
  onClick: () => void;
}) {
  const src = `/api/review/files/${asset.fileId}?token=${encodeURIComponent(token)}`;
  const isImage = asset.mimeType.startsWith('image/');
  const isVideo = asset.mimeType.startsWith('video/');
  const isAudio = asset.mimeType.startsWith('audio/');
  const badgeLabel = statusBadgeLabel(asset.reviewState);
  const badgeClass = statusBadgeClass(asset.reviewState);
  const hasClickThrough = typeof asset.clickThroughUrl === 'string' && asset.clickThroughUrl.trim().length > 0;

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-gray-700 bg-gray-800 text-left transition-colors hover:border-amber-500/50 hover:bg-gray-750">
    <button
      type="button"
      onClick={onClick}
      className="group flex-1 overflow-hidden text-left focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:ring-inset"
    >
      <div className="relative flex aspect-video items-center justify-center bg-gray-900">
        {/* Status badge */}
        <span
          className={`absolute left-2 top-2 z-10 rounded px-2 py-0.5 text-xs font-medium ${badgeClass}`}
        >
          {badgeLabel}
        </span>
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
    {hasClickThrough && (
      <a
        href={asset.clickThroughUrl!}
        target="_blank"
        rel="noopener noreferrer"
        className="mx-3 mb-2 inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"
        onClick={(e) => e.stopPropagation()}
      >
        Click-through
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </a>
    )}
    </div>
  );
}

