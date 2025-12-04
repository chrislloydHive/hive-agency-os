'use client';

// components/media/dashboard/MediaNextAndLastBar.tsx
// Next/Last Work Strip for Media Dashboard
//
// Shows:
// - "Last thing we did" - most recent completed media work item
// - "Next recommended step" - highest priority insight/recommendation

import Link from 'next/link';
import type {
  MediaNextLast,
  MediaLastWorkItem,
  MediaNextRecommendation,
} from '@/lib/media/nextLast';
import { ACTION_TYPE_LABELS, PRIORITY_LABELS } from '@/lib/media/nextLast';

// ============================================================================
// Types
// ============================================================================

interface MediaNextAndLastBarProps {
  companyId: string;
  data: MediaNextLast;
  onCreateWorkItem?: (recommendation: MediaNextRecommendation) => void;
}

// ============================================================================
// Icons
// ============================================================================

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
    </svg>
  );
}

function LightBulbIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return '1 week ago';
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}

// ============================================================================
// Subcomponents
// ============================================================================

function LastWorkItemCard({ item }: { item: MediaLastWorkItem }) {
  return (
    <div className="flex-1 p-4 rounded-xl border border-slate-700/50 bg-slate-800/30">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-emerald-500/10">
          <CheckCircleIcon className="w-5 h-5 text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
              Last completed
            </span>
            <span className="text-[10px] text-slate-600">
              {formatTimeAgo(item.completedAt)}
            </span>
          </div>
          <p className="text-sm font-medium text-slate-200 truncate">
            {item.title}
          </p>
          {item.area && (
            <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-medium rounded bg-slate-700/50 text-slate-400">
              {item.area}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyLastCard() {
  return (
    <div className="flex-1 p-4 rounded-xl border border-slate-700/50 bg-slate-800/30">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-slate-700/50">
          <ClockIcon className="w-5 h-5 text-slate-500" />
        </div>
        <div className="flex-1">
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Last completed
          </span>
          <p className="text-sm text-slate-400 mt-1">
            No recent media work items
          </p>
        </div>
      </div>
    </div>
  );
}

function NextRecommendationCard({
  recommendation,
  companyId,
  onCreateWorkItem,
}: {
  recommendation: MediaNextRecommendation;
  companyId: string;
  onCreateWorkItem?: (rec: MediaNextRecommendation) => void;
}) {
  const priorityConfig = PRIORITY_LABELS[recommendation.priority];
  const actionConfig = ACTION_TYPE_LABELS[recommendation.actionType];

  return (
    <div className="flex-1 p-4 rounded-xl border border-slate-700/50 bg-slate-800/30">
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${priorityConfig.bgColor}`}>
          <LightBulbIcon className={`w-5 h-5 ${priorityConfig.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
              Next step
            </span>
            <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${priorityConfig.bgColor} ${priorityConfig.color}`}>
              {priorityConfig.label}
            </span>
          </div>
          <p className="text-sm font-medium text-slate-200 truncate">
            {recommendation.title}
          </p>
          <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
            {recommendation.description}
          </p>
        </div>
        {onCreateWorkItem && (
          <button
            onClick={() => onCreateWorkItem(recommendation)}
            className="shrink-0 p-2 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors"
            title="Create work item"
          >
            <PlusIcon className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyNextCard({ companyId }: { companyId: string }) {
  return (
    <div className="flex-1 p-4 rounded-xl border border-slate-700/50 bg-slate-800/30">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-emerald-500/10">
          <CheckCircleIcon className="w-5 h-5 text-emerald-400" />
        </div>
        <div className="flex-1">
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Next step
          </span>
          <p className="text-sm text-emerald-400 font-medium mt-1">
            All clear!
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            No urgent actions needed
          </p>
        </div>
        <Link
          href={`/c/${companyId}/diagnostics/media`}
          className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-700 transition-colors"
        >
          Run AI Analysis
        </Link>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function MediaNextAndLastBar({
  companyId,
  data,
  onCreateWorkItem,
}: MediaNextAndLastBarProps) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
      <div className="flex items-center gap-2 mb-4">
        <ArrowRightIcon className="w-4 h-4 text-amber-400" />
        <h3 className="text-sm font-semibold text-slate-200">Your Focus</h3>
      </div>

      <div className="flex gap-4">
        {/* Last Work Item */}
        {data.lastWorkItem ? (
          <LastWorkItemCard item={data.lastWorkItem} />
        ) : (
          <EmptyLastCard />
        )}

        {/* Next Recommendation */}
        {data.nextRecommended ? (
          <NextRecommendationCard
            recommendation={data.nextRecommended}
            companyId={companyId}
            onCreateWorkItem={onCreateWorkItem}
          />
        ) : (
          <EmptyNextCard companyId={companyId} />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Compact Variant
// ============================================================================

export function MediaNextAndLastBarCompact({
  companyId,
  data,
  onCreateWorkItem,
}: MediaNextAndLastBarProps) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-lg border border-slate-800 bg-slate-900/50">
      {/* Last */}
      <div className="flex items-center gap-2 text-xs">
        <CheckCircleIcon className="w-4 h-4 text-emerald-400 shrink-0" />
        <span className="text-slate-500">Last:</span>
        <span className="text-slate-300 truncate max-w-[150px]">
          {data.lastWorkItem?.title || 'None'}
        </span>
      </div>

      <div className="w-px h-4 bg-slate-700" />

      {/* Next */}
      <div className="flex items-center gap-2 text-xs flex-1">
        <LightBulbIcon className="w-4 h-4 text-amber-400 shrink-0" />
        <span className="text-slate-500">Next:</span>
        <span className="text-slate-300 truncate">
          {data.nextRecommended?.title || 'All clear'}
        </span>
      </div>

      {data.nextRecommended && onCreateWorkItem && (
        <button
          onClick={() => onCreateWorkItem(data.nextRecommended!)}
          className="shrink-0 px-2 py-1 text-xs font-medium rounded bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors"
        >
          + Work
        </button>
      )}
    </div>
  );
}

export default MediaNextAndLastBar;
