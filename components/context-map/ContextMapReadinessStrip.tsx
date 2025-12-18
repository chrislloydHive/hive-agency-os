// components/context-map/ContextMapReadinessStrip.tsx
// Compact top bar showing strategy/program readiness status
//
// TWO-LEVEL MESSAGING:
// 🔴 Context incomplete: [fields] - Hard blockers, blocks Labs/GAP execution
// 🟡 Context gaps detected: [fields] - Informational gaps, affects AI confidence only
//
// Context Map should ONLY block when:
// - Required factual domains are entirely empty (ICP, Offer, Business Model)
// Context Map should NOT block for:
// - Missing positioning (strategic conclusion)
// - Missing budget (optional context)
// - Missing competitors (informational)

'use client';

import { AlertTriangle, CheckCircle2, XCircle, ChevronRight, Info } from 'lucide-react';
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
  /** Called when a specific field badge is clicked (for direct edit navigation) */
  onFieldClick?: (fieldLabel: string, isCritical: boolean) => void;
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
  onFieldClick,
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

      {/* HARD BLOCKERS - Context incomplete (blocks Labs/GAP) */}
      {strategyReadiness.missingCritical.length > 0 && (
        <>
          <div className="w-px h-4 bg-slate-700" />
          <div className="flex items-center gap-2 text-xs">
            <span className="text-red-400 flex items-center gap-1">
              <XCircle className="w-3 h-3" />
              Context incomplete:
            </span>
            <div className="flex items-center gap-1.5">
              {strategyReadiness.missingCritical.slice(0, 3).map((field) => (
                <button
                  key={field}
                  onClick={() => onFieldClick?.(field, true)}
                  className="inline-flex items-center px-1.5 py-0.5 bg-red-500/20 text-red-400 hover:bg-red-500/30 hover:text-red-300 rounded text-[11px] transition-colors cursor-pointer"
                  title={`Click to edit "${field}"`}
                >
                  {field}
                </button>
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
              Fix All
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </>
      )}

      {/* SOFT GAPS - Context gaps detected (affects AI confidence, never blocks) */}
      {strategyReadiness.missingRecommended.length > 0 && (
        <>
          <div className="w-px h-4 bg-slate-700" />
          <div className="flex items-center gap-2 text-xs">
            <span className="text-amber-400 flex items-center gap-1">
              <Info className="w-3 h-3" />
              Context gaps:
            </span>
            <div className="flex items-center gap-1.5">
              {strategyReadiness.missingRecommended.slice(0, 2).map((field) => (
                <button
                  key={field}
                  onClick={() => onFieldClick?.(field, false)}
                  className="inline-flex items-center px-1.5 py-0.5 bg-amber-500/10 text-amber-400/80 hover:bg-amber-500/20 hover:text-amber-300 rounded text-[11px] transition-colors cursor-pointer"
                  title={`Click to edit "${field}"`}
                >
                  {field}
                </button>
              ))}
              {strategyReadiness.missingRecommended.length > 2 && (
                <span className="text-slate-500">
                  +{strategyReadiness.missingRecommended.length - 2} more
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
