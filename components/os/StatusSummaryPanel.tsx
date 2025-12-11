'use client';

// components/os/StatusSummaryPanel.tsx
// Status Summary Panel - Status-first view at top of Company Overview
//
// Shows:
// - Lifecycle stage + Overall status pill
// - "Where we are" column
// - "What's working" column
// - "What's not working" column
// - Current analytics strip

import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  CheckCircle,
  AlertTriangle,
  Target,
  BarChart3,
  Search,
  Zap,
} from 'lucide-react';
import type { CompanyStatusSummary } from '@/lib/types/companyStatus';
import type { CompanyAnalyticsSnapshot } from '@/lib/types/companyAnalytics';
import {
  getLifecycleStageLabel,
  getLifecycleStageColorClasses,
  getOverallStatusLabel,
  getOverallStatusColorClasses,
} from '@/lib/types/companyStatus';
import {
  getPipelineStageLabel,
  getPipelineStageColorClasses,
} from '@/lib/types/pipeline';
import {
  formatCompactNumber,
  formatPercentChange,
  getChangeColorClass,
  formatCurrency,
} from '@/lib/types/companyAnalytics';

// ============================================================================
// Types
// ============================================================================

interface StatusSummaryPanelProps {
  status: CompanyStatusSummary;
  analytics: CompanyAnalyticsSnapshot;
  companyName?: string;
}

// ============================================================================
// Helper Components
// ============================================================================

function MetricCard({
  label,
  value,
  change,
  icon: Icon,
  invertColors = false,
}: {
  label: string;
  value: string;
  change?: number | null;
  icon: React.ComponentType<{ className?: string }>;
  invertColors?: boolean;
}) {
  return (
    <div className="bg-slate-800/40 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-bold tabular-nums text-white">{value}</span>
        {change !== null && change !== undefined && (
          <span className={`text-xs font-medium ${getChangeColorClass(change, invertColors)}`}>
            {formatPercentChange(change)}
          </span>
        )}
      </div>
    </div>
  );
}

