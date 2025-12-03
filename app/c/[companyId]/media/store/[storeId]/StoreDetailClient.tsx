'use client';

// app/c/[companyId]/media/store/[storeId]/StoreDetailClient.tsx
// Client component for store-level drilldown

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type {
  StoreAnalyticsDetail,
  StoreInsight,
  StoreCategoryMix,
  StoreCompetitor,
} from '@/lib/mediaLab/storeAnalytics';

// ============================================================================
// Types
// ============================================================================

interface StoreDetailClientProps {
  companyId: string;
  companyName: string;
  storeAnalytics: StoreAnalyticsDetail;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-amber-400';
  return 'text-red-400';
}

function getScoreBgColor(score: number): string {
  if (score >= 80) return 'bg-emerald-500/20';
  if (score >= 60) return 'bg-amber-500/20';
  return 'bg-red-500/20';
}

function formatCurrency(value: number | null): string {
  if (value === null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

// ============================================================================
// Main Component
// ============================================================================

export function StoreDetailClient({
  companyId,
  companyName,
  storeAnalytics,
}: StoreDetailClientProps) {
  const router = useRouter();
  const [isCreatingWorkItem, setIsCreatingWorkItem] = useState<string | null>(null);

  const { overview, metrics, categoryMix, competitors, insights, dateRange, hasData } =
    storeAnalytics;

  // Handle creating work item from insight
  const handleCreateWorkItem = async (insight: StoreInsight) => {
    setIsCreatingWorkItem(insight.id);
    try {
      const res = await fetch('/api/os/work-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          title: `${overview.storeName}: ${insight.title}`,
          notes: insight.description,
          area: 'Funnel',
          severity:
            insight.severity === 'critical'
              ? 'High'
              : insight.severity === 'warning'
              ? 'Medium'
              : 'Low',
          source: {
            sourceType: 'store_insight',
            storeId: overview.storeId,
            storeName: overview.storeName,
            insightId: insight.id,
          },
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to create work item');
      }

      router.refresh();
    } catch (err) {
      console.error('Failed to create work item:', err);
    } finally {
      setIsCreatingWorkItem(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#050509]">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50">
        <div className="mx-auto max-w-7xl px-6 py-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm mb-4">
            <Link
              href={`/c/${companyId}/blueprint`}
              className="text-slate-400 hover:text-slate-200 transition-colors"
            >
              Blueprint
            </Link>
            <span className="text-slate-600">/</span>
            <Link
              href={`/c/${companyId}/analytics?view=media`}
              className="text-slate-400 hover:text-slate-200 transition-colors"
            >
              Media Analytics
            </Link>
            <span className="text-slate-600">/</span>
            <span className="text-slate-200">{overview.storeName}</span>
          </div>

          {/* Store Header */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-100">{overview.storeName}</h1>
              <p className="text-sm text-slate-400 mt-1">
                {overview.address && (
                  <>
                    {overview.address}
                    {overview.city && `, ${overview.city}`}
                    {overview.state && `, ${overview.state}`}
                    {overview.zipCode && ` ${overview.zipCode}`}
                  </>
                )}
                {!overview.address && overview.marketName && overview.marketName}
              </p>
              {overview.storeCode && (
                <span className="mt-2 inline-flex text-xs text-slate-500">
                  Code: {overview.storeCode}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Link
                href={`/c/${companyId}/analytics?view=media`}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                Back to Analytics
              </Link>
              <Link
                href={`/c/${companyId}/diagnostics/media`}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 transition-colors"
              >
                Media Lab
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-6 py-6">
        {!hasData ? (
          <NoDataState companyId={companyId} storeName={overview.storeName} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* LEFT COLUMN: Main Metrics & Performance */}
            <div className="lg:col-span-2 space-y-6">
              {/* KPI Overview */}
              <KpiOverviewSection metrics={metrics} dateRange={dateRange.label} />

              {/* Performance Metrics Table */}
              <PerformanceMetricsCard metrics={metrics} />

              {/* Category Mix */}
              {categoryMix.length > 0 && (
                <CategoryMixCard categories={categoryMix} />
              )}

              {/* Competitive Visibility */}
              <CompetitiveVisibilityCard
                competitors={competitors}
                visibilityScore={metrics.visibilityScore}
              />
            </div>

            {/* RIGHT COLUMN: Insights & Actions */}
            <div className="space-y-6">
              {/* Overall Score Card */}
              <ScoreCard
                overallScore={metrics.overallScore}
                visibilityScore={metrics.visibilityScore}
              />

              {/* Insights Panel */}
              <InsightsPanel
                insights={insights}
                onCreateWorkItem={handleCreateWorkItem}
                isCreatingWorkItem={isCreatingWorkItem}
              />

              {/* Quick Actions */}
              <QuickActionsCard
                companyId={companyId}
                storeId={overview.storeId}
                storeName={overview.storeName}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// KPI Overview Section
// ============================================================================

function KpiOverviewSection({
  metrics,
  dateRange,
}: {
  metrics: StoreAnalyticsDetail['metrics'];
  dateRange: string;
}) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-300">Store Performance</h2>
        <span className="text-xs text-slate-500">{dateRange}</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          label="Total Leads"
          value={formatNumber(metrics.leads)}
          color="text-amber-400"
        />
        <KpiCard
          label="Calls"
          value={formatNumber(metrics.calls)}
          color="text-blue-400"
        />
        <KpiCard
          label="LSA Leads"
          value={formatNumber(metrics.lsaLeads)}
          color="text-purple-400"
        />
        <KpiCard
          label="CPL"
          value={metrics.cpl ? `$${metrics.cpl.toFixed(2)}` : '—'}
          color="text-emerald-400"
        />
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  color = 'text-slate-100',
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="bg-slate-800/50 rounded-lg p-4">
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
      <p className="text-xs text-slate-400 uppercase tracking-wide mt-1">{label}</p>
    </div>
  );
}

// ============================================================================
// Performance Metrics Card
// ============================================================================

function PerformanceMetricsCard({
  metrics,
}: {
  metrics: StoreAnalyticsDetail['metrics'];
}) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-300 mb-4">
        Detailed Metrics
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-800/50">
            <MetricRow label="Impressions" value={formatNumber(metrics.impressions)} />
            <MetricRow label="Clicks" value={formatNumber(metrics.clicks)} />
            <MetricRow
              label="CTR"
              value={
                metrics.impressions > 0
                  ? `${((metrics.clicks / metrics.impressions) * 100).toFixed(2)}%`
                  : '—'
              }
            />
            <MetricRow
              label="Conversion Rate"
              value={`${metrics.conversionRate.toFixed(2)}%`}
            />
            <MetricRow
              label="Direction Requests"
              value={formatNumber(metrics.directionRequests)}
            />
            <MetricRow
              label="Website Clicks"
              value={formatNumber(metrics.websiteClicks)}
            />
            <MetricRow label="Spend" value={formatCurrency(metrics.spend)} highlight />
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MetricRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <tr className="hover:bg-slate-800/30">
      <td className="py-3 text-slate-400">{label}</td>
      <td
        className={`py-3 text-right tabular-nums ${
          highlight ? 'text-emerald-400 font-medium' : 'text-slate-200'
        }`}
      >
        {value}
      </td>
    </tr>
  );
}

// ============================================================================
// Category Mix Card
// ============================================================================

function CategoryMixCard({ categories }: { categories: StoreCategoryMix[] }) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-300 mb-4">
        Category Mix
      </h3>

      <div className="space-y-3">
        {categories.map((cat) => (
          <div key={cat.category}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-slate-300">{cat.category}</span>
              <span className="text-sm text-slate-400 tabular-nums">
                {cat.leads} leads ({cat.percentOfTotal.toFixed(0)}%)
              </span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500/50 rounded-full transition-all"
                style={{ width: `${cat.percentOfTotal}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Competitive Visibility Card
// ============================================================================

function CompetitiveVisibilityCard({
  competitors,
  visibilityScore,
}: {
  competitors: StoreCompetitor[];
  visibilityScore: number;
}) {
  const getTrendIcon = (trend: StoreCompetitor['visibilityTrend']) => {
    switch (trend) {
      case 'up':
        return (
          <svg
            className="w-4 h-4 text-emerald-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 10l7-7m0 0l7 7m-7-7v18"
            />
          </svg>
        );
      case 'down':
        return (
          <svg
            className="w-4 h-4 text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        );
      default:
        return (
          <svg
            className="w-4 h-4 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 12h14"
            />
          </svg>
        );
    }
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-300">
          Competitive Visibility
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Your Score:</span>
          <span
            className={`text-sm font-bold tabular-nums ${getScoreColor(
              visibilityScore
            )}`}
          >
            {visibilityScore}
          </span>
        </div>
      </div>

      <p className="text-xs text-slate-500 mb-4">
        Top competitors in local map pack (placeholder data)
      </p>

      <div className="space-y-3">
        {competitors.map((competitor, index) => (
          <div
            key={competitor.name}
            className="flex items-center justify-between p-3 rounded-lg bg-slate-800/30 border border-slate-700/50"
          >
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                {competitor.position}
              </span>
              <div>
                <p className="text-sm text-slate-200">{competitor.name}</p>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="text-amber-400">★ {competitor.rating}</span>
                  <span>({competitor.reviewCount} reviews)</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getTrendIcon(competitor.visibilityTrend)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Score Card
// ============================================================================

function ScoreCard({
  overallScore,
  visibilityScore,
}: {
  overallScore: number;
  visibilityScore: number;
}) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-300 mb-4">Store Score</h3>

      <div className="text-center mb-4">
        <div
          className={`text-5xl font-bold tabular-nums ${getScoreColor(overallScore)}`}
        >
          {overallScore}
        </div>
        <p className="text-xs text-slate-500 uppercase tracking-wide mt-1">
          Overall Score
        </p>
      </div>

      <div className="pt-4 border-t border-slate-700/50">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">Visibility</span>
          <span
            className={`text-lg font-bold tabular-nums ${getScoreColor(
              visibilityScore
            )}`}
          >
            {visibilityScore}
          </span>
        </div>
        <div className="mt-2 h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              visibilityScore >= 80
                ? 'bg-emerald-500'
                : visibilityScore >= 60
                ? 'bg-amber-500'
                : 'bg-red-500'
            }`}
            style={{ width: `${visibilityScore}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Insights Panel
// ============================================================================

function InsightsPanel({
  insights,
  onCreateWorkItem,
  isCreatingWorkItem,
}: {
  insights: StoreInsight[];
  onCreateWorkItem: (insight: StoreInsight) => void;
  isCreatingWorkItem: string | null;
}) {
  const getSeverityStyles = (severity: StoreInsight['severity']) => {
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

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-300 mb-4">
        AI Insights
      </h3>

      {insights.length === 0 ? (
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
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
          </div>
          <p className="text-sm text-slate-400">No insights yet</p>
          <p className="text-xs text-slate-500 mt-1">
            More data needed to generate insights
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {insights.map((insight) => (
            <div
              key={insight.id}
              className={`rounded-lg border p-3 ${getSeverityStyles(insight.severity)}`}
            >
              <h4 className="text-sm font-medium">{insight.title}</h4>
              <p className="text-xs opacity-80 mt-1">{insight.description}</p>
              {insight.actionable && (
                <button
                  onClick={() => onCreateWorkItem(insight)}
                  disabled={isCreatingWorkItem === insight.id}
                  className="mt-2 px-2.5 py-1 text-[10px] font-medium rounded bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-50"
                >
                  {isCreatingWorkItem === insight.id
                    ? 'Creating...'
                    : 'Create Work Item'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Quick Actions Card
// ============================================================================

function QuickActionsCard({
  companyId,
  storeId,
  storeName,
}: {
  companyId: string;
  storeId: string;
  storeName: string;
}) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-300 mb-4">Actions</h3>

      <div className="space-y-2">
        <Link
          href={`/c/${companyId}/analytics?view=media`}
          className="flex items-center justify-between p-3 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-800 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <svg
                className="w-4 h-4 text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <span className="text-sm text-slate-200">All Stores</span>
          </div>
          <svg
            className="w-4 h-4 text-slate-400 group-hover:text-slate-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </Link>

        <Link
          href={`/c/${companyId}/diagnostics/media`}
          className="flex items-center justify-between p-3 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-800 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <svg
                className="w-4 h-4 text-amber-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"
                />
              </svg>
            </div>
            <span className="text-sm text-slate-200">Media Lab</span>
          </div>
          <svg
            className="w-4 h-4 text-slate-400 group-hover:text-slate-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </Link>
      </div>
    </div>
  );
}

// ============================================================================
// No Data State
// ============================================================================

function NoDataState({
  companyId,
  storeName,
}: {
  companyId: string;
  storeName: string;
}) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 text-center">
      <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-slate-800 mb-6">
        <svg
          className="h-8 w-8 text-slate-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-slate-200 mb-2">
        No Performance Data for {storeName}
      </h2>
      <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
        Connect analytics integrations or wait for performance data to accumulate
        for this store location.
      </p>
      <div className="flex items-center justify-center gap-3">
        <Link
          href={`/c/${companyId}/analytics?view=media`}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium text-sm transition-colors"
        >
          Back to Analytics
        </Link>
      </div>
    </div>
  );
}
