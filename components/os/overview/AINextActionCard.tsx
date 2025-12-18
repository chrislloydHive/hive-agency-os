'use client';

// components/os/overview/AINextActionCard.tsx
// AI Recommended Next Action Card
//
// ONE clear AI recommendation derived from:
// 1. Business need (primary driver)
// 2. Strategy alignment (pillars/objectives)
// 3. Diagnostics (supporting signal, not leading)
//
// This replaces scattered "Next Best Actions" lists with a singular, strong CTA.

import Link from 'next/link';
import {
  Sparkles,
  ArrowRight,
  Play,
  FileSearch,
  Lightbulb,
  Target,
  TrendingUp,
  Search,
  Rocket,
  Scale,
  Stethoscope,
} from 'lucide-react';
import type { ActiveBusinessNeed } from './BusinessNeedSelector';
import type { CompanyStrategy, StrategyPlay } from '@/lib/types/strategy';

// ============================================================================
// Types
// ============================================================================

export interface AINextActionCardProps {
  companyId: string;
  activeNeed: ActiveBusinessNeed | null;
  strategy: CompanyStrategy | null;
  plays: StrategyPlay[];
  /** Whether company has recent diagnostics */
  hasDiagnostics: boolean;
  /** Optional: Latest diagnostic score */
  latestDiagnosticScore?: number | null;
  /** Optional: Context completeness for strategy generation */
  contextCompleteness?: number;
}

export interface RecommendedAction {
  title: string;
  reason: string;
  cta: {
    label: string;
    href: string;
  };
  icon: React.ReactNode;
  priority: 'high' | 'medium' | 'low';
}

// ============================================================================
// Action Recommendation Engine
// ============================================================================

function deriveRecommendedAction(props: AINextActionCardProps): RecommendedAction {
  const {
    companyId,
    activeNeed,
    strategy,
    plays,
    hasDiagnostics,
    latestDiagnosticScore,
    contextCompleteness = 0,
  } = props;

  const activePlays = plays.filter(p => p.status === 'active' || p.status === 'proposed');
  const needLabel = activeNeed?.label || 'your business goals';

  // Priority 1: No strategy exists - create one
  if (!strategy) {
    return {
      title: 'Generate your marketing strategy',
      reason: `Before tackling ${needLabel}, you need a strategy to guide your efforts and prioritize the right plays.`,
      cta: {
        label: 'Generate Strategy',
        href: `/c/${companyId}/strategy`,
      },
      icon: <Target className="w-5 h-5" />,
      priority: 'high',
    };
  }

  // Priority 2: Strategy exists but no plays - generate plays
  if (activePlays.length === 0) {
    return {
      title: 'Generate tactical plays from strategy',
      reason: `Your strategy is set. Now generate plays to execute it and start working toward ${needLabel}.`,
      cta: {
        label: 'Generate Plays',
        href: `/c/${companyId}/strategy#plays`,
      },
      icon: <Lightbulb className="w-5 h-5" />,
      priority: 'high',
    };
  }

  // Priority 3: Business need selected - find relevant play
  if (activeNeed) {
    const relevantPlay = findRelevantPlay(activePlays, activeNeed);

    if (relevantPlay) {
      return {
        title: `Continue: ${relevantPlay.title}`,
        reason: `This play directly addresses ${needLabel} and is already in progress.`,
        cta: {
          label: 'View Work',
          href: `/c/${companyId}/work?playId=${relevantPlay.id}`,
        },
        icon: <Play className="w-5 h-5" />,
        priority: 'high',
      };
    }

    // No relevant play - suggest creating one
    return {
      title: `Create a play for ${needLabel}`,
      reason: `You have active plays, but none directly address ${needLabel}. Add a targeted play.`,
      cta: {
        label: 'Add Play',
        href: `/c/${companyId}/strategy#plays`,
      },
      icon: getNeedIcon(activeNeed.key),
      priority: 'medium',
    };
  }

  // Priority 4: No diagnostics yet - suggest running one
  if (!hasDiagnostics) {
    return {
      title: 'Run your first diagnostic',
      reason: 'Get a baseline understanding of your marketing performance to inform strategy execution.',
      cta: {
        label: 'Run Diagnostic',
        href: `/c/${companyId}/diagnostics`,
      },
      icon: <FileSearch className="w-5 h-5" />,
      priority: 'medium',
    };
  }

  // Priority 5: Low diagnostic score - address issues
  if (latestDiagnosticScore !== null && latestDiagnosticScore !== undefined && latestDiagnosticScore < 60) {
    return {
      title: 'Address diagnostic findings',
      reason: `Your latest diagnostic scored ${latestDiagnosticScore}%. Review and address the findings to improve performance.`,
      cta: {
        label: 'View Findings',
        href: `/c/${companyId}/diagnostics`,
      },
      icon: <Stethoscope className="w-5 h-5" />,
      priority: 'medium',
    };
  }

  // Priority 6: Context incomplete - improve it
  if (contextCompleteness < 70) {
    return {
      title: 'Strengthen your company context',
      reason: 'Better context enables more accurate AI recommendations and strategy generation.',
      cta: {
        label: 'Improve Context',
        href: `/c/${companyId}/context`,
      },
      icon: <TrendingUp className="w-5 h-5" />,
      priority: 'low',
    };
  }

  // Default: Work on first active play
  const firstPlay = activePlays[0];
  if (firstPlay) {
    return {
      title: `Continue: ${firstPlay.title}`,
      reason: 'Pick up where you left off on your most recent play.',
      cta: {
        label: 'View Work',
        href: `/c/${companyId}/work?playId=${firstPlay.id}`,
      },
      icon: <Play className="w-5 h-5" />,
      priority: 'low',
    };
  }

  // Fallback: Select a business need
  return {
    title: 'Select what you want to work on',
    reason: 'Choose a business need above to get personalized recommendations.',
    cta: {
      label: 'Get Started',
      href: '#business-need',
    },
    icon: <Sparkles className="w-5 h-5" />,
    priority: 'low',
  };
}

