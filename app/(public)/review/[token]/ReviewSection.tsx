'use client';

// ReviewSection.tsx
// Client component: per-tactic approval toggle + comment textarea.
// Requires author identity before approval or commenting.
// Assets can be clicked to open a lightbox for expanded preview.

import { useCallback, useEffect, useRef, useState } from 'react';
import AssetLightbox from './AssetLightbox';
import { useAuthorIdentity } from './AuthorIdentityContext';
import { getSectionCounts, isAssetNew } from './reviewAssetUtils';
import type { ReviewState } from './ReviewPortalClient';

/**
 * Video component that extracts and displays the final frame as a thumbnail.
 * Seeks to near the end of the video (95%) and captures that frame to use as poster.
 */
export function VideoWithThumbnail({ 
  src, 
  className,
  controls = false,
  autoPlay = false,
}: { 
  src: string; 
  className?: string;
  controls?: boolean;
  autoPlay?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [hasThumbnail, setHasThumbnail] = useState(false);
  const [thumbnailError, setThumbnailError] = useState(false);
  const attemptRef = useRef(0);
  const maxAttempts = 5;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || hasThumbnail || thumbnailError) return;

    const captureFrame = () => {
      try {
        // Check if video has valid dimensions
        if (video.videoWidth === 0 || video.videoHeight === 0) {
          if (attemptRef.current < maxAttempts) {
            attemptRef.current += 1;
            // Retry after a short delay
            timeoutRef.current = setTimeout(() => {
              if (video.readyState >= 2 && video.videoWidth > 0) {
                captureFrame();
              }
            }, 300);
          } else {
            setThumbnailError(true);
          }
          return;
        }
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          if (attemptRef.current < maxAttempts) {
            attemptRef.current += 1;
            timeoutRef.current = setTimeout(captureFrame, 300);
          } else {
            setThumbnailError(true);
          }
          return;
        }

        // Draw the current video frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert to data URL for use as poster
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setPosterUrl(dataUrl);
        setHasThumbnail(true);
      } catch (e) {
        // CORS or other errors - try without crossOrigin or use fallback
        console.warn('[VideoWithThumbnail] Failed to capture frame:', e);
        if (attemptRef.current < maxAttempts) {
          attemptRef.current += 1;
          // Try capturing at current time instead of seeking
          timeoutRef.current = setTimeout(() => {
            if (video.readyState >= 2 && video.videoWidth > 0) {
              try {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                  setPosterUrl(dataUrl);
                  setHasThumbnail(true);
                }
              } catch (err) {
                setThumbnailError(true);
              }
            }
          }, 500);
        } else {
          setThumbnailError(true);
        }
      }
    };

    const seekToFinalFrame = () => {
      try {
        if (video.duration && video.duration > 0 && !isNaN(video.duration)) {
          // Seek to 95% of video duration to get near-final frame
          const targetTime = Math.max(0, video.duration * 0.95);
          video.currentTime = targetTime;
        } else {
          // If duration not available yet, try seeking to a reasonable time
          // Most videos are under 5 minutes, so try 4 minutes
          video.currentTime = 240;
        }
      } catch (e) {
        // Seeking failed - try to capture current frame anyway
        if (video.readyState >= 2 && video.videoWidth > 0) {
          captureFrame();
        }
      }
    };

    const handleLoadedMetadata = () => {
      // Wait a bit for video to be ready
      timeoutRef.current = setTimeout(() => {
        seekToFinalFrame();
      }, 100);
    };

    const handleSeeked = () => {
      // Frame should be ready after seeking - wait a bit for render
      timeoutRef.current = setTimeout(captureFrame, 200);
    };

    const handleLoadedData = () => {
      // If metadata wasn't loaded but we have data, try capturing current frame
      if (!hasThumbnail && video.readyState >= 2 && video.videoWidth > 0) {
        timeoutRef.current = setTimeout(captureFrame, 200);
      }
    };

    const handleCanPlay = () => {
      // If we still don't have a thumbnail and video can play, try one more time
      if (!hasThumbnail && video.videoWidth > 0) {
        seekToFinalFrame();
      }
    };

    const handleTimeUpdate = () => {
      // If we're near the end and haven't captured yet, try now
      if (!hasThumbnail && video.duration > 0 && video.currentTime >= video.duration * 0.9) {
        captureFrame();
      }
    };

    // Add event listeners
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('timeupdate', handleTimeUpdate);

    // If video is already loaded, try immediately
    if (video.readyState >= 1) {
      handleLoadedMetadata();
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [hasThumbnail, thumbnailError]);

  // Try without crossOrigin if CORS fails - some proxies don't need it
  const [useCrossOrigin, setUseCrossOrigin] = useState(true);

  return (
    <>
      <canvas ref={canvasRef} className="hidden" />
      <video
        ref={videoRef}
        src={src}
        className={className}
        muted={!autoPlay}
        preload="metadata"
        crossOrigin={useCrossOrigin ? "anonymous" : undefined}
        poster={posterUrl || undefined}
        controls={controls}
        autoPlay={autoPlay}
        onError={(e) => {
          // If error with crossOrigin, try without it
          if (useCrossOrigin) {
            console.warn('[VideoWithThumbnail] Video error with crossOrigin, retrying without');
            setUseCrossOrigin(false);
          }
        }}
      />
    </>
  );
}

