'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { WorkItemRecord, WorkItemStatus } from '@/lib/airtable/workItems';

export interface WorkItemCardWithStatusProps {
  item: WorkItemRecord;
  isSelected?: boolean;
  onClick?: () => void;
}

const STATUS_OPTIONS: WorkItemStatus[] = ['Backlog', 'Planned', 'In Progress', 'Done'];

export default function WorkItemCardWithStatus({ item, isSelected, onClick }: WorkItemCardWithStatusProps) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStatusChange = async (newStatus: WorkItemStatus) => {
    if (newStatus === item.status || isUpdating) return;

    setIsUpdating(true);
    setError(null);

    try {
      const response = await fetch('/api/work-items/status', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workItemId: item.id,
          status: newStatus,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to update status');
      }

      console.log('[WorkItemCard] Status updated:', data.workItem);

      // Refresh the page to show the updated status
      router.refresh();
    } catch (err) {
      console.error('[WorkItemCard] Error updating status:', err);
      setError(err instanceof Error ? err.message : 'Failed to update status');
      setIsUpdating(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-800 bg-[#050509]/80 px-3 py-3">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="font-medium text-slate-100 text-sm flex-1">
          {item.title}
        </h4>
        {item.severity && <SeverityPill severity={item.severity} />}
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-3">
        {item.area && <AreaPill area={item.area} />}
        {item.owner && (
          <span className="text-xs text-slate-400">
            👤 {item.owner}
          </span>
        )}
        {item.dueDate && (
          <span className="text-xs text-slate-400">
            📅 {formatDate(item.dueDate)}
          </span>
        )}
      </div>

      {item.notes && (
        <p className="text-xs text-slate-500 mb-3 line-clamp-2">
          {item.notes}
        </p>
      )}

      {/* Status Control */}
      <div className="pt-3 border-t border-slate-800">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-[10px] uppercase font-medium text-slate-500 tracking-wide">
            Status
          </span>
          {isUpdating && (
            <span className="text-[10px] text-slate-500">
              (updating...)
            </span>
          )}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_OPTIONS.map((status) => (
            <button
              key={status}
              onClick={() => handleStatusChange(status)}
              disabled={isUpdating}
              className={`
                px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors
                ${
                  item.status === status
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                    : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'
                }
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              {status}
            </button>
          ))}
        </div>

        {error && (
          <p className="text-[10px] text-red-400 mt-2">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Severity Pill Component
 */
function SeverityPill({ severity }: { severity: string }) {
  const normalized = severity.toLowerCase();

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

  const label = severity.charAt(0).toUpperCase() + severity.slice(1);

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
function AreaPill({ area }: { area: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium bg-slate-700/50 text-slate-200 border-slate-600"
    >
      {area}
    </span>
  );
}

/**
 * Format date helper
 */
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}
