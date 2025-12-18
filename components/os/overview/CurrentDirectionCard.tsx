'use client';

// components/os/overview/CurrentDirectionCard.tsx
// Current Direction Snapshot (Strategy-Aware)
//
// Compact snapshot showing:
// - Strategy status: Not started / Draft / Locked
// - Top objective
// - Top 1-2 strategic priorities
// - Strategy completeness %
//
// This mirrors the Strategy page, not duplicates it.

import Link from 'next/link';
import {
  Target,
  CheckCircle,
  Circle,
  Lock,
  Sparkles,
  ArrowRight,
  Layers,
} from 'lucide-react';
import type { CompanyStrategy, StrategyPillar } from '@/lib/types/strategy';
import { getObjectiveText } from '@/lib/types/strategy';
import type { StrategyState } from './BestPathForward';

// ============================================================================
// Types
// ============================================================================

export interface CurrentDirectionCardProps {
  companyId: string;
  strategy: CompanyStrategy | null;
  strategyState: StrategyState;
  /** Strategy completeness percentage (based on required fields) */
  strategyCompleteness?: number;
}

// ============================================================================
// Component
// ============================================================================

export function CurrentDirectionCard({
  companyId,
  strategy,
  strategyState,
  strategyCompleteness = 0,
}: CurrentDirectionCardProps) {
  const statusConfig = getStatusConfig(strategyState);

  // No strategy - show CTA
  if (strategyState === 'not_started' || !strategy) {
    return (
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
              <Target className="w-5 h-5 text-slate-500" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-white">
                No Strategy Yet
              </h3>
              <p className="text-xs text-slate-500">
                Define your marketing direction
              </p>
            </div>
          </div>
          <Link
            href={`/c/${companyId}/strategy`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Generate Strategy
          </Link>
        </div>
      </div>
    );
  }

  // Extract top data
  const topObjective = strategy.objectives[0];
  const topPillars = strategy.pillars.slice(0, 2);

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
      {/* Header Row */}
      <div className="p-4 border-b border-slate-800/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${statusConfig.iconBg}`}>
            {statusConfig.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-white">
                {strategy.title || 'Marketing Strategy'}
              </h3>
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusConfig.badgeClass}`}>
                {statusConfig.label}
              </span>
            </div>
            {strategyCompleteness > 0 && (
              <div className="flex items-center gap-2 mt-1">
                <div className="w-20 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${strategyCompleteness >= 80 ? 'bg-emerald-500' : strategyCompleteness >= 50 ? 'bg-amber-500' : 'bg-slate-500'}`}
                    style={{ width: `${strategyCompleteness}%` }}
                  />
                </div>
                <span className="text-xs text-slate-500">{strategyCompleteness}%</span>
              </div>
            )}
          </div>
        </div>
        <Link
          href={`/c/${companyId}/strategy`}
          className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1"
        >
          {strategyState === 'draft' ? 'Edit' : 'View'} Strategy
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="grid md:grid-cols-2 gap-4">
          {/* Top Objective */}
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Top Objective
            </p>
            {topObjective ? (
              <p className="text-sm text-slate-300">
                {getObjectiveText(topObjective)}
              </p>
            ) : (
              <p className="text-sm text-slate-500 italic">No objectives defined</p>
            )}
          </div>

          {/* Top Priorities */}
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
              <Layers className="w-3 h-3" />
              Top Priorities
            </p>
            {topPillars.length > 0 ? (
              <ul className="space-y-1">
                {topPillars.map((pillar) => (
                  <li key={pillar.id} className="text-sm text-slate-300 flex items-center gap-2">
                    <span className={getPriorityColor(pillar.priority)}>
                      {getPriorityIcon(pillar.priority)}
                    </span>
                    {pillar.title}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500 italic">No priorities defined</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function getStatusConfig(state: StrategyState): {
  label: string;
  badgeClass: string;
  icon: React.ReactNode;
  iconBg: string;
} {
  switch (state) {
    case 'locked':
      return {
        label: 'Locked',
        badgeClass: 'bg-emerald-500/20 text-emerald-400',
        icon: <Lock className="w-5 h-5 text-emerald-400" />,
        iconBg: 'bg-emerald-500/20',
      };
    case 'draft':
      return {
        label: 'Draft',
        badgeClass: 'bg-amber-500/20 text-amber-400',
        icon: <Target className="w-5 h-5 text-amber-400" />,
        iconBg: 'bg-amber-500/20',
      };
    case 'not_started':
    default:
      return {
        label: 'Not Started',
        badgeClass: 'bg-slate-500/20 text-slate-400',
        icon: <Circle className="w-5 h-5 text-slate-400" />,
        iconBg: 'bg-slate-700',
      };
  }
}

function getPriorityIcon(priority?: StrategyPillar['priority']): string {
  switch (priority) {
    case 'high':
      return '▲';
    case 'low':
      return '▽';
    default:
      return '•';
  }
}

function getPriorityColor(priority?: StrategyPillar['priority']): string {
  switch (priority) {
    case 'high':
      return 'text-emerald-400';
    case 'low':
      return 'text-slate-500';
    default:
      return 'text-blue-400';
  }
}
