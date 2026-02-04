'use client';

// ReviewPortalClient.tsx
// Client component: renders tabbed variant sections (Prospecting/Retargeting)
// with per-tactic approval UI. Wrapped in AuthorIdentityProvider for identity capture.
//
// Empty-state UX:
// - If variant has 0 total files: single empty-state card, no per-tactic list
// - If variant has files: show tactics with files; hide empty tactics behind toggle

import { useCallback, useEffect, useRef, useState } from 'react';
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
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
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

  const doRefresh = useCallback(() => {
    setRefreshError(null);
    setIsRefreshing(true);
    const url = `/api/review/assets?token=${encodeURIComponent(token)}`;
    fetch(url, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
      .then((data: { ok?: boolean; version?: string; sections?: TacticSectionData[]; lastFetchedAt?: string }) => {
        if (data.ok === true && data.version === 'review-assets-v1' && Array.isArray(data.sections)) {
          setSections(data.sections);
          setRefreshError(null);
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
  }, [token]);

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

  // Filter sections by active variant (declared before callbacks that use them)
  const activeSections = sections.filter((s) => s.variant === activeVariant);
  const totalFiles = activeSections.reduce((sum, s) => sum + s.fileCount, 0);
  const sectionsToRender =
    totalFiles === 0
      ? []
      : showEmptyTactics
        ? activeSections
        : activeSections.filter((s) => s.fileCount > 0);
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

  const handleApproveSelected = useCallback(() => {
    const fileIds = Array.from(selectedFileIds);
    if (fileIds.length === 0) return;
    setBulkApproving(true);
    setToast(null);
    fetch('/api/review/assets/bulk-approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ token, fileIds }),
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
  }, [token, selectedFileIds, doRefresh]);

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
                />
              );
            })}

            {/* Show empty tactics toggle */}
            {activeSections.some((s) => s.fileCount === 0) && (
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

        {/* Toast (global so it shows for bulk approve from any view) */}
        {toast && (
          <div
            className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-3 shadow-lg ${
              toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
            }`}
            role="alert"
          >
            <p className="text-sm font-medium">{toast.message}</p>
          </div>
        )}
      </div>
    </main>
  );
}
