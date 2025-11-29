'use client';

// app/analytics/dma/DmaFunnelClient.tsx
// DMA Funnel Analytics Client Component with Charts, Global AI Cache, and Blueprint

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { AuditFunnelSnapshot } from '@/lib/ga4Client';
import {
  getCachedInsights,
  setCachedInsights,
  invalidateInsightsCache,
} from '@/lib/ai/insightsCache';

interface DmaFunnelClientProps {
  initialSnapshot: AuditFunnelSnapshot;
  initialRange: { startDate: string; endDate: string };
}

type DateRangeOption = '7' | '30' | '90';

// DMA Funnel Insights type (matches API response)
interface DmaFunnelInsights {
  summary: string;
  headlineMetrics: Array<{
    label: string;
    value: string;
    trend?: 'up' | 'down' | 'flat';
  }>;
  keyInsights: Array<{
    title: string;
    detail: string;
    evidence: string;
    type: 'positive' | 'warning' | 'neutral';
  }>;
  quickWins: string[];
  experiments: Array<{
    name: string;
    hypothesis: string;
    successMetric: string;
  }>;
}

// DMA Analytics Blueprint type
interface DmaAnalyticsBlueprint {
  objectives: string[];
  notesForStrategist: string;
  focusAreas: Array<{
    area: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    metrics: string[];
  }>;
  channelStrategies: Array<{
    channel: string;
    status: 'strong' | 'improving' | 'needs-work' | 'untapped';
    recommendation: string;
  }>;
  optimizationPriorities: Array<{
    title: string;
    impact: 'high' | 'medium' | 'low';
    effort: 'low' | 'medium' | 'high';
    description: string;
  }>;
  generatedAt: string;
}

// Custom tooltip for charts
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-lg">
      <p className="text-slate-300 text-sm font-medium mb-1">{label}</p>
      {payload.map((entry: any, idx: number) => (
        <p key={idx} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {entry.value.toLocaleString()}
          {entry.name.includes('Rate') ? '%' : ''}
        </p>
      ))}
    </div>
  );
}

