'use client';

// ReviewSection.tsx
// Client component: per-tactic approval toggle + comment textarea.
// Requires author identity before approval or commenting.
// Assets can be clicked to open a lightbox for expanded preview.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AssetLightbox from './AssetLightbox';
import { useAuthorIdentity } from './AuthorIdentityContext';
import { reviewAssetIsAudio, reviewAssetIsImage, reviewAssetIsVideo } from '@/lib/review/reviewMediaDisplay';
import { getSectionCounts, isAssetNew } from './reviewAssetUtils';
import type { ReviewState } from './ReviewPortalClient';

// ============================================================================
// Placement Grouping Types and Utilities (for Carousel/Grouped Assets)
// ============================================================================

/**
 * A group of assets that form a single reviewable placement (e.g., carousel).
 * All child assets share the same placementGroupId.
 */
interface PlacementGroup {
  groupId: string;
  groupName: string;
  placementType: string;
  /** Child assets sorted by placementCardOrder */
  assets: ReviewAsset[];
  /** True if ALL child assets are approved */
  allApproved: boolean;
  /** Count of approved child assets */
  approvedCount: number;
  /** True if ANY child asset is new (firstSeenByClientAt is null) */
  hasNew: boolean;
}

/**
 * A renderable item: all assets are now wrapped in placement containers.
 */
type RenderableItem = { type: 'group'; group: PlacementGroup };

/**
 * Group assets by placementGroupId. All assets are wrapped in placement containers
 * for a consistent approval experience.
 *
 * Grouping rules:
 * 1. Assets with same Placement Group ID are grouped together
 * 2. Assets without Placement Group ID become single-asset placements
 * 3. Group name uses Placement Group Name, falls back to asset name
 * 4. Assets within groups are sorted by Placement Card Order
 */
function groupAssetsForRendering(assets: ReviewAsset[]): RenderableItem[] {
  const groupMap = new Map<string, ReviewAsset[]>();
  const standaloneAssets: ReviewAsset[] = [];

  for (const asset of assets) {
    const groupId = asset.placementGroupId;
    if (groupId && groupId.trim()) {
      const existing = groupMap.get(groupId);
      if (existing) {
        existing.push(asset);
      } else {
        groupMap.set(groupId, [asset]);
      }
    } else {
      standaloneAssets.push(asset);
    }
  }

  const items: RenderableItem[] = [];

  // Process multi-asset groups
  for (const [groupId, groupAssets] of groupMap) {
    // Sort by placementCardOrder (nulls go last)
    const sorted = [...groupAssets].sort((a, b) => {
      const orderA = a.placementCardOrder ?? 999;
      const orderB = b.placementCardOrder ?? 999;
      return orderA - orderB;
    });

    const firstAsset = sorted[0];
    const allApproved = sorted.every((a) => a.assetApprovedClient);
    const approvedCount = sorted.filter((a) => a.assetApprovedClient).length;
    const hasNew = sorted.some(isAssetNew);

    // Use Placement Group Name if available, otherwise fall back to first asset name
    const groupName = firstAsset.placementGroupName?.trim() || firstAsset.name || `Group ${groupId.slice(0, 8)}`;

    const group: PlacementGroup = {
      groupId,
      groupName,
      placementType: firstAsset.placementType || 'Placement',
      assets: sorted,
      allApproved,
      approvedCount,
      hasNew,
    };

    items.push({ type: 'group', group });
  }

  // Wrap standalone assets as single-asset placements for consistent UI
  for (const asset of standaloneAssets) {
    const isApproved = asset.assetApprovedClient || false;
    const hasNew = isAssetNew(asset);

    // Create a synthetic placement group for this single asset
    // Use fileId as groupId to ensure uniqueness
    const group: PlacementGroup = {
      groupId: `standalone-${asset.fileId}`,
      groupName: asset.placementGroupName?.trim() || asset.name || 'Untitled',
      placementType: asset.placementType || 'Placement',
      assets: [asset],
      allApproved: isApproved,
      approvedCount: isApproved ? 1 : 0,
      hasNew,
    };

    items.push({ type: 'group', group });
  }

  return items;
}

