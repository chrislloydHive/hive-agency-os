'use client';

// components/os/overview/BestPathForward.tsx
// AI Recommendation: Best Path Forward
//
// "Based on this goal, here's what we recommend."
//
// Shows a SINGLE primary recommendation with clear CTAs.
// This replaces scattered "Next Best Actions" lists.
// The recommendation cites: diagnostics, context gaps, strategy state.

import Link from 'next/link';
import {
  Sparkles,
  ArrowRight,
  Target,
  FileSearch,
  Briefcase,
  AlertCircle,
  CheckCircle,
  Lightbulb,
} from 'lucide-react';
import type { ActiveBusinessNeed } from './BusinessNeedSelector';
import type { CompanyStrategy } from '@/lib/types/strategy';

// ============================================================================
// Types
// ============================================================================

export type StrategyState = 'not_started' | 'draft' | 'locked';

export interface BestPathForwardProps {
  companyId: string;
  activeNeed: ActiveBusinessNeed | null;
  strategyState: StrategyState;
  /** Whether company has context gaps */
  hasContextGaps?: boolean;
  /** Context completeness percentage */
  contextCompleteness?: number;
  /** Whether company has recent diagnostics */
  hasDiagnostics?: boolean;
  /** Latest diagnostic score */
  latestScore?: number | null;
  /** Key insight from diagnostics */
  diagnosticInsight?: string | null;
}

export interface PathRecommendation {
  headline: string;
  explanation: string;
  primaryCta: {
    label: string;
    href: string;
    icon: React.ReactNode;
  };
  secondaryCtas?: Array<{
    label: string;
    href: string;
  }>;
  citations: string[];
}

// ============================================================================
// Component
// ============================================================================

