'use client';

// components/strategy-comparison/StrategyComparisonClient.tsx
// Strategy Comparison UI - Side-by-side comparison of 2-4 strategies
//
// Features:
// - Strategy selector (multi-select 2-4)
// - Objective Coverage grid
// - Pros/Cons per strategy
// - Tradeoffs per strategy
// - Risks & mitigations
// - Recommendation with conditionals
// - Set Active action

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Scale,
  Target,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  CheckCircle,
  Loader2,
  RefreshCw,
  Sparkles,
  ArrowRight,
  Shield,
  Lightbulb,
  Users,
  Zap,
} from 'lucide-react';
import type {
  StrategyComparison,
  StrategyComparisonViewModel,
  ComparisonCheckResponse,
  ComparisonDimension,
  StrategyAggregateScores,
} from '@/lib/types/strategyComparison';
import type { CompanyStrategy } from '@/lib/types/strategy';

// ============================================================================
// Types
// ============================================================================

interface StrategyComparisonClientProps {
  companyId: string;
  companyName: string;
  strategies: CompanyStrategy[];
  activeStrategyId: string | null;
}

type ComparisonState = 'idle' | 'loading' | 'generating' | 'ready' | 'stale' | 'error';
type ComparisonTab = 'coverage' | 'matrix' | 'proscons' | 'tradeoffs' | 'risks' | 'frame' | 'tactics';

// ============================================================================
// Hook for Comparison API
// ============================================================================

function useStrategyComparison(companyId: string) {
  const [state, setState] = useState<ComparisonState>('idle');
  const [comparison, setComparison] = useState<StrategyComparison | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [staleReason, setStaleReason] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const checkComparison = useCallback(async (strategyIds: string[]) => {
    if (strategyIds.length < 2) return;

    setState('loading');
    setError(null);

    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/strategy/compare?strategyIds=${strategyIds.join(',')}`
      );
      const data: ComparisonCheckResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.staleReason || 'Failed to check comparison');
      }

      if (data.mode === 'found' && data.comparison) {
        setComparison(data.comparison);
        setState('ready');
      } else if (data.mode === 'stale' && data.comparison) {
        setComparison(data.comparison);
        setStaleReason(data.staleReason || 'Data has changed');
        setState('stale');
      } else {
        setState('idle');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setState('error');
    }
  }, [companyId]);

  const generateComparison = useCallback(async (strategyIds: string[]) => {
    if (strategyIds.length < 2 || strategyIds.length > 4) return;

    setState('generating');
    setIsRegenerating(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/strategy/compare/generate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ strategyIds }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate comparison');
      }

      setComparison(data.comparison);
      setState('ready');
      setStaleReason(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setState('error');
    } finally {
      setIsRegenerating(false);
    }
  }, [companyId]);

  const applyComparison = useCallback(async () => {
    if (!comparison) return;

    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/strategy/compare/apply`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ comparisonId: comparison.id }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to apply comparison');
      }

      // Update local state
      setComparison(prev => prev ? { ...prev, status: 'applied' } : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [companyId, comparison]);

  return {
    state,
    comparison,
    selectedIds,
    setSelectedIds,
    error,
    staleReason,
    isRegenerating,
    checkComparison,
    generateComparison,
    applyComparison,
  };
}

// ============================================================================
// Sub-Components
// ============================================================================

