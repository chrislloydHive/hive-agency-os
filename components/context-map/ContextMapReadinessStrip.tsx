// components/context-map/ContextMapReadinessStrip.tsx
// Compact top bar showing strategy/program readiness status

'use client';

import { AlertTriangle, CheckCircle2, XCircle, ChevronRight } from 'lucide-react';
import type { StrategyReadinessResult } from '@/lib/types/context';

interface ContextMapReadinessStripProps {
  /** Strategy readiness calculated from context */
  strategyReadiness: StrategyReadinessResult;
  /** Optional program readiness status */
  programReadiness?: {
    status: 'ready' | 'blocked' | 'needs_info';
    missingFields: string[];
  };
  /** Called when "Fix" is clicked */
  onFixClick: (type: 'strategy' | 'program') => void;
}

/**
 * Get the appropriate icon for a status
 */
function getStatusIcon(status: string) {
  switch (status) {
    case 'ready':
      return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
    case 'blocked':
      return <XCircle className="w-3.5 h-3.5 text-red-400" />;
    default:
      return <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />;
  }
}

/**
 * Get the display label for a status
 */
function getStatusLabel(status: string): string {
  switch (status) {
    case 'ready':
      return 'Ready';
    case 'blocked':
      return 'Blocked';
    default:
      return 'Needs Info';
  }
}

/**
 * Get the CSS classes for a status badge
 */
function getStatusColor(status: string): string {
  switch (status) {
    case 'ready':
      return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
    case 'blocked':
      return 'text-red-400 bg-red-400/10 border-red-400/20';
    default:
      return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
  }
}

export function ContextMapReadinessStrip({
  strategyReadiness,
  programReadiness,
  onFixClick,
}: ContextMapReadinessStripProps) {
  const showStrategyFix = strategyReadiness.status !== 'ready';
  const showProgramFix = programReadiness && programReadiness.status !== 'ready';

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-slate-900/60 border-b border-slate-800">
      {/* Strategy Readiness */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">Strategy:</span>
        <div
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded border ${getStatusColor(
            strategyReadiness.status
          )}`}
        >
          {getStatusIcon(strategyReadiness.status)}
          {getStatusLabel(strategyReadiness.status)}
        </div>
        {showStrategyFix && (
          <button
            onClick={() => onFixClick('strategy')}
            className="inline-flex items-center gap-0.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            Fix
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-slate-700" />

      {/* Program Readiness (optional) */}
      {programReadiness && (
        <>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Program:</span>
            <div
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded border ${getStatusColor(
                programReadiness.status
              )}`}
            >
              {getStatusIcon(programReadiness.status)}
              {getStatusLabel(programReadiness.status)}
            </div>
            {showProgramFix && (
              <button
                onClick={() => onFixClick('program')}
                className="inline-flex items-center gap-0.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                Fix
                <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Divider */}
          <div className="w-px h-4 bg-slate-700" />
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Completeness indicator */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">Context:</span>
        <div className="flex items-center gap-1.5">
          <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                strategyReadiness.completenessScore >= 80
                  ? 'bg-emerald-500'
                  : strategyReadiness.completenessScore >= 50
                    ? 'bg-amber-500'
                    : 'bg-red-500'
              }`}
              style={{ width: `${strategyReadiness.completenessScore}%` }}
            />
          </div>
          <span className="text-xs text-slate-400 tabular-nums">
            {strategyReadiness.completenessScore}%
          </span>
        </div>
      </div>

      {/* Missing fields - show names with fix action */}
      {strategyReadiness.missingCritical.length > 0 && (
        <>
          <div className="w-px h-4 bg-slate-700" />
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">Blocked by:</span>
            <div className="flex items-center gap-1.5">
              {strategyReadiness.missingCritical.slice(0, 3).map((field) => (
                <span
                  key={field}
                  className="inline-flex items-center px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded text-[11px]"
                >
                  {field}
                </span>
              ))}
              {strategyReadiness.missingCritical.length > 3 && (
                <span className="text-slate-500">
                  +{strategyReadiness.missingCritical.length - 3} more
                </span>
              )}
            </div>
            <button
              onClick={() => onFixClick('strategy')}
              className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium rounded transition-colors"
            >
              Fix
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </>
      )}

      {/* Recommended fields count (if any) */}
      {strategyReadiness.missingRecommended.length > 0 && strategyReadiness.missingCritical.length === 0 && (
        <>
          <div className="w-px h-4 bg-slate-700" />
          <span className="text-xs text-amber-400/70">
            {strategyReadiness.missingRecommended.length} recommended fields
          </span>
        </>
      )}
    </div>
  );
}
