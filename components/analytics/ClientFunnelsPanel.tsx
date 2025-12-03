// components/analytics/ClientFunnelsPanel.tsx
// ============================================================================
// Client Funnels Panel - Company-specific funnel visualization
// ============================================================================
//
// Displays marketing funnels for a company using their GA4 data.
// This replaces the Hive-specific DMA/GAP funnels in company analytics views.

'use client';

import { useMemo } from 'react';
import { StandardFunnelPanel } from './StandardFunnelPanel';
import { getClientFunnelsFromSnapshot, type ClientFunnelMetrics } from '@/lib/analytics/clientFunnels';
import type { CompanyAnalyticsSnapshot } from '@/lib/analytics/types';

// ============================================================================
// Types
// ============================================================================

interface ClientFunnelsPanelProps {
  snapshot: CompanyAnalyticsSnapshot | null;
  companyId: string;
  companyName: string;
  isLoading?: boolean;
  dateRangeLabel?: string;
}

// ============================================================================
// Component
// ============================================================================

export function ClientFunnelsPanel({
  snapshot,
  companyId,
  companyName,
  isLoading = false,
  dateRangeLabel,
}: ClientFunnelsPanelProps) {
  // Build client funnels from snapshot
  const funnels = useMemo(() => {
    if (!snapshot) return [];
    return getClientFunnelsFromSnapshot(snapshot, companyName);
  }, [snapshot, companyName]);

  // Check if GA4 is connected
  const hasGa4 = snapshot?.ga4 && snapshot.ga4.metrics?.sessions !== undefined;

  // No GA4 connection - show setup message
  if (!hasGa4 && !isLoading) {
    return (
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
              <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                />
              </svg>
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-slate-200 mb-1">
              Funnels Unavailable
            </h3>
            <p className="text-sm text-slate-400 mb-3">
              Connect GA4 to unlock funnel analysis for {companyName}.
            </p>
            <p className="text-xs text-slate-500">
              Funnels require GA4 event tracking for CTA clicks, form submissions, and page engagement.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // No funnel data available
  if (funnels.length === 0 || !funnels.some(f => f.hasData)) {
    return (
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6 text-center">
        <svg
          className="w-12 h-12 mx-auto text-slate-600 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
          />
        </svg>
        <h3 className="text-lg font-semibold text-slate-300 mb-2">
          Not Enough Event Data
        </h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Not enough event data to build funnels yet. Make sure GA4 is connected and key events
          (CTA clicks, form submissions) are configured.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Marketing Funnels</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Conversion pathways for {companyName}
          </p>
        </div>
        {dateRangeLabel && (
          <span className="text-xs text-slate-500">{dateRangeLabel}</span>
        )}
      </div>

      {/* Funnel Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {funnels.map((funnel) => (
          <StandardFunnelPanel
            key={funnel.definition.id}
            title={funnel.definition.name}
            subtitle={funnel.definition.description}
            steps={funnel.steps}
            overallConversionRate={funnel.overallConversionRate}
            totalSessions={funnel.totalSessions}
            trendLabel={funnel.trendLabel}
            isLoading={isLoading}
            emptyStateMessage="No data for this funnel in the selected period."
          />
        ))}
      </div>

      {/* Quick Insights */}
      {funnels.some(f => f.hasData) && (
        <FunnelInsightsCard funnels={funnels} companyName={companyName} />
      )}
    </div>
  );
}

// ============================================================================
// Insights Card Sub-component
// ============================================================================

function FunnelInsightsCard({
  funnels,
  companyName,
}: {
  funnels: ClientFunnelMetrics[];
  companyName: string;
}) {
  // Generate quick insights from funnel data
  const insights = useMemo(() => {
    const results: string[] = [];

    for (const funnel of funnels) {
      if (!funnel.hasData) continue;

      // Check for significant drop-offs
      for (let i = 1; i < funnel.steps.length; i++) {
        const step = funnel.steps[i];
        if (step.dropoffRate !== null && step.dropoffRate !== undefined && step.dropoffRate > 0.7) {
          results.push(
            `High drop-off (${Math.round(step.dropoffRate * 100)}%) at "${step.label}" step in ${funnel.definition.name}`
          );
        }
      }

      // Check overall conversion
      if (funnel.overallConversionRate !== null) {
        if (funnel.overallConversionRate < 0.01) {
          results.push(
            `${funnel.definition.name} has low overall conversion (${(funnel.overallConversionRate * 100).toFixed(1)}%)`
          );
        } else if (funnel.overallConversionRate > 0.05) {
          results.push(
            `${funnel.definition.name} is performing well with ${(funnel.overallConversionRate * 100).toFixed(1)}% conversion`
          );
        }
      }
    }

    return results.slice(0, 3); // Limit to 3 insights
  }, [funnels]);

  if (insights.length === 0) return null;

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <div>
          <h4 className="text-sm font-medium text-slate-200 mb-2">Quick Insights</h4>
          <ul className="space-y-1">
            {insights.map((insight, idx) => (
              <li key={idx} className="text-xs text-slate-400 flex items-start gap-2">
                <span className="text-slate-600 mt-1">•</span>
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Exports
// ============================================================================

export default ClientFunnelsPanel;
