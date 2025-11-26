'use client';

// app/analytics/dma/DmaFunnelClient.tsx
// DMA Funnel Analytics Client Component

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { AuditFunnelSnapshot } from '@/lib/ga4Client';

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

  // Fetch AI insights
  const fetchInsights = async (snap: AuditFunnelSnapshot) => {
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
    } catch (error) {
      console.error('Error fetching DMA insights:', error);
      setInsightsError(error instanceof Error ? error.message : 'Failed to load insights');
    } finally {
      setLoadingInsights(false);
    }
  };

  // Fetch insights on mount
  useEffect(() => {
    if (snapshot && !insights && !loadingInsights) {
      fetchInsights(snapshot);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDateRangeChange = async (days: DateRangeOption) => {
    setActiveDays(days);
    setLoadingMetrics(true);
    setMetricsError(null);
    setInsights(null); // Clear old insights

    try {
      const today = new Date();
      const startDate = new Date(today);
      const daysNum = parseInt(days, 10);
      startDate.setDate(today.getDate() - (daysNum - 1));

      const start = startDate.toISOString().split('T')[0];
      const end = today.toISOString().split('T')[0];

      const response = await fetch(`/api/os/dma/metrics?start=${start}&end=${end}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch metrics');
      }

      const data = await response.json();
      setSnapshot(data.snapshot);
      setRange({ startDate: start, endDate: end });

      // Fetch new insights
      fetchInsights(data.snapshot);
    } catch (error) {
      console.error('Error fetching metrics:', error);
      setMetricsError("We couldn't load DMA metrics. Check GA4 credentials and try again.");
    } finally {
      setLoadingMetrics(false);
    }
  };

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
    <div className="p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-100 mb-2">DMA Funnel</h1>
          <p className="text-slate-400">
            Performance of the <span className="text-amber-400">DigitalMarketingAudit.ai</span> acquisition funnel.
          </p>
          <p className="text-sm text-slate-500 mt-1">
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
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeDays === days
                  ? 'bg-amber-500 text-slate-900'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              } ${loadingMetrics ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {days} days
            </button>
          ))}
        </div>
      </div>

      {/* Main Content: Metrics + AI Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Metrics (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-6 overflow-hidden">
              <div className="text-sm text-slate-400 mb-2 truncate">Audits Started</div>
              <div className="text-3xl font-bold text-slate-100 truncate">
                {loadingMetrics ? '...' : formatNumber(snapshot.totals.auditsStarted)}
              </div>
            </div>
            <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-6 overflow-hidden">
              <div className="text-sm text-slate-400 mb-2 truncate">Audits Completed</div>
              <div className="text-3xl font-bold text-slate-100 truncate">
                {loadingMetrics ? '...' : formatNumber(snapshot.totals.auditsCompleted)}
              </div>
            </div>
            <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-6 overflow-hidden">
              <div className="text-sm text-slate-400 mb-2 truncate">Completion Rate</div>
              <div className="text-3xl font-bold text-emerald-400 truncate">
                {loadingMetrics ? '...' : formatPercent(snapshot.totals.completionRate)}
              </div>
            </div>
            <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-6 overflow-hidden">
              <div className="text-sm text-slate-400 mb-2 truncate">Unique Users</div>
              <div className="text-3xl font-bold text-slate-100 truncate">
                {loadingMetrics
                  ? '...'
                  : snapshot.totals.uniqueUsers !== null
                  ? formatNumber(snapshot.totals.uniqueUsers)
                  : '–'}
              </div>
            </div>
          </div>

          {/* By Channel */}
          {snapshot.byChannel.length > 0 && (
            <div className="bg-slate-900/70 border border-slate-800 rounded-lg overflow-hidden">
              <div className="p-6 border-b border-slate-800">
                <h2 className="text-lg font-semibold text-slate-100">Performance by Channel</h2>
              </div>
              <div className="overflow-x-auto">
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
              <div className="p-6 border-b border-slate-800">
                <h2 className="text-lg font-semibold text-slate-100">Performance by Campaign</h2>
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

          {/* Time Series */}
          {snapshot.timeSeries.length > 0 && (
            <div className="bg-slate-900/70 border border-slate-800 rounded-lg overflow-hidden">
              <div className="p-6 border-b border-slate-800">
                <h2 className="text-lg font-semibold text-slate-100">Daily Performance</h2>
              </div>
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-900">
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">Date</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-slate-400 uppercase">Started</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-slate-400 uppercase">Completed</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-slate-400 uppercase">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.timeSeries.map((point) => (
                      <tr key={point.date} className="border-b border-slate-800/50 last:border-0">
                        <td className="py-3 px-4 text-slate-300">{point.date}</td>
                        <td className="py-3 px-4 text-right text-slate-300">
                          {formatNumber(point.auditsStarted)}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-300">
                          {formatNumber(point.auditsCompleted)}
                        </td>
                        <td className="py-3 px-4 text-right text-emerald-400 font-semibold">
                          {formatPercent(point.completionRate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: AI Insights Panel (1/3 width) */}
        <div className="space-y-6 min-w-0">
          <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-lg p-6 sticky top-6 overflow-hidden">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.477.859h4z" />
              </svg>
              <h2 className="text-lg font-semibold text-blue-100">DMA Funnel Insights</h2>
            </div>
            <p className="text-xs text-blue-300/70 mb-4">
              AI-powered analysis of your DigitalMarketingAudit.ai acquisition funnel
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
                      {insights.quickWins.map((win, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-blue-200">
                          <span className="text-emerald-400 mt-0.5">•</span>
                          <span>{win}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Experiments */}
                {insights.experiments.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-blue-100 mb-2">Experiments to Try</h3>
                    <div className="space-y-2">
                      {insights.experiments.map((exp, idx) => (
                        <div
                          key={idx}
                          className="bg-slate-900/50 border border-slate-700 rounded p-3 overflow-hidden"
                        >
                          <div className="font-medium text-slate-200 text-sm break-words">{exp.name}</div>
                          <div className="text-xs text-slate-400 mt-1 break-words">{exp.hypothesis}</div>
                          <div className="text-xs text-purple-400 mt-1 break-words">
                            Success: {exp.successMetric}
                          </div>
                        </div>
                      ))}
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
        </div>
      </div>
    </div>
  );
}
