'use client';

// components/strategy-orchestration/StalenessBanner.tsx
// Staleness Banner - Shows when data is stale and needs refresh
//
// KEY PRINCIPLE: Explicit staleness detection with actionable refresh

import { AlertTriangle, RefreshCw, Info } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface StalenessBannerProps {
  type: 'strategy' | 'tactics' | 'context';
  message: string;
  reason?: string;
  onRefresh: () => void;
  isRefreshing?: boolean;
  variant?: 'warning' | 'info';
}

// ============================================================================
// Component
// ============================================================================

export function StalenessBanner({
  type,
  message,
  reason,
  onRefresh,
  isRefreshing = false,
  variant = 'warning',
}: StalenessBannerProps) {
  const colors = {
    warning: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      icon: 'text-amber-600',
      text: 'text-amber-800',
      button: 'bg-amber-600 hover:bg-amber-700',
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      icon: 'text-blue-600',
      text: 'text-blue-800',
      button: 'bg-blue-600 hover:bg-blue-700',
    },
  };

  const c = colors[variant];
  const Icon = variant === 'warning' ? AlertTriangle : Info;

  const labels = {
    strategy: 'Strategy may be outdated',
    tactics: 'Tactics may be outdated',
    context: 'Context has changed',
  };

  return (
    <div className={`${c.bg} ${c.border} border rounded-lg p-3`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 ${c.icon} flex-shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${c.text}`}>
            {labels[type]}
          </p>
          <p className={`text-sm ${c.text} opacity-80 mt-0.5`}>
            {message}
          </p>
          {reason && (
            <p className="text-xs text-gray-500 mt-1">
              {reason}
            </p>
          )}
        </div>
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className={`${c.button} text-white px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 disabled:opacity-50 flex-shrink-0`}
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Multi-Banner Container
// ============================================================================

interface StalenessIndicators {
  strategyStale: boolean;
  strategyStaleReason: string | null;
  tacticsStale: boolean;
  tacticsStaleReason: string | null;
  contextChanged: boolean;
  contextChangedReason: string | null;
}

interface StalenessBannersProps {
  staleness: StalenessIndicators;
  onRefreshStrategy: () => void;
  onRefreshTactics: () => void;
  onRefreshContext: () => void;
  isRefreshing?: {
    strategy?: boolean;
    tactics?: boolean;
    context?: boolean;
  };
}

export function StalenessBanners({
  staleness,
  onRefreshStrategy,
  onRefreshTactics,
  onRefreshContext,
  isRefreshing = {},
}: StalenessBannersProps) {
  const hasStaleness = staleness.strategyStale || staleness.tacticsStale || staleness.contextChanged;

  if (!hasStaleness) return null;

  return (
    <div className="space-y-2">
      {staleness.contextChanged && (
        <StalenessBanner
          type="context"
          message="Context has been updated since your strategy was generated."
          reason={staleness.contextChangedReason || undefined}
          onRefresh={onRefreshContext}
          isRefreshing={isRefreshing.context}
          variant="info"
        />
      )}
      {staleness.strategyStale && (
        <StalenessBanner
          type="strategy"
          message="Your strategy may not reflect the latest context changes."
          reason={staleness.strategyStaleReason || undefined}
          onRefresh={onRefreshStrategy}
          isRefreshing={isRefreshing.strategy}
        />
      )}
      {staleness.tacticsStale && (
        <StalenessBanner
          type="tactics"
          message="Your tactics were generated from an older version of the strategy."
          reason={staleness.tacticsStaleReason || undefined}
          onRefresh={onRefreshTactics}
          isRefreshing={isRefreshing.tactics}
        />
      )}
    </div>
  );
}
