// components/os/rfp/WinStrategyPanel.tsx
// Win Strategy Panel for RFP Builder
// Displays the win strategy, health indicators, rubric map, and alignment scoring

import { useState, useMemo } from 'react';
import {
  Target,
  ChevronDown,
  ChevronRight,
  Lightbulb,
  AlertTriangle,
  BookOpen,
  Trophy,
  Shield,
  Lock,
  Sparkles,
  Grid3X3,
  Check,
  X,
  Flag,
  Users,
  FileCheck,
  Code,
  TrendingUp,
} from 'lucide-react';
import type { RfpWinStrategy } from '@/lib/types/rfpWinStrategy';
import type { RfpSection } from '@/lib/types/rfp';
import { computeStrategyHealth } from '@/lib/types/rfpWinStrategy';
import {
  computeRubricCoverage,
  getShortSectionLabel,
  getSuggestedSectionsForReview,
  type RubricCoverageResult,
  type CriterionCoverage,
} from '@/lib/os/rfp/computeRubricCoverage';
import {
  type RfpPersonaSettings,
  type EvaluatorPersonaType,
  getPersonaLabel,
  getPersonaColor,
  createDefaultPersonaSettings,
} from '@/lib/types/rfpEvaluatorPersona';

interface WinStrategyPanelProps {
  strategy: RfpWinStrategy | null | undefined;
  /** Sections for rubric coverage calculation */
  sections?: RfpSection[];
  /** Persona settings for persona risk detection */
  personaSettings?: RfpPersonaSettings | null;
  onEditStrategy?: () => void;
  onSuggestStrategy?: () => void;
  /** Callback to mark a section for review */
  onMarkSectionForReview?: (sectionKey: string) => void;
  isLoadingSuggestion?: boolean;
  variant?: 'compact' | 'full';
}

/** View mode for rubric map */
type RubricViewMode = 'criteria' | 'evaluator';

