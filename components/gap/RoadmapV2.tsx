// components/gap/RoadmapV2.tsx
'use client';

import type { GrowthAccelerationPlan, GapActionV2, GapActionRef } from '@/lib/growth-plan/types';

interface RoadmapV2Props {
  plan: GrowthAccelerationPlan;
}

export function RoadmapV2({ plan }: RoadmapV2Props) {
  const { roadmapV2, actions } = plan;

  // Defensive check - render nothing if no V2 data
  if (!roadmapV2 || !actions) {
    return null;
  }

  // Build action lookup map
  const actionMap = new Map<string, GapActionV2>();
  actions.forEach((action) => {
    actionMap.set(action.id, action);
  });

  // Helper to render a bucket of action refs
  const renderBucket = (title: string, refs: GapActionRef[], bgColor: string, borderColor: string) => {
    if (!refs || refs.length === 0) return null;

    return (
      <div className={`${bgColor} border ${borderColor} rounded-lg p-5`}>
        <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
          {title}
        </h4>
        <div className="space-y-3">
          {refs.map((ref, idx) => {
            const action = actionMap.get(ref.actionId);
            if (!action) return null;

            return (
              <div
                key={idx}
                className="bg-slate-900/40 border border-slate-700/50 rounded-md p-3 hover:border-amber-500/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h5 className="text-sm font-medium text-slate-100">{action.title}</h5>
                  <div className="flex gap-1 flex-shrink-0">
                    {/* Impact badge */}
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        action.impact === 'high'
                          ? 'bg-green-900/40 text-green-400'
                          : action.impact === 'medium'
                          ? 'bg-amber-900/40 text-amber-400'
                          : 'bg-slate-700/40 text-slate-400'
                      }`}
                    >
                      {action.impact} impact
                    </span>
                    {/* Effort badge */}
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        action.effort === 'low'
                          ? 'bg-blue-900/40 text-blue-400'
                          : action.effort === 'medium'
                          ? 'bg-purple-900/40 text-purple-400'
                          : 'bg-red-900/40 text-red-400'
                      }`}
                    >
                      {action.effort} effort
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mb-2">{action.description}</p>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="bg-slate-800/50 px-2 py-0.5 rounded">{action.category}</span>
                  {action.confidence && (
                    <span className="bg-slate-800/50 px-2 py-0.5 rounded">
                      {action.confidence} confidence
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6">
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-slate-100 mb-2">
          Your Growth Roadmap
        </h3>
        <p className="text-sm text-slate-400">
          Prioritized action plan organized by timeline. Execute in order for maximum impact.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {renderBucket(
          '🚀 Immediate (1-2 weeks)',
          roadmapV2.immediate,
          'bg-red-950/20',
          'border-red-900/50'
        )}
        {renderBucket(
          '⚡ Short Term (2-6 weeks)',
          roadmapV2.shortTerm,
          'bg-amber-950/20',
          'border-amber-900/50'
        )}
        {renderBucket(
          '📈 Medium Term (6-12 weeks)',
          roadmapV2.mediumTerm,
          'bg-blue-950/20',
          'border-blue-900/50'
        )}
        {renderBucket(
          '🎯 Long Term (12-24 weeks)',
          roadmapV2.longTerm,
          'bg-purple-950/20',
          'border-purple-900/50'
        )}
      </div>
    </div>
  );
}
