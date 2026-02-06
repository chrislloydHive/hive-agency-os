'use client';

// ReviewPortalClient.tsx
// Client component: renders tabbed variant sections (Prospecting/Retargeting)
// with per-tactic approval UI. Wrapped in AuthorIdentityProvider for identity capture.
//
// Empty-state UX:
// - If variant has 0 total files: single empty-state card, no per-tactic list
// - If variant has files: show tactics with files; hide empty tactics behind toggle

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import HiveLogo from '@/components/HiveLogo';
import ReviewSection from './ReviewSection';
import { AuthorIdentityProvider, useAuthorIdentity } from './AuthorIdentityContext';

const DEBOUNCE_MS = 800;

export type ReviewState = 'new' | 'seen' | 'approved' | 'needs_changes';

interface ReviewAsset {
  fileId: string;
  name: string;
  mimeType: string;
  reviewState?: ReviewState;
  clickThroughUrl?: string | null;
  firstSeenByClientAt?: string | null;
  assetApprovedClient?: boolean;
  deliveredAt?: string | null;
  delivered?: boolean;
  deliveredFolderId?: string | null;
  airtableRecordId?: string;
  approvedAt?: string | null;
  partnerDownloadedAt?: string | null;
}

interface TacticSectionData {
  variant: string;
  tactic: string;
  assets: ReviewAsset[];
  fileCount: number;
  groupApprovalApprovedAt?: string | null;
  groupApprovalApprovedByName?: string | null;
  newSinceApprovalCount?: number;
}

/** Selected batch context (backward compat: deliveryBatchId/recordId aliases). */
export interface DeliveryContext {
  recordId?: string;
  deliveryBatchId: string;
  batchId?: string;
  batchRecordId?: string;
  destinationFolderId: string;
  destinationFolderUrl?: string;
  vendorName: string | null;
  partnerName?: string | null;
  partnerLastSeenAt?: string | null;
  newApprovedCount?: number | null;
  downloadedCount?: number | null;
  status?: string;
  createdTime?: string;
}

/** Batch context from GET /api/review/assets (deliveryBatches); Option B. */
export interface DeliveryBatchOption {
  batchRecordId?: string;
  batchId: string;
  destinationFolderId: string;
  destinationFolderUrl?: string;
  vendorName?: string | null;
  partnerName?: string | null;
  status?: string;
  createdTime?: string;
  recordId?: string;
}

interface TacticFeedback {
  approved: boolean;
  comments: string;
}

type ReviewData = Record<string, TacticFeedback>;

interface ReviewPortalClientProps {
  projectName: string;
  sections: TacticSectionData[];
  reviewData: ReviewData;
  token: string;
  variants: string[];
}

export default function ReviewPortalClient(props: ReviewPortalClientProps) {
  return (
    <AuthorIdentityProvider>
      <ReviewPortalClientInner {...props} />
    </AuthorIdentityProvider>
  );
}

