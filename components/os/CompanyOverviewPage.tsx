'use client';

// components/os/CompanyOverviewPage.tsx
// Strategic Overview Dashboard for a Company
//
// This is the main landing page when viewing a company in Hive OS.
// It surfaces the company's Strategic Snapshot (scores, focus areas, 90-day plan),
// Score Trends with deltas, Performance Pulse, and recent diagnostic activity.
//
// MEDIA PROGRAM: Includes conditional media card based on company.hasMediaProgram

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import QuickHealthCheckCard from './QuickHealthCheckCard';
import { CompanyActivityTimeline } from './CompanyActivityTimeline';
import { MediaEmptyStateCompact } from './media';
import ContextHealthCard from './ContextHealthCard';
import type { CompanyStrategicSnapshot } from '@/lib/airtable/companyStrategySnapshot';
import type { DiagnosticRunStatus, DiagnosticToolId, CompanyScoreTrends } from '@/lib/os/diagnostics/runs';
import type { CompanyWorkSummary } from '@/lib/os/companies/workSummary';
import type { CompanyAlert, AlertSeverity } from '@/lib/os/companies/alerts';
import type { PerformancePulse } from '@/lib/os/analytics/performancePulse';
import type { MediaLabSummary } from '@/lib/types/mediaLab';
import { COMPANY_MEDIA_STATUS_CONFIG, formatMediaBudget, getObjectiveLabel } from '@/lib/types/mediaLab';
import { deriveNextBestAction, getPriorityColorClasses, type NextBestAction } from '@/lib/os/companies/nextBestAction';
import type { CompanySummary } from '@/lib/os/companySummary';
import {
  type SetupStatus,
  SETUP_STATUS_CONFIG,
  parseSetupStatus,
  getQuarterFromDate,
} from '@/lib/types/company';

// ============================================================================
// Types
// ============================================================================

interface CompanyData {
  id: string;
  name: string;
  website?: string | null;
  industry?: string | null;
  stage?: string | null;
  companyType?: string | null;
  sizeBand?: string | null;
  owner?: string | null;
  hasMediaProgram?: boolean;
  // Setup & QBR status fields
  setupStatus?: SetupStatus | string | null;
  lastSetupAt?: string | null;
  lastQbrAt?: string | null;
}

interface RecentDiagnostic {
  id: string;
  toolId: DiagnosticToolId;
  toolLabel: string;
  status: DiagnosticRunStatus;
  score: number | null;
  completedAt?: string | null;
  reportPath?: string | null;
}

// Focus areas with priority for enhanced display
export interface FocusAreaWithPriority {
  label: string;
  priority: 'High' | 'Medium' | 'Low';
}

export interface CompanyOverviewPageProps {
  company: CompanyData;
  strategySnapshot: CompanyStrategicSnapshot | null;
  recentDiagnostics: RecentDiagnostic[];
  workSummary: CompanyWorkSummary;
  scoreTrends: CompanyScoreTrends;
  alerts: CompanyAlert[];
  performancePulse?: PerformancePulse | null;
  mediaLabSummary?: MediaLabSummary | null;

  // New: unified data model (when provided, takes precedence for common values)
  summary?: CompanySummary;

  // Baseline status for orchestrator toggle
  baselineStatus?: {
    initialized: boolean;
    initializedAt: string | null;
    healthScore?: number;
    completeness?: number;
  } | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getScoreColor(score: number | null): string {
  if (score === null) return 'text-slate-400';
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-amber-400';
  return 'text-red-400';
}

function getScoreBgColor(score: number | null): string {
  if (score === null) return 'bg-slate-500/20';
  if (score >= 80) return 'bg-emerald-500/20';
  if (score >= 60) return 'bg-amber-500/20';
  return 'bg-red-500/20';
}

function getMaturityStageStyle(stage: string | undefined): string {
  switch (stage) {
    case 'World-Class':
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    case 'Advanced':
      return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    case 'Good':
      return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    case 'Developing':
      return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
    case 'Basic':
    default:
      return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
  }
}

function getAlertSeverityStyle(severity: AlertSeverity): { bg: string; text: string; icon: string; headerBg: string } {
  switch (severity) {
    case 'critical':
      return { bg: 'bg-red-500/10', text: 'text-red-300', icon: 'text-red-400', headerBg: 'bg-red-500/20' };
    case 'warning':
      return { bg: 'bg-amber-500/10', text: 'text-amber-300', icon: 'text-amber-400', headerBg: 'bg-amber-500/20' };
    case 'info':
    default:
      return { bg: 'bg-blue-500/10', text: 'text-blue-300', icon: 'text-blue-400', headerBg: 'bg-blue-500/20' };
  }
}

function getWorkStatusStyle(status: string): string {
  switch (status) {
    case 'In Progress':
      return 'bg-amber-500/20 text-amber-300';
    case 'Planned':
      return 'bg-blue-500/20 text-blue-300';
    case 'Backlog':
    default:
      return 'bg-slate-500/20 text-slate-400';
  }
}

function getPriorityStyle(priority: 'High' | 'Medium' | 'Low'): string {
  switch (priority) {
    case 'High':
      return 'bg-red-500/20 text-red-300 border-red-500/30';
    case 'Medium':
      return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    case 'Low':
      return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  }
}

function getScoreDelta(current: number | null, previous: number | null): { delta: number; direction: 'up' | 'down' | 'same' } | null {
  if (current === null || previous === null) return null;
  const delta = current - previous;
  if (delta === 0) return { delta: 0, direction: 'same' };
  return { delta, direction: delta > 0 ? 'up' : 'down' };
}

function getStatusBadgeStyle(status: DiagnosticRunStatus): string {
  switch (status) {
    case 'complete':
      return 'bg-emerald-500/20 text-emerald-300';
    case 'running':
      return 'bg-amber-500/20 text-amber-300';
    case 'failed':
      return 'bg-red-500/20 text-red-300';
    case 'pending':
    default:
      return 'bg-slate-500/20 text-slate-400';
  }
}

function getStatusLabel(status: DiagnosticRunStatus): string {
  switch (status) {
    case 'complete':
      return 'Complete';
    case 'running':
      return 'Running';
    case 'failed':
      return 'Failed';
    case 'pending':
    default:
      return 'Pending';
  }
}

function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return '';
  }
}

