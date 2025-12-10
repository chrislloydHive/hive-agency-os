'use client';

// components/os/ActivitySnippet.tsx
// Compact Recent Activity Snippet for Company Overview
//
// Shows 3-4 most recent activity events with a link to full timeline.
// Designed to be placed below the Quick Actions Launcher.

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Clock, ArrowRight, Activity } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

type ActivityEventType =
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
}

interface ActivitySnippetProps {
  companyId: string;
}

// ============================================================================
// Config
// ============================================================================

const typeConfig: Record<ActivityEventType, { bg: string; text: string; label: string }> = {
  work_item: { bg: 'bg-blue-500', text: 'text-blue-400', label: 'Work' },
  experiment: { bg: 'bg-purple-500', text: 'text-purple-400', label: 'Experiment' },
  diagnostic: { bg: 'bg-amber-500', text: 'text-amber-400', label: 'Diagnostic' },
  report: { bg: 'bg-emerald-500', text: 'text-emerald-400', label: 'Report' },
  insight: { bg: 'bg-cyan-500', text: 'text-cyan-400', label: 'Insight' },
  dma_audit: { bg: 'bg-purple-500', text: 'text-purple-400', label: 'DMA' },
  gap_ia: { bg: 'bg-amber-500', text: 'text-amber-400', label: 'GAP-IA' },
  gap_full: { bg: 'bg-emerald-500', text: 'text-emerald-400', label: 'Full GAP' },
  gap_review_cta: { bg: 'bg-emerald-400', text: 'text-emerald-300', label: 'Review' },
};

// ============================================================================
// Helper Functions
// ============================================================================

function formatRelativeTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays === 1) return '1d';
    if (diffDays < 7) return `${diffDays}d`;
    return `${Math.floor(diffDays / 7)}w`;
  } catch {
    return '';
  }
}

// ============================================================================
// Component
// ============================================================================

export function ActivitySnippet({ companyId }: ActivitySnippetProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        const response = await fetch(`/api/os/companies/${companyId}/activity?limit=4`);
        const data = await response.json();

        if (data.ok) {
          setEvents(data.events || []);
          setTotal(data.total || 0);
        }
      } catch (err) {
        console.error('[ActivitySnippet] Error fetching activity:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchActivity();
  }, [companyId]);

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="animate-pulse flex items-center gap-3">
          <div className="w-8 h-8 bg-slate-800 rounded-lg" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-slate-800 rounded w-24" />
            <div className="h-2 bg-slate-800 rounded w-40" />
          </div>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center gap-3 text-slate-500">
          <Activity className="w-5 h-5" />
          <p className="text-sm">No recent activity</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-medium text-slate-200">Recent Activity</h3>
        </div>
        <Link
          href={`/c/${companyId}/brain/history`}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          View all {total > 4 ? `(${total})` : ''}
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Events List */}
      <div className="divide-y divide-slate-800/50">
        {events.slice(0, 4).map(event => {
          const config = typeConfig[event.type] || typeConfig.work_item;

          return (
            <div
              key={event.id}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800/30 transition-colors"
            >
              {/* Type Indicator */}
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${config.bg}`} />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-200 truncate">{event.title}</p>
              </div>

              {/* Time */}
              <span className="text-xs text-slate-500 flex-shrink-0">
                {formatRelativeTime(event.timestamp)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ActivitySnippet;
