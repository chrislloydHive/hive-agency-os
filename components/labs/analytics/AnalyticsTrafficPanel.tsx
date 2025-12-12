'use client';

// components/labs/analytics/AnalyticsTrafficPanel.tsx
// Traffic panel showing GA4 metrics

import { Users, UserPlus, ArrowRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { AnalyticsLabSnapshot, AnalyticsTrendSeries } from '@/lib/analytics/analyticsTypes';
import { formatCompactNumber } from '@/lib/types/companyAnalytics';
import { classifyTrendSlope, getTrendColorClass } from '@/lib/analytics/analyticsTypes';
import { AnalyticsTrendsChart } from './AnalyticsTrendsChart';

// ============================================================================
// Types
// ============================================================================

interface AnalyticsTrafficPanelProps {
  snapshot: AnalyticsLabSnapshot;
  trends: AnalyticsTrendSeries;
}

// ============================================================================
// Component
// ============================================================================

export function AnalyticsTrafficPanel({
  snapshot,
  trends,
}: AnalyticsTrafficPanelProps) {
  const ga4 = snapshot.sourceGa4;
  if (!ga4) return null;

  const sessionSlope = classifyTrendSlope(snapshot.delta.sessionsMoM);
  const sessionColorClass = getTrendColorClass(sessionSlope);

  // Get top channels
  const channelEntries = Object.entries(ga4.channelBreakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const totalChannelSessions = channelEntries.reduce((sum, [, val]) => sum + val, 0);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-200">Website Traffic</h3>
            <p className="text-xs text-slate-500">Google Analytics 4</p>
          </div>
        </div>

        {/* Trend Badge */}
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${sessionColorClass} bg-opacity-10`}>
          {sessionSlope === 'up' || sessionSlope === 'strong_up' ? (
            <TrendingUp className="w-3 h-3" />
          ) : sessionSlope === 'down' || sessionSlope === 'strong_down' ? (
            <TrendingDown className="w-3 h-3" />
          ) : (
            <Minus className="w-3 h-3" />
          )}
          <span className="text-xs font-medium">
            {snapshot.delta.sessionsMoM !== null
              ? `${snapshot.delta.sessionsMoM > 0 ? '+' : ''}${snapshot.delta.sessionsMoM}%`
              : 'Stable'}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Key Metrics Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 bg-slate-800/50 rounded-lg">
            <p className="text-xs text-slate-500 mb-1">Sessions</p>
            <p className="text-lg font-semibold text-slate-100">
              {formatCompactNumber(ga4.totalSessions)}
            </p>
          </div>
          <div className="p-3 bg-slate-800/50 rounded-lg">
            <p className="text-xs text-slate-500 mb-1">Conversions</p>
            <p className="text-lg font-semibold text-slate-100">
              {formatCompactNumber(ga4.conversions)}
            </p>
          </div>
          <div className="p-3 bg-slate-800/50 rounded-lg">
            <p className="text-xs text-slate-500 mb-1">Conv. Rate</p>
            <p className="text-lg font-semibold text-slate-100">
              {ga4.conversionRate}%
            </p>
          </div>
        </div>

        {/* Trend Chart */}
        <div className="h-32">
          <AnalyticsTrendsChart
            data={trends.sessions}
            color="blue"
            label="Sessions"
          />
        </div>

        {/* Users Breakdown */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 p-3 bg-slate-800/30 rounded-lg">
            <UserPlus className="w-4 h-4 text-emerald-400" />
            <div>
              <p className="text-xs text-slate-500">New Users</p>
              <p className="text-sm font-medium text-slate-200">
                {formatCompactNumber(ga4.newUsers)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 bg-slate-800/30 rounded-lg">
            <ArrowRight className="w-4 h-4 text-blue-400" />
            <div>
              <p className="text-xs text-slate-500">Returning</p>
              <p className="text-sm font-medium text-slate-200">
                {formatCompactNumber(ga4.returningUsers)}
              </p>
            </div>
          </div>
        </div>

        {/* Channel Breakdown */}
        <div>
          <h4 className="text-xs font-medium text-slate-400 mb-2">Channel Breakdown</h4>
          <div className="space-y-2">
            {channelEntries.map(([channel, sessions]) => {
              const percentage = totalChannelSessions > 0
                ? Math.round((sessions / totalChannelSessions) * 100)
                : 0;
              return (
                <div key={channel} className="flex items-center gap-2">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-400">{channel}</span>
                      <span className="text-xs text-slate-500">{formatCompactNumber(sessions)}</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
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
      </div>
    </div>
  );
}