/** Empty-state card when variant has 0 files. Optional "Leave general feedback" expand. */
function EmptyStateCard({
  variant,
  token,
  initialComments,
}: {
  variant: string;
  token: string;
  initialComments: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [comments, setComments] = useState(initialComments);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<string | null>(null);
  const { identity, requireIdentity } = useAuthorIdentity();

  const save = useCallback(
    async (value: string) => {
      if (!identity) return;
      setSaving(true);
      try {
        const res = await fetch(
          `/api/review/feedback?token=${encodeURIComponent(token)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              variant,
              tactic: 'General',
              comments: value,
              authorName: identity.name,
              authorEmail: identity.email,
            }),
          }
        );
        if (res.ok) setLastSaved(new Date().toLocaleTimeString());
      } catch {
        // silent
      } finally {
        setSaving(false);
      }
    },
    [variant, token, identity]
  );

  const handleChange = useCallback(
    (value: string) => {
      setComments(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      pendingRef.current = value;
      debounceRef.current = setTimeout(() => {
        if (pendingRef.current?.trim()) {
          requireIdentity(() => {
            if (pendingRef.current) {
              save(pendingRef.current);
              pendingRef.current = null;
            }
          });
        }
      }, DEBOUNCE_MS);
    },
    [requireIdentity, save]
  );

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-8 text-center">
      <h2 className="text-xl font-semibold text-white">No assets shared yet</h2>
      <p className="mt-2 text-sm text-gray-400">
        Previews will appear here automatically when files are uploaded.
      </p>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="mt-6 text-sm text-amber-400 hover:text-amber-300 hover:underline"
      >
        {expanded ? 'Hide feedback' : 'Leave general feedback'}
      </button>
      {expanded && (
        <div className="mt-4 text-left">
          <textarea
            value={comments}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Add comments or feedback..."
            rows={3}
            className="w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
          {(saving || lastSaved) && (
            <p className="mt-1 text-xs text-gray-500">
              {saving ? 'Saving...' : `Saved ${lastSaved}`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const REFRESH_DELAY_MS = 250;

function ReviewPortalClientInner({
  projectName,
  sections: initialSections,
  reviewData,
  token,
  variants,
}: ReviewPortalClientProps) {
  const [activeVariant, setActiveVariant] = useState(variants[0]);
  const [showEmptyTactics, setShowEmptyTactics] = useState(false);
  const [sections, setSections] = useState<TacticSectionData[]>(initialSections);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; link?: string } | null>(null);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [deliveryContext, setDeliveryContext] = useState<DeliveryContext | null>(null);
  const [deliveryBatches, setDeliveryBatches] = useState<DeliveryBatchOption[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [deliverApprovedOpen, setDeliverApprovedOpen] = useState(false);
  const [deliverApprovedState, setDeliverApprovedState] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [activePartnerTab, setActivePartnerTab] = useState<'new' | 'all_approved' | 'downloaded'>('new');
  const [markingSeen, setMarkingSeen] = useState(false);
  const [apiCounts, setApiCounts] = useState<{ newApproved: number; approved: number; downloaded: number } | null>(null);
  const lastFetchedTokenRef = useRef<string | null>(null);
  const firstSeenInFlightRef = useRef<Set<string>>(new Set());
  const { identity, clearIdentity } = useAuthorIdentity();

  const updateAssetReviewState = useCallback(
    (variant: string, tactic: string, fileId: string, reviewState: ReviewState) => {
      setSections((prev) =>
        prev.map((sec) => {
          if (sec.variant !== variant || sec.tactic !== tactic) return sec;
          return {
            ...sec,
            assets: sec.assets.map((a) =>
              a.fileId === fileId ? { ...a, reviewState } : a
            ),
          };
        })
      );
    },
    []
  );

  const updateGroupApproval = useCallback(
    (variant: string, tactic: string, approvedAt: string, _approvedByName: string, _approvedByEmail: string) => {
      setSections((prev) =>
        prev.map((sec) => {
          if (sec.variant !== variant || sec.tactic !== tactic) return sec;
          return {
            ...sec,
            groupApprovalApprovedAt: approvedAt,
            groupApprovalApprovedByName: _approvedByName,
            newSinceApprovalCount: 0,
          };
        })
      );
    },
    []
  );

  const doRefresh = useCallback(
    (batchIdOverride?: string | null) => {
      setRefreshError(null);
      setIsRefreshing(true);
      const batchId = batchIdOverride ?? selectedBatchId;
      const url = `/api/review/assets?token=${encodeURIComponent(token)}${batchId ? `&batchId=${encodeURIComponent(batchId)}` : ''}`;
      fetch(url, { cache: 'no-store' })
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
        .then((data: {
          ok?: boolean;
          version?: string;
          sections?: TacticSectionData[];
          lastFetchedAt?: string;
          deliveryContext?: DeliveryContext;
          deliveryBatches?: DeliveryBatchOption[];
          selectedBatchId?: string | null;
          counts?: { newApproved: number; approved: number; downloaded: number };
        }) => {
          if (data.ok === true && data.version === 'review-assets-v1' && Array.isArray(data.sections)) {
            setSections(data.sections);
            setRefreshError(null);
            if (Array.isArray(data.deliveryBatches)) {
              setDeliveryBatches(data.deliveryBatches);
            }
            if (data.selectedBatchId !== undefined) {
              setSelectedBatchId(data.selectedBatchId ?? null);
            }
            if (data.deliveryContext) {
              setDeliveryContext(data.deliveryContext);
            } else {
              setDeliveryContext(null);
            }
            if (data.counts && typeof data.counts.newApproved === 'number' && typeof data.counts.approved === 'number' && typeof data.counts.downloaded === 'number') {
              setApiCounts(data.counts);
            } else {
              setApiCounts(null);
            }
            if (typeof data.lastFetchedAt === 'string') {
              setLastRefreshedAt(data.lastFetchedAt);
            }
            // Fire-and-forget: mark unseen assets as "first seen" (in-flight guard prevents duplicate POSTs)
            const unseenFileIds = data.sections?.flatMap((s) =>
              s.assets.filter((a) => {
                const v = a.firstSeenByClientAt;
                const empty = v == null || (typeof v === 'string' && v.trim() === '');
                return empty;
              }).map((a) => a.fileId)
            ) ?? [];
            const toSend = unseenFileIds.filter((id) => !firstSeenInFlightRef.current.has(id));
            if (toSend.length > 0) {
              toSend.forEach((id) => firstSeenInFlightRef.current.add(id));
              fetch('/api/review/assets/first-seen', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, fileIds: toSend }),
              })
                .catch(() => { /* non-blocking */ })
                .finally(() => {
                  toSend.forEach((id) => firstSeenInFlightRef.current.delete(id));
                });
            }
          }
        })
        .catch((err) => {
          setRefreshError(err?.message ?? 'Request failed');
        })
        .finally(() => {
          setIsRefreshing(false);
        });
    },
    [token, selectedBatchId]
  );

  // Fetch asset list after short delay (reduces contention with server render). Abort on unmount/token change.
  useEffect(() => {
    if (lastFetchedTokenRef.current === token) return;
    lastFetchedTokenRef.current = token;
    const timeoutId = setTimeout(doRefresh, REFRESH_DELAY_MS);
    return () => clearTimeout(timeoutId);
  }, [token, doRefresh]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  // Reset showEmptyTactics and clear selection when switching variants
  useEffect(() => {
    setShowEmptyTactics(false);
    setSelectedFileIds(new Set());
  }, [activeVariant]);

  // Partner tab filter: New = approved && !downloaded && (approved after lastSeen or lastSeen null); All Approved; Downloaded
  const partnerLastSeenAt = deliveryContext?.partnerLastSeenAt ?? null;
  const isNewlyApproved = useCallback(
    (a: ReviewAsset) =>
      !!(
        a.assetApprovedClient &&
        !a.partnerDownloadedAt &&
        (!partnerLastSeenAt || (a.approvedAt && new Date(a.approvedAt) > new Date(partnerLastSeenAt)))
      ),
    [partnerLastSeenAt]
  );
  const isPartnerDownloaded = useCallback((a: ReviewAsset) => !!a.partnerDownloadedAt, []);

  const partnerTabCountsFromSections = useMemo(() => {
    const allAssets = sections.flatMap((s) => s.assets);
    return {
      new: allAssets.filter(isNewlyApproved).length,
      allApproved: allAssets.filter((a) => a.assetApprovedClient).length,
      downloaded: allAssets.filter(isPartnerDownloaded).length,
    };
  }, [sections, isNewlyApproved, isPartnerDownloaded]);

  const partnerTabCounts = deliveryContext && apiCounts
    ? { new: apiCounts.newApproved, allApproved: apiCounts.approved, downloaded: apiCounts.downloaded }
    : partnerTabCountsFromSections;

  const partnerFilterSections = useCallback(
    (secs: TacticSectionData[], tab: 'new' | 'all_approved' | 'downloaded') => {
      return secs.map((sec) => {
        const filtered =
          tab === 'new'
            ? sec.assets.filter(isNewlyApproved)
            : tab === 'all_approved'
              ? sec.assets.filter((a) => a.assetApprovedClient)
              : sec.assets.filter(isPartnerDownloaded);
        return { ...sec, assets: filtered, fileCount: filtered.length };
      });
    },
    [isNewlyApproved, isPartnerDownloaded]
  );

  // Filter sections by active variant (declared before callbacks that use them)
  const activeSections = sections.filter((s) => s.variant === activeVariant);
  const partnerFilteredSections =
    deliveryContext != null
      ? partnerFilterSections(activeSections, activePartnerTab)
      : activeSections;
  const totalFiles = partnerFilteredSections.reduce((sum, s) => sum + s.fileCount, 0);
  const deliverableAssets = sections.flatMap((s) =>
    s.assets.filter((a) => a.assetApprovedClient && !a.delivered)
  );
  const deliverableCount = deliverableAssets.length;
  const deliverableFileIds = deliverableAssets.map((a) => a.fileId);
  const sectionsToRender =
    totalFiles === 0
      ? []
      : showEmptyTactics
        ? partnerFilteredSections
        : partnerFilteredSections.filter((s) => s.fileCount > 0);
  const selectedCount = selectedFileIds.size;

  const toggleSelection = useCallback((fileId: string) => {
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedFileIds(new Set()), []);

  /** Toggle: select all unapproved in section, or clear if already all selected. */
  const selectAllUnapprovedInSection = useCallback((unapprovedFileIds: string[]) => {
    setSelectedFileIds((prev) => {
      const allSelected =
        unapprovedFileIds.length > 0 &&
        unapprovedFileIds.every((id) => prev.has(id)) &&
        prev.size === unapprovedFileIds.length;
      return allSelected ? new Set() : new Set(unapprovedFileIds);
    });
  }, []);

  /** Select only the "new since last visit" assets in this section. */
  const selectNewInSection = useCallback((newFileIds: string[]) => {
    setSelectedFileIds(new Set(newFileIds));
  }, []);

  const handleSingleAssetApprovedResult = useCallback(
    (success: boolean, message?: string) => {
      setToast({
        message: message ?? (success ? 'Approved' : 'Failed to approve'),
        type: success ? 'success' : 'error',
      });
    },
    []
  );

  const handleApproveSelected = useCallback(() => {
    const fileIds = Array.from(selectedFileIds);
    if (fileIds.length === 0) return;
    setBulkApproving(true);
    setToast(null);
    fetch('/api/review/assets/bulk-approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({
        token,
        fileIds,
        approvedAt: new Date().toISOString(),
        approvedByName: identity?.name,
        approvedByEmail: identity?.email,
      }),
    })
      .then((res) => res.json())
      .then((data: { ok?: boolean; approved?: number; alreadyApproved?: number; error?: string; partial?: boolean }) => {
        if (data.ok === true) {
          const approved = data.approved ?? 0;
          const alreadyApproved = data.alreadyApproved ?? 0;
          setToast({
            message: `Approved ${approved} assets${alreadyApproved > 0 ? ` (${alreadyApproved} already approved)` : ''}.`,
            type: 'success',
          });
          setSelectedFileIds(new Set());
          doRefresh();
        } else {
          const approved = data.approved ?? 0;
          const partial = data.partial === true && approved > 0;
          setToast({
            message: partial
              ? `Error: ${data.error ?? 'Update failed'}. ${approved} approved before failure.`
              : (data.error ?? 'Bulk approve failed'),
            type: 'error',
          });
        }
      })
      .catch((err) => {
        setToast({
          message: err?.message ?? 'Bulk approve failed',
          type: 'error',
        });
      })
      .finally(() => {
        setBulkApproving(false);
      });
  }, [token, selectedFileIds, doRefresh, identity]);

  const handleMarkSeen = useCallback(() => {
    const batchId = selectedBatchId ?? deliveryContext?.deliveryBatchId;
    if (!batchId) return;
    setMarkingSeen(true);
    fetch('/api/review/partners/mark-seen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, batchId }),
    })
      .then((res) => res.ok ? res.json() : Promise.reject(new Error(res.statusText)))
      .then(() => {
        setToast({ message: 'Marked all as seen.', type: 'success' });
        doRefresh();
      })
      .catch((err) => {
        setToast({ message: err?.message ?? 'Failed to mark as seen', type: 'error' });
      })
      .finally(() => setMarkingSeen(false));
  }, [token, selectedBatchId, deliveryContext, doRefresh]);

  const handleMarkDownloaded = useCallback(
    (fileIds: string[]) => {
      if (fileIds.length === 0) return;
      fetch('/api/review/assets/mark-downloaded', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          fileIds,
          deliveryBatchId: deliveryContext?.deliveryBatchId,
        }),
      })
        .then((res) => res.ok ? undefined : Promise.reject(new Error(res.statusText)))
        .then(() => doRefresh())
        .catch(() => { /* non-blocking */ });
    },
    [token, deliveryContext?.deliveryBatchId, doRefresh]
  );

  /** Partner view: get signed download URL, open in new tab, refresh list after delay. */
  const handleDownloadAsset = useCallback(
    async (assetId: string) => {
      try {
        const res = await fetch('/api/review/assets/download-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, assetId }),
        });
        const data = await res.json();
        if (!data.ok || !data.url) {
          setToast({
            message: data.error ?? 'Could not get download link',
            type: 'error',
          });
          return;
        }
        window.open(data.url, '_blank');
        setTimeout(doRefresh, 3000);
      } catch (err) {
        setToast({
          message: err instanceof Error ? err.message : 'Download failed',
          type: 'error',
        });
      }
    },
    [token, doRefresh]
  );

  const handleDeliverApproved = useCallback(() => {
    const batchId = selectedBatchId ?? deliveryContext?.deliveryBatchId;
    const destFolderId =
      deliveryContext?.destinationFolderId ??
      deliveryBatches.find((b) => b.batchId === batchId)?.destinationFolderId;
    if (!batchId || !destFolderId || deliverableFileIds.length === 0) return;
    setDeliverApprovedState('running');
    fetch('/api/review/assets/deliver-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        deliveryBatchId: batchId,
        destinationFolderId: destFolderId,
        approvedFileIds: deliverableFileIds,
      }),
    })
      .then((res) => res.json())
      .then((data: {
        ok?: boolean;
        error?: string;
        deliveredFolderUrl?: string;
        deliverySummary?: { excluded?: Array<{ fileId: string; reason?: string }> };
      }) => {
        if (data.ok === true) {
          setDeliverApprovedState('success');
          setDeliverApprovedOpen(false);
          const excluded = data.deliverySummary?.excluded ?? [];
          const excludedMsg =
            excluded.length > 0
              ? ` ${excluded.length} excluded (no longer approved or already exported).`
              : '';
          setToast({
            message: `Exported ${deliverableCount - excluded.length} assets.${excludedMsg}`,
            type: 'success',
            link: data.deliveredFolderUrl,
          });
          doRefresh();
        } else {
          setDeliverApprovedState('error');
          setToast({
            message: data.error ?? 'Export failed',
            type: 'error',
          });
        }
      })
      .catch((err) => {
        setDeliverApprovedState('error');
        setToast({
          message: err?.message ?? 'Export failed',
          type: 'error',
        });
      });
  }, [token, selectedBatchId, deliveryContext, deliveryBatches, deliverableFileIds, deliverableCount, doRefresh]);

  const openDeliverConfirm = useCallback(() => {
    setDeliverApprovedState('idle');
    setDeliverApprovedOpen(true);
  }, []);

  return (
    <main className="min-h-screen bg-[#111827] text-gray-100">
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
        {/* Header: logo inline with title, identity display */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <HiveLogo className="h-6 w-auto shrink-0 opacity-90" />
            <h1 className="text-xl font-bold text-white sm:text-2xl">
              {projectName} &ndash; Creative Review
            </h1>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            {deliveryBatches.length > 0 && (
              <>
                {(partnerTabCounts.new > 0 || deliveryContext) && (
                  <button
                    type="button"
                    onClick={handleMarkSeen}
                    disabled={markingSeen || isRefreshing}
                    className="rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm font-medium text-gray-200 hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {markingSeen ? 'Updating…' : 'Mark all as seen'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={openDeliverConfirm}
                  disabled={deliverableCount === 0 || deliverApprovedState === 'running'}
                  className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-400 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deliverableCount === 0
                    ? 'No Approved Assets'
                    : deliverApprovedState === 'running'
                      ? 'Exporting…'
                      : `Export Approved (${deliverableCount})`}
                </button>
              </>
            )}
            {(isRefreshing || lastRefreshedAt || refreshError) && (
              <p className="text-xs text-gray-500">
                {isRefreshing
                  ? 'Refreshing assets…'
                  : refreshError
                    ? `Asset refresh failed (${refreshError})`
                    : lastRefreshedAt
                      ? `Last refreshed: ${new Date(lastRefreshedAt).toLocaleTimeString()}`
                      : null}
              </p>
            )}
            {identity && (
            <div className="flex items-center gap-3 rounded-lg bg-gray-800/50 px-3 py-2">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-200">{identity.name}</p>
                <p className="text-xs text-gray-500">{identity.email}</p>
              </div>
              <button
                onClick={clearIdentity}
                className="rounded p-1 text-gray-500 hover:bg-gray-700 hover:text-gray-300"
                title="Change identity"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            </div>
            )}
          </div>
        </div>

        {/* Batch selector when multiple batches (default = selectedBatchId from API) */}
        {deliveryBatches.length > 1 && (
          <div className="mb-4 flex items-center gap-2">
            <label htmlFor="review-batch-select" className="text-sm font-medium text-gray-300">
              Batch
            </label>
            <select
              id="review-batch-select"
              value={selectedBatchId ?? ''}
              onChange={(e) => {
                const next = e.target.value || null;
                setSelectedBatchId(next);
                doRefresh(next ?? undefined);
              }}
              disabled={isRefreshing}
              className="rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-50"
            >
              {deliveryBatches.map((b) => (
                <option key={b.batchId} value={b.batchId}>
                  {b.batchId} {b.status ? `(${b.status})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Partner view tabs: New, All Approved, Downloaded (when any batch exists) */}
        {deliveryBatches.length > 0 && (
          <div className="mb-4 flex gap-2 border-b border-gray-700">
            {(
              [
                { id: 'new' as const, label: 'New', count: partnerTabCounts.new },
                { id: 'all_approved' as const, label: 'All Approved', count: partnerTabCounts.allApproved },
                { id: 'downloaded' as const, label: 'Downloaded', count: partnerTabCounts.downloaded },
              ] as const
            ).map(({ id, label, count }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActivePartnerTab(id)}
                className={`relative px-3 py-2 text-sm font-medium transition-colors ${
                  activePartnerTab === id ? 'text-amber-400' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {label}
                <span className="ml-2 text-xs text-gray-500">({count})</span>
                {activePartnerTab === id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400" />
                )}
              </button>
            ))}
          </div>
        )}

        {/* Variant Tabs: variant name + total assets only */}
        <div className="mb-6 flex gap-2 border-b border-gray-700">
          {variants.map((variant) => {
            const isActive = variant === activeVariant;
            const variantSections = sections.filter((s) => s.variant === variant);
            const totalAssets = variantSections.reduce((sum, s) => sum + s.fileCount, 0);

            return (
              <button
                key={variant}
                onClick={() => setActiveVariant(variant)}
                className={`relative px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-amber-400'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {variant}
                <span className="ml-2 text-xs text-gray-500">
                  ({totalAssets} assets)
                </span>
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400" />
                )}
              </button>
            );
          })}
        </div>

        {/* Action bar when 1+ selected */}
        {selectedCount > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3">
            <button
              type="button"
              onClick={handleApproveSelected}
              disabled={bulkApproving || isRefreshing}
              className="rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {bulkApproving ? 'Approving…' : `Approve selected (${selectedCount})`}
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700"
            >
              Clear
            </button>
          </div>
        )}

        {/* Content: empty-state card or tactic sections */}
        {totalFiles === 0 ? (
          <EmptyStateCard
            variant={activeVariant}
            token={token}
            initialComments={
              reviewData[`${activeVariant}:General`]?.comments ?? ''
            }
          />
        ) : (
          <>
            {sectionsToRender.map((section) => {
              const feedbackKey = `${section.variant}:${section.tactic}`;
              return (
                <ReviewSection
                  key={feedbackKey}
                  variant={section.variant}
                  tactic={section.tactic}
                  assets={section.assets}
                  fileCount={section.fileCount}
                  token={token}
                  initialFeedback={
                    reviewData[feedbackKey] ?? { approved: false, comments: '' }
                  }
                  onAssetStatusChange={updateAssetReviewState}
                  groupApprovalApprovedAt={section.groupApprovalApprovedAt}
                  groupApprovalApprovedByName={section.groupApprovalApprovedByName}
                  newSinceApprovalCount={section.newSinceApprovalCount}
                  onGroupApproved={updateGroupApproval}
                  selectedFileIds={selectedFileIds}
                  onToggleSelect={toggleSelection}
                  onSelectAllUnapprovedInSection={selectAllUnapprovedInSection}
                  onSelectNewInSection={selectNewInSection}
                  onSingleAssetApprovedResult={handleSingleAssetApprovedResult}
                  deliveryBatchId={deliveryContext?.deliveryBatchId}
                  onPartnerDownload={deliveryContext ? handleMarkDownloaded : undefined}
                  onDownloadAsset={deliveryContext ? handleDownloadAsset : undefined}
                />
              );
            })}

            {/* Show empty tactics toggle */}
            {partnerFilteredSections.some((s) => s.fileCount === 0) && (
              <button
                type="button"
                onClick={() => setShowEmptyTactics(!showEmptyTactics)}
                className="mt-4 text-sm text-amber-400 hover:text-amber-300 hover:underline"
              >
                {showEmptyTactics ? 'Hide empty tactics' : 'Show empty tactics'}
              </button>
            )}
          </>
        )}

        {/* Toast (global so it shows for bulk approve / deliver from any view) */}
        {toast && (
          <div
            className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-3 shadow-lg ${
              toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
            }`}
            role="alert"
          >
            <p className="text-sm font-medium">{toast.message}</p>
            {toast.link && (
              <a
                href={toast.link}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block text-xs underline opacity-90 hover:opacity-100"
              >
                Open exported folder
              </a>
            )}
          </div>
        )}

        {/* Export Approved confirm modal */}
        {deliverApprovedOpen && deliveryContext && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-md rounded-lg border border-gray-700 bg-gray-800 p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-white">Export to vendor folder</h3>
              <p className="mt-2 text-sm text-gray-300">
                Export {deliverableCount} approved asset{deliverableCount !== 1 ? 's' : ''} to{' '}
                {deliveryContext.vendorName || 'Partner'}&apos;s folder?
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeliverApprovedOpen(false)}
                  disabled={deliverApprovedState === 'running'}
                  className="rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-sm font-medium text-gray-200 hover:bg-gray-600 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeliverApproved}
                  disabled={deliverApprovedState === 'running'}
                  className="rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
                >
                  {deliverApprovedState === 'running' ? 'Exporting…' : 'Export'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
