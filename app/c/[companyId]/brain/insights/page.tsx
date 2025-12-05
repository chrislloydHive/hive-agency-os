// app/c/[companyId]/brain/insights/page.tsx
// Brain Insights - AI-generated strategic insights from diagnostic runs

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getCompanyById } from '@/lib/airtable/companies';
import { getInsightsDashboard, queryInsights } from '@/lib/insights/engine';
import {
  Sparkles,
  TrendingUp,
  Target,
  Radar,
} from 'lucide-react';
import type { ClientInsight, InsightStatus, InsightSeverity, InsightCategory } from '@/lib/types/clientBrain';
import { getInsightUIGroup } from '@/lib/types/clientBrain';
import { InsightCardClient } from './InsightCardClient';
import { InsightsFilters } from './InsightsFilters';

// ============================================================================
// Types
// ============================================================================

interface PageProps {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{
    status?: string;
    severity?: string;
    category?: string;
  }>;
}

// ============================================================================
// Metadata
// ============================================================================

export const metadata: Metadata = {
  title: 'Brain - Insights',
};

// ============================================================================
// Page Component
// ============================================================================

export default async function BrainInsightsPage({ params, searchParams }: PageProps) {
  const { companyId } = await params;
  const filters = await searchParams;

  // Load company info
  const company = await getCompanyById(companyId);
  if (!company) {
    notFound();
  }

  // Check if filters are active
  const hasFilters = filters.status || filters.severity || filters.category;

  // Load insights dashboard (for stats) and filtered insights
  const dashboard = await getInsightsDashboard(companyId);

  // If no insights at all, show empty state with refresh button
  if (dashboard.stats.total === 0) {
    return (
      <div className="space-y-6">
        <Suspense fallback={null}>
          <InsightsFilters companyId={companyId} showOnlyRefresh />
        </Suspense>
        <EmptyInsightsState companyId={companyId} />
      </div>
    );
  }

  // Get filtered insights if filters are active
  let filteredInsights: ClientInsight[] | null = null;
  if (hasFilters) {
    filteredInsights = await queryInsights(companyId, {
      status: filters.status as InsightStatus | undefined,
      severity: filters.severity as InsightSeverity | undefined,
      category: filters.category as InsightCategory | undefined,
    });
  }

  // Use filtered insights or grouped insights
  const insightsToDisplay = filteredInsights ?? null;

  return (
    <div className="space-y-6">
      {/* Stats Bar */}
      <StatsBar stats={dashboard.stats} />

      {/* Filters */}
      <Suspense fallback={null}>
        <InsightsFilters companyId={companyId} />
      </Suspense>

      {/* Filtered View */}
      {insightsToDisplay !== null ? (
        <FilteredInsightsList insights={insightsToDisplay} companyId={companyId} />
      ) : (
        /* Grouped View */
        <div className="space-y-8">
          {/* Growth Opportunities */}
          {dashboard.groupedInsights.growthOpportunities.length > 0 && (
            <InsightGroup
              title="Growth Opportunities"
              subtitle="Revenue and conversion opportunities identified"
              icon={<TrendingUp className="w-5 h-5" />}
              iconBgColor="bg-emerald-500/20"
              iconColor="text-emerald-400"
              insights={dashboard.groupedInsights.growthOpportunities}
              companyId={companyId}
            />
          )}

          {/* Competitive Signals */}
          {dashboard.groupedInsights.competitiveSignals.length > 0 && (
            <InsightGroup
              title="Competitive Signals"
              subtitle="Market and competitor intelligence"
              icon={<Radar className="w-5 h-5" />}
              iconBgColor="bg-blue-500/20"
              iconColor="text-blue-400"
              insights={dashboard.groupedInsights.competitiveSignals}
              companyId={companyId}
            />
          )}

          {/* Strategic Recommendations */}
          {dashboard.groupedInsights.strategicRecommendations.length > 0 && (
            <InsightGroup
              title="Strategic Recommendations"
              subtitle="Actionable improvements across channels"
              icon={<Target className="w-5 h-5" />}
              iconBgColor="bg-amber-500/20"
              iconColor="text-amber-400"
              insights={dashboard.groupedInsights.strategicRecommendations}
              companyId={companyId}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Components
// ============================================================================

function StatsBar({ stats }: { stats: { open: number; inProgress: number; resolved: number; dismissed: number; total: number } }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl border border-slate-800 bg-slate-900/50">
      <div className="flex items-center gap-6">
        <StatItem label="Open" value={stats.open} color="text-blue-400" />
        <StatItem label="In Progress" value={stats.inProgress} color="text-amber-400" />
        <StatItem label="Resolved" value={stats.resolved} color="text-emerald-400" />
        <StatItem label="Dismissed" value={stats.dismissed} color="text-slate-400" />
      </div>
      <div className="text-sm text-slate-400">
        {stats.total} total insight{stats.total !== 1 ? 's' : ''}
      </div>
    </div>
  );
}

function StatItem({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`text-lg font-semibold ${color}`}>{value}</span>
      <span className="text-sm text-slate-500">{label}</span>
    </div>
  );
}

function InsightGroup({
  title,
  subtitle,
  icon,
  iconBgColor,
  iconColor,
  insights,
  companyId,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  iconBgColor: string;
  iconColor: string;
  insights: ClientInsight[];
  companyId: string;
}) {
  return (
    <div className="space-y-4">
      {/* Group Header */}
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl ${iconBgColor} flex items-center justify-center ${iconColor}`}>
          {icon}
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
          <p className="text-sm text-slate-400">{subtitle}</p>
        </div>
        <div className="ml-auto">
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400">
            {insights.length}
          </span>
        </div>
      </div>

      {/* Insights */}
      <div className="space-y-3">
        {insights.map((insight) => (
          <InsightCardClient key={insight.id} insight={insight} companyId={companyId} />
        ))}
      </div>
    </div>
  );
}

function FilteredInsightsList({
  insights,
  companyId,
}: {
  insights: ClientInsight[];
  companyId: string;
}) {
  if (insights.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center">
        <p className="text-slate-400">No insights match your filters.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-sm text-slate-400 mb-4">
        {insights.length} insight{insights.length !== 1 ? 's' : ''} matching filters
      </div>
      {insights.map((insight) => (
        <InsightCardClient key={insight.id} insight={insight} companyId={companyId} />
      ))}
    </div>
  );
}

function EmptyInsightsState({ companyId }: { companyId: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8">
      <div className="flex flex-col items-center text-center max-w-md mx-auto">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center mb-6">
          <Sparkles className="w-8 h-8 text-purple-400" />
        </div>

        <h2 className="text-xl font-semibold text-slate-100 mb-3">
          No Insights Yet
        </h2>

        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
          Insights are automatically extracted when you run diagnostic tools.
          Run a GAP or Labs diagnostic to generate your first insights.
        </p>

        <div className="w-full space-y-3">
          <InsightPreview
            title="Growth Opportunities"
            description="Revenue and conversion opportunities"
            icon={<TrendingUp className="w-4 h-4 text-emerald-400" />}
          />
          <InsightPreview
            title="Competitive Signals"
            description="Market and competitor intelligence"
            icon={<Radar className="w-4 h-4 text-blue-400" />}
          />
          <InsightPreview
            title="Strategic Recommendations"
            description="Actionable improvements across channels"
            icon={<Target className="w-4 h-4 text-amber-400" />}
          />
        </div>
      </div>
    </div>
  );
}

function InsightPreview({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 text-left">
      <div className="w-8 h-8 rounded-lg bg-slate-700/50 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div>
        <div className="text-sm font-medium text-slate-200">{title}</div>
        <div className="text-xs text-slate-500">{description}</div>
      </div>
    </div>
  );
}

