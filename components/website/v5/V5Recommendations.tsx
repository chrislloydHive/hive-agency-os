'use client';
// components/website/v5/V5Recommendations.tsx
// V5 Recommendations - Quick Wins (checklist) and Structural Changes (program cards)

import type { V5QuickWin, V5StructuralChange } from '@/lib/types/websiteLabV5';

type Props = {
  quickWins: V5QuickWin[];
  structuralChanges: V5StructuralChange[];
};

function QuickWinRow({ win, index }: { win: V5QuickWin; index: number }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-700/50 last:border-b-0">
      {/* Checkbox placeholder */}
      <div className="mt-0.5 w-5 h-5 rounded border border-slate-600 flex items-center justify-center shrink-0">
        <span className="text-xs text-slate-500">{index + 1}</span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-medium text-slate-200">
            {win.title}
          </h4>
          <code className="text-xs font-mono text-slate-400 bg-slate-700/50 px-1.5 py-0.5 rounded shrink-0">
            {win.page}
          </code>
        </div>
        <p className="text-sm text-slate-400 mt-1">
          {win.action}
        </p>
        {win.expectedImpact && (
          <p className="text-xs text-emerald-400 mt-1">
            Impact: {win.expectedImpact}
          </p>
        )}
      </div>
    </div>
  );
}

function StructuralChangeCard({ change }: { change: V5StructuralChange }) {
  return (
    <div className="border border-indigo-500/30 rounded-lg bg-indigo-500/5 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-indigo-500/20 flex items-center gap-2">
        <span className="px-2 py-0.5 rounded text-xs font-medium bg-indigo-500/20 text-indigo-300">
          Program-level change
        </span>
        <h4 className="text-sm font-medium text-slate-200">
          {change.title}
        </h4>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        <p className="text-sm text-slate-300">
          {change.description}
        </p>

        {/* Pages Affected */}
        {change.pagesAffected?.length > 0 && (
          <div>
            <span className="text-xs text-slate-500 mr-2">Pages affected:</span>
            <div className="inline-flex flex-wrap gap-1 mt-1">
              {change.pagesAffected.map((page, i) => (
                <code key={i} className="text-xs font-mono text-slate-300 bg-slate-700/50 px-1.5 py-0.5 rounded">
                  {page}
                </code>
              ))}
            </div>
          </div>
        )}

        {/* Rationale */}
        {change.rationale && (
          <div className="pt-2 border-t border-slate-700/50">
            <span className="text-xs text-slate-500">Rationale: </span>
            <span className="text-xs text-slate-400">{change.rationale}</span>
          </div>
        )}

        {/* Issues addressed */}
        {change.addressesIssueIds?.length > 0 && (
          <div className="text-xs text-slate-500">
            Addresses issues: {change.addressesIssueIds.map(id => `#${id}`).join(', ')}
          </div>
        )}
      </div>
    </div>
  );
}

export function V5Recommendations({ quickWins, structuralChanges }: Props) {
  const hasQuickWins = quickWins && quickWins.length > 0;
  const hasStructuralChanges = structuralChanges && structuralChanges.length > 0;

  if (!hasQuickWins && !hasStructuralChanges) {
    return (
      <div className="border border-slate-700 rounded-lg bg-slate-800/30 p-6 text-center">
        <p className="text-slate-400">No recommendations available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Wins Section */}
      {hasQuickWins && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-100">
              Quick Wins
            </h3>
            <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded">
              {quickWins.length} actions
            </span>
          </div>

          <div className="border border-slate-700 rounded-lg bg-slate-800/50 px-4">
            {quickWins.map((win, i) => (
              <QuickWinRow key={win.addressesIssueId || i} win={win} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* Structural Changes Section */}
      {hasStructuralChanges && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-100">
              Structural Changes
            </h3>
            <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded">
              {structuralChanges.length} programs
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {structuralChanges.map((change, i) => (
              <StructuralChangeCard key={i} change={change} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
