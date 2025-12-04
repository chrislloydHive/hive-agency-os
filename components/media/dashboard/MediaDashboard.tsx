'use client';

// components/media/dashboard/MediaDashboard.tsx
// Media Dashboard v1 - Performance overview for active media programs
//
// Shows:
// - KPI Row (installs, calls, spend, CPA, scores)
// - Channel Cards with performance metrics
// - Alerts panel (anomalies, underperformance)
// - Store Table for multi-store companies
// - Seasonal Summary cards

import { useState, useMemo } from 'react';
import type { MediaProgram, MediaProgramChannel } from '@/lib/media/programs';
import { CHANNEL_LABELS, CHANNEL_COLORS, type MediaChannel } from '@/lib/media/types';
import type { MediaCockpitSnapshot, ComparativeMetric } from '@/lib/media/cockpit';
import type { MediaInsight } from '@/lib/media/alerts';
import { getAlertsSummary } from '@/lib/media/alerts';
import type { MediaEventChannel, AggregatedMediaMetrics } from '@/lib/media/performanceTypes';

// ============================================================================
// Types
// ============================================================================

interface MediaDashboardProps {
  companyId: string;
  companyName: string;
  program: MediaProgram;
  /** Cockpit snapshot with aggregated metrics (when available) */
  snapshot?: MediaCockpitSnapshot;
  /** Comparative metrics for YoY/prev period (when available) */
  comparisons?: {
    spend: ComparativeMetric;
    leads: ComparativeMetric;
    calls: ComparativeMetric;
    installs: ComparativeMetric;
    cpl: ComparativeMetric | null;
    cpa: ComparativeMetric | null;
  };
  /** Active alerts/insights */
  insights?: MediaInsight[];
  onEditProgram?: () => void;
}

// Placeholder performance data structure
interface ChannelPerformance {
  channel: MediaChannel;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  calls: number;
  installs: number;
  cpl: number | null;
  cpa: number | null;
  trend: 'up' | 'down' | 'flat';
}

interface StorePerformance {
  storeId: string;
  storeName: string;
  market: string;
  spend: number;
  installs: number;
  calls: number;
  visibilityScore: number;
  demandScore: number;
  conversionScore: number;
}

// ============================================================================
// Dummy Data Generator (v1 placeholder)
// ============================================================================

function generateDummyChannelPerformance(channels: MediaProgramChannel[]): ChannelPerformance[] {
  return channels
    .filter(c => c.isActive)
    .map(c => ({
      channel: c.channel,
      spend: Math.round((c.monthlyBudget || 5000) * (0.7 + Math.random() * 0.3)),
      impressions: Math.round(10000 + Math.random() * 50000),
      clicks: Math.round(500 + Math.random() * 2000),
      leads: Math.round(20 + Math.random() * 80),
      calls: Math.round(30 + Math.random() * 100),
      installs: Math.round(5 + Math.random() * 30),
      cpl: Math.round(50 + Math.random() * 100),
      cpa: Math.round(100 + Math.random() * 200),
      trend: Math.random() > 0.5 ? 'up' : Math.random() > 0.5 ? 'down' : 'flat',
    }));
}

function generateDummyStorePerformance(): StorePerformance[] {
  const stores = [
    { name: 'Downtown', market: 'Seattle' },
    { name: 'Northgate', market: 'Seattle' },
    { name: 'Bellevue', market: 'Eastside' },
    { name: 'Tacoma', market: 'South Sound' },
    { name: 'Federal Way', market: 'South Sound' },
  ];

  return stores.map((s, i) => ({
    storeId: `store-${i + 1}`,
    storeName: s.name,
    market: s.market,
    spend: Math.round(3000 + Math.random() * 5000),
    installs: Math.round(5 + Math.random() * 25),
    calls: Math.round(20 + Math.random() * 80),
    visibilityScore: Math.round(50 + Math.random() * 50),
    demandScore: Math.round(40 + Math.random() * 60),
    conversionScore: Math.round(30 + Math.random() * 70),
  }));
}

// ============================================================================
// Helper Components
// ============================================================================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString();
}

function TrendArrow({ trend }: { trend: 'up' | 'down' | 'flat' }) {
  if (trend === 'up') {
    return (
      <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
    );
  }
  if (trend === 'down') {
    return (
      <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
    </svg>
  );
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-amber-400';
  return 'text-red-400';
}

function getScoreBg(score: number): string {
  if (score >= 80) return 'bg-emerald-500/10';
  if (score >= 60) return 'bg-amber-500/10';
  return 'bg-red-500/10';
}

// ============================================================================
// KPI Row
// ============================================================================

interface KpiCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  highlight?: boolean;
}

