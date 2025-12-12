'use client';

// components/labs/analytics/AnalyticsOrganicPanel.tsx
// Organic search panel showing Search Console metrics

import { Search, MousePointer, Eye, Hash, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { AnalyticsLabSnapshot, AnalyticsTrendSeries } from '@/lib/analytics/analyticsTypes';
import { formatCompactNumber } from '@/lib/types/companyAnalytics';
import { classifyTrendSlope, getTrendColorClass } from '@/lib/analytics/analyticsTypes';
import { AnalyticsTrendsChart } from './AnalyticsTrendsChart';

// ============================================================================
// Types
// ============================================================================

interface AnalyticsOrganicPanelProps {
  snapshot: AnalyticsLabSnapshot;
  trends: AnalyticsTrendSeries;
}

// ============================================================================
// Component
// ============================================================================

export function AnalyticsOrganicPanel({
  snapshot,
  trends,
}: AnalyticsOrganicPanelProps) {
  const gsc = snapshot.sourceSearchConsole;
  if (!gsc) return null;

  const clicksSlope = classifyTrendSlope(snapshot.delta.organicClicksMoM);
  const clicksColorClass = getTrendColorClass(clicksSlope);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
            <Search className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-200">Organic Search</h3>
            <p className="text-xs text-slate-500">Search Console</p>
          </div>
        </div>

        {/* Trend Badge */}
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${clicksColorClass} bg-opacity-10`}>
          {clicksSlope === 'up' || clicksSlope === 'strong_up' ? (
            <TrendingUp className="w-3 h-3" />
          ) : clicksSlope === 'down' || clicksSlope === 'strong_down' ? (
            <TrendingDown className="w-3 h-3" />
          ) : (
            <Minus className="w-3 h-3" />
          )}
          <span className="text-xs font-medium">
            {snapshot.delta.organicClicksMoM !== null
              ? `${snapshot.delta.organicClicksMoM > 0 ? '+' : ''}${snapshot.delta.organicClicksMoM}%`
              : 'Stable'}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Key Metrics Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3 bg-slate-800/50 rounded-lg">
            <div className="flex items-center gap-1.5 mb-1">
              <MousePointer className="w-3 h-3 text-slate-500" />
              <p className="text-xs text-slate-500">Clicks</p>
            </div>
            <p className="text-lg font-semibold text-slate-100">
              {formatCompactNumber(gsc.clicks)}
            </p>
          </div>
          <div className="p-3 bg-slate-800/50 rounded-lg">
            <div className="flex items-center gap-1.5 mb-1">
              <Eye className="w-3 h-3 text-slate-500" />
              <p className="text-xs text-slate-500">Impressions</p>
            </div>
            <p className="text-lg font-semibold text-slate-100">
              {formatCompactNumber(gsc.impressions)}
            </p>
          </div>
          <div className="p-3 bg-slate-800/50 rounded-lg">
            <p className="text-xs text-slate-500 mb-1">CTR</p>
            <p className="text-lg font-semibold text-slate-100">
              {gsc.ctr}%
            </p>
          </div>
          <div className="p-3 bg-slate-800/50 rounded-lg">
            <div className="flex items-center gap-1.5 mb-1">
              <Hash className="w-3 h-3 text-slate-500" />
              <p className="text-xs text-slate-500">Avg Position</p>
            </div>
            <p className="text-lg font-semibold text-slate-100">
              {gsc.avgPosition}
            </p>
          </div>
        </div>

        {/* Trend Chart */}
        <div className="h-32">
          <AnalyticsTrendsChart
            data={trends.organicClicks}
            color="emerald"
            label="Organic Clicks"
          />
        </div>

        {/* Top Queries Table */}
        {gsc.topQueries && gsc.topQueries.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-slate-400 mb-2">Top Queries</h4>
            <div className="overflow-hidden rounded-lg border border-slate-700">
              <table className="w-full text-xs">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="text-left text-slate-400 font-medium px-3 py-2">Query</th>
                    <th className="text-right text-slate-400 font-medium px-3 py-2">Clicks</th>
                    <th className="text-right text-slate-400 font-medium px-3 py-2">CTR</th>
                    <th className="text-right text-slate-400 font-medium px-3 py-2">Pos</th>
                  </tr>
                </thead>
                <tbody>
                  {gsc.topQueries.slice(0, 5).map((query, i) => (
                    <tr key={i} className="border-t border-slate-700/50">
                      <td className="px-3 py-2 text-slate-300 truncate max-w-[150px]">
                        {query.query}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-400">
                        {formatCompactNumber(query.clicks)}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-400">
                        {query.ctr}%
                      </td>
                      <td className="px-3 py-2 text-right text-slate-400">
                        {query.position}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