// Derive focus area priority based on scores and content
function deriveFocusAreaPriority(
  area: string,
  overallScore: number | null
): 'High' | 'Medium' | 'Low' {
  const lowerArea = area.toLowerCase();

  // Website/UX related - high priority if overall score is low
  if (lowerArea.includes('website') || lowerArea.includes('ux') || lowerArea.includes('conversion')) {
    return overallScore !== null && overallScore < 50 ? 'High' : 'Medium';
  }

  // SEO related
  if (lowerArea.includes('seo') || lowerArea.includes('search') || lowerArea.includes('traffic')) {
    return overallScore !== null && overallScore < 50 ? 'High' : 'Medium';
  }

  // Brand related
  if (lowerArea.includes('brand') || lowerArea.includes('identity') || lowerArea.includes('messaging')) {
    return overallScore !== null && overallScore < 60 ? 'High' : 'Medium';
  }

  // Analytics/tracking
  if (lowerArea.includes('analytics') || lowerArea.includes('tracking') || lowerArea.includes('measurement')) {
    return 'Medium';
  }

  // Content
  if (lowerArea.includes('content') || lowerArea.includes('blog')) {
    return 'Medium';
  }

  return 'Low';
}

// ============================================================================
// Sub-Components
// ============================================================================

// Performance Pulse Card
function PerformancePulseCard({ pulse }: { pulse: PerformancePulse | null | undefined }) {
  // Has data if we have any raw values OR any change percentages
  const hasData = pulse && (
    pulse.trafficChange7d !== null ||
    pulse.conversionsChange7d !== null ||
    pulse.seoVisibilityChange7d !== null ||
    pulse.currentSessions !== null ||
    pulse.currentClicks !== null
  );

  const getChangeColor = (value: number | null) => {
    if (value === null) return 'text-slate-400';
    if (value > 0) return 'text-emerald-400';
    if (value < 0) return 'text-red-400';
    return 'text-slate-400';
  };

  const getChangeArrow = (value: number | null) => {
    if (value === null || value === 0) return '—';
    return value > 0 ? '▲' : '▼';
  };

  const formatChange = (value: number | null) => {
    if (value === null) return '—';
    if (value === 0) return '0%';
    return value > 0 ? `+${value}%` : `${value}%`;
  };

  // Format raw value with optional change
  const formatMetric = (current: number | null, change: number | null) => {
    if (current === null && change === null) return '—';
    if (change !== null) {
      return `${getChangeArrow(change)} ${formatChange(change)}`;
    }
    // Show raw value if we have current but no change
    return current?.toLocaleString() ?? '—';
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">
        Performance Pulse (7 days)
      </h2>

      {hasData ? (
        <div className="space-y-3">
          {/* Traffic */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Traffic</span>
            <div className="flex items-center gap-2">
              {pulse!.currentSessions !== null && pulse!.trafficChange7d === null && (
                <span className="text-xs text-slate-500">{pulse!.currentSessions.toLocaleString()} sessions</span>
              )}
              <span className={`text-sm font-medium ${getChangeColor(pulse!.trafficChange7d)}`}>
                {pulse!.trafficChange7d !== null
                  ? `${getChangeArrow(pulse!.trafficChange7d)} ${formatChange(pulse!.trafficChange7d)}`
                  : pulse!.currentSessions !== null ? '' : '—'
                }
              </span>
            </div>
          </div>

          {/* Conversions */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Conversions</span>
            <div className="flex items-center gap-2">
              {pulse!.currentConversions !== null && pulse!.conversionsChange7d === null && (
                <span className="text-xs text-slate-500">{pulse!.currentConversions.toLocaleString()}</span>
              )}
              <span className={`text-sm font-medium ${getChangeColor(pulse!.conversionsChange7d)}`}>
                {pulse!.conversionsChange7d !== null
                  ? `${getChangeArrow(pulse!.conversionsChange7d)} ${formatChange(pulse!.conversionsChange7d)}`
                  : pulse!.currentConversions !== null ? '' : '—'
                }
              </span>
            </div>
          </div>

          {/* SEO Visibility */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">SEO Visibility</span>
            <div className="flex items-center gap-2">
              {pulse!.currentClicks !== null && (
                <span className="text-xs text-slate-500">{pulse!.currentClicks.toLocaleString()} clicks</span>
              )}
              {pulse!.seoVisibilityChange7d !== null && pulse!.seoVisibilityChange7d !== 0 && (
                <span className={`text-sm font-medium ${getChangeColor(pulse!.seoVisibilityChange7d)}`}>
                  {getChangeArrow(pulse!.seoVisibilityChange7d)} {formatChange(pulse!.seoVisibilityChange7d)}
                </span>
              )}
            </div>
          </div>

          {/* Anomaly Warning */}
          {pulse!.hasAnomalies && pulse!.anomalySummary && (
            <div className="mt-3 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-xs text-amber-300">{pulse!.anomalySummary}</p>
              </div>
            </div>
          )}

          <p className="text-xs text-slate-500 pt-2 border-t border-slate-800">
            {(pulse!.trafficChange7d !== null || pulse!.seoVisibilityChange7d !== null)
              ? 'Week-over-week changes'
              : 'Current 7-day period'
            }
          </p>
        </div>
      ) : (
        <div className="text-center py-4">
          <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-2">
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-sm text-slate-300">Analytics not connected</p>
          <p className="text-xs text-slate-500 mt-1">
            {pulse?.hasGa4 === false && pulse?.hasGsc === false
              ? 'Connect Google Analytics or Search Console in Settings to see performance data.'
              : 'Waiting for data to accumulate. Check back in 24 hours.'
            }
          </p>
        </div>
      )}
    </div>
  );
}

// Grouped Alerts Card
function GroupedAlertsCard({ alerts, companyId }: { alerts: CompanyAlert[]; companyId: string }) {
  const criticalAlerts = alerts.filter(a => a.severity === 'critical');
  const warningAlerts = alerts.filter(a => a.severity === 'warning');
  const infoAlerts = alerts.filter(a => a.severity === 'info');

  const hasAlerts = alerts.length > 0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">
        Alerts & Issues
      </h2>

      {hasAlerts ? (
        <div className="space-y-4">
          {/* Critical Issues */}
          {criticalAlerts.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-red-400" />
                <h3 className="text-xs font-semibold text-red-300 uppercase tracking-wide">
                  Critical Issues ({criticalAlerts.length})
                </h3>
              </div>
              <div className="space-y-2">
                {criticalAlerts.map((alert) => (
                  <AlertItem key={alert.id} alert={alert} />
                ))}
              </div>
            </div>
          )}

          {/* Warnings */}
          {warningAlerts.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-amber-400" />
                <h3 className="text-xs font-semibold text-amber-300 uppercase tracking-wide">
                  Warnings ({warningAlerts.length})
                </h3>
              </div>
              <div className="space-y-2">
                {warningAlerts.map((alert) => (
                  <AlertItem key={alert.id} alert={alert} />
                ))}
              </div>
            </div>
          )}

          {/* Info */}
          {infoAlerts.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-blue-400" />
                <h3 className="text-xs font-semibold text-blue-300 uppercase tracking-wide">
                  Info ({infoAlerts.length})
                </h3>
              </div>
              <div className="space-y-2">
                {infoAlerts.map((alert) => (
                  <AlertItem key={alert.id} alert={alert} />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-6">
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-2">
            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm text-slate-300">No active alerts</p>
          <p className="text-xs text-slate-500 mt-1">Systems look stable.</p>
        </div>
      )}
    </div>
  );
}

// Single Alert Item
function AlertItem({ alert }: { alert: CompanyAlert }) {
  const styles = getAlertSeverityStyle(alert.severity);

  return (
    <div className={`flex items-start gap-3 p-2.5 rounded-lg ${styles.bg} border border-slate-700/50`}>
      <div className={`flex-shrink-0 mt-0.5 ${styles.icon}`}>
        {alert.severity === 'critical' ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        ) : alert.severity === 'warning' ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`text-sm font-medium ${styles.text}`}>
            {alert.title}
          </span>
          <span className="px-1.5 py-0.5 rounded text-xs bg-slate-700/50 text-slate-400">
            {alert.source}
          </span>
          {alert.createdAt && (
            <span className="text-xs text-slate-500">
              {formatRelativeTime(alert.createdAt)}
            </span>
          )}
        </div>
        {alert.description && (
          <p className="text-xs text-slate-400 line-clamp-1">
            {alert.description}
          </p>
        )}
      </div>

      {alert.linkPath && (
        <Link
          href={alert.linkPath}
          className="flex-shrink-0 text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          View
        </Link>
      )}
    </div>
  );
}

// ============================================================================
// Setup & QBR Cards
// ============================================================================

// Strategic Setup Card
function StrategicSetupCard({
  companyId,
  setupStatus,
  lastSetupAt,
}: {
  companyId: string;
  setupStatus: SetupStatus;
  lastSetupAt?: string | null;
}) {
  const config = SETUP_STATUS_CONFIG[setupStatus];

  const getStatusPillClasses = () => {
    switch (setupStatus) {
      case 'completed':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'in_progress':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'not_started':
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const getButtonText = () => {
    switch (setupStatus) {
      case 'completed':
        return 'View Setup Summary';
      case 'in_progress':
        return 'Continue Setup';
      case 'not_started':
      default:
        return 'Start Setup';
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Strategic Setup</h3>
          <p className="text-xs text-slate-500 mt-0.5">Initial strategy & plan for this company</p>
        </div>
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getStatusPillClasses()}`}>
          {config.label}
        </span>
      </div>

      {lastSetupAt && (
        <p className="text-xs text-slate-500 mb-3">
          Last updated: {formatDistanceToNow(new Date(lastSetupAt), { addSuffix: true })}
        </p>
      )}

      <Link
        href={`/c/${companyId}/setup`}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/20 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        {getButtonText()}
      </Link>
    </div>
  );
}

// QBR Card
function QbrCard({
  companyId,
  lastQbrAt,
}: {
  companyId: string;
  lastQbrAt?: string | null;
}) {
  const quarterLabel = getQuarterFromDate(lastQbrAt);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Quarterly Review</h3>
          <p className="text-xs text-slate-500 mt-0.5">Review performance and update the plan</p>
        </div>
      </div>

      <p className="text-xs text-slate-500 mb-3">
        {quarterLabel ? (
          <>Last QBR: <span className="text-slate-300">{quarterLabel}</span></>
        ) : (
          'No QBRs yet'
        )}
      </p>

      <Link
        href={`/c/${companyId}/qbr`}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-violet-500/10 text-violet-400 border border-violet-500/30 hover:bg-violet-500/20 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        {quarterLabel ? 'View Latest QBR' : 'Start QBR'}
      </Link>
    </div>
  );
}

// Incomplete Setup Banner
function IncompleteSetupBanner({ companyId }: { companyId: string }) {
  return (
    <div className="rounded-xl p-4 border border-cyan-500/30 bg-cyan-500/5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-cyan-300">Strategic Setup not completed</p>
            <p className="text-xs text-slate-400">Complete Setup Mode to initialize this company's strategy and context.</p>
          </div>
        </div>
        <Link
          href={`/c/${companyId}/setup`}
          className="flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors"
        >
          Complete Setup
        </Link>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function CompanyOverviewPage({
  company,
  strategySnapshot,
  recentDiagnostics,
  workSummary,
  scoreTrends,
  alerts,
  performancePulse,
  mediaLabSummary,
  summary,
  baselineStatus,
}: CompanyOverviewPageProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Setup completion toast
  const [showSetupToast, setShowSetupToast] = useState(false);
  const [setupWorkItems, setSetupWorkItems] = useState(0);
  const [isRunningBaseline, setIsRunningBaseline] = useState(false);
  const [baselineMessage, setBaselineMessage] = useState<string | null>(null);
  const alreadyInitialized = baselineStatus?.initialized ?? false;

  useEffect(() => {
    if (searchParams.get('setup') === 'complete') {
      setShowSetupToast(true);
      setSetupWorkItems(parseInt(searchParams.get('workItems') || '0', 10));

      // Clear the URL params after showing toast
      const url = new URL(window.location.href);
      url.searchParams.delete('setup');
      url.searchParams.delete('workItems');
      router.replace(url.pathname, { scroll: false });

      // Auto-hide toast after 5 seconds
      const timer = setTimeout(() => setShowSetupToast(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [searchParams, router]);

  const runBaselineOrchestrator = async () => {
    if (isRunningBaseline || alreadyInitialized) return;
    setIsRunningBaseline(true);
    setBaselineMessage(null);
    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/context/baseline`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ force: true }),
        }
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setBaselineMessage(body.error || 'Failed to start orchestrator');
      } else {
        setBaselineMessage('Baseline orchestrator kicked off. This may take a couple minutes.');
        router.refresh();
      }
    } catch (e) {
      setBaselineMessage('Failed to start orchestrator. Please try again.');
    } finally {
      setIsRunningBaseline(false);
    }
  };

  // When summary is provided, prefer its values for common fields
  const companyId = summary?.companyId ?? company.id;
  const companyName = summary?.meta.name ?? company.name;
  const companyWebsite = summary?.meta.url ?? company.website;
  const companyIndustry = company.industry; // Keep from company prop (not in summary)
  const companyStage = summary?.meta.stage ?? company.stage;
  const healthTag = summary?.meta.healthTag;
  const hasMediaProgram = summary?.media.hasMediaProgram ?? company.hasMediaProgram;

  // Prefer summary scores when available
  const overallScore = summary?.scores.latestBlueprintScore ??
    strategySnapshot?.overallScore ?? null;
  const maturityStage = summary?.scores.maturityStage ??
    strategySnapshot?.maturityStage;

  const hasSnapshot = !!strategySnapshot;
  const hasDiagnostics = recentDiagnostics.length > 0;
  const hasActiveWork = workSummary.active.length > 0 || workSummary.doneRecently.length > 0;

  // Calculate score deltas from trends
  const getLatestDelta = (trendData: typeof scoreTrends.overall) => {
    if (trendData.length < 2) return null;
    const sorted = [...trendData].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return getScoreDelta(sorted[0]?.score ?? null, sorted[1]?.score ?? null);
  };

  const overallDelta = getLatestDelta(scoreTrends.overall);
  const websiteDelta = getLatestDelta(scoreTrends.website);
  const brandDelta = getLatestDelta(scoreTrends.brand);

  // Derive focus areas with priorities
  const focusAreasWithPriority: FocusAreaWithPriority[] = (strategySnapshot?.focusAreas || [])
    .slice(0, 5)
    .map((area) => ({
      label: area,
      priority: deriveFocusAreaPriority(area, strategySnapshot?.overallScore ?? null),
    }))
    .sort((a, b) => {
      const order = { High: 0, Medium: 1, Low: 2 };
      return order[a.priority] - order[b.priority];
    });

  // Derive next best action
  const nextBestAction = deriveNextBestAction(companyId, {
    alerts,
    snapshot: strategySnapshot,
  });
  const nextBestActionColors = getPriorityColorClasses(nextBestAction.priority);

  // Derive headline recommendation (use snapshot field or derive from top focus area)
  const headlineRecommendation = strategySnapshot?.headlineRecommendation
    || (strategySnapshot?.focusAreas?.[0]
      ? `Top Priority: ${strategySnapshot.focusAreas[0]}`
      : null);

  // Setup & QBR status (with safe defaults)
  const setupStatus = parseSetupStatus(company.setupStatus as string | undefined);
  const lastSetupAt = company.lastSetupAt ?? null;
  const lastQbrAt = company.lastQbrAt ?? null;
  const isSetupComplete = setupStatus === 'completed';

  return (
    <div className="space-y-6">
      {/* Setup Complete Toast */}
      {showSetupToast && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 fade-in duration-300">
          <div className="bg-emerald-500/90 backdrop-blur-sm text-white px-5 py-3 rounded-lg shadow-lg flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <div className="font-medium">Strategic Setup Complete!</div>
              {setupWorkItems > 0 && (
                <div className="text-sm text-emerald-100">
                  {setupWorkItems} work item{setupWorkItems !== 1 ? 's' : ''} created
                </div>
              )}
            </div>
            <button
              onClick={() => setShowSetupToast(false)}
              className="ml-2 text-white/70 hover:text-white"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* Incomplete Setup Banner (shown when setup is not completed) */}
      {/* ================================================================== */}
      {!isSetupComplete && (
        <IncompleteSetupBanner companyId={companyId} />
      )}

      {/* ================================================================== */}
      {/* Header Band: Company Info + Quick Health Check */}
      {/* ================================================================== */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          {/* Left: Company Info */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-slate-100">
                {companyName}
              </h1>
              {healthTag && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                  healthTag === 'Healthy'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : healthTag === 'At Risk'
                    ? 'bg-red-500/10 text-red-400 border-red-500/30'
                    : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                }`}>
                  {healthTag}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400">
              {companyWebsite && (
                <a
                  href={companyWebsite.startsWith('http') ? companyWebsite : `https://${companyWebsite}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {companyWebsite.replace(/^https?:\/\//, '')}
                </a>
              )}
              {companyIndustry && (
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-xs">
                  {companyIndustry}
                </span>
              )}
              {companyStage && (
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-xs">
                  {companyStage}
                </span>
              )}
              {company.sizeBand && (
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-xs">
                  {company.sizeBand}
                </span>
              )}
            </div>
            {company.owner && (
              <p className="text-xs text-slate-500 mt-2">
                Owner: {company.owner}
              </p>
            )}
          </div>

          {/* Right: Quick Health Check */}
          <div className="w-full lg:w-80">
            <QuickHealthCheckCard
              companyId={companyId}
              companyName={companyName}
            />
          </div>
        </div>
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-800 text-slate-300">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </span>
            <span>Run the full baseline orchestrator for this company.</span>
          </div>
          <div className="flex items-center gap-3">
            {baselineMessage && (
              <span className="text-xs text-slate-400">
                {baselineMessage}
              </span>
            )}
            <button
              onClick={runBaselineOrchestrator}
              disabled={isRunningBaseline || alreadyInitialized}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-500/90 text-white hover:bg-emerald-400 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isRunningBaseline ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Starting...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {alreadyInitialized ? 'Already Ran' : 'Run Orchestrator'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* Next Best Action */}
      {/* ================================================================== */}
      <div className={`rounded-xl p-4 border ${nextBestActionColors.bg} ${nextBestActionColors.border}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${nextBestActionColors.bg}`}>
              <svg className={`w-5 h-5 ${nextBestActionColors.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Next Best Action</p>
              <p className={`text-sm font-medium ${nextBestActionColors.text}`}>{nextBestAction.action}</p>
              <p className="text-xs text-slate-500 mt-0.5">{nextBestAction.reason}</p>
            </div>
          </div>
          {nextBestAction.linkPath && (
            <Link
              href={nextBestAction.linkPath}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${nextBestActionColors.bg} ${nextBestActionColors.text} hover:opacity-80`}
            >
              Go
            </Link>
          )}
        </div>
      </div>

      {/* ================================================================== */}
      {/* CTA: Go to Blueprint for Full Strategy */}
      {/* ================================================================== */}
      <Link
        href={`/c/${companyId}/blueprint`}
        className="block bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl p-4 hover:border-amber-500/50 transition-colors group"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-300">Open Blueprint</p>
              <p className="text-xs text-slate-400">Full strategy, tools, analytics & insights</p>
            </div>
          </div>
          <svg className="w-5 h-5 text-amber-400 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </Link>

      {/* ================================================================== */}
      {/* Band 1: Strategic Snapshot + Score Trends + Performance Pulse */}
      {/* ================================================================== */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Strategic Snapshot (2/3 width on xl) */}
        <div className="xl:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">
            Strategic Snapshot
          </h2>

          {hasSnapshot ? (
            <div className="space-y-4">
              {/* Headline Recommendation */}
              {headlineRecommendation && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <p className="text-sm text-blue-200 font-medium">{headlineRecommendation}</p>
                </div>
              )}

              <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                {/* Overall Score */}
                <div className="flex items-center gap-6">
                  {overallScore !== null && (
                    <div className="text-center">
                      <div
                        className={`text-5xl font-bold tabular-nums ${getScoreColor(overallScore)}`}
                      >
                        {overallScore}
                      </div>
                      <p className="text-xs text-slate-500 uppercase tracking-wide mt-1">
                        Overall Score
                      </p>
                    </div>
                  )}

                  {/* Maturity Stage Badge */}
                  {maturityStage && (
                    <div className="text-center">
                      <span
                        className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium border ${getMaturityStageStyle(maturityStage)}`}
                      >
                        {maturityStage}
                      </span>
                      <p className="text-xs text-slate-500 uppercase tracking-wide mt-2">
                        Maturity Stage
                      </p>
                    </div>
                  )}
                </div>

                {/* Summary Line */}
                <div className="flex-1 lg:pl-6 lg:border-l lg:border-slate-800">
                  {strategySnapshot.focusAreas && strategySnapshot.focusAreas.length > 0 ? (
                    <p className="text-sm text-slate-300 leading-relaxed">
                      <span className="text-slate-100 font-medium">
                        {strategySnapshot.focusAreas.slice(0, 3).join(', ')}
                      </span>{' '}
                      over the next 90 days.
                    </p>
                  ) : (
                    <p className="text-sm text-slate-400">
                      Run more diagnostics to generate strategic focus areas.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-slate-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <h3 className="text-sm font-medium text-slate-200 mb-2">
                No Strategic Snapshot Yet
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Run GAP or Website Lab diagnostics to generate a strategic snapshot with
                scores, focus areas, and a 90-day plan.
              </p>
            </div>
          )}
        </div>

        {/* Score Trends + Performance Pulse (1/3 width, stacked) */}
        <div className="space-y-6">
          {/* Score Trends Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">
              Score Trends
            </h2>

            {(scoreTrends.overall.length > 0 || scoreTrends.website.length > 0 || scoreTrends.brand.length > 0) ? (
              <div className="space-y-3">
                {/* Overall/GAP Trend */}
                {scoreTrends.overall.length > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">Overall</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-lg font-semibold tabular-nums ${getScoreColor(scoreTrends.overall[scoreTrends.overall.length - 1]?.score ?? null)}`}>
                        {scoreTrends.overall[scoreTrends.overall.length - 1]?.score ?? '-'}
                      </span>
                      {overallDelta && (
                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium ${
                          overallDelta.direction === 'up'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : overallDelta.direction === 'down'
                            ? 'bg-red-500/20 text-red-300'
                            : 'bg-slate-500/20 text-slate-400'
                        }`}>
                          {overallDelta.direction === 'up' ? '▲' : overallDelta.direction === 'down' ? '▼' : '—'}
                          {overallDelta.direction !== 'same' && (
                            <span>{overallDelta.direction === 'up' ? '+' : ''}{overallDelta.delta}</span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Website Trend */}
                {scoreTrends.website.length > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">Website</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-lg font-semibold tabular-nums ${getScoreColor(scoreTrends.website[scoreTrends.website.length - 1]?.score ?? null)}`}>
                        {scoreTrends.website[scoreTrends.website.length - 1]?.score ?? '-'}
                      </span>
                      {websiteDelta && (
                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium ${
                          websiteDelta.direction === 'up'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : websiteDelta.direction === 'down'
                            ? 'bg-red-500/20 text-red-300'
                            : 'bg-slate-500/20 text-slate-400'
                        }`}>
                          {websiteDelta.direction === 'up' ? '▲' : websiteDelta.direction === 'down' ? '▼' : '—'}
                          {websiteDelta.direction !== 'same' && (
                            <span>{websiteDelta.direction === 'up' ? '+' : ''}{websiteDelta.delta}</span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Brand Trend */}
                {scoreTrends.brand.length > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">Brand</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-lg font-semibold tabular-nums ${getScoreColor(scoreTrends.brand[scoreTrends.brand.length - 1]?.score ?? null)}`}>
                        {scoreTrends.brand[scoreTrends.brand.length - 1]?.score ?? '-'}
                      </span>
                      {brandDelta && (
                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium ${
                          brandDelta.direction === 'up'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : brandDelta.direction === 'down'
                            ? 'bg-red-500/20 text-red-300'
                            : 'bg-slate-500/20 text-slate-400'
                        }`}>
                          {brandDelta.direction === 'up' ? '▲' : brandDelta.direction === 'down' ? '▼' : '—'}
                          {brandDelta.direction !== 'same' && (
                            <span>{brandDelta.direction === 'up' ? '+' : ''}{brandDelta.delta}</span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <p className="text-xs text-slate-500 pt-2 border-t border-slate-800">
                  Change since previous diagnostic run
                </p>
              </div>
            ) : (
              <div className="text-center py-4">
                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-2">
                  <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <p className="text-sm text-slate-400">No trend data yet</p>
                <p className="text-xs text-slate-500 mt-1">
                  Run diagnostics multiple times to see trends.
                </p>
              </div>
            )}
          </div>

          {/* Performance Pulse Card */}
          <PerformancePulseCard pulse={performancePulse} />

          {/* Context Graph Health Card */}
          <ContextHealthCard companyId={companyId} />
        </div>
      </div>

      {/* ================================================================== */}
      {/* Band 2: Focus Areas + 90-Day Plan */}
      {/* ================================================================== */}
      {hasSnapshot && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Focus Areas Card (Ranked with Priority Badges) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">
              Current Focus Areas
            </h2>

            {focusAreasWithPriority.length > 0 ? (
              <ol className="space-y-3">
                {focusAreasWithPriority.map((area, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 text-blue-300 text-xs font-medium flex items-center justify-center border border-blue-500/30">
                      {index + 1}
                    </span>
                    <div className="flex-1 flex items-start justify-between gap-2 pt-0.5">
                      <span className="text-sm text-slate-200">{area.label}</span>
                      <span className={`flex-shrink-0 px-2 py-0.5 rounded text-xs font-medium border ${getPriorityStyle(area.priority)}`}>
                        {area.priority === 'High' ? 'High impact' : area.priority}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-slate-400">
                No focus areas yet. Run diagnostics to generate strategic focus.
              </p>
            )}
          </div>

          {/* 90-Day Plan Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">
              90-Day Plan
            </h2>

            {strategySnapshot.narrative90DayPlan ? (
              <>
                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {strategySnapshot.narrative90DayPlan}
                </p>
                <p className="text-xs text-slate-500 mt-4 pt-4 border-t border-slate-800">
                  Source: Latest diagnostics + Brain synthesis
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-400">
                Once you've run GAP and key labs, Hive OS will generate a concise 90-day
                plan here.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* Band 3: Strengths & Gaps + Alerts (Grouped) */}
      {/* ================================================================== */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Strengths & Gaps Card */}
        {hasSnapshot &&
          ((strategySnapshot.keyStrengths && strategySnapshot.keyStrengths.length > 0) ||
            (strategySnapshot.keyGaps && strategySnapshot.keyGaps.length > 0)) ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Strengths & Gaps
                </h2>
                <Link
                  href={`/c/${companyId}/brain`}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  View all insights
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Strengths */}
                <div>
                  <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Key Strengths
                  </h3>
                  {strategySnapshot.keyStrengths && strategySnapshot.keyStrengths.length > 0 ? (
                    <ul className="space-y-2">
                      {strategySnapshot.keyStrengths.slice(0, 5).map((strength, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm text-slate-300">
                          <span className="text-emerald-400 flex-shrink-0 mt-1">+</span>
                          <span>{strength}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-500">No key strengths highlighted yet. Run more diagnostics to surface them.</p>
                  )}
                </div>

                {/* Gaps */}
                <div>
                  <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Key Gaps
                  </h3>
                  {strategySnapshot.keyGaps && strategySnapshot.keyGaps.length > 0 ? (
                    <ul className="space-y-2">
                      {strategySnapshot.keyGaps.slice(0, 5).map((gap, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm text-slate-300">
                          <span className="text-red-400 flex-shrink-0 mt-1">-</span>
                          <span>{gap}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-500">No gaps identified yet.</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">
                Strengths & Gaps
              </h2>
              <div className="text-center py-6">
                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-2">
                  <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm text-slate-400">No insights yet</p>
                <p className="text-xs text-slate-500 mt-1">Run diagnostics to identify strengths and gaps.</p>
              </div>
            </div>
          )}

        {/* Grouped Alerts Card */}
        <GroupedAlertsCard alerts={alerts} companyId={company.id} />
      </div>

      {/* ================================================================== */}
      {/* Band 3.5: Media & Demand */}
      {/* ================================================================== */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Media & Demand
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Performance media, paid campaigns, and demand generation
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/c/${companyId}/diagnostics/media`}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              Media Lab
            </Link>
            <Link
              href={`/c/${companyId}/media`}
              className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
            >
              View Media →
            </Link>
          </div>
        </div>

        {mediaLabSummary && (mediaLabSummary.hasMediaProgram || mediaLabSummary.activePlanCount > 0) ? (
          // Media Lab plans exist - show summary
          <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-medium text-slate-200">Media Program</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                    mediaLabSummary.mediaStatus === 'running'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : mediaLabSummary.mediaStatus === 'planning'
                      ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                      : mediaLabSummary.mediaStatus === 'paused'
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                  }`}>
                    {COMPANY_MEDIA_STATUS_CONFIG[mediaLabSummary.mediaStatus]?.label || 'Unknown'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                  {mediaLabSummary.primaryObjective && (
                    <span>
                      <span className="text-slate-500">Objective:</span>{' '}
                      <span className="text-slate-300">{getObjectiveLabel(mediaLabSummary.primaryObjective)}</span>
                    </span>
                  )}
                  {mediaLabSummary.totalActiveBudget != null && (
                    <span>
                      <span className="text-slate-500">Budget:</span>{' '}
                      <span className="text-emerald-400">{formatMediaBudget(mediaLabSummary.totalActiveBudget)}</span>
                    </span>
                  )}
                  {mediaLabSummary.activePlanCount > 0 && (
                    <span className="text-slate-500">
                      {mediaLabSummary.activePlanCount} active plan{mediaLabSummary.activePlanCount !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Link
                  href={`/c/${companyId}/diagnostics/media`}
                  className="inline-flex items-center rounded-lg border border-blue-700/50 bg-blue-900/30 px-3 py-1.5 text-xs font-medium text-blue-300 hover:border-blue-500 hover:bg-blue-800/30 transition-colors"
                >
                  View Plan
                </Link>
                {hasMediaProgram && (
                  <Link
                    href={`/c/${companyId}/media`}
                    className="inline-flex items-center rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-100 hover:border-slate-500 hover:bg-slate-800 transition-colors"
                  >
                    Performance
                  </Link>
                )}
              </div>
            </div>
          </div>
        ) : hasMediaProgram ? (
          // Operational media program active but no Media Lab plans
          <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-200">Media Program Active</p>
                  <p className="text-xs text-slate-400">View channels, campaigns, and store performance</p>
                </div>
              </div>
              <Link
                href={`/c/${companyId}/diagnostics/media`}
                className="text-xs text-slate-400 hover:text-slate-300 transition-colors"
              >
                Plan →
              </Link>
            </div>
          </div>
        ) : (
          <MediaEmptyStateCompact />
        )}
      </div>

      {/* ================================================================== */}
      {/* Band 4: Active Work + Recent Diagnostics */}
      {/* ================================================================== */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Active Work Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Active Work
            </h2>
            <Link
              href={`/c/${companyId}/work`}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              Open Workboard
            </Link>
          </div>

          {hasActiveWork ? (
            <div className="space-y-3">
              {/* Summary counts */}
              {(workSummary.counts.active > 0 || workSummary.counts.inProgress > 0) && (
                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-800">
                  <span className="text-xs text-slate-400">
                    <span className="text-slate-200 font-medium">{workSummary.counts.active}</span> active
                  </span>
                  <span className="text-xs text-slate-400">
                    <span className="text-amber-300 font-medium">{workSummary.counts.inProgress}</span> in progress
                  </span>
                  {workSummary.counts.doneRecently > 0 && (
                    <span className="text-xs text-slate-400">
                      <span className="text-emerald-300 font-medium">{workSummary.counts.doneRecently}</span> done this week
                    </span>
                  )}
                </div>
              )}

              {/* Active work items */}
              {workSummary.active.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-800/50 border border-slate-700/50"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getWorkStatusStyle(item.status)}`}>
                      {item.status}
                    </span>
                    <span className="text-sm text-slate-200 truncate">{item.title}</span>
                  </div>
                  {item.area && (
                    <span className="text-xs text-slate-500 flex-shrink-0 ml-2">
                      {item.area}
                    </span>
                  )}
                </div>
              ))}

              {/* Recently done */}
              {workSummary.doneRecently.length > 0 && (
                <>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mt-4 pt-3 border-t border-slate-800">
                    Recently Completed
                  </p>
                  {workSummary.doneRecently.slice(0, 3).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 p-2 rounded-lg"
                    >
                      <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm text-slate-400 truncate">{item.title}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          ) : (
            <div className="text-center py-6">
              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-2">
                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <p className="text-sm text-slate-400">No work items yet</p>
              <p className="text-xs text-slate-500 mt-1">
                Work items are generated from diagnostic findings.
              </p>
            </div>
          )}
        </div>

        {/* Recent Diagnostics Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Recent Diagnostics
            </h2>
            <Link
              href={`/c/${companyId}/blueprint`}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              See all diagnostics
            </Link>
          </div>

          {hasDiagnostics ? (
            <div className="space-y-3">
              {recentDiagnostics.map((diagnostic) => (
                <div
                  key={diagnostic.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700/50"
                >
                  <div className="flex items-center gap-3">
                    {/* Tool Label */}
                    <span className="text-sm font-medium text-slate-200">
                      {diagnostic.toolLabel}
                    </span>

                    {/* Status Badge */}
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeStyle(
                        diagnostic.status
                      )}`}
                    >
                      {diagnostic.status === 'running' && (
                        <svg className="animate-spin -ml-0.5 mr-1 h-3 w-3" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      )}
                      {getStatusLabel(diagnostic.status)}
                    </span>

                    {/* Score (if complete) */}
                    {diagnostic.status === 'complete' && diagnostic.score !== null && (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium tabular-nums ${getScoreBgColor(
                          diagnostic.score
                        )} ${getScoreColor(diagnostic.score)}`}
                      >
                        {diagnostic.score}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Timestamp */}
                    {diagnostic.completedAt && (
                      <span className="text-xs text-slate-500">
                        {formatRelativeTime(diagnostic.completedAt)}
                      </span>
                    )}

                    {/* View Report Link */}
                    {diagnostic.reportPath && diagnostic.status === 'complete' && (
                      <Link
                        href={diagnostic.reportPath}
                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                      >
                        View report
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-2">
                <svg
                  className="w-5 h-5 text-slate-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
              </div>
              <p className="text-sm text-slate-400">No diagnostics yet</p>
              <p className="text-xs text-slate-500 mt-1">
                Run Health Check or choose a tool from the Tools tab.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ================================================================== */}
      {/* Band 5: Activity Timeline */}
      {/* ================================================================== */}
      <CompanyActivityTimeline companyId={companyId} limit={8} />

      {/* ================================================================== */}
      {/* Band 6: Setup & QBR Mode Cards */}
      {/* ================================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StrategicSetupCard
          companyId={companyId}
          setupStatus={setupStatus}
          lastSetupAt={lastSetupAt}
        />
        <QbrCard
          companyId={companyId}
          lastQbrAt={lastQbrAt}
        />
      </div>

      {/* ================================================================== */}
      {/* Quick Actions */}
      {/* ================================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Link
          href={`/c/${companyId}/setup`}
          className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors">
              <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-100">Setup</p>
              <p className="text-xs text-slate-500">Strategy wizard</p>
            </div>
          </div>
        </Link>

        <Link
          href={`/c/${companyId}/qbr`}
          className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-violet-500/50 hover:bg-violet-500/5 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-violet-500/10 border border-violet-500/30 flex items-center justify-center group-hover:bg-violet-500/20 transition-colors">
              <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-100">QBR</p>
              <p className="text-xs text-slate-500">Quarterly review</p>
            </div>
          </div>
        </Link>

        <Link
          href={`/c/${companyId}/blueprint`}
          className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 hover:bg-slate-800/50 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-100">Tools</p>
              <p className="text-xs text-slate-500">Run diagnostics</p>
            </div>
          </div>
        </Link>

        <Link
          href={`/c/${companyId}/reports`}
          className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 hover:bg-slate-800/50 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-100">Reports</p>
              <p className="text-xs text-slate-500">View history</p>
            </div>
          </div>
        </Link>

        <Link
          href={`/c/${companyId}/brain`}
          className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 hover:bg-slate-800/50 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
              <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-100">Brain</p>
              <p className="text-xs text-slate-500">AI insights</p>
            </div>
          </div>
        </Link>

        <Link
          href={`/c/${companyId}/work`}
          className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 hover:bg-slate-800/50 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-100">Work</p>
              <p className="text-xs text-slate-500">Track tasks</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}

export default CompanyOverviewPage;
