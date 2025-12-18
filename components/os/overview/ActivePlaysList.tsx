'use client';

// components/os/overview/ActivePlaysList.tsx
// Active Strategic Plays - Tactics layer connecting strategy to work
//
// Shows active plays filtered by business need relevance.
// This is where strategy becomes real.

import Link from 'next/link';
import {
  Play,
  Pause,
  CheckCircle,
  Circle,
  ArrowRight,
  Sparkles,
  Target,
  Briefcase,
  Plus,
} from 'lucide-react';
import type { StrategyPlay, StrategyPlayStatus, CompanyStrategy } from '@/lib/types/strategy';
import type { ActiveBusinessNeed } from './BusinessNeedSelector';

// ============================================================================
// Types
// ============================================================================

export interface ActivePlaysListProps {
  companyId: string;
  strategy: CompanyStrategy | null;
  plays: StrategyPlay[];
  /** Active business need for filtering/highlighting */
  activeNeed?: ActiveBusinessNeed | null;
  /** Work counts per play ID */
  workCounts?: Record<string, number>;
  /** Maximum plays to show */
  maxPlays?: number;
}

// ============================================================================
// Business Need to Play Relevance Mapping
// ============================================================================

const NEED_TO_PILLAR_KEYWORDS: Record<string, string[]> = {
  increase_leads: ['lead', 'acquisition', 'traffic', 'awareness', 'demand', 'reach'],
  improve_conversion: ['conversion', 'optimize', 'landing', 'cro', 'funnel', 'sales'],
  launch_offering: ['launch', 'product', 'offering', 'positioning', 'brand', 'market'],
  fix_seo: ['seo', 'search', 'organic', 'content', 'visibility', 'ranking'],
  prepare_growth: ['scale', 'growth', 'expand', 'capacity', 'efficiency', 'automation'],
  diagnose_issues: ['audit', 'diagnose', 'analyze', 'review', 'assess', 'fix'],
};

function isPlayRelevant(play: StrategyPlay, need: ActiveBusinessNeed | null): boolean {
  if (!need) return true; // All plays relevant if no need selected

  const keywords = NEED_TO_PILLAR_KEYWORDS[need.key] || [];
  if (keywords.length === 0) return true; // Custom needs match all

  const searchText = [
    play.title,
    play.description,
    play.pillarTitle,
  ].filter(Boolean).join(' ').toLowerCase();

  return keywords.some(keyword => searchText.includes(keyword));
}

// ============================================================================
// Component
// ============================================================================

export function ActivePlaysList({
  companyId,
  strategy,
  plays,
  activeNeed,
  workCounts = {},
  maxPlays = 5,
}: ActivePlaysListProps) {
  // Filter and sort plays
  const activePlays = plays.filter(p => p.status === 'active' || p.status === 'proposed');
  const relevantPlays = activeNeed
    ? activePlays.filter(p => isPlayRelevant(p, activeNeed))
    : activePlays;
  const displayPlays = relevantPlays.slice(0, maxPlays);

  // No plays exist
  if (plays.length === 0) {
    return (
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <Briefcase className="w-6 h-6 text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white mb-1">
              No Plays Yet
            </h3>
            <p className="text-sm text-slate-400 mb-4 max-w-md">
              {strategy
                ? 'Create tactical plays from your strategy to start generating work.'
                : 'Create a strategy first, then generate plays to execute it.'}
            </p>
            {strategy ? (
              <Link
                href={`/c/${companyId}/strategy#plays`}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                Generate Plays from Strategy
              </Link>
            ) : (
              <Link
                href={`/c/${companyId}/strategy`}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Target className="w-4 h-4" />
                Create Strategy First
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  // No relevant plays for current need
  if (displayPlays.length === 0 && activeNeed) {
    return (
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <Briefcase className="w-6 h-6 text-amber-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white mb-1">
              No Plays for "{activeNeed.label}"
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              You have {activePlays.length} active plays, but none directly address this need.
            </p>
            <div className="flex gap-3">
              <Link
                href={`/c/${companyId}/strategy#plays`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add a Play
              </Link>
              <Link
                href={`/c/${companyId}/strategy#plays`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg transition-colors"
              >
                View All Plays
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show plays list
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <Briefcase className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">
              Active Plays
              {activeNeed && (
                <span className="text-slate-400 font-normal ml-2">
                  for {activeNeed.label}
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500">
              {displayPlays.length} of {activePlays.length} plays shown
            </p>
          </div>
        </div>
        <Link
          href={`/c/${companyId}/strategy#plays`}
          className="text-xs text-slate-400 hover:text-white transition-colors"
        >
          View all
        </Link>
      </div>

      {/* Plays List */}
      <div className="divide-y divide-slate-800/50">
        {displayPlays.map((play) => (
          <PlayCard
            key={play.id}
            play={play}
            companyId={companyId}
            workCount={workCounts[play.id] || 0}
            isRelevant={isPlayRelevant(play, activeNeed ?? null)}
          />
        ))}
      </div>

      {/* Footer */}
      {relevantPlays.length > maxPlays && (
        <div className="p-3 bg-slate-800/30 border-t border-slate-800">
          <Link
            href={`/c/${companyId}/strategy#plays`}
            className="text-xs text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-1"
          >
            View {relevantPlays.length - maxPlays} more plays
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Play Card Sub-component
// ============================================================================

interface PlayCardProps {
  play: StrategyPlay;
  companyId: string;
  workCount: number;
  isRelevant: boolean;
}

function PlayCard({ play, companyId, workCount, isRelevant }: PlayCardProps) {
  const statusConfig = getStatusConfig(play.status);

  return (
    <div className={`p-4 hover:bg-slate-800/30 transition-colors ${isRelevant ? '' : 'opacity-60'}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${statusConfig.className}`}>
              {statusConfig.icon}
              {statusConfig.label}
            </span>
            {play.pillarTitle && (
              <span className="text-xs text-slate-500 truncate">
                {play.pillarTitle}
              </span>
            )}
          </div>
          <h4 className="text-sm font-medium text-white mb-1 truncate">
            {play.title}
          </h4>
          {play.description && (
            <p className="text-xs text-slate-400 line-clamp-1">
              {play.description}
            </p>
          )}
          {play.successMetric && (
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <Target className="w-3 h-3" />
              {play.successMetric}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {workCount > 0 && (
            <span className="text-xs text-slate-400">
              {workCount} work items
            </span>
          )}
          <Link
            href={`/c/${companyId}/work?playId=${play.id}`}
            className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
          >
            {workCount > 0 ? 'View Work' : 'Generate Work'}
          </Link>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function getStatusConfig(status: StrategyPlayStatus): {
  label: string;
  className: string;
  icon: React.ReactNode;
} {
  switch (status) {
    case 'active':
      return {
        label: 'Active',
        className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        icon: <Play className="w-3 h-3" />,
      };
    case 'proposed':
      return {
        label: 'Proposed',
        className: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
        icon: <Circle className="w-3 h-3" />,
      };
    case 'paused':
      return {
        label: 'Paused',
        className: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
        icon: <Pause className="w-3 h-3" />,
      };
    case 'proven':
      return {
        label: 'Proven',
        className: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
        icon: <CheckCircle className="w-3 h-3" />,
      };
  }
}
