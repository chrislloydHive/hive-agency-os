'use client';

// components/os/CompanyActivityTimeline.tsx
// Company Activity Timeline Component
//
// Displays a timeline of recent activity for a company including
// work items, experiments, diagnostic runs, and other events.
// Supports filtering by event type via the filterType prop.

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

// Supported activity event types
export type ActivityEventType =
  | 'work_item'
  | 'experiment'
  | 'diagnostic'
  | 'report'
  | 'insight'
  | 'dma_audit'
  | 'gap_ia'
  | 'gap_full'
  | 'gap_review_cta';

interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  title: string;
  description?: string;
  timestamp: string;
  status?: string;
  meta?: Record<string, unknown>;
}

interface CompanyActivityTimelineProps {
  companyId: string;
  limit?: number;
  /** Filter to show only events of this type */
  filterType?: ActivityEventType | null;
  /** Callback when filter is cleared */
  onClearFilter?: () => void;
}

const typeColors: Record<ActivityEventType, string> = {
  work_item: 'bg-blue-500',
  experiment: 'bg-purple-500',
  diagnostic: 'bg-amber-500',
  report: 'bg-emerald-500',
  insight: 'bg-cyan-500',
  dma_audit: 'bg-purple-500',
  gap_ia: 'bg-amber-500',
  gap_full: 'bg-emerald-500',
  gap_review_cta: 'bg-emerald-400',
};

const typeLabels: Record<ActivityEventType, string> = {
  work_item: 'Work',
  experiment: 'Experiment',
  diagnostic: 'Diagnostic',
  report: 'Report',
  insight: 'Insight',
  dma_audit: 'DMA Audit',
  gap_ia: 'GAP-IA',
  gap_full: 'Full GAP',
  gap_review_cta: 'Review CTA',
};

function formatRelativeTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'Unknown';
  }
}

export function CompanyActivityTimeline({
  companyId,
  limit = 10,
  filterType,
  onClearFilter,
}: CompanyActivityTimelineProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const fetchActivity = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/activity?limit=${limit}`
      );
      const data = await response.json();

      if (!data.ok) {
        throw new Error(data.error || 'Failed to fetch activity');
      }

      setEvents(data.events || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('[ActivityTimeline] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load activity');
    } finally {
      setLoading(false);
    }
  }, [companyId, limit]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  // Filter events if filterType is provided
  const filteredEvents = filterType
    ? events.filter((e) => e.type === filterType)
    : events;

  const displayedEvents = filteredEvents;

  if (loading) {
    return (
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-4 h-4 border-2 border-slate-600 border-t-amber-400 rounded-full animate-spin" />
          <span className="text-slate-400 text-sm">Loading activity...</span>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="w-2 h-2 rounded-full bg-slate-700 mt-2" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-slate-800 rounded w-3/4" />
                <div className="h-3 bg-slate-800 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
        <p className="text-red-400 text-sm">{error}</p>
        <button
          onClick={fetchActivity}
          className="mt-2 text-xs text-red-300 hover:text-red-200 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">
          Recent Activity
        </h3>
        <p className="text-slate-500 text-sm">No recent activity</p>
      </div>
    );
  }

  // No events matching filter
  if (filterType && filteredEvents.length === 0) {
    return (
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
            Recent Activity
          </h3>
          <FilterChip
            filterType={filterType}
            onClear={onClearFilter}
          />
        </div>
        <div className="p-6 text-center">
          <p className="text-slate-500 text-sm">
            No {typeLabels[filterType]} events found in recent activity.
          </p>
          {onClearFilter && (
            <button
              onClick={onClearFilter}
              className="mt-3 text-xs text-amber-400 hover:text-amber-300 underline"
            >
              Clear filter to see all activity
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
          Recent Activity
        </h3>
        <div className="flex items-center gap-3">
          {filterType && (
            <FilterChip
              filterType={filterType}
              onClear={onClearFilter}
            />
          )}
          {!filterType && total > limit && (
            <span className="text-xs text-slate-500">
              Showing {displayedEvents.length} of {total}
            </span>
          )}
        </div>
      </div>
      <div className="divide-y divide-slate-800/50">
        {displayedEvents.map((event) => (
          <div
            key={event.id}
            className="p-4 hover:bg-slate-800/30 transition-colors"
          >
            <div className="flex gap-3">
              {/* Timeline dot */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-2 h-2 rounded-full ${typeColors[event.type]}`}
                />
                <div className="w-px flex-1 bg-slate-700 mt-2" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 truncate">
                      {event.title}
                    </p>
                    {event.description && (
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {event.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded ${typeColors[event.type]}/20 text-${typeColors[event.type].replace('bg-', '')}/80 border border-${typeColors[event.type].replace('bg-', '')}/30`}
                      style={{
                        backgroundColor: `rgb(var(--${typeColors[event.type].replace('bg-', '')})/0.1)`,
                      }}
                    >
                      {typeLabels[event.type]}
                    </span>
                    <span className="text-[10px] text-slate-500 whitespace-nowrap">
                      {formatRelativeTime(event.timestamp)}
                    </span>
                  </div>
                </div>

                {/* Status badge */}
                {event.status && (
                  <div className="mt-1.5">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                        event.status === 'Done' || event.status === 'complete' || event.status === 'Concluded'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : event.status === 'In Progress' || event.status === 'Running'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                            : 'bg-slate-700/50 text-slate-400 border border-slate-600'
                      }`}
                    >
                      {event.status}
                    </span>
                  </div>
                )}

                {/* Link to detail */}
                {event.meta && 'experimentId' in event.meta && (
                  <Link
                    href={`/c/${companyId}/experiments`}
                    className="text-[10px] text-amber-400 hover:text-amber-300 mt-1.5 inline-block"
                  >
                    View experiment
                  </Link>
                )}
                {event.meta && 'itemId' in event.meta && (
                  <Link
                    href={`/c/${companyId}/work`}
                    className="text-[10px] text-amber-400 hover:text-amber-300 mt-1.5 inline-block"
                  >
                    View work item
                  </Link>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* View all link */}
      {!filterType && total > limit && (
        <div className="p-3 border-t border-slate-800 text-center">
          <Link
            href={`/c/${companyId}/work`}
            className="text-xs text-amber-400 hover:text-amber-300"
          >
            View all activity
          </Link>
        </div>
      )}
    </div>
  );
}

// Filter chip component for showing active filter with clear button
function FilterChip({
  filterType,
  onClear,
}: {
  filterType: ActivityEventType;
  onClear?: () => void;
}) {
  const color = typeColors[filterType] || 'bg-slate-500';
  const label = typeLabels[filterType] || filterType;

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-800 rounded-full border border-slate-700">
      <div className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-xs text-slate-300">
        Filtering: {label}
      </span>
      {onClear && (
        <button
          onClick={onClear}
          className="ml-1 text-slate-400 hover:text-slate-200 transition-colors"
          aria-label="Clear filter"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