function KpiCard({ label, value, subValue, highlight }: KpiCardProps) {
  return (
    <div className={`p-4 rounded-xl border ${
      highlight
        ? 'bg-amber-500/10 border-amber-500/30'
        : 'bg-slate-900/50 border-slate-800'
    }`}>
      <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${highlight ? 'text-amber-400' : 'text-slate-100'}`}>
        {value}
      </div>
      {subValue && <div className="text-xs text-slate-500 mt-0.5">{subValue}</div>}
    </div>
  );
}

function KpiRow({ channelPerformance }: { channelPerformance: ChannelPerformance[] }) {
  const totals = channelPerformance.reduce(
    (acc, c) => ({
      spend: acc.spend + c.spend,
      installs: acc.installs + c.installs,
      calls: acc.calls + c.calls,
      leads: acc.leads + c.leads,
    }),
    { spend: 0, installs: 0, calls: 0, leads: 0 }
  );

  const avgCpa = totals.installs > 0 ? totals.spend / totals.installs : 0;
  const avgCpl = totals.leads > 0 ? totals.spend / totals.leads : 0;

  // Dummy scores
  const visibilityScore = Math.round(60 + Math.random() * 30);
  const demandScore = Math.round(50 + Math.random() * 40);
  const conversionScore = Math.round(40 + Math.random() * 50);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
      <KpiCard label="Installs" value={totals.installs} highlight />
      <KpiCard label="Calls" value={totals.calls} />
      <KpiCard label="Leads" value={totals.leads} />
      <KpiCard label="30-Day Spend" value={formatCurrency(totals.spend)} />
      <KpiCard label="CPA" value={avgCpa > 0 ? formatCurrency(avgCpa) : '—'} />
      <KpiCard label="CPL" value={avgCpl > 0 ? formatCurrency(avgCpl) : '—'} />
      <div className="p-4 rounded-xl border bg-slate-900/50 border-slate-800">
        <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Scores</div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${getScoreColor(visibilityScore)}`}>{visibilityScore}</span>
          <span className="text-slate-600">/</span>
          <span className={`text-sm font-bold ${getScoreColor(demandScore)}`}>{demandScore}</span>
          <span className="text-slate-600">/</span>
          <span className={`text-sm font-bold ${getScoreColor(conversionScore)}`}>{conversionScore}</span>
        </div>
        <div className="text-[9px] text-slate-600 mt-0.5">Vis / Dem / Conv</div>
      </div>
    </div>
  );
}

// ============================================================================
// Channel Cards
// ============================================================================

