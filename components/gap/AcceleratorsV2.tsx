// components/gap/AcceleratorsV2.tsx
'use client';

import type { GrowthAccelerationPlan, GapActionV2, GapActionRef } from '@/lib/growth-plan/types';

interface AcceleratorsV2Props {
  plan: GrowthAccelerationPlan;
}

export function AcceleratorsV2({ plan }: AcceleratorsV2Props) {
  const { accelerators, actions } = plan;

  // Defensive check - render nothing if no V2 data
  if (!accelerators || !actions || accelerators.length === 0) {
    return null;
  }

  // Build action lookup map
  const actionMap = new Map<string, GapActionV2>();
  actions.forEach((action) => {
    actionMap.set(action.id, action);
  });

  return (
    <div className="bg-gradient-to-br from-amber-950/30 to-amber-900/20 border border-amber-800/50 rounded-2xl p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">⚡</span>
          <h3 className="text-2xl font-bold text-amber-400">
            Top Accelerators
          </h3>
        </div>
        <p className="text-sm text-amber-200/70">
          These {accelerators.length} highest-leverage actions will drive the most impact. Prioritize these first.
        </p>
      </div>

      <div className="space-y-4">
        {accelerators.map((ref, idx) => {
          const action = actionMap.get(ref.actionId);
          if (!action) return null;

          return (
            <div
              key={idx}
              className="bg-slate-950/60 border border-amber-700/50 rounded-xl p-5 hover:border-amber-500 transition-all hover:shadow-lg hover:shadow-amber-900/20"
            >
              {/* Header with title and badges */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1">
                  <div className="flex items-start gap-2 mb-1">
                    <span className="text-lg font-bold text-amber-500">#{idx + 1}</span>
                    <h4 className="text-lg font-semibold text-slate-100">{action.title}</h4>
                  </div>
                  <p className="text-sm text-slate-300 mt-2">{action.description}</p>
                </div>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  {/* Impact badge */}
                  <span
                    className={`text-xs px-2 py-1 rounded text-center font-medium ${
                      action.impact === 'high'
                        ? 'bg-green-900/60 text-green-300 border border-green-700/50'
                        : action.impact === 'medium'
                        ? 'bg-amber-900/60 text-amber-300 border border-amber-700/50'
                        : 'bg-slate-700/60 text-slate-300 border border-slate-600/50'
                    }`}
                  >
                    {action.impact} impact
                  </span>
                  {/* Effort badge */}
                  <span
                    className={`text-xs px-2 py-1 rounded text-center font-medium ${
                      action.effort === 'low'
                        ? 'bg-blue-900/60 text-blue-300 border border-blue-700/50'
                        : action.effort === 'medium'
                        ? 'bg-purple-900/60 text-purple-300 border border-purple-700/50'
                        : 'bg-red-900/60 text-red-300 border border-red-700/50'
                    }`}
                  >
                    {action.effort} effort
                  </span>
                </div>
              </div>

              {/* Rationale if provided */}
              {ref.rationale && (
                <div className="bg-amber-950/30 border border-amber-800/30 rounded-lg p-3 mb-3">
                  <p className="text-xs text-amber-200/80 italic">
                    <span className="font-semibold">Why this matters:</span> {ref.rationale}
                  </p>
                </div>
              )}

              {/* Meta info */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-3">
                <span className="bg-slate-800/50 px-2 py-1 rounded border border-slate-700/50">
                  📂 {action.category}
                </span>
                <span className="bg-slate-800/50 px-2 py-1 rounded border border-slate-700/50">
                  ⏱️ {action.timeHorizon}
                </span>
                {action.confidence && (
                  <span className="bg-slate-800/50 px-2 py-1 rounded border border-slate-700/50">
                    🎯 {action.confidence} confidence
                  </span>
                )}
                {action.ownerHint && (
                  <span className="bg-slate-800/50 px-2 py-1 rounded border border-slate-700/50">
                    👤 {action.ownerHint}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
