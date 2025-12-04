'use client';

// components/ui/AdminDebugPanel.tsx
// Debug panel for admin users showing system status and diagnostics

import { useState } from 'react';
import type { Ga4Status } from '@/lib/os/analytics/ga4Status';
import type { ContextGraphHealthStatus } from '@/lib/contextGraph/health';

interface AdminDebugPanelProps {
  companyId: string;
  isAdmin?: boolean;
  data: {
    ga4Status?: Ga4Status;
    ga4ErrorMessage?: string;
    graphHealth?: ContextGraphHealthStatus;
    graphCompleteness?: number;
    lastSsmDate?: string | null;
    lastQbrDate?: string | null;
    lastFusionDate?: string | null;
    graphVersion?: string;
    additionalInfo?: Record<string, unknown>;
  };
  className?: string;
}

/**
 * Debug panel for admin users
 *
 * Shows system status and diagnostic information for troubleshooting.
 * Only visible to admin users.
 */
export function AdminDebugPanel({
  companyId,
  isAdmin = false,
  data,
  className = '',
}: AdminDebugPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Don't render for non-admins
  if (!isAdmin) {
    return null;
  }

  const getStatusBadge = (status: string | undefined, type: 'ga4' | 'graph') => {
    if (!status) return null;

    const colors: Record<string, string> = {
      ok: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      healthy: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      no_config: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
      partial: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      no_data: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      error: 'bg-red-500/20 text-red-400 border-red-500/30',
      empty: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
      unavailable: 'bg-red-500/20 text-red-400 border-red-500/30',
    };

    return (
      <span
        className={`px-2 py-0.5 rounded text-xs font-medium border ${colors[status] || colors.error}`}
      >
        {status}
      </span>
    );
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return '—';
    try {
      return new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return date;
    }
  };

  return (
    <div
      className={`bg-slate-950 border border-purple-500/30 rounded-xl overflow-hidden ${className}`}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-purple-500/10 hover:bg-purple-500/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-purple-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
            />
          </svg>
          <span className="text-xs font-semibold text-purple-400 uppercase tracking-wide">
            Debug Panel (Admin Only)
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-purple-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Company ID */}
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
              Company ID
            </p>
            <code className="text-xs text-slate-300 font-mono bg-slate-900 px-2 py-1 rounded">
              {companyId}
            </code>
          </div>

          {/* Status Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* GA4 Status */}
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                GA4 Status
              </p>
              <div className="flex items-center gap-2">
                {getStatusBadge(data.ga4Status, 'ga4')}
                {data.ga4ErrorMessage && (
                  <span className="text-xs text-red-400 truncate" title={data.ga4ErrorMessage}>
                    {data.ga4ErrorMessage.slice(0, 30)}...
                  </span>
                )}
              </div>
            </div>

            {/* Graph Health */}
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                Graph Health
              </p>
              <div className="flex items-center gap-2">
                {getStatusBadge(data.graphHealth, 'graph')}
                {data.graphCompleteness !== undefined && (
                  <span className="text-xs text-slate-400">
                    {data.graphCompleteness}%
                  </span>
                )}
              </div>
            </div>

            {/* SSM Date */}
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                Last SSM
              </p>
              <p className="text-xs text-slate-300">{formatDate(data.lastSsmDate)}</p>
            </div>

            {/* QBR Date */}
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                Last QBR
              </p>
              <p className="text-xs text-slate-300">{formatDate(data.lastQbrDate)}</p>
            </div>

            {/* Last Fusion */}
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                Last Fusion
              </p>
              <p className="text-xs text-slate-300">{formatDate(data.lastFusionDate)}</p>
            </div>

            {/* Graph Version */}
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                Graph Version
              </p>
              <p className="text-xs text-slate-300">{data.graphVersion || '—'}</p>
            </div>
          </div>

          {/* Additional Info */}
          {data.additionalInfo && Object.keys(data.additionalInfo).length > 0 && (
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">
                Additional Info
              </p>
              <pre className="text-xs text-slate-400 bg-slate-900 p-3 rounded overflow-auto max-h-40">
                {JSON.stringify(data.additionalInfo, null, 2)}
              </pre>
            </div>
          )}

          {/* Quick Actions */}
          <div className="pt-3 border-t border-slate-800">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">
              Quick Actions
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href={`/c/${companyId}/context`}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                View Context Graph
              </a>
              <span className="text-slate-600">|</span>
              <a
                href={`/c/${companyId}/setup`}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                Open SSM
              </a>
              <span className="text-slate-600">|</span>
              <a
                href={`/c/${companyId}/qbr`}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                Open QBR
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDebugPanel;