// ============================================================================
// Component
// ============================================================================

export function AINextActionCard(props: AINextActionCardProps) {
  const { activeNeed } = props;
  const action = deriveRecommendedAction(props);

  return (
    <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 border border-blue-500/30 rounded-xl p-6">
      {/* AI Badge */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-blue-400" />
        </div>
        <div>
          <p className="text-xs text-blue-400 font-medium">AI Recommendation</p>
          {activeNeed && (
            <p className="text-xs text-slate-400">
              Based on your goal to {activeNeed.label.toLowerCase()}
            </p>
          )}
        </div>
      </div>

      {/* Recommendation */}
      <div className="flex items-start gap-4">
        <div className={`
          w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0
          ${action.priority === 'high'
            ? 'bg-emerald-500/20 text-emerald-400'
            : action.priority === 'medium'
              ? 'bg-amber-500/20 text-amber-400'
              : 'bg-slate-500/20 text-slate-400'
          }
        `}>
          {action.icon}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-white mb-1">
            {action.title}
          </h3>
          <p className="text-sm text-slate-400 mb-4">
            {action.reason}
          </p>

          <Link
            href={action.cta.href}
            className={`
              inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg transition-all
              ${action.priority === 'high'
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                : action.priority === 'medium'
                  ? 'bg-blue-600 hover:bg-blue-500 text-white'
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
              }
            `}
          >
            {action.cta.label}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Priority indicator (subtle) */}
      {action.priority === 'high' && (
        <div className="mt-4 pt-4 border-t border-slate-700/50">
          <p className="text-xs text-emerald-400/80 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            High priority — this will unblock your progress
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

const NEED_TO_PILLAR_KEYWORDS: Record<string, string[]> = {
  increase_leads: ['lead', 'acquisition', 'traffic', 'awareness', 'demand', 'reach'],
  improve_conversion: ['conversion', 'optimize', 'landing', 'cro', 'funnel', 'sales'],
  launch_offering: ['launch', 'product', 'offering', 'positioning', 'brand', 'market'],
  fix_seo: ['seo', 'search', 'organic', 'content', 'visibility', 'ranking'],
  prepare_growth: ['scale', 'growth', 'expand', 'capacity', 'efficiency', 'automation'],
  diagnose_issues: ['audit', 'diagnose', 'analyze', 'review', 'assess', 'fix'],
};

function findRelevantPlay(
  plays: StrategyPlay[],
  need: ActiveBusinessNeed
): StrategyPlay | null {
  const keywords = NEED_TO_PILLAR_KEYWORDS[need.key] || [];
  if (keywords.length === 0) return plays[0] || null;

  return plays.find(play => {
    const searchText = [
      play.title,
      play.description,
      play.pillarTitle,
    ].filter(Boolean).join(' ').toLowerCase();

    return keywords.some(keyword => searchText.includes(keyword));
  }) || null;
}

function getNeedIcon(needKey: string): React.ReactNode {
  switch (needKey) {
    case 'increase_leads':
      return <TrendingUp className="w-5 h-5" />;
    case 'improve_conversion':
      return <Target className="w-5 h-5" />;
    case 'launch_offering':
      return <Rocket className="w-5 h-5" />;
    case 'fix_seo':
      return <Search className="w-5 h-5" />;
    case 'prepare_growth':
      return <Scale className="w-5 h-5" />;
    case 'diagnose_issues':
      return <Stethoscope className="w-5 h-5" />;
    default:
      return <Lightbulb className="w-5 h-5" />;
  }
}
