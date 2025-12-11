'use client';

// components/qbr/QuarterChangesSection.tsx
// Quarter-over-quarter changes display

import { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  ChevronDown,
  ChevronUp,
  ArrowRight,
} from 'lucide-react';
import type { QuarterChangesSection as QuarterChangesSectionType } from './types';

interface QuarterChangesSectionProps {
  quarterChanges: QuarterChangesSectionType | null;
}

function ChangeCard({
  metric,
  previousValue,
  currentValue,
  delta,
  trend,
  significance,
  narrative,
}: {
  metric: string;
  previousValue: string | number | null;
  currentValue: string | number | null;
  delta: number | null;
  trend: 'up' | 'down' | 'flat' | 'new';
  significance: 'major' | 'minor' | 'neutral';
  narrative: string;
}) {
  const borderColor = {
    major: trend === 'up' ? 'border-emerald-500/30' : trend === 'down' ? 'border-red-500/30' : 'border-slate-700',
    minor: 'border-slate-700',
    neutral: 'border-slate-800',
  };

  const trendIcon = {
    up: <TrendingUp className="w-4 h-4 text-emerald-400" />,
    down: <TrendingDown className="w-4 h-4 text-red-400" />,
    flat: <Minus className="w-4 h-4 text-slate-400" />,
    new: <Activity className="w-4 h-4 text-blue-400" />,
  };

  const deltaColor = {
    up: 'text-emerald-400',
    down: 'text-red-400',
    flat: 'text-slate-400',
    new: 'text-blue-400',
  };

  return (
    <div className={`p-3 rounded-lg bg-slate-800/50 border ${borderColor[significance]}`}>
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs font-medium text-slate-300">{metric}</span>
        {trendIcon[trend]}
      </div>

      <div className="flex items-center gap-2 mb-2">
        {previousValue !== null && (
          <>
            <span className="text-sm text-slate-500">{previousValue}</span>
            <ArrowRight className="w-3 h-3 text-slate-600" />
          </>
        )}
        <span className="text-lg font-bold text-slate-100">{currentValue}</span>
        {delta !== null && (
          <span className={`text-xs ${deltaColor[trend]}`}>
            ({delta > 0 ? '+' : ''}{delta})
          </span>
        )}
      </div>

      <p className="text-[10px] text-slate-500">{narrative}</p>
    </div>
  );
}

export function QuarterChangesSection({ quarterChanges }: QuarterChangesSectionProps) {
  const [expanded, setExpanded] = useState(true);

  if (!quarterChanges || quarterChanges.changes.length === 0) {
    return null;
  }

  const trendColor = {
    improving: 'text-emerald-400',
    declining: 'text-red-400',
    stable: 'text-blue-400',
    new: 'text-slate-400',
  };

  const trendLabel = {
    improving: 'Improving',
    declining: 'Needs Attention',
    stable: 'Stable',
    new: 'First Quarter',
  };

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/70 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-5 hover:bg-slate-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-indigo-500/20 text-indigo-400">
            <Activity className="w-5 h-5" />
          </div>
          <div className="text-left">
            <h2 className="text-base font-semibold text-slate-100">Quarter Changes</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {quarterChanges.previousQuarterLabel} to {quarterChanges.quarterLabel}
              <span className={`ml-2 ${trendColor[quarterChanges.overallTrend]}`}>
                {trendLabel[quarterChanges.overallTrend]}
              </span>
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        )}
      </button>

      {expanded && (
        <div className="px-5 pb-5 pt-0 space-y-4">
          {/* Summary narrative */}
          <p className="text-sm text-slate-300 leading-relaxed">
            {quarterChanges.summaryNarrative}
          </p>

          {/* Changes grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {quarterChanges.changes.map((change, idx) => (
              <ChangeCard key={idx} {...change} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
