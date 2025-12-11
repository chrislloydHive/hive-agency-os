'use client';

// app/c/[companyId]/insights/InsightsClient.tsx
// Full insights page with digest view and filtering

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Lightbulb,
  RefreshCw,
  Filter,
  ChevronRight,
  ArrowLeft,
  Target,
  Clock,
  Zap,
} from 'lucide-react';
import type {
  Insight,
  InsightSeverity,
  InsightTheme,
  WeeklyInsightDigest,
} from '@/lib/os/insights/insightTypes.client';
import {
  getSeverityColorClasses,
  getThemeLabel,
  getTimeframeLabel,
  getTypeLabel,
} from '@/lib/os/insights/insightTypes.client';

interface InsightsClientProps {
  companyId: string;
}

type ViewMode = 'digest' | 'all';
type FilterType = 'all' | 'critical' | 'positive';

export function InsightsClient({ companyId }: InsightsClientProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('digest');
  const [filter, setFilter] = useState<FilterType>('all');
  const [digest, setDigest] = useState<WeeklyInsightDigest | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      setError(null);

      try {
        if (viewMode === 'digest') {
          const response = await fetch(
            `/api/os/companies/${companyId}/insights?format=digest`
          );
          const data = await response.json();

          if (data.success) {
            setDigest(data.data);
            setInsights(data.data.insights || []);
          } else {
            setError(data.error || 'Failed to load digest');
          }
        } else {
          const filterParam = filter !== 'all' ? `&filter=${filter}` : '';
          const response = await fetch(
            `/api/os/companies/${companyId}/insights?limit=50${filterParam}`
          );
          const data = await response.json();

          if (data.success) {
            setInsights(data.data.insights || []);
          } else {
            setError(data.error || 'Failed to load insights');
          }
        }
      } catch (err) {
        setError('Failed to connect to insights service');
        console.error('[InsightsClient] Error:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [companyId, viewMode, filter]);

  const getSeverityIcon = (severity: InsightSeverity) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="w-5 h-5" />;
      case 'warning':
        return <TrendingDown className="w-5 h-5" />;
      case 'positive':
        return <TrendingUp className="w-5 h-5" />;
      default:
        return <Lightbulb className="w-5 h-5" />;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-900/50">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-zinc-500 mb-4">
            <Link href={`/c/${companyId}`} className="hover:text-zinc-300">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <span>/</span>
            <span className="text-zinc-300">AI Insights</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Sparkles className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold">AI Insights</h1>
                <p className="text-sm text-zinc-400">
                  Proactive intelligence about your digital health
                </p>
              </div>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-2 bg-zinc-800 rounded-lg p-1">
              <button
                onClick={() => setViewMode('digest')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'digest'
                    ? 'bg-purple-500 text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Weekly Digest
              </button>
              <button
                onClick={() => setViewMode('all')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'all'
                    ? 'bg-purple-500 text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                All Insights
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 text-purple-400 animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
            <p className="text-zinc-400">{error}</p>
          </div>
        ) : viewMode === 'digest' && digest ? (
          <DigestView digest={digest} companyId={companyId} />
        ) : (
          <AllInsightsView
            insights={insights}
            companyId={companyId}
            filter={filter}
            setFilter={setFilter}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Digest View Component
// ============================================================================

function DigestView({
  digest,
  companyId,
}: {
  digest: WeeklyInsightDigest;
  companyId: string;
}) {
  const { summary, healthTrend, topPriority, quickWins } = digest;

  const sentimentColors = {
    positive: 'text-emerald-400',
    neutral: 'text-zinc-400',
    concerning: 'text-amber-400',
  };

  return (
    <div className="space-y-8">
      {/* Summary Card */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className={`text-xl font-semibold ${sentimentColors[summary.sentiment]}`}>
              {summary.headline}
            </h2>
            <p className="text-sm text-zinc-500 mt-1">
              Week of {new Date(digest.weekStart).toLocaleDateString()} -{' '}
              {new Date(digest.weekEnd).toLocaleDateString()}
            </p>
          </div>
          {healthTrend.currentScore !== null && (
            <div className="text-right">
              <div className="text-3xl font-bold text-white">
                {healthTrend.currentScore}
              </div>
              {healthTrend.change !== null && (
                <div
                  className={`text-sm flex items-center gap-1 ${
                    healthTrend.direction === 'improving'
                      ? 'text-emerald-400'
                      : healthTrend.direction === 'declining'
                      ? 'text-red-400'
                      : 'text-zinc-400'
                  }`}
                >
                  {healthTrend.direction === 'improving' ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : healthTrend.direction === 'declining' ? (
                    <TrendingDown className="w-4 h-4" />
                  ) : null}
                  {healthTrend.change > 0 ? '+' : ''}
                  {healthTrend.change} pts
                </div>
              )}
            </div>
          )}
        </div>

        {/* Key Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          {summary.keyStats.map((stat, index) => (
            <div
              key={index}
              className="bg-zinc-800/50 rounded-lg p-3 text-center"
            >
              <div className="text-2xl font-bold text-white">{stat.value}</div>
              <div className="text-xs text-zinc-500">{stat.label}</div>
              {stat.trend && (
                <div
                  className={`text-xs mt-1 ${
                    stat.trend === 'up'
                      ? 'text-emerald-400'
                      : stat.trend === 'down'
                      ? 'text-red-400'
                      : 'text-zinc-400'
                  }`}
                >
                  {stat.change !== undefined && (
                    <>
                      {stat.change > 0 ? '+' : ''}
                      {stat.change}
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Priority Issues */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-medium">Priority Issues</h3>
          </div>
          {topPriority.length === 0 ? (
            <p className="text-sm text-zinc-500">No priority issues this week</p>
          ) : (
            <div className="space-y-3">
              {topPriority.slice(0, 5).map((insight) => (
                <InsightCard
                  key={insight.id}
                  insight={insight}
                  companyId={companyId}
                  compact
                />
              ))}
            </div>
          )}
        </div>

        {/* Quick Wins */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-medium">Quick Wins</h3>
          </div>
          {quickWins.length === 0 ? (
            <p className="text-sm text-zinc-500">No quick wins identified</p>
          ) : (
            <div className="space-y-3">
              {quickWins.slice(0, 5).map((insight) => (
                <InsightCard
                  key={insight.id}
                  insight={insight}
                  companyId={companyId}
                  compact
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Dimension Trends */}
      {healthTrend.dimensions.length > 0 && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-lg font-medium mb-4">Dimension Trends</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {healthTrend.dimensions.map((dim) => (
              <div
                key={dim.dimension}
                className="bg-zinc-800/50 rounded-lg p-3 text-center"
              >
                <div className="text-xs text-zinc-500 mb-1 capitalize">
                  {dim.dimension}
                </div>
                <div className="text-xl font-bold text-white">
                  {dim.currentScore ?? '-'}
                </div>
                {dim.change !== null && (
                  <div
                    className={`text-xs mt-1 ${
                      dim.direction === 'improving'
                        ? 'text-emerald-400'
                        : dim.direction === 'declining'
                        ? 'text-red-400'
                        : 'text-zinc-400'
                    }`}
                  >
                    {dim.change > 0 ? '+' : ''}
                    {dim.change}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// All Insights View Component
// ============================================================================

function AllInsightsView({
  insights,
  companyId,
  filter,
  setFilter,
}: {
  insights: Insight[];
  companyId: string;
  filter: FilterType;
  setFilter: (f: FilterType) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="flex items-center gap-4">
        <Filter className="w-4 h-4 text-zinc-500" />
        <div className="flex items-center gap-2">
          {(['all', 'critical', 'positive'] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-zinc-700 text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              {f === 'all' ? 'All' : f === 'critical' ? 'Issues' : 'Opportunities'}
            </button>
          ))}
        </div>
        <span className="text-sm text-zinc-500 ml-auto">
          {insights.length} insights
        </span>
      </div>

      {/* Insights List */}
      {insights.length === 0 ? (
        <div className="text-center py-12">
          <Lightbulb className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <p className="text-zinc-400">No insights match your filter</p>
        </div>
      ) : (
        <div className="space-y-4">
          {insights.map((insight) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              companyId={companyId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Insight Card Component
// ============================================================================

function InsightCard({
  insight,
  companyId,
  compact = false,
}: {
  insight: Insight;
  companyId: string;
  compact?: boolean;
}) {
  const colors = getSeverityColorClasses(insight.severity);

  const getSeverityIcon = (severity: InsightSeverity) => {
    const iconClass = compact ? 'w-4 h-4' : 'w-5 h-5';
    switch (severity) {
      case 'critical':
        return <AlertTriangle className={iconClass} />;
      case 'warning':
        return <TrendingDown className={iconClass} />;
      case 'positive':
        return <TrendingUp className={iconClass} />;
      default:
        return <Lightbulb className={iconClass} />;
    }
  };

  if (compact) {
    return (
      <div className={`p-3 rounded-lg border ${colors.bg} ${colors.border}`}>
        <div className="flex items-start gap-2">
          <span className={colors.icon}>{getSeverityIcon(insight.severity)}</span>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${colors.text}`}>{insight.title}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-zinc-500">
                {getTimeframeLabel(insight.timeframe)}
              </span>
              {insight.recommendedActions.length > 0 && (
                <>
                  <span className="text-zinc-600">•</span>
                  <Link
                    href={
                      insight.recommendedActions[0].linkPath ||
                      `/c/${companyId}/findings`
                    }
                    className="text-xs text-purple-400 hover:text-purple-300"
                  >
                    Take action
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-5 rounded-xl border ${colors.bg} ${colors.border}`}>
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 ${colors.icon}`}>
          {getSeverityIcon(insight.severity)}
        </span>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className={`text-base font-medium ${colors.text}`}>
                {insight.title}
              </h4>
              <p className="text-sm text-zinc-400 mt-1">{insight.message}</p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded">
                {getThemeLabel(insight.theme)}
              </span>
            </div>
          </div>

          {/* Evidence */}
          {insight.evidence.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {insight.evidence.slice(0, 3).map((ev, index) => (
                <span
                  key={index}
                  className="text-xs bg-zinc-800/50 text-zinc-400 px-2 py-1 rounded"
                >
                  {ev.label}: {ev.currentValue}
                  {ev.previousValue !== undefined && (
                    <span className="text-zinc-500"> (was {ev.previousValue})</span>
                  )}
                </span>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-4 mt-4 pt-3 border-t border-zinc-800">
            <div className="flex items-center gap-1 text-xs text-zinc-500">
              <Clock className="w-3 h-3" />
              {getTimeframeLabel(insight.timeframe)}
            </div>
            <div className="flex items-center gap-1 text-xs text-zinc-500">
              <Target className="w-3 h-3" />
              {insight.confidence}% confidence
            </div>
            {insight.recommendedActions.length > 0 && (
              <Link
                href={
                  insight.recommendedActions[0].linkPath || `/c/${companyId}/findings`
                }
                className="ml-auto text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1"
              >
                {insight.recommendedActions[0].title}
                <ChevronRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default InsightsClient;
