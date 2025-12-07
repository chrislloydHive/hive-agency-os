// components/competition/CompetitorCardV3.tsx
// V3 Competitor Detail Card with 6-category display and threat scores

'use client';

import type { CompetitionCompetitor } from '@/lib/competition-v3/ui-types';
import {
  TYPE_COLORS,
  TYPE_LABELS,
  TYPE_DESCRIPTIONS,
} from '@/lib/competition-v3/ui-types';

interface Props {
  competitor: CompetitionCompetitor;
  onClose: () => void;
}

export function CompetitorCardV3({ competitor, onClose }: Props) {
  const colors = TYPE_COLORS[competitor.type];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
              style={{ backgroundColor: getTypeHexColor(competitor.type) }}
            >
              {competitor.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h3 className="font-semibold text-white">{competitor.name}</h3>
              {competitor.domain && (
                <a
                  href={`https://${competitor.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-slate-400 hover:text-blue-400 transition-colors"
                >
                  {competitor.domain} ↗
                </a>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-slate-400 hover:text-slate-300 hover:bg-slate-800 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Type Badge */}
      <div className={`p-3 rounded-lg ${colors.bg}/10 border border-current/20 ${colors.text}`}>
        <div className="flex items-center justify-between">
          <span className="font-medium">{TYPE_LABELS[competitor.type]}</span>
          <span className="text-xs opacity-80">
            {Math.round(competitor.classification.confidence * 100)}% confidence
          </span>
        </div>
        <p className="text-xs mt-1 opacity-80">{TYPE_DESCRIPTIONS[competitor.type]}</p>
      </div>

      {/* Scores Grid */}
      <div className="grid grid-cols-2 gap-3">
        <ScoreCard
          label="Threat Score"
          value={competitor.scores.threat}
          color={competitor.scores.threat >= 60 ? 'red' : 'slate'}
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          }
        />
        <ScoreCard
          label="Relevance"
          value={competitor.scores.relevance}
          color="amber"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
        />
        <ScoreCard
          label="ICP Fit"
          value={competitor.coordinates.icpFit}
          color="emerald"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
        />
        <ScoreCard
          label="Value Model"
          value={competitor.coordinates.valueModelFit}
          color="blue"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
        />
      </div>

      {/* Summary */}
      {competitor.summary && (
        <div>
          <h4 className="text-xs font-medium text-slate-500 mb-1">Summary</h4>
          <p className="text-sm text-slate-300">{competitor.summary}</p>
        </div>
      )}

      {/* Dimension Scores */}
      <div>
        <h4 className="text-xs font-medium text-slate-500 mb-2">Dimension Breakdown</h4>
        <div className="space-y-2">
          <ScoreBar label="ICP Match" value={competitor.scores.icp} />
          <ScoreBar label="Business Model" value={competitor.scores.businessModel} />
          <ScoreBar label="Services" value={competitor.scores.services} />
          <ScoreBar label="Value Model" value={competitor.scores.valueModel} />
          <ScoreBar label="AI Orientation" value={competitor.scores.aiOrientation} />
          <ScoreBar label="Geography" value={competitor.scores.geography} />
        </div>
      </div>

      {/* Strengths & Weaknesses */}
      {(competitor.analysis?.strengths?.length || competitor.analysis?.weaknesses?.length) && (
        <div className="grid grid-cols-2 gap-3">
          {competitor.analysis?.strengths?.length ? (
            <div>
              <h4 className="text-xs font-medium text-emerald-500 mb-2">Strengths</h4>
              <ul className="text-xs text-slate-400 space-y-1">
                {competitor.analysis.strengths.slice(0, 3).map((s, i) => (
                  <li key={i} className="flex items-start gap-1">
                    <span className="text-emerald-500 mt-0.5">+</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {competitor.analysis?.weaknesses?.length ? (
            <div>
              <h4 className="text-xs font-medium text-red-500 mb-2">Weaknesses</h4>
              <ul className="text-xs text-slate-400 space-y-1">
                {competitor.analysis.weaknesses.slice(0, 3).map((w, i) => (
                  <li key={i} className="flex items-start gap-1">
                    <span className="text-red-500 mt-0.5">-</span>
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      {/* Why Competitor */}
      {competitor.analysis?.whyCompetitor && (
        <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
          <h4 className="text-xs font-medium text-slate-400 mb-1">Why They Compete</h4>
          <p className="text-xs text-slate-300">{competitor.analysis.whyCompetitor}</p>
        </div>
      )}

      {/* Metadata */}
      {competitor.meta && (
        <div className="flex flex-wrap gap-2">
          {competitor.meta.teamSize && (
            <span className="px-2 py-1 rounded bg-slate-800 text-xs text-slate-400">
              Team: {competitor.meta.teamSize}
            </span>
          )}
          {competitor.meta.priceBand && (
            <span className="px-2 py-1 rounded bg-slate-800 text-xs text-slate-400">
              Price: {competitor.meta.priceBand}
            </span>
          )}
          {competitor.meta.hasAI && (
            <span className="px-2 py-1 rounded bg-purple-500/20 text-xs text-purple-400">
              AI-Powered
            </span>
          )}
          {competitor.meta.businessModel && (
            <span className="px-2 py-1 rounded bg-slate-800 text-xs text-slate-400">
              {competitor.meta.businessModel}
            </span>
          )}
        </div>
      )}

      {/* Classification Reasoning */}
      {competitor.classification.reasoning && (
        <div className="text-xs text-slate-500 italic border-t border-slate-800 pt-3">
          "{competitor.classification.reasoning}"
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Score Card Component
// ============================================================================

function ScoreCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: 'red' | 'amber' | 'emerald' | 'blue' | 'slate';
  icon: React.ReactNode;
}) {
  const colorClasses = {
    red: 'text-red-400 bg-red-500/10 border-red-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    slate: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
  };

  return (
    <div className={`p-3 rounded-lg border ${colorClasses[color]}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

// ============================================================================
// Score Bar Component
// ============================================================================

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-500">{label}</span>
        <span className="text-xs font-medium text-slate-300">{value}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            value >= 70 ? 'bg-red-500' :
            value >= 50 ? 'bg-amber-500' :
            value >= 30 ? 'bg-blue-500' :
            'bg-slate-600'
          }`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

// Get hex color for competitor type
function getTypeHexColor(type: CompetitionCompetitor['type']): string {
  switch (type) {
    case 'direct': return '#ef4444';
    case 'partial': return '#fb923c';
    case 'fractional': return '#38bdf8';
    case 'internal': return '#60a5fa';
    case 'platform': return '#fcd34d';
    case 'irrelevant': return '#64748b';
    default: return '#64748b';
  }
}