function ChannelCard({ performance }: { performance: ChannelPerformance }) {
  const colors = CHANNEL_COLORS[performance.channel];
  const label = CHANNEL_LABELS[performance.channel];

  return (
    <div className={`p-4 rounded-xl border ${colors.bg} ${colors.border}`}>
      <div className="flex items-center justify-between mb-3">
        <span className={`text-sm font-semibold ${colors.text}`}>{label}</span>
        <TrendArrow trend={performance.trend} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] text-slate-500 uppercase">Spend</div>
          <div className="text-sm font-medium text-slate-200 tabular-nums">
            {formatCurrency(performance.spend)}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500 uppercase">Installs</div>
          <div className="text-sm font-medium text-slate-200 tabular-nums">
            {performance.installs}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500 uppercase">Calls</div>
          <div className="text-sm font-medium text-slate-200 tabular-nums">
            {performance.calls}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500 uppercase">CPA</div>
          <div className="text-sm font-medium text-slate-200 tabular-nums">
            {performance.cpa ? formatCurrency(performance.cpa) : '—'}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChannelCardsGrid({ channelPerformance }: { channelPerformance: ChannelPerformance[] }) {
  if (channelPerformance.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500 text-sm">
        No active channels configured
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {channelPerformance.map((perf) => (
        <ChannelCard key={perf.channel} performance={perf} />
      ))}
    </div>
  );
}

// ============================================================================
// Store Table
// ============================================================================

function StoreTable({ stores }: { stores: StorePerformance[] }) {
  if (stores.length === 0) {
    return null;
  }

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800">
        <h3 className="text-sm font-semibold text-slate-200">Store Performance</h3>
        <p className="text-xs text-slate-500 mt-0.5">{stores.length} stores</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="text-left py-2 px-4 text-xs font-medium text-slate-400 uppercase tracking-wide">Store</th>
              <th className="text-left py-2 px-4 text-xs font-medium text-slate-400 uppercase tracking-wide">Market</th>
              <th className="text-right py-2 px-4 text-xs font-medium text-slate-400 uppercase tracking-wide">Spend</th>
              <th className="text-right py-2 px-4 text-xs font-medium text-slate-400 uppercase tracking-wide">Installs</th>
              <th className="text-right py-2 px-4 text-xs font-medium text-slate-400 uppercase tracking-wide">Calls</th>
              <th className="text-center py-2 px-4 text-xs font-medium text-slate-400 uppercase tracking-wide">Vis</th>
              <th className="text-center py-2 px-4 text-xs font-medium text-slate-400 uppercase tracking-wide">Dem</th>
              <th className="text-center py-2 px-4 text-xs font-medium text-slate-400 uppercase tracking-wide">Conv</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {stores.map((store) => (
              <tr key={store.storeId} className="hover:bg-slate-800/30 transition-colors">
                <td className="py-2 px-4 text-sm text-slate-200">{store.storeName}</td>
                <td className="py-2 px-4 text-sm text-slate-400">{store.market}</td>
                <td className="py-2 px-4 text-sm text-slate-300 text-right tabular-nums">
                  {formatCurrency(store.spend)}
                </td>
                <td className="py-2 px-4 text-sm text-slate-300 text-right tabular-nums">
                  {store.installs}
                </td>
                <td className="py-2 px-4 text-sm text-slate-300 text-right tabular-nums">
                  {store.calls}
                </td>
                <td className="py-2 px-4 text-center">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getScoreBg(store.visibilityScore)} ${getScoreColor(store.visibilityScore)}`}>
                    {store.visibilityScore}
                  </span>
                </td>
                <td className="py-2 px-4 text-center">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getScoreBg(store.demandScore)} ${getScoreColor(store.demandScore)}`}>
                    {store.demandScore}
                  </span>
                </td>
                <td className="py-2 px-4 text-center">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getScoreBg(store.conversionScore)} ${getScoreColor(store.conversionScore)}`}>
                    {store.conversionScore}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// Seasonal Summary
// ============================================================================

interface SeasonCardProps {
  title: string;
  months: string;
  status: 'active' | 'upcoming' | 'past';
  metrics: { label: string; value: string }[];
}

function SeasonCard({ title, months, status, metrics }: SeasonCardProps) {
  const statusStyles = {
    active: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    upcoming: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    past: 'bg-slate-800/50 border-slate-700 text-slate-400',
  };

  return (
    <div className={`p-4 rounded-xl border ${statusStyles[status].split(' ').slice(0, 2).join(' ')}`}>
      <div className="flex items-center justify-between mb-2">
        <h4 className={`text-sm font-semibold ${statusStyles[status].split(' ')[2]}`}>{title}</h4>
        <span className="text-[10px] text-slate-500 uppercase">{months}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {metrics.map((m, i) => (
          <div key={i}>
            <div className="text-[10px] text-slate-500">{m.label}</div>
            <div className="text-sm font-medium text-slate-200 tabular-nums">{m.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SeasonalSummary() {
  const currentMonth = new Date().getMonth();

  // Determine which season is active
  const isCarPlaySeason = currentMonth >= 3 && currentMonth <= 7; // Apr-Aug
  const isRemoteStartSeason = currentMonth >= 9 || currentMonth <= 1; // Oct-Feb
  const isHolidaySeason = currentMonth >= 10 && currentMonth <= 11; // Nov-Dec

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-slate-200 mb-4">Seasonal Performance</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SeasonCard
          title="CarPlay Season"
          months="Apr–Aug"
          status={isCarPlaySeason ? 'active' : currentMonth < 3 ? 'upcoming' : 'past'}
          metrics={[
            { label: 'Installs', value: '124' },
            { label: 'CPA', value: '$185' },
            { label: 'Spend', value: '$22.9K' },
            { label: 'vs Last Year', value: '+12%' },
          ]}
        />
        <SeasonCard
          title="Remote Start Season"
          months="Oct–Feb"
          status={isRemoteStartSeason ? 'active' : currentMonth < 9 ? 'upcoming' : 'past'}
          metrics={[
            { label: 'Installs', value: '89' },
            { label: 'CPA', value: '$210' },
            { label: 'Spend', value: '$18.7K' },
            { label: 'vs Last Year', value: '+8%' },
          ]}
        />
        <SeasonCard
          title="Holiday Season"
          months="Nov–Dec"
          status={isHolidaySeason ? 'active' : currentMonth < 10 ? 'upcoming' : 'past'}
          metrics={[
            { label: 'Installs', value: '156' },
            { label: 'CPA', value: '$145' },
            { label: 'Spend', value: '$22.6K' },
            { label: 'vs Last Year', value: '+18%' },
          ]}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Alerts Panel
// ============================================================================

function AlertSeverityBadge({ severity }: { severity: MediaInsight['severity'] }) {
  const styles = {
    critical: 'bg-red-500/20 text-red-400 border-red-500/30',
    warning: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  };

  return (
    <span className={`px-1.5 py-0.5 text-[10px] font-medium uppercase rounded border ${styles[severity]}`}>
      {severity}
    </span>
  );
}

function AlertCard({ insight }: { insight: MediaInsight }) {
  return (
    <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:border-slate-600 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-1">
        <h4 className="text-sm font-medium text-slate-200">{insight.title}</h4>
        <AlertSeverityBadge severity={insight.severity} />
      </div>
      <p className="text-xs text-slate-400 mb-2">{insight.description}</p>
      {insight.recommendation && (
        <p className="text-xs text-slate-500 italic">{insight.recommendation}</p>
      )}
      {insight.channel && (
        <span className="inline-block mt-2 px-2 py-0.5 text-[10px] font-medium text-slate-400 bg-slate-700/50 rounded">
          {CHANNEL_LABELS[insight.channel as MediaChannel] || insight.channel}
        </span>
      )}
    </div>
  );
}

function AlertsPanel({ insights }: { insights: MediaInsight[] }) {
  const summary = useMemo(() => getAlertsSummary(insights), [insights]);

  if (insights.length === 0) {
    return (
      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-medium text-emerald-400">All systems nominal</span>
        </div>
        <p className="text-xs text-slate-500 mt-1">No performance anomalies detected</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Alerts & Insights</h3>
          <p className="text-xs text-slate-500 mt-0.5">{insights.length} active</p>
        </div>
        <div className="flex items-center gap-2">
          {summary.critical > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-red-500/20 text-red-400 rounded">
              {summary.critical} critical
            </span>
          )}
          {summary.warning > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-amber-500/20 text-amber-400 rounded">
              {summary.warning} warning
            </span>
          )}
        </div>
      </div>
      <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
        {insights.map((insight) => (
          <AlertCard key={insight.id} insight={insight} />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Comparison Delta Display
// ============================================================================

function DeltaIndicator({ metric, lowerIsBetter = false }: { metric: ComparativeMetric | null; lowerIsBetter?: boolean }) {
  if (!metric || metric.deltaPct === null) return null;

  const isPositive = lowerIsBetter ? metric.deltaPct < 0 : metric.deltaPct > 0;
  const isNegative = lowerIsBetter ? metric.deltaPct > 0 : metric.deltaPct < 0;

  const colorClass = isPositive ? 'text-emerald-400' : isNegative ? 'text-red-400' : 'text-slate-400';
  const sign = metric.deltaPct > 0 ? '+' : '';

  return (
    <span className={`text-[10px] font-medium ${colorClass}`}>
      {sign}{Math.round(metric.deltaPct * 100)}%
    </span>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function MediaDashboard({
  companyId,
  companyName,
  program,
  snapshot,
  comparisons,
  insights,
  onEditProgram
}: MediaDashboardProps) {
  // Generate dummy data for v1 (used when no snapshot provided)
  const [channelPerformance] = useState(() => generateDummyChannelPerformance(program.channels));
  const [storePerformance] = useState(() => generateDummyStorePerformance());

  // Determine if we have real data
  const hasRealData = !!snapshot;
  const hasAlerts = insights && insights.length > 0;
  const alertsSummary = insights ? getAlertsSummary(insights) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-200">{program.name}</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {program.channels.filter(c => c.isActive).length} active channels
            {program.totalMonthlyBudget > 0 && ` • ${formatCurrency(program.totalMonthlyBudget)}/mo budget`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Alert indicator in header */}
          {alertsSummary && alertsSummary.critical > 0 && (
            <span className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/30">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {alertsSummary.critical}
            </span>
          )}
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            program.status === 'active'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              : program.status === 'paused'
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
              : 'bg-slate-500/10 text-slate-400 border border-slate-500/30'
          }`}>
            {program.status.charAt(0).toUpperCase() + program.status.slice(1)}
          </span>
          {onEditProgram && (
            <button
              onClick={onEditProgram}
              className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800/50 border border-slate-700 rounded-lg hover:bg-slate-700/50 transition-colors"
            >
              Edit Program
            </button>
          )}
        </div>
      </div>

      {/* KPI Row */}
      <KpiRow channelPerformance={channelPerformance} />

      {/* Alerts Panel (when insights available) */}
      {insights && <AlertsPanel insights={insights} />}

      {/* Channel Cards */}
      <div>
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
          Channel Performance
        </h3>
        <ChannelCardsGrid channelPerformance={channelPerformance} />
      </div>

      {/* Store Table */}
      <StoreTable stores={storePerformance} />

      {/* Seasonal Summary */}
      <SeasonalSummary />

      {/* Data Notice */}
      <div className="text-center py-4">
        <p className="text-xs text-slate-600">
          {hasRealData
            ? 'Dashboard v1 • Live data from connected sources'
            : 'Dashboard v1 • Placeholder data shown • Real data integration coming soon'
          }
        </p>
      </div>
    </div>
  );
}

export default MediaDashboard;
