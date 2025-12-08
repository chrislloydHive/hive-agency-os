// components/media-lab/MediaProgramSection.tsx
// Blueprint integration component - shows media program status in company Blueprint view

import React from 'react';
import Link from 'next/link';
import type { MediaLabSummary } from '@/lib/media-lab/types';
import { MEDIA_OBJECTIVE_LABELS, MEDIA_STATUS_LABELS } from '@/lib/media-lab/types';

type Props = {
  companyId: string;
  summary: MediaLabSummary;
};

/**
 * Media Program Section for Blueprint
 *
 * Only shows if company has a media program (hasMediaProgram = true or activePlanCount > 0)
 */
export function MediaProgramSection({ companyId, summary }: Props) {
  // Don't render if no media program
  if (!summary.hasMediaProgram && summary.activePlanCount === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Media Program</h3>
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

      <div className="space-y-3">
        {/* Objective */}
        {summary.primaryObjective && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Objective</span>
            <span className="font-medium text-white">
              {MEDIA_OBJECTIVE_LABELS[summary.primaryObjective]}
            </span>
          </div>
        )}

        {/* Primary Markets */}
        {summary.primaryMarkets && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Primary Markets</span>
            <span className="font-medium text-white">
              {summary.primaryMarkets}
            </span>
          </div>
        )}

        {/* Total Budget */}
        {summary.totalActiveBudget && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Total Active Budget</span>
            <span className="text-lg font-semibold text-white">
              ${summary.totalActiveBudget.toLocaleString()}
            </span>
          </div>
        )}

        {/* Active Plans Count */}
        {summary.activePlanCount > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Active Plans</span>
            <span className="font-medium text-white">
              {summary.activePlanCount}
            </span>
          </div>
        )}
      </div>

      {/* CTA */}
      <Link
        href={`/media-lab/${companyId}`}
        className="mt-4 block w-full rounded-lg bg-blue-600 px-4 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-blue-700"
      >
        View Media Plan in Media Lab →
      </Link>
    </div>
  );
}

/**
 * Lightweight "No Media" notice for Blueprint
 *
 * Shows only when explicitly needed (optional, can be omitted entirely)
 */
export function NoMediaNotice() {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
      <p className="text-sm text-zinc-500">
        Not running media
      </p>
    </div>
  );
}
