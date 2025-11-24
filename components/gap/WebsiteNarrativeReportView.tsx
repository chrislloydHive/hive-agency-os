// components/gap/WebsiteNarrativeReportView.tsx
// Website Deep Narrative Report - Consultant-Grade Display Component

'use client';

import type { WebsiteNarrativeReport } from '@/lib/gap-heavy/modules/websiteNarrativeReport';
import ReactMarkdown from 'react-markdown';

type Props = {
  narrative: WebsiteNarrativeReport;
};

export function WebsiteNarrativeReportView({ narrative }: Props) {
  const getBenchmarkLabel = (benchmark: string): string => {
    const labels = {
      leader: 'LEADER',
      strong: 'STRONG',
      average: 'AVERAGE',
      weak: 'WEAK',
    };
    return labels[benchmark as keyof typeof labels] || benchmark.toUpperCase();
  };

  const getBenchmarkColor = (benchmark: string): string => {
    const colors = {
      leader: 'text-emerald-400',
      strong: 'text-blue-400',
      average: 'text-amber-400',
      weak: 'text-rose-400',
    };
    return colors[benchmark as keyof typeof colors] || 'text-slate-400';
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 py-8">
      {/* ====================================================================== */}
      {/* HEADER */}
      {/* ====================================================================== */}
      <section className="space-y-4">
        <div>
          <h1 className="mb-1 text-3xl font-bold text-slate-100 print:text-slate-900">
            {narrative.title}
          </h1>
          <p className="text-sm text-slate-400 print:text-slate-600">
            {narrative.companyName} • {narrative.websiteUrl.replace(/^https?:\/\//, '')}
          </p>
        </div>

        {/* Overall Score & Benchmark */}
        <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-6 print:border-slate-300 print:bg-white">
          <div className="flex items-baseline gap-3">
            <span
              className={`text-2xl font-bold ${getBenchmarkColor(narrative.benchmarkLabel)} print:text-slate-900`}
            >
              {getBenchmarkLabel(narrative.benchmarkLabel)}
            </span>
            <span className="text-slate-400 print:text-slate-600">
              Overall Score: {Math.round(narrative.overallScore)}/100
            </span>
          </div>

          {/* Key Stats */}
          {narrative.keyStats && (
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {narrative.keyStats.funnelHealthScore !== undefined && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500 print:text-slate-600">
                    Funnel Health
                  </div>
                  <div className="text-lg font-semibold text-slate-200 print:text-slate-900">
                    {Math.round(narrative.keyStats.funnelHealthScore)}/100
                  </div>
                </div>
              )}

              {narrative.keyStats.trustScore !== undefined && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500 print:text-slate-600">
                    Trust Score
                  </div>
                  <div className="text-lg font-semibold text-slate-200 print:text-slate-900">
                    {Math.round(narrative.keyStats.trustScore)}/100
                  </div>
                </div>
              )}

              {narrative.keyStats.contentClarityScore !== undefined && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500 print:text-slate-600">
                    Content Clarity
                  </div>
                  <div className="text-lg font-semibold text-slate-200 print:text-slate-900">
                    {Math.round(narrative.keyStats.contentClarityScore)}/100
                  </div>
                </div>
              )}

              {narrative.keyStats.conversionReadinessScore !== undefined && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500 print:text-slate-600">
                    Conversion Readiness
                  </div>
                  <div className="text-lg font-semibold text-slate-200 print:text-slate-900">
                    {Math.round(narrative.keyStats.conversionReadinessScore)}/100
                  </div>
                </div>
              )}

              {narrative.keyStats.visualModernityScore !== undefined && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500 print:text-slate-600">
                    Visual Modernity
                  </div>
                  <div className="text-lg font-semibold text-slate-200 print:text-slate-900">
                    {Math.round(narrative.keyStats.visualModernityScore)}/100
                  </div>
                </div>
              )}

              {narrative.keyStats.personaSuccessRate !== undefined && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500 print:text-slate-600">
                    Persona Success
                  </div>
                  <div className="text-lg font-semibold text-slate-200 print:text-slate-900">
                    {Math.round(narrative.keyStats.personaSuccessRate)}%
                  </div>
                </div>
              )}

              {narrative.keyStats.quickWinsCount !== undefined &&
                narrative.keyStats.quickWinsCount > 0 && (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500 print:text-slate-600">
                      Quick Wins
                    </div>
                    <div className="text-lg font-semibold text-slate-200 print:text-slate-900">
                      {narrative.keyStats.quickWinsCount}
                    </div>
                  </div>
                )}

              {narrative.keyStats.criticalIssuesCount !== undefined &&
                narrative.keyStats.criticalIssuesCount > 0 && (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500 print:text-slate-600">
                      Critical Issues
                    </div>
                    <div className="text-lg font-semibold text-rose-400 print:text-rose-600">
                      {narrative.keyStats.criticalIssuesCount}
                    </div>
                  </div>
                )}
            </div>
          )}
        </div>
      </section>

      {/* ====================================================================== */}
      {/* EXECUTIVE SUMMARY */}
      {/* ====================================================================== */}
      <section className="space-y-4">
        <details open className="group">
          <summary className="cursor-pointer list-none">
            <div className="mb-4 flex items-center gap-2">
              <span className="text-slate-400 transition-transform group-open:rotate-90 print:text-slate-600">
                ▶
              </span>
              <h2 className="text-xl font-bold text-slate-100 print:text-slate-900">
                Executive Summary
              </h2>
            </div>
          </summary>

          <div className="prose prose-sm prose-invert max-w-none rounded-lg border border-slate-700 bg-slate-900/50 p-6 print:prose-slate print:border-slate-300 print:bg-white">
            <ReactMarkdown>{narrative.executiveSummaryMarkdown}</ReactMarkdown>
          </div>
        </details>
      </section>

      {/* ====================================================================== */}
      {/* SECTIONS */}
      {/* ====================================================================== */}
      {narrative.sections.map((section) => (
        <section key={section.id} className="space-y-4">
          <details open className="group">
            <summary className="cursor-pointer list-none">
              <div className="mb-4 flex items-center gap-2">
                <span className="text-slate-400 transition-transform group-open:rotate-90 print:text-slate-600">
                  ▶
                </span>
                <h2 className="text-xl font-bold text-slate-100 print:text-slate-900">
                  {section.title}
                </h2>
              </div>
            </summary>

            <div className="space-y-4">
              {/* Summary Bullet Points (if available) */}
              {section.summaryBulletPoints && section.summaryBulletPoints.length > 0 && (
                <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 print:border-slate-300 print:bg-slate-50">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 print:text-slate-600">
                    Key Takeaways
                  </h3>
                  <ul className="space-y-1 text-sm text-slate-300 print:text-slate-700">
                    {section.summaryBulletPoints.map((point, idx) => (
                      <li key={idx}>• {point}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Body Markdown */}
              <div className="prose prose-sm prose-invert max-w-none rounded-lg border border-slate-700 bg-slate-900/50 p-6 print:prose-slate print:border-slate-300 print:bg-white">
                <ReactMarkdown>{section.bodyMarkdown}</ReactMarkdown>
              </div>
            </div>
          </details>
        </section>
      ))}

      {/* ====================================================================== */}
      {/* METADATA */}
      {/* ====================================================================== */}
      {narrative.metadata && (
        <section className="mt-12 border-t border-slate-800 pt-6 print:border-slate-300">
          <div className="text-xs text-slate-500 print:text-slate-600">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {narrative.metadata.pagesAnalyzed !== undefined && (
                <div>
                  <span className="font-semibold">Pages Analyzed:</span>{' '}
                  {narrative.metadata.pagesAnalyzed}
                </div>
              )}
              {narrative.metadata.personasTested !== undefined && (
                <div>
                  <span className="font-semibold">Personas Tested:</span>{' '}
                  {narrative.metadata.personasTested}
                </div>
              )}
              {narrative.metadata.heuristicsFlagged !== undefined && (
                <div>
                  <span className="font-semibold">Heuristics Flagged:</span>{' '}
                  {narrative.metadata.heuristicsFlagged}
                </div>
              )}
              {narrative.metadata.analysisDepth && (
                <div>
                  <span className="font-semibold">Analysis Depth:</span>{' '}
                  {narrative.metadata.analysisDepth}
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
