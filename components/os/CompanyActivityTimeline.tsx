'use client';

// components/os/CompanyActivityTimeline.tsx
// Company Activity Timeline Component
//
// Displays a timeline of recent activity for a company including
// work items, experiments, diagnostic runs, and other events.

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface ActivityEvent {
  id: string;
  type: 'work_item' | 'experiment' | 'diagnostic' | 'report' | 'insight';
  title: string;
  description?: string;
  timestamp: string;
  status?: string;
  meta?: Record<string, unknown>;
}

interface CompanyActivityTimelineProps {
  companyId: string;
  limit?: number;
}

const typeColors: Record<ActivityEvent['type'], string> = {
  work_item: 'bg-blue-500',
  experiment: 'bg-purple-500',
  diagnostic: 'bg-amber-500',
  report: 'bg-emerald-500',
  insight: 'bg-cyan-500',
};

const typeLabels: Record<ActivityEvent['type'], string> = {
  work_item: 'Work',
  experiment: 'Experiment',
  diagnostic: 'Diagnostic',
  report: 'Report',
  insight: 'Insight',
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

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
          Recent Activity
        </h3>
        {total > limit && (
          <span className="text-xs text-slate-500">
            Showing {events.length} of {total}
          </span>
        )}
      </div>
      <div className="divide-y divide-slate-800/50">
        {events.map((event) => (
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
      {total > limit && (
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