interface ReviewAsset {
  fileId: string;
  name: string;
  mimeType: string;
  reviewState?: ReviewState;
  firstSeenByClientAt?: string | null;
  assetApprovedClient?: boolean;
  deliveredAt?: string | null;
  delivered?: boolean;
  /** URL to open delivered folder/file in Drive. */
  deliveredFileUrl?: string | null;
  /** Drive folder ID of delivery (fallback to build URL if deliveredFileUrl missing). */
  deliveredFolderId?: string | null;
  approvedAt?: string | null;
  approvedByName?: string | null;
  approvedByEmail?: string | null;
  firstSeenAt?: string | null;
  lastSeenAt?: string | null;
  partnerDownloadedAt?: string | null;
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
  groupId?: string; // Creative Review Sets record ID
  onAssetStatusChange?: (variant: string, tactic: string, fileId: string, reviewState: ReviewState) => void;
  /** As-of group approval from Creative Review Group Approvals (section data from API). */
  groupApprovalApprovedAt?: string | null;
  groupApprovalApprovedByName?: string | null;
  newSinceApprovalCount?: number;
  onGroupApproved?: (variant: string, tactic: string, approvedAt: string, approvedByName: string, approvedByEmail: string) => void;
  selectedFileIds?: Set<string>;
  onToggleSelect?: (fileId: string) => void;
  onSelectAllUnapprovedInSection?: (fileIds: string[]) => void;
  onSelectNewInSection?: (fileIds: string[]) => void;
  /** Called when single-asset approve completes (for toast). */
  onSingleAssetApprovedResult?: (success: boolean, message?: string) => void;
  /** Partner view: batch id for mark-downloaded. */
  deliveryBatchId?: string | null;
  /** Partner view: call when partner views/downloads an asset. */
  onPartnerDownload?: (fileIds: string[]) => void;
  /** Partner view: get signed download URL and open download (proxy download). */
  onDownloadAsset?: (assetId: string) => void | Promise<void>;
}

const DEBOUNCE_MS = 800;

