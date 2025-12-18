'use client';

// components/os/overview/StrategyAwareActions.tsx
// Strategy-Aware Next Best Actions
//
// Actions that adapt based on strategy state:
// - No strategy → actions point to Strategy + Context
// - Strategy draft → actions refine strategy or inputs
// - Strategy locked → actions convert tactics → work
//
// Each action shows: Why it matters, What it supports, Estimated effort

import Link from 'next/link';
import {
  ArrowRight,
  Target,
  FileSearch,
  Briefcase,
  Pencil,
  Lightbulb,
  Zap,
  Clock,
  CheckCircle,
  AlertCircle,
  Layers,
} from 'lucide-react';
import type { StrategyState } from './BestPathForward';
import type { CompanyStrategy, StrategyPillar } from '@/lib/types/strategy';
import type { ActiveBusinessNeed } from './BusinessNeedSelector';

// ============================================================================
// Types
// ============================================================================

export interface StrategyAction {
  id: string;
  title: string;
  description: string;
  /** Why this action matters */
  rationale: string;
  /** What objective/priority this supports */
  supports?: string;
  /** Estimated effort level */
  effort: 'quick' | 'medium' | 'significant';
  href: string;
  icon: React.ReactNode;
  /** Priority order */
  priority: number;
}

export interface StrategyAwareActionsProps {
  companyId: string;
  strategyState: StrategyState;
  strategy: CompanyStrategy | null;
  activeNeed: ActiveBusinessNeed | null;
  /** Context completeness percentage */
  contextCompleteness?: number;
  /** Whether there are context gaps */
  hasContextGaps?: boolean;
  /** Max actions to show */
  maxActions?: number;
}

// ============================================================================
// Component
// ============================================================================

