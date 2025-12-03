'use client';

// components/os/MediaAnalyticsTab.tsx
// Media Analytics V1 - Performance and Insights layer for Media Lab
//
// Sections:
// 1. Channel Performance Overview
// 2. Store-Level Performance table
// 3. Seasonal Performance
// 4. KPI Alerts + Insights

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type {
  MediaAnalyticsSummary,
  ChannelPerformanceMetrics,
  StorePerformanceRow,
  SeasonalFlightPerformance,
  MediaInsight,
} from '@/lib/mediaLab/analytics';
import {
  formatMediaBudget,
  getChannelLabel,
  getSeasonLabel,
  MEDIA_CHANNEL_COLORS,
} from '@/lib/types/mediaLab';

// ============================================================================
// Types
// ============================================================================

interface MediaAnalyticsTabProps {
  companyId: string;
  companyName: string;
  hasMediaPlans: boolean;
}

// ============================================================================
// Main Component
// ============================================================================

export function MediaAnalyticsTab({
  companyId,
  companyName,
  hasMediaPlans,
}: MediaAnalyticsTabProps) {
  const router = useRouter();
  const [summary, setSummary] = useState<MediaAnalyticsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'7' | '30' | '90'>('30');
  const [isCreatingWorkItem, setIsCreatingWorkItem] = useState<string | null>(null);

  // Fetch analytics data
  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/os/media-lab/analytics?companyId=${companyId}&days=${dateRange}`);
      if (!res.ok) {
        throw new Error('Failed to fetch analytics');
      }
      const data = await res.json();
      if (data.success) {
        setSummary(data.summary);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setIsLoading(false);
    }
  }, [companyId, dateRange]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Handle creating work item from insight
  const handleCreateWorkItem = async (insight: MediaInsight) => {
    setIsCreatingWorkItem(insight.id);
    try {
      const res = await fetch('/api/os/work-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          title: insight.title,
          notes: insight.description,
          area: 'Funnel',
          severity: insight.severity === 'critical' ? 'High' : insight.severity === 'warning' ? 'Medium' : 'Low',
          source: {
            sourceType: 'media_insight',
            insightId: insight.id,
            insightType: insight.type,
          },
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to create work item');
      }

      // Refresh to show updated state
      router.refresh();
    } catch (err) {
      console.error('Failed to create work item:', err);
    } finally {
      setIsCreatingWorkItem(null);
    }
  };

  // No media plans - show empty state
  if (!hasMediaPlans) {
    return <NoMediaPlansState companyId={companyId} />;
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-32 bg-slate-800 rounded-xl mb-6" />
          <div className="h-64 bg-slate-800 rounded-xl mb-6" />
          <div className="h-48 bg-slate-800 rounded-xl" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
        <p className="text-red-400 mb-2">Failed to load media analytics</p>
        <p className="text-sm text-red-300/70">{error}</p>
        <button
          onClick={fetchAnalytics}
          className="mt-4 px-4 py-2 text-sm font-medium rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  // No data state
  if (!summary?.hasData) {
    return <NoDataState companyId={companyId} />;
  }

  return (
    <div className="space-y-6">
      {/* Header with Date Range Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Media Analytics</h2>
          <p className="text-sm text-slate-400">
            {summary.dateRange.label} &bull; {summary.storeCount} stores
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangeSelector value={dateRange} onChange={setDateRange} />
          <Link
            href={`/c/${companyId}/diagnostics/media`}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
          >
            Open Media Lab
          </Link>
        </div>
      </div>

      {/* KPIs Overview */}
      <KpiOverviewSection summary={summary} />

      {/* Channel Performance */}
      <ChannelPerformanceSection channels={summary.channelPerformance} />

      {/* Store Performance Table */}
      <StorePerformanceSection
        stores={summary.storePerformance}
        companyId={companyId}
        storesNeedingAttention={summary.storesNeedingAttention}
      />

      {/* Seasonal Performance */}
      {summary.seasonalFlights.length > 0 && (
        <SeasonalPerformanceSection flights={summary.seasonalFlights} />
      )}

      {/* Insights & Alerts */}
      {summary.insights.length > 0 && (
        <InsightsSection
          insights={summary.insights}
          onCreateWorkItem={handleCreateWorkItem}
          isCreatingWorkItem={isCreatingWorkItem}
        />
      )}
    </div>
  );
}

// ============================================================================
// Date Range Selector
// ============================================================================

function DateRangeSelector({
  value,
  onChange,
}: {
  value: '7' | '30' | '90';
  onChange: (value: '7' | '30' | '90') => void;
}) {
  return (
    <div className="flex rounded-lg bg-slate-800 p-0.5">
      {(['7', '30', '90'] as const).map(d => (
        <button
          key={d}
          onClick={() => onChange(d)}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
            value === d
              ? 'bg-slate-700 text-slate-100'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          {d}d
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// KPI Overview Section
// ============================================================================

function KpiOverviewSection({ summary }: { summary: MediaAnalyticsSummary }) {
  const formatNumber = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toLocaleString();
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      <KpiCard
        label="Impressions"
        value={formatNumber(summary.totalImpressions)}
        color="text-slate-100"
      />
      <KpiCard
        label="Clicks"
        value={formatNumber(summary.totalClicks)}
        subValue={`${(summary.overallCtr * 100).toFixed(2)}% CTR`}
        color="text-blue-400"
      />
      <KpiCard
        label="Spend"
        value={summary.totalSpend ? formatMediaBudget(summary.totalSpend) : '—'}
        color="text-emerald-400"
      />
      <KpiCard
        label="Leads"
        value={formatNumber(summary.totalLeads)}
        color="text-amber-400"
      />
      <KpiCard
        label="CPL"
        value={summary.overallCpl ? `$${summary.overallCpl.toFixed(2)}` : '—'}
        color="text-purple-400"
      />
      <KpiCard
        label="Stores"
        value={summary.storeCount.toString()}
        subValue={summary.storesNeedingAttention > 0 ? `${summary.storesNeedingAttention} need attention` : undefined}
        color={summary.storesNeedingAttention > 0 ? 'text-red-400' : 'text-slate-100'}
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  subValue,
  color = 'text-slate-100',
}: {
  label: string;
  value: string;
  subValue?: string;
  color?: string;
}) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
      <p className="text-xs text-slate-400 uppercase tracking-wide mt-1">{label}</p>
      {subValue && <p className="text-xs text-slate-500 mt-0.5">{subValue}</p>}
    </div>
  );
}

// ============================================================================
// Channel Performance Section
// ============================================================================

function ChannelPerformanceSection({
  channels,
}: {
  channels: ChannelPerformanceMetrics[];
}) {
  if (channels.length === 0) {
    return (
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">Channel Performance</h3>
        <NotConnectedState
          title="No Channel Data"
          description="Connect GA4 or Google Ads to see channel-level performance"
        />
      </div>
    );
  }

  const totalSpend = channels.reduce((sum, c) => sum + (c.spend || 0), 0);

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-300 mb-4">Channel Performance</h3>

      {/* Visual Bar */}
      {totalSpend > 0 && (
        <div className="h-6 rounded-lg overflow-hidden flex mb-4 bg-slate-800">
          {channels.map(ch => {
            const pct = ch.spend ? (ch.spend / totalSpend) * 100 : 0;
            if (pct < 1) return null;
            const colors = MEDIA_CHANNEL_COLORS[ch.channel as keyof typeof MEDIA_CHANNEL_COLORS] || { bg: 'bg-slate-500' };
            return (
              <div
                key={ch.channel}
                className={`${colors.bg.replace('/10', '/60')} flex items-center justify-center transition-all`}
                style={{ width: `${pct}%` }}
                title={`${ch.channel}: ${formatMediaBudget(ch.spend)} (${pct.toFixed(1)}%)`}
              >
                {pct > 15 && (
                  <span className="text-[10px] font-medium text-white/90">{ch.channel}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700/50">
              <th className="text-left py-2 text-[10px] uppercase tracking-wider text-slate-500 font-medium">Channel</th>
              <th className="text-right py-2 text-[10px] uppercase tracking-wider text-slate-500 font-medium">Impressions</th>
              <th className="text-right py-2 text-[10px] uppercase tracking-wider text-slate-500 font-medium">Clicks</th>
              <th className="text-right py-2 text-[10px] uppercase tracking-wider text-slate-500 font-medium">CTR</th>
              <th className="text-right py-2 text-[10px] uppercase tracking-wider text-slate-500 font-medium">Spend</th>
              <th className="text-right py-2 text-[10px] uppercase tracking-wider text-slate-500 font-medium">Leads</th>
              <th className="text-right py-2 text-[10px] uppercase tracking-wider text-slate-500 font-medium">CPL</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {channels.map(ch => {
              const colors = MEDIA_CHANNEL_COLORS[ch.channel as keyof typeof MEDIA_CHANNEL_COLORS] || { text: 'text-slate-400', bg: 'bg-slate-800', border: 'border-slate-700' };
              return (
                <tr key={ch.channel} className="hover:bg-slate-800/30">
                  <td className="py-2.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors.text} ${colors.bg} border ${colors.border}`}>
                      {ch.channel}
                    </span>
                  </td>
                  <td className="py-2.5 text-right text-slate-300 tabular-nums">
                    {ch.impressions.toLocaleString()}
                  </td>
                  <td className="py-2.5 text-right text-slate-300 tabular-nums">
                    {ch.clicks.toLocaleString()}
                  </td>
                  <td className="py-2.5 text-right text-slate-400 tabular-nums">
                    {(ch.ctr * 100).toFixed(2)}%
                  </td>
                  <td className="py-2.5 text-right text-emerald-400 tabular-nums font-medium">
                    {ch.spend ? formatMediaBudget(ch.spend) : '—'}
                  </td>
                  <td className="py-2.5 text-right text-amber-400 tabular-nums font-medium">
                    {ch.leads.toLocaleString()}
                  </td>
                  <td className="py-2.5 text-right text-purple-400 tabular-nums">
                    {ch.cpl ? `$${ch.cpl.toFixed(2)}` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// Store Performance Section
// ============================================================================

function StorePerformanceSection({
  stores,
  companyId,
  storesNeedingAttention,
}: {
  stores: StorePerformanceRow[];
  companyId: string;
  storesNeedingAttention: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const displayedStores = showAll ? stores : stores.slice(0, 10);

  if (stores.length === 0) {
    return (
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">Store Performance</h3>
        <NotConnectedState
          title="No Store Data"
          description="Add stores in Airtable to track location-level performance"
        />
      </div>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-amber-400';
    return 'text-red-400';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-emerald-500/10';
    if (score >= 60) return 'bg-amber-500/10';
    return 'bg-red-500/10';
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-300">Store Performance</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {stores.length} stores &bull; Click any store for detailed drilldown
          </p>
        </div>
        {storesNeedingAttention > 0 && (
          <span className="text-xs text-red-400 bg-red-500/10 px-2 py-1 rounded border border-red-500/30">
            {storesNeedingAttention} need attention
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700/50">
              <th className="text-left py-2 text-[10px] uppercase tracking-wider text-slate-500 font-medium">Store</th>
              <th className="text-center py-2 text-[10px] uppercase tracking-wider text-slate-500 font-medium">Visibility</th>
              <th className="text-right py-2 text-[10px] uppercase tracking-wider text-slate-500 font-medium">Calls</th>
              <th className="text-right py-2 text-[10px] uppercase tracking-wider text-slate-500 font-medium">Directions</th>
              <th className="text-right py-2 text-[10px] uppercase tracking-wider text-slate-500 font-medium">Web Clicks</th>
              <th className="text-right py-2 text-[10px] uppercase tracking-wider text-slate-500 font-medium">Leads</th>
              <th className="text-right py-2 text-[10px] uppercase tracking-wider text-slate-500 font-medium">CPL</th>
              <th className="text-center py-2 text-[10px] uppercase tracking-wider text-slate-500 font-medium">Score</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {displayedStores.map(store => (
              <tr
                key={store.storeId}
                className="hover:bg-slate-800/30 cursor-pointer transition-colors group"
                onClick={() => window.location.href = `/c/${companyId}/media/store/${store.storeId}`}
              >
                <td className="py-2.5">
                  <div>
                    <p className="text-slate-200 font-medium group-hover:text-blue-400 transition-colors">{store.storeName}</p>
                    {store.marketName && (
                      <p className="text-xs text-slate-500">{store.marketName}</p>
                    )}
                  </div>
                </td>
                <td className="py-2.5 text-center">
                  <span className={`inline-flex items-center justify-center w-10 h-6 rounded text-xs font-bold tabular-nums ${getScoreColor(store.visibilityScore)} ${getScoreBg(store.visibilityScore)}`}>
                    {store.visibilityScore}
                  </span>
                </td>
                <td className="py-2.5 text-right text-slate-300 tabular-nums">
                  {store.calls.toLocaleString()}
                </td>
                <td className="py-2.5 text-right text-slate-400 tabular-nums">
                  {store.directionRequests.toLocaleString()}
                </td>
                <td className="py-2.5 text-right text-slate-400 tabular-nums">
                  {store.websiteClicks.toLocaleString()}
                </td>
                <td className="py-2.5 text-right text-amber-400 tabular-nums font-medium">
                  {store.leads.toLocaleString()}
                </td>
                <td className="py-2.5 text-right text-purple-400 tabular-nums">
                  {store.cpl ? `$${store.cpl.toFixed(2)}` : '—'}
                </td>
                <td className="py-2.5 text-center">
                  <span className={`inline-flex items-center justify-center w-10 h-6 rounded text-xs font-bold tabular-nums ${getScoreColor(store.overallScore)} ${getScoreBg(store.overallScore)}`}>
                    {store.overallScore}
                  </span>
                </td>
                <td className="py-2.5">
                  <svg className="w-4 h-4 text-slate-500 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {stores.length > 10 && (
        <div className="mt-4 text-center">
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-xs text-slate-400 hover:text-slate-300 transition-colors"
          >
            {showAll ? 'Show less' : `Show all ${stores.length} stores`}
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Seasonal Performance Section
// ============================================================================

function SeasonalPerformanceSection({
  flights,
}: {
  flights: SeasonalFlightPerformance[];
}) {
  const getStatusStyles = (status: SeasonalFlightPerformance['status']) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'upcoming':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'completed':
        return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
      default:
        return 'bg-slate-500/10 text-slate-500 border-slate-500/30';
    }
  };

  const formatDateRange = (start: string | null, end: string | null) => {
    if (!start && !end) return '—';
    const startStr = start ? new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'TBD';
    const endStr = end ? new Date(end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'TBD';
    return `${startStr} – ${endStr}`;
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-300">Seasonal Performance</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {flights.filter(f => f.status === 'active').length} active &bull;
            {' '}{flights.filter(f => f.status === 'upcoming').length} upcoming
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {flights.map(flight => (
          <div
            key={flight.flightId}
            className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-4"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-slate-200 truncate">{flight.flightName}</h4>
                {flight.season && (
                  <p className="text-xs text-slate-500">
                    {getSeasonLabel(flight.season as any)}
                  </p>
                )}
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded border ${getStatusStyles(flight.status)}`}>
                {flight.status}
              </span>
            </div>

            <div className="space-y-2 mt-3">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Dates</span>
                <span className="text-slate-300">{formatDateRange(flight.startDate, flight.endDate)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Budget</span>
                <span className="text-emerald-400 font-medium">
                  {flight.plannedBudget ? formatMediaBudget(flight.plannedBudget) : '—'}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Actual Spend</span>
                <span className="text-slate-300">
                  {flight.actualSpend ? formatMediaBudget(flight.actualSpend) : '—'}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Conversions</span>
                <span className="text-amber-400 font-medium">
                  {flight.conversions?.toLocaleString() || '—'}
                </span>
              </div>
              {flight.liftVsPrevious !== null && (
                <div className="flex justify-between text-xs pt-2 border-t border-slate-700/50">
                  <span className="text-slate-500">Lift vs Previous</span>
                  <span className={flight.liftVsPrevious >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                    {flight.liftVsPrevious >= 0 ? '+' : ''}{flight.liftVsPrevious.toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Insights Section
// ============================================================================

function InsightsSection({
  insights,
  onCreateWorkItem,
  isCreatingWorkItem,
}: {
  insights: MediaInsight[];
  onCreateWorkItem: (insight: MediaInsight) => void;
  isCreatingWorkItem: string | null;
}) {
  const getSeverityStyles = (severity: MediaInsight['severity']) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500/10 border-red-500/30 text-red-400';
      case 'warning':
        return 'bg-amber-500/10 border-amber-500/30 text-amber-400';
      case 'success':
        return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
      default:
        return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
    }
  };

  const getTypeIcon = (type: MediaInsight['type']) => {
    switch (type) {
      case 'trend':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        );
      case 'anomaly':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      case 'recommendation':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        );
    }
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-300">Insights & Alerts</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            AI-generated insights from your media data
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {insights.map(insight => (
          <div
            key={insight.id}
            className={`rounded-lg border p-4 ${getSeverityStyles(insight.severity)}`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                {getTypeIcon(insight.type)}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium">{insight.title}</h4>
                <p className="text-xs opacity-80 mt-1">{insight.description}</p>
              </div>
              {insight.actionable && (
                <button
                  onClick={() => onCreateWorkItem(insight)}
                  disabled={isCreatingWorkItem === insight.id}
                  className="flex-shrink-0 px-2.5 py-1 text-[10px] font-medium rounded bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-50"
                >
                  {isCreatingWorkItem === insight.id ? 'Creating...' : 'Create Work Item'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Empty States
// ============================================================================

function NoMediaPlansState({ companyId }: { companyId: string }) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 text-center">
      <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-slate-800 mb-6">
        <svg className="h-8 w-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-slate-200 mb-2">
        No Media Program Yet
      </h2>
      <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
        Create a media plan in Media Lab to start tracking channel performance, store metrics, and seasonal campaigns.
      </p>
      <Link
        href={`/c/${companyId}/diagnostics/media`}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium text-sm transition-colors"
      >
        Open Media Lab
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}

function NoDataState({ companyId }: { companyId: string }) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 text-center">
      <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-slate-800 mb-6">
        <svg className="h-8 w-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-slate-200 mb-2">
        No Performance Data Yet
      </h2>
      <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
        Connect analytics integrations or sync performance data to see channel metrics, store scorecards, and insights.
      </p>
      <div className="flex items-center justify-center gap-3">
        <Link
          href={`/c/${companyId}/settings`}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium text-sm transition-colors"
        >
          Connect Integrations
        </Link>
        <Link
          href={`/c/${companyId}/diagnostics/media`}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 font-medium text-sm transition-colors"
        >
          Open Media Lab
        </Link>
      </div>
    </div>
  );
}

function NotConnectedState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="text-center py-8">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 mb-4">
        <svg className="h-6 w-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      </div>
      <h4 className="text-sm font-medium text-slate-300 mb-1">{title}</h4>
      <p className="text-xs text-slate-500">{description}</p>
    </div>
  );
}