function SelectAllUnapprovedCheckbox({
  checked,
  indeterminate,
  pendingCount,
  onToggle,
}: {
  checked: boolean;
  indeterminate: boolean;
  pendingCount: number;
  onToggle: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-300">
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-amber-500 focus:ring-amber-500"
      />
      <span>Select all unapproved ({pendingCount})</span>
    </label>
  );
}

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
  groupId,
  onAssetStatusChange,
  groupApprovalApprovedAt,
  groupApprovalApprovedByName,
  newSinceApprovalCount = 0,
  onGroupApproved,
  selectedFileIds = new Set(),
  onToggleSelect,
  onSelectAllUnapprovedInSection,
  onSelectNewInSection,
  onSingleAssetApprovedResult,
  deliveryBatchId,
  onPartnerDownload,
  onDownloadAsset,
}: ReviewSectionProps) {
  const counts = getSectionCounts(assets);
  const { totalCount, newCount, pendingCount, approvedCount } = counts;
  const unapprovedFileIds = assets.filter((a) => !a.assetApprovedClient).map((a) => a.fileId);
  const newFileIds = assets.filter(isAssetNew).map((a) => a.fileId);
  
  // Calculate selected unapproved assets in this section
  const selectedUnapprovedInSection = assets.filter(
    (a) => selectedFileIds.has(a.fileId) && !a.assetApprovedClient
  );
  const selectedUnapprovedCount = selectedUnapprovedInSection.length;
  const selectedUnapprovedFileIds = selectedUnapprovedInSection.map((a) => a.fileId);
  
  const allUnapprovedSelected = pendingCount > 0 && selectedUnapprovedCount === pendingCount;
  const someUnapprovedSelected = selectedUnapprovedCount > 0 && selectedUnapprovedCount < pendingCount;
  const [comments, setComments] = useState(initialFeedback.comments);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [approvingGroup, setApprovingGroup] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingCommentRef = useRef<string | null>(null);
  
  // Group comments state
  const [groupComments, setGroupComments] = useState<Array<{ id: string; body: string; author: string; authorEmail?: string; createdAt: string }>>([]);
  const [loadingGroupComments, setLoadingGroupComments] = useState(false);
  const [newGroupComment, setNewGroupComment] = useState('');
  const [submittingGroupComment, setSubmittingGroupComment] = useState(false);

  // Lightbox state
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // For empty tactics: collapse feedback by default; expand on "Add feedback"
  const [feedbackExpanded, setFeedbackExpanded] = useState(false);
  const hasFiles = assets.length > 0;
  const isGroupApproved = !!groupApprovalApprovedAt;
  
  // Get identity hook early (needed for callbacks)
  const { identity, requireIdentity } = useAuthorIdentity();
  
  // Fetch group comments on mount
  useEffect(() => {
    if (!groupId) return;
    
    const fetchGroupComments = async () => {
      setLoadingGroupComments(true);
      try {
        const res = await fetch(`/api/comments/group?token=${encodeURIComponent(token)}&groupId=${encodeURIComponent(groupId)}`, {
          cache: 'no-store',
        });
        if (res.ok) {
          const data = await res.json();
          setGroupComments(data.comments || []);
        }
      } catch (err) {
        console.error('[ReviewSection] Failed to fetch group comments:', err);
      } finally {
        setLoadingGroupComments(false);
      }
    };
    
    fetchGroupComments();
  }, [groupId, token]);
  
  // Submit group comment
  const handleSubmitGroupComment = useCallback(async () => {
    if (!groupId || !newGroupComment.trim()) {
      console.warn('[ReviewSection] Cannot submit group comment:', {
        hasGroupId: !!groupId,
        groupId,
        hasComment: !!newGroupComment.trim(),
        commentLength: newGroupComment.trim().length,
      });
      return;
    }
    
    console.log('[ReviewSection] Submitting group comment:', {
      groupId,
      groupIdType: typeof groupId,
      commentLength: newGroupComment.trim().length,
      token: token ? 'present' : 'missing',
    });
    
    requireIdentity(async (currentIdentity) => {
      setSubmittingGroupComment(true);
      try {
        const payload = {
          groupId,
          body: newGroupComment.trim(),
          authorName: currentIdentity.name,
          authorEmail: currentIdentity.email,
        };
        
        console.log('[ReviewSection] Sending group comment payload:', {
          ...payload,
          body: payload.body.substring(0, 50) + '...',
        });
        
        const res = await fetch(`/api/comments/group?token=${encodeURIComponent(token)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        
        console.log('[ReviewSection] Group comment response:', {
          ok: res.ok,
          status: res.status,
          statusText: res.statusText,
        });
        
        if (res.ok) {
          const data = await res.json();
          console.log('[ReviewSection] Group comment created successfully:', {
            hasComment: !!data.comment,
            commentId: data.comment?.id,
          });
          setGroupComments((prev) => [data.comment, ...prev]);
          setNewGroupComment('');
        } else {
          const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
          console.error('[ReviewSection] Failed to submit group comment:', {
            status: res.status,
            statusText: res.statusText,
            error: errorData.error || errorData.message,
            errorData,
          });
        }
      } catch (err) {
        console.error('[ReviewSection] Exception submitting group comment:', {
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        });
      } finally {
        setSubmittingGroupComment(false);
      }
    });
  }, [groupId, token, newGroupComment, requireIdentity]);
  
  // Button should be disabled if:
  // - No unapproved assets are selected (selectedUnapprovedCount === 0), OR
  // - All assets in group are already approved (pendingCount === 0), OR
  // - Currently approving
  const shouldDisableApproveButton = 
    selectedUnapprovedCount === 0 || 
    pendingCount === 0 || 
    approvingGroup;

  const openLightbox = (index: number) => setLightboxIndex(index);
  const closeLightbox = () => setLightboxIndex(null);

  const saveComments = useCallback(
    async (fields: { comments?: string; approved?: boolean }) => {
      if (!identity) {
        console.warn('[ReviewSection] Cannot save comments: identity not available');
        return;
      }

      setSaving(true);
      try {
        const payload: Record<string, unknown> = {
          variant,
          tactic,
          authorName: identity.name,
          authorEmail: identity.email,
          ...fields,
        };
        if (fields.approved !== undefined) {
          payload.approvedAt = new Date().toISOString();
        }
        const res = await fetch(`/api/review/feedback?token=${encodeURIComponent(token)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
          console.error('[ReviewSection] Failed to save comments:', errorData.error || res.statusText);
          return;
        }
        
        const result = await res.json();
        if (result.ok) {
          setLastSaved(new Date().toLocaleTimeString());
        } else {
          console.error('[ReviewSection] Comments save returned not ok:', result);
        }
      } catch (err) {
        console.error('[ReviewSection] Error saving comments:', err);
      } finally {
        setSaving(false);
      }
    },
    [variant, tactic, token, identity],
  );

  const handleGroupApprove = () => {
    if (selectedUnapprovedCount === 0) return;
    
    requireIdentity(async (currentIdentity) => {
      setApprovingGroup(true);
      const approvedAt = new Date().toISOString();
      const approvedByName = currentIdentity.name;
      const approvedByEmail = currentIdentity.email;
      
      // Optimistically update local state to show Approved badges immediately
      selectedUnapprovedFileIds.forEach((fileId) => {
        onAssetStatusChange?.(variant, tactic, fileId, 'approved');
      });
      
      try {
        // Use bulk approve API to approve only selected assets
        const res = await fetch('/api/review/assets/bulk-approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({
            token,
            fileIds: selectedUnapprovedFileIds,
            approvedAt,
            approvedByName,
            approvedByEmail,
            deliveryBatchId: deliveryBatchId ?? undefined,
            sections: [{
              variant,
              tactic,
              fileIds: selectedUnapprovedFileIds,
            }],
          }),
        });
        
        if (res.ok) {
          const data = await res.json();
          // Clear selection for this section's assets
          selectedUnapprovedFileIds.forEach((fileId) => {
            onToggleSelect?.(fileId);
          });
          // Optionally update group approval if all assets are now approved
          // (This is optional - we can keep it simple and just approve selected assets)
        } else {
          // On error, refresh to revert optimistic update
          const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
          console.error('[ReviewSection] Failed to approve selected assets:', errorData);
        }
      } catch (err) {
        console.error('[ReviewSection] Error approving selected assets:', err);
        // On error, refresh to revert optimistic update
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
        requireIdentity(async (currentIdentity) => {
          if (!currentIdentity) {
            console.error('[ReviewSection] Identity not provided by requireIdentity callback');
            return;
          }
          
          if (pendingCommentRef.current) {
            const commentsToSave = pendingCommentRef.current;
            pendingCommentRef.current = null;
            
            // Save comments directly with provided identity
            setSaving(true);
            try {
              const payload: Record<string, unknown> = {
                variant,
                tactic,
                authorName: currentIdentity.name,
                authorEmail: currentIdentity.email,
                comments: commentsToSave,
              };
              const res = await fetch(`/api/review/feedback?token=${encodeURIComponent(token)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              });
              
              if (!res.ok) {
                const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
                console.error('[ReviewSection] Failed to save comments:', {
                  status: res.status,
                  error: errorData.error || res.statusText,
                  payload: { variant, tactic, hasIdentity: !!currentIdentity },
                });
                return;
              }
              
              const result = await res.json();
              if (result.ok) {
                setLastSaved(new Date().toLocaleTimeString());
                console.log('[ReviewSection] Comments saved successfully');
              } else {
                console.error('[ReviewSection] Comments save returned not ok:', result);
              }
            } catch (err) {
              console.error('[ReviewSection] Error saving comments:', err);
            } finally {
              setSaving(false);
            }
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
      {hasFiles ? (
        <>
          {/* Orientation: section name + total + new (single clear line) */}
          <p className="mb-1 text-base font-medium text-gray-200" aria-live="polite">
            {tactic} ads · {totalCount} total
            {newCount > 0 ? ` · ${newCount} new since your last visit` : ''}
          </p>
          {/* Status: pending or all approved */}
          <p className="mb-3 text-sm text-gray-400">
            {pendingCount > 0 ? (
              <>{pendingCount} pending approval</>
            ) : (
              <>All approved</>
            )}
          </p>
          {/* Selection controls: below orientation + status */}
          <div className="mb-4 flex flex-wrap items-center gap-4">
            {onSelectAllUnapprovedInSection && pendingCount > 0 && (
              <SelectAllUnapprovedCheckbox
                checked={allUnapprovedSelected}
                indeterminate={someUnapprovedSelected}
                pendingCount={pendingCount}
                onToggle={() => onSelectAllUnapprovedInSection(unapprovedFileIds)}
              />
            )}
            {onSelectNewInSection && newCount > 0 && (
              <button
                type="button"
                onClick={() => onSelectNewInSection(newFileIds)}
                className="text-sm text-amber-400 hover:text-amber-300 hover:underline"
              >
                Select new ({newCount})
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold text-amber-400">{tactic}</h2>
          <span className="text-sm text-gray-500">— No files yet</span>
        </div>
      )}

      {/* Asset grid — only when files exist; 4–5 columns so 10+ assets fit without cramping */}
      {hasFiles ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
          {assets.map((asset, index) => {
            const isApproved = asset.assetApprovedClient || false;
            return (
              <AssetCard
                key={asset.fileId}
                asset={asset}
                token={token}
                onClick={() => openLightbox(index)}
                selected={selectedFileIds.has(asset.fileId)}
                onToggleSelect={
                  onToggleSelect && !isApproved 
                    ? () => onToggleSelect(asset.fileId) 
                    : undefined
                }
                onDownloadAsset={onDownloadAsset}
              />
            );
          })}
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
          onApprovedResult={onSingleAssetApprovedResult}
          onPartnerDownload={onPartnerDownload}
          deliveryBatchId={deliveryBatchId}
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
              disabled={shouldDisableApproveButton}
              className={`shrink-0 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                shouldDisableApproveButton
                  ? 'border border-gray-700 bg-gray-800/40 text-gray-500 cursor-not-allowed'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
              title={
                shouldDisableApproveButton
                  ? pendingCount === 0
                    ? 'All assets approved - no action needed'
                    : 'Select assets to approve'
                  : `Approve ${selectedUnapprovedCount} selected asset${selectedUnapprovedCount !== 1 ? 's' : ''}`
              }
            >
              {approvingGroup 
                ? 'Approving…' 
                : selectedUnapprovedCount > 0 
                  ? `Approve (${selectedUnapprovedCount})`
                  : 'Approve'}
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
          
          {/* Group Comments */}
          {groupId && (
            <div className="mt-4 border-t border-gray-700 pt-4">
              <h4 className="mb-3 text-sm font-medium text-gray-300">Group Comments</h4>
              
              {/* Comments list */}
              <div className="mb-3 space-y-3 max-h-64 overflow-y-auto">
                {loadingGroupComments ? (
                  <p className="text-center text-xs text-gray-500">Loading comments...</p>
                ) : groupComments.length === 0 ? (
                  <p className="text-center text-xs text-gray-500">No comments yet</p>
                ) : (
                  groupComments.map((comment) => (
                    <div key={comment.id} className="rounded-md bg-gray-900/50 p-3">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-300">{comment.author}</span>
                        {comment.authorEmail && (
                          <span className="text-xs text-gray-500">({comment.authorEmail})</span>
                        )}
                        <span className="text-xs text-gray-600">
                          {formatRelativeTime(comment.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-200 whitespace-pre-wrap">{comment.body}</p>
                    </div>
                  ))
                )}
              </div>
              
              {/* Comment input */}
              <div className="flex gap-2">
                <textarea
                  value={newGroupComment}
                  onChange={(e) => setNewGroupComment(e.target.value)}
                  placeholder="Add a comment..."
                  rows={2}
                  className="flex-1 rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleSubmitGroupComment();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleSubmitGroupComment}
                  disabled={!newGroupComment.trim() || submittingGroupComment}
                  className="shrink-0 rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submittingGroupComment ? 'Posting...' : 'Post'}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

function formatRelativeTime(iso: string): string {
  try {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  } catch {
    return '';
  }
}

function formatShortDate(iso: string | null | undefined): string {
  if (!iso || !iso.trim()) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}

function AssetDetailsLine({ asset }: { asset: { approvedAt?: string | null; approvedByName?: string | null; firstSeenAt?: string | null; lastSeenAt?: string | null } }) {
  const parts: string[] = [];
  if (asset.approvedAt) {
    const by = asset.approvedByName?.trim();
    const date = formatShortDate(asset.approvedAt);
    if (by && date) parts.push(`Approved by ${by} · ${date}`);
    else if (date) parts.push(`Approved ${date}`);
  }
  if (asset.firstSeenAt && !parts.length) {
    parts.push(`First seen ${formatShortDate(asset.firstSeenAt)}`);
  } else if (asset.lastSeenAt && !asset.approvedAt) {
    parts.push(`Last seen ${formatShortDate(asset.lastSeenAt)}`);
  }
  if (parts.length === 0) return null;
  return <p className="mt-0.5 text-xs text-gray-500" title={parts.join(' ')}>{parts[0]}</p>;
}

function statusBadgeLabel(state: ReviewState | undefined): string {
  if (!state || state === 'new') return 'New';
  if (state === 'seen') return 'Seen';
  if (state === 'approved') return 'Approved';
  if (state === 'needs_changes') return 'Needs Changes';
  return 'New';
}

function statusBadgeClass(state: ReviewState | undefined): string {
  if (!state || state === 'new') return 'bg-amber-500 text-white font-semibold shadow-lg shadow-amber-500/50 border border-amber-400';
  if (state === 'seen') return 'bg-blue-900/60 text-blue-200';
  if (state === 'approved') return 'bg-emerald-600 text-white font-semibold shadow-lg shadow-emerald-600/50 border border-emerald-400';
  if (state === 'needs_changes') return 'bg-amber-900/60 text-amber-200';
  return 'bg-gray-700 text-gray-300';
}

function AssetCard({
  asset,
  token,
  onClick,
  selected = false,
  onToggleSelect,
  onDownloadAsset,
}: {
  asset: { fileId: string; name: string; mimeType: string; reviewState?: ReviewState; clickThroughUrl?: string | null; firstSeenByClientAt?: string | null; assetApprovedClient?: boolean; delivered?: boolean; deliveredFileUrl?: string | null; deliveredFolderId?: string | null; partnerDownloadedAt?: string | null; approvedAt?: string | null; approvedByName?: string | null; approvedByEmail?: string | null; firstSeenAt?: string | null; lastSeenAt?: string | null };
  token: string;
  onClick: () => void;
  selected?: boolean;
  onToggleSelect?: (() => void) | undefined;
  onDownloadAsset?: (assetId: string) => void | Promise<void>;
}) {
  const isApproved = asset.assetApprovedClient || false;
  // For animated images (GIF, animated WebP), use Google Drive direct view URL for proper animation
  // This format works better for animated images than proxying through our API
  const lowerName = asset.name.toLowerCase();
  const isAnimatedImage = asset.mimeType === 'image/gif' || 
    (asset.mimeType === 'image/webp' && (lowerName.includes('animated') || lowerName.includes('.gif'))) ||
    lowerName.endsWith('.gif');
  const driveDirectUrl = isAnimatedImage 
    ? `https://drive.google.com/uc?export=view&id=${asset.fileId}`
    : null;
  
  const src = driveDirectUrl || `/api/review/files/${asset.fileId}?token=${encodeURIComponent(token)}`;
  const isImage = asset.mimeType.startsWith('image/');
  const isVideo = asset.mimeType.startsWith('video/');
  const isAudio = asset.mimeType.startsWith('audio/');
  const isNew = isAssetNew(asset);
  const effectiveState: ReviewState | undefined = asset.assetApprovedClient ? 'approved' : asset.reviewState;
  const badgeLabel = isNew ? 'New' : statusBadgeLabel(effectiveState);
  const badgeClass = isNew ? 'bg-amber-500 text-white font-semibold shadow-lg shadow-amber-500/50 border border-amber-400' : statusBadgeClass(effectiveState);
  const hasClickThrough = typeof asset.clickThroughUrl === 'string' && asset.clickThroughUrl.trim().length > 0;

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-lg border bg-gray-800 text-left transition-colors hover:border-amber-500/50 hover:bg-gray-750 ${
        selected ? 'border-amber-500 ring-2 ring-amber-500/50' : 'border-gray-700'
      }`}
    >
    <div className="relative flex flex-1 flex-col">
      {/* Checkbox overlay: top-left, does not trigger card click */}
      {/* Only show checkbox if asset is not approved */}
      {onToggleSelect && !isApproved && (
        <div className="absolute left-2 top-2 z-20">
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => {
              e.stopPropagation();
              onToggleSelect();
            }}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-amber-500 focus:ring-amber-500"
            aria-label={selected ? 'Deselect' : 'Select'}
          />
        </div>
      )}
    <button
      type="button"
      onClick={onClick}
      className="group flex-1 overflow-hidden text-left focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:ring-inset"
    >
      <div className="relative flex aspect-video items-center justify-center bg-gray-900">
        {/* Status badge: right of checkbox when checkbox present, else left-2 */}
        <span
          className={`absolute ${onToggleSelect ? 'left-10' : 'left-2'} top-2 z-10 rounded-md px-2.5 py-1 text-xs font-semibold ${badgeClass}`}
          title={isNew ? 'Added since your last visit' : undefined}
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
            <VideoWithThumbnail src={src} className="h-full w-full object-contain" />
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
        {isNew && (
          <p className="mt-0.5 text-xs text-gray-500">Added since your last visit</p>
        )}
        <AssetDetailsLine asset={asset} />
      </div>
    </button>
    </div>
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
    {onDownloadAsset && (
      <div className="mx-3 mb-2 flex justify-end">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDownloadAsset(asset.fileId);
          }}
          className="inline-flex items-center gap-1 rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs font-medium text-gray-200 hover:bg-gray-700"
        >
          Download
        </button>
      </div>
    )}
    </div>
  );
}

