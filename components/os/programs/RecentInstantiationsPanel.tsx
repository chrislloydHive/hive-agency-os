'use client';

// components/os/programs/RecentInstantiationsPanel.tsx
// Shows recent bundle instantiation events for a company
//
// Displays the last 10 bundle instantiations with:
// - Timestamp
// - Preset name
// - Intensity level
// - Domains count
// - Created/skipped programs count
// - Deliverables count
//
// Click to expand details with links to programs

import { useState, useEffect } from 'react';
import {
  Package,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  AlertCircle,
  Check,
  Clock,
} from 'lucide-react';
import type { OperationalEvent, BundleInstantiationEventPayload } from '@/lib/types/operationalEvent';

interface RecentInstantiationsPanelProps {
  companyId: string;
}

export function RecentInstantiationsPanel({ companyId }: RecentInstantiationsPanelProps) {
  const [events, setEvents] = useState<OperationalEvent<BundleInstantiationEventPayload>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEvents() {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/os/companies/${companyId}/events?type=bundle_instantiated&limit=10`
        );
        if (!response.ok) {
          throw new Error('Failed to fetch events');
        }
        const data = await response.json();
        setEvents(data.events || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchEvents();
  }, [companyId]);

  if (loading) {
    return (
      <div className="p-4 bg-slate-900 border border-slate-700 rounded-xl">
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading recent instantiations...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-slate-900 border border-slate-700 rounded-xl">
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">Failed to load: {error}</span>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="p-4 bg-slate-900 border border-slate-700 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-slate-800">
            <Package className="w-5 h-5 text-slate-400" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-white">Recent Instantiations</h3>
            <p className="text-xs text-slate-500">No bundle instantiations yet</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-slate-700">
        <div className="p-2 rounded-lg bg-blue-500/10">
          <Package className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h3 className="text-sm font-medium text-white">Recent Instantiations</h3>
          <p className="text-xs text-slate-500">Last {events.length} bundle deployments</p>
        </div>
      </div>

      {/* Event List */}
      <div className="divide-y divide-slate-700/50">
        {events.map((event) => (
          <EventRow
            key={event.id}
            event={event}
            isExpanded={expandedId === event.id}
            onToggle={() => setExpandedId(expandedId === event.id ? null : event.id)}
            companyId={companyId}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Event Row Component
// ============================================================================

interface EventRowProps {
  event: OperationalEvent<BundleInstantiationEventPayload>;
  isExpanded: boolean;
  onToggle: () => void;
  companyId: string;
}

function EventRow({ event, isExpanded, onToggle, companyId }: EventRowProps) {
  const payload = event.payload;
  const timestamp = new Date(event.timestamp);
  const relativeTime = getRelativeTime(timestamp);

  return (
    <div>
      {/* Summary Row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-slate-800/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0">
            {payload.summary.failed > 0 ? (
              <AlertCircle className="w-4 h-4 text-amber-400" />
            ) : (
              <Check className="w-4 h-4 text-emerald-400" />
            )}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-white truncate">
              {payload.presetName}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>{payload.intensity}</span>
              <span>·</span>
              <span>{payload.domains.length} domains</span>
              <span>·</span>
              <span>{payload.summary.created} created</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <Clock className="w-3 h-3" />
            <span>{relativeTime}</span>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          )}
        </div>
      </button>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3 bg-slate-800/30">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 pt-2">
            <div className="p-2 bg-slate-800 rounded-lg text-center">
              <div className="text-lg font-semibold text-emerald-400">
                {payload.summary.created}
              </div>
              <div className="text-xs text-slate-500">Created</div>
            </div>
            <div className="p-2 bg-slate-800 rounded-lg text-center">
              <div className="text-lg font-semibold text-slate-400">
                {payload.summary.skipped}
              </div>
              <div className="text-xs text-slate-500">Skipped</div>
            </div>
            <div className="p-2 bg-slate-800 rounded-lg text-center">
              <div className="text-lg font-semibold text-blue-400">
                {payload.createdDeliverables}
              </div>
              <div className="text-xs text-slate-500">Deliverables</div>
            </div>
          </div>

          {/* Program List */}
          {payload.createdPrograms.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs text-slate-500 mb-1">Programs</div>
              {payload.createdPrograms.map((prog) => (
                <a
                  key={prog.programId}
                  href={`/c/${companyId}/programs/${prog.programId}`}
                  className="flex items-center justify-between p-2 bg-slate-800/50 rounded hover:bg-slate-800 transition-colors group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {prog.status === 'created' ? (
                      <Check className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                    ) : prog.status === 'already_exists' ? (
                      <Package className="w-3 h-3 text-slate-400 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0" />
                    )}
                    <span className="text-sm text-white truncate">{prog.title}</span>
                  </div>
                  <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-white transition-colors flex-shrink-0" />
                </a>
              ))}
            </div>
          )}

          {/* Debug ID */}
          <div className="text-xs text-slate-600">
            Debug ID: {event.debugId}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default RecentInstantiationsPanel;
