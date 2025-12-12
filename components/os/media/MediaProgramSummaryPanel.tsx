'use client';

// components/os/media/MediaProgramSummaryPanel.tsx
// Media Program Summary Panel for Media Lab v2
//
// Shows high-level KPIs, program health badge, and key alerts
// at the top of Media Lab for CMO-level visibility.

import {
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  Target,
  Phone,
  Activity,
  BarChart3,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import type { CompanyMediaProgramSummary } from '@/lib/types/mediaAnalytics';
import type { CompanyAnalyticsSnapshot } from '@/lib/types/companyAnalytics';
import {
  getProgramHealthLabel,
  getProgramHealthColorClasses,
} from '@/lib/types/mediaAnalytics';
import {
  formatCompactNumber,
  formatCurrency,
  formatPercentChange,
  getChangeColorClass,
} from '@/lib/types/companyAnalytics';

// ============================================================================
// Types
// ============================================================================

interface MediaProgramSummaryPanelProps {
  mediaSummary: CompanyMediaProgramSummary;
  analytics?: CompanyAnalyticsSnapshot;
  companyName?: string;
}

// ============================================================================
// Helper Components
// ============================================================================

function KpiCard({
  label,
  value,
  change,
  icon: Icon,
  invertColors = false,
  subLabel,
}: {
  label: string;
  value: string;
  change?: number | null;
  icon: React.ComponentType<{ className?: string }>;
  invertColors?: boolean;
  subLabel?: string;
}) {
  return (
    <div className="bg-slate-800/40 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-slate-400" />
        <span className="text-xs text-slate-500 uppercase tracking-wide">
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold tabular-nums text-white">{value}</span>
        {change !== null && change !== undefined && (
          <span
            className={`text-xs font-medium ${getChangeColorClass(change, invertColors)}`}
          >
            {formatPercentChange(change)}
          </span>
        )}
      </div>
      {subLabel && <p className="text-[10px] text-slate-500 mt-1">{subLabel}</p>}
    </div>
  );
}

function AlertItem({
  text,
  type,
}: {
  text: string;
  type: 'positive' | 'negative' | 'neutral';
}) {
  const Icon =
    type === 'positive'
      ? TrendingUp
      : type === 'negative'
        ? TrendingDown
        : Minus;
  const colorClass =
    type === 'positive'
      ? 'text-emerald-400'
      : type === 'negative'
        ? 'text-red-400'
        : 'text-slate-400';

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

export function MediaProgramSummaryPanel({
  mediaSummary,
  analytics,
  companyName,
}: MediaProgramSummaryPanelProps) {
  const kpis = mediaSummary.primaryKpis;

  // Determine health icon
  const HealthIcon =
    mediaSummary.programHealth === 'good'
      ? CheckCircle
      : mediaSummary.programHealth === 'at_risk'
        ? AlertTriangle
        : Activity;

  // Build key alerts from analytics
  const keyAlerts: { text: string; type: 'positive' | 'negative' | 'neutral' }[] =
    [];

  if (analytics?.keyAlerts) {
    for (const alert of analytics.keyAlerts.slice(0, 3)) {
      // Simple heuristic: if alert contains "up" or "improved" -> positive
      const lower = alert.toLowerCase();
      if (lower.includes('up') || lower.includes('improved') || lower.includes('increased')) {
        keyAlerts.push({ text: alert, type: 'positive' });
      } else if (lower.includes('down') || lower.includes('declined') || lower.includes('decreased')) {
        keyAlerts.push({ text: alert, type: 'negative' });
      } else {
        keyAlerts.push({ text: alert, type: 'neutral' });
      }
    }
  }

  // Add CPL change alert if significant
  if (analytics?.cplChangePct !== null && analytics?.cplChangePct !== undefined) {
    if (analytics.cplChangePct < -10 && keyAlerts.length < 3) {
      keyAlerts.push({
        text: `CPL improved ${Math.abs(analytics.cplChangePct)}% vs prior period`,
        type: 'positive',
      });
    } else if (analytics.cplChangePct > 10 && keyAlerts.length < 3) {
      keyAlerts.push({
        text: `CPL increased ${analytics.cplChangePct}% vs prior period`,
        type: 'negative',
      });
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      {/* Header Row */}
      <div className="px-5 py-4 border-b border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Left: Title + Health Badge */}
          <div className="flex items-center gap-3">
            {companyName && (
              <h2 className="text-lg font-semibold text-white">Media Program</h2>
            )}
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${getProgramHealthColorClasses(mediaSummary.programHealth)}`}
            >
              <HealthIcon className="w-4 h-4" />
              {getProgramHealthLabel(mediaSummary.programHealth)}
            </span>
          </div>

          {/* Right: Program Stats */}
          <div className="flex items-center gap-4 text-xs text-slate-500">
            {mediaSummary.activeCampaignCount !== undefined && (
              <span>
                {mediaSummary.activeCampaignCount} active campaign
                {mediaSummary.activeCampaignCount !== 1 ? 's' : ''}
              </span>
            )}
            {mediaSummary.marketCount !== undefined && (
              <span>
                {mediaSummary.marketCount} market
                {mediaSummary.marketCount !== 1 ? 's' : ''}
              </span>
            )}
            {mediaSummary.storeCount !== undefined && (
              <span>
                {mediaSummary.storeCount} store
                {mediaSummary.storeCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Status Message */}
        {mediaSummary.programStatusMessage && (
          <p className="mt-2 text-sm text-slate-400">
            {mediaSummary.programStatusMessage}
          </p>
        )}
      </div>

      {/* KPI Grid */}
      <div className="px-5 py-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Spend */}
          <KpiCard
            label="Spend (30d)"
            value={
              kpis?.mediaSpend !== undefined
                ? formatCurrency(kpis.mediaSpend)
                : '—'
            }
            change={analytics?.mediaSpendChangePct}
            icon={DollarSign}
            subLabel={
              mediaSummary.totalMonthlyBudget
                ? `Budget: ${formatCurrency(mediaSummary.totalMonthlyBudget)}`
                : undefined
            }
          />

          {/* Installs/Leads */}
          <KpiCard
            label="Installs / Leads"
            value={
              kpis?.installsOrLeads !== undefined
                ? formatCompactNumber(kpis.installsOrLeads)
                : '—'
            }
            change={analytics?.conversionsChangePct}
            icon={Target}
          />

          {/* CPL */}
          <KpiCard
            label="Cost per Lead"
            value={kpis?.cpl !== undefined ? formatCurrency(kpis.cpl) : '—'}
            change={analytics?.cplChangePct}
            icon={BarChart3}
            invertColors
          />

          {/* ROAS or Calls */}
          {kpis?.roas !== undefined ? (
            <KpiCard
              label="ROAS"
              value={`${kpis.roas.toFixed(1)}x`}
              icon={TrendingUp}
            />
          ) : (
            <KpiCard
              label="Calls"
              value={
                kpis?.calls !== undefined ? formatCompactNumber(kpis.calls) : '—'
              }
              icon={Phone}
            />
          )}
        </div>
      </div>

      {/* Key Alerts */}
      {keyAlerts.length > 0 && (
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-medium text-slate-300">Key Trends</span>
          </div>
          <ul className="space-y-1.5">
            {keyAlerts.map((alert, index) => (
              <AlertItem key={index} text={alert.text} type={alert.type} />
            ))}
          </ul>
        </div>
      )}

      {/* Analytics Warning (if no analytics connected but media program exists) */}
      {!analytics?.hasAnalytics && (
        <div className="px-5 py-3 border-t border-slate-800 bg-amber-500/5">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-400/80">
              External analytics not connected. Some metrics may be incomplete.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default MediaProgramSummaryPanel;
