'use client';

// components/reports/blocks/AnalyticsQbrSection.tsx
// Analytics section for Quarterly Business Review reports
//
// Displays key analytics metrics, trends, and AI summary
// in a format suitable for QBR and Annual Plan templates.

import { BarChart3, TrendingUp, TrendingDown, Minus, Sparkles } from 'lucide-react';
import type { AnalyticsLabSnapshot, AnalyticsNarrative, AnalyticsTrendSeries } from '@/lib/analytics/analyticsTypes';
import { formatCompactNumber, formatCurrency } from '@/lib/types/companyAnalytics';
import { classifyTrendSlope, getTrendColorClass } from '@/lib/analytics/analyticsTypes';

// ============================================================================
// Types
// ============================================================================

interface AnalyticsQbrSectionProps {
  snapshot: AnalyticsLabSnapshot;
  trends?: AnalyticsTrendSeries;
  narrative?: AnalyticsNarrative;
  quarterLabel?: string;
  showTrendCharts?: boolean;
  variant?: 'full' | 'compact';
}

// ============================================================================
// Component
// ============================================================================

export function AnalyticsQbrSection({
  snapshot,
  narrative,
  quarterLabel = 'This Quarter',
  variant = 'full',
}: AnalyticsQbrSectionProps) {
  const hasData = snapshot.hasGa4 || snapshot.hasGsc || snapshot.hasGbp || snapshot.hasMedia;

  if (!hasData) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <SectionHeader />
        <div className="text-center py-8">
          <BarChart3 className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No analytics data available for this period</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <SectionHeader quarterLabel={quarterLabel} />

      {/* AI Summary */}
      {narrative && variant === 'full' && (
        <div className="px-6 py-4 border-b border-slate-800 bg-gradient-to-r from-purple-500/5 to-blue-500/5">
          <div className="flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-purple-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-slate-200 mb-1">
                {narrative.executiveSummary}
              </p>
              <p className="text-xs text-slate-400">
                {narrative.summary}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* KPI Grid */}
      <div className="p-6">
        <div className={`grid gap-4 ${
          variant === 'compact' ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
        }`}>
          {/* Sessions */}
          {snapshot.sourceGa4 && (
            <KpiCard
              label="Sessions"
              value={formatCompactNumber(snapshot.sourceGa4.totalSessions)}
              change={snapshot.delta.sessionsMoM}
              compact={variant === 'compact'}
            />
          )}

          {/* Conversions */}
          {snapshot.sourceGa4 && (
            <KpiCard
              label="Conversions"
              value={formatCompactNumber(snapshot.sourceGa4.conversions)}
              change={snapshot.delta.conversionsMoM}
              compact={variant === 'compact'}
            />
          )}

          {/* Conversion Rate */}
          {snapshot.sourceGa4 && variant === 'full' && (
            <KpiCard
              label="Conversion Rate"
              value={`${snapshot.sourceGa4.conversionRate}%`}
              compact={false}
            />
          )}

          {/* Organic Clicks */}
          {snapshot.sourceSearchConsole && (
            <KpiCard
              label="Organic Clicks"
              value={formatCompactNumber(snapshot.sourceSearchConsole.clicks)}
              change={snapshot.delta.organicClicksMoM}
              compact={variant === 'compact'}
            />
          )}

          {/* GBP Actions */}
          {snapshot.sourceGbp && (
            <KpiCard
              label="GBP Actions"
              value={formatCompactNumber(
                snapshot.sourceGbp.calls +
                snapshot.sourceGbp.directionRequests +
                snapshot.sourceGbp.websiteClicks
              )}
              change={snapshot.delta.gbpActionsMoM}
              compact={variant === 'compact'}
            />
          )}

          {/* Media Spend */}
          {snapshot.sourcePaidMedia && (
            <KpiCard
              label="Media Spend"
              value={formatCurrency(snapshot.sourcePaidMedia.spend)}
              change={snapshot.delta.spendMoM}
              compact={variant === 'compact'}
            />
          )}

          {/* CPA */}
          {snapshot.sourcePaidMedia && snapshot.sourcePaidMedia.cpa > 0 && (
            <KpiCard
              label="CPA"
              value={formatCurrency(snapshot.sourcePaidMedia.cpa)}
              change={snapshot.delta.cpaMoM}
              invertTrend
              compact={variant === 'compact'}
            />
          )}

          {/* ROAS */}
          {snapshot.sourcePaidMedia && snapshot.sourcePaidMedia.roas > 0 && (
            <KpiCard
              label="ROAS"
              value={`${snapshot.sourcePaidMedia.roas.toFixed(1)}x`}
              change={snapshot.delta.roasMoM}
              compact={variant === 'compact'}
            />
          )}
        </div>

        {/* Trend Summary (Full variant only) */}
        {variant === 'full' && (
          <div className="mt-6 pt-4 border-t border-slate-800">
            <h4 className="text-xs font-medium text-slate-400 mb-3">Period Trends</h4>
            <div className="flex flex-wrap gap-4">
              {snapshot.delta.sessionsMoM !== null && (
                <TrendBadge
                  label="Traffic"
                  change={snapshot.delta.sessionsMoM}
                />
              )}
              {snapshot.delta.conversionsMoM !== null && (
                <TrendBadge
                  label="Conversions"
                  change={snapshot.delta.conversionsMoM}
                />
              )}
              {snapshot.delta.organicClicksMoM !== null && (
                <TrendBadge
                  label="SEO"
                  change={snapshot.delta.organicClicksMoM}
                />
              )}
              {snapshot.delta.roasMoM != null && (
                <TrendBadge
                  label="ROAS"
                  change={snapshot.delta.roasMoM}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Section Header
// ============================================================================

function SectionHeader({ quarterLabel }: { quarterLabel?: string }) {
  return (
    <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <BarChart3 className="w-4 h-4 text-blue-400" />
        </div>
        <div>
          <h3 className="text-sm font-medium text-slate-200">Analytics Overview</h3>
          {quarterLabel && (
            <p className="text-xs text-slate-500">{quarterLabel}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// KPI Card
// ============================================================================

interface KpiCardProps {
  label: string;
  value: string;
  change?: number | null;
  invertTrend?: boolean;
  compact?: boolean;
}

function KpiCard({ label, value, change, invertTrend = false, compact = false }: KpiCardProps) {
  const slope = classifyTrendSlope(change ?? null);
  const colorClass = getTrendColorClass(slope, invertTrend);

  return (
    <div className={`bg-slate-800/50 border border-slate-700/50 rounded-lg ${compact ? 'p-3' : 'p-4'}`}>
      <p className={`text-slate-500 mb-1 ${compact ? 'text-xs' : 'text-xs'}`}>{label}</p>
      <div className="flex items-baseline gap-2">
        <p className={`font-semibold text-slate-100 ${compact ? 'text-lg' : 'text-xl'}`}>
          {value}
        </p>
        {change !== null && change !== undefined && (
          <div className={`flex items-center gap-0.5 ${colorClass}`}>
            {slope === 'up' || slope === 'strong_up' ? (
              <TrendingUp className="w-3 h-3" />
            ) : slope === 'down' || slope === 'strong_down' ? (
              <TrendingDown className="w-3 h-3" />
            ) : (
              <Minus className="w-3 h-3" />
            )}
            <span className="text-xs font-medium">
              {change > 0 ? '+' : ''}{change}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Trend Badge
// ============================================================================

interface TrendBadgeProps {
  label: string;
  change: number;
}

function TrendBadge({ label, change }: TrendBadgeProps) {
  const slope = classifyTrendSlope(change);
  const colorClass = getTrendColorClass(slope);
  const bgClass = slope.includes('up')
    ? 'bg-emerald-500/10 border-emerald-500/30'
    : slope.includes('down')
    ? 'bg-red-500/10 border-red-500/30'
    : 'bg-slate-500/10 border-slate-500/30';

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${bgClass}`}>
      <span className="text-xs text-slate-400">{label}:</span>
      <div className={`flex items-center gap-0.5 ${colorClass}`}>
        {slope === 'up' || slope === 'strong_up' ? (
          <TrendingUp className="w-3 h-3" />
        ) : slope === 'down' || slope === 'strong_down' ? (
          <TrendingDown className="w-3 h-3" />
        ) : (
          <Minus className="w-3 h-3" />
        )}
        <span className="text-xs font-medium">
          {change > 0 ? '+' : ''}{change}%
        </span>
      </div>
    </div>
  );
}
