'use client';

// AssetLightbox.tsx
// Modal/lightbox component for viewing assets at full size with navigation.
// Supports images, video, and audio. ESC to close, arrow keys to navigate.
// Includes per-asset commenting with required author identity.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthorIdentity, type AuthorIdentity } from './AuthorIdentityContext';
import { VideoWithThumbnail } from './ReviewSection';
import type { ReviewState } from './ReviewPortalClient';

interface ReviewAsset {
  fileId: string;
  name: string;
  mimeType: string;
  clickThroughUrl?: string | null;
  assetApprovedClient?: boolean;
  delivered?: boolean;
  deliveredFileUrl?: string | null;
  deliveredFolderId?: string | null;
  approvedAt?: string | null;
  approvedByName?: string | null;
  approvedByEmail?: string | null;
  firstSeenAt?: string | null;
  lastSeenAt?: string | null;
}

interface AssetComment {
  id: string;
  comment: string;
  createdAt: string;
  authorName: string;
  authorEmail?: string;
}

interface AssetLightboxProps {
  assets: ReviewAsset[];
  currentIndex: number;
  variant: string;
  tactic: string;
  token: string;
  onClose: () => void;
  onNavigate: (index: number) => void;
  onAssetStatusChange?: (variant: string, tactic: string, fileId: string, reviewState: ReviewState) => void;
  /** Called after single-asset approve (success or error) to show toast. */
  onApprovedResult?: (success: boolean, message?: string) => void;
  /** Partner view: call when partner views an asset (record as downloaded). */
  onPartnerDownload?: (fileIds: string[]) => void;
  /** When set, written to CRAS Delivery Batch ID when user approves. */
  deliveryBatchId?: string | null;
}

