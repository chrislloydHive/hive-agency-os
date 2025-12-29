'use client';

// components/os/strategy/StrategyInsightsPanel.tsx
// Strategy Insights Panel - Deterministic insights & next-best actions
//
// Design principle: No AI interpretation. All insights are rule-based.
// Shows wins, risks, drivers, patterns, and recommended actions.

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Lightbulb,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Target,
  Zap,
  BarChart3,
  ArrowRight,
  Eye,
  Info,
  Trophy,
  ShieldAlert,
  Compass,
} from 'lucide-react';
import type {
  StrategyInsight,
  StrategyInsightsResult,
  InsightCategory,
  RecommendedAction,
  DriverLeaderboardEntry,
  DetectedPattern,
  InsightsCoverage,
} from '@/lib/types/strategyInsights';
import {
  getInsightCategoryColorClass,
  getInsightCategoryLabel,
  getActionTypeLabel,
  getExpectedImpactColorClass,
  getExpectedImpactLabel,
  formatInsightConfidence,
  getInsightConfidenceColorClass,
  INSIGHT_CATEGORY_COLORS,
} from '@/lib/types/strategyInsights';
import { DEFAULT_ATTRIBUTION_WINDOW } from '@/lib/types/strategyAttribution';

// ============================================================================
// Types
// ============================================================================

interface StrategyInsightsPanelProps {
  companyId: string;
  strategyId: string;
  /** Whether panel starts collapsed */
  defaultCollapsed?: boolean;
  /** Callback when user clicks to view an evolution event */
  onViewEvent?: (eventId: string) => void;
}

// ============================================================================
// Module-Level Cache
// ============================================================================

interface InsightsCacheEntry {
  data: StrategyInsightsResult;
  fetchedAt: number;
}

const insightsCache = new Map<string, InsightsCacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCacheKey(companyId: string, strategyId: string, preDays: number, postDays: number): string {
  return `${companyId}|${strategyId}|${preDays}|${postDays}`;
}

