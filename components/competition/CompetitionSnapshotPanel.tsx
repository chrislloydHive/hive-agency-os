// components/competition/CompetitionSnapshotPanel.tsx
// Competition Snapshot Panel - Compact landscape overview
//
// Shows: Landscape summary, category breakdown, top 3 threats, and quick links

'use client';

import type { CompetitionCompetitor, CompetitionInsights } from '@/lib/competition-v3/ui-types';
import { TYPE_COLORS, TYPE_LABELS } from '@/lib/competition-v3/ui-types';

interface Props {
  insights: CompetitionInsights;
  competitors: CompetitionCompetitor[];
  onSelectCompetitor: (id: string) => void;
}

export function CompetitionSnapshotPanel({ insights, competitors, onSelectCompetitor }: Props) {
  // Get top 3 threats by threat score
  const topThreats = [...competitors]
    .sort((a, b) => b.scores.threat - a.scores.threat)
    .slice(0, 3);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">Landscape Snapshot</h3>
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">Overview</span>
      </div>

      {/* Landscape Summary */}
      {insights.landscapeSummary && (
        <div className="p-3 rounded-lg bg-gradient-to-r from-amber-500/5 to-rose-500/5 border border-slate-800">
          <p className="text-xs text-slate-300 leading-relaxed">{insights.landscapeSummary}</p>
        </div>
      )}

      {/* Category Breakdown */}
      {insights.categoryBreakdown && (
        <div>
          <h4 className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-2">
            Breakdown
          </h4>
          <p className="text-xs text-slate-400">{insights.categoryBreakdown}</p>
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-slate-800" />

      {/* Top Threats */}
      <div>
        <h4 className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <svg className="w-3 h-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Top Threats
        </h4>

        {topThreats.length > 0 ? (
          <div className="space-y-2">
            {topThreats.map((comp, idx) => {
              const colors = TYPE_COLORS[comp.type];
              return (
                <button
                  key={comp.id}
                  onClick={() => onSelectCompetitor(comp.id)}
                  className="w-full flex items-center gap-3 p-2 rounded-lg bg-slate-900/50 hover:bg-slate-800/50 border border-slate-800 hover:border-slate-700 transition-colors text-left"
                >
                  {/* Rank */}
                  <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400">
                    {idx + 1}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-200 truncate">{comp.name}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] ${colors.bg}/20 ${colors.text}`}>
                        {TYPE_LABELS[comp.type]}
                      </span>
                    </div>
                    {comp.domain && (
                      <p className="text-[10px] text-slate-500 truncate">{comp.domain}</p>
                    )}
                  </div>

                  {/* Threat Score */}
                  <div className="text-right">
                    <div className={`text-sm font-bold ${comp.scores.threat >= 60 ? 'text-red-400' : 'text-slate-400'}`}>
                      {comp.scores.threat}
                    </div>
                    <div className="text-[9px] text-slate-600">threat</div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-500">No competitors analyzed yet</p>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-slate-800" />

      {/* Key Risks */}
      {insights.keyRisks.length > 0 && (
        <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
          <div className="flex items-center gap-1.5 mb-2">
            <svg className="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-[10px] font-medium text-red-400 uppercase tracking-wider">
              Key Risks ({insights.keyRisks.length})
            </span>
          </div>
          <ul className="space-y-1.5">
            {insights.keyRisks.slice(0, 3).map((risk, idx) => (
              <li key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                <span className="text-red-400 mt-0.5 shrink-0">•</span>
                <span>{risk}</span>
              </li>
            ))}
            {insights.keyRisks.length > 3 && (
              <li className="text-[10px] text-slate-500 pl-4">
                +{insights.keyRisks.length - 3} more in Data view
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Opportunities */}
      {insights.keyOpportunities.length > 0 && (
        <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
          <div className="flex items-center gap-1.5 mb-2">
            <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="text-[10px] font-medium text-emerald-400 uppercase tracking-wider">
              Opportunities ({insights.keyOpportunities.length})
            </span>
          </div>
          <ul className="space-y-1.5">
            {insights.keyOpportunities.slice(0, 3).map((opp, idx) => (
              <li key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                <span className="text-emerald-400 mt-0.5 shrink-0">•</span>
                <span>{opp}</span>
              </li>
            ))}
            {insights.keyOpportunities.length > 3 && (
              <li className="text-[10px] text-slate-500 pl-4">
                +{insights.keyOpportunities.length - 3} more in Data view
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Recommended Moves Preview */}
      {insights.recommendedMoves.now.length > 0 && (
        <>
          <div className="border-t border-slate-800" />
          <div>
            <h4 className="text-[10px] font-medium text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Immediate Action
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              {insights.recommendedMoves.now[0]}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
