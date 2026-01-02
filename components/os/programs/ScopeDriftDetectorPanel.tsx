'use client';

// components/os/programs/ScopeDriftDetectorPanel.tsx
// Scope Drift Detector Panel (Internal-only)
//
// Analyzes scope violation events from the last 30 days to detect:
// - Which programs have the most violations
// - Which violation types are most common
// - What recommended actions users are taking
//
// This is an internal analytics tool for identifying scope drift patterns.

import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Loader2,
  AlertCircle,
  TrendingUp,
  Target,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import type { ScopeViolationAggregate } from '@/lib/types/operationalEvent';

interface ScopeDriftDetectorPanelProps {
  companyId: string;
}

export function ScopeDriftDetectorPanel({ companyId }: ScopeDriftDetectorPanelProps) {
  const [aggregates, setAggregates] = useState<ScopeViolationAggregate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/os/companies/${companyId}/events?type=scope_violation&aggregated=true`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch scope violation data');
      }

      const data = await response.json();
      setAggregates(data.aggregates || []);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const totalViolations = aggregates.reduce((sum, agg) => sum + agg.count, 0);
  const uniquePrograms = new Set(aggregates.flatMap((agg) => agg.programIds)).size;

  if (loading && aggregates.length === 0) {
    return (
      <div className="p-4 bg-slate-900 border border-slate-700 rounded-xl">
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading scope drift analysis...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-slate-900 border border-slate-700 rounded-xl">
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">Failed to load: {error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10">
            <TrendingUp className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-white">Scope Drift Detector</h3>
            <p className="text-xs text-slate-500">Last 30 days · Internal only</p>
          </div>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="p-1.5 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3 p-4 bg-slate-800/30">
        <div className="p-3 bg-slate-800 rounded-lg">
          <div className="flex items-center gap-2 text-amber-400 mb-1">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-xl font-semibold">{totalViolations}</span>
          </div>
          <div className="text-xs text-slate-500">Total Violations</div>
        </div>
        <div className="p-3 bg-slate-800 rounded-lg">
          <div className="flex items-center gap-2 text-blue-400 mb-1">
            <Target className="w-4 h-4" />
            <span className="text-xl font-semibold">{uniquePrograms}</span>
          </div>
          <div className="text-xs text-slate-500">Affected Programs</div>
        </div>
      </div>

      {/* No violations */}
      {aggregates.length === 0 ? (
        <div className="p-4 text-center text-slate-500 text-sm">
          No scope violations in the last 30 days.
        </div>
      ) : (
        <>
          {/* Violation Breakdown */}
          <div className="p-4 border-t border-slate-700/50">
            <div className="text-xs text-slate-500 mb-2">Violation Types</div>
            <div className="space-y-2">
              {aggregates.map((agg) => (
                <ViolationTypeRow key={agg.code} aggregate={agg} total={totalViolations} />
              ))}
            </div>
          </div>

          {/* Top Recommended Actions */}
          {aggregates.some((agg) => agg.topRecommendedActions.length > 0) && (
            <div className="p-4 border-t border-slate-700/50">
              <div className="text-xs text-slate-500 mb-2">Top Recommended Actions</div>
              <div className="space-y-1">
                {getTopActions(aggregates).map(({ id, count }) => (
                  <div
                    key={id}
                    className="flex items-center justify-between p-2 bg-slate-800/50 rounded"
                  >
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                      <ArrowRight className="w-3 h-3 text-slate-500" />
                      <span>{formatActionId(id)}</span>
                    </div>
                    <span className="text-xs text-slate-500">{count}×</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Last Updated */}
      {lastUpdated && (
        <div className="p-2 border-t border-slate-700/50 text-xs text-slate-600 text-center">
          Updated {lastUpdated.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Violation Type Row
// ============================================================================

interface ViolationTypeRowProps {
  aggregate: ScopeViolationAggregate;
  total: number;
}

function ViolationTypeRow({ aggregate, total }: ViolationTypeRowProps) {
  const percentage = total > 0 ? Math.round((aggregate.count / total) * 100) : 0;

  return (
    <div className="p-2 bg-slate-800/50 rounded">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-white">{formatViolationCode(aggregate.code)}</span>
        <span className="text-xs text-slate-400">{aggregate.count} ({percentage}%)</span>
      </div>
      <div className="w-full bg-slate-700 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full ${
            aggregate.code === 'CONCURRENCY_LIMIT_REACHED'
              ? 'bg-red-500'
              : 'bg-amber-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="mt-1 text-xs text-slate-500">
        {aggregate.programIds.length} program{aggregate.programIds.length !== 1 && 's'} ·{' '}
        {aggregate.domains.filter(Boolean).length} domain{aggregate.domains.filter(Boolean).length !== 1 && 's'}
      </div>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function formatViolationCode(code: string): string {
  return code
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}

function formatActionId(id: string): string {
  return id
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
}

function getTopActions(
  aggregates: ScopeViolationAggregate[]
): Array<{ id: string; count: number }> {
  const actionCounts = new Map<string, number>();

  for (const agg of aggregates) {
    for (const action of agg.topRecommendedActions) {
      actionCounts.set(action.id, (actionCounts.get(action.id) || 0) + action.count);
    }
  }

  return Array.from(actionCounts.entries())
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

export default ScopeDriftDetectorPanel;
