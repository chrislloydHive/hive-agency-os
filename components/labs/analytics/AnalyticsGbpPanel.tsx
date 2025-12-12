'use client';

// components/labs/analytics/AnalyticsGbpPanel.tsx
// Google Business Profile panel

import { MapPin, Phone, Navigation, Globe, Eye, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { AnalyticsLabSnapshot, AnalyticsTrendSeries } from '@/lib/analytics/analyticsTypes';
import { formatCompactNumber } from '@/lib/types/companyAnalytics';
import { classifyTrendSlope, getTrendColorClass } from '@/lib/analytics/analyticsTypes';
import { AnalyticsTrendsChart } from './AnalyticsTrendsChart';

// ============================================================================
// Types
// ============================================================================

interface AnalyticsGbpPanelProps {
  snapshot: AnalyticsLabSnapshot;
  trends: AnalyticsTrendSeries;
}

// ============================================================================
// Component
// ============================================================================

export function AnalyticsGbpPanel({
  snapshot,
  trends,
}: AnalyticsGbpPanelProps) {
  const gbp = snapshot.sourceGbp;
  if (!gbp) return null;

  const actionsSlope = classifyTrendSlope(snapshot.delta.gbpActionsMoM);
  const actionsColorClass = getTrendColorClass(actionsSlope);

  const totalActions = gbp.calls + gbp.directionRequests + gbp.websiteClicks;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <MapPin className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-200">Local Performance</h3>
            <p className="text-xs text-slate-500">Google Business Profile</p>
          </div>
        </div>

        {/* Trend Badge */}
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${actionsColorClass} bg-opacity-10`}>
          {actionsSlope === 'up' || actionsSlope === 'strong_up' ? (
            <TrendingUp className="w-3 h-3" />
          ) : actionsSlope === 'down' || actionsSlope === 'strong_down' ? (
            <TrendingDown className="w-3 h-3" />
          ) : (
            <Minus className="w-3 h-3" />
          )}
          <span className="text-xs font-medium">
            {snapshot.delta.gbpActionsMoM !== null
              ? `${snapshot.delta.gbpActionsMoM > 0 ? '+' : ''}${snapshot.delta.gbpActionsMoM}%`
              : 'Stable'}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Total Actions Highlight */}
        <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg text-center">
          <p className="text-xs text-slate-500 mb-1">Total Actions</p>
          <p className="text-3xl font-bold text-slate-100">
            {formatCompactNumber(totalActions)}
          </p>
        </div>

        {/* Actions Breakdown */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
            <Eye className="w-4 h-4 text-slate-400" />
            <div>
              <p className="text-xs text-slate-500">Views</p>
              <p className="text-sm font-medium text-slate-200">
                {formatCompactNumber(gbp.views)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
            <Phone className="w-4 h-4 text-emerald-400" />
            <div>
              <p className="text-xs text-slate-500">Calls</p>
              <p className="text-sm font-medium text-slate-200">
                {formatCompactNumber(gbp.calls)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
            <Navigation className="w-4 h-4 text-blue-400" />
            <div>
              <p className="text-xs text-slate-500">Directions</p>
              <p className="text-sm font-medium text-slate-200">
                {formatCompactNumber(gbp.directionRequests)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
            <Globe className="w-4 h-4 text-purple-400" />
            <div>
              <p className="text-xs text-slate-500">Website Clicks</p>
              <p className="text-sm font-medium text-slate-200">
                {formatCompactNumber(gbp.websiteClicks)}
              </p>
            </div>
          </div>
        </div>

        {/* Trend Chart */}
        <div className="h-32">
          <AnalyticsTrendsChart
            data={trends.gbpActions}
            color="amber"
            label="GBP Actions"
          />
        </div>

        {/* Photo Views */}
        {gbp.photoViews > 0 && (
          <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg">
            <span className="text-xs text-slate-500">Photo Views</span>
            <span className="text-sm font-medium text-slate-300">
              {formatCompactNumber(gbp.photoViews)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