function SignalItem({
  text,
  type,
}: {
  text: string;
  type: 'positive' | 'negative' | 'neutral';
}) {
  const colorClass =
    type === 'positive'
      ? 'text-emerald-400'
      : type === 'negative'
        ? 'text-red-400'
        : 'text-slate-400';

  const Icon =
    type === 'positive' ? CheckCircle : type === 'negative' ? AlertTriangle : Minus;

  return (
    <li className="flex items-start gap-2 text-xs">
      <Icon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${colorClass}`} />
      <span className="text-slate-300">{text}</span>
    </li>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function StatusSummaryPanel({
  status,
  analytics,
  companyName,
}: StatusSummaryPanelProps) {
  // Build positive signals
  const positiveSignals: string[] = [];
  if (analytics.conversionsChangePct !== null && analytics.conversionsChangePct !== undefined && analytics.conversionsChangePct > 0) {
    positiveSignals.push(`Conversions up ${analytics.conversionsChangePct}% vs prior period`);
  }
  if (analytics.sessionsChangePct !== null && analytics.sessionsChangePct !== undefined && analytics.sessionsChangePct > 0) {
    positiveSignals.push(`Sessions up ${analytics.sessionsChangePct}% vs prior period`);
  }
  if (analytics.organicClicksChangePct !== null && analytics.organicClicksChangePct !== undefined && analytics.organicClicksChangePct > 0) {
    positiveSignals.push(`Organic clicks up ${analytics.organicClicksChangePct}% vs prior period`);
  }
  if (analytics.cplChangePct !== null && analytics.cplChangePct !== undefined && analytics.cplChangePct < 0) {
    positiveSignals.push(`CPL improved ${Math.abs(analytics.cplChangePct)}% vs prior period`);
  }
  if (status.mediaProgramActive) {
    positiveSignals.push('Active media program running');
  }
  if (analytics.trend === 'up') {
    positiveSignals.push('Overall trend is improving');
  }

  // Build negative signals
  const negativeSignals: string[] = [];
  if (analytics.sessionsChangePct !== null && analytics.sessionsChangePct !== undefined && analytics.sessionsChangePct < -10) {
    negativeSignals.push(`Sessions down ${Math.abs(analytics.sessionsChangePct)}% vs prior period`);
  }
  if (analytics.conversionsChangePct !== null && analytics.conversionsChangePct !== undefined && analytics.conversionsChangePct < -10) {
    negativeSignals.push(`Conversions down ${Math.abs(analytics.conversionsChangePct)}% vs prior period`);
  }
  if (analytics.organicClicksChangePct !== null && analytics.organicClicksChangePct !== undefined && analytics.organicClicksChangePct < -10) {
    negativeSignals.push(`Organic clicks down ${Math.abs(analytics.organicClicksChangePct)}% vs prior period`);
  }
  if (analytics.cplChangePct !== null && analytics.cplChangePct !== undefined && analytics.cplChangePct > 10) {
    negativeSignals.push(`CPL increased ${analytics.cplChangePct}% vs prior period`);
  }
  if (status.highSeverityIssuesCount !== undefined && status.highSeverityIssuesCount > 0) {
    negativeSignals.push(`${status.highSeverityIssuesCount} high-severity issue${status.highSeverityIssuesCount > 1 ? 's' : ''} in diagnostics`);
  }
  if (analytics.trend === 'down') {
    negativeSignals.push('Overall trend is declining');
  }

  // Format GAP run date
  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '—';
    }
  };

  // Has analytics data
  const hasAnalyticsData = analytics.hasGa4 || analytics.hasGsc;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      {/* ================================================================== */}
      {/* Header Row: Lifecycle + Overall Status */}
      {/* ================================================================== */}
      <div className="px-5 py-4 border-b border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Left: Lifecycle Stage */}
          <div className="flex items-center gap-3">
            {companyName && (
              <h2 className="text-lg font-semibold text-white">{companyName}</h2>
            )}
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getLifecycleStageColorClasses(status.lifecycleStage)}`}
            >
              {getLifecycleStageLabel(status.lifecycleStage)}
            </span>
          </div>

          {/* Right: Overall Status Pill */}
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium border ${getOverallStatusColorClasses(status.overallStatus)}`}
            >
              {status.overallStatus === 'green' && <CheckCircle className="w-4 h-4 mr-1.5" />}
              {status.overallStatus === 'yellow' && <Minus className="w-4 h-4 mr-1.5" />}
              {status.overallStatus === 'red' && <AlertTriangle className="w-4 h-4 mr-1.5" />}
              {getOverallStatusLabel(status.overallStatus)}
            </span>
          </div>
        </div>

        {/* Status Reason */}
        {status.overallStatusReason && (
          <p className="mt-2 text-xs text-slate-500">{status.overallStatusReason}</p>
        )}
      </div>

      {/* ================================================================== */}
      {/* Three Columns: Where we are / What's working / What's not */}
      {/* ================================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-800">
        {/* Column 1: Where we are */}
        <div className="p-4">
          <h3 className="text-sm font-medium text-slate-200 mb-3 flex items-center gap-2">
            <Target className="w-4 h-4 text-slate-400" />
            Where we are
          </h3>
          <ul className="space-y-2.5 text-xs">
            {/* Pipeline Stage */}
            {status.pipelineStage && (
              <li className="flex items-center justify-between">
                <span className="text-slate-400">Pipeline Stage</span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getPipelineStageColorClasses(status.pipelineStage)}`}
                >
                  {getPipelineStageLabel(status.pipelineStage)}
                </span>
              </li>
            )}

            {/* Lead Source */}
            {status.leadSource && (
              <li className="flex items-center justify-between">
                <span className="text-slate-400">Lead Source</span>
                <span className="text-slate-300">{status.leadSource}</span>
              </li>
            )}

            {/* GAP Score */}
            <li className="flex items-center justify-between">
              <span className="text-slate-400">GAP Score</span>
              <span className="text-slate-300">
                {status.gapScore !== null && status.gapScore !== undefined
                  ? `${status.gapScore}`
                  : '—'}
                {status.gapMaturity && (
                  <span className="text-slate-500 ml-1">({status.gapMaturity})</span>
                )}
              </span>
            </li>

            {/* Last GAP Run */}
            <li className="flex items-center justify-between">
              <span className="text-slate-400">Last GAP Run</span>
              <span className="text-slate-300">{formatDate(status.lastGapRunAt)}</span>
            </li>

            {/* Workup Checklist */}
            {status.checklist && status.checklistTotal && (
              <li className="flex items-center justify-between">
                <span className="text-slate-400">Workup Progress</span>
                <span className="text-slate-300">
                  {status.checklistCompleted ?? 0} / {status.checklistTotal} items
                </span>
              </li>
            )}
          </ul>
        </div>

        {/* Column 2: What's working */}
        <div className="p-4">
          <h3 className="text-sm font-medium text-emerald-400 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            What&apos;s working
          </h3>
          {positiveSignals.length > 0 ? (
            <ul className="space-y-2">
              {positiveSignals.slice(0, 4).map((signal, index) => (
                <SignalItem key={index} text={signal} type="positive" />
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500 italic">
              No major positive trends detected in the last 28 days.
            </p>
          )}
        </div>

        {/* Column 3: What's not working */}
        <div className="p-4">
          <h3 className="text-sm font-medium text-red-400 mb-3 flex items-center gap-2">
            <TrendingDown className="w-4 h-4" />
            What&apos;s not working
          </h3>
          {negativeSignals.length > 0 ? (
            <ul className="space-y-2">
              {negativeSignals.slice(0, 4).map((signal, index) => (
                <SignalItem key={index} text={signal} type="negative" />
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500 italic">
              No major negative trends detected in the last 28 days.
            </p>
          )}
        </div>
      </div>

      {/* ================================================================== */}
      {/* Analytics Strip */}
      {/* ================================================================== */}
      <div className="border-t border-slate-800 px-4 py-3 bg-slate-900/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-medium text-slate-300">
              Current Analytics
            </span>
            <span className="text-[10px] text-slate-500">
              (last 7 days vs prior period)
            </span>
          </div>

          {!hasAnalyticsData && (
            <Link
              href={`/c/${status.companyId}/brain/setup?step=9`}
              className="text-xs text-cyan-400 hover:text-cyan-300"
            >
              Connect integrations
            </Link>
          )}
        </div>

        {hasAnalyticsData ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {/* Sessions */}
            {analytics.hasGa4 && (
              <MetricCard
                label="Sessions"
                value={formatCompactNumber(analytics.sessions)}
                change={analytics.sessionsChangePct}
                icon={Zap}
              />
            )}

            {/* Conversions */}
            {analytics.hasGa4 && (
              <MetricCard
                label="Conversions"
                value={formatCompactNumber(analytics.conversions)}
                change={analytics.conversionsChangePct}
                icon={CheckCircle}
              />
            )}

            {/* Conversion Rate */}
            {analytics.hasGa4 && analytics.conversionRate !== null && (
              <MetricCard
                label="Conv Rate"
                value={`${analytics.conversionRate}%`}
                icon={BarChart3}
              />
            )}

            {/* Organic Clicks */}
            {analytics.hasGsc && (
              <MetricCard
                label="SEO Clicks"
                value={formatCompactNumber(analytics.organicClicks)}
                change={analytics.organicClicksChangePct}
                icon={Search}
              />
            )}

            {/* CPL (if available) */}
            {analytics.cpl !== null && analytics.cpl !== undefined && (
              <MetricCard
                label="CPL"
                value={formatCurrency(analytics.cpl)}
                change={analytics.cplChangePct}
                icon={BarChart3}
                invertColors
              />
            )}

            {/* ROAS (if available) */}
            {analytics.roas !== null && analytics.roas !== undefined && (
              <MetricCard
                label="ROAS"
                value={`${analytics.roas.toFixed(1)}x`}
                icon={TrendingUp}
              />
            )}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-xs text-slate-500">
              Connect GA4 and Search Console to see analytics data.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default StatusSummaryPanel;
