// components/competition/LandscapeInsightsPanel.tsx
// V3 Landscape Insights Panel with collapsible sections
//
// Refactored for better readability:
// - Collapsible sections for risks, opportunities, and moves
// - Bullet-style lists for risks/opportunities
// - Compact action cards for recommended moves

'use client';

import { useState } from 'react';
import type { CompetitionInsights } from '@/lib/competition-v3/ui-types';

interface Props {
  insights: CompetitionInsights;
}

// Collapsible section component
function CollapsibleSection({
  title,
  icon,
  color,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  color: 'red' | 'emerald' | 'amber';
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const colorClasses = {
    red: 'text-red-400 bg-red-500/10 border-red-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  };

  return (
    <div className={`rounded-lg border ${colorClasses[color]} overflow-hidden`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className={`text-xs font-medium ${colorClasses[color].split(' ')[0]}`}>
            {title}
          </span>
          {count !== undefined && (
            <span className="px-1.5 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-400">
              {count}
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && <div className="px-3 pb-3 pt-0">{children}</div>}
    </div>
  );
}

export function LandscapeInsightsPanel({ insights }: Props) {
  const hasRisks = insights.keyRisks.length > 0;
  const hasOpportunities = insights.keyOpportunities.length > 0;
  const hasMoves =
    insights.recommendedMoves.now.length > 0 ||
    insights.recommendedMoves.next.length > 0 ||
    insights.recommendedMoves.later.length > 0;

  const isEmpty = !insights.landscapeSummary && !hasRisks && !hasOpportunities && !hasMoves;

  if (isEmpty) {
    return (
      <div className="text-center py-8">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-800 flex items-center justify-center">
          <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        <p className="text-slate-400 text-sm">No insights available yet</p>
        <p className="text-slate-500 text-xs mt-1">Run a competition analysis to generate insights</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">Strategic Insights</h3>
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">AI Analysis</span>
      </div>

      {/* Summary */}
      {insights.landscapeSummary && (
        <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800">
          <p className="text-xs text-slate-300 leading-relaxed">{insights.landscapeSummary}</p>
        </div>
      )}

      {/* Category Breakdown */}
      {insights.categoryBreakdown && (
        <div className="px-3 py-2 rounded-lg bg-slate-900/30 border border-slate-800">
          <div className="text-[10px] text-slate-500 mb-1">Category Breakdown</div>
          <p className="text-xs text-slate-300">{insights.categoryBreakdown}</p>
        </div>
      )}

      {/* Key Risks - Collapsible */}
      {hasRisks && (
        <CollapsibleSection
          title="Key Risks"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          }
          color="red"
          count={insights.keyRisks.length}
          defaultOpen={insights.keyRisks.length <= 3}
        >
          <ul className="space-y-1.5">
            {insights.keyRisks.map((risk, idx) => (
              <li key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                <span className="text-red-400 mt-0.5 shrink-0">•</span>
                <span>{risk}</span>
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      )}

      {/* Key Opportunities - Collapsible */}
      {hasOpportunities && (
        <CollapsibleSection
          title="Key Opportunities"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
          color="emerald"
          count={insights.keyOpportunities.length}
          defaultOpen={insights.keyOpportunities.length <= 3}
        >
          <ul className="space-y-1.5">
            {insights.keyOpportunities.map((opp, idx) => (
              <li key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                <span className="text-emerald-400 mt-0.5 shrink-0">•</span>
                <span>{opp}</span>
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      )}

      {/* Recommended Moves - Collapsible */}
      {hasMoves && (
        <CollapsibleSection
          title="Recommended Moves"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          }
          color="amber"
          defaultOpen={true}
        >
          <div className="space-y-3">
            {/* NOW */}
            {insights.recommendedMoves.now.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="px-1.5 py-0.5 rounded bg-red-500 text-white text-[9px] font-bold uppercase">
                    Now
                  </span>
                  <span className="text-[10px] text-slate-500">Immediate priority</span>
                </div>
                <ul className="space-y-1">
                  {insights.recommendedMoves.now.map((move, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                      <span className="text-red-400 mt-0.5 shrink-0">-&gt;</span>
                      <span>{move}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* NEXT */}
            {insights.recommendedMoves.next.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="px-1.5 py-0.5 rounded bg-amber-500 text-white text-[9px] font-bold uppercase">
                    Next
                  </span>
                  <span className="text-[10px] text-slate-500">Coming up</span>
                </div>
                <ul className="space-y-1">
                  {insights.recommendedMoves.next.map((move, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                      <span className="text-amber-400 mt-0.5 shrink-0">-&gt;</span>
                      <span>{move}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* LATER */}
            {insights.recommendedMoves.later.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="px-1.5 py-0.5 rounded bg-slate-600 text-white text-[9px] font-bold uppercase">
                    Later
                  </span>
                  <span className="text-[10px] text-slate-500">When resources allow</span>
                </div>
                <ul className="space-y-1">
                  {insights.recommendedMoves.later.map((move, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                      <span className="text-slate-400 mt-0.5 shrink-0">-&gt;</span>
                      <span>{move}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}
