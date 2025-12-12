'use client';

// components/labs/analytics/AnalyticsOverview.tsx
// Overview section with AI narrative and key metrics

import { Sparkles, TrendingUp, TrendingDown, Minus, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { AnalyticsLabSnapshot, AnalyticsNarrative } from '@/lib/analytics/analyticsTypes';
import { formatCompactNumber, formatCurrency } from '@/lib/types/companyAnalytics';
import { classifyTrendSlope, getTrendColorClass } from '@/lib/analytics/analyticsTypes';

// ============================================================================
// Types
// ============================================================================

interface AnalyticsOverviewProps {
  snapshot: AnalyticsLabSnapshot;
  narrative?: AnalyticsNarrative;
  isRefreshing?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function AnalyticsOverview({
  snapshot,
  narrative,
  isRefreshing,
}: AnalyticsOverviewProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      {/* Narrative Section */}
      {narrative && (
        <div className="p-6 border-b border-slate-800 bg-gradient-to-r from-purple-500/5 to-blue-500/5">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-purple-500/10 border border-purple-500/30 rounded-lg">
              <Sparkles className="w-5 h-5 text-purple-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-slate-100 mb-2">
                {narrative.executiveSummary}
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                {narrative.summary}
              </p>

              {/* Opportunities & Risks */}
              {(narrative.topOpportunities.length > 0 || narrative.topRisks.length > 0) && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {narrative.topOpportunities.length > 0 && (
                    <div>
                      <h4 className="flex items-center gap-2 text-sm font-medium text-emerald-400 mb-2">
                        <CheckCircle2 className="w-4 h-4" />
                        Opportunities
                      </h4>
                      <ul className="space-y-1">
                        {narrative.topOpportunities.map((opp, i) => (
                          <li key={i} className="text-sm text-slate-400 flex items-start gap-2">
                            <span className="text-emerald-500 mt-1">•</span>
                            {opp}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {narrative.topRisks.length > 0 && (
                    <div>
                      <h4 className="flex items-center gap-2 text-sm font-medium text-amber-400 mb-2">
                        <AlertTriangle className="w-4 h-4" />
                        Risks
                      </h4>
                      <ul className="space-y-1">
                        {narrative.topRisks.map((risk, i) => (
                          <li key={i} className="text-sm text-slate-400 flex items-start gap-2">
                            <span className="text-amber-500 mt-1">•</span>
                            {risk}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {narrative.isAiGenerated && (
                <p className="text-xs text-slate-500 mt-3 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  AI-generated summary
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Key Metrics Grid */}
      <div className="p-6">
        <h3 className="text-sm font-medium text-slate-400 mb-4">Key Metrics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {/* Sessions */}
          {snapshot.sourceGa4 && (
            <MetricCard
              label="Sessions"
              value={formatCompactNumber(snapshot.sourceGa4.totalSessions)}
              change={snapshot.delta.sessionsMoM}
            />
          )}

          {/* Conversions */}
          {snapshot.sourceGa4 && (
            <MetricCard
              label="Conversions"
              value={formatCompactNumber(snapshot.sourceGa4.conversions)}
              change={snapshot.delta.conversionsMoM}
            />
          )}

          {/* Conversion Rate */}
          {snapshot.sourceGa4 && (
            <MetricCard
              label="Conv. Rate"
              value={`${snapshot.sourceGa4.conversionRate}%`}
            />
          )}

          {/* Organic Clicks */}
          {snapshot.sourceSearchConsole && (
            <MetricCard
              label="Organic Clicks"
              value={formatCompactNumber(snapshot.sourceSearchConsole.clicks)}
              change={snapshot.delta.organicClicksMoM}
            />
          )}

          {/* GBP Actions */}
          {snapshot.sourceGbp && (
            <MetricCard
              label="GBP Actions"
              value={formatCompactNumber(
                snapshot.sourceGbp.calls +
                snapshot.sourceGbp.directionRequests +
                snapshot.sourceGbp.websiteClicks
              )}
              change={snapshot.delta.gbpActionsMoM}
            />
          )}

          {/* Media Spend */}
          {snapshot.sourcePaidMedia && (
            <MetricCard
              label="Media Spend"
              value={formatCurrency(snapshot.sourcePaidMedia.spend)}
              change={snapshot.delta.spendMoM}
            />
          )}

          {/* CPA */}
          {snapshot.sourcePaidMedia && snapshot.sourcePaidMedia.cpa > 0 && (
            <MetricCard
              label="CPA"
              value={formatCurrency(snapshot.sourcePaidMedia.cpa)}
              change={snapshot.delta.cpaMoM}
              invertTrend
            />
          )}

          {/* ROAS */}
          {snapshot.sourcePaidMedia && snapshot.sourcePaidMedia.roas > 0 && (
            <MetricCard
              label="ROAS"
              value={`${snapshot.sourcePaidMedia.roas.toFixed(1)}x`}
              change={snapshot.delta.roasMoM}
            />
          )}
        </div>

        {/* Data Quality Indicator */}
        <div className="mt-6 flex items-center justify-between">
          <DataQualityBadge score={snapshot.dataQualityScore ?? 0} />
          {isRefreshing && (
            <span className="text-xs text-slate-500">Updating...</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Metric Card
// ============================================================================

interface MetricCardProps {
  label: string;
  value: string;
  change?: number | null;
  invertTrend?: boolean;
}

function MetricCard({ label, value, change, invertTrend = false }: MetricCardProps) {
  const slope = classifyTrendSlope(change ?? null);
  const colorClass = getTrendColorClass(slope, invertTrend);

  return (
    <div className="p-4 bg-slate-800/50 border border-slate-700/50 rounded-lg">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-xl font-semibold text-slate-100">{value}</p>
      {change !== null && change !== undefined && (
        <div className={`flex items-center gap-1 mt-1 ${colorClass}`}>
          <TrendIcon slope={slope} />
          <span className="text-xs font-medium">
            {change > 0 ? '+' : ''}{change}%
          </span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Trend Icon
// ============================================================================

function TrendIcon({ slope }: { slope: ReturnType<typeof classifyTrendSlope> }) {
  switch (slope) {
    case 'strong_up':
    case 'up':
      return <TrendingUp className="w-3 h-3" />;
    case 'strong_down':
    case 'down':
      return <TrendingDown className="w-3 h-3" />;
    default:
      return <Minus className="w-3 h-3" />;
  }
}

// ============================================================================
// Data Quality Badge
// ============================================================================

interface DataQualityBadgeProps {
  score: number;
}

function DataQualityBadge({ score }: DataQualityBadgeProps) {
  let label: string;
  let colorClass: string;

  if (score >= 80) {
    label = 'Excellent';
    colorClass = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
  } else if (score >= 60) {
    label = 'Good';
    colorClass = 'text-blue-400 bg-blue-500/10 border-blue-500/30';
  } else if (score >= 40) {
    label = 'Fair';
    colorClass = 'text-amber-400 bg-amber-500/10 border-amber-500/30';
  } else {
    label = 'Limited';
    colorClass = 'text-slate-400 bg-slate-500/10 border-slate-500/30';
  }

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-medium ${colorClass}`}>
      <div className="w-1.5 h-1.5 rounded-full bg-current" />
      Data Quality: {label} ({score}%)
    </div>
  );
}
