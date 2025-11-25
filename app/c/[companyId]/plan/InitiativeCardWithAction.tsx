'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PlanInitiative, PriorityArea } from '@/lib/gap/types';
import type { WorkItemStatus } from '@/lib/airtable/workItems';

interface InitiativeCardWithActionProps {
  initiative: PlanInitiative;
  companyId: string;
  fullReportId: string;
  hasWorkItem: boolean;
  workItemStatus?: WorkItemStatus;
  prioritiesJson?: any;
}

export default function InitiativeCardWithAction({
  initiative,
  companyId,
  fullReportId,
  hasWorkItem,
  workItemStatus,
  prioritiesJson,
}: InitiativeCardWithActionProps) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Find matching priority if priorityId is set
  const matchingPriority = initiative.priorityId
    ? prioritiesJson?.items?.find((p: any) => p.id === initiative.priorityId)
    : undefined;

  const handleCreateWorkItem = async () => {
    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch('/api/work-items/from-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyId,
          fullReportId,
          initiative,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create work item');
      }

      console.log('[InitiativeCard] Work item created:', data.workItem);

      // Refresh the page to show the new work item
      router.refresh();
    } catch (err) {
      console.error('[InitiativeCard] Error creating work item:', err);
      setError(err instanceof Error ? err.message : 'Failed to create work item');
      setIsCreating(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-700/50 bg-[#050509]/50 px-3 py-2.5">
      {/* Title and area */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <h4 className="font-medium text-slate-200 text-sm flex-1">{initiative.title}</h4>
        {initiative.area && <AreaPill area={initiative.area} />}
      </div>

      {/* Summary/description */}
      {(initiative.summary || initiative.detail) && (
        <p className="text-xs text-slate-400 mb-2 line-clamp-2">
          {initiative.summary || initiative.detail}
        </p>
      )}

      {/* Metadata row */}
      <div className="flex items-center gap-3 flex-wrap mb-2">
        {initiative.impact && (
          <span className="text-[10px] text-slate-500">
            <span className="text-slate-400 font-medium">Impact:</span> {initiative.impact}
          </span>
        )}
        {initiative.effort && (
          <span className="text-[10px] text-slate-500">
            <span className="text-slate-400 font-medium">Effort:</span> {initiative.effort}
          </span>
        )}
        {initiative.status && (
          <StatusPill status={initiative.status} />
        )}
        {initiative.ownerHint && (
          <span className="text-[10px] text-slate-500">
            <span className="text-slate-400 font-medium">Owner:</span> {initiative.ownerHint}
          </span>
        )}
      </div>

      {/* Link to priority */}
      {matchingPriority && (
        <div className="pt-2 border-t border-slate-700/50 mb-2">
          <p className="text-[10px] text-slate-500">
            <span className="text-blue-400">↗</span> From Priority:{' '}
            <span className="text-slate-400">{matchingPriority.title}</span>
          </p>
        </div>
      )}

      {/* Tags */}
      {initiative.tags && initiative.tags.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mb-2">
          {initiative.tags.map((tag, idx) => (
            <span
              key={idx}
              className="inline-flex items-center rounded-full bg-slate-800/50 border border-slate-700/30 px-2 py-0.5 text-[9px] text-slate-400"
            >
              {tag}
            </span>
          ))}
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
          {workItemStatus && (
            <span className="text-[10px] text-slate-500">
              · Status: <span className="text-slate-400 capitalize">{workItemStatus.replace(/_/g, ' ')}</span>
            </span>
          )}
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
 * Area Pill Component
 */
function AreaPill({ area }: { area: PriorityArea | string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-600/30 bg-slate-700/30 px-2 py-0.5 text-[10px] font-medium text-slate-300">
      {area}
    </span>
  );
}

/**
 * Status Pill Component
 */
function StatusPill({ status }: { status: string }) {
  const statusColors: Record<
    string,
    { bg: string; text: string; border: string }
  > = {
    not_started: {
      bg: 'bg-slate-500/20',
      text: 'text-slate-300',
      border: 'border-slate-500/50',
    },
    planned: {
      bg: 'bg-blue-500/20',
      text: 'text-blue-300',
      border: 'border-blue-500/50',
    },
    in_progress: {
      bg: 'bg-amber-500/20',
      text: 'text-amber-300',
      border: 'border-amber-500/50',
    },
    blocked: {
      bg: 'bg-red-500/20',
      text: 'text-red-300',
      border: 'border-red-500/50',
    },
    completed: {
      bg: 'bg-emerald-500/20',
      text: 'text-emerald-300',
      border: 'border-emerald-500/50',
    },
  };

  const colors = statusColors[status] || statusColors.not_started;
  const label = status.replace(/_/g, ' ');

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${colors.bg} ${colors.text} ${colors.border}`}
    >
      {label}
    </span>
  );
}
