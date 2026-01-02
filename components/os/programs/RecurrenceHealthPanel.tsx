'use client';

// components/os/programs/RecurrenceHealthPanel.tsx
// Recurrence Health / SLO Panel - Internal system health monitoring
//
// Displays:
// - Last daily recurrence run with relative time
// - Status badge (Healthy / Failed / Stale)
// - Deliverables created in last run
// - Warnings for stale or failed runs
// - Link to view recurrence logs

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Activity,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Copy,
  ChevronDown,
  ChevronUp,
  Server,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface RecurrenceJobRecord {
  id: string;
  debugId: string;
  jobType: 'daily' | 'on_demand';
  companyId?: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  companiesProcessed?: number;
  deliverablesCreated?: number;
  deliverablesSkipped?: number;
  errors?: number;
  errorMessage?: string;
}

interface RecurrenceHealthSummary {
  lastDailyRun: RecurrenceJobRecord | null;
  lastOnDemandRun: RecurrenceJobRecord | null;
  isStale: boolean;
  staleReason?: string;
  isHealthy: boolean;
  healthIssues: string[];
  totalRunsLast24h: number;
  successfulRunsLast24h: number;
  failedRunsLast24h: number;
  deliverablesCreatedLast24h: number;
}

interface RecurrenceWarning {
  showWarning: boolean;
  warningType: 'stale' | 'failed' | null;
  message: string | null;
  debugId: string | null;
}

interface RecurrenceHealthPanelProps {
  companyId: string;
}

// ============================================================================
// Main Component
// ============================================================================

