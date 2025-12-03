// components/analytics/TrainrhubFunnelsPanel.tsx
// ============================================================================
// TrainrHub-Specific Funnels Panel
// ============================================================================
//
// Displays TrainrHub-specific funnels:
// - Trainer Acquisition Funnel (supply side)
// - Demand & Contacts Funnel (demand side)
//
// Only renders for TrainrHub company, returns null for others.

'use client';

import { useMemo } from 'react';
import { StandardFunnelPanel } from './StandardFunnelPanel';
import { isTrainrhubCompany } from '@/lib/analytics/funnels/trainrhub';
import { buildTrainrhubFunnelsFromSnapshot } from '@/lib/analytics/funnels/buildTrainrhubFunnels';
import type { CompanyAnalyticsSnapshot } from '@/lib/analytics/types';

// ============================================================================
// Types
// ============================================================================

interface TrainrhubFunnelsPanelProps {
  snapshot: CompanyAnalyticsSnapshot | null;
  companyId: string;
  companyName: string;
  isLoading?: boolean;
  dateRangeLabel?: string;
}

// ============================================================================
// Component
// ============================================================================

export function TrainrhubFunnelsPanel({
  snapshot,
  companyId,
  companyName,
  isLoading = false,
  dateRangeLabel,
}: TrainrhubFunnelsPanelProps) {
  // Check if this is TrainrHub - if not, render nothing
  const domain = snapshot?.domain || '';
  const isTrainrhub = isTrainrhubCompany(companyName, domain);

  // Build TrainrHub funnels from snapshot
  const funnels = useMemo(() => {
    if (!isTrainrhub || !snapshot) return [];
    return buildTrainrhubFunnelsFromSnapshot(snapshot);
  }, [isTrainrhub, snapshot]);

  // Don't render for non-TrainrHub companies
  if (!isTrainrhub) {
    return null;
  }

  // Check if we have GA4 connected
  const hasGa4 = snapshot?.ga4 && snapshot.ga4.metrics?.sessions !== undefined;

  // No GA4 connection - show setup message
  if (!hasGa4 && !isLoading) {
    return (
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              TrainrHub Funnels
            </h3>
            <p className="text-sm text-slate-400 mb-3">
              Connect GA4 to unlock Trainer Acquisition and Demand funnels.
            </p>
            <p className="text-xs text-slate-500">
              Funnels require GA4 event tracking for trainer signups, profile views, and contact actions.
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
          className="w-12 h-12 mx-auto text-purple-600 mb-4"
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
          Building TrainrHub Funnels
        </h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Waiting for GA4 event data. Make sure trainer signup and contact events are configured.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">TrainrHub Funnels</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Supply (Trainers) and Demand (Users) conversion pathways
          </p>
        </div>
        {dateRangeLabel && (
          <span className="text-xs text-slate-500">{dateRangeLabel}</span>
        )}
      </div>

      {/* Funnel Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {funnels.map((funnel) => (
          <StandardFunnelPanel
            key={funnel.key}
            title={funnel.name}
            subtitle={funnel.description}
            steps={funnel.steps}
            overallConversionRate={funnel.overallConversionRate}
            totalSessions={funnel.totalSessions}
            isLoading={isLoading}
            emptyStateMessage="Not enough data yet to calculate this funnel."
          />
        ))}
      </div>

      {/* TrainrHub-specific insights */}
      {funnels.some(f => f.hasData) && (
        <TrainrhubFunnelInsights funnels={funnels} />
      )}
    </div>
  );
}

// ============================================================================
// Insights Sub-component
// ============================================================================

function TrainrhubFunnelInsights({
  funnels,
}: {
  funnels: Array<{
    key: string;
    name: string;
    steps: Array<{ id: string; label: string; count: number | null; dropoffRate?: number | null }>;
    overallConversionRate: number | null;
    hasData: boolean;
  }>;
}) {
  const insights = useMemo(() => {
    const results: { type: 'warning' | 'success' | 'info'; text: string }[] = [];

    for (const funnel of funnels) {
      if (!funnel.hasData) continue;

      // Check for high drop-offs
      for (let i = 1; i < funnel.steps.length; i++) {
        const step = funnel.steps[i];
        if (step.dropoffRate !== null && step.dropoffRate !== undefined && step.dropoffRate > 0.7) {
          results.push({
            type: 'warning',
            text: `High drop-off (${Math.round(step.dropoffRate * 100)}%) at "${step.label}" in ${funnel.name}`,
          });
        }
      }

      // Check overall conversion
      if (funnel.overallConversionRate !== null) {
        if (funnel.overallConversionRate < 0.01) {
          results.push({
            type: 'warning',
            text: `${funnel.name} has very low conversion (${(funnel.overallConversionRate * 100).toFixed(1)}%)`,
          });
        } else if (funnel.overallConversionRate > 0.05) {
          results.push({
            type: 'success',
            text: `${funnel.name} is converting well at ${(funnel.overallConversionRate * 100).toFixed(1)}%`,
          });
        }
      }

      // TrainrHub-specific insights
      if (funnel.key === 'trainer_acquisition') {
        const signupStep = funnel.steps.find(s => s.id === 'signup_completed');
        if (signupStep && signupStep.count !== null && signupStep.count > 0) {
          results.push({
            type: 'info',
            text: `${signupStep.count} verified trainers signed up this period`,
          });
        }
      }

      if (funnel.key === 'demand_contacts') {
        const bookStep = funnel.steps.find(s => s.id === 'book_consult');
        const callStep = funnel.steps.find(s => s.id === 'call_click');
        const msgStep = funnel.steps.find(s => s.id === 'message_click');

        const totalContacts = (bookStep?.count || 0) + (callStep?.count || 0) + (msgStep?.count || 0);
        if (totalContacts > 0) {
          results.push({
            type: 'success',
            text: `${totalContacts} total contact actions (consults, calls, messages)`,
          });
        }
      }
    }

    return results.slice(0, 4); // Limit to 4 insights
  }, [funnels]);

  if (insights.length === 0) return null;

  return (
    <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <div>
          <h4 className="text-sm font-medium text-purple-200 mb-2">TrainrHub Insights</h4>
          <ul className="space-y-1.5">
            {insights.map((insight, idx) => (
              <li key={idx} className="text-xs flex items-start gap-2">
                <span className={`mt-0.5 ${
                  insight.type === 'warning' ? 'text-amber-400' :
                  insight.type === 'success' ? 'text-emerald-400' :
                  'text-purple-400'
                }`}>
                  {insight.type === 'warning' ? '⚠' : insight.type === 'success' ? '✓' : '•'}
                </span>
                <span className="text-slate-300">{insight.text}</span>
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

export default TrainrhubFunnelsPanel;
