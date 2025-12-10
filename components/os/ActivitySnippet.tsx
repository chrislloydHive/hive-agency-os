'use client';

// components/os/ActivitySnippet.tsx
// Compact Recent Activity Snippet for Company Overview
//
// Shows 4 most recent activity events with a link to full timeline.
// Designed to be placed below the Job Launcher.
// Text format: "{friendlyName} · {relativeTime} ago"

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

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return '1d ago';
    if (diffDays < 7) return `${diffDays}d ago`;
    return `${Math.floor(diffDays / 7)}w ago`;
  } catch {
    return '';
  }
}

/**
 * Format the activity title for better readability
 * Converts "Diagnostic run: GAP Plan" to "GAP Plan diagnostic run"
 * Converts "Work item created: Fix SEO" to "Work item created"
 */
function formatActivityTitle(title: string, type: ActivityEventType): string {
  // Handle diagnostic format: "Diagnostic run: {labName}"
  if (title.startsWith('Diagnostic run:')) {
    const labName = title.replace('Diagnostic run:', '').trim();
    return `${labName} diagnostic run`;
  }

  // Handle work item format: "Work item created: {title}" or "Work item completed: {title}"
  if (title.startsWith('Work item created:')) {
    return 'Work item created';
  }
  if (title.startsWith('Work item completed:')) {
    return 'Work item completed';
  }

  // Handle experiment format: "Experiment added: {name}" etc.
  if (title.startsWith('Experiment added:')) {
    return 'Experiment added';
  }
  if (title.startsWith('Experiment started:')) {
    return 'Experiment started';
  }
  if (title.startsWith('Experiment concluded:')) {
    return 'Experiment concluded';
  }

  // Fallback: return as-is but truncated
  return title.length > 40 ? title.slice(0, 40) + '...' : title;
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

        // Check if response is OK before parsing JSON
        if (!response.ok) {
          console.error('[ActivitySnippet] API error:', response.status, response.statusText);
          return;
        }

        // Verify content type is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.error('[ActivitySnippet] Unexpected content type:', contentType);
          return;
        }

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
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
        <div className="animate-pulse flex items-center gap-3">
          <div className="w-6 h-6 bg-slate-800 rounded" />
          <div className="flex-1 space-y-1.5">
            <div className="h-2.5 bg-slate-800 rounded w-32" />
            <div className="h-2 bg-slate-800 rounded w-20" />
          </div>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
        <div className="flex items-center gap-2 text-slate-500">
          <Activity className="w-4 h-4" />
          <p className="text-xs">No recent activity</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800/50">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          <h3 className="text-xs font-medium text-slate-300">Recent Activity</h3>
        </div>
        <Link
          href={`/c/${companyId}/brain/history`}
          className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
        >
          View all{total > 4 ? ` (${total})` : ''}
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Events List - Compact */}
      <div className="divide-y divide-slate-800/30">
        {events.slice(0, 4).map(event => {
          const config = typeConfig[event.type] || typeConfig.work_item;
          const formattedTitle = formatActivityTitle(event.title, event.type);
          const relativeTime = formatRelativeTime(event.timestamp);

          return (
            <div
              key={event.id}
              className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-slate-800/20 transition-colors cursor-default"
            >
              {/* Type Indicator */}
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${config.bg}`} />

              {/* Content: "{title} · {time}" */}
              <p className="flex-1 text-xs truncate">
                <span className="text-slate-200">{formattedTitle}</span>
                <span className="text-slate-600 mx-1.5">·</span>
                <span className="text-slate-500">{relativeTime}</span>
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ActivitySnippet;
