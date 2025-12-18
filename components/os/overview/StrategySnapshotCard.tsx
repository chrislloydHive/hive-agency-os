'use client';

// components/os/overview/StrategySnapshotCard.tsx
// Strategy Snapshot Card - Read-only summary of company strategy
//
// This summarizes strategy — it does NOT edit it.
// Links to /strategy for full editing.

import Link from 'next/link';
import {
  Target,
  CheckCircle,
  AlertCircle,
  Sparkles,
  ArrowRight,
  FileText,
  Layers,
} from 'lucide-react';
import type { CompanyStrategy, StrategyPillar } from '@/lib/types/strategy';
import { getObjectiveText } from '@/lib/types/strategy';

// ============================================================================
// Types
// ============================================================================

export interface StrategySnapshotCardProps {
  companyId: string;
  strategy: CompanyStrategy | null;
  /** Optional: Highlight pillars relevant to business need */
  relevantPillarIds?: string[];
}

// ============================================================================
// Component
// ============================================================================

export function StrategySnapshotCard({
  companyId,
  strategy,
  relevantPillarIds = [],
}: StrategySnapshotCardProps) {
  // No strategy exists
  if (!strategy) {
    return (
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Target className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-1">
                No Strategy Yet
              </h3>
              <p className="text-sm text-slate-400 max-w-md">
                Create a strategy to align your marketing efforts and generate tactical plays.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <Link
            href={`/c/${companyId}/strategy`}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Generate Strategy with AI
          </Link>
          <Link
            href={`/c/${companyId}/strategy?view=manual`}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg transition-colors"
          >
            <FileText className="w-4 h-4" />
            Create Manually
          </Link>
        </div>
      </div>
    );
  }

  // Strategy exists - show snapshot
  const statusBadge = getStatusBadge(strategy.status);
  const topPillars = strategy.pillars.slice(0, 3);
  const topObjectives = strategy.objectives.slice(0, 3);

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-slate-800">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <Target className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-semibold text-white">
                  {strategy.title || 'Marketing Strategy'}
                </h3>
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusBadge.className}`}>
                  {statusBadge.label}
                </span>
              </div>
              {strategy.summary && (
                <p className="text-sm text-slate-400 line-clamp-2 max-w-lg">
                  {strategy.summary}
                </p>
              )}
            </div>
          </div>

          <Link
            href={`/c/${companyId}/strategy`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            View Strategy
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Objectives */}
          <div>
            <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
              <CheckCircle className="w-3.5 h-3.5" />
              Objectives
            </h4>
            {topObjectives.length > 0 ? (
              <ul className="space-y-2">
                {topObjectives.map((objective, idx) => (
                  <li
                    key={idx}
                    className="text-sm text-slate-300 flex items-start gap-2"
                  >
                    <span className="text-emerald-400 mt-0.5">•</span>
                    {getObjectiveText(objective)}
                  </li>
                ))}
                {strategy.objectives.length > 3 && (
                  <li className="text-xs text-slate-500">
                    +{strategy.objectives.length - 3} more
                  </li>
                )}
              </ul>
            ) : (
              <p className="text-sm text-slate-500 italic">No objectives defined</p>
            )}
          </div>

          {/* Pillars */}
          <div>
            <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
              <Layers className="w-3.5 h-3.5" />
              Strategic Pillars
            </h4>
            {topPillars.length > 0 ? (
              <ul className="space-y-2">
                {topPillars.map((pillar) => {
                  const isRelevant = relevantPillarIds.includes(pillar.id);
                  return (
                    <li
                      key={pillar.id}
                      className={`
                        text-sm flex items-start gap-2
                        ${isRelevant ? 'text-blue-300' : 'text-slate-300'}
                      `}
                    >
                      <span className={isRelevant ? 'text-blue-400' : 'text-purple-400'}>
                        {getPillarPriorityIcon(pillar.priority)}
                      </span>
                      <span>
                        {pillar.title}
                        {isRelevant && (
                          <span className="ml-2 text-xs text-blue-400">(relevant)</span>
                        )}
                      </span>
                    </li>
                  );
                })}
                {strategy.pillars.length > 3 && (
                  <li className="text-xs text-slate-500">
                    +{strategy.pillars.length - 3} more pillars
                  </li>
                )}
              </ul>
            ) : (
              <p className="text-sm text-slate-500 italic">No pillars defined</p>
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

function getStatusBadge(status: CompanyStrategy['status']): { label: string; className: string } {
  switch (status) {
    case 'finalized':
      return {
        label: 'Finalized',
        className: 'bg-emerald-500/20 text-emerald-400',
      };
    case 'draft':
      return {
        label: 'Draft',
        className: 'bg-amber-500/20 text-amber-400',
      };
    case 'archived':
      return {
        label: 'Archived',
        className: 'bg-slate-500/20 text-slate-400',
      };
    default:
      return {
        label: 'Draft',
        className: 'bg-slate-500/20 text-slate-400',
      };
  }
}

function getPillarPriorityIcon(priority?: StrategyPillar['priority']): string {
  switch (priority) {
    case 'high':
      return '▲';
    case 'low':
      return '▽';
    default:
      return '•';
  }
}