export default function AssetLightbox({
  assets,
  currentIndex,
  variant,
  tactic,
  token,
  onClose,
  onNavigate,
  onAssetStatusChange,
  onApprovedResult,
  onPartnerDownload,
  deliveryBatchId,
}: AssetLightboxProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const asset = assets[currentIndex];

  const { identity, requireIdentity } = useAuthorIdentity();

  // Comments state
  const [comments, setComments] = useState<AssetComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [approving, setApproving] = useState(false);
  const seenSentRef = useRef<Set<string>>(new Set());
  const partnerDownloadSentRef = useRef<Set<string>>(new Set());

  // Partner view: record asset as downloaded when viewed in lightbox (once per asset)
  useEffect(() => {
    if (!asset || !onPartnerDownload) return;
    const key = `${token}::${asset.fileId}`;
    if (partnerDownloadSentRef.current.has(key)) return;
    partnerDownloadSentRef.current.add(key);
    onPartnerDownload([asset.fileId]);
  }, [asset?.fileId, token, onPartnerDownload]);

  // Mark asset as seen when lightbox opens (once per asset)
  useEffect(() => {
    if (!asset) return;
    const key = `${token}::${asset.fileId}`;
    if (seenSentRef.current.has(key)) return;
    seenSentRef.current.add(key);
    fetch('/api/review/assets/seen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({
        token,
        driveFileId: asset.fileId,
        filename: asset.name,
        tactic,
        variant,
        authorName: identity?.name,
        authorEmail: identity?.email,
      }),
    })
      .then((res) => {
        if (res.ok && onAssetStatusChange) onAssetStatusChange(variant, tactic, asset.fileId, 'seen');
      })
      .catch(() => {});
  }, [asset?.fileId, asset?.name, token, variant, tactic, identity?.name, identity?.email, onAssetStatusChange]);

  // Fetch comments for current asset
  useEffect(() => {
    if (!asset) return;

    const fetchComments = async () => {
      setLoadingComments(true);
      try {
        // API will resolve CRAS ID from fileId
        const params = new URLSearchParams({
          token,
          fileId: asset.fileId,
        });
        
        const res = await fetch(`/api/comments/asset?${params}`, {
          cache: 'no-store',
        });
        if (res.ok) {
          const data = await res.json();
          setComments((data.comments || []).map((c: any) => ({
            id: c.id,
            comment: c.body,
            createdAt: c.createdAt,
            authorName: c.author,
            authorEmail: c.authorEmail,
          })));
        } else {
          // Fallback to old API
          const oldParams = new URLSearchParams({
            token,
            variant,
            tactic,
            fileId: asset.fileId,
          });
          const oldRes = await fetch(`/api/review/comments?${oldParams}`);
          if (oldRes.ok) {
            const oldData = await oldRes.json();
            setComments(oldData.comments || []);
          }
        }
      } catch {
        // Silent fail
      } finally {
        setLoadingComments(false);
      }
    };

    fetchComments();
  }, [asset?.fileId, token, variant, tactic]);

  const submitComment = useCallback(async (currentIdentity: AuthorIdentity) => {
    if (!newComment.trim() || !asset || !currentIdentity) {
      console.warn('[AssetLightbox] Cannot submit comment:', {
        hasComment: !!newComment.trim(),
        hasAsset: !!asset,
        hasIdentity: !!currentIdentity,
      });
      return;
    }

    console.log('[AssetLightbox] Submitting asset comment:', {
      fileId: asset.fileId,
      fileIdType: typeof asset.fileId,
      tactic,
      variant,
      commentLength: newComment.trim().length,
      token: token ? 'present' : 'missing',
    });

    setSubmitting(true);
    try {
      // Use new API (will resolve CRAS ID from fileId)
      const payload: Record<string, unknown> = {
        body: newComment.trim(),
        authorName: currentIdentity.name,
        authorEmail: currentIdentity.email,
        tactic,
        variant,
        fileId: asset.fileId,
      };
      
      console.log('[AssetLightbox] Sending asset comment payload:', {
        ...payload,
        body: typeof payload.body === 'string' ? payload.body.substring(0, 50) + '...' : payload.body,
      });
      
      const res = await fetch(`/api/comments/asset?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify(payload),
      });

      console.log('[AssetLightbox] Asset comment response:', {
        ok: res.ok,
        status: res.status,
        statusText: res.statusText,
      });

      if (res.ok) {
        const data = await res.json();
        console.log('[AssetLightbox] Asset comment created successfully:', {
          hasComment: !!data.comment,
          commentId: data.comment?.id,
        });
        setComments((prev) => [{
          id: data.comment.id,
          comment: data.comment.body,
          createdAt: data.comment.createdAt,
          authorName: data.comment.author,
          authorEmail: data.comment.authorEmail,
        }, ...prev]);
        setNewComment('');
      } else {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[AssetLightbox] Failed to submit asset comment:', {
          status: res.status,
          statusText: res.statusText,
          error: errorData.error || errorData.message,
          errorData,
        });
        
        // Fallback to old API (for backward compatibility)
        console.warn('[AssetLightbox] Attempting fallback to old API...');
        try {
          const oldRes = await fetch(`/api/review/comments?token=${encodeURIComponent(token)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store',
            body: JSON.stringify({
              token,
              body: newComment.trim(),
              authorName: currentIdentity.name,
              authorEmail: currentIdentity.email,
              tactic,
              variantGroup: variant,
              concept: '',
              driveFileId: asset.fileId,
              filename: asset.name,
              variant,
              fileId: asset.fileId,
              fileName: asset.name,
              comment: newComment.trim(),
            }),
          });

          if (oldRes.ok) {
            const oldData = await oldRes.json();
            console.log('[AssetLightbox] Fallback API succeeded');
            setComments((prev) => [...prev, oldData.comment]);
            setNewComment('');
          } else {
            console.error('[AssetLightbox] Fallback API also failed:', {
              status: oldRes.status,
              statusText: oldRes.statusText,
            });
          }
        } catch (fallbackErr) {
          console.error('[AssetLightbox] Fallback API exception:', fallbackErr);
        }
      }
    } catch (err) {
      console.error('[AssetLightbox] Exception submitting asset comment:', {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  }, [newComment, asset, token, variant, tactic]);

  const handleSubmitComment = () => {
    if (!newComment.trim()) return;
    requireIdentity((currentIdentity) => {
      submitComment(currentIdentity);
    });
  };

  const handleApprove = useCallback(() => {
    if (!asset) return;
    requireIdentity(async (currentIdentity) => {
      setApproving(true);
      try {
        const res = await fetch('/api/review/assets/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({
            token,
            driveFileId: asset.fileId,
            approvedAt: new Date().toISOString(),
            approvedByName: currentIdentity.name,
            approvedByEmail: currentIdentity.email,
            deliveryBatchId: deliveryBatchId ?? undefined,
            tactic,
            variant,
            filename: asset.name,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          if (onAssetStatusChange) {
            onAssetStatusChange(variant, tactic, asset.fileId, 'approved');
          }
          const msg = data.alreadyApproved ? 'Already approved' : 'Approved';
          onApprovedResult?.(true, msg);
        } else {
          const msg =
            data?.error ?? (data?.airtableError != null ? 'Airtable error' : 'Failed to approve');
          onApprovedResult?.(false, msg);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to approve';
        onApprovedResult?.(false, msg);
      } finally {
        setApproving(false);
      }
    });
  }, [asset, identity, token, variant, tactic, requireIdentity, onAssetStatusChange, onApprovedResult]);

  if (!asset) return null;

  // For animated images (GIF, animated WebP), use Google Drive direct view URL for proper animation
  // This format works better for animated images than proxying through our API
  const isAnimatedImage = asset.mimeType === 'image/gif' || 
    (asset.mimeType === 'image/webp' && asset.name.toLowerCase().includes('animated'));
  const driveDirectUrl = isAnimatedImage 
    ? `https://drive.google.com/uc?export=view&id=${asset.fileId}`
    : null;
  
  const src = driveDirectUrl || `/api/review/files/${asset.fileId}?token=${encodeURIComponent(token)}`;
  const lowerName = asset.name.toLowerCase();
  const isImage = asset.mimeType.startsWith('image/');
  // Detect video by mimeType or file extension (MP4 files might have incorrect mimeType from Drive)
  const isVideo = asset.mimeType.startsWith('video/') || lowerName.endsWith('.mp4') || lowerName.endsWith('.mov') || lowerName.endsWith('.webm') || lowerName.endsWith('.avi');
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
            <VideoWithThumbnail
              src={src}
              className="max-h-[75vh] max-w-full"
              controls
              autoPlay
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

        {/* Footer: filename, details, counter, Approve, and comment toggle */}
        <div className="mt-4 flex flex-col items-center gap-2">
          <p className="max-w-md truncate text-center text-sm text-gray-300" title={asset.name}>
            {asset.name}
          </p>
          {(asset.approvedAt || asset.approvedByName || asset.approvedByEmail || asset.firstSeenAt || asset.lastSeenAt) && (
            <div className="w-full max-w-md rounded-lg border border-gray-700 bg-gray-800/80 px-4 py-2 text-left text-xs text-gray-400">
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                {asset.approvedAt && (
                  <>
                    <dt className="text-gray-500">Approved at</dt>
                    <dd>{formatDate(asset.approvedAt)}</dd>
                  </>
                )}
                {(asset.approvedByName || asset.approvedByEmail) && (
                  <>
                    <dt className="text-gray-500">Approved by</dt>
                    <dd>{[asset.approvedByName, asset.approvedByEmail].filter(Boolean).join(' · ') || '—'}</dd>
                  </>
                )}
                {asset.firstSeenAt && (
                  <>
                    <dt className="text-gray-500">First seen at</dt>
                    <dd>{formatDate(asset.firstSeenAt)}</dd>
                  </>
                )}
                {asset.lastSeenAt && (
                  <>
                    <dt className="text-gray-500">Last seen at</dt>
                    <dd>{formatDate(asset.lastSeenAt)}</dd>
                  </>
                )}
              </dl>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <p className="text-xs text-gray-500">
              {currentIndex + 1} of {assets.length}
            </p>
            {asset.clickThroughUrl && (
              <a
                href={asset.clickThroughUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md bg-gray-700 px-3 py-1.5 text-xs font-medium text-gray-200 transition-colors hover:bg-gray-600 hover:text-white"
              >
                Click-through
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
            <button
              type="button"
              onClick={handleApprove}
              disabled={approving || asset.assetApprovedClient}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {approving ? 'Approving…' : asset.assetApprovedClient ? 'Approved' : 'Approve'}
            </button>
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
            {identity && (
              <p className="mb-2 text-xs text-gray-500">
                Commenting as <span className="text-gray-400">{identity.name}</span>
              </p>
            )}
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