export function BestPathForward({
  companyId,
  activeNeed,
  strategyState,
  hasContextGaps = false,
  contextCompleteness = 0,
  hasDiagnostics = false,
  latestScore,
  diagnosticInsight,
}: BestPathForwardProps) {
  const recommendation = deriveRecommendation({
    companyId,
    activeNeed,
    strategyState,
    hasContextGaps,
    contextCompleteness,
    hasDiagnostics,
    latestScore,
    diagnosticInsight,
  });

  return (
    <div className="bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-blue-500/20 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-blue-400" />
        <h3 className="text-sm font-medium text-blue-400">
          {activeNeed
            ? `Based on your goal to ${activeNeed.label.toLowerCase()}`
            : 'Recommended next step'
          }
        </h3>
      </div>

      {/* Main Recommendation */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white mb-2">
          {recommendation.headline}
        </h2>
        <p className="text-sm text-slate-300 leading-relaxed">
          {recommendation.explanation}
        </p>
      </div>

      {/* CTAs */}
      <div className="flex flex-wrap gap-3 mb-4">
        <Link
          href={recommendation.primaryCta.href}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-blue-500/20"
        >
          {recommendation.primaryCta.icon}
          {recommendation.primaryCta.label}
          <ArrowRight className="w-4 h-4" />
        </Link>

        {recommendation.secondaryCtas?.map((cta, idx) => (
          <Link
            key={idx}
            href={cta.href}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg transition-colors"
          >
            {cta.label}
          </Link>
        ))}
      </div>

      {/* Citations */}
      {recommendation.citations.length > 0 && (
        <div className="pt-4 border-t border-slate-700/50">
          <p className="text-xs text-slate-500">
            <span className="text-slate-400">Based on:</span>{' '}
            {recommendation.citations.join(' · ')}
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Recommendation Engine
// ============================================================================

function deriveRecommendation(props: {
  companyId: string;
  activeNeed: ActiveBusinessNeed | null;
  strategyState: StrategyState;
  hasContextGaps: boolean;
  contextCompleteness: number;
  hasDiagnostics: boolean;
  latestScore: number | null | undefined;
  diagnosticInsight: string | null | undefined;
}): PathRecommendation {
  const {
    companyId,
    activeNeed,
    strategyState,
    hasContextGaps,
    contextCompleteness,
    hasDiagnostics,
    latestScore,
    diagnosticInsight,
  } = props;

  const citations: string[] = [];

  // Build citations based on what informed the recommendation
  if (strategyState !== 'not_started') {
    citations.push(`Strategy: ${strategyState}`);
  }
  if (hasDiagnostics && latestScore !== null && latestScore !== undefined) {
    citations.push(`Diagnostic score: ${latestScore}%`);
  }
  if (contextCompleteness > 0) {
    citations.push(`Context: ${contextCompleteness}% complete`);
  }

  // Priority 1: No strategy exists - this is the most important blocker
  if (strategyState === 'not_started') {
    // Check if context is too incomplete for strategy
    if (contextCompleteness < 40 || hasContextGaps) {
      return {
        headline: 'Build your company context first',
        explanation: `Before creating a strategy${activeNeed ? ` for ${activeNeed.label.toLowerCase()}` : ''}, we need to understand your company better. Complete your context to enable accurate strategy generation.`,
        primaryCta: {
          label: 'Complete Context',
          href: `/c/${companyId}/context`,
          icon: <FileSearch className="w-4 h-4" />,
        },
        secondaryCtas: [
          { label: 'Run Diagnostics', href: `/c/${companyId}/diagnostics` },
        ],
        citations: [...citations, 'Context gaps detected'],
      };
    }

    return {
      headline: 'Define your marketing strategy',
      explanation: activeNeed
        ? `To achieve "${activeNeed.label}", you need a clear strategy first. This will define your objectives, priorities, and the tactics that will drive results.`
        : 'A clear strategy is the foundation for all marketing work. Define your objectives and priorities to guide your efforts.',
      primaryCta: {
        label: 'Generate Strategy',
        href: `/c/${companyId}/strategy`,
        icon: <Target className="w-4 h-4" />,
      },
      secondaryCtas: hasDiagnostics
        ? [{ label: 'Review Diagnostics', href: `/c/${companyId}/diagnostics` }]
        : [{ label: 'Run Diagnostics First', href: `/c/${companyId}/diagnostics` }],
      citations,
    };
  }

  // Priority 2: Strategy is draft - needs refinement or lock
  if (strategyState === 'draft') {
    // If there are context gaps, fix those first
    if (hasContextGaps && contextCompleteness < 60) {
      return {
        headline: 'Strengthen context to refine strategy',
        explanation: 'Your strategy draft would benefit from more complete company context. Fill in the gaps to ensure your strategy is grounded in accurate information.',
        primaryCta: {
          label: 'Review Context Gaps',
          href: `/c/${companyId}/context`,
          icon: <AlertCircle className="w-4 h-4" />,
        },
        secondaryCtas: [
          { label: 'View Strategy Draft', href: `/c/${companyId}/strategy` },
        ],
        citations: [...citations, 'Context gaps may affect strategy accuracy'],
      };
    }

    return {
      headline: 'Finalize your strategy',
      explanation: activeNeed
        ? `Your strategy draft is ready for review. Finalize it to start generating tactical work for "${activeNeed.label}".`
        : 'Your strategy draft is ready for review. Finalize it to unlock tactical planning and work generation.',
      primaryCta: {
        label: 'Review & Finalize',
        href: `/c/${companyId}/strategy`,
        icon: <CheckCircle className="w-4 h-4" />,
      },
      secondaryCtas: [
        { label: 'Review Context', href: `/c/${companyId}/context` },
      ],
      citations,
    };
  }

  // Priority 3: Strategy is locked - focus on execution
  // Low diagnostic score - address issues first
  if (latestScore !== null && latestScore !== undefined && latestScore < 50) {
    return {
      headline: 'Address critical performance gaps',
      explanation: diagnosticInsight
        ? diagnosticInsight
        : `Your diagnostic score of ${latestScore}% indicates significant issues that should be addressed before scaling efforts.`,
      primaryCta: {
        label: 'View Diagnostics',
        href: `/c/${companyId}/diagnostics`,
        icon: <AlertCircle className="w-4 h-4" />,
      },
      secondaryCtas: [
        { label: 'Go to Work', href: `/c/${companyId}/work` },
      ],
      citations,
    };
  }

  // Strategy locked, ready to work
  return {
    headline: activeNeed
      ? `Start working on ${activeNeed.label.toLowerCase()}`
      : 'Convert strategy to actionable work',
    explanation: activeNeed
      ? `Your strategy is set. Generate tactical work items aligned with your goal to ${activeNeed.label.toLowerCase()}.`
      : 'Your strategy is locked. Convert your strategic priorities into actionable work items to start making progress.',
    primaryCta: {
      label: 'Jump to Work',
      href: `/c/${companyId}/work`,
      icon: <Briefcase className="w-4 h-4" />,
    },
    secondaryCtas: [
      { label: 'View Strategy', href: `/c/${companyId}/strategy` },
    ],
    citations,
  };
}

// ============================================================================
// Helper: Derive Strategy State
// ============================================================================

export function deriveStrategyState(strategy: CompanyStrategy | null): StrategyState {
  if (!strategy || !strategy.id) {
    return 'not_started';
  }
  if (strategy.status === 'finalized') {
    return 'locked';
  }
  return 'draft';
}
