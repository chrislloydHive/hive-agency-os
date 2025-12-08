// components/media-lab/MediaLabView.tsx
'use client';

import React, { useState } from 'react';
import type {
  MediaLabData,
  MediaPlan,
  MediaPlanChannel,
  MediaPlanFlight,
} from '@/lib/media-lab/types';
import {
  MEDIA_CHANNEL_LABELS,
  MEDIA_OBJECTIVE_LABELS,
  MEDIA_PLAN_STATUS_LABELS,
  MEDIA_SEASON_LABELS,
} from '@/lib/media-lab/types';

type Props = {
  companyId: string;
  data: MediaLabData;
};

export function MediaLabView({ companyId, data }: Props) {
  const { summary, plans: plansWithDetails } = data;
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(
    plansWithDetails.length > 0 ? plansWithDetails[0].plan.id : null
  );

  // Find the selected plan details
  const selectedPlanData = plansWithDetails.find(
    (p) => p.plan.id === selectedPlanId
  );

  // Empty state
  if (!summary.hasMediaProgram && plansWithDetails.length === 0) {
    return <MediaLabEmptyState />;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-900/50 px-6 py-6">
        <h1 className="text-2xl font-semibold">Media Lab</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Performance media planning, budgets, and channel strategy
        </p>
      </div>

      <div className="p-6">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left Column - Strategy & Details */}
          <div className="space-y-6">
            {/* Plan Selector */}
            {plansWithDetails.length > 1 && (
              <PlanSelector
                plans={plansWithDetails.map((p) => p.plan)}
                selectedPlanId={selectedPlanId}
                onSelectPlan={setSelectedPlanId}
              />
            )}

            {/* Media Plan Overview */}
            {selectedPlanData && (
              <>
                <MediaPlanOverview
                  plan={selectedPlanData.plan}
                  summary={summary}
                />

                {/* Channel Mix & Budget */}
                <ChannelMixCard
                  plan={selectedPlanData.plan}
                  channels={selectedPlanData.channels}
                />
              </>
            )}
          </div>

          {/* Right Column - Implementation & Actions */}
          <div className="space-y-6">
            {/* Seasonal Flights */}
            {selectedPlanData && (
              <SeasonalFlightsCard flights={selectedPlanData.flights} />
            )}

            {/* Markets Summary */}
            {selectedPlanData && selectedPlanData.plan.primaryMarkets && (
              <MarketsCard markets={selectedPlanData.plan.primaryMarkets} />
            )}

            {/* Actions */}
            <ActionsCard companyId={companyId} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

function MediaLabEmptyState() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-6">
      <div className="max-w-md text-center">
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800">
          <svg
            className="h-6 w-6 text-zinc-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        </div>
        <h2 className="mb-2 text-xl font-semibold text-white">
          No media plans yet
        </h2>
        <p className="mb-6 text-sm text-zinc-400">
          No media plans for this company yet. Use Media Lab to define objectives,
          budget, and channel mix when you're ready to run performance media.
        </p>
        <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700">
          Define Media Program
        </button>
        <p className="mt-3 text-xs text-zinc-500">
          For now, create media plans directly in Airtable
        </p>
      </div>
    </div>
  );
}