export default function DmaFunnelClient({
  initialSnapshot,
  initialRange,
}: DmaFunnelClientProps) {
  const [range, setRange] = useState(initialRange);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  // AI Insights state
  const [insights, setInsights] = useState<DmaFunnelInsights | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  // Blueprint state
  const [blueprint, setBlueprint] = useState<DmaAnalyticsBlueprint | null>(null);
  const [loadingBlueprint, setLoadingBlueprint] = useState(false);
  const [blueprintError, setBlueprintError] = useState<string | null>(null);

  // Active tab
  const [activeTab, setActiveTab] = useState<'insights' | 'blueprint'>('insights');

  // Work item creation state
  const [creatingWorkItem, setCreatingWorkItem] = useState<string | null>(null);
  const [workItemSuccess, setWorkItemSuccess] = useState<string | null>(null);

  // Create work item from DMA insight
  const createDmaWorkItem = async (
    title: string,
    description: string,
    itemType: 'quick_win' | 'experiment' | 'blueprint_action',
    priority?: 'low' | 'medium' | 'high'
  ) => {
    const itemKey = `${itemType}-${title.slice(0, 20)}`;
    setCreatingWorkItem(itemKey);
    setWorkItemSuccess(null);

    try {
      const response = await fetch('/api/os/dma/work-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.slice(0, 100),
          description,
          itemType,
          priority: priority || 'medium',
          dateRange: `${range.startDate} to ${range.endDate}`,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create work item');
      }

      setWorkItemSuccess(itemKey);
      setTimeout(() => setWorkItemSuccess(null), 3000);
    } catch (error) {
      console.error('Error creating work item:', error);
      alert('Failed to create work item. Please try again.');
    } finally {
      setCreatingWorkItem(null);
    }
  };

  // Determine active range option
  const getActiveDays = (): DateRangeOption => {
    const start = new Date(range.startDate);
    const end = new Date(range.endDate);
    const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    if (diffDays <= 7) return '7';
    if (diffDays <= 30) return '30';
    return '90';
  };

  const [activeDays, setActiveDays] = useState<DateRangeOption>(getActiveDays());

  // Generate cache key from date range
  const dateRangeKey = `${range.startDate}_${range.endDate}`;

  // Fetch AI insights with global caching
  const fetchInsights = async (snap: AuditFunnelSnapshot, rangeKey: string) => {
    // Check global cache first
    const cached = getCachedInsights<DmaFunnelInsights>('dma-funnel', rangeKey);
    if (cached) {
      setInsights(cached);
      return;
    }

    setLoadingInsights(true);
    setInsightsError(null);

    try {
      const response = await fetch('/api/os/dma/ai-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot: snap }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate insights');
      }

      const data = await response.json();
      setInsights(data.insights);

      // Cache the insights globally
      setCachedInsights('dma-funnel', rangeKey, data.insights, 24);
    } catch (error) {
      console.error('Error fetching DMA insights:', error);
      setInsightsError(error instanceof Error ? error.message : 'Failed to load insights');
    } finally {
      setLoadingInsights(false);
    }
  };

  // Fetch Blueprint
  const fetchBlueprint = async (snap: AuditFunnelSnapshot) => {
    // Check global cache first
    const cacheKey = `blueprint_${dateRangeKey}`;
    const cached = getCachedInsights<DmaAnalyticsBlueprint>('dma-funnel', cacheKey);
    if (cached) {
      setBlueprint(cached);
      return;
    }

    setLoadingBlueprint(true);
    setBlueprintError(null);

    try {
      const response = await fetch('/api/os/dma/blueprint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot: snap }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate blueprint');
      }

      const data = await response.json();
      setBlueprint(data.blueprint);

      // Cache the blueprint globally
      setCachedInsights('dma-funnel', cacheKey, data.blueprint, 24);
    } catch (error) {
      console.error('Error fetching DMA blueprint:', error);
      setBlueprintError(error instanceof Error ? error.message : 'Failed to load blueprint');
    } finally {
      setLoadingBlueprint(false);
    }
  };

  // Fetch insights on mount
  useEffect(() => {
    if (snapshot && !insights && !loadingInsights) {
      fetchInsights(snapshot, dateRangeKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDateRangeChange = async (days: DateRangeOption) => {
    setActiveDays(days);
    setLoadingMetrics(true);
    setMetricsError(null);
    setInsights(null);
    setBlueprint(null);

    try {
      const today = new Date();
      const startDate = new Date(today);
      const daysNum = parseInt(days, 10);
      startDate.setDate(today.getDate() - (daysNum - 1));

      const start = startDate.toISOString().split('T')[0];
      const end = today.toISOString().split('T')[0];
      const newRangeKey = `${start}_${end}`;

      const response = await fetch(`/api/os/dma/metrics?start=${start}&end=${end}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch metrics');
      }

      const data = await response.json();
      setSnapshot(data.snapshot);
      setRange({ startDate: start, endDate: end });

      // Fetch new insights (will check cache)
      fetchInsights(data.snapshot, newRangeKey);
    } catch (error) {
      console.error('Error fetching metrics:', error);
      setMetricsError("We couldn't load DMA metrics. Check GA4 credentials and try again.");
    } finally {
      setLoadingMetrics(false);
    }
  };

  // Refresh insights (clear cache and refetch)
  const handleRefreshInsights = () => {
    invalidateInsightsCache('dma-funnel', dateRangeKey);
    setInsights(null);
    fetchInsights(snapshot, dateRangeKey);
  };

  // Refresh blueprint (clear cache and refetch)
  const handleRefreshBlueprint = () => {
    invalidateInsightsCache('dma-funnel', `blueprint_${dateRangeKey}`);
    setBlueprint(null);
    fetchBlueprint(snapshot);
  };

  // Prepare chart data
  const timeSeriesData = useMemo(() => {
    return snapshot.timeSeries.map((point) => ({
      date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      Started: point.auditsStarted,
      Completed: point.auditsCompleted,
      'Completion Rate': Math.round(point.completionRate * 100),
    }));
  }, [snapshot.timeSeries]);

  const channelData = useMemo(() => {
    return snapshot.byChannel.map((ch) => ({
      name: ch.channel,
      Started: ch.auditsStarted,
      Completed: ch.auditsCompleted,
      rate: Math.round(ch.completionRate * 100),
    }));
  }, [snapshot.byChannel]);

  const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;
  const formatNumber = (value: number) => value.toLocaleString();

  if (metricsError) {
    return (
      <div className="p-8">
        <div className="bg-red-900/20 border border-red-700 rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-red-400 mb-2">Error Loading Metrics</h2>
          <p className="text-slate-300">{metricsError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Workspace Analytics Breadcrumb */}
      <div className="mb-4">
        <Link
          href="/analytics/os"
          className="text-xs text-slate-500 hover:text-slate-400 transition-colors flex items-center gap-1"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Part of Workspace Analytics
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 lg:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 mb-1 sm:mb-2">DMA Funnel</h1>
          <p className="text-sm sm:text-base text-slate-400">
            Performance of the <span className="text-amber-400">DigitalMarketingAudit.ai</span> acquisition funnel.
          </p>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {range.startDate} to {range.endDate}
          </p>
        </div>

        {/* Date Range Selector */}
        <div className="flex gap-2 mt-4 md:mt-0">
          {(['7', '30', '90'] as DateRangeOption[]).map((days) => (
            <button
              key={days}
              onClick={() => handleDateRangeChange(days)}
              disabled={loadingMetrics}
              className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeDays === days
                  ? 'bg-amber-500 text-slate-900'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              } ${loadingMetrics ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {days}d
            </button>
          ))}
        </div>
      </div>

      {/* Main Content: Metrics + AI Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Left Column: Metrics (2/3 width) */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-4 sm:p-6 overflow-hidden">
              <div className="text-xs sm:text-sm text-slate-400 mb-1 sm:mb-2 truncate">Audits Started</div>
              <div className="text-xl sm:text-3xl font-bold text-slate-100 truncate">
                {loadingMetrics ? '...' : formatNumber(snapshot.totals.auditsStarted)}
              </div>
            </div>
            <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-4 sm:p-6 overflow-hidden">
              <div className="text-xs sm:text-sm text-slate-400 mb-1 sm:mb-2 truncate">Audits Completed</div>
              <div className="text-xl sm:text-3xl font-bold text-slate-100 truncate">
                {loadingMetrics ? '...' : formatNumber(snapshot.totals.auditsCompleted)}
              </div>
            </div>
            <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-4 sm:p-6 overflow-hidden">
              <div className="text-xs sm:text-sm text-slate-400 mb-1 sm:mb-2 truncate">Completion Rate</div>
              <div className="text-xl sm:text-3xl font-bold text-emerald-400 truncate">
                {loadingMetrics ? '...' : formatPercent(snapshot.totals.completionRate)}
              </div>
            </div>
            <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-4 sm:p-6 overflow-hidden">
              <div className="text-xs sm:text-sm text-slate-400 mb-1 sm:mb-2 truncate">Unique Users</div>
              <div className="text-xl sm:text-3xl font-bold text-slate-100 truncate">
                {loadingMetrics
                  ? '...'
                  : snapshot.totals.uniqueUsers !== null
                  ? formatNumber(snapshot.totals.uniqueUsers)
                  : '–'}
              </div>
            </div>
          </div>

          {/* Time Series Chart */}
          {timeSeriesData.length > 0 && (
            <div className="bg-slate-900/70 border border-slate-800 rounded-lg overflow-hidden">
              <div className="p-4 sm:p-6 border-b border-slate-800">
                <h2 className="text-base sm:text-lg font-semibold text-slate-100">Daily Funnel Performance</h2>
              </div>
              <div className="p-4 sm:p-6">
                <div className="h-56 sm:h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={timeSeriesData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis
                        dataKey="date"
                        stroke="#64748b"
                        fontSize={12}
                        tickLine={false}
                      />
                      <YAxis
                        stroke="#64748b"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend
                        wrapperStyle={{ paddingTop: '20px' }}
                        formatter={(value) => <span className="text-slate-400 text-sm">{value}</span>}
                      />
                      <Line
                        type="monotone"
                        dataKey="Started"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, fill: '#f59e0b' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="Completed"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, fill: '#10b981' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Channel Performance Bar Chart */}
          {channelData.length > 0 && (
            <div className="bg-slate-900/70 border border-slate-800 rounded-lg overflow-hidden">
              <div className="p-4 sm:p-6 border-b border-slate-800">
                <h2 className="text-base sm:text-lg font-semibold text-slate-100">Performance by Channel</h2>
              </div>
              <div className="p-4 sm:p-6">
                <div className="h-48 sm:h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={channelData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                      <XAxis type="number" stroke="#64748b" fontSize={12} tickLine={false} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        stroke="#64748b"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        width={100}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend
                        wrapperStyle={{ paddingTop: '10px' }}
                        formatter={(value) => <span className="text-slate-400 text-sm">{value}</span>}
                      />
                      <Bar dataKey="Started" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="Completed" fill="#10b981" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              {/* Channel Table */}
              <div className="border-t border-slate-800 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 bg-slate-900/50">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">Channel</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-slate-400 uppercase">Started</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-slate-400 uppercase">Completed</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-slate-400 uppercase">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.byChannel.map((channel) => (
                      <tr key={channel.channel} className="border-b border-slate-800/50 last:border-0">
                        <td className="py-3 px-4 text-slate-200 font-medium">{channel.channel}</td>
                        <td className="py-3 px-4 text-right text-slate-300">
                          {formatNumber(channel.auditsStarted)}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-300">
                          {formatNumber(channel.auditsCompleted)}
                        </td>
                        <td className="py-3 px-4 text-right text-emerald-400 font-semibold">
                          {formatPercent(channel.completionRate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* By Campaign */}
          {snapshot.byCampaign.length > 0 && (
            <div className="bg-slate-900/70 border border-slate-800 rounded-lg overflow-hidden">
              <div className="p-4 sm:p-6 border-b border-slate-800">
                <h2 className="text-base sm:text-lg font-semibold text-slate-100">Performance by Campaign</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 bg-slate-900/50">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">Campaign</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">Source/Medium</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-slate-400 uppercase">Started</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-slate-400 uppercase">Completed</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-slate-400 uppercase">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.byCampaign.map((campaign, idx) => (
                      <tr key={idx} className="border-b border-slate-800/50 last:border-0">
                        <td className="py-3 px-4 text-slate-200 font-medium">{campaign.campaign}</td>
                        <td className="py-3 px-4 text-slate-400 text-xs">{campaign.sourceMedium}</td>
                        <td className="py-3 px-4 text-right text-slate-300">
                          {formatNumber(campaign.auditsStarted)}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-300">
                          {formatNumber(campaign.auditsCompleted)}
                        </td>
                        <td className="py-3 px-4 text-right text-emerald-400 font-semibold">
                          {formatPercent(campaign.completionRate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: AI Panel with Tabs (1/3 width) */}
        <div className="space-y-4 sm:space-y-6 min-w-0">
          {/* Tab Selector */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('insights')}
              className={`flex-1 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'insights'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              AI Insights
            </button>
            <button
              onClick={() => {
                setActiveTab('blueprint');
                if (!blueprint && !loadingBlueprint) {
                  fetchBlueprint(snapshot);
                }
              }}
              className={`flex-1 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'blueprint'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              Blueprint
            </button>
          </div>

          {/* AI Insights Tab */}
          {activeTab === 'insights' && (
            <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-lg p-4 sm:p-6 lg:sticky lg:top-6 overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.477.859h4z" />
                  </svg>
                  <h2 className="text-lg font-semibold text-blue-100">AI Insights</h2>
                </div>
                {insights && (
                  <button
                    onClick={handleRefreshInsights}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    title="Refresh insights"
                  >
                    Refresh
                  </button>
                )}
              </div>
              <p className="text-xs text-blue-300/70 mb-4">
                AI-powered analysis • Cached for 24h
              </p>

              {loadingInsights && (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400" />
                  <p className="text-blue-200 text-sm mt-3">Analyzing funnel data...</p>
                </div>
              )}

              {insightsError && !loadingInsights && (
                <div className="bg-red-500/10 border border-red-500/30 rounded p-4">
                  <p className="text-red-400 text-sm">{insightsError}</p>
                  <button
                    onClick={() => fetchInsights(snapshot, dateRangeKey)}
                    className="mt-2 text-xs text-red-300 hover:text-red-200"
                  >
                    Try again
                  </button>
                </div>
              )}

              {insights && !loadingInsights && (
                <div className="space-y-5">
                  {/* Summary */}
                  <div className="text-sm text-blue-100 leading-relaxed">
                    {insights.summary}
                  </div>

                  {/* Headline Metrics */}
                  {insights.headlineMetrics.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {insights.headlineMetrics.map((metric, idx) => (
                        <div key={idx} className="bg-slate-900/50 rounded p-2 text-center overflow-hidden">
                          <div className="text-xs text-slate-500 truncate">{metric.label}</div>
                          <div className="text-sm font-semibold text-slate-200 flex items-center justify-center gap-1 truncate">
                            <span className="truncate">{metric.value}</span>
                            {metric.trend === 'up' && <span className="text-emerald-400 flex-shrink-0">↑</span>}
                            {metric.trend === 'down' && <span className="text-red-400 flex-shrink-0">↓</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Key Insights */}
                  {insights.keyInsights.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-blue-100 mb-2">Key Insights</h3>
                      <div className="space-y-3">
                        {insights.keyInsights.map((insight, idx) => (
                          <div
                            key={idx}
                            className={`bg-slate-900/50 border rounded p-3 ${
                              insight.type === 'positive'
                                ? 'border-emerald-500/30'
                                : insight.type === 'warning'
                                ? 'border-amber-500/30'
                                : 'border-slate-700'
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              {insight.type === 'positive' && (
                                <span className="text-emerald-400 mt-0.5">✓</span>
                              )}
                              {insight.type === 'warning' && (
                                <span className="text-amber-400 mt-0.5">⚠</span>
                              )}
                              {insight.type === 'neutral' && (
                                <span className="text-blue-400 mt-0.5">→</span>
                              )}
                              <div>
                                <div className="font-medium text-slate-200 text-sm">{insight.title}</div>
                                <div className="text-xs text-slate-400 mt-1">{insight.detail}</div>
                                <div className="text-xs text-slate-500 italic mt-1">{insight.evidence}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quick Wins */}
                  {insights.quickWins.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-blue-100 mb-2">Quick Wins</h3>
                      <ul className="space-y-2">
                        {insights.quickWins.map((win, idx) => {
                          const itemKey = `quick_win-${win.slice(0, 20)}`;
                          const isCreating = creatingWorkItem === itemKey;
                          const isSuccess = workItemSuccess === itemKey;
                          return (
                            <li key={idx} className="flex items-start gap-2 text-sm text-blue-200">
                              <span className="text-emerald-400 mt-0.5 flex-shrink-0">•</span>
                              <div className="flex-1 min-w-0">
                                <span className="break-words">{win}</span>
                                <button
                                  onClick={() => createDmaWorkItem(win.slice(0, 80), win, 'quick_win', 'medium')}
                                  disabled={isCreating}
                                  className={`mt-1.5 text-xs px-2 py-0.5 rounded transition-colors ${
                                    isSuccess
                                      ? 'bg-emerald-500/20 text-emerald-300'
                                      : isCreating
                                      ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                      : 'bg-blue-500/10 text-blue-300 hover:bg-blue-500/20'
                                  }`}
                                >
                                  {isSuccess ? 'Created!' : isCreating ? 'Creating...' : '+ Work Item'}
                                </button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  {/* Experiments */}
                  {insights.experiments.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-blue-100 mb-2">Experiments to Try</h3>
                      <div className="space-y-2">
                        {insights.experiments.map((exp, idx) => {
                          const itemKey = `experiment-${exp.name.slice(0, 20)}`;
                          const isCreating = creatingWorkItem === itemKey;
                          const isSuccess = workItemSuccess === itemKey;
                          const description = `${exp.hypothesis}\n\nSuccess Metric: ${exp.successMetric}`;
                          return (
                            <div
                              key={idx}
                              className="bg-slate-900/50 border border-slate-700 rounded p-3 overflow-hidden"
                            >
                              <div className="font-medium text-slate-200 text-sm break-words">{exp.name}</div>
                              <div className="text-xs text-slate-400 mt-1 break-words">{exp.hypothesis}</div>
                              <div className="text-xs text-purple-400 mt-1 break-words">
                                Success: {exp.successMetric}
                              </div>
                              <button
                                onClick={() => createDmaWorkItem(`Experiment: ${exp.name}`, description, 'experiment', 'medium')}
                                disabled={isCreating}
                                className={`mt-2 text-xs px-2 py-0.5 rounded transition-colors ${
                                  isSuccess
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : isCreating
                                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                    : 'bg-purple-500/10 text-purple-300 hover:bg-purple-500/20'
                                }`}
                              >
                                {isSuccess ? 'Created!' : isCreating ? 'Creating...' : '+ Add as Experiment'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Link to Pipeline Leads */}
              <div className="mt-6 pt-6 border-t border-blue-500/20">
                <Link
                  href="/pipeline/leads"
                  className="text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  View DMA Leads in Pipeline →
                </Link>
              </div>
            </div>
          )}

          {/* Blueprint Tab */}
          {activeTab === 'blueprint' && (
            <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-lg p-4 sm:p-6 lg:sticky lg:top-6 overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <h2 className="text-lg font-semibold text-amber-100">Analytics Blueprint</h2>
                </div>
                {blueprint && (
                  <button
                    onClick={handleRefreshBlueprint}
                    className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                    title="Regenerate blueprint"
                  >
                    Regenerate
                  </button>
                )}
              </div>
              <p className="text-xs text-amber-300/70 mb-4">
                AI-powered strategic planning • Cached for 24h
              </p>

              {loadingBlueprint && (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
                  <p className="text-amber-200 text-sm mt-3">Generating blueprint...</p>
                </div>
              )}

              {blueprintError && !loadingBlueprint && (
                <div className="bg-red-500/10 border border-red-500/30 rounded p-4">
                  <p className="text-red-400 text-sm">{blueprintError}</p>
                  <button
                    onClick={() => fetchBlueprint(snapshot)}
                    className="mt-2 text-xs text-red-300 hover:text-red-200"
                  >
                    Try again
                  </button>
                </div>
              )}

              {!blueprint && !loadingBlueprint && !blueprintError && (
                <div className="text-center py-8">
                  <p className="text-amber-200/70 text-sm mb-4">
                    Generate an AI-powered blueprint to get strategic recommendations for your DMA funnel.
                  </p>
                  <button
                    onClick={() => fetchBlueprint(snapshot)}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium rounded-lg transition-colors text-sm"
                  >
                    Generate Blueprint
                  </button>
                </div>
              )}

              {blueprint && !loadingBlueprint && (
                <div className="space-y-5">
                  {/* Notes for Strategist */}
                  <div className="text-sm text-amber-100 leading-relaxed">
                    {blueprint.notesForStrategist}
                  </div>

                  {/* Objectives */}
                  {blueprint.objectives.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-amber-100 mb-2">Objectives</h3>
                      <div className="flex flex-wrap gap-2">
                        {blueprint.objectives.map((obj, idx) => (
                          <span
                            key={idx}
                            className="text-xs px-2 py-1 bg-amber-500/10 text-amber-300 rounded-full"
                          >
                            {obj}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Focus Areas */}
                  {blueprint.focusAreas.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-amber-100 mb-2">Focus Areas</h3>
                      <div className="space-y-2">
                        {blueprint.focusAreas.map((area, idx) => (
                          <div
                            key={idx}
                            className={`bg-slate-900/50 border rounded p-3 ${
                              area.priority === 'high'
                                ? 'border-red-500/30'
                                : area.priority === 'medium'
                                ? 'border-amber-500/30'
                                : 'border-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-slate-200 text-sm">{area.area}</span>
                              <span
                                className={`text-xs px-1.5 py-0.5 rounded ${
                                  area.priority === 'high'
                                    ? 'bg-red-500/20 text-red-300'
                                    : area.priority === 'medium'
                                    ? 'bg-amber-500/20 text-amber-300'
                                    : 'bg-slate-600/20 text-slate-300'
                                }`}
                              >
                                {area.priority}
                              </span>
                            </div>
                            <div className="text-xs text-slate-400">{area.description}</div>
                            {area.metrics.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {area.metrics.map((m, i) => (
                                  <span key={i} className="text-xs px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded">
                                    {m}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Channel Strategies */}
                  {blueprint.channelStrategies.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-amber-100 mb-2">Channel Strategies</h3>
                      <div className="space-y-2">
                        {blueprint.channelStrategies.map((ch, idx) => (
                          <div key={idx} className="bg-slate-900/50 border border-slate-700 rounded p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-slate-200 text-sm">{ch.channel}</span>
                              <span
                                className={`text-xs px-1.5 py-0.5 rounded ${
                                  ch.status === 'strong'
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : ch.status === 'improving'
                                    ? 'bg-blue-500/20 text-blue-300'
                                    : ch.status === 'needs-work'
                                    ? 'bg-red-500/20 text-red-300'
                                    : 'bg-purple-500/20 text-purple-300'
                                }`}
                              >
                                {ch.status}
                              </span>
                            </div>
                            <div className="text-xs text-slate-400">{ch.recommendation}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Optimization Priorities */}
                  {blueprint.optimizationPriorities.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-amber-100 mb-2">Optimization Priorities</h3>
                      <div className="space-y-2">
                        {blueprint.optimizationPriorities.map((opt, idx) => {
                          const itemKey = `blueprint_action-${opt.title.slice(0, 20)}`;
                          const isCreating = creatingWorkItem === itemKey;
                          const isSuccess = workItemSuccess === itemKey;
                          const description = `${opt.description}\n\nImpact: ${opt.impact}\nEffort: ${opt.effort}`;
                          const priority = opt.impact === 'high' ? 'high' : opt.impact === 'medium' ? 'medium' : 'low';
                          return (
                            <div key={idx} className="bg-slate-900/50 border border-slate-700 rounded p-3">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="font-medium text-slate-200 text-sm">{opt.title}</span>
                                <span
                                  className={`text-xs px-1.5 py-0.5 rounded ${
                                    opt.impact === 'high'
                                      ? 'bg-emerald-500/20 text-emerald-300'
                                      : opt.impact === 'medium'
                                      ? 'bg-amber-500/20 text-amber-300'
                                      : 'bg-slate-600/20 text-slate-300'
                                  }`}
                                >
                                  {opt.impact} impact
                                </span>
                                <span
                                  className={`text-xs px-1.5 py-0.5 rounded ${
                                    opt.effort === 'low'
                                      ? 'bg-emerald-500/20 text-emerald-300'
                                      : opt.effort === 'medium'
                                      ? 'bg-amber-500/20 text-amber-300'
                                      : 'bg-red-500/20 text-red-300'
                                  }`}
                                >
                                  {opt.effort} effort
                                </span>
                              </div>
                              <div className="text-xs text-slate-400">{opt.description}</div>
                              <button
                                onClick={() => createDmaWorkItem(opt.title, description, 'blueprint_action', priority as 'low' | 'medium' | 'high')}
                                disabled={isCreating}
                                className={`mt-2 text-xs px-2 py-0.5 rounded transition-colors ${
                                  isSuccess
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : isCreating
                                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                    : 'bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                                }`}
                              >
                                {isSuccess ? 'Created!' : isCreating ? 'Creating...' : '+ Create Work Item'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Generated timestamp */}
                  <div className="text-xs text-slate-500 pt-2 border-t border-amber-500/20">
                    Generated: {new Date(blueprint.generatedAt).toLocaleString()}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
