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
  Focus,
  Sparkles,
} from 'lucide-react';
import { RefreshAnalyticsFindingsButton } from '@/components/os/RefreshAnalyticsFindingsButton';
import type { CompanyStatusSummary } from '@/lib/types/companyStatus';
import type { CompanyAnalyticsSnapshot } from '@/lib/types/companyAnalytics';
import type { CompanyStatusNarrative } from '@/lib/types/companyNarrative';
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
import type { DiagnosticDetailFinding } from '@/lib/airtable/diagnosticDetails';

// ============================================================================
// Types
// ============================================================================

interface StatusSummaryPanelProps {
  status: CompanyStatusSummary;
  analytics: CompanyAnalyticsSnapshot;
  companyName?: string;
  /** AI-generated narrative (optional - falls back to computed signals if not provided) */
  narrative?: CompanyStatusNarrative;
  /** Analytics-specific findings to display (optional - shows in "What's not working" section) */
  analyticsFindings?: DiagnosticDetailFinding[];
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
  narrative,
  analyticsFindings,
}: StatusSummaryPanelProps) {
  // Use AI narrative if provided, otherwise compute signals from analytics
  const useAiNarrative = narrative && narrative.isAiGenerated;

  // Build positive signals (fallback when no AI narrative)
  const computedPositiveSignals: string[] = [];
  if (!useAiNarrative) {
    if (analytics.conversionsChangePct !== null && analytics.conversionsChangePct !== undefined && analytics.conversionsChangePct > 0) {
      computedPositiveSignals.push(`Conversions up ${analytics.conversionsChangePct}% vs prior period`);
    }
    if (analytics.sessionsChangePct !== null && analytics.sessionsChangePct !== undefined && analytics.sessionsChangePct > 0) {
      computedPositiveSignals.push(`Sessions up ${analytics.sessionsChangePct}% vs prior period`);
    }
    if (analytics.organicClicksChangePct !== null && analytics.organicClicksChangePct !== undefined && analytics.organicClicksChangePct > 0) {
      computedPositiveSignals.push(`Organic clicks up ${analytics.organicClicksChangePct}% vs prior period`);
    }
    if (analytics.cplChangePct !== null && analytics.cplChangePct !== undefined && analytics.cplChangePct < 0) {
      computedPositiveSignals.push(`CPL improved ${Math.abs(analytics.cplChangePct)}% vs prior period`);
    }
    if (status.mediaProgramActive) {
      computedPositiveSignals.push('Active media program running');
    }
    if (analytics.trend === 'up') {
      computedPositiveSignals.push('Overall trend is improving');
    }
  }

  // Build negative signals (fallback when no AI narrative)
  const computedNegativeSignals: string[] = [];
  if (!useAiNarrative) {
    if (analytics.sessionsChangePct !== null && analytics.sessionsChangePct !== undefined && analytics.sessionsChangePct < -10) {
      computedNegativeSignals.push(`Sessions down ${Math.abs(analytics.sessionsChangePct)}% vs prior period`);
    }
    if (analytics.conversionsChangePct !== null && analytics.conversionsChangePct !== undefined && analytics.conversionsChangePct < -10) {
      computedNegativeSignals.push(`Conversions down ${Math.abs(analytics.conversionsChangePct)}% vs prior period`);
    }
    if (analytics.organicClicksChangePct !== null && analytics.organicClicksChangePct !== undefined && analytics.organicClicksChangePct < -10) {
      computedNegativeSignals.push(`Organic clicks down ${Math.abs(analytics.organicClicksChangePct)}% vs prior period`);
    }
    if (analytics.cplChangePct !== null && analytics.cplChangePct !== undefined && analytics.cplChangePct > 10) {
      computedNegativeSignals.push(`CPL increased ${analytics.cplChangePct}% vs prior period`);
    }
    if (status.highSeverityIssuesCount !== undefined && status.highSeverityIssuesCount > 0) {
      computedNegativeSignals.push(`${status.highSeverityIssuesCount} high-severity issue${status.highSeverityIssuesCount > 1 ? 's' : ''} in diagnostics`);
    }
    if (analytics.trend === 'down') {
      computedNegativeSignals.push('Overall trend is declining');
    }
  }

  // Final signals: use AI narrative if available, otherwise computed
  const positiveSignals = useAiNarrative ? narrative.whatsWorking : computedPositiveSignals;
  const negativeSignals = useAiNarrative ? narrative.whatsNotWorking : computedNegativeSignals;

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

  // Has analytics data - use the unified hasAnalytics field
  const hasAnalyticsData = analytics.hasAnalytics;

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

        {/* AI Summary or Status Reason */}
        {useAiNarrative && narrative.summary ? (
          <p className="mt-2 text-sm text-slate-300">{narrative.summary}</p>
        ) : status.overallStatusReason ? (
          <p className="mt-2 text-xs text-slate-500">{status.overallStatusReason}</p>
        ) : null}
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

          {/* Analytics Issues Subsection */}
          {analyticsFindings && analyticsFindings.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-700/50">
              <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-1.5">
                <Activity className="w-3 h-3" />
                Analytics Issues
              </div>
              <ul className="space-y-1.5">
                {analyticsFindings.map((finding) => (
                  <li key={finding.id || finding.issueKey} className="flex items-start gap-2 text-xs">
                    <span
                      className={`inline-flex h-1.5 w-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                        finding.severity === 'high' || finding.severity === 'critical'
                          ? 'bg-red-500'
                          : 'bg-amber-400'
                      }`}
                    />
                    <span className="text-slate-300">{finding.description || 'Untitled finding'}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* ================================================================== */}
      {/* Priority Focus (AI-driven, only shown when narrative is available) */}
      {/* ================================================================== */}
      {useAiNarrative && narrative.priorityFocus && narrative.priorityFocus.length > 0 && (
        <div className="border-t border-slate-800 px-4 py-3 bg-gradient-to-r from-cyan-900/10 to-blue-900/10">
          <div className="flex items-center gap-2 mb-3">
            <Focus className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-medium text-slate-200">Priority Focus</span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Sparkles className="w-2.5 h-2.5" />
              AI
            </span>
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {narrative.priorityFocus.slice(0, 5).map((focus, index) => (
              <li
                key={index}
                className="flex items-start gap-2 text-xs bg-slate-800/30 rounded-lg px-3 py-2"
              >
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[10px] font-bold">
                  {index + 1}
                </span>
                <span className="text-slate-300">{focus}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

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

          <div className="flex items-center gap-3">
            {hasAnalyticsData && (
              <RefreshAnalyticsFindingsButton
                companyId={status.companyId}
                size="sm"
              />
            )}
            {!hasAnalyticsData && (
              <Link
                href={`/c/${status.companyId}/brain/setup?step=9`}
                className="text-xs text-cyan-400 hover:text-cyan-300"
              >
                Connect integrations
              </Link>
            )}
          </div>
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
              {analytics.analyticsStatusMessage || 'Connect GA4 and Search Console to see analytics data.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default StatusSummaryPanel;
