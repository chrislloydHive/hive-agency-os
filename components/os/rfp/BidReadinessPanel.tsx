// components/os/rfp/BidReadinessPanel.tsx
// Bid Readiness Panel for RFP Builder
// Shows go/no-go recommendation with actionable fixes

import { useState, useMemo } from 'react';
import {
  Target,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  Wrench,
  Shield,
  Lightbulb,
  Gauge,
  TrendingUp,
  TrendingDown,
  BarChart3,
} from 'lucide-react';
import type { OutcomeInsight } from '@/lib/os/rfp/analyzeOutcomes';
import type { RelevantInsight } from '@/hooks/useOutcomeInsights';
import type { RfpSection, RfpSectionKey } from '@/lib/types/rfp';
import type { RfpWinStrategy } from '@/lib/types/rfpWinStrategy';
import type { RfpPersonaSettings } from '@/lib/types/rfpEvaluatorPersona';
import type { FirmBrainReadiness } from '@/lib/os/ai/firmBrainReadiness';
import type { StrategyHealth } from '@/lib/types/rfpWinStrategy';
import type { RubricCoverageResult } from '@/lib/os/rfp/computeRubricCoverage';
import {
  computeBidReadiness,
  type BidReadiness,
  type BidReadinessFix,
  type BidRisk,
  type BidReadinessInputs,
  getRecommendationLabel,
  getRecommendationColorClass,
  getRecommendationBgClass,
  getBidReadinessSummary,
  getEffortLabel,
} from '@/lib/os/rfp/computeBidReadiness';
import {
  createFocusActionFromFix,
  executeFocusAction,
  type RfpFocusCallbacks,
} from '@/lib/os/rfp/focus';

// ============================================================================
// Types
// ============================================================================

interface BidReadinessPanelProps {
  firmBrainReadiness: FirmBrainReadiness | null;
  strategyHealth: StrategyHealth | null;
  rubricCoverage: RubricCoverageResult | null;
  strategy: RfpWinStrategy | null;
  sections: RfpSection[];
  personaSettings?: RfpPersonaSettings | null;
  /** Callbacks for navigating to fixes */
  focusCallbacks?: RfpFocusCallbacks;
  /** Variant: compact (collapsible) or full (always expanded) */
  variant?: 'compact' | 'full';
  /** Max number of fixes to show in compact mode */
  maxFixesCompact?: number;
  /** Max number of risks to show in compact mode */
  maxRisksCompact?: number;
  /** Relevant outcome insights (from historical data) */
  outcomeInsights?: RelevantInsight[];
}

// ============================================================================
// Sub-components
// ============================================================================

