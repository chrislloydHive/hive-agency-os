// components/os/blueprint/BlueprintOpportunities.tsx
// Prioritized opportunities section for the Actions column
// Shows top 3-5 opportunities with impact, effort, category, and Send to Work button

'use client';

import { getImpactStyle, getEffortStyle, getCategoryColor, dedupeOpportunities } from './utils';
import type { PrioritizedAction } from './types';

interface BlueprintOpportunitiesProps {
  actions: PrioritizedAction[];
  onSendToWork: (action: PrioritizedAction, actionId: string) => void;
  sendingItems: Set<string>;
  className?: string;
}

function OpportunityCard({
  action,
  index,
  onSendToWork,
  isSending,
}: {
  action: PrioritizedAction;
  index: number;
  onSendToWork: () => void;
  isSending: boolean;
}) {
  const categoryColors = getCategoryColor(action.area || 'Other');

  return (
    <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-4 hover:border-amber-500/30 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-2">
        <h4 className="text-sm font-medium text-slate-200 flex-1">{action.title}</h4>
        <div className="flex-shrink-0 flex items-center gap-1.5">
          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getImpactStyle(action.impact)}`}>
            {action.impact}
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${getEffortStyle(action.effort)}`}>
            {action.effort}
          </span>
        </div>
      </div>

      {action.description && (
        <p className="text-xs text-slate-400 mb-3 line-clamp-2">{action.description}</p>
      )}

      <div className="flex items-center justify-between">
        {action.area && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${categoryColors.bg} ${categoryColors.text} ${categoryColors.border}`}>
            {action.area}
          </span>
        )}
        <button
          onClick={onSendToWork}
          disabled={isSending}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors disabled:opacity-50"
        >
          {isSending ? (
            <>
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Adding...
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add to Work
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function EmptyOpportunitiesState() {
  return (
    <div className="rounded-lg bg-slate-800/30 border border-slate-700/30 border-dashed p-4 text-center">
      <div className="flex items-center justify-center gap-2 mb-2">
        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <span className="text-sm font-medium text-slate-400">No Recommendations Yet</span>
      </div>
      <p className="text-xs text-slate-500">
        Run GAP or Labs diagnostics to generate prioritized opportunities.
      </p>
    </div>
  );
}

export function BlueprintOpportunities({
  actions,
  onSendToWork,
  sendingItems,
  className = '',
}: BlueprintOpportunitiesProps) {
  // Deduplicate by title first
  const uniqueActions = dedupeOpportunities(actions);

  // Sort by impact (high first), then by effort (low first)
  const sortedActions = [...uniqueActions].sort((a, b) => {
    const impactOrder = { high: 0, medium: 1, low: 2 };
    const effortOrder = { low: 0, medium: 1, high: 2 };
    const impactDiff = impactOrder[a.impact] - impactOrder[b.impact];
    if (impactDiff !== 0) return impactDiff;
    return effortOrder[a.effort] - effortOrder[b.effort];
  });

  // Take top 5
  const topActions = sortedActions.slice(0, 5);

  if (topActions.length === 0) {
    return <EmptyOpportunitiesState />;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {topActions.map((action, index) => (
        <OpportunityCard
          key={`opportunity-${index}`}
          action={action}
          index={index}
          onSendToWork={() => onSendToWork(action, `opportunity-${index}`)}
          isSending={sendingItems.has(`opportunity-${index}`)}
        />
      ))}
    </div>
  );
}
