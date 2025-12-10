'use client';

// components/plan/PlanSnapshot.tsx
// Plan Snapshot strip showing summary stats and AI synthesis CTA
//
// Displays:
// - Total open findings
// - Counts by severity (Critical, High, Medium, Low)
// - Recent additions indicator
// - AI Synthesize button

import { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Loader2,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import type { FindingsSummary } from '@/lib/os/findings/companyFindings';

// ============================================================================
// Types
// ============================================================================

interface PlanSnapshotProps {
  summary: FindingsSummary | null;
  loading: boolean;
  onSynthesize: () => Promise<void>;
  isSynthesizing?: boolean;
  hasFindings?: boolean;
}

// ============================================================================
// Severity Stats
// ============================================================================

const severityConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  critical: { icon: AlertCircle, color: 'text-red-400 bg-red-500/20', label: 'Critical' },
  high: { icon: AlertTriangle, color: 'text-orange-400 bg-orange-500/20', label: 'High' },
  medium: { icon: TrendingUp, color: 'text-yellow-400 bg-yellow-500/20', label: 'Medium' },
  low: { icon: TrendingUp, color: 'text-slate-400 bg-slate-500/20', label: 'Low' },
};

// ============================================================================
// Main Component
// ============================================================================

export function PlanSnapshot({
  summary,
  loading,
  onSynthesize,
  isSynthesizing = false,
  hasFindings = true,
}: PlanSnapshotProps) {
  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 animate-pulse">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-8">
            <div className="h-12 w-24 bg-slate-800 rounded" />
            <div className="h-8 w-px bg-slate-800" />
            <div className="flex gap-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-10 w-20 bg-slate-800 rounded" />
              ))}
            </div>
          </div>
          <div className="h-10 w-36 bg-slate-800 rounded" />
        </div>
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  const severities = ['critical', 'high', 'medium', 'low'];
  const totalUrgent = (summary.bySeverity['critical'] || 0) + (summary.bySeverity['high'] || 0);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left Side: Stats */}
        <div className="flex flex-wrap items-center gap-6">
          {/* Total Findings */}
          <div className="flex flex-col">
            <span className="text-3xl font-bold text-white tabular-nums">
              {summary.unconverted}
            </span>
            <span className="text-xs text-slate-400 uppercase tracking-wide">
              Open Findings
            </span>
          </div>

          {/* Divider */}
          <div className="h-12 w-px bg-slate-800 hidden sm:block" />

          {/* Severity Breakdown */}
          <div className="flex flex-wrap gap-2">
            {severities.map(severity => {
              const count = summary.bySeverity[severity] || 0;
              if (count === 0) return null;
              const config = severityConfig[severity];
              const Icon = config.icon;
              return (
                <div
                  key={severity}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg ${config.color}`}
                >
                  <Icon className="w-4 h-4" />
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold tabular-nums">{count}</span>
                    <span className="text-[10px] uppercase tracking-wide opacity-80">
                      {config.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Divider */}
          {summary.converted > 0 && (
            <>
              <div className="h-12 w-px bg-slate-800 hidden lg:block" />
              <div className="flex items-center gap-1.5 text-sm text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                {summary.converted} in Work
              </div>
            </>
          )}
        </div>

        {/* Right Side: Actions */}
        <div className="flex items-center gap-3">
          {totalUrgent > 0 && (
            <span className="text-sm text-orange-400 mr-2">
              {totalUrgent} urgent finding{totalUrgent !== 1 ? 's' : ''}
            </span>
          )}
          <button
            onClick={onSynthesize}
            disabled={isSynthesizing || !hasFindings}
            title={!hasFindings ? 'Run diagnostics first to generate findings' : undefined}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/20"
          >
            {isSynthesizing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Synthesizing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                AI Synthesize Plan
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PlanSnapshot;