function PlanSelector({
  plans,
  selectedPlanId,
  onSelectPlan,
}: {
  plans: MediaPlan[];
  selectedPlanId: string | null;
  onSelectPlan: (id: string) => void;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <h3 className="mb-4 text-sm font-semibold text-white">Select Plan</h3>
      <div className="space-y-2">
        {plans.map((plan) => (
          <button
            key={plan.id}
            onClick={() => onSelectPlan(plan.id)}
            className={`w-full rounded-lg border p-4 text-left transition-all ${
              selectedPlanId === plan.id
                ? 'border-blue-600 bg-blue-600/10'
                : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium text-white">{plan.name}</div>
                <div className="mt-1 text-xs text-zinc-400">
                  {MEDIA_OBJECTIVE_LABELS[plan.objective]} •{' '}
                  {MEDIA_PLAN_STATUS_LABELS[plan.status]}
                </div>
              </div>
              {plan.totalBudget && (
                <div className="text-sm font-semibold text-white">
                  ${(plan.totalBudget / 1000).toFixed(0)}K
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function MediaPlanOverview({
  plan,
  summary,
}: {
  plan: MediaPlan;
  summary: any;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <h3 className="mb-4 text-sm font-semibold text-white">Plan Overview</h3>

      {/* Status & Objective Pills */}
      <div className="mb-4 flex flex-wrap gap-2">
        <span className="inline-flex items-center rounded-full bg-blue-600/20 px-3 py-1 text-xs font-medium text-blue-400">
          {MEDIA_PLAN_STATUS_LABELS[plan.status]}
        </span>
        <span className="inline-flex items-center rounded-full bg-purple-600/20 px-3 py-1 text-xs font-medium text-purple-400">
          {MEDIA_OBJECTIVE_LABELS[plan.objective]}
        </span>
        {plan.hasSeasonalFlights && (
          <span className="inline-flex items-center rounded-full bg-orange-600/20 px-3 py-1 text-xs font-medium text-orange-400">
            Seasonal Flights
          </span>
        )}
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 sm:grid-cols-2">
        {plan.totalBudget && (
          <div>
            <div className="text-xs text-zinc-500">Total Budget</div>
            <div className="mt-1 text-xl font-semibold text-white">
              ${plan.totalBudget.toLocaleString()}
            </div>
          </div>
        )}
        {plan.timeframeStart && plan.timeframeEnd && (
          <div>
            <div className="text-xs text-zinc-500">Timeframe</div>
            <div className="mt-1 text-sm text-white">
              {new Date(plan.timeframeStart).toLocaleDateString()} -{' '}
              {new Date(plan.timeframeEnd).toLocaleDateString()}
            </div>
          </div>
        )}
      </div>

      {plan.notes && (
        <div className="mt-4 rounded-lg bg-zinc-800/50 p-3">
          <div className="text-xs text-zinc-500">Strategy Notes</div>
          <div className="mt-1 text-sm text-zinc-300">{plan.notes}</div>
        </div>
      )}
    </div>
  );
}

function ChannelMixCard({
  plan,
  channels,
}: {
  plan: MediaPlan;
  channels: MediaPlanChannel[];
}) {
  const sortedChannels = [...channels].sort(
    (a, b) => (b.budgetSharePct || 0) - (a.budgetSharePct || 0)
  );

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <h3 className="mb-4 text-sm font-semibold text-white">
        Channel Mix & Budget
      </h3>

      {channels.length === 0 ? (
        <p className="text-sm text-zinc-500">No channels defined yet</p>
      ) : (
        <>
          {/* Budget Bar */}
          <div className="mb-6 flex h-8 overflow-hidden rounded-lg">
            {sortedChannels.map((channel, idx) => (
              <div
                key={channel.id}
                className={`flex items-center justify-center text-xs font-medium text-white ${
                  idx === 0 ? 'bg-blue-600' :
                  idx === 1 ? 'bg-purple-600' :
                  idx === 2 ? 'bg-pink-600' :
                  idx === 3 ? 'bg-orange-600' :
                  'bg-zinc-600'
                }`}
                style={{ width: `${channel.budgetSharePct || 0}%` }}
              >
                {(channel.budgetSharePct || 0) > 10 && (
                  <span>{channel.budgetSharePct}%</span>
                )}
              </div>
            ))}
          </div>

          {/* Channel Details Table */}
          <div className="space-y-2">
            {sortedChannels.map((channel) => (
              <div
                key={channel.id}
                className="rounded-lg border border-zinc-800 bg-zinc-800/30 p-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-white">
                      {MEDIA_CHANNEL_LABELS[channel.channel]}
                    </div>
                    <div className="mt-1 flex gap-4 text-xs text-zinc-400">
                      {channel.budgetSharePct !== null && (
                        <span>{channel.budgetSharePct}% of budget</span>
                      )}
                      {channel.budgetAmount !== null && (
                        <span>${channel.budgetAmount.toLocaleString()}</span>
                      )}
                      {channel.priority && (
                        <span className="capitalize">
                          {channel.priority}
                        </span>
                      )}
                    </div>
                  </div>
                  {channel.expectedVolume && channel.expectedCpl && (
                    <div className="text-right">
                      <div className="text-xs text-zinc-500">Expected</div>
                      <div className="text-sm font-medium text-white">
                        {channel.expectedVolume} @ ${channel.expectedCpl}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SeasonalFlightsCard({ flights }: { flights: MediaPlanFlight[] }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <h3 className="mb-4 text-sm font-semibold text-white">
        Seasonal Flights
      </h3>

      {flights.length === 0 ? (
        <p className="text-sm text-zinc-500">No seasonal flights defined</p>
      ) : (
        <div className="space-y-3">
          {flights.map((flight) => (
            <div
              key={flight.id}
              className="rounded-lg border border-zinc-800 bg-zinc-800/30 p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="text-sm font-medium text-white">
                    {flight.name}
                  </div>
                  {flight.season && (
                    <div className="mt-1 text-xs text-zinc-400">
                      {MEDIA_SEASON_LABELS[flight.season]}
                    </div>
                  )}
                  {flight.startDate && flight.endDate && (
                    <div className="mt-1 text-xs text-zinc-500">
                      {new Date(flight.startDate).toLocaleDateString()} -{' '}
                      {new Date(flight.endDate).toLocaleDateString()}
                    </div>
                  )}
                  {flight.primaryChannels.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {flight.primaryChannels.map((ch) => (
                        <span
                          key={ch}
                          className="inline-flex items-center rounded-full bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300"
                        >
                          {MEDIA_CHANNEL_LABELS[ch]}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {flight.budget && (
                  <div className="ml-4 text-sm font-semibold text-white">
                    ${(flight.budget / 1000).toFixed(0)}K
                  </div>
                )}
              </div>
              {flight.marketsStores && (
                <div className="mt-2 text-xs text-zinc-400">
                  {flight.marketsStores}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MarketsCard({ markets }: { markets: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <h3 className="mb-4 text-sm font-semibold text-white">
        Markets / Coverage
      </h3>
      <p className="text-sm text-zinc-300">{markets}</p>
    </div>
  );
}

function ActionsCard({ companyId }: { companyId: string }) {
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleSendToOps = () => {
    setToastMessage('Stub: This will create work items in a future version');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleOpenAnalytics = () => {
    // For now, just show a message. Later this can navigate to analytics
    setToastMessage('Media analytics coming soon');
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <h3 className="mb-4 text-sm font-semibold text-white">Actions</h3>

      <div className="space-y-3">
        <button
          onClick={handleSendToOps}
          className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          Send to Ops Lab
        </button>
        <button
          onClick={handleOpenAnalytics}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
        >
          Open Media Analytics
        </button>
      </div>

      {/* Toast */}
      {toastMessage && (
        <div className="mt-4 rounded-lg bg-zinc-800 p-3 text-sm text-zinc-300">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
