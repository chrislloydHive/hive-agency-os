// app/c/[companyId]/diagnostics/brand/CompetitiveSnapshot.tsx
// Competitive Snapshot Component for Brand Lab V4

'use client';

import type { BrandCompetitiveLandscape } from '@/lib/gap-heavy/modules/brandLab';

type Props = {
  competitiveLandscape: BrandCompetitiveLandscape;
};

function getScoreColor(score: number): string {
  if (score >= 70) return 'text-green-400';
  if (score >= 50) return 'text-yellow-400';
  return 'text-red-400';
}

function getScoreBgColor(score: number): string {
  if (score >= 70) return 'bg-green-500/10 border-green-500/30';
  if (score >= 50) return 'bg-yellow-500/10 border-yellow-500/30';
  return 'bg-red-500/10 border-red-500/30';
}

export function CompetitiveSnapshot({ competitiveLandscape }: Props) {
  const {
    primaryCompetitors,
    categoryLanguagePatterns,
    differentiationScore,
    clicheDensityScore,
    whiteSpaceOpportunities,
    similarityNotes,
  } = competitiveLandscape;

  return (
    <div className="space-y-6">
      {/* Scores Row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Differentiation Score */}
        <div className={`rounded-lg border p-4 ${getScoreBgColor(differentiationScore)}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-300">Differentiation</span>
            <span className={`text-2xl font-bold ${getScoreColor(differentiationScore)}`}>
              {differentiationScore}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            {differentiationScore >= 70
              ? 'Brand stands out from competitors'
              : differentiationScore >= 50
              ? 'Some differentiation, room to improve'
              : 'Brand blends in with competitors'}
          </p>
        </div>

        {/* Cliche Density Score (inverse - lower is better) */}
        <div className={`rounded-lg border p-4 ${getScoreBgColor(100 - clicheDensityScore)}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-300">Originality</span>
            <span className={`text-2xl font-bold ${getScoreColor(100 - clicheDensityScore)}`}>
              {100 - clicheDensityScore}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            {clicheDensityScore <= 30
              ? 'Uses fresh, original language'
              : clicheDensityScore <= 50
              ? 'Mix of original and generic language'
              : 'Heavy use of clichés and buzzwords'}
          </p>
        </div>
      </div>

      {/* Competitors Table */}
      {primaryCompetitors.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-slate-300 mb-3">
            Competitors Analyzed ({primaryCompetitors.length})
          </h4>
          <div className="rounded-lg border border-slate-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-medium text-slate-400">Competitor</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-slate-400">Positioning</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-slate-400">Angle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {primaryCompetitors.map((competitor, index) => (
                  <tr key={index} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3">
                      <div>
                        <span className="text-slate-200 font-medium">{competitor.name}</span>
                        <a
                          href={competitor.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-xs text-blue-400 hover:underline truncate max-w-[150px]"
                        >
                          {competitor.url.replace(/^https?:\/\//, '')}
                        </a>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-xs max-w-[200px]">
                      {competitor.positioningSnippet}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-300">
                        {competitor.estimatedAngle}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Category Language Patterns */}
      {categoryLanguagePatterns.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-slate-300 mb-2">
            Category Language Patterns
          </h4>
          <p className="text-xs text-slate-500 mb-3">
            Common phrases used across the category. Avoid these to stand out.
          </p>
          <div className="flex flex-wrap gap-2">
            {categoryLanguagePatterns.map((pattern, index) => (
              <span
                key={index}
                className="inline-block rounded-md bg-orange-500/10 border border-orange-500/20 px-2 py-1 text-xs text-orange-300"
              >
                "{pattern}"
              </span>
            ))}
          </div>
        </div>
      )}

      {/* White Space Opportunities */}
      {whiteSpaceOpportunities.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-slate-300 mb-2">
            White Space Opportunities
          </h4>
          <p className="text-xs text-slate-500 mb-3">
            Positioning angles not claimed by competitors.
          </p>
          <ul className="space-y-2">
            {whiteSpaceOpportunities.map((opportunity, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <span className="text-green-400 mt-0.5">+</span>
                <span className="text-slate-300">{opportunity}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Similarity Notes */}
      {similarityNotes.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-slate-300 mb-2">
            Where You Sound Similar
          </h4>
          <p className="text-xs text-slate-500 mb-3">
            Areas where your brand messaging overlaps with competitors.
          </p>
          <ul className="space-y-2">
            {similarityNotes.map((note, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <span className="text-yellow-400 mt-0.5">!</span>
                <span className="text-slate-400">{note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