function getCachedInsights(key: string): StrategyInsightsResult | null {
  const entry = insightsCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    insightsCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCachedInsights(key: string, data: StrategyInsightsResult): void {
  insightsCache.set(key, { data, fetchedAt: Date.now() });
}

// ============================================================================
// Main Component
// ============================================================================

export function StrategyInsightsPanel({
  companyId,
  strategyId,
  defaultCollapsed = true,
  onViewEvent,
}: StrategyInsightsPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [data, setData] = useState<StrategyInsightsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  // Fetch insights
  const fetchInsights = useCallback(async (signal?: AbortSignal) => {
    const preDays = DEFAULT_ATTRIBUTION_WINDOW.preDays;
    const postDays = DEFAULT_ATTRIBUTION_WINDOW.postDays;
    const cacheKey = getCacheKey(companyId, strategyId, preDays, postDays);

    // Check cache first
    const cached = getCachedInsights(cacheKey);
    if (cached) {
      if (isMountedRef.current) {
        setData(cached);
      }
      return;
    }

    try {
      if (isMountedRef.current) {
        setLoading(true);
        setError(null);
      }

      const response = await fetch(
        `/api/os/companies/${companyId}/strategy/${strategyId}/insights?preDays=${preDays}&postDays=${postDays}`,
        { signal }
      );

      if (signal?.aborted || !isMountedRef.current) return;

      if (!response.ok) {
        throw new Error('Failed to fetch insights');
      }

      const result: StrategyInsightsResult = await response.json();

      if (!isMountedRef.current) return;

      // Update cache
      setCachedInsights(cacheKey, result);
      setData(result);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error('[StrategyInsightsPanel] Error:', err);
      if (isMountedRef.current) {
        setError('Failed to load insights');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [companyId, strategyId]);

  useEffect(() => {
    isMountedRef.current = true;
    const abortController = new AbortController();

    fetchInsights(abortController.signal);

    return () => {
      isMountedRef.current = false;
      abortController.abort();
    };
  }, [fetchInsights]);

  // Compute executive summary
  const executiveSummary = data ? computeExecutiveSummary(data) : null;

  // Filter insights by category
  const winInsights = data?.insights.filter((i) => i.category === 'wins') || [];
  const riskInsights = data?.insights.filter((i) => i.category === 'risks') || [];
  const driverInsights = data?.insights.filter((i) => i.category === 'drivers') || [];
  const hasInsights = data && data.insights.length > 0;

  return (
    <div className="bg-slate-900/30 border border-slate-800 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-amber-500/10 rounded-lg">
            <Lightbulb className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-medium text-white">Insights & Next Actions</h3>
            <p className="text-xs text-slate-500">
              {loading
                ? 'Analyzing...'
                : hasInsights
                ? `${data.insights.length} insight${data.insights.length !== 1 ? 's' : ''} • ${data.rollups.recommendedActions.length} action${data.rollups.recommendedActions.length !== 1 ? 's' : ''}`
                : 'No insights yet'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {loading && <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />}
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          )}
        </div>
      </button>

      {/* Content */}
      {!isCollapsed && (
        <div className="px-4 pb-4 border-t border-slate-800">
          {/* Error */}
          {error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-red-400">
                <AlertTriangle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && !data && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
            </div>
          )}

          {/* Empty state */}
          {!loading && !hasInsights && !error && (
            <div className="py-6 text-center">
              <Lightbulb className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-500">
                No insights available yet. Insights will appear as strategy evolves.
              </p>
            </div>
          )}

          {/* Insights content */}
          {data && hasInsights && (
            <div className="mt-4 space-y-6">
              {/* Executive Summary */}
              {executiveSummary && (
                <ExecutiveSummarySection summary={executiveSummary} />
              )}

              {/* Wins */}
              {winInsights.length > 0 && (
                <InsightSection
                  title="Wins"
                  icon={Trophy}
                  iconColorClass="text-emerald-400"
                  insights={winInsights}
                  onViewEvent={onViewEvent}
                />
              )}

              {/* Risks */}
              {riskInsights.length > 0 && (
                <InsightSection
                  title="Risks"
                  icon={ShieldAlert}
                  iconColorClass="text-red-400"
                  insights={riskInsights}
                  onViewEvent={onViewEvent}
                />
              )}

              {/* Driver Leaderboard */}
              {data.rollups.driverLeaderboard.length > 0 && (
                <DriverLeaderboardSection
                  drivers={data.rollups.driverLeaderboard}
                  onViewEvent={onViewEvent}
                />
              )}

              {/* Next Actions */}
              {data.rollups.recommendedActions.length > 0 && (
                <NextActionsSection
                  actions={data.rollups.recommendedActions}
                  onViewEvent={onViewEvent}
                />
              )}

              {/* Coverage footer */}
              <CoverageFooter coverage={data.rollups.coverage} window={data.window} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Executive Summary
// ============================================================================

interface ExecutiveSummaryData {
  biggestWin: string | null;
  biggestRisk: string | null;
  nextAction: string | null;
}

function computeExecutiveSummary(data: StrategyInsightsResult): ExecutiveSummaryData {
  const wins = data.insights.filter((i) => i.category === 'wins');
  const risks = data.insights.filter((i) => i.category === 'risks');
  const actions = data.rollups.recommendedActions;

  return {
    biggestWin: wins.length > 0 ? wins[0].title : null,
    biggestRisk: risks.length > 0 ? risks[0].title : null,
    nextAction: actions.length > 0 ? getActionTypeLabel(actions[0].actionType) : null,
  };
}

function ExecutiveSummarySection({ summary }: { summary: ExecutiveSummaryData }) {
  const bullets = [
    summary.biggestWin && { icon: TrendingUp, text: summary.biggestWin, color: 'text-emerald-400' },
    summary.biggestRisk && { icon: AlertTriangle, text: summary.biggestRisk, color: 'text-red-400' },
    summary.nextAction && { icon: Compass, text: `Next: ${summary.nextAction}`, color: 'text-blue-400' },
  ].filter(Boolean) as Array<{ icon: typeof TrendingUp; text: string; color: string }>;

  if (bullets.length === 0) return null;

  return (
    <div className="p-3 bg-slate-800/50 rounded-lg">
      <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Executive Summary</p>
      <div className="space-y-2">
        {bullets.map((bullet, idx) => (
          <div key={idx} className="flex items-start gap-2">
            <bullet.icon className={`w-4 h-4 mt-0.5 ${bullet.color}`} />
            <span className="text-sm text-slate-300">{bullet.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Insight Section
// ============================================================================

function InsightSection({
  title,
  icon: Icon,
  iconColorClass,
  insights,
  onViewEvent,
}: {
  title: string;
  icon: typeof Trophy;
  iconColorClass: string;
  insights: StrategyInsight[];
  onViewEvent?: (eventId: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-4 h-4 ${iconColorClass}`} />
        <p className="text-xs text-slate-500 uppercase tracking-wide">{title}</p>
        <span className="text-xs text-slate-600">({insights.length})</span>
      </div>
      <div className="space-y-2">
        {insights.slice(0, 3).map((insight) => (
          <InsightCard key={insight.id} insight={insight} onViewEvent={onViewEvent} />
        ))}
      </div>
    </div>
  );
}

function InsightCard({
  insight,
  onViewEvent,
}: {
  insight: StrategyInsight;
  onViewEvent?: (eventId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const DirectionIcon =
    insight.category === 'wins'
      ? TrendingUp
      : insight.category === 'risks'
      ? TrendingDown
      : Minus;

  return (
    <div className="p-3 bg-slate-800/30 border border-slate-700/50 rounded-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded border ${getInsightCategoryColorClass(insight.category)}`}>
              {getInsightCategoryLabel(insight.category)}
            </span>
            <span className={`text-[10px] ${getInsightConfidenceColorClass(insight.metrics.confidence)}`}>
              {formatInsightConfidence(insight.metrics.confidence)} confidence
            </span>
          </div>
          <h4 className="text-sm font-medium text-white">{insight.title}</h4>
          <p className="text-xs text-slate-400 mt-1">{insight.summary}</p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">
            {insight.metrics.avgAttributionScore.toFixed(0)}%
          </span>
          <DirectionIcon className={`w-4 h-4 ${
            insight.category === 'wins'
              ? 'text-emerald-400'
              : insight.category === 'risks'
              ? 'text-red-400'
              : 'text-slate-400'
          }`} />
        </div>
      </div>

      {/* Evidence links */}
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        {insight.evidence.eventIds.slice(0, 3).map((eventId, idx) => (
          <button
            key={eventId}
            onClick={() => onViewEvent?.(eventId)}
            className="text-[10px] text-blue-400 hover:text-blue-300 underline"
          >
            Event {idx + 1}
          </button>
        ))}
        {insight.evidence.eventIds.length > 3 && (
          <span className="text-[10px] text-slate-500">
            +{insight.evidence.eventIds.length - 3} more
          </span>
        )}
      </div>

      {/* Recommended action preview */}
      {insight.recommendedAction && (
        <div className="mt-2 pt-2 border-t border-slate-700/50">
          <div className="flex items-center gap-1 text-xs text-blue-400">
            <Zap className="w-3 h-3" />
            <span>{getActionTypeLabel(insight.recommendedAction.actionType)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Driver Leaderboard
// ============================================================================

function DriverLeaderboardSection({
  drivers,
  onViewEvent,
}: {
  drivers: DriverLeaderboardEntry[];
  onViewEvent?: (eventId: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-4 h-4 text-purple-400" />
        <p className="text-xs text-slate-500 uppercase tracking-wide">Driver Leaderboard</p>
      </div>
      <div className="space-y-1">
        {drivers.slice(0, 5).map((driver, idx) => (
          <DriverRow key={driver.label} driver={driver} rank={idx + 1} onViewEvent={onViewEvent} />
        ))}
      </div>
    </div>
  );
}

function DriverRow({
  driver,
  rank,
  onViewEvent,
}: {
  driver: DriverLeaderboardEntry;
  rank: number;
  onViewEvent?: (eventId: string) => void;
}) {
  const DirectionIcon =
    driver.predominantDirection === 'positive'
      ? TrendingUp
      : driver.predominantDirection === 'negative'
      ? TrendingDown
      : Minus;

  const directionColorClass =
    driver.predominantDirection === 'positive'
      ? 'text-emerald-400'
      : driver.predominantDirection === 'negative'
      ? 'text-red-400'
      : 'text-slate-400';

  // Calculate bar width (max 100%)
  const maxContribution = 200; // Reasonable max for display
  const barWidth = Math.min(100, (driver.totalContribution / maxContribution) * 100);

  return (
    <div className="flex items-center gap-3 p-2 bg-slate-800/30 rounded">
      <span className="text-xs text-slate-600 w-4">{rank}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-300 truncate">{driver.label}</span>
          <div className="flex items-center gap-2">
            <DirectionIcon className={`w-3 h-3 ${directionColorClass}`} />
            <span className="text-xs text-slate-400">{driver.totalContribution.toFixed(0)}</span>
          </div>
        </div>
        <div className="mt-1 h-1 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${
              driver.predominantDirection === 'positive'
                ? 'bg-emerald-500'
                : driver.predominantDirection === 'negative'
                ? 'bg-red-500'
                : 'bg-slate-500'
            }`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      </div>
      <span className="text-[10px] text-slate-500">{driver.eventCount} events</span>
    </div>
  );
}

// ============================================================================
// Next Actions
// ============================================================================

function NextActionsSection({
  actions,
  onViewEvent,
}: {
  actions: RecommendedAction[];
  onViewEvent?: (eventId: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-4 h-4 text-blue-400" />
        <p className="text-xs text-slate-500 uppercase tracking-wide">Next Actions</p>
        <span className="text-xs text-slate-600">({actions.length})</span>
      </div>
      <div className="space-y-2">
        {actions.slice(0, 3).map((action, idx) => (
          <ActionCard key={`${action.actionType}-${idx}`} action={action} onViewEvent={onViewEvent} />
        ))}
      </div>
    </div>
  );
}

function ActionCard({
  action,
  onViewEvent,
}: {
  action: RecommendedAction;
  onViewEvent?: (eventId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="p-3 bg-slate-800/30 border border-blue-500/20 rounded-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded border ${getExpectedImpactColorClass(action.expectedImpact)}`}>
              {getExpectedImpactLabel(action.expectedImpact)}
            </span>
            <span className={`text-[10px] ${getInsightConfidenceColorClass(action.confidence)}`}>
              {formatInsightConfidence(action.confidence)} confidence
            </span>
          </div>
          <h4 className="text-sm font-medium text-white">{getActionTypeLabel(action.actionType)}</h4>
          <p className="text-xs text-slate-400 mt-1">{action.why}</p>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 hover:bg-slate-700 rounded transition-colors"
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-3">
          {/* How */}
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">How</p>
            <ul className="space-y-1">
              {action.how.map((step, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                  <ArrowRight className="w-3 h-3 mt-0.5 text-slate-500" />
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Guardrails */}
          {action.guardrails.length > 0 && (
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Guardrails</p>
              <ul className="space-y-1">
                {action.guardrails.map((guardrail, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-amber-400/80">
                    <AlertTriangle className="w-3 h-3 mt-0.5" />
                    <span>{guardrail}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Evidence */}
          <div className="flex items-center gap-2 flex-wrap">
            {action.evidence.eventIds.slice(0, 3).map((eventId, idx) => (
              <button
                key={eventId}
                onClick={() => onViewEvent?.(eventId)}
                className="text-[10px] text-blue-400 hover:text-blue-300 underline"
              >
                Event {idx + 1}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Coverage Footer
// ============================================================================

function CoverageFooter({
  coverage,
  window,
}: {
  coverage: InsightsCoverage;
  window: { preDays: number; postDays: number };
}) {
  return (
    <div className="pt-3 border-t border-slate-800/50">
      <div className="flex items-center justify-between text-[10px] text-slate-600">
        <span>
          {coverage.eventsInInsights}/{coverage.totalEvents} events analyzed ({coverage.coveragePercent}% coverage)
        </span>
        <span>
          Window: {window.preDays}d pre / {window.postDays}d post
        </span>
      </div>
    </div>
  );
}

export default StrategyInsightsPanel;
