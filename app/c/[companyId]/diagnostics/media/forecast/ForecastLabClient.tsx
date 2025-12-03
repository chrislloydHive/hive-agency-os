'use client';

// app/c/[companyId]/diagnostics/media/forecast/ForecastLabClient.tsx
// Forecast Lab Client - Interactive budget forecasting interface
//
// Features:
// - Real-time forecast calculations as budget/mix changes
// - Two-column layout: controls on left, results on right
// - Channel breakdown with efficiency metrics
// - Store-level projections

import { useState, useCallback, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { BudgetControls } from '@/components/media/BudgetControls';
import { ForecastSummary } from '@/components/media/ForecastSummary';
import { ChannelForecastGrid } from '@/components/media/ChannelForecastGrid';
import { StoreForecastGrid } from '@/components/media/StoreForecastGrid';
import {
  type MediaAssumptions,
} from '@/lib/media/assumptions';
import {
  type MediaBudgetInput,
  type MediaForecastResult,
  type StoreInfo,
  type SeasonKey,
  DEFAULT_CHANNEL_SPLITS,
  forecastMediaPlan,
} from '@/lib/media/forecastEngine';

// ============================================================================
// Types
// ============================================================================

interface ForecastLabClientProps {
  companyId: string;
  companyName: string;
  initialAssumptions: MediaAssumptions;
  stores: StoreInfo[];
}

// ============================================================================
// Main Component
// ============================================================================

export function ForecastLabClient({
  companyId,
  companyName,
  initialAssumptions,
  stores,
}: ForecastLabClientProps) {
  // Budget state
  const [budget, setBudget] = useState<MediaBudgetInput>({
    totalMonthlyBudget: 10000,
    season: 'baseline' as SeasonKey,
    channelSplits: { ...DEFAULT_CHANNEL_SPLITS },
  });

  // Assumptions state (could be edited in AssumptionsPanel)
  const [assumptions] = useState<MediaAssumptions>(initialAssumptions);

  // Calculate forecast whenever budget or assumptions change
  const forecast = useMemo<MediaForecastResult | null>(() => {
    if (budget.totalMonthlyBudget <= 0) {
      return null;
    }

    return forecastMediaPlan({
      budget,
      assumptions,
      stores,
    });
  }, [budget, assumptions, stores]);

  // Handle budget changes
  const handleBudgetChange = useCallback((newBudget: MediaBudgetInput) => {
    setBudget(newBudget);
  }, []);

  return (
    <div className="min-h-screen bg-[#050509]">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href={`/c/${companyId}/diagnostics/media`}
              className="text-sm text-slate-400 hover:text-slate-300"
            >
              ← Back to Media Lab
            </Link>
            <span className="text-slate-600">|</span>
            <h1 className="text-sm font-medium text-slate-300">
              Forecast Simulator
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-500">
              {companyName}
            </span>
            <Link
              href={`/c/${companyId}/media`}
              className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-400 hover:text-slate-300 hover:bg-slate-700"
            >
              View Performance →
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-6 py-6">
        {/* Page Title */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-slate-200">
            Media Budget Simulator
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Adjust budget and channel mix to see projected results in real-time
          </p>
        </div>

        {/* Two-Column Layout */}
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left Column - Controls */}
          <div className="lg:col-span-4 space-y-6">
            <BudgetControls
              budget={budget}
              onBudgetChange={handleBudgetChange}
            />

            {/* Quick Budget Presets */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-3">
                Quick Presets
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {[5000, 10000, 25000, 50000].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setBudget({ ...budget, totalMonthlyBudget: amount })}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                      budget.totalMonthlyBudget === amount
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                        : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    ${(amount / 1000).toFixed(0)}K
                  </button>
                ))}
              </div>
            </div>

            {/* Assumptions Link */}
            <div className="bg-slate-900/50 border border-slate-800 border-dashed rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-400">
                    Forecast Assumptions
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    CPCs, conversion rates, seasonality
                  </p>
                </div>
                <Link
                  href={`/c/${companyId}/diagnostics/media/assumptions`}
                  className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-400 hover:text-slate-300 hover:bg-slate-700"
                >
                  Edit →
                </Link>
              </div>
            </div>
          </div>

          {/* Right Column - Results */}
          <div className="lg:col-span-8 space-y-6">
            <ForecastSummary forecast={forecast} />
            <ChannelForecastGrid forecast={forecast} />
            {stores.length > 0 && (
              <StoreForecastGrid forecast={forecast} />
            )}

            {/* Export/Save Actions */}
            {forecast && forecast.summary.totalBudget > 0 && (
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    // Copy forecast summary to clipboard
                    const summary = `
Media Forecast Summary for ${companyName}
Budget: $${forecast.summary.totalBudget.toLocaleString()}
Season: ${forecast.seasonLabel}

Projected Results:
- Impressions: ${forecast.summary.totalImpressions.toLocaleString()}
- Clicks: ${forecast.summary.totalClicks.toLocaleString()}
- Leads: ${forecast.summary.totalLeads.toLocaleString()}
- Calls: ${forecast.summary.totalCalls.toLocaleString()}
- Installs: ${forecast.summary.totalInstalls.toLocaleString()}

Cost Metrics:
- Blended CPC: $${forecast.summary.blendedCPC.toFixed(2)}
- Blended CPL: ${forecast.summary.blendedCPL ? `$${forecast.summary.blendedCPL.toFixed(2)}` : 'N/A'}
- Blended CPI: ${forecast.summary.blendedCPI ? `$${forecast.summary.blendedCPI.toFixed(2)}` : 'N/A'}
- Conversion Rate: ${(forecast.summary.blendedConvRate * 100).toFixed(1)}%

Channel Mix:
${forecast.byChannel.map(ch => `- ${ch.channelLabel}: $${ch.budget.toLocaleString()} (${Math.round(ch.budgetPercent * 100)}%)`).join('\n')}
                    `.trim();
                    navigator.clipboard.writeText(summary);
                    alert('Forecast copied to clipboard!');
                  }}
                  className="px-4 py-2 text-sm rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
                >
                  Copy Summary
                </button>
                <button
                  onClick={() => {
                    // In production: Save as media plan
                    alert('Save as Media Plan - Coming soon!');
                  }}
                  className="px-4 py-2 text-sm rounded-lg bg-amber-500 text-slate-900 font-medium hover:bg-amber-400"
                >
                  Save as Plan
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ForecastLabClient;