export function StrategyAwareActions({
  companyId,
  strategyState,
  strategy,
  activeNeed,
  contextCompleteness = 0,
  hasContextGaps = false,
  maxActions = 4,
}: StrategyAwareActionsProps) {
  const actions = deriveActions({
    companyId,
    strategyState,
    strategy,
    activeNeed,
    contextCompleteness,
    hasContextGaps,
  });

  const displayActions = actions.slice(0, maxActions);

  if (displayActions.length === 0) {
    return null;
  }

  return (
    <div className="bg-slate-900/30 border border-slate-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-800/50">
        <h3 className="text-sm font-medium text-white flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          Recommended Actions
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          {getHeaderSubtext(strategyState, activeNeed)}
        </p>
      </div>

      {/* Actions List */}
      <div className="divide-y divide-slate-800/50">
        {displayActions.map((action) => (
          <ActionCard key={action.id} action={action} />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Action Card Sub-component
// ============================================================================

function ActionCard({ action }: { action: StrategyAction }) {
  return (
    <Link
      href={action.href}
      className="block p-4 hover:bg-slate-800/30 transition-colors group"
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0 group-hover:bg-slate-700 transition-colors">
          {action.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-medium text-white group-hover:text-blue-300 transition-colors">
              {action.title}
            </h4>
            <EffortBadge effort={action.effort} />
          </div>
          <p className="text-xs text-slate-400 mb-2 line-clamp-2">
            {action.description}
          </p>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-slate-500 flex items-center gap-1">
              <Lightbulb className="w-3 h-3" />
              {action.rationale}
            </span>
            {action.supports && (
              <span className="text-blue-400/70 flex items-center gap-1">
                <Layers className="w-3 h-3" />
                {action.supports}
              </span>
            )}
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors flex-shrink-0 mt-2" />
      </div>
    </Link>
  );
}

function EffortBadge({ effort }: { effort: StrategyAction['effort'] }) {
  const config = {
    quick: {
      label: '5 min',
      className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    },
    medium: {
      label: '15 min',
      className: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    },
    significant: {
      label: '30+ min',
      className: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    },
  };

  const { label, className } = config[effort];

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded border ${className}`}>
      <Clock className="w-2.5 h-2.5" />
      {label}
    </span>
  );
}

// ============================================================================
// Action Derivation Logic
// ============================================================================

function deriveActions(props: {
  companyId: string;
  strategyState: StrategyState;
  strategy: CompanyStrategy | null;
  activeNeed: ActiveBusinessNeed | null;
  contextCompleteness: number;
  hasContextGaps: boolean;
}): StrategyAction[] {
  const {
    companyId,
    strategyState,
    strategy,
    activeNeed,
    contextCompleteness,
    hasContextGaps,
  } = props;

  const actions: StrategyAction[] = [];

  // -------------------------------------------------------------------------
  // No Strategy State
  // -------------------------------------------------------------------------
  if (strategyState === 'not_started') {
    // Always suggest completing context if incomplete
    if (contextCompleteness < 60 || hasContextGaps) {
      actions.push({
        id: 'complete-context',
        title: 'Complete Company Context',
        description: 'Add key information about your business, competitors, and market position.',
        rationale: 'Enables accurate strategy generation',
        effort: 'medium',
        href: `/c/${companyId}/context`,
        icon: <FileSearch className="w-4 h-4 text-blue-400" />,
        priority: 1,
      });
    }

    // Suggest running diagnostics
    actions.push({
      id: 'run-diagnostics',
      title: 'Run Marketing Diagnostics',
      description: 'Analyze your website, content, and marketing presence for opportunities.',
      rationale: 'Identifies strengths and gaps',
      effort: 'quick',
      href: `/c/${companyId}/diagnostics`,
      icon: <AlertCircle className="w-4 h-4 text-amber-400" />,
      priority: 2,
    });

    // Suggest starting strategy
    actions.push({
      id: 'start-strategy',
      title: 'Generate Marketing Strategy',
      description: 'Create an AI-powered strategy based on your context and goals.',
      rationale: 'Foundation for all marketing work',
      effort: 'medium',
      href: `/c/${companyId}/strategy`,
      icon: <Target className="w-4 h-4 text-purple-400" />,
      priority: 3,
    });

    return actions.sort((a, b) => a.priority - b.priority);
  }

  // -------------------------------------------------------------------------
  // Draft Strategy State
  // -------------------------------------------------------------------------
  if (strategyState === 'draft') {
    // If context gaps exist, prioritize fixing them
    if (hasContextGaps && contextCompleteness < 70) {
      actions.push({
        id: 'fix-context-gaps',
        title: 'Address Context Gaps',
        description: 'Fill in missing information to improve strategy accuracy.',
        rationale: 'Better context = better strategy',
        effort: 'medium',
        href: `/c/${companyId}/context`,
        icon: <AlertCircle className="w-4 h-4 text-amber-400" />,
        priority: 1,
      });
    }

    // Review and refine strategy
    actions.push({
      id: 'review-strategy',
      title: 'Review Strategy Draft',
      description: 'Refine objectives, priorities, and tactics before finalizing.',
      rationale: 'Ensure strategy aligns with goals',
      supports: activeNeed?.label,
      effort: 'medium',
      href: `/c/${companyId}/strategy`,
      icon: <Pencil className="w-4 h-4 text-blue-400" />,
      priority: 2,
    });

    // Finalize strategy
    actions.push({
      id: 'finalize-strategy',
      title: 'Finalize Strategy',
      description: 'Lock your strategy to enable work generation and tracking.',
      rationale: 'Unlocks tactical planning',
      effort: 'quick',
      href: `/c/${companyId}/strategy`,
      icon: <CheckCircle className="w-4 h-4 text-emerald-400" />,
      priority: 3,
    });

    // Run diagnostics if not done recently
    actions.push({
      id: 'refresh-diagnostics',
      title: 'Run Fresh Diagnostics',
      description: 'Get updated performance data to inform strategy refinements.',
      rationale: 'Current data for better decisions',
      effort: 'quick',
      href: `/c/${companyId}/diagnostics`,
      icon: <AlertCircle className="w-4 h-4 text-slate-400" />,
      priority: 4,
    });

    return actions.sort((a, b) => a.priority - b.priority);
  }

  // -------------------------------------------------------------------------
  // Locked Strategy State
  // -------------------------------------------------------------------------
  // Focus on converting strategy to work

  // Generate work from strategy
  actions.push({
    id: 'generate-work',
    title: 'Generate Work Items',
    description: 'Convert your strategy into actionable tasks and deliverables.',
    rationale: 'Turn strategy into action',
    supports: strategy?.pillars[0]?.title,
    effort: 'quick',
    href: `/c/${companyId}/work`,
    icon: <Briefcase className="w-4 h-4 text-blue-400" />,
    priority: 1,
  });

  // View/manage work queue
  actions.push({
    id: 'view-work',
    title: 'View Work Queue',
    description: 'Review and prioritize your current work items.',
    rationale: 'Stay on top of execution',
    effort: 'quick',
    href: `/c/${companyId}/work`,
    icon: <Layers className="w-4 h-4 text-slate-400" />,
    priority: 2,
  });

  // Check diagnostics for opportunities
  actions.push({
    id: 'check-diagnostics',
    title: 'Check for New Opportunities',
    description: 'Run diagnostics to identify new areas for improvement.',
    rationale: 'Continuous optimization',
    effort: 'quick',
    href: `/c/${companyId}/diagnostics`,
    icon: <AlertCircle className="w-4 h-4 text-amber-400" />,
    priority: 3,
  });

  // Review strategy (lower priority when locked)
  actions.push({
    id: 'review-locked-strategy',
    title: 'Review Strategy',
    description: 'Check your objectives and priorities are still aligned.',
    rationale: 'Ensure continued alignment',
    effort: 'quick',
    href: `/c/${companyId}/strategy`,
    icon: <Target className="w-4 h-4 text-slate-400" />,
    priority: 4,
  });

  return actions.sort((a, b) => a.priority - b.priority);
}

// ============================================================================
// Helper Functions
// ============================================================================

function getHeaderSubtext(
  strategyState: StrategyState,
  activeNeed: ActiveBusinessNeed | null
): string {
  if (activeNeed) {
    return `Actions aligned with your goal to ${activeNeed.label.toLowerCase()}`;
  }

  switch (strategyState) {
    case 'not_started':
      return 'Get started with your marketing foundation';
    case 'draft':
      return 'Refine and finalize your strategy';
    case 'locked':
      return 'Execute on your strategic priorities';
    default:
      return 'Suggested next steps';
  }
}
