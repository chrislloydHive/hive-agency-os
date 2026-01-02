'use client';

// components/website/v5/V5ExecutiveHeader.tsx
// V5 Executive Header - Fast orientation + credibility
//
// Rules:
// - No heuristics language
// - Must reference page(s) and persona(s)
// - Justification derived from blocking issues + persona failures only

import { PERSONA_LABELS, VERDICT_STYLES, type V5Verdict, type V5PersonaType } from '@/lib/contextGraph/v5/types';

interface V5ExecutiveHeaderProps {
  score: number;
  verdict: V5Verdict;
  justification: string;
  personasAffected: V5PersonaType[];
  pagesAffected: string[];
}

export function V5ExecutiveHeader({
  score,
  verdict,
  justification,
  personasAffected,
  pagesAffected,
}: V5ExecutiveHeaderProps) {
  const styles = VERDICT_STYLES[verdict];

  return (
    <div className={`rounded-lg border ${styles.border} ${styles.bg} p-6`}>
      <div className="flex items-start gap-6">
        {/* Score (large, left) */}
        <div className="flex-shrink-0">
          <div className={`text-5xl font-bold ${styles.text}`}>{score}</div>
          <div className="text-xs text-gray-400 mt-1 text-center">V5 Score</div>
        </div>

        {/* Verdict + Justification */}
        <div className="flex-1 min-w-0">
          {/* Verdict Label */}
          <div className="flex items-center gap-3 mb-3">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${styles.bg} ${styles.text} border ${styles.border}`}
            >
              {verdict}
            </span>

            {/* Affected counts */}
            <div className="flex items-center gap-4 text-sm text-gray-400">
              {personasAffected.length > 0 && (
                <span>
                  {personasAffected.length} persona{personasAffected.length !== 1 ? 's' : ''} affected
                </span>
              )}
              {pagesAffected.length > 0 && (
                <span>
                  {pagesAffected.length} page{pagesAffected.length !== 1 ? 's' : ''} flagged
                </span>
              )}
            </div>
          </div>

          {/* Justification */}
          <p className="text-gray-200 leading-relaxed">{justification}</p>

          {/* Persona badges */}
          {personasAffected.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {personasAffected.map((persona) => (
                <span
                  key={persona}
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-700/50 text-gray-300"
                >
                  {PERSONA_LABELS[persona]}
                </span>
              ))}
            </div>
          )}

          {/* Page paths */}
          {pagesAffected.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {pagesAffected.slice(0, 5).map((page) => (
                <code
                  key={page}
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-800 text-amber-400 font-mono"
                >
                  {page}
                </code>
              ))}
              {pagesAffected.length > 5 && (
                <span className="text-xs text-gray-500">+{pagesAffected.length - 5} more</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
