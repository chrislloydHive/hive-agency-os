'use client';

// components/os/overview/CompanySnapshotHeader.tsx
// Company Situation Briefing Header
//
// Answers: "What is this company's current state?" at a glance.
// Shows company identity, key metrics, and AI-generated insight.
//
// Structure:
// 1. Company name + lifecycle badge + stage
// 2. Quick metrics row (sessions, conversions, GAP score, alerts)
// 3. AI insight (1-2 sentences on situation + implied next step)

import {
  Building2,
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Target,
  BarChart3,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type CompanyLifecycle = 'healthy' | 'growing' | 'mixed' | 'needs_attention' | 'new';

export interface SituationMetrics {
  /** Current sessions (last 7 days) */
  sessions?: number | null;
  /** Session change percentage */
  sessionsChange?: number | null;
  /** Current conversions (last 7 days) */
  conversions?: number | null;
  /** Conversion change percentage */
  conversionsChange?: number | null;
  /** Latest GAP/diagnostic score (0-100) */
  gapScore?: number | null;
  /** Number of active alerts */
  alertCount?: number;
  /** Number of critical alerts */
  criticalAlertCount?: number;
}

export interface CompanySnapshotHeaderProps {
  companyId: string;
  companyName: string;
  /** Pre-generated AI snapshot (from server) */
  aiSnapshot?: string | null;
  /** Lifecycle status derived from diagnostics */
  lifecycle?: CompanyLifecycle;
  /** Optional: Industry for context */
  industry?: string | null;
  /** Optional: Company stage */
  stage?: string | null;
  /** Performance and diagnostic metrics */
  metrics?: SituationMetrics | null;
}

// ============================================================================
// Component
// ============================================================================

export function CompanySnapshotHeader({
  companyId,
  companyName,
  aiSnapshot,
  lifecycle = 'new',
  industry,
  stage,
  metrics,
}: CompanySnapshotHeaderProps) {
  const lifecycleConfig = getLifecycleConfig(lifecycle);
  const hasMetrics = metrics && (
    metrics.sessions !== undefined ||
    metrics.conversions !== undefined ||
    metrics.gapScore !== undefined ||
    metrics.alertCount !== undefined
  );

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
      {/* Row 1: Company Identity */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-6 h-6 text-slate-400" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-xl font-semibold text-white">
                  {companyName}
                </h1>
                <span className={`
                  inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border
                  ${lifecycleConfig.className}
                `}>
                  {lifecycleConfig.icon}
                  {lifecycleConfig.label}
                </span>
              </div>
              {(industry || stage) && (
                <p className="text-sm text-slate-500">
                  {[stage, industry].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Metrics Strip (if we have data) */}
      {hasMetrics && (
        <div className="px-5 py-3 bg-slate-800/30 border-t border-slate-800/50">
          <div className="flex items-center gap-6 flex-wrap">
            {/* Sessions */}
            {metrics.sessions !== undefined && metrics.sessions !== null && (
              <MetricPill
                icon={<Users className="w-3.5 h-3.5" />}
                label="Sessions"
                value={formatNumber(metrics.sessions)}
                change={metrics.sessionsChange}
              />
            )}

            {/* Conversions */}
            {metrics.conversions !== undefined && (
              <MetricPill
                icon={<Target className="w-3.5 h-3.5" />}
                label="Conversions"
                value={metrics.conversions !== null ? formatNumber(metrics.conversions) : '—'}
                change={metrics.conversionsChange}
                muted={metrics.conversions === null || metrics.conversions === 0}
              />
            )}

            {/* GAP Score */}
            {metrics.gapScore !== undefined && metrics.gapScore !== null && (
              <MetricPill
                icon={<BarChart3 className="w-3.5 h-3.5" />}
                label="GAP Score"
                value={metrics.gapScore.toString()}
                scoreColor={getScoreColor(metrics.gapScore)}
              />
            )}

            {/* Alerts */}
            {(metrics.alertCount !== undefined && metrics.alertCount > 0) && (
              <MetricPill
                icon={<AlertTriangle className="w-3.5 h-3.5" />}
                label="Alerts"
                value={metrics.alertCount.toString()}
                alertLevel={metrics.criticalAlertCount && metrics.criticalAlertCount > 0 ? 'critical' : 'warning'}
              />
            )}
          </div>
        </div>
      )}

      {/* Row 3: AI Insight */}
      {aiSnapshot && (
        <div className="px-5 py-4 border-t border-slate-800/50">
          <div className="flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-slate-300 leading-relaxed">
              {aiSnapshot}
            </p>
          </div>
        </div>
      )}

      {/* Fallback if no metrics and no AI snapshot */}
      {!hasMetrics && !aiSnapshot && (
        <div className="px-5 py-4 border-t border-slate-800/50">
          <p className="text-sm text-slate-500 italic">
            Run diagnostics to see performance metrics and insights.
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Metric Pill Component
// ============================================================================

interface MetricPillProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  change?: number | null;
  scoreColor?: string;
  alertLevel?: 'warning' | 'critical';
  muted?: boolean;
}

function MetricPill({ icon, label, value, change, scoreColor, alertLevel, muted }: MetricPillProps) {
  // Determine text color
  let valueColor = 'text-slate-200';
  if (scoreColor) {
    valueColor = scoreColor;
  } else if (alertLevel === 'critical') {
    valueColor = 'text-red-400';
  } else if (alertLevel === 'warning') {
    valueColor = 'text-amber-400';
  } else if (muted) {
    valueColor = 'text-slate-500';
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-500">{icon}</span>
      <span className="text-xs text-slate-500">{label}:</span>
      <span className={`text-sm font-medium ${valueColor}`}>{value}</span>
      {change !== undefined && change !== null && (
        <ChangeIndicator change={change} />
      )}
    </div>
  );
}

// ============================================================================
// Change Indicator Component
// ============================================================================

function ChangeIndicator({ change }: { change: number }) {
  if (change === 0) {
    return (
      <span className="inline-flex items-center text-xs text-slate-500">
        <Minus className="w-3 h-3 mr-0.5" />
        0%
      </span>
    );
  }

  const isPositive = change > 0;
  const Icon = isPositive ? ArrowUpRight : ArrowDownRight;
  const colorClass = isPositive ? 'text-emerald-400' : 'text-red-400';

  return (
    <span className={`inline-flex items-center text-xs ${colorClass}`}>
      <Icon className="w-3 h-3" />
      {isPositive ? '+' : ''}{Math.round(change)}%
    </span>
  );
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format a number for display (e.g., 1234 → "1,234", 1234567 → "1.2M")
 */
function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 10_000) {
    return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toLocaleString();
}

/**
 * Get color class for a GAP/diagnostic score
 */
function getScoreColor(score: number): string {
  if (score >= 70) return 'text-emerald-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-red-400';
}

function getLifecycleConfig(lifecycle: CompanyLifecycle): {
  label: string;
  className: string;
  icon: React.ReactNode;
} {
  switch (lifecycle) {
    case 'healthy':
      return {
        label: 'Healthy',
        className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        icon: <CheckCircle className="w-3 h-3" />,
      };
    case 'growing':
      return {
        label: 'Growing',
        className: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
        icon: <TrendingUp className="w-3 h-3" />,
      };
    case 'mixed':
      return {
        label: 'Mixed',
        className: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
        icon: <TrendingDown className="w-3 h-3" />,
      };
    case 'needs_attention':
      return {
        label: 'Needs Attention',
        className: 'bg-red-500/10 text-red-400 border-red-500/30',
        icon: <AlertTriangle className="w-3 h-3" />,
      };
    case 'new':
    default:
      return {
        label: 'New',
        className: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
        icon: <Building2 className="w-3 h-3" />,
      };
  }
}

// ============================================================================
// Lifecycle Derivation Helper
// ============================================================================

/**
 * Derive lifecycle status from company data
 */
export function deriveCompanyLifecycle(data: {
  hasStrategy: boolean;
  hasDiagnostics: boolean;
  latestScore?: number | null;
  alertCount?: number;
  criticalAlertCount?: number;
}): CompanyLifecycle {
  const { hasStrategy, hasDiagnostics, latestScore, alertCount = 0, criticalAlertCount = 0 } = data;

  // New company - no diagnostics yet
  if (!hasDiagnostics) {
    return 'new';
  }

  // Needs attention - critical alerts or very low score
  if (criticalAlertCount > 0 || (latestScore !== null && latestScore !== undefined && latestScore < 40)) {
    return 'needs_attention';
  }

  // Healthy - good score and strategy in place
  if (hasStrategy && latestScore !== null && latestScore !== undefined && latestScore >= 70) {
    return 'healthy';
  }

  // Growing - improving or moderate score
  if (latestScore !== null && latestScore !== undefined && latestScore >= 60) {
    return 'growing';
  }

  // Mixed - has some issues
  return 'mixed';
}