export function WinStrategyPanel({
  strategy,
  sections = [],
  personaSettings,
  onEditStrategy,
  onSuggestStrategy,
  onMarkSectionForReview,
  isLoadingSuggestion,
  variant = 'compact',
}: WinStrategyPanelProps) {
  const [isExpanded, setIsExpanded] = useState(variant === 'full');
  const [showRubricMap, setShowRubricMap] = useState(false);
  const [selectedCriterion, setSelectedCriterion] = useState<string | null>(null);
  const [rubricViewMode, setRubricViewMode] = useState<RubricViewMode>('criteria');
  const health = computeStrategyHealth(strategy);

  // Use default persona settings if not provided
  const effectivePersonaSettings = personaSettings ?? createDefaultPersonaSettings();

  // Compute rubric coverage when we have strategy and sections
  const rubricCoverage = useMemo(() => {
    if (!strategy || sections.length === 0) return null;
    return computeRubricCoverage(strategy, sections, effectivePersonaSettings);
  }, [strategy, sections, effectivePersonaSettings]);

  // Group criteria by expected persona for evaluator view
  const criteriaByPersona = useMemo(() => {
    if (!rubricCoverage) return null;
    const grouped: Record<EvaluatorPersonaType | 'unknown', CriterionCoverage[]> = {
      procurement: [],
      technical: [],
      executive: [],
      unknown: [],
    };
    for (const c of rubricCoverage.criterionCoverage) {
      const persona = c.expectedPersona || 'unknown';
      if (persona === 'unknown') {
        grouped.unknown.push(c);
      } else {
        grouped[persona].push(c);
      }
    }
    return grouped;
  }, [rubricCoverage]);

  // Get persona icon component
  const getPersonaIcon = (persona: EvaluatorPersonaType) => {
    switch (persona) {
      case 'procurement': return FileCheck;
      case 'technical': return Code;
      case 'executive': return TrendingUp;
    }
  };

  // Get persona color class
  const getPersonaColorClass = (persona: EvaluatorPersonaType) => {
    switch (persona) {
      case 'procurement': return 'text-blue-400';
      case 'technical': return 'text-purple-400';
      case 'executive': return 'text-amber-400';
    }
  };

  // Color coding for health score
  const healthColor = health.completenessScore >= 70
    ? 'text-emerald-400'
    : health.completenessScore >= 40
    ? 'text-amber-400'
    : 'text-red-400';

  const healthBg = health.completenessScore >= 70
    ? 'bg-emerald-500/10 border-emerald-500/20'
    : health.completenessScore >= 40
    ? 'bg-amber-500/10 border-amber-500/20'
    : 'bg-red-500/10 border-red-500/20';

  if (!health.isDefined) {
    return (
      <div className="border border-slate-700 rounded-lg bg-slate-800/30 p-3">
        <div className="flex items-center gap-2 mb-2">
          <Target className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-medium text-slate-300">Win Strategy</span>
        </div>
        <p className="text-[11px] text-slate-500 mb-3">
          No win strategy defined. Define evaluation criteria, win themes, and proof plan to improve alignment.
        </p>
        {onSuggestStrategy && (
          <button
            onClick={onSuggestStrategy}
            disabled={isLoadingSuggestion}
            className="w-full px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 disabled:cursor-not-allowed text-white text-xs font-medium rounded transition-colors flex items-center justify-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {isLoadingSuggestion ? 'Suggesting...' : 'Suggest Win Strategy'}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`border rounded-lg overflow-hidden ${healthBg}`}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Target className={`w-4 h-4 ${healthColor}`} />
          <span className="text-xs font-medium text-slate-200">Win Strategy</span>
          {strategy?.locked && (
            <Lock className="w-3 h-3 text-slate-400" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-medium ${healthColor}`}>
            {health.completenessScore}%
          </span>
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          )}
        </div>
      </button>

      {/* Collapsed summary */}
      {!isExpanded && strategy && (
        <div className="px-3 pb-2">
          <div className="flex flex-wrap gap-1">
            {strategy.winThemes.slice(0, 3).map((theme) => (
              <span
                key={theme.id}
                className="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 text-[10px] rounded"
              >
                {theme.label}
              </span>
            ))}
            {strategy.winThemes.length > 3 && (
              <span className="text-[10px] text-slate-500">
                +{strategy.winThemes.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Expanded content */}
      {isExpanded && strategy && (
        <div className="px-3 pb-3 space-y-3 border-t border-white/5">
          {/* Win Themes */}
          {strategy.winThemes.length > 0 && (
            <div className="pt-3">
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400 mb-1.5">
                <Lightbulb className="w-3 h-3" />
                Win Themes ({strategy.winThemes.length})
              </div>
              <div className="space-y-1">
                {strategy.winThemes.map((theme) => (
                  <div key={theme.id} className="group">
                    <span className="text-[11px] text-purple-300 font-medium">
                      {theme.label}
                    </span>
                    <p className="text-[10px] text-slate-500 line-clamp-1 group-hover:line-clamp-none">
                      {theme.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Evaluation Criteria */}
          {strategy.evaluationCriteria.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400 mb-1.5">
                <Trophy className="w-3 h-3" />
                Scoring Criteria ({strategy.evaluationCriteria.length})
              </div>
              <div className="space-y-1">
                {strategy.evaluationCriteria.map((criterion, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-300">{criterion.label}</span>
                    <div className="flex items-center gap-1.5">
                      {criterion.weight && (
                        <span className="text-[10px] text-slate-500">
                          {Math.round(criterion.weight * 100)}%
                        </span>
                      )}
                      {criterion.alignmentScore && (
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <div
                              key={n}
                              className={`w-1.5 h-1.5 rounded-full ${
                                n <= criterion.alignmentScore!
                                  ? 'bg-emerald-400'
                                  : 'bg-slate-600'
                              }`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Proof Plan */}
          {strategy.proofPlan.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400 mb-1.5">
                <BookOpen className="w-3 h-3" />
                Proof Plan ({strategy.proofPlan.length})
              </div>
              <div className="space-y-0.5">
                {strategy.proofPlan.slice(0, 5).map((proof, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[11px]">
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      proof.priority === 5 ? 'bg-emerald-400' :
                      proof.priority === 4 ? 'bg-blue-400' : 'bg-slate-500'
                    }`} />
                    <span className="text-slate-400">
                      {proof.type === 'case_study' ? 'Case Study' : 'Reference'}
                    </span>
                  </div>
                ))}
                {strategy.proofPlan.length > 5 && (
                  <span className="text-[10px] text-slate-500">
                    +{strategy.proofPlan.length - 5} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Landmines */}
          {strategy.landmines.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-amber-400 mb-1.5">
                <AlertTriangle className="w-3 h-3" />
                Risk Areas ({strategy.landmines.length})
              </div>
              <div className="space-y-1">
                {strategy.landmines.map((landmine) => (
                  <div key={landmine.id} className="flex items-start gap-1.5">
                    <span className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      landmine.severity === 'critical' ? 'bg-red-400' :
                      landmine.severity === 'high' ? 'bg-orange-400' :
                      landmine.severity === 'medium' ? 'bg-amber-400' : 'bg-slate-400'
                    }`} />
                    <span className="text-[11px] text-slate-400 line-clamp-1">
                      {landmine.description}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Health Issues */}
          {health.issues.length > 0 && (
            <div className="pt-2 border-t border-white/5">
              <div className="text-[10px] text-amber-400 mb-1">Incomplete:</div>
              {health.issues.map((issue, i) => (
                <div key={i} className="text-[10px] text-slate-500">- {issue}</div>
              ))}
            </div>
          )}

          {/* Rubric Coverage Map */}
          {rubricCoverage && rubricCoverage.criterionCoverage.length > 0 && (
            <div className="pt-2 border-t border-white/5">
              {/* Toggle button */}
              <button
                onClick={() => setShowRubricMap(!showRubricMap)}
                className="w-full flex items-center justify-between text-[10px] font-medium text-slate-400 hover:text-slate-300 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <Grid3X3 className="w-3 h-3" />
                  Rubric Coverage Map
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-medium ${
                    rubricCoverage.overallHealth >= 70 ? 'text-emerald-400' :
                    rubricCoverage.overallHealth >= 40 ? 'text-amber-400' : 'text-red-400'
                  }`}>
                    {rubricCoverage.overallHealth}%
                  </span>
                  {showRubricMap ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                </div>
              </button>

              {showRubricMap && (
                <div className="mt-2 space-y-2">
                  {/* View mode toggle */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setRubricViewMode('criteria')}
                      className={`flex-1 px-2 py-1 text-[9px] font-medium rounded transition-colors ${
                        rubricViewMode === 'criteria'
                          ? 'bg-purple-500/20 text-purple-300'
                          : 'bg-slate-700/30 text-slate-400 hover:text-slate-300'
                      }`}
                    >
                      <Trophy className="w-3 h-3 inline-block mr-1" />
                      Criteria View
                    </button>
                    <button
                      onClick={() => setRubricViewMode('evaluator')}
                      className={`flex-1 px-2 py-1 text-[9px] font-medium rounded transition-colors ${
                        rubricViewMode === 'evaluator'
                          ? 'bg-purple-500/20 text-purple-300'
                          : 'bg-slate-700/30 text-slate-400 hover:text-slate-300'
                      }`}
                    >
                      <Users className="w-3 h-3 inline-block mr-1" />
                      Evaluator View
                    </button>
                  </div>

                  {/* Coverage health header */}
                  <div className={`px-2 py-1 rounded text-[10px] ${
                    rubricCoverage.overallHealth >= 70 ? 'bg-emerald-500/10 text-emerald-300' :
                    rubricCoverage.overallHealth >= 40 ? 'bg-amber-500/10 text-amber-300' :
                    'bg-red-500/10 text-red-300'
                  }`}>
                    Coverage health: {rubricCoverage.overallHealth}%
                    {rubricCoverage.uncoveredHighWeightCount > 0 && (
                      <span className="ml-2 text-red-400">
                        ({rubricCoverage.uncoveredHighWeightCount} high-weight uncovered)
                      </span>
                    )}
                    {rubricCoverage.personaMismatchCount > 0 && (
                      <span className="ml-2 text-amber-400">
                        ({rubricCoverage.personaMismatchCount} persona skew)
                      </span>
                    )}
                  </div>

                  {/* Criterion rows - render function for reuse */}
                  {(() => {
                    const renderCriterionRow = (criterion: CriterionCoverage) => (
                      <div key={criterion.criterionLabel}>
                        {/* Criterion row */}
                        <button
                          onClick={() => setSelectedCriterion(
                            selectedCriterion === criterion.criterionLabel
                              ? null
                              : criterion.criterionLabel
                          )}
                          className={`w-full flex items-center gap-2 px-2 py-1 rounded text-left transition-colors ${
                            criterion.isRisk
                              ? 'bg-red-500/10 hover:bg-red-500/20'
                              : 'bg-slate-700/30 hover:bg-slate-700/50'
                          }`}
                        >
                          {/* Risk indicator */}
                          {criterion.isRisk && (
                            <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />
                          )}

                          {/* Persona mismatch indicator */}
                          {criterion.hasPersonaMismatch && criterion.personaRiskLevel !== 'none' && (
                            <Users className={`w-3 h-3 flex-shrink-0 ${
                              criterion.personaRiskLevel === 'high' ? 'text-red-400' :
                              criterion.personaRiskLevel === 'medium' ? 'text-amber-400' : 'text-blue-400'
                            }`} />
                          )}

                          {/* Criterion label */}
                          <span className="text-[10px] text-slate-300 flex-1 truncate">
                            {criterion.criterionLabel}
                          </span>

                          {/* Weight badge */}
                          <span className="text-[9px] text-slate-500">
                            {Math.round(criterion.weight * 100)}%
                          </span>

                          {/* Section coverage indicators */}
                          <div className="flex gap-0.5">
                            {['agency_overview', 'approach', 'team', 'work_samples', 'plan_timeline', 'pricing', 'references'].map((sectionKey) => {
                              const isCovered = criterion.coveredBySectionKeys.includes(sectionKey);
                              const isSuggested = criterion.missingSections.includes(sectionKey) ||
                                                  criterion.coveredBySectionKeys.includes(sectionKey);
                              return (
                                <div
                                  key={sectionKey}
                                  title={`${getShortSectionLabel(sectionKey)}: ${isCovered ? 'Covered' : isSuggested ? 'Missing' : 'N/A'}`}
                                  className={`w-2 h-2 rounded-sm ${
                                    isCovered
                                      ? 'bg-emerald-400'
                                      : isSuggested
                                      ? 'bg-red-400/50'
                                      : 'bg-slate-600'
                                  }`}
                                />
                              );
                            })}
                          </div>

                          {/* Coverage score */}
                          <span className={`text-[9px] font-medium w-8 text-right ${
                            criterion.coverageScore >= 80 ? 'text-emerald-400' :
                            criterion.coverageScore >= 50 ? 'text-amber-400' : 'text-red-400'
                          }`}>
                            {criterion.coverageScore}%
                          </span>

                          {/* Expand indicator */}
                          {selectedCriterion === criterion.criterionLabel ? (
                            <ChevronDown className="w-3 h-3 text-slate-400" />
                          ) : (
                            <ChevronRight className="w-3 h-3 text-slate-400" />
                          )}
                        </button>

                        {/* Expanded details */}
                        {selectedCriterion === criterion.criterionLabel && (
                          <div className="ml-4 mt-1 p-2 bg-slate-800/50 rounded space-y-2">
                            {/* Persona risk warning */}
                            {criterion.hasPersonaMismatch && criterion.personaRiskDescription && (
                              <div className={`px-2 py-1 rounded text-[10px] flex items-center gap-1.5 ${
                                criterion.personaRiskLevel === 'high'
                                  ? 'bg-red-500/10 text-red-300'
                                  : criterion.personaRiskLevel === 'medium'
                                  ? 'bg-amber-500/10 text-amber-300'
                                  : 'bg-blue-500/10 text-blue-300'
                              }`}>
                                <Users className="w-3 h-3 flex-shrink-0" />
                                <span>{criterion.personaRiskDescription}</span>
                              </div>
                            )}

                            {/* Expected vs actual personas */}
                            {criterion.expectedPersona && criterion.coveringPersonas && criterion.coveringPersonas.length > 0 && (
                              <div className="flex items-center gap-2 text-[10px]">
                                <span className="text-slate-500">Expected:</span>
                                <span className={`px-1.5 py-0.5 rounded ${
                                  criterion.expectedPersona === 'procurement' ? 'bg-blue-500/20 text-blue-300' :
                                  criterion.expectedPersona === 'technical' ? 'bg-purple-500/20 text-purple-300' :
                                  'bg-amber-500/20 text-amber-300'
                                }`}>
                                  {getPersonaLabel(criterion.expectedPersona)}
                                </span>
                                <span className="text-slate-500">Actual:</span>
                                {criterion.coveringPersonas.map((p) => (
                                  <span
                                    key={p}
                                    className={`px-1.5 py-0.5 rounded ${
                                      p === 'procurement' ? 'bg-blue-500/20 text-blue-300' :
                                      p === 'technical' ? 'bg-purple-500/20 text-purple-300' :
                                      'bg-amber-500/20 text-amber-300'
                                    }`}
                                  >
                                    {getPersonaLabel(p)}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Notes/warnings */}
                            {criterion.notes.length > 0 && (
                              <div className="space-y-0.5">
                                {criterion.notes.map((note, i) => (
                                  <div key={i} className="text-[10px] text-amber-400 flex items-center gap-1">
                                    <AlertTriangle className="w-2.5 h-2.5" />
                                    {note}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Covered sections */}
                            {criterion.coveredBySectionKeys.length > 0 && (
                              <div>
                                <div className="text-[9px] text-slate-500 mb-0.5">Covered by:</div>
                                <div className="flex flex-wrap gap-1">
                                  {criterion.coveredBySectionKeys.map((sKey) => (
                                    <span
                                      key={sKey}
                                      className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 text-[9px] rounded flex items-center gap-0.5"
                                    >
                                      <Check className="w-2.5 h-2.5" />
                                      {getShortSectionLabel(sKey)}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Missing sections with review action */}
                            {criterion.missingSections.length > 0 && (
                              <div>
                                <div className="text-[9px] text-slate-500 mb-0.5">Missing from:</div>
                                <div className="flex flex-wrap gap-1">
                                  {criterion.missingSections.map((sKey) => (
                                    <span
                                      key={sKey}
                                      className="px-1.5 py-0.5 bg-red-500/20 text-red-300 text-[9px] rounded flex items-center gap-0.5"
                                    >
                                      <X className="w-2.5 h-2.5" />
                                      {getShortSectionLabel(sKey)}
                                    </span>
                                  ))}
                                </div>

                                {/* Mark for review button */}
                                {onMarkSectionForReview && criterion.missingSections.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {criterion.missingSections.map((sKey) => (
                                      <button
                                        key={sKey}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onMarkSectionForReview(sKey);
                                        }}
                                        className="px-2 py-0.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 text-[9px] rounded flex items-center gap-1 transition-colors"
                                      >
                                        <Flag className="w-2.5 h-2.5" />
                                        Review {getShortSectionLabel(sKey)}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Proof coverage */}
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] text-slate-500">Proof coverage:</span>
                              <span className={`text-[9px] font-medium ${
                                criterion.proofCoverageScore >= 80 ? 'text-emerald-400' :
                                criterion.proofCoverageScore >= 50 ? 'text-amber-400' : 'text-red-400'
                              }`}>
                                {criterion.proofCoverageScore}%
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );

                    // Criteria View: flat list
                    if (rubricViewMode === 'criteria') {
                      return (
                        <div className="space-y-1">
                          {rubricCoverage.criterionCoverage.map(renderCriterionRow)}
                        </div>
                      );
                    }

                    // Evaluator View: grouped by persona
                    const personaOrder: (EvaluatorPersonaType | 'unknown')[] = ['technical', 'executive', 'procurement', 'unknown'];
                    const personaLabels: Record<string, string> = {
                      technical: 'Technical Evaluators',
                      executive: 'Executive Stakeholders',
                      procurement: 'Procurement Team',
                      unknown: 'Uncategorized',
                    };
                    const personaBgColors: Record<string, string> = {
                      technical: 'bg-purple-500/10 border-purple-500/20',
                      executive: 'bg-amber-500/10 border-amber-500/20',
                      procurement: 'bg-blue-500/10 border-blue-500/20',
                      unknown: 'bg-slate-500/10 border-slate-500/20',
                    };

                    return (
                      <div className="space-y-3">
                        {criteriaByPersona && personaOrder.map((persona) => {
                          const criteria = criteriaByPersona[persona];
                          if (!criteria || criteria.length === 0) return null;

                          const PersonaIcon = persona !== 'unknown' ? getPersonaIcon(persona as EvaluatorPersonaType) : Users;
                          const colorClass = persona !== 'unknown' ? getPersonaColorClass(persona as EvaluatorPersonaType) : 'text-slate-400';
                          const mismatchCount = criteria.filter(c => c.hasPersonaMismatch && c.personaRiskLevel !== 'none').length;

                          return (
                            <div key={persona} className={`rounded border ${personaBgColors[persona]}`}>
                              {/* Persona group header */}
                              <div className="px-2 py-1.5 flex items-center gap-2 border-b border-white/5">
                                <PersonaIcon className={`w-3.5 h-3.5 ${colorClass}`} />
                                <span className="text-[10px] font-medium text-slate-300">
                                  {personaLabels[persona]}
                                </span>
                                <span className="text-[9px] text-slate-500">
                                  ({criteria.length} criteria)
                                </span>
                                {mismatchCount > 0 && (
                                  <span className="text-[9px] text-amber-400 flex items-center gap-0.5">
                                    <AlertTriangle className="w-2.5 h-2.5" />
                                    {mismatchCount} skew
                                  </span>
                                )}
                              </div>
                              {/* Criteria in this group */}
                              <div className="p-1 space-y-1">
                                {criteria.map(renderCriterionRow)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {/* Section legend */}
                  <div className="pt-1 border-t border-white/5 space-y-1">
                    <div className="flex flex-wrap gap-2 text-[9px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-sm bg-emerald-400" /> Covered
                      </span>
                      <span className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-sm bg-red-400/50" /> Missing
                      </span>
                      <span className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-sm bg-slate-600" /> N/A
                      </span>
                    </div>
                    {/* Persona legend in evaluator view */}
                    {rubricViewMode === 'evaluator' && (
                      <div className="flex flex-wrap gap-2 text-[9px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <FileCheck className="w-3 h-3 text-blue-400" /> Procurement
                        </span>
                        <span className="flex items-center gap-1">
                          <Code className="w-3 h-3 text-purple-400" /> Technical
                        </span>
                        <span className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3 text-amber-400" /> Executive
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Edit Button */}
          {onEditStrategy && (
            <button
              onClick={onEditStrategy}
              className="w-full px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-[10px] rounded transition-colors mt-2"
            >
              Edit Strategy
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Strategy Missing Banner
// ============================================================================

interface WinStrategyMissingBannerProps {
  onSuggestStrategy?: () => void;
  isLoading?: boolean;
}

export function WinStrategyMissingBanner({
  onSuggestStrategy,
  isLoading,
}: WinStrategyMissingBannerProps) {
  return (
    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Shield className="w-4 h-4 text-amber-400" />
        <div>
          <p className="text-xs text-amber-300 font-medium">No Win Strategy</p>
          <p className="text-[10px] text-slate-400">
            Generated content may be generic without strategic alignment
          </p>
        </div>
      </div>
      {onSuggestStrategy && (
        <button
          onClick={onSuggestStrategy}
          disabled={isLoading}
          className="px-2 py-1 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800 disabled:cursor-not-allowed text-white text-[10px] font-medium rounded transition-colors flex items-center gap-1"
        >
          <Sparkles className="w-3 h-3" />
          {isLoading ? 'Loading...' : 'Suggest'}
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Section Alignment Badge
// ============================================================================

interface SectionAlignmentBadgeProps {
  sectionKey: string;
  strategy: RfpWinStrategy;
}

export function SectionAlignmentBadge({
  sectionKey,
  strategy,
}: SectionAlignmentBadgeProps) {
  // Count applicable themes for this section
  const applicableThemes = strategy.winThemes.filter(
    t => !t.applicableSections || t.applicableSections.length === 0 || t.applicableSections.includes(sectionKey)
  );

  // Count applicable landmines
  const applicableLandmines = strategy.landmines.filter(
    l => !l.affectedSections || l.affectedSections.length === 0 || l.affectedSections.includes(sectionKey)
  );

  const hasThemes = applicableThemes.length > 0;
  const hasLandmines = applicableLandmines.length > 0;
  const criticalLandmines = applicableLandmines.filter(l => l.severity === 'critical' || l.severity === 'high');

  if (!hasThemes && !hasLandmines) {
    return null;
  }

  return (
    <div className="flex items-center gap-1">
      {hasThemes && (
        <span
          className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-purple-500/20 text-purple-300 text-[9px] rounded"
          title={`${applicableThemes.length} win theme${applicableThemes.length > 1 ? 's' : ''} to emphasize`}
        >
          <Target className="w-2.5 h-2.5" />
          {applicableThemes.length}
        </span>
      )}
      {criticalLandmines.length > 0 && (
        <span
          className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-red-500/20 text-red-300 text-[9px] rounded"
          title={`${criticalLandmines.length} risk area${criticalLandmines.length > 1 ? 's' : ''} to address`}
        >
          <AlertTriangle className="w-2.5 h-2.5" />
          {criticalLandmines.length}
        </span>
      )}
    </div>
  );
}
