// components/media-lab/MediaDashboardSection.tsx
// Dashboard integration component - shows media metrics and status in company dashboard

import React from 'react';
import Link from 'next/link';
import type { MediaLabSummary, MediaLabData } from '@/lib/media-lab/types';
import { MEDIA_STATUS_LABELS, MEDIA_CHANNEL_LABELS } from '@/lib/media-lab/types';

type Props = {
  companyId: string;
  data: MediaLabData;
};

/**
 * Media Dashboard Section
 *
 * Only renders if company has a media program (hasMediaProgram = true or activePlanCount > 0)
 * Shows high-level metrics and quick links to Media Lab
 */
export function MediaDashboardSection({ companyId, data }: Props) {
  const { summary, plans } = data;

  // Don't render if no media program
  if (!summary.hasMediaProgram && summary.activePlanCount === 0) {
    return null;
  }

  // Get active plan channels for overview
  const activePlan = plans.find((p) => p.plan.status === 'active');
  const channels = activePlan?.channels || [];

  return (
    <div className="space-y-6">
      {/* Media Overview Card */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Media Overview</h3>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
              summary.mediaStatus === 'running'
                ? 'bg-green-600/20 text-green-400'
                : summary.mediaStatus === 'planning'
                ? 'bg-yellow-600/20 text-yellow-400'
                : summary.mediaStatus === 'paused'
                ? 'bg-orange-600/20 text-orange-400'
                : 'bg-zinc-700/50 text-zinc-400'
            }`}
          >
            {MEDIA_STATUS_LABELS[summary.mediaStatus]}
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Total Active Budget */}
          {summary.totalActiveBudget && (
            <div>
              <div className="text-xs text-zinc-500">Total Budget (Active)</div>
              <div className="mt-1 text-2xl font-semibold text-white">
                ${(summary.totalActiveBudget / 1000).toFixed(0)}K
              </div>
            </div>
          )}

          {/* Active Plans */}
          <div>
            <div className="text-xs text-zinc-500">Active Plans</div>
            <div className="mt-1 text-2xl font-semibold text-white">
              {summary.activePlanCount}
            </div>
          </div>

          {/* Budget This Month - Placeholder */}
          <div>
            <div className="text-xs text-zinc-500">Budget This Month</div>
            <div className="mt-1 text-sm text-zinc-400">TBD</div>
          </div>
        </div>

        {/* Link to Media Lab */}
        <Link
          href={`/media-lab/${companyId}`}
          className="mt-4 inline-flex items-center text-sm font-medium text-blue-400 transition-colors hover:text-blue-300"
        >
          View in Media Lab →
        </Link>
      </div>

      {/* Channels Overview Card */}
      {channels.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h3 className="mb-4 text-lg font-semibold text-white">
            Channels Overview
          </h3>

          <div className="space-y-3">
            {channels
              .sort((a, b) => (b.budgetSharePct || 0) - (a.budgetSharePct || 0))
              .slice(0, 4) // Show top 4 channels
              .map((channel) => (
                <div
                  key={channel.id}
                  className="flex items-center justify-between rounded-lg bg-zinc-800/50 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-medium text-white">
                      {MEDIA_CHANNEL_LABELS[channel.channel]}
                    </div>
                    {channel.priority && (
                      <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-xs capitalize text-zinc-300">
                        {channel.priority}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    {channel.budgetSharePct !== null && (
                      <div className="text-sm font-semibold text-white">
                        {channel.budgetSharePct}%
                      </div>
                    )}
                    {channel.budgetAmount !== null && (
                      <div className="text-xs text-zinc-400">
                        ${(channel.budgetAmount / 1000).toFixed(0)}K
                      </div>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * No Media Program Notice for Dashboard
 *
 * Shows a minimalist card when company doesn't have a media program
 * Can be used or omitted based on dashboard design preferences
 */
export function NoMediaProgramNotice({ companyId }: { companyId: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-6">
      <h3 className="mb-2 text-lg font-semibold text-white">
        Media Program
      </h3>
      <p className="mb-4 text-sm text-zinc-400">
        No performance media program detected for this company. If this client
        should be running media, start by defining a plan in Media Lab.
      </p>
      <Link
        href={`/media-lab/${companyId}`}
        className="inline-flex items-center text-sm font-medium text-blue-400 transition-colors hover:text-blue-300"
      >
        Set up Media Lab →
      </Link>
    </div>
  );
}