function StrategySelector({
  strategies,
  selectedIds,
  onSelectionChange,
  disabled,
}: {
  strategies: CompanyStrategy[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  disabled: boolean;
}) {
  const toggleStrategy = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter(s => s !== id));
    } else if (selectedIds.length < 4) {
      onSelectionChange([...selectedIds, id]);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-300">Select Strategies to Compare</h3>
        <span className="text-xs text-gray-500">
          {selectedIds.length}/4 selected (min 2)
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {strategies.map(strategy => {
          const isSelected = selectedIds.includes(strategy.id);
          return (
            <button
              key={strategy.id}
              onClick={() => toggleStrategy(strategy.id)}
              disabled={disabled || (!isSelected && selectedIds.length >= 4)}
              className={`
                p-3 rounded-lg border text-left transition-colors
                ${isSelected
                  ? 'border-purple-500 bg-purple-500/10 text-purple-200'
                  : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <div className="flex items-start justify-between">
                <span className="text-sm font-medium line-clamp-2">
                  {strategy.title}
                </span>
                {strategy.isActive && (
                  <span className="px-1.5 py-0.5 text-xs bg-green-500/20 text-green-400 rounded">
                    Active
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-500 mt-1 block">
                {strategy.status}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StalenessBanner({
  reason,
  onRegenerate,
  isRegenerating,
}: {
  reason: string;
  onRegenerate: () => void;
  isRegenerating: boolean;
}) {
  return (
    <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          <div>
            <p className="text-amber-200 font-medium">Comparison may be outdated</p>
            <p className="text-amber-300/60 text-sm">{reason}</p>
          </div>
        </div>
        <button
          onClick={onRegenerate}
          disabled={isRegenerating}
          className="px-3 py-1.5 bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 rounded-lg text-sm flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isRegenerating ? 'animate-spin' : ''}`} />
          Regenerate
        </button>
      </div>
    </div>
  );
}

function ObjectiveCoverageGrid({ comparison }: { comparison: StrategyComparison }) {
  if (!comparison.objectiveCoverage.length) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No objectives to compare against</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-700">
            <th className="text-left py-2 px-3 text-gray-400 font-medium">Objective</th>
            {comparison.strategyIds.map(id => (
              <th key={id} className="text-center py-2 px-3 text-gray-400 font-medium">
                {comparison.strategyTitles[id] || id}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {comparison.objectiveCoverage.map((item, i) => (
            <tr key={i} className="border-b border-gray-800">
              <td className="py-3 px-3">
                <p className="text-gray-200 text-sm">{item.objectiveText || item.objectiveId}</p>
                {item.notes && (
                  <p className="text-gray-500 text-xs mt-1">{item.notes}</p>
                )}
              </td>
              {comparison.strategyIds.map(strategyId => {
                const score = item.perStrategyScore[strategyId] ?? 0;
                const color = score >= 0.7 ? 'text-green-400' : score >= 0.4 ? 'text-yellow-400' : 'text-red-400';
                const bgColor = score >= 0.7 ? 'bg-green-500/20' : score >= 0.4 ? 'bg-yellow-500/20' : 'bg-red-500/20';
                return (
                  <td key={strategyId} className="text-center py-3 px-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded ${bgColor} ${color}`}>
                      {Math.round(score * 100)}%
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DecisionMatrixView({ comparison }: { comparison: StrategyComparison }) {
  const dimensionLabels: Record<ComparisonDimension, string> = {
    alignment: 'Objective Alignment',
    feasibility: 'Feasibility',
    differentiation: 'Differentiation',
    speed: 'Speed to Results',
    risk: 'Risk (lower = riskier)',
    cost: 'Cost (lower = costlier)',
    confidence: 'Confidence',
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-700">
            <th className="text-left py-2 px-3 text-gray-400 font-medium">Dimension</th>
            {comparison.strategyIds.map(id => (
              <th key={id} className="text-center py-2 px-3 text-gray-400 font-medium min-w-[100px]">
                {comparison.strategyTitles[id] || id}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {comparison.decisionMatrix.map((row, i) => (
            <tr key={i} className="border-b border-gray-800">
              <td className="py-3 px-3">
                <p className="text-gray-200">{dimensionLabels[row.dimension] || row.dimension}</p>
                {row.explanation && (
                  <p className="text-gray-500 text-xs mt-1 line-clamp-2">{row.explanation}</p>
                )}
              </td>
              {comparison.strategyIds.map(strategyId => {
                const score = row.perStrategyScore[strategyId] ?? 0;
                const barWidth = `${score * 100}%`;
                const color = score >= 0.7 ? 'bg-green-500' : score >= 0.4 ? 'bg-yellow-500' : 'bg-red-500';
                return (
                  <td key={strategyId} className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div className={`h-full ${color}`} style={{ width: barWidth }} />
                      </div>
                      <span className="text-xs text-gray-400 w-8 text-right">
                        {Math.round(score * 100)}
                      </span>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProsConsCards({ comparison }: { comparison: StrategyComparison }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {comparison.strategyIds.map(strategyId => {
        const prosCons = comparison.prosCons[strategyId] || { pros: [], cons: [] };
        return (
          <div key={strategyId} className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-700">
              <h4 className="text-sm font-medium text-gray-200 truncate">
                {comparison.strategyTitles[strategyId] || strategyId}
              </h4>
            </div>
            <div className="p-4 space-y-4">
              {/* Pros */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <ThumbsUp className="w-4 h-4 text-green-400" />
                  <span className="text-xs font-medium text-green-400">Pros</span>
                </div>
                {prosCons.pros.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">No pros identified</p>
                ) : (
                  <ul className="space-y-1">
                    {prosCons.pros.map((pro, i) => (
                      <li key={i} className="text-xs text-gray-300">
                        <span className={`inline-block w-1.5 h-1.5 rounded-full mr-2 ${
                          pro.significance === 'major' ? 'bg-green-400' :
                          pro.significance === 'moderate' ? 'bg-green-500/60' : 'bg-green-600/40'
                        }`} />
                        {pro.text}
                        {pro.citation && (
                          <span className="block text-gray-500 text-xs mt-0.5 ml-3.5">
                            {pro.citation}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {/* Cons */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <ThumbsDown className="w-4 h-4 text-red-400" />
                  <span className="text-xs font-medium text-red-400">Cons</span>
                </div>
                {prosCons.cons.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">No cons identified</p>
                ) : (
                  <ul className="space-y-1">
                    {prosCons.cons.map((con, i) => (
                      <li key={i} className="text-xs text-gray-300">
                        <span className={`inline-block w-1.5 h-1.5 rounded-full mr-2 ${
                          con.significance === 'major' ? 'bg-red-400' :
                          con.significance === 'moderate' ? 'bg-red-500/60' : 'bg-red-600/40'
                        }`} />
                        {con.text}
                        {con.citation && (
                          <span className="block text-gray-500 text-xs mt-0.5 ml-3.5">
                            {con.citation}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TradeoffsView({ comparison }: { comparison: StrategyComparison }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {comparison.strategyIds.map(strategyId => {
        const tradeoffs = comparison.tradeoffs[strategyId] || {
          optimizesFor: [],
          sacrifices: [],
          assumptions: [],
        };
        return (
          <div key={strategyId} className="bg-gray-800/50 rounded-lg border border-gray-700 p-4 space-y-3">
            <h4 className="text-sm font-medium text-gray-200 truncate">
              {comparison.strategyTitles[strategyId] || strategyId}
            </h4>

            {tradeoffs.optimizesFor.length > 0 && (
              <div>
                <p className="text-xs font-medium text-green-400 mb-1">Optimizes For</p>
                <ul className="space-y-0.5">
                  {tradeoffs.optimizesFor.map((item, i) => (
                    <li key={i} className="text-xs text-gray-300 flex items-start gap-1.5">
                      <CheckCircle className="w-3 h-3 text-green-400 mt-0.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {tradeoffs.sacrifices.length > 0 && (
              <div>
                <p className="text-xs font-medium text-amber-400 mb-1">Sacrifices</p>
                <ul className="space-y-0.5">
                  {tradeoffs.sacrifices.map((item, i) => (
                    <li key={i} className="text-xs text-gray-300 flex items-start gap-1.5">
                      <AlertTriangle className="w-3 h-3 text-amber-400 mt-0.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {tradeoffs.assumptions.length > 0 && (
              <div>
                <p className="text-xs font-medium text-blue-400 mb-1">Assumptions</p>
                <ul className="space-y-0.5">
                  {tradeoffs.assumptions.map((item, i) => (
                    <li key={i} className="text-xs text-gray-400 flex items-start gap-1.5">
                      <Lightbulb className="w-3 h-3 text-blue-400 mt-0.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RisksView({ comparison }: { comparison: StrategyComparison }) {
  const severityColors = {
    low: 'bg-gray-500/20 text-gray-400',
    medium: 'bg-yellow-500/20 text-yellow-400',
    high: 'bg-orange-500/20 text-orange-400',
    critical: 'bg-red-500/20 text-red-400',
  };

  return (
    <div className="space-y-4">
      {comparison.strategyIds.map(strategyId => {
        const risks = comparison.risks[strategyId] || [];
        if (risks.length === 0) return null;

        return (
          <div key={strategyId} className="bg-gray-800/50 rounded-lg border border-gray-700 p-4">
            <h4 className="text-sm font-medium text-gray-200 mb-3">
              {comparison.strategyTitles[strategyId] || strategyId}
            </h4>
            <div className="space-y-3">
              {risks.map((risk, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Shield className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm text-gray-200">{risk.risk}</span>
                      <span className={`px-1.5 py-0.5 text-xs rounded ${severityColors[risk.severity]}`}>
                        {risk.severity}
                      </span>
                      <span className="text-xs text-gray-500">
                        ({risk.likelihood})
                      </span>
                    </div>
                    {risk.mitigation && (
                      <p className="text-xs text-gray-400">
                        <span className="text-gray-500">Mitigation:</span> {risk.mitigation}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Strategic Frame Diff View
// ============================================================================

interface FrameField {
  label: string;
  key: 'audience' | 'offering' | 'valueProp' | 'positioning' | 'constraints';
}

const FRAME_FIELDS: FrameField[] = [
  { label: 'Target Audience', key: 'audience' },
  { label: 'Primary Offering', key: 'offering' },
  { label: 'Value Proposition', key: 'valueProp' },
  { label: 'Market Positioning', key: 'positioning' },
  { label: 'Constraints', key: 'constraints' },
];

function StrategicFrameDiffView({
  comparison,
  strategies,
}: {
  comparison: StrategyComparison;
  strategies: CompanyStrategy[];
}) {
  // Build a map of strategy frames
  const framesByStrategy: Record<string, Record<string, string>> = {};

  for (const strategy of strategies) {
    if (comparison.strategyIds.includes(strategy.id)) {
      const frame = strategy.strategyFrame || {};
      framesByStrategy[strategy.id] = {
        audience: frame.audience || frame.targetAudience || '',
        offering: frame.offering || frame.primaryOffering || '',
        valueProp: frame.valueProp || frame.valueProposition || '',
        positioning: frame.positioning || '',
        constraints: frame.constraints || '',
      };
    }
  }

  // Check if values differ across strategies
  const hasDifference = (fieldKey: string): boolean => {
    const values = comparison.strategyIds.map(id => framesByStrategy[id]?.[fieldKey] || '');
    const nonEmpty = values.filter(v => v.trim());
    if (nonEmpty.length <= 1) return false;
    return new Set(nonEmpty).size > 1;
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 mb-4">
        Compare how each strategy frames its approach to the market.
      </p>

      {FRAME_FIELDS.map(({ label, key }) => {
        const isDifferent = hasDifference(key);

        return (
          <div key={key} className="border border-gray-700 rounded-lg overflow-hidden">
            <div className={`px-4 py-2 ${isDifferent ? 'bg-amber-900/20 border-b border-amber-700/30' : 'bg-gray-800/50 border-b border-gray-700'}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-200">{label}</span>
                {isDifferent && (
                  <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded">
                    Differs
                  </span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-gray-700">
              {comparison.strategyIds.map(strategyId => {
                const value = framesByStrategy[strategyId]?.[key] || '';
                return (
                  <div key={strategyId} className="p-3">
                    <p className="text-xs text-gray-500 mb-1 truncate">
                      {comparison.strategyTitles[strategyId] || strategyId}
                    </p>
                    <p className={`text-sm ${value ? 'text-gray-200' : 'text-gray-500 italic'}`}>
                      {value || 'Not defined'}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Tactics Summary View
// ============================================================================

function TacticsSummaryView({
  comparison,
  strategies,
}: {
  comparison: StrategyComparison;
  strategies: CompanyStrategy[];
}) {
  // Build tactics stats per strategy
  const tacticsStats: Record<string, {
    total: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
  }> = {};

  for (const strategy of strategies) {
    if (comparison.strategyIds.includes(strategy.id)) {
      const plays = strategy.plays || [];
      const byStatus: Record<string, number> = {};
      const byPriority: Record<string, number> = {};

      for (const play of plays) {
        // Count by status
        const status = play.status || 'proposed';
        byStatus[status] = (byStatus[status] || 0) + 1;

        // Count by priority (if available via priorityId)
        // priorityId links to a priority, use 'linked' or 'unlinked' for grouping
        const priority = play.priorityId ? 'linked' : 'unlinked';
        byPriority[priority] = (byPriority[priority] || 0) + 1;
      }

      tacticsStats[strategy.id] = {
        total: plays.length,
        byStatus,
        byPriority,
      };
    }
  }

  // Canonical status labels and colors
  const statusConfig: Record<string, { label: string; colors: string }> = {
    proposed: { label: 'Draft', colors: 'bg-amber-500/20 text-amber-400' },
    draft: { label: 'Draft', colors: 'bg-amber-500/20 text-amber-400' },
    active: { label: 'Applied', colors: 'bg-emerald-500/20 text-emerald-400' },
    applied: { label: 'Applied', colors: 'bg-emerald-500/20 text-emerald-400' },
    proven: { label: 'Proven', colors: 'bg-purple-500/20 text-purple-400' },
    paused: { label: 'Paused', colors: 'bg-gray-500/20 text-gray-400' },
    archived: { label: 'Archived', colors: 'bg-gray-500/20 text-gray-400' },
  };

  const priorityColors: Record<string, string> = {
    high: 'bg-red-500/20 text-red-400',
    medium: 'bg-amber-500/20 text-amber-400',
    low: 'bg-gray-500/20 text-gray-400',
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 mb-4">
        Compare tactical execution plans across strategies.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {comparison.strategyIds.map(strategyId => {
          const stats = tacticsStats[strategyId] || { total: 0, byStatus: {}, byPriority: {} };

          return (
            <div key={strategyId} className="bg-gray-800/50 rounded-lg border border-gray-700 p-4">
              <h4 className="text-sm font-medium text-gray-200 mb-3 truncate">
                {comparison.strategyTitles[strategyId] || strategyId}
              </h4>

              {/* Total Count */}
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-700">
                <span className="text-xs text-gray-400">Total Tactics</span>
                <span className="text-2xl font-semibold text-gray-100">{stats.total}</span>
              </div>

              {/* By Status */}
              {Object.keys(stats.byStatus).length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-gray-500 mb-2">By Status</p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(stats.byStatus).map(([status, count]) => {
                      const config = statusConfig[status] || { label: status, colors: 'bg-gray-500/20 text-gray-400' };
                      return (
                        <span
                          key={status}
                          className={`px-2 py-0.5 text-xs rounded ${config.colors}`}
                        >
                          {config.label}: {count}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* By Priority */}
              {Object.keys(stats.byPriority).length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-2">By Priority</p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(stats.byPriority).map(([priority, count]) => (
                      <span
                        key={priority}
                        className={`px-2 py-0.5 text-xs rounded ${priorityColors[priority] || 'bg-gray-500/20 text-gray-400'}`}
                      >
                        {priority}: {count}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {stats.total === 0 && (
                <p className="text-xs text-gray-500 italic">No tactics defined</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RecommendationPanel({
  comparison,
  onSetActive,
  isSettingActive,
  currentActiveId,
}: {
  comparison: StrategyComparison;
  onSetActive: (strategyId: string) => void;
  isSettingActive: boolean;
  currentActiveId: string | null;
}) {
  const rec = comparison.recommendation;

  return (
    <div className="bg-purple-900/20 border border-purple-700/50 rounded-lg p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/20 rounded-lg">
            <Sparkles className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-purple-200">AI Recommendation</h3>
            <p className="text-sm text-purple-300/60">
              Confidence: {comparison.confidence}
            </p>
          </div>
        </div>
        {rec.recommendedStrategyId && rec.recommendedStrategyId !== currentActiveId && (
          <button
            onClick={() => onSetActive(rec.recommendedStrategyId)}
            disabled={isSettingActive}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm flex items-center gap-2 disabled:opacity-50"
          >
            {isSettingActive ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            Set as Active
          </button>
        )}
      </div>

      <div className="space-y-4">
        {/* Primary recommendation */}
        <div className="p-4 bg-purple-500/10 rounded-lg">
          <p className="text-sm text-purple-200 font-medium mb-2">
            Recommended: {comparison.strategyTitles[rec.recommendedStrategyId] || 'Unknown'}
          </p>
          {rec.rationale.length > 0 && (
            <ul className="space-y-1">
              {rec.rationale.map((r, i) => (
                <li key={i} className="text-sm text-purple-300/80 flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                  {r}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Conditional recommendations */}
        {rec.ifThenNotes.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-400 mb-2">Conditional Recommendations</p>
            <ul className="space-y-2">
              {rec.ifThenNotes.map((note, i) => (
                <li key={i} className="text-sm text-gray-300 p-3 bg-gray-800/50 rounded-lg">
                  {note}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Caveats */}
        {rec.caveats.length > 0 && (
          <div className="p-3 bg-amber-900/20 border border-amber-700/30 rounded-lg">
            <p className="text-xs font-medium text-amber-400 mb-1">Important Caveats</p>
            <ul className="space-y-1">
              {rec.caveats.map((caveat, i) => (
                <li key={i} className="text-xs text-amber-200/80">• {caveat}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function StrategyComparisonClient({
  companyId,
  companyName,
  strategies,
  activeStrategyId,
}: StrategyComparisonClientProps) {
  const router = useRouter();
  const [isSettingActive, setIsSettingActive] = useState(false);
  const [activeTab, setActiveTab] = useState<ComparisonTab>('coverage');

  const {
    state,
    comparison,
    selectedIds,
    setSelectedIds,
    error,
    staleReason,
    isRegenerating,
    checkComparison,
    generateComparison,
    applyComparison,
  } = useStrategyComparison(companyId);

  // Check for existing comparison when selection changes
  useEffect(() => {
    if (selectedIds.length >= 2) {
      checkComparison(selectedIds);
    }
  }, [selectedIds, checkComparison]);

  const handleSetActive = async (strategyId: string) => {
    setIsSettingActive(true);
    try {
      const response = await fetch(`/api/os/companies/${companyId}/strategy/set-active`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategyId }),
      });

      if (!response.ok) {
        throw new Error('Failed to set active strategy');
      }

      // Refresh the page to show updated state
      router.refresh();
    } catch (err) {
      console.error('Failed to set active strategy:', err);
    } finally {
      setIsSettingActive(false);
    }
  };

  const canGenerate = selectedIds.length >= 2 && selectedIds.length <= 4;
  const isWorking = state === 'loading' || state === 'generating';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">Strategy Comparison</h1>
          <p className="text-sm text-gray-400 mt-1">{companyName}</p>
        </div>
        <div className="flex items-center gap-2">
          <Scale className="w-5 h-5 text-purple-400" />
          <span className="text-sm text-gray-400">
            Compare up to 4 strategies side-by-side
          </span>
        </div>
      </div>

      {/* Strategy Selector */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
        <StrategySelector
          strategies={strategies}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          disabled={isWorking}
        />

        {/* Generate Button */}
        <div className="mt-4 flex items-center justify-between">
          <div>
            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}
          </div>
          <button
            onClick={() => generateComparison(selectedIds)}
            disabled={!canGenerate || isWorking}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {state === 'generating' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Comparison
              </>
            )}
          </button>
        </div>
      </div>

      {/* Staleness Banner */}
      {state === 'stale' && staleReason && (
        <StalenessBanner
          reason={staleReason}
          onRegenerate={() => generateComparison(selectedIds)}
          isRegenerating={isRegenerating}
        />
      )}

      {/* Loading State */}
      {state === 'loading' && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        </div>
      )}

      {/* Comparison Results */}
      {comparison && (state === 'ready' || state === 'stale') && (
        <div className="space-y-6">
          {/* Recommendation Panel */}
          <RecommendationPanel
            comparison={comparison}
            onSetActive={handleSetActive}
            isSettingActive={isSettingActive}
            currentActiveId={activeStrategyId}
          />

          {/* Tabs - ordered by practical usefulness */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="flex border-b border-gray-800 overflow-x-auto">
              {[
                { id: 'coverage' as const, label: 'Objectives', icon: Target },
                { id: 'frame' as const, label: 'Frame', icon: Users },
                { id: 'tradeoffs' as const, label: 'Tradeoffs', icon: ArrowRight },
                { id: 'tactics' as const, label: 'Tactics', icon: Zap },
                { id: 'matrix' as const, label: 'Matrix', icon: Scale },
                { id: 'proscons' as const, label: 'Pros/Cons', icon: ThumbsUp },
                { id: 'risks' as const, label: 'Risks', icon: Shield },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex-1 min-w-[80px] px-3 py-3 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors
                    ${activeTab === tab.id
                      ? 'text-purple-400 bg-purple-500/10 border-b-2 border-purple-500'
                      : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800/50'
                    }
                  `}
                >
                  <tab.icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>

            <div className="p-4">
              {activeTab === 'coverage' && <ObjectiveCoverageGrid comparison={comparison} />}
              {activeTab === 'frame' && <StrategicFrameDiffView comparison={comparison} strategies={strategies} />}
              {activeTab === 'matrix' && <DecisionMatrixView comparison={comparison} />}
              {activeTab === 'proscons' && <ProsConsCards comparison={comparison} />}
              {activeTab === 'tradeoffs' && <TradeoffsView comparison={comparison} />}
              {activeTab === 'tactics' && <TacticsSummaryView comparison={comparison} strategies={strategies} />}
              {activeTab === 'risks' && <RisksView comparison={comparison} />}
            </div>
          </div>

          {/* Apply/Status Footer */}
          <div className="flex items-center justify-between bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div className="flex items-center gap-3">
              {comparison.status === 'draft' && (
                <span className="px-2 py-1 bg-amber-500/20 text-amber-400 text-xs rounded">
                  Draft
                </span>
              )}
              {comparison.status === 'applied' && (
                <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">
                  Applied
                </span>
              )}
              <span className="text-xs text-gray-500">
                Generated {new Date(comparison.createdAt).toLocaleString()}
              </span>
            </div>
            {comparison.status === 'draft' && (
              <button
                onClick={applyComparison}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Apply Comparison
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
