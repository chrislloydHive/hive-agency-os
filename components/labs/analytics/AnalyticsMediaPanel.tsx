'use client';

// components/labs/analytics/AnalyticsMediaPanel.tsx
// Paid media panel

import Link from 'next/link';
import { DollarSign, Target, TrendingUp, TrendingDown, Minus, ExternalLink } from 'lucide-react';
import type { AnalyticsLabSnapshot, AnalyticsTrendSeries } from '@/lib/analytics/analyticsTypes';
import { formatCompactNumber, formatCurrency } from '@/lib/types/companyAnalytics';
import { classifyTrendSlope, getTrendColorClass } from '@/lib/analytics/analyticsTypes';
import { AnalyticsTrendsChart } from './AnalyticsTrendsChart';

// ============================================================================
// Types
// ============================================================================

interface AnalyticsMediaPanelProps {
  companyId: string;
  snapshot: AnalyticsLabSnapshot;
  trends: AnalyticsTrendSeries;
}

// ============================================================================
// Component
// ============================================================================

export function AnalyticsMediaPanel({
  companyId,
  snapshot,
  trends,
}: AnalyticsMediaPanelProps) {
  const media = snapshot.sourcePaidMedia;
  if (!media) return null;

  const roasSlope = classifyTrendSlope(snapshot.delta.roasMoM ?? null);
  const roasColorClass = getTrendColorClass(roasSlope);

  // Get channel breakdown
  const channelEntries = Object.entries(media.channelContribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const totalSpend = channelEntries.reduce((sum, [, val]) => sum + val, 0);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/10 border border-purple-500/30 rounded-lg">
            <DollarSign className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-200">Paid Media</h3>
            <p className="text-xs text-slate-500">Media Program</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* ROAS Badge */}
          {media.roas > 0 && (
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${roasColorClass} bg-opacity-10`}>
              {roasSlope === 'up' || roasSlope === 'strong_up' ? (
                <TrendingUp className="w-3 h-3" />
              ) : roasSlope === 'down' || roasSlope === 'strong_down' ? (
                <TrendingDown className="w-3 h-3" />
              ) : (
                <Minus className="w-3 h-3" />
              )}
              <span className="text-xs font-medium">
                {media.roas.toFixed(1)}x ROAS
              </span>
            </div>
          )}

          {/* Link to Media Lab */}
          <Link
            href={`/c/${companyId}/media`}
            className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            Media Lab
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Key Metrics Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3 bg-slate-800/50 rounded-lg">
            <p className="text-xs text-slate-500 mb-1">Spend</p>
            <p className="text-lg font-semibold text-slate-100">
              {formatCurrency(media.spend)}
            </p>
            {snapshot.delta.spendMoM != null && (
              <ChangeIndicator change={snapshot.delta.spendMoM} />
            )}
          </div>
          <div className="p-3 bg-slate-800/50 rounded-lg">
            <div className="flex items-center gap-1.5 mb-1">
              <Target className="w-3 h-3 text-slate-500" />
              <p className="text-xs text-slate-500">Conversions</p>
            </div>
            <p className="text-lg font-semibold text-slate-100">
              {formatCompactNumber(media.conversions)}
            </p>
          </div>
          <div className="p-3 bg-slate-800/50 rounded-lg">
            <p className="text-xs text-slate-500 mb-1">CPA</p>
            <p className="text-lg font-semibold text-slate-100">
              {formatCurrency(media.cpa)}
            </p>
            {snapshot.delta.cpaMoM != null && (
              <ChangeIndicator change={snapshot.delta.cpaMoM} invert />
            )}
          </div>
          <div className="p-3 bg-slate-800/50 rounded-lg">
            <p className="text-xs text-slate-500 mb-1">ROAS</p>
            <p className="text-lg font-semibold text-slate-100">
              {media.roas > 0 ? `${media.roas.toFixed(1)}x` : '—'}
            </p>
            {snapshot.delta.roasMoM != null && (
              <ChangeIndicator change={snapshot.delta.roasMoM} />
            )}
          </div>
        </div>

        {/* Spend Trend Chart */}
        <div className="h-32">
          <AnalyticsTrendsChart
            data={trends.mediaSpend}
            color="purple"
            label="Media Spend"
            formatValue={(v) => formatCurrency(v)}
          />
        </div>

        {/* Channel Breakdown */}
        {channelEntries.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-slate-400 mb-2">Channel Contribution</h4>
            <div className="space-y-2">
              {channelEntries.map(([channel, spend]) => {
                const percentage = totalSpend > 0
                  ? Math.round((spend / totalSpend) * 100)
                  : 0;
                return (
                  <div key={channel} className="flex items-center gap-2">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-slate-400">{channel}</span>
                        <span className="text-xs text-slate-500">{formatCurrency(spend)}</span>
                      </div>
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-500 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-xs text-slate-500 w-8 text-right">{percentage}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Change Indicator
// ============================================================================

interface ChangeIndicatorProps {
  change: number;
  invert?: boolean;
}

function ChangeIndicator({ change, invert = false }: ChangeIndicatorProps) {
  const slope = classifyTrendSlope(change);
  const colorClass = getTrendColorClass(slope, invert);

  return (
    <span className={`text-xs ${colorClass}`}>
      {change > 0 ? '+' : ''}{change}%
    </span>
  );
}
