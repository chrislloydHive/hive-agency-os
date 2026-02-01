'use client';

// AssetLightbox.tsx
// Modal/lightbox component for viewing assets at full size with navigation.
// Supports images, video, and audio. ESC to close, arrow keys to navigate.
// Includes per-asset commenting.

import { useCallback, useEffect, useRef, useState } from 'react';

interface ReviewAsset {
  fileId: string;
  name: string;
  mimeType: string;
}

interface AssetComment {
  id: string;
  comment: string;
  createdAt: string;
  authorName?: string;
}

interface AssetLightboxProps {
  assets: ReviewAsset[];
  currentIndex: number;
  variant: string;
  tactic: string;
  token: string;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export default function AssetLightbox({
  assets,
  currentIndex,
  variant,
  tactic,
  token,
  onClose,
  onNavigate,
}: AssetLightboxProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const asset = assets[currentIndex];

  // Comments state
  const [comments, setComments] = useState<AssetComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showComments, setShowComments] = useState(false);

  // Fetch comments for current asset
  useEffect(() => {
    if (!asset) return;

    const fetchComments = async () => {
      setLoadingComments(true);
      try {
        const params = new URLSearchParams({
          token,
          variant,
          tactic,
          fileId: asset.fileId,
        });
        const res = await fetch(`/api/review/comments?${params}`);
        if (res.ok) {
          const data = await res.json();
          setComments(data.comments || []);
        }
      } catch {
        // Silent fail
      } finally {
        setLoadingComments(false);
      }
    };

    fetchComments();
  }, [asset?.fileId, token, variant, tactic]);

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !asset) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/review/comments?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variant,
          tactic,
          fileId: asset.fileId,
          comment: newComment.trim(),
          authorName: authorName.trim() || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setComments((prev) => [...prev, data.comment]);
        setNewComment('');
      }
    } catch {
      // Silent fail
    } finally {
      setSubmitting(false);
    }
  };

  if (!asset) return null;

  const src = `/api/review/files/${asset.fileId}?token=${encodeURIComponent(token)}`;
  const isImage = asset.mimeType.startsWith('image/');
  const isVideo = asset.mimeType.startsWith('video/');
  const isAudio = asset.mimeType.startsWith('audio/');

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < assets.length - 1;

  const goToPrev = useCallback(() => {
    if (hasPrev) onNavigate(currentIndex - 1);
  }, [hasPrev, currentIndex, onNavigate]);

  const goToNext = useCallback(() => {
    if (hasNext) onNavigate(currentIndex + 1);
  }, [hasNext, currentIndex, onNavigate]);

  // Handle keyboard navigation (only when not typing)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't navigate when typing in textarea/input
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) {
        if (e.key === 'Escape') {
          (e.target as HTMLElement).blur();
        }
        return;
      }

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        goToPrev();
      } else if (e.key === 'ArrowRight') {
        goToNext();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, goToPrev, goToNext]);

  // Prevent body scroll when lightbox is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Close when clicking overlay (not content)
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      onClose();
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex bg-black/90 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Asset preview"
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-10 rounded-full bg-gray-800/80 p-2 text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
        aria-label="Close preview"
      >
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Navigation: Previous */}
      {hasPrev && (
        <button
          onClick={goToPrev}
          className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-gray-800/80 p-3 text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
          aria-label="Previous asset"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Navigation: Next (adjust position when comments open) */}
      {hasNext && (
        <button
          onClick={goToNext}
          className={`absolute top-1/2 z-10 -translate-y-1/2 rounded-full bg-gray-800/80 p-3 text-gray-300 transition-colors hover:bg-gray-700 hover:text-white ${
            showComments ? 'right-80 sm:right-96' : 'right-4'
          }`}
          aria-label="Next asset"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Main content area */}
      <div className={`flex flex-1 flex-col items-center justify-center p-4 transition-all ${showComments ? 'pr-80 sm:pr-96' : ''}`}>
        {/* Asset preview */}
        <div className="flex max-h-[75vh] w-full items-center justify-center">
          {isImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={asset.name}
              className="max-h-[75vh] max-w-full object-contain"
            />
          )}
          {isVideo && (
            <video
              src={src}
              controls
              autoPlay
              className="max-h-[75vh] max-w-full"
            />
          )}
          {isAudio && (
            <div className="flex flex-col items-center gap-6 rounded-lg bg-gray-800 p-8">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gray-700">
                <svg className="h-12 w-12 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
              <audio src={src} controls autoPlay className="w-80" />
            </div>
          )}
          {!isImage && !isVideo && !isAudio && (
            <div className="flex flex-col items-center gap-4 rounded-lg bg-gray-800 p-8">
              <svg className="h-16 w-16 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-gray-400">Preview not available</p>
              <a
                href={`${src}&dl=1`}
                download
                className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-amber-400"
              >
                Download File
              </a>
            </div>
          )}
        </div>

        {/* Footer: filename, counter, and comment toggle */}
        <div className="mt-4 flex flex-col items-center gap-2">
          <p className="max-w-md truncate text-center text-sm text-gray-300" title={asset.name}>
            {asset.name}
          </p>
          <div className="flex items-center gap-4">
            <p className="text-xs text-gray-500">
              {currentIndex + 1} of {assets.length}
            </p>
            <button
              onClick={() => setShowComments(!showComments)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                showComments
                  ? 'bg-amber-500 text-gray-900'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {comments.length > 0 ? `${comments.length} Comment${comments.length !== 1 ? 's' : ''}` : 'Add Comment'}
            </button>
          </div>
        </div>
      </div>

      {/* Comments Panel */}
      {showComments && (
        <div className="absolute right-0 top-0 flex h-full w-80 flex-col border-l border-gray-700 bg-gray-900 sm:w-96">
          {/* Panel header */}
          <div className="flex items-center justify-between border-b border-gray-700 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-200">Comments</h3>
            <button
              onClick={() => setShowComments(false)}
              className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-gray-200"
              aria-label="Close comments"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Comments list */}
          <div className="flex-1 overflow-y-auto p-4">
            {loadingComments ? (
              <p className="text-center text-sm text-gray-500">Loading comments...</p>
            ) : comments.length === 0 ? (
              <p className="text-center text-sm text-gray-500">No comments yet. Be the first to add one!</p>
            ) : (
              <div className="space-y-4">
                {comments.map((comment) => (
                  <div key={comment.id} className="rounded-lg bg-gray-800 p-3">
                    <p className="whitespace-pre-wrap text-sm text-gray-200">{comment.comment}</p>
                    <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                      {comment.authorName && (
                        <>
                          <span className="font-medium text-gray-400">{comment.authorName}</span>
                          <span>·</span>
                        </>
                      )}
                      <span>{formatDate(comment.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add comment form */}
          <div className="border-t border-gray-700 p-4">
            <input
              type="text"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="Your name (optional)"
              className="mb-2 w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              rows={3}
              className="w-full resize-none rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <button
              onClick={handleSubmitComment}
              disabled={!newComment.trim() || submitting}
              className="mt-2 w-full rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Posting...' : 'Post Comment'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