function RecommendationBadge({
  recommendation,
  score,
}: {
  recommendation: BidReadiness['recommendation'];
  score: number;
}) {
  const label = getRecommendationLabel(recommendation);
  const bgClass = getRecommendationBgClass(recommendation);

  const icon = {
    go: <CheckCircle2 className="w-4 h-4" />,
    conditional: <AlertCircle className="w-4 h-4" />,
    no_go: <XCircle className="w-4 h-4" />,
  }[recommendation];

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${bgClass}`}>
      {icon}
      <span className="font-medium">{label}</span>
      <span className="text-xs opacity-75">({score}%)</span>
    </div>
  );
}

function RiskItem({ risk }: { risk: BidRisk }) {
  const severityColors = {
    critical: 'text-red-400 bg-red-500/10 border-red-500/30',
    high: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
    medium: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    low: 'text-slate-400 bg-slate-500/10 border-slate-500/30',
  };

  const severityLabels = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  };

  return (
    <div className={`p-2 rounded-lg border ${severityColors[risk.severity]}`}>
      <div className="flex items-start gap-2">
        <Shield className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase">
              {severityLabels[risk.severity]}
            </span>
            <span className="text-xs opacity-75 capitalize">{risk.category.replace('_', ' ')}</span>
          </div>
          <p className="text-xs mt-0.5 opacity-90">{risk.description}</p>
          {risk.mitigation && (
            <p className="text-xs mt-1 opacity-75 italic">{risk.mitigation}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function FixItem({
  fix,
  onFix,
}: {
  fix: BidReadinessFix;
  onFix: (fix: BidReadinessFix) => void;
}) {
  const effortColors = {
    low: 'text-emerald-400',
    medium: 'text-amber-400',
    high: 'text-red-400',
  };

  return (
    <button
      onClick={() => onFix(fix)}
      className="w-full p-2 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-purple-500/50 rounded-lg transition-colors text-left group"
    >
      <div className="flex items-start gap-2">
        <Wrench className="w-3.5 h-3.5 mt-0.5 text-purple-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-200">{fix.reason}</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-emerald-400">
              +{fix.expectedLift} pts
            </span>
            <span className={`text-xs ${effortColors[fix.effort]}`}>
              {getEffortLabel(fix.effort)}
            </span>
          </div>
        </div>
        <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-purple-400 transition-colors flex-shrink-0" />
      </div>
    </button>
  );
}

function BreakdownBar({ breakdown }: { breakdown: BidReadiness['breakdown'] }) {
  const components = [
    { label: 'Firm Brain', score: breakdown.firmBrainReadiness, weight: breakdown.weights.firmBrain, color: 'bg-blue-500' },
    { label: 'Strategy', score: breakdown.winStrategyHealth, weight: breakdown.weights.strategy, color: 'bg-purple-500' },
    { label: 'Coverage', score: breakdown.rubricCoverageHealth, weight: breakdown.weights.coverage, color: 'bg-emerald-500' },
    { label: 'Proof', score: breakdown.proofCoverage, weight: breakdown.weights.proof, color: 'bg-amber-500' },
    { label: 'Persona', score: breakdown.personaAlignment, weight: breakdown.weights.persona, color: 'bg-pink-500' },
  ];

  return (
    <div className="space-y-1">
      {components.map((c) => (
        <div key={c.label} className="flex items-center gap-2 text-xs">
          <span className="w-20 text-slate-400">{c.label}</span>
          <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full ${c.color} transition-all`}
              style={{ width: `${c.score}%` }}
            />
          </div>
          <span className="w-8 text-right text-slate-500">{c.score}%</span>
        </div>
      ))}
    </div>
  );
}

