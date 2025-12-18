// components/strategy/StalenessBanner.tsx
// Staleness warning banner for Strategy Workspace
//
// Shows warnings when strategy components may be stale:
// - Context changed → objectives may need review
// - Objectives changed → strategy may need regeneration
// - Strategy changed → tactics may need regeneration

'use client';

import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { useState } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface StalenessIndicators {
  contextChanged: boolean;
  objectivesStale: boolean;
  strategyStale: boolean;
  tacticsStale: boolean;
  staleSummary: string[];
}

interface StalenessBannerProps {
  staleness: StalenessIndicators;
  onRefreshObjectives?: () => void;
  onRefreshStrategy?: () => void;
  onRefreshTactics?: () => void;
  onDismiss?: () => void;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function StalenessBanner({
  staleness,
  onRefreshObjectives,
  onRefreshStrategy,
  onRefreshTactics,
  onDismiss,
  className = '',
}: StalenessBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  // Don't show if nothing is stale or dismissed
  const hasStaleItems =
    staleness.objectivesStale ||
    staleness.strategyStale ||
    staleness.tacticsStale;

  if (!hasStaleItems || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div
      className={`
        bg-amber-500/10 border border-amber-500/30 rounded-lg p-4
        ${className}
      `}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-amber-300">
            Strategy may be out of date
          </h3>

          <ul className="mt-2 space-y-1">
            {staleness.objectivesStale && (
              <li className="flex items-center justify-between gap-2">
                <span className="text-sm text-amber-200/80">
                  Context has changed - objectives may need review
                </span>
                {onRefreshObjectives && (
                  <button
                    onClick={onRefreshObjectives}
                    className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Regenerate
                  </button>
                )}
              </li>
            )}

            {staleness.strategyStale && (
              <li className="flex items-center justify-between gap-2">
                <span className="text-sm text-amber-200/80">
                  Objectives have changed - strategy may need regeneration
                </span>
                {onRefreshStrategy && (
                  <button
                    onClick={onRefreshStrategy}
                    className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Regenerate
                  </button>
                )}
              </li>
            )}

            {staleness.tacticsStale && (
              <li className="flex items-center justify-between gap-2">
                <span className="text-sm text-amber-200/80">
                  Strategy has changed - tactics may need regeneration
                </span>
                {onRefreshTactics && (
                  <button
                    onClick={onRefreshTactics}
                    className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Regenerate
                  </button>
                )}
              </li>
            )}
          </ul>
        </div>

        {onDismiss && (
          <button
            onClick={handleDismiss}
            className="p-1 text-amber-400 hover:text-amber-300 transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Draft Pending Banner
// ============================================================================

interface DraftPendingBannerProps {
  draftCount: number;
  onReviewDrafts?: () => void;
  onDiscardAll?: () => void;
  className?: string;
}

export function DraftPendingBanner({
  draftCount,
  onReviewDrafts,
  onDiscardAll,
  className = '',
}: DraftPendingBannerProps) {
  if (draftCount === 0) {
    return null;
  }

  return (
    <div
      className={`
        bg-blue-500/10 border border-blue-500/30 rounded-lg p-4
        ${className}
      `}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
            <span className="text-sm font-medium text-blue-400">{draftCount}</span>
          </div>
          <div>
            <h3 className="text-sm font-medium text-blue-300">
              {draftCount === 1 ? '1 draft' : `${draftCount} drafts`} pending review
            </h3>
            <p className="text-xs text-blue-200/60">
              AI suggestions waiting for your approval
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onDiscardAll && (
            <button
              onClick={onDiscardAll}
              className="px-3 py-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              Discard All
            </button>
          )}
          {onReviewDrafts && (
            <button
              onClick={onReviewDrafts}
              className="px-3 py-1.5 text-xs bg-blue-500/20 text-blue-300 rounded hover:bg-blue-500/30 transition-colors"
            >
              Review Drafts
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Combined Status Banner
// ============================================================================

interface StrategyStatusBannerProps {
  staleness?: StalenessIndicators;
  draftCount?: number;
  onRefreshObjectives?: () => void;
  onRefreshStrategy?: () => void;
  onRefreshTactics?: () => void;
  onReviewDrafts?: () => void;
  onDiscardAllDrafts?: () => void;
  className?: string;
}

export function StrategyStatusBanner({
  staleness,
  draftCount = 0,
  onRefreshObjectives,
  onRefreshStrategy,
  onRefreshTactics,
  onReviewDrafts,
  onDiscardAllDrafts,
  className = '',
}: StrategyStatusBannerProps) {
  const hasStaleItems = staleness && (
    staleness.objectivesStale ||
    staleness.strategyStale ||
    staleness.tacticsStale
  );

  if (!hasStaleItems && draftCount === 0) {
    return null;
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {draftCount > 0 && (
        <DraftPendingBanner
          draftCount={draftCount}
          onReviewDrafts={onReviewDrafts}
          onDiscardAll={onDiscardAllDrafts}
        />
      )}
      {staleness && hasStaleItems && (
        <StalenessBanner
          staleness={staleness}
          onRefreshObjectives={onRefreshObjectives}
          onRefreshStrategy={onRefreshStrategy}
          onRefreshTactics={onRefreshTactics}
        />
      )}
    </div>
  );
}

export default StalenessBanner;
