'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PriorityItem } from '@/lib/airtable/fullReports';
import type { WorkItemArea, WorkItemSeverity } from '@/lib/airtable/workItems';
import type { EvidenceInsight } from '@/lib/gap/types';

interface PriorityCardWithActionProps {
  priority: PriorityItem;
  companyId: string;
  fullReportId: string;
  hasWorkItem: boolean;
  evidenceInsight?: EvidenceInsight;
}

export default function PriorityCardWithAction({
  priority,
  companyId,
  fullReportId,
  hasWorkItem,
  evidenceInsight,
}: PriorityCardWithActionProps) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Extract display values with proper type handling
  const displayArea = priority.area || (typeof priority.pillar === 'string' ? priority.pillar : undefined);
  const displaySeverity = priority.severity;
  const displayDescription = priority.summary || priority.description || priority.rationale;

  const handleCreateWorkItem = async () => {
    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch('/api/work-items/from-priority', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyId,
          fullReportId,
          priority,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create work item');
      }

      console.log('[PriorityCard] Work item created:', data.workItem);

      // Refresh the page to show the new work item
      router.refresh();
    } catch (err) {
      console.error('[PriorityCard] Error creating work item:', err);
      setError(err instanceof Error ? err.message : 'Failed to create work item');
      setIsCreating(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-800/50 px-3 py-2.5">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <h4 className="font-medium text-slate-200 text-sm flex-1">
          {priority.title || 'Untitled Priority'}
        </h4>
        {displaySeverity && <SeverityPill severity={displaySeverity} />}
      </div>

      {displayDescription && (
        <p className="text-xs text-slate-400 mb-2 line-clamp-2">
          {displayDescription}
        </p>
      )}

      <div className="flex items-center gap-2 flex-wrap mb-2">
        {displayArea && <AreaPill area={displayArea as WorkItemArea} variant="subtle" />}
        {priority.impact && (
          <span className="text-[10px] text-slate-500">
            Impact: {String(priority.impact)}
          </span>
        )}
        {priority.effort && (
          <span className="text-[10px] text-slate-500">
            Effort: {String(priority.effort)}
          </span>
        )}
      </div>

      {/* Evidence annotation */}
      {evidenceInsight && (
        <div className="mb-2 rounded bg-slate-900/50 px-2 py-1.5 border-l-2 border-blue-500/50">
          <p className="text-[10px] text-slate-400 leading-relaxed">
            <span className="font-medium text-slate-300">Evidence:</span>{' '}
            {evidenceInsight.headline || evidenceInsight.title || 'Data-backed insight'}
            {evidenceInsight.source && (
              <span className="text-slate-500"> ({evidenceInsight.source.toUpperCase()})</span>
            )}
          </p>
        </div>
      )}

      {/* Action area */}
      {hasWorkItem ? (
        <div className="flex items-center gap-1.5 pt-2 border-t border-slate-700/50">
          <svg
            className="h-3.5 w-3.5 text-emerald-400"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-[10px] text-emerald-400 font-medium">
            Linked to Work
          </span>
        </div>
      ) : (
        <div className="pt-2 border-t border-slate-700/50">
          <button
            onClick={handleCreateWorkItem}
            disabled={isCreating}
            className="w-full rounded-md bg-slate-700 hover:bg-slate-600 text-slate-100 text-xs font-medium px-2.5 py-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? 'Creating...' : 'Create Work Item'}
          </button>

          {error && (
            <p className="text-[10px] text-red-400 mt-1">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Severity Pill Component
 */
function SeverityPill({ severity }: { severity: string }) {
  const normalized = String(severity).toLowerCase();

  const classes =
    normalized === 'critical'
      ? 'bg-red-500/20 text-red-300 border-red-500/50'
      : normalized === 'high'
      ? 'bg-orange-500/20 text-orange-300 border-orange-500/50'
      : normalized === 'medium'
      ? 'bg-amber-500/20 text-amber-200 border-amber-500/40'
      : normalized === 'low'
      ? 'bg-sky-500/20 text-sky-200 border-sky-500/40'
      : normalized === 'info'
      ? 'bg-blue-500/20 text-blue-200 border-blue-500/40'
      : 'bg-slate-700/50 text-slate-200 border-slate-600';

  const label = String(severity).charAt(0).toUpperCase() + String(severity).slice(1);

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${classes}`}
    >
      {label}
    </span>
  );
}

/**
 * Area Pill Component
 */
function AreaPill({ area, variant = 'default' }: { area: string; variant?: 'default' | 'subtle' }) {
  const baseClasses = variant === 'subtle'
    ? 'bg-slate-700/30 text-slate-300 border-slate-600/30'
    : 'bg-slate-700/50 text-slate-200 border-slate-600';

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${baseClasses}`}
    >
      {area}
    </span>
  );
}
