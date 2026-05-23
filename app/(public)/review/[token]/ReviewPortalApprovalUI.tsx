'use client';

import type { VariantApprovalStats } from './reviewAssetUtils';

/** Hero banner when assets are waiting on client review. */
export function PendingReviewBanner({
  totalPending,
  typeBreakdown,
  onReviewPending,
}: {
  totalPending: number;
  typeBreakdown: string;
  onReviewPending: () => void;
}) {
  if (totalPending <= 0) return null;

  return (
    <div
      className="mb-6 flex flex-col gap-4 rounded-xl border border-amber-500 bg-[#2a1f0a] p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
      role="status"
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 shrink-0 text-amber-500" aria-hidden>
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-base font-semibold text-amber-50">
            {totalPending} assets are waiting on your review
          </p>
          {typeBreakdown ? (
            <p className="mt-0.5 text-sm text-amber-200/80">Across {typeBreakdown}</p>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        onClick={onReviewPending}
        className="shrink-0 rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-[#2a1f0a] transition-colors hover:bg-amber-400"
      >
        Review pending →
      </button>
    </div>
  );
}

/** Two-segment progress: approved (green) + pending (amber). */
export function CampaignTypeApprovalProgress({
  approved,
  total,
  pending,
}: {
  approved: number;
  total: number;
  pending: number;
}) {
  const approvedPct = total > 0 ? (approved / total) * 100 : 0;
  const pendingPct = total > 0 ? (pending / total) * 100 : 0;
  const allApproved = total > 0 && pending === 0;

  return (
    <div className="mt-2 w-full min-w-[10rem]">
      <div
        className="flex h-1.5 w-full overflow-hidden rounded-[3px] bg-[#1f2742]"
        role="progressbar"
        aria-valuenow={approved}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`${approved} of ${total} approved`}
      >
        {approved > 0 && (
          <div className="h-full bg-green-500 transition-[width] duration-300" style={{ width: `${approvedPct}%` }} />
        )}
        {pending > 0 && (
          <div className="h-full bg-amber-500 transition-[width] duration-300" style={{ width: `${pendingPct}%` }} />
        )}
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2 text-xs">
        <span className="text-gray-500">
          {approved} of {total} approved
        </span>
        {allApproved ? (
          <span className="inline-flex items-center gap-1 font-medium text-green-400">
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            All approved
          </span>
        ) : pending > 0 ? (
          <span className="font-medium text-amber-400">{pending} pending</span>
        ) : null}
      </div>
    </div>
  );
}

export type AssetListFilter = 'pending' | 'all';

/** Filter bar at top of cross-type review queue. */
export function ReviewQueueFilterBar({
  filter,
  pendingCount,
  totalCount,
  onSetFilter,
}: {
  filter: AssetListFilter;
  pendingCount: number;
  totalCount: number;
  onSetFilter: (filter: AssetListFilter) => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-700 bg-gray-800/50 px-3 py-2.5 text-sm">
      <div className="flex items-center gap-2 text-gray-300">
        <svg className="h-4 w-4 shrink-0 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
          />
        </svg>
        {filter === 'pending' ? (
          <span>
            Showing <span className="font-medium text-amber-400">{pendingCount} pending</span>
          </span>
        ) : (
          <span>
            Showing all <span className="font-medium text-gray-100">{totalCount}</span> assets
          </span>
        )}
      </div>
      {filter === 'pending' ? (
        <button
          type="button"
          onClick={() => onSetFilter('all')}
          className="text-sm font-medium text-amber-400 hover:text-amber-300 hover:underline"
        >
          Show all ({totalCount})
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onSetFilter('pending')}
          className="text-sm font-medium text-amber-400 hover:text-amber-300 hover:underline"
        >
          Show pending only
        </button>
      )}
    </div>
  );
}

/** Campaign type chips when browsing the cross-type review queue. */
export function CampaignTypeFilterChips({
  byVariant,
  activeVariant,
  onSelectVariant,
}: {
  byVariant: VariantApprovalStats[];
  activeVariant: string | null;
  onSelectVariant: (variant: string | null) => void;
}) {
  const totalPending = byVariant.reduce((sum, v) => sum + v.pending, 0);

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <span className="mr-1 text-xs font-medium uppercase tracking-wider text-gray-500">Campaign type</span>
      <button
        type="button"
        onClick={() => onSelectVariant(null)}
        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
          activeVariant === null
            ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/50'
            : 'bg-gray-800 text-gray-400 ring-1 ring-gray-700 hover:bg-gray-700 hover:text-gray-200'
        }`}
      >
        All
        {totalPending > 0 ? (
          <span className="ml-1.5 text-amber-400">({totalPending})</span>
        ) : null}
      </button>
      {byVariant.map(({ variant, pending, total }) => {
        if (total === 0) return null;
        const isActive = activeVariant === variant;
        return (
          <button
            key={variant}
            type="button"
            onClick={() => onSelectVariant(variant)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              isActive
                ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/50'
                : 'bg-gray-800 text-gray-400 ring-1 ring-gray-700 hover:bg-gray-700 hover:text-gray-200'
            }`}
          >
            {variant}
            {pending > 0 ? <span className="ml-1.5 text-amber-400">({pending})</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/** Empty state when the pending queue is cleared. */
export function AllCaughtUpEmptyState({
  totalApproved,
  totalCount,
  onViewAll,
}: {
  totalApproved: number;
  totalCount: number;
  onViewAll: () => void;
}) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800/50 px-8 py-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center text-green-500" aria-hidden>
        <svg className="h-12 w-12" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      </div>
      <h2 className="mt-4 text-xl font-semibold text-white">All caught up</h2>
      <p className="mt-2 text-sm text-gray-400">
        {totalApproved} of {totalCount} assets approved
      </p>
      <button
        type="button"
        onClick={onViewAll}
        className="mt-6 text-sm font-medium text-amber-400 hover:text-amber-300 hover:underline"
      >
        View all assets →
      </button>
    </div>
  );
}