/**
 * Grid / card video thumbnail: show the decoded frame on a real {@link HTMLVideoElement}.
 * Canvas capture often fails for .mov / QuickTime while the video surface still paints a frame.
 */
/** Append `dl=1` to the review file proxy URL (strip `#…` first). */
export function reviewFileDownloadHref(proxySrc: string): string {
  const base = proxySrc.split('#')[0];
  return base.includes('dl=1') ? base : `${base}${base.includes('?') ? '&' : '?'}dl=1`;
}

export function VideoWithThumbnail({
  src,
  className,
  controls = false,
  autoPlay = false,
  downloadHref,
}: {
  src: string;
  className?: string;
  controls?: boolean;
  autoPlay?: boolean;
  /** Shown if decode/playback fails (e.g. ProRes/HEVC .mov in Chrome). */
  downloadHref?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loadError, setLoadError] = useState(false);
  const soughtRef = useRef(false);

  /** Media fragment hints some browsers to decode an early frame (safe with our query-string URLs). */
  const srcWithFragment = src.includes('#') ? src : `${src}#t=0.08`;

  useEffect(() => {
    setLoadError(false);
    soughtRef.current = false;
  }, [src]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || loadError) return;

    const seekThumb = () => {
      if (soughtRef.current) return;
      try {
        if (v.duration > 0 && !Number.isNaN(v.duration)) {
          const t = Math.min(1.25, Math.max(0.05, v.duration * 0.08));
          v.currentTime = t;
        } else {
          v.currentTime = 0.08;
        }
        soughtRef.current = true;
      } catch {
        /* ignore */
      }
    };

    const onLoadedMeta = () => {
      seekThumb();
    };

    const onCanPlay = () => {
      if (!soughtRef.current) seekThumb();
    };

    v.addEventListener('loadedmetadata', onLoadedMeta);
    v.addEventListener('canplay', onCanPlay);

    if (v.readyState >= 1) {
      seekThumb();
    }

    return () => {
      v.removeEventListener('loadedmetadata', onLoadedMeta);
      v.removeEventListener('canplay', onCanPlay);
    };
  }, [src, loadError]);

  if (loadError) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 bg-gray-900 px-2 text-center ${className ?? ''}`}
        aria-hidden
      >
        <svg className="h-10 w-10 shrink-0 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
        {downloadHref ? (
          <a
            href={downloadHref}
            className="pointer-events-auto max-w-full truncate text-xs font-medium text-amber-400 underline hover:text-amber-300"
            onClick={(e) => e.stopPropagation()}
          >
            Download to view
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      src={srcWithFragment}
      className={`${className ?? ''} ${!controls ? 'pointer-events-none' : ''}`}
      muted={!autoPlay}
      playsInline
      preload="auto"
      controls={controls}
      autoPlay={autoPlay}
      onError={() => setLoadError(true)}
    />
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
  // Placement grouping fields (for carousel/grouped assets)
  /** Placement Group ID: groups multiple assets as one reviewable placement (e.g., carousel). */
  placementGroupId?: string | null;
  /** Display name for the grouped placement. */
  placementGroupName?: string | null;
  /** Placement type: "Carousel", "Static", etc. Controls rendering. */
  placementType?: string | null;
  /** Sort order within the group (1, 2, 3, 4 for carousel cards). */
  placementCardOrder?: number | null;
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

  // Group assets for rendering (placement groups together, standalone assets separate)
  const renderableItems = useMemo(() => groupAssetsForRendering(assets), [assets]);

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

  // Tactic-specific accent colors for visual distinction
  const tacticStyles: Record<string, { bg: string; border: string; icon: string; text: string }> = {
    Audio: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', icon: 'text-purple-400', text: 'text-purple-300' },
    Display: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', icon: 'text-blue-400', text: 'text-blue-300' },
    Geofence: { bg: 'bg-green-500/10', border: 'border-green-500/30', icon: 'text-green-400', text: 'text-green-300' },
    OOH: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', icon: 'text-orange-400', text: 'text-orange-300' },
    PMAX: { bg: 'bg-red-500/10', border: 'border-red-500/30', icon: 'text-red-400', text: 'text-red-300' },
    Social: { bg: 'bg-pink-500/10', border: 'border-pink-500/30', icon: 'text-pink-400', text: 'text-pink-300' },
    Video: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', icon: 'text-cyan-400', text: 'text-cyan-300' },
    Search: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', icon: 'text-yellow-400', text: 'text-yellow-300' },
  };
  const style = tacticStyles[tactic] || { bg: 'bg-gray-500/10', border: 'border-gray-500/30', icon: 'text-gray-400', text: 'text-gray-300' };

  // Tactic icons
  const tacticIcons: Record<string, React.ReactNode> = {
    Audio: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />,
    Display: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />,
    Geofence: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />,
    OOH: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />,
    PMAX: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />,
    Social: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />,
    Video: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />,
    Search: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />,
  };

  return (
    <section className={`mb-8 overflow-hidden rounded-xl border ${style.border} ${style.bg}`}>
      {/* Section Header */}
      <div className="border-b border-gray-700/50 bg-gray-800/50 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Tactic Icon */}
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gray-900/50`}>
              <svg className={`h-5 w-5 ${style.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {tacticIcons[tactic] || <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />}
              </svg>
            </div>
            {/* Tactic Name & Stats */}
            <div>
              <h2 className={`text-lg font-bold ${style.text}`}>{tactic}</h2>
              {hasFiles ? (
                <p className="text-sm text-gray-400">
                  {totalCount} asset{totalCount !== 1 ? 's' : ''}
                  {newCount > 0 && <span className="ml-2 text-amber-400">· {newCount} new</span>}
                </p>
              ) : (
                <p className="text-sm text-gray-500">No files yet</p>
              )}
            </div>
          </div>
          {/* Approval Status Badge */}
          {hasFiles && (
            <div className="flex items-center gap-3">
              {pendingCount > 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-3 py-1 text-sm font-medium text-amber-300">
                  <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                  {pendingCount} pending
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-sm font-medium text-emerald-300">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  All approved
                </span>
              )}
            </div>
          )}
        </div>
        {/* Selection controls */}
        {hasFiles && (
          <div className="mt-3 flex flex-wrap items-center gap-4">
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
        )}
      </div>

      {/* Asset grid — multi-column for single-asset placements, full-width for multi-asset */}
      {/* Renders all assets in placement containers for consistent approval UX */}
      {hasFiles ? (
        <div className="p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {renderableItems.map(({ group }) => (
              <PlacementGroupCard
                key={`group-${group.groupId}`}
                group={group}
                token={token}
                variant={variant}
                tactic={tactic}
                allAssets={assets}
                selectedFileIds={selectedFileIds}
                onToggleSelect={onToggleSelect}
                openLightbox={openLightbox}
                onDownloadAsset={onDownloadAsset}
                onAssetStatusChange={onAssetStatusChange}
                onApprovalResult={onSingleAssetApprovedResult}
                deliveryBatchId={deliveryBatchId}
              />
            ))}
          </div>
        </div>
      ) : null}

      {/* Feedback controls: visible when files exist, or behind "Add feedback" when empty */}
      {!hasFiles && !feedbackExpanded ? (
        <div className="p-5 pt-0">
          <button
            type="button"
            onClick={() => setFeedbackExpanded(true)}
            className="text-sm text-amber-400 hover:text-amber-300 hover:underline"
          >
            Add feedback
          </button>
        </div>
      ) : showFeedbackControls ? (
        <div className={`mx-5 mb-5 rounded-lg border border-gray-700 bg-gray-900/50 p-4 ${hasFiles ? '' : 'mt-0'}`}>
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

      {/* Lightbox - rendered outside the card but inside the section */}
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

// ============================================================================
// PlacementGroupCard: Visually groups assets under a placement header
// Includes "Approve Placement" button that approves ALL child assets using existing bulk-approve API
// ============================================================================

interface PlacementGroupCardProps {
  group: PlacementGroup;
  token: string;
  variant: string;
  tactic: string;
  /** All assets from the section (for finding lightbox index) */
  allAssets: ReviewAsset[];
  selectedFileIds: Set<string>;
  onToggleSelect?: (fileId: string) => void;
  openLightbox: (index: number) => void;
  onDownloadAsset?: (assetId: string) => void | Promise<void>;
  /** Callback when asset status changes (for optimistic UI updates) */
  onAssetStatusChange?: (variant: string, tactic: string, fileId: string, reviewState: ReviewState) => void;
  /** Callback when approval completes (for toast notifications) */
  onApprovalResult?: (success: boolean, message?: string) => void;
  /** Delivery batch ID for linking approved assets to delivery */
  deliveryBatchId?: string | null;
}

function PlacementGroupCard({
  group,
  token,
  variant,
  tactic,
  allAssets,
  selectedFileIds,
  onToggleSelect,
  openLightbox,
  onDownloadAsset,
  onAssetStatusChange,
  onApprovalResult,
  deliveryBatchId,
}: PlacementGroupCardProps) {
  const { assets, groupName, allApproved, approvedCount, hasNew, placementType } = group;
  const pendingCount = assets.length - approvedCount;
  const assetCount = assets.length;

  // Check if this is a carousel placement (show card numbers)
  const isCarousel = placementType?.toLowerCase() === 'carousel';

  // Multi-asset placements span full width; single-asset placements fit in grid cells
  const isMultiAsset = assetCount > 1;

  // Approval state
  const [isApproving, setIsApproving] = useState(false);
  const { requireIdentity } = useAuthorIdentity();

  // Get unapproved assets in this placement
  const unapprovedAssets = assets.filter((a) => !a.assetApprovedClient);
  const unapprovedFileIds = unapprovedAssets.map((a) => a.fileId);

  /**
   * Approve all assets in this placement group.
   * Uses the existing bulk-approve API to ensure all asset-level writebacks are preserved:
   * - Approved status, Approved by, Approved at
   * - Delivered Folder ID, Delivered Folder URL, Deliver Summary, Delivered At
   * - Ready to Deliver webhook triggers
   * - Any other existing asset-level automation
   */
  const handleApprovePlacement = useCallback(() => {
    if (unapprovedFileIds.length === 0) return;

    requireIdentity(async (currentIdentity) => {
      setIsApproving(true);
      const approvedAt = new Date().toISOString();
      const approvedByName = currentIdentity.name;
      const approvedByEmail = currentIdentity.email;

      // Optimistically update local state for each asset
      unapprovedFileIds.forEach((fileId) => {
        onAssetStatusChange?.(variant, tactic, fileId, 'approved');
      });

      try {
        // Call the same bulk-approve API used for individual asset approval
        // This ensures all existing writebacks are preserved
        const res = await fetch('/api/review/assets/bulk-approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({
            token,
            fileIds: unapprovedFileIds,
            approvedAt,
            approvedByName,
            approvedByEmail,
            deliveryBatchId: deliveryBatchId ?? undefined,
            sections: [{
              variant,
              tactic,
              fileIds: unapprovedFileIds,
            }],
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const approved = data.approved ?? unapprovedFileIds.length;
          onApprovalResult?.(true, `Approved ${approved} asset${approved !== 1 ? 's' : ''} in placement`);
        } else {
          const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
          console.error('[PlacementGroupCard] Failed to approve placement:', errorData);
          onApprovalResult?.(false, errorData.error || 'Failed to approve placement');
        }
      } catch (err) {
        console.error('[PlacementGroupCard] Error approving placement:', err);
        onApprovalResult?.(false, 'Error approving placement');
      } finally {
        setIsApproving(false);
      }
    });
  }, [
    token,
    variant,
    tactic,
    unapprovedFileIds,
    deliveryBatchId,
    onAssetStatusChange,
    onApprovalResult,
    requireIdentity,
  ]);

  return (
    <div className={`rounded-lg border border-gray-700 bg-gray-800/30 p-4 ${isMultiAsset ? 'col-span-full' : ''}`}>
      {/* Placement header */}
      <div className={isMultiAsset ? 'mb-4' : 'mb-3'}>
        {/* Group name */}
        <h3 className="text-base font-semibold text-gray-100">{groupName}</h3>

        {/* Approval progress indicator */}
        <div className="mt-1 flex items-center gap-2">
          {allApproved ? (
            <span className="flex items-center gap-1 text-sm font-medium text-emerald-400">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Approved
            </span>
          ) : (
            <span className="text-sm text-gray-400">
              <span className="font-medium text-gray-200">{approvedCount}</span>
              {' / '}
              <span className="font-medium text-gray-200">{assetCount}</span>
              {' Approved'}
            </span>
          )}

          {hasNew && (
            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-xs font-medium text-amber-400">
              New
            </span>
          )}
        </div>
      </div>

      {/* Carousel preview - horizontal strip layout */}
      {isCarousel ? (
        <div className="relative">
          {/* Carousel container with horizontal scroll */}
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-track-gray-800 scrollbar-thumb-gray-600">
            {assets.map((asset, index) => {
              const isApproved = asset.assetApprovedClient || false;
              const assetIndex = allAssets.findIndex((a) => a.fileId === asset.fileId);
              const cardNumber = asset.placementCardOrder ?? index + 1;
              const isImage = reviewAssetIsImage(asset.mimeType, asset.name);
              const isVideo = reviewAssetIsVideo(asset.mimeType, asset.name);

              // All assets (including animated GIFs) go through the file proxy.
              const src = `/api/review/files/${encodeURIComponent(asset.fileId)}?token=${encodeURIComponent(token)}`;

              return (
                <button
                  key={asset.fileId}
                  type="button"
                  onClick={() => openLightbox(assetIndex)}
                  className={`group relative flex-shrink-0 overflow-hidden rounded-lg border-2 transition-all hover:border-amber-500 hover:shadow-lg hover:shadow-amber-500/20 focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                    isApproved ? 'border-emerald-500/50' : 'border-gray-600'
                  } ${selectedFileIds.has(asset.fileId) ? 'ring-2 ring-amber-500' : ''}`}
                  style={{ width: '140px' }}
                >
                  {/* Card number label - prominent positioning */}
                  <div className="absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-gray-900/90 to-transparent px-2 py-1.5">
                    <span className="text-xs font-bold text-white drop-shadow-md">
                      Card {cardNumber}
                    </span>
                  </div>

                  {/* Thumbnail */}
                  <div className="aspect-square bg-gray-900">
                    {isImage && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={src}
                        alt={`Card ${cardNumber}`}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    )}
                    {isVideo && (
                      <div className="relative h-full w-full">
                        <VideoWithThumbnail
                          key={asset.fileId}
                          src={src}
                          downloadHref={reviewFileDownloadHref(src)}
                          className="h-full w-full object-cover"
                        />
                        {/* Video play icon overlay */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="rounded-full bg-black/60 p-2">
                            <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    )}
                    {!isImage && !isVideo && (
                      <div className="flex h-full w-full items-center justify-center text-gray-500">
                        <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Approved indicator */}
                  {isApproved && (
                    <div className="absolute bottom-1 right-1 z-20 rounded-full bg-emerald-500 p-0.5">
                      <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}

                  {/* Selection checkbox */}
                  {onToggleSelect && !isApproved && (
                    <div
                      className="absolute bottom-1 left-1 z-20"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedFileIds.has(asset.fileId)}
                        onChange={(e) => {
                          e.stopPropagation();
                          onToggleSelect(asset.fileId);
                        }}
                        className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-amber-500 focus:ring-amber-500"
                        aria-label={selectedFileIds.has(asset.fileId) ? 'Deselect' : 'Select'}
                      />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Carousel indicator - shows this is a connected sequence */}
          <div className="mt-2 flex items-center justify-center gap-1.5">
            {assets.map((asset, index) => (
              <div
                key={asset.fileId}
                className={`h-1.5 rounded-full transition-all ${
                  asset.assetApprovedClient
                    ? 'w-4 bg-emerald-500'
                    : 'w-2 bg-gray-600'
                }`}
                title={`Card ${asset.placementCardOrder ?? index + 1}${asset.assetApprovedClient ? ' (Approved)' : ''}`}
              />
            ))}
          </div>
        </div>
      ) : isMultiAsset ? (
        /* Grid layout for multi-asset non-carousel placements */
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {assets.map((asset) => {
            const isApproved = asset.assetApprovedClient || false;
            const assetIndex = allAssets.findIndex((a) => a.fileId === asset.fileId);

            return (
              <AssetCard
                key={asset.fileId}
                asset={asset}
                token={token}
                onClick={() => openLightbox(assetIndex)}
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
      ) : (
        /* Compact layout for single-asset placements */
        <div>
          {assets.map((asset) => {
            const isApproved = asset.assetApprovedClient || false;
            const assetIndex = allAssets.findIndex((a) => a.fileId === asset.fileId);

            return (
              <AssetCard
                key={asset.fileId}
                asset={asset}
                token={token}
                onClick={() => openLightbox(assetIndex)}
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
      )}

      {/* Placement action buttons */}
      <div className={`flex items-center gap-2 ${isMultiAsset ? 'mt-4 border-t border-gray-700 pt-4' : 'mt-3'}`}>
        {/* Approve button - approves all assets in this placement group */}
        {!allApproved && (
          <button
            type="button"
            onClick={handleApprovePlacement}
            disabled={isApproving || pendingCount === 0}
            className={`rounded-md bg-emerald-600 font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 ${
              isMultiAsset ? 'px-4 py-2 text-sm' : 'px-3 py-1.5 text-xs'
            }`}
          >
            {isApproving ? 'Approving…' : isMultiAsset ? `Approve Placement (${pendingCount})` : 'Approve'}
          </button>
        )}

        {/* Approved indicator */}
        {allApproved && (
          <span className={`flex items-center gap-1.5 font-medium text-emerald-400 ${isMultiAsset ? 'text-sm' : 'text-xs'}`}>
            <svg className={isMultiAsset ? 'h-5 w-5' : 'h-4 w-4'} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Approved
          </span>
        )}

        {/* Request Changes button (placeholder - will open feedback flow) */}
        {!allApproved && (
          <button
            type="button"
            onClick={() => {
              // TODO: Implement request changes flow
              // For now, this could scroll to or focus the comments section
              onApprovalResult?.(false, 'Request Changes: Please use the comments section below to provide feedback');
            }}
            disabled={isApproving}
            className={`rounded-md border border-gray-600 bg-gray-800 font-medium text-gray-300 transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50 ${
              isMultiAsset ? 'px-4 py-2 text-sm' : 'px-3 py-1.5 text-xs'
            }`}
          >
            {isMultiAsset ? 'Request Changes' : 'Changes'}
          </button>
        )}
      </div>
    </div>
  );
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
  // All files (including animated GIFs / animated WebP) go through our file
  // proxy. The proxy now streams the response with the correct Content-Type,
  // and browsers animate GIFs natively from <img src=…>. The previous code
  // pointed at https://drive.google.com/uc?export=view which requires the
  // file to be publicly shared and is otherwise rate-limited / deprecated.
  const src = `/api/review/files/${encodeURIComponent(asset.fileId)}?token=${encodeURIComponent(token)}`;
  const isImage = reviewAssetIsImage(asset.mimeType, asset.name);
  const isVideo = reviewAssetIsVideo(asset.mimeType, asset.name);
  const isAudio = reviewAssetIsAudio(asset.mimeType, asset.name);
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
            <VideoWithThumbnail
              key={asset.fileId}
              src={src}
              downloadHref={reviewFileDownloadHref(src)}
              className="h-full w-full object-contain"
            />
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