export function RecurrenceHealthPanel({ companyId }: RecurrenceHealthPanelProps) {
  const [health, setHealth] = useState<RecurrenceHealthSummary | null>(null);
  const [warning, setWarning] = useState<RecurrenceWarning | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedDebugId, setCopiedDebugId] = useState(false);

  // Fetch health data
  const fetchHealth = useCallback(async () => {
    try {
      const response = await fetch('/api/os/recurrence/health');
      if (!response.ok) {
        throw new Error('Failed to fetch recurrence health');
      }

      const data = await response.json();
      setHealth(data.health);
      setWarning(data.warning);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    // Refresh every 5 minutes
    const interval = setInterval(fetchHealth, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  // Copy debug ID to clipboard
  const copyDebugId = async (debugId: string) => {
    try {
      await navigator.clipboard.writeText(debugId);
      setCopiedDebugId(true);
      setTimeout(() => setCopiedDebugId(false), 2000);
    } catch {
      // Clipboard API not available
    }
  };

  // Format relative time
  const formatTimeAgo = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'yesterday';
    return `${diffDays}d ago`;
  };

  // Format exact time for tooltip
  const formatExactTime = (dateStr: string): string => {
    return new Date(dateStr).toLocaleString();
  };

  // ============================================================================
  // Render
  // ============================================================================

  if (isLoading) {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading system health...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-900 border border-red-800/50 rounded-xl p-4">
        <div className="flex items-center gap-2 text-red-400">
          <XCircle className="w-4 h-4" />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  const lastRun = health?.lastDailyRun;
  const statusBadge = getStatusBadge(health);

  return (
    <div className={`bg-slate-900 border rounded-xl overflow-hidden ${
      warning?.showWarning
        ? warning.warningType === 'failed'
          ? 'border-red-800/50'
          : 'border-amber-800/50'
        : 'border-slate-700'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${
            health?.isHealthy ? 'bg-emerald-500/10' : 'bg-amber-500/10'
          }`}>
            <Server className={`w-5 h-5 ${
              health?.isHealthy ? 'text-emerald-400' : 'text-amber-400'
            }`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-white">Recurrence & System Health</h3>
              <span className="text-[10px] px-1.5 py-0.5 bg-slate-700 text-slate-400 rounded">
                Internal
              </span>
            </div>
            <p className="text-xs text-slate-500">Deliverable generation system</p>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 text-xs font-medium rounded ${statusBadge.bg} ${statusBadge.text} border ${statusBadge.border}`}>
            {statusBadge.label}
          </span>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-slate-500 hover:text-white transition-colors"
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Warning Banner */}
      {warning?.showWarning && (
        <div className={`px-4 py-3 flex items-start gap-3 ${
          warning.warningType === 'failed'
            ? 'bg-red-950/30'
            : 'bg-amber-950/30'
        }`}>
          <AlertTriangle className={`w-4 h-4 mt-0.5 ${
            warning.warningType === 'failed' ? 'text-red-400' : 'text-amber-400'
          }`} />
          <div className="flex-1">
            <p className={`text-sm ${
              warning.warningType === 'failed' ? 'text-red-300' : 'text-amber-300'
            }`}>
              {warning.message}
            </p>
            {warning.debugId && (
              <button
                onClick={() => copyDebugId(warning.debugId!)}
                className="flex items-center gap-1 mt-1 text-xs text-slate-500 hover:text-slate-400 transition-colors"
              >
                <Copy className="w-3 h-3" />
                {copiedDebugId ? 'Copied!' : warning.debugId}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="p-4 grid grid-cols-3 gap-4">
        <StatItem
          label="Last Run"
          value={lastRun ? formatTimeAgo(lastRun.completedAt || lastRun.startedAt) : 'Never'}
          tooltip={lastRun ? formatExactTime(lastRun.completedAt || lastRun.startedAt) : undefined}
          icon={<Clock className="w-4 h-4 text-slate-500" />}
        />
        <StatItem
          label="24h Runs"
          value={`${health?.successfulRunsLast24h || 0}/${health?.totalRunsLast24h || 0}`}
          icon={<Activity className="w-4 h-4 text-slate-500" />}
        />
        <StatItem
          label="Created"
          value={`${health?.deliverablesCreatedLast24h || 0}`}
          sublabel="deliverables"
          icon={<CheckCircle2 className="w-4 h-4 text-slate-500" />}
        />
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-slate-700/50 pt-4">
          {/* Last Run Details */}
          {lastRun && (
            <div className="bg-slate-800/50 rounded-lg p-3">
              <p className="text-xs font-medium text-slate-400 mb-2">Last Daily Run</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-slate-500">Status:</span>{' '}
                  <span className={
                    lastRun.status === 'completed' ? 'text-emerald-400' :
                    lastRun.status === 'failed' ? 'text-red-400' :
                    'text-amber-400'
                  }>
                    {lastRun.status}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Duration:</span>{' '}
                  <span className="text-white">
                    {lastRun.durationMs ? `${Math.round(lastRun.durationMs / 1000)}s` : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Companies:</span>{' '}
                  <span className="text-white">{lastRun.companiesProcessed || 0}</span>
                </div>
                <div>
                  <span className="text-slate-500">Created:</span>{' '}
                  <span className="text-white">{lastRun.deliverablesCreated || 0}</span>
                </div>
                {lastRun.errors && lastRun.errors > 0 && (
                  <div className="col-span-2">
                    <span className="text-slate-500">Errors:</span>{' '}
                    <span className="text-red-400">{lastRun.errors}</span>
                  </div>
                )}
              </div>

              {/* Debug ID */}
              <div className="mt-3 pt-3 border-t border-slate-700">
                <button
                  onClick={() => copyDebugId(lastRun.debugId)}
                  className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-400 transition-colors"
                >
                  <Copy className="w-3 h-3" />
                  <span className="font-mono">{lastRun.debugId}</span>
                  {copiedDebugId && <span className="text-emerald-400">Copied!</span>}
                </button>
              </div>
            </div>
          )}

          {/* Health Issues */}
          {health?.healthIssues && health.healthIssues.length > 0 && (
            <div className="bg-amber-950/30 border border-amber-800/30 rounded-lg p-3">
              <p className="text-xs font-medium text-amber-400 mb-2">Health Issues</p>
              <ul className="space-y-1">
                {health.healthIssues.map((issue, i) => (
                  <li key={i} className="text-sm text-amber-200/80 flex items-start gap-2">
                    <span className="text-amber-500 mt-1">•</span>
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* View Logs Link */}
          <Link
            href={`/c/${companyId}/events?filter=recurrence_job`}
            className="flex items-center justify-center gap-2 px-4 py-2 text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            View Recurrence Logs
          </Link>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

function StatItem({
  label,
  value,
  sublabel,
  tooltip,
  icon,
}: {
  label: string;
  value: string;
  sublabel?: string;
  tooltip?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="text-center" title={tooltip}>
      <div className="flex items-center justify-center gap-1 mb-1 text-slate-500">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-lg font-semibold text-white">{value}</p>
      {sublabel && <p className="text-xs text-slate-500">{sublabel}</p>}
    </div>
  );
}

function getStatusBadge(health: RecurrenceHealthSummary | null): {
  label: string;
  bg: string;
  text: string;
  border: string;
} {
  if (!health) {
    return {
      label: 'Unknown',
      bg: 'bg-slate-500/20',
      text: 'text-slate-400',
      border: 'border-slate-500/30',
    };
  }

  if (health.isHealthy) {
    return {
      label: 'Healthy',
      bg: 'bg-emerald-500/20',
      text: 'text-emerald-400',
      border: 'border-emerald-500/30',
    };
  }

  if (health.lastDailyRun?.status === 'failed') {
    return {
      label: 'Failed',
      bg: 'bg-red-500/20',
      text: 'text-red-400',
      border: 'border-red-500/30',
    };
  }

  if (health.isStale) {
    return {
      label: 'Stale',
      bg: 'bg-amber-500/20',
      text: 'text-amber-400',
      border: 'border-amber-500/30',
    };
  }

  return {
    label: 'Attention',
    bg: 'bg-amber-500/20',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
  };
}

export default RecurrenceHealthPanel;
