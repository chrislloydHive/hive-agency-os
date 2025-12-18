'use client';

// components/os/overview/SupportingSignals.tsx
// Supporting Signals - Collapsible section for diagnostics & analytics
//
// This demotes diagnostics from "leading" to "supporting" role.
// Collapsed by default unless there's something actionable.
//
// Contains:
// - Recent diagnostic scores
// - Performance pulse (if available)
// - Alerts (surfaced if critical)
// - Analytics snapshot

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ChevronDown,
  ChevronUp,
  Activity,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  FileSearch,
  BarChart3,
  Bell,
  ExternalLink,
} from 'lucide-react';
import type { RecentDiagnostic } from '@/components/os/blueprint/types';
import type { CompanyAlert } from '@/lib/os/companies/alerts';
import type { PerformancePulse } from '@/lib/os/analytics/performancePulse';
import type { CompanyScoreTrends } from '@/lib/os/diagnostics/runs';

// ============================================================================
// Types
// ============================================================================

export interface SupportingSignalsProps {
  companyId: string;
  recentDiagnostics: RecentDiagnostic[];
  alerts: CompanyAlert[];
  performancePulse: PerformancePulse | null;
  scoreTrends: CompanyScoreTrends;
  /** Force expanded (e.g., if there are critical alerts) */
  forceExpanded?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function SupportingSignals({
  companyId,
  recentDiagnostics,
  alerts,
  performancePulse,
  scoreTrends,
  forceExpanded = false,
}: SupportingSignalsProps) {
  // Determine if there are critical signals that should expand by default
  const criticalAlerts = alerts.filter(a => a.severity === 'critical');
  const shouldExpandByDefault = forceExpanded || criticalAlerts.length > 0;

  const [isExpanded, setIsExpanded] = useState(shouldExpandByDefault);

  // Compute summary stats
  const latestDiagnostic = recentDiagnostics.find(d => d.status === 'complete');
  const alertCount = alerts.length;
  const hasPerformanceData = performancePulse !== null;

  // Summary line for collapsed state
  const summaryParts: string[] = [];
  if (latestDiagnostic) {
    summaryParts.push(`Score: ${latestDiagnostic.score ?? '—'}%`);
  }
  if (alertCount > 0) {
    summaryParts.push(`${alertCount} alert${alertCount !== 1 ? 's' : ''}`);
  }
  if (hasPerformanceData) {
    summaryParts.push('Performance data available');
  }
  const summaryText = summaryParts.length > 0
    ? summaryParts.join(' · ')
    : 'No recent signals';

  return (
    <div className="bg-slate-900/30 border border-slate-800 rounded-xl overflow-hidden">
      {/* Header (always visible) */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-700/50 flex items-center justify-center">
            <Activity className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-medium text-white">
              Supporting Signals
              {criticalAlerts.length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-xs bg-red-500/20 text-red-400 rounded">
                  {criticalAlerts.length} critical
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500">{summaryText}</p>
          </div>
        </div>

        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-slate-800">
          {/* Alerts Section */}
          {alerts.length > 0 && (
            <AlertsSection alerts={alerts} companyId={companyId} />
          )}

          {/* Diagnostics Section */}
          {recentDiagnostics.length > 0 && (
            <DiagnosticsSection
              diagnostics={recentDiagnostics}
              companyId={companyId}
            />
          )}

          {/* Performance Pulse Section */}
          {performancePulse && (
            <PerformancePulseSection pulse={performancePulse} />
          )}

          {/* Score Trends Section */}
          {scoreTrends.overall.length > 0 && (
            <ScoreTrendsSection trends={scoreTrends} />
          )}

          {/* Empty state */}
          {recentDiagnostics.length === 0 && alerts.length === 0 && !performancePulse && (
            <div className="p-6 text-center">
              <p className="text-sm text-slate-500 mb-3">
                No diagnostic data yet
              </p>
              <Link
                href={`/c/${companyId}/diagnostics`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg transition-colors"
              >
                <FileSearch className="w-4 h-4" />
                Run a Diagnostic
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Sub-sections
// ============================================================================

function AlertsSection({
  alerts,
  companyId,
}: {
  alerts: CompanyAlert[];
  companyId: string;
}) {
  const sortedAlerts = useMemo(() => {
    return [...alerts].sort((a, b) => {
      const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
      return (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3);
    });
  }, [alerts]);

  return (
    <div className="p-4 border-b border-slate-800/50">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-2">
          <Bell className="w-3.5 h-3.5" />
          Alerts
        </h4>
        <Link
          href={`/c/${companyId}/alerts`}
          className="text-xs text-slate-400 hover:text-white transition-colors"
        >
          View all
        </Link>
      </div>

      <div className="space-y-2">
        {sortedAlerts.slice(0, 3).map((alert) => (
          <div
            key={alert.id}
            className={`
              p-3 rounded-lg border
              ${alert.severity === 'critical'
                ? 'bg-red-500/10 border-red-500/30'
                : alert.severity === 'warning'
                  ? 'bg-amber-500/10 border-amber-500/30'
                  : 'bg-slate-800/50 border-slate-700'
              }
            `}
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className={`
                w-4 h-4 mt-0.5 flex-shrink-0
                ${alert.severity === 'critical'
                  ? 'text-red-400'
                  : alert.severity === 'warning'
                    ? 'text-amber-400'
                    : 'text-slate-400'
                }
              `} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white">{alert.title}</p>
                {alert.description && (
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                    {alert.description}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}

        {alerts.length > 3 && (
          <p className="text-xs text-slate-500 text-center pt-1">
            +{alerts.length - 3} more alerts
          </p>
        )}
      </div>
    </div>
  );
}

function DiagnosticsSection({
  diagnostics,
  companyId,
}: {
  diagnostics: RecentDiagnostic[];
  companyId: string;
}) {
  const completedDiagnostics = diagnostics.filter(d => d.status === 'complete');

  return (
    <div className="p-4 border-b border-slate-800/50">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-2">
          <FileSearch className="w-3.5 h-3.5" />
          Recent Diagnostics
        </h4>
        <Link
          href={`/c/${companyId}/diagnostics`}
          className="text-xs text-slate-400 hover:text-white transition-colors"
        >
          View all
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {completedDiagnostics.slice(0, 3).map((diagnostic) => (
          <Link
            key={diagnostic.id}
            href={diagnostic.reportPath || `/c/${companyId}/diagnostics`}
            className="p-3 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-400 truncate">
                {diagnostic.toolLabel}
              </span>
              <ExternalLink className="w-3 h-3 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className={`
                text-xl font-semibold
                ${getScoreColor(diagnostic.score)}
              `}>
                {diagnostic.score ?? '—'}
              </span>
              {diagnostic.score !== null && (
                <span className="text-xs text-slate-500">%</span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function PerformancePulseSection({ pulse }: { pulse: PerformancePulse }) {
  const hasData = pulse.hasGa4 || pulse.hasGsc;
  if (!hasData) return null;

  return (
    <div className="p-4 border-b border-slate-800/50">
      <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-2 mb-3">
        <BarChart3 className="w-3.5 h-3.5" />
        Performance Pulse (7-day)
      </h4>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {/* Traffic */}
        {pulse.hasGa4 && pulse.currentSessions !== null && (
          <div className="p-3 bg-slate-800/30 rounded-lg">
            <p className="text-xs text-slate-400 mb-1">Traffic</p>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold text-white">
                {pulse.currentSessions.toLocaleString()}
              </span>
              {pulse.trafficChange7d !== null && (
                <TrendIndicator trend={pulse.trafficChange7d > 0 ? 'up' : pulse.trafficChange7d < 0 ? 'down' : 'stable'} />
              )}
            </div>
          </div>
        )}

        {/* Conversions */}
        {pulse.hasGa4 && pulse.currentConversions !== null && (
          <div className="p-3 bg-slate-800/30 rounded-lg">
            <p className="text-xs text-slate-400 mb-1">Conversions</p>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold text-white">
                {pulse.currentConversions.toLocaleString()}
              </span>
              {pulse.conversionsChange7d !== null && (
                <TrendIndicator trend={pulse.conversionsChange7d > 0 ? 'up' : pulse.conversionsChange7d < 0 ? 'down' : 'stable'} />
              )}
            </div>
          </div>
        )}

        {/* SEO Clicks */}
        {pulse.hasGsc && pulse.currentClicks !== null && (
          <div className="p-3 bg-slate-800/30 rounded-lg">
            <p className="text-xs text-slate-400 mb-1">SEO Clicks</p>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold text-white">
                {pulse.currentClicks.toLocaleString()}
              </span>
              {pulse.seoVisibilityChange7d !== null && (
                <TrendIndicator trend={pulse.seoVisibilityChange7d > 0 ? 'up' : pulse.seoVisibilityChange7d < 0 ? 'down' : 'stable'} />
              )}
            </div>
          </div>
        )}
      </div>

      {pulse.hasAnomalies && pulse.anomalySummary && (
        <p className="text-xs text-amber-400 mt-2">{pulse.anomalySummary}</p>
      )}
    </div>
  );
}

function ScoreTrendsSection({ trends }: { trends: CompanyScoreTrends }) {
  const latestOverall = trends.overall[trends.overall.length - 1];
  const previousOverall = trends.overall[trends.overall.length - 2];

  const latestScore = latestOverall?.score ?? null;
  const previousScore = previousOverall?.score ?? null;

  const trendDirection = latestScore !== null && previousScore !== null
    ? latestScore > previousScore
      ? 'up'
      : latestScore < previousScore
        ? 'down'
        : 'stable'
    : 'stable';

  if (!latestOverall || latestScore === null) return null;

  return (
    <div className="p-4">
      <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-2 mb-3">
        <TrendingUp className="w-3.5 h-3.5" />
        Score Trend
      </h4>

      <div className="flex items-center gap-4">
        <div className="flex items-baseline gap-2">
          <span className={`text-2xl font-semibold ${getScoreColor(latestScore)}`}>
            {latestScore}
          </span>
          <span className="text-sm text-slate-500">overall</span>
        </div>

        <div className="flex items-center gap-1">
          <TrendIndicator trend={trendDirection} />
          {previousScore !== null && (
            <span className="text-xs text-slate-500">
              from {previousScore}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function TrendIndicator({ trend }: { trend: 'up' | 'down' | 'stable' | string }) {
  switch (trend) {
    case 'up':
      return <TrendingUp className="w-4 h-4 text-emerald-400" />;
    case 'down':
      return <TrendingDown className="w-4 h-4 text-red-400" />;
    default:
      return <Minus className="w-4 h-4 text-slate-400" />;
  }
}

function getScoreColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'text-slate-400';
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-amber-400';
  return 'text-red-400';
}

