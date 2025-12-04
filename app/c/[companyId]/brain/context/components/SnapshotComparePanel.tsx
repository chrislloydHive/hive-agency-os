'use client';

// app/c/[companyId]/context/components/SnapshotComparePanel.tsx
// Version Comparison Panel Component
//
// Allows comparing any two versions:
// - Dropdown selectors for both versions
// - Side-by-side diff view
// - Field-level change highlighting

import { useState, useMemo } from 'react';
import type { ContextGraphVersion } from '@/lib/contextGraph/history';
import type { GraphDiffItem } from '@/lib/contextGraph/uiHelpers';

// ============================================================================
// Types
// ============================================================================

interface VersionComparePanelProps {
  versions: ContextGraphVersion[];
  currentDiff: GraphDiffItem[];
  companyId: string;
}

// Legacy alias
type SnapshotComparePanelProps = VersionComparePanelProps;

// ============================================================================
// Utility Functions
// ============================================================================

function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return `${diffDays}d ago`;
  } catch {
    return dateStr;
  }
}

// ============================================================================
// Main Component
// ============================================================================

export function SnapshotComparePanel({
  versions,
  currentDiff,
  companyId,
}: VersionComparePanelProps) {
  const [leftVersionId, setLeftVersionId] = useState<string | null>(
    versions.length >= 2 ? versions[1].versionId : null
  );
  const [rightVersionId, setRightVersionId] = useState<string | null>(
    versions.length >= 1 ? versions[0].versionId : null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [customDiff, setCustomDiff] = useState<GraphDiffItem[] | null>(null);

  const leftVersion = versions.find(v => v.versionId === leftVersionId);
  const rightVersion = versions.find(v => v.versionId === rightVersionId);

  // Use current diff if comparing latest vs previous, otherwise use custom diff
  const isDefaultComparison =
    versions.length >= 2 &&
    leftVersionId === versions[1].versionId &&
    rightVersionId === versions[0].versionId;

  const displayDiff = isDefaultComparison ? currentDiff : (customDiff ?? []);

  // Group diff by domain
  const diffByDomain = useMemo(() => {
    const grouped = new Map<string, GraphDiffItem[]>();
    displayDiff.forEach(d => {
      const arr = grouped.get(d.domain) ?? [];
      arr.push(d);
      grouped.set(d.domain, arr);
    });
    return grouped;
  }, [displayDiff]);

  // Fetch custom diff when selection changes (non-default comparison)
  const handleCompare = async () => {
    if (!leftVersionId || !rightVersionId || isDefaultComparison) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/context-diff?left=${leftVersionId}&right=${rightVersionId}`
      );
      if (response.ok) {
        const data = await response.json();
        setCustomDiff(data.diff ?? []);
      }
    } catch (error) {
      console.error('Failed to fetch diff:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (versions.length < 2) {
    return (
      <div className="rounded-lg border border-dashed border-slate-800 bg-slate-950/60 p-6 text-center">
        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-3">
          <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        </div>
        <p className="text-sm text-slate-400">Need at least 2 versions to compare</p>
        <p className="text-xs text-slate-500 mt-1">Run diagnostics to create more versions.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Version Selectors */}
      <div className="flex items-center gap-3">
        {/* Left Version (Before) */}
        <div className="flex-1">
          <label className="text-[10px] uppercase tracking-wide text-slate-500 mb-1 block">
            Before
          </label>
          <select
            value={leftVersionId ?? ''}
            onChange={(e) => {
              setLeftVersionId(e.target.value);
              setCustomDiff(null);
            }}
            className="w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-400/60"
          >
            {versions.map((ver) => (
              <option key={ver.versionId} value={ver.versionId}>
                {formatDate(ver.versionAt)} – {ver.changeReason.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>

        {/* Arrow */}
        <div className="pt-5">
          <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </div>

        {/* Right Version (After) */}
        <div className="flex-1">
          <label className="text-[10px] uppercase tracking-wide text-slate-500 mb-1 block">
            After
          </label>
          <select
            value={rightVersionId ?? ''}
            onChange={(e) => {
              setRightVersionId(e.target.value);
              setCustomDiff(null);
            }}
            className="w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-400/60"
          >
            {versions.map((ver) => (
              <option key={ver.versionId} value={ver.versionId}>
                {formatDate(ver.versionAt)} – {ver.changeReason.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Compare Button (for non-default comparisons) */}
      {!isDefaultComparison && (
        <button
          onClick={handleCompare}
          disabled={isLoading || !leftVersionId || !rightVersionId}
          className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 transition-colors disabled:opacity-50"
        >
          {isLoading ? 'Loading...' : 'Compare Versions'}
        </button>
      )}

      {/* Comparison Summary */}
      {leftVersion && rightVersion && (
        <div className="flex items-center justify-between text-[11px] text-slate-500 bg-slate-950/60 rounded-lg px-3 py-2">
          <span>
            {formatRelativeTime(leftVersion.versionAt)} → {formatRelativeTime(rightVersion.versionAt)}
          </span>
          <span>
            {displayDiff.length} change{displayDiff.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Diff Display */}
      {displayDiff.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-800 bg-slate-950/60 p-6 text-center">
          <p className="text-sm text-slate-400">No changes between these versions</p>
        </div>
      ) : (
        <div className="space-y-4 max-h-[400px] overflow-y-auto">
          {Array.from(diffByDomain.entries()).map(([domain, diffs]) => (
            <div key={domain}>
              <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-2 capitalize">
                {domain.replace(/([A-Z])/g, ' $1').trim()}
                <span className="ml-2 text-slate-600">({diffs.length})</span>
              </div>
              <div className="space-y-2">
                {diffs.map((d) => (
                  <DiffRow key={d.path} diff={d} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Diff Row Component
// ============================================================================

function DiffRow({ diff }: { diff: GraphDiffItem }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const beforeTruncated = diff.before && diff.before.length > 100;
  const afterTruncated = diff.after && diff.after.length > 100;
  const needsExpand = beforeTruncated || afterTruncated;

  const displayBefore = !isExpanded && beforeTruncated
    ? diff.before!.slice(0, 100) + '...'
    : diff.before;
  const displayAfter = !isExpanded && afterTruncated
    ? diff.after!.slice(0, 100) + '...'
    : diff.after;

  return (
    <div className="rounded-md border border-slate-800 bg-slate-900/50 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-medium text-slate-200">{diff.label}</div>
        {needsExpand && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-[10px] text-slate-500 hover:text-slate-300"
          >
            {isExpanded ? 'Collapse' : 'Expand'}
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-[10px] text-red-400/60 uppercase tracking-wide mb-1">- Before</div>
          <div className="rounded bg-red-950/30 border border-red-900/30 px-2 py-1.5 text-[11px] text-red-300 min-h-[28px] break-words">
            {displayBefore ?? <span className="italic text-slate-600">Empty</span>}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-emerald-400/60 uppercase tracking-wide mb-1">+ After</div>
          <div className="rounded bg-emerald-950/30 border border-emerald-900/30 px-2 py-1.5 text-[11px] text-emerald-300 min-h-[28px] break-words">
            {displayAfter ?? <span className="italic text-slate-600">Empty</span>}
          </div>
        </div>
      </div>
      <div className="mt-2 text-[9px] text-slate-600 font-mono break-all">{diff.path}</div>
    </div>
  );
}

export default SnapshotComparePanel;