function OutcomeInsightCallout({ insights }: { insights: RelevantInsight[] }) {
  if (insights.length === 0) return null;

  return (
    <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 className="w-4 h-4 text-indigo-400" />
        <span className="text-xs font-medium text-indigo-300">Firm Insights</span>
      </div>
      <div className="space-y-2">
        {insights.map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            {item.insight.winRateDelta > 0 ? (
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <p className="text-xs text-slate-300">
                <span className={item.insight.winRateDelta > 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {item.insight.winRateDelta > 0 ? '+' : ''}{item.insight.winRateDelta}% win rate
                </span>
                {' '}when <span className="text-slate-200">{item.insight.signal}</span>
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {item.relevanceReason} • {item.insight.sampleSize} RFPs
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function BidReadinessPanel({
  firmBrainReadiness,
  strategyHealth,
  rubricCoverage,
  strategy,
  sections,
  personaSettings,
  focusCallbacks,
  variant = 'compact',
  maxFixesCompact = 3,
  maxRisksCompact = 3,
  outcomeInsights,
}: BidReadinessPanelProps) {
  const [isExpanded, setIsExpanded] = useState(variant === 'full');
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Compute bid readiness
  const inputs: BidReadinessInputs = useMemo(() => ({
    firmBrainReadiness,
    strategyHealth,
    rubricCoverage,
    strategy,
    sections,
    personaSettings,
  }), [firmBrainReadiness, strategyHealth, rubricCoverage, strategy, sections, personaSettings]);

  const readiness = useMemo(() => computeBidReadiness(inputs), [inputs]);

  // Handle fix click
  const handleFixClick = (fix: BidReadinessFix) => {
    if (!focusCallbacks) return;
    const action = createFocusActionFromFix(fix.sectionKey, fix.reason);
    executeFocusAction(action, focusCallbacks);
  };

  // Determine display counts
  const displayedFixes = isExpanded
    ? readiness.highestImpactFixes
    : readiness.highestImpactFixes.slice(0, maxFixesCompact);
  const displayedRisks = isExpanded
    ? readiness.topRisks
    : readiness.topRisks.slice(0, maxRisksCompact);

  const hasMoreFixes = readiness.highestImpactFixes.length > maxFixesCompact;
  const hasMoreRisks = readiness.topRisks.length > maxRisksCompact;

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => variant === 'compact' && setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Gauge className="w-5 h-5 text-purple-400" />
          <span className="text-sm font-medium text-white">Bid Readiness</span>
        </div>
        <div className="flex items-center gap-2">
          <RecommendationBadge
            recommendation={readiness.recommendation}
            score={readiness.score}
          />
          {variant === 'compact' && (
            isExpanded
              ? <ChevronDown className="w-4 h-4 text-slate-400" />
              : <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>

      {/* Content */}
      {(isExpanded || variant === 'full') && (
        <div className="px-4 pb-4 space-y-4">
          {/* Summary */}
          <p className="text-xs text-slate-400">
            {getBidReadinessSummary(readiness)}
          </p>

          {/* Unreliable Assessment Warning */}
          {!readiness.isReliableAssessment && (
            <div className="flex items-start gap-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-400">
                Limited data available. Complete more sections and define a win strategy for accurate assessment.
              </p>
            </div>
          )}

          {/* Conditions (for conditional recommendation) */}
          {readiness.recommendation === 'conditional' && readiness.conditions && readiness.conditions.length > 0 && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-medium text-blue-300">Proceed if:</span>
              </div>
              <ul className="space-y-1">
                {readiness.conditions.map((condition, i) => (
                  <li key={i} className="text-xs text-blue-200 flex items-start gap-2">
                    <span className="text-blue-400">•</span>
                    {condition}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Outcome Insights Callout */}
          {outcomeInsights && outcomeInsights.length > 0 && (
            <OutcomeInsightCallout insights={outcomeInsights} />
          )}

          {/* Breakdown toggle */}
          <button
            onClick={() => setShowBreakdown(!showBreakdown)}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-300 transition-colors"
          >
            {showBreakdown ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            Score breakdown
          </button>

          {showBreakdown && (
            <BreakdownBar breakdown={readiness.breakdown} />
          )}

          {/* Top Risks */}
          {displayedRisks.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                Top Risks ({readiness.topRisks.length})
              </h4>
              <div className="space-y-2">
                {displayedRisks.map((risk, i) => (
                  <RiskItem key={i} risk={risk} />
                ))}
              </div>
              {!isExpanded && hasMoreRisks && (
                <button
                  onClick={() => setIsExpanded(true)}
                  className="text-xs text-purple-400 hover:text-purple-300 mt-2"
                >
                  +{readiness.topRisks.length - maxRisksCompact} more risks
                </button>
              )}
            </div>
          )}

          {/* Highest Impact Fixes */}
          {displayedFixes.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                Fix to Improve ({readiness.highestImpactFixes.length})
              </h4>
              <div className="space-y-2">
                {displayedFixes.map((fix, i) => (
                  <FixItem key={i} fix={fix} onFix={handleFixClick} />
                ))}
              </div>
              {!isExpanded && hasMoreFixes && (
                <button
                  onClick={() => setIsExpanded(true)}
                  className="text-xs text-purple-400 hover:text-purple-300 mt-2"
                >
                  +{readiness.highestImpactFixes.length - maxFixesCompact} more fixes
                </button>
              )}
            </div>
          )}

          {/* Fix Top Issues CTA */}
          {readiness.recommendation !== 'go' && readiness.highestImpactFixes.length > 0 && focusCallbacks && (
            <button
              onClick={() => {
                const topFix = readiness.highestImpactFixes[0];
                handleFixClick(topFix);
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Wrench className="w-4 h-4" />
              Fix Top Issue
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Compact Chip for RFP List
// ============================================================================

interface BidReadinessChipProps {
  score: number;
  recommendation: BidReadiness['recommendation'];
  summary?: string;
}

export function BidReadinessChip({
  score,
  recommendation,
  summary,
}: BidReadinessChipProps) {
  const colorClass = getRecommendationColorClass(recommendation);

  const icon = {
    go: <CheckCircle2 className="w-3 h-3" />,
    conditional: <AlertCircle className="w-3 h-3" />,
    no_go: <XCircle className="w-3 h-3" />,
  }[recommendation];

  return (
    <div
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${colorClass}`}
      title={summary}
    >
      {icon}
      <span>{score}%</span>
    </div>
  );
}

// ============================================================================
// Exports
// ============================================================================

export { computeBidReadiness, type BidReadiness, type BidReadinessInputs };
