// components/gap/BrandLabSnapshot.tsx
// Brand Lab Snapshot for GAP reports
//
// Shows a compact view of Brand Lab data when available in GAP context.
// Links to the full Brand Lab diagnostic.

import Link from 'next/link';

export interface BrandLabSnapshotData {
  brandScore: number;
  benchmarkLabel: string;
  corePromise: string | null;
  tagline: string | null;
  positioningTheme: string;
  icpSummary: string;
  keyBrandStrengths: string[];
  keyBrandWeaknesses: string[];
  topBrandRisks: string[];
  recommendedBrandWorkItems: string[];
}

interface BrandLabSnapshotProps {
  data: BrandLabSnapshotData;
  companyId?: string;
}

function getBenchmarkColor(label: string): string {
  const l = label.toLowerCase();
  if (l === 'category_leader' || l === 'strong') return 'text-green-400 bg-green-500/10 border-green-500/30';
  if (l === 'solid') return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
  if (l === 'developing') return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
  return 'text-red-400 bg-red-500/10 border-red-500/30';
}

function formatBenchmarkLabel(label: string): string {
  return label.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function BrandLabSnapshot({ data, companyId }: BrandLabSnapshotProps) {
  const {
    brandScore,
    benchmarkLabel,
    corePromise,
    tagline,
    positioningTheme,
    icpSummary,
    keyBrandStrengths,
    keyBrandWeaknesses,
    topBrandRisks,
  } = data;

  return (
    <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Brand Lab Results</h3>
            <p className="text-xs text-slate-500">Pre-analyzed brand context</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-slate-100">{brandScore}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium border ${getBenchmarkColor(benchmarkLabel)}`}>
            {formatBenchmarkLabel(benchmarkLabel)}
          </span>
        </div>
      </div>

      {/* Key Info */}
      <div className="space-y-3 mb-4">
        {tagline && (
          <div>
            <span className="text-[10px] uppercase tracking-wider text-slate-500">Tagline</span>
            <p className="text-sm text-slate-200 mt-0.5">"{tagline}"</p>
          </div>
        )}
        {corePromise && (
          <div>
            <span className="text-[10px] uppercase tracking-wider text-slate-500">Core Promise</span>
            <p className="text-sm text-slate-300 mt-0.5">{corePromise}</p>
          </div>
        )}
        <div>
          <span className="text-[10px] uppercase tracking-wider text-slate-500">Positioning</span>
          <p className="text-sm text-slate-300 mt-0.5">{positioningTheme}</p>
        </div>
        <div>
          <span className="text-[10px] uppercase tracking-wider text-slate-500">Target Audience</span>
          <p className="text-sm text-slate-400 mt-0.5">{icpSummary}</p>
        </div>
      </div>

      {/* Strengths & Weaknesses Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Strengths */}
        {keyBrandStrengths.length > 0 && (
          <div>
            <span className="text-[10px] uppercase tracking-wider text-green-400/70">Strengths</span>
            <ul className="mt-1.5 space-y-1">
              {keyBrandStrengths.slice(0, 3).map((strength, idx) => (
                <li key={idx} className="text-xs text-slate-300 flex items-start gap-1.5">
                  <span className="text-green-400 mt-0.5 flex-shrink-0">+</span>
                  <span className="leading-relaxed">{strength}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Weaknesses */}
        {keyBrandWeaknesses.length > 0 && (
          <div>
            <span className="text-[10px] uppercase tracking-wider text-red-400/70">Weaknesses</span>
            <ul className="mt-1.5 space-y-1">
              {keyBrandWeaknesses.slice(0, 3).map((weakness, idx) => (
                <li key={idx} className="text-xs text-slate-400 flex items-start gap-1.5">
                  <span className="text-red-400 mt-0.5 flex-shrink-0">-</span>
                  <span className="leading-relaxed">{weakness}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Risks */}
      {topBrandRisks.length > 0 && (
        <div className="mb-4">
          <span className="text-[10px] uppercase tracking-wider text-orange-400/70">Top Risks</span>
          <ul className="mt-1.5 space-y-1">
            {topBrandRisks.slice(0, 2).map((risk, idx) => (
              <li key={idx} className="text-xs text-slate-400 flex items-start gap-1.5">
                <span className="text-orange-400 mt-0.5 flex-shrink-0">!</span>
                <span className="leading-relaxed">{risk}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Link to Brand Lab */}
      {companyId && (
        <div className="pt-3 border-t border-slate-800">
          <Link
            href={`/c/${companyId}/diagnostics/brand`}
            className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
          >
            Open Brand Lab for full analysis →
          </Link>
        </div>
      )}
    </div>
  );
}
