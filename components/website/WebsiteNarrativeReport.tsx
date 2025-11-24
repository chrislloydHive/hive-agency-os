// components/website/WebsiteNarrativeReport.tsx
// Website UX Diagnostics - Narrative Report (Text-First, Consultant Style)
//
// This is the primary Website V4/V5 report view. No charts, no gauges, no dashboard.
// Just clean, structured text matching the consultant report format.

import type {
  WebsiteUXAssessmentV4,
  WebsiteUXLabResultV4,
  WebsiteUxDimensionKey,
} from '@/lib/gap-heavy/modules/websiteLab';

type Props = {
  assessment: WebsiteUXAssessmentV4;
  labResult: WebsiteUXLabResultV4 | null;
  companyName?: string;
  companyUrl?: string;
};

export function WebsiteNarrativeReport({
  assessment,
  labResult,
  companyName,
  companyUrl,
}: Props) {
  // Calculate persona success rate
  const personaSuccessRate = labResult?.personas
    ? Math.round(
        (labResult.personas.filter((p) => p.success).length /
          labResult.personas.length) *
          100
      )
    : 0;

  // Determine grade label from score
  const getGradeLabel = (score: number): string => {
    if (score >= 90) return 'ELITE';
    if (score >= 80) return 'STRONG';
    if (score >= 60) return 'AVERAGE';
    return 'WEAK';
  };

  const gradeLabel = getGradeLabel(assessment.score || 0);
  const pageCount = labResult?.siteGraph?.pages?.length || 1;

  return (
    <div className="mx-auto max-w-4xl space-y-8 py-8">
      {/* ====================================================================== */}
      {/* EXECUTIVE SUMMARY */}
      {/* ====================================================================== */}
      <section className="space-y-4">
        <div>
          <h1 className="mb-1 text-3xl font-bold text-slate-100">
            {companyName || 'Website UX Diagnostics'}
          </h1>
          {companyUrl && (
            <p className="text-sm text-slate-400">{companyUrl}</p>
          )}
        </div>

        <details open className="group">
          <summary className="cursor-pointer list-none">
            <div className="mb-4 flex items-center gap-2">
              <span className="text-slate-400 transition-transform group-open:rotate-90">
                ▶
              </span>
              <h2 className="text-xl font-bold text-slate-100">
                Executive Summary
              </h2>
            </div>
          </summary>

        <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-6 space-y-4">
          <div>
            <p className="text-xl font-bold text-slate-100">
              {gradeLabel} - Multi-page UX Lab analysis across {pageCount}{' '}
              {pageCount === 1 ? 'page' : 'pages'}
            </p>
          </div>

          {/* Executive Summary (LLM-generated) */}
          {assessment.executiveSummary && (
            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
                Overview
              </h3>
              <div className="whitespace-pre-line text-sm leading-relaxed text-slate-300">
                {assessment.executiveSummary}
              </div>
            </div>
          )}

          {/* Strategist View */}
          {assessment.strategistView && (
            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
                Strategist View
              </h3>
              <div className="whitespace-pre-line text-sm leading-relaxed text-slate-300">
                {assessment.strategistView}
              </div>
            </div>
          )}

          {/* Key Findings */}
          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Key Findings
            </h3>
            <ul className="space-y-1 text-sm text-slate-300">
              {assessment.funnelHealthScore !== undefined && (
                <li>
                  <strong>Funnel Health:</strong> {assessment.funnelHealthScore}
                  /100 -{' '}
                  {assessment.funnelHealthScore >= 70
                    ? 'Strong conversion paths'
                    : assessment.funnelHealthScore >= 50
                    ? 'Moderate funnel issues'
                    : 'Weak conversion paths, multiple dead ends'}
                </li>
              )}
              {assessment.multiPageConsistencyScore !== undefined && (
                <li>
                  <strong>Multi-Page Consistency:</strong>{' '}
                  {assessment.multiPageConsistencyScore}/100 -{' '}
                  {assessment.multiPageConsistencyScore >= 80
                    ? 'Excellent consistency'
                    : assessment.multiPageConsistencyScore >= 60
                    ? 'Good consistency'
                    : 'Inconsistent experience'}
                </li>
              )}
              {labResult?.personas && (
                <li>
                  <strong>Persona Success Rate:</strong> {personaSuccessRate}% of
                  personas achieved their goals
                </li>
              )}
              {labResult?.heuristics && (
                <li>
                  <strong>Heuristic Score:</strong>{' '}
                  {labResult.heuristics.overallScore}/100 (
                  {labResult.heuristics.findings.length} UX violations found)
                </li>
              )}
            </ul>
          </div>

          {/* Page-Level Performance */}
          {assessment.pageLevelScores &&
            assessment.pageLevelScores.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
                  Page-Level Performance
                </h3>
                <ul className="space-y-1 text-sm text-slate-300">
                  {assessment.pageLevelScores.map((page, idx) => (
                    <li key={idx}>
                      <strong>{page.path}</strong>: {page.score}/100
                    </li>
                  ))}
                </ul>
              </div>
            )}

          {/* Critical Actions */}
          {assessment.quickWins && assessment.quickWins.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
                Critical Actions
              </h3>
              <ul className="space-y-1 text-sm text-slate-300">
                {assessment.quickWins.slice(0, 3).map((win, idx) => (
                  <li key={idx}>• {win.title}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        </details>
      </section>

      {/* ====================================================================== */}
      {/* WHAT TO FIX FIRST - QUICK WINS (V5.5) */}
      {/* ====================================================================== */}
      {labResult?.impactMatrix?.quickWins && labResult.impactMatrix.quickWins.length > 0 && (
        <section className="space-y-3">
          <details open className="group">
            <summary className="cursor-pointer list-none">
              <div className="mb-4 flex items-center gap-2">
                <span className="text-slate-400 transition-transform group-open:rotate-90">
                  ▶
                </span>
                <h2 className="text-xl font-bold text-slate-100">
                  What to Fix First - Quick Wins
                </h2>
              </div>
            </summary>
            <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-6 space-y-4">
              <div className="mb-4">
                <p className="text-sm text-slate-400">
                  High-impact, low-effort improvements for immediate conversion gains
                </p>
              </div>
              <div className="space-y-3">
                {labResult.impactMatrix.quickWins.slice(0, 5).map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 rounded-lg border border-slate-600/50 bg-slate-800/50 p-4"
                  >
                    <div className="flex-shrink-0">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-700 text-sm font-bold text-slate-100">
                        {idx + 1}
                      </div>
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-sm font-semibold text-slate-100">
                          {item.title}
                        </h3>
                        <span className="flex-shrink-0 text-xs font-semibold text-green-400">
                          +{item.estimatedLift}% lift
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed text-slate-300">
                        {item.description}
                      </p>
                      <div className="flex gap-4 text-xs text-slate-400">
                        <span>Impact: <span className="font-medium text-slate-300">{item.impact}/5</span></span>
                        <span>•</span>
                        <span>Effort: <span className="font-medium text-slate-300">{item.effort}/5</span></span>
                        <span>•</span>
                        <span>Priority: <span className="font-medium capitalize text-slate-300">{item.priority}</span></span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </details>
        </section>
      )}

      {/* ====================================================================== */}
      {/* SECTION SCORES */}
      {/* ====================================================================== */}
      {assessment.sectionScores && (
        <section className="space-y-3">
          <details open className="group">
            <summary className="cursor-pointer list-none">
              <div className="mb-4 flex items-center gap-2">
                <span className="text-slate-400 transition-transform group-open:rotate-90">
                  ▶
                </span>
                <h2 className="text-xl font-bold text-slate-100">Section Scores</h2>
              </div>
            </summary>
            <div className="space-y-2 rounded-lg border border-slate-700 bg-slate-900/50 p-6">
              {Object.entries(assessment.sectionScores).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">
                    {formatSectionKey(key)}
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-slate-100">
                    {value}/100
                  </span>
                </div>
              ))}
            </div>
          </details>
        </section>
      )}

      {/* ====================================================================== */}
      {/* SECTION ANALYSES (ALL UX DIMENSIONS) */}
      {/* ====================================================================== */}
      {assessment.sectionAnalyses && assessment.sectionAnalyses.length > 0 && (
        <section className="space-y-4">
          <details open className="group">
            <summary className="cursor-pointer list-none">
              <div className="mb-4 flex items-center gap-2">
                <span className="text-slate-400 transition-transform group-open:rotate-90">
                  ▶
                </span>
                <h2 className="text-xl font-bold text-slate-100">
                  Section Analyses (All UX Dimensions)
                </h2>
              </div>
            </summary>
          <div className="space-y-6">
            {assessment.sectionAnalyses.map((analysis, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-slate-700 bg-slate-900/50 p-6 space-y-3"
              >
                {/* Dimension Title + Score */}
                <h3 className="text-lg font-semibold text-slate-100">
                  {formatDimensionLabel(analysis.dimension)}
                  {analysis.score !== undefined && (
                    <span className="ml-2 text-base font-normal text-slate-400">
                      {analysis.score}/100
                    </span>
                  )}
                </h3>

                {/* Verdict */}
                {analysis.verdict && (
                  <div>
                    <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Verdict
                    </h4>
                    <p className="text-sm font-medium text-slate-200">
                      {analysis.verdict}
                    </p>
                  </div>
                )}

                {/* Narrative */}
                {analysis.narrative && (
                  <div>
                    <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Narrative
                    </h4>
                    <p className="whitespace-pre-line text-sm leading-relaxed text-slate-300">
                      {analysis.narrative}
                    </p>
                  </div>
                )}

                {/* Key Findings */}
                {analysis.keyFindings && analysis.keyFindings.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Key Findings
                    </h4>
                    <ul className="space-y-1.5">
                      {analysis.keyFindings.map((finding, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-sm text-slate-300"
                        >
                          <span className="mt-0.5 flex-shrink-0 text-slate-500">
                            •
                          </span>
                          <span>{finding}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
          </details>
        </section>
      )}

      {/* ====================================================================== */}
      {/* ALL ISSUES */}
      {/* ====================================================================== */}
      {assessment.issues && assessment.issues.length > 0 && (
        <section className="space-y-3">
          <details open className="group">
            <summary className="cursor-pointer list-none">
              <div className="mb-4 flex items-center gap-2">
                <span className="text-slate-400 transition-transform group-open:rotate-90">
                  ▶
                </span>
                <h2 className="text-xl font-bold text-slate-100">
                  All Issues ({assessment.issues.length})
                </h2>
              </div>
            </summary>
          <div className="space-y-4 rounded-lg border border-slate-700 bg-slate-900/50 p-6">
            {assessment.issues.map((issue, idx) => (
              <div key={issue.id || idx} className="space-y-1.5">
                <div className="text-xs font-semibold uppercase text-slate-500">
                  {issue.severity}
                </div>
                <div className="text-sm font-medium text-slate-200">
                  {issue.tag}
                </div>
                <p className="text-sm leading-relaxed text-slate-300">
                  {issue.description}
                </p>
                {issue.evidence && (
                  <p className="text-xs text-slate-500">
                    Evidence: {issue.evidence}
                  </p>
                )}
              </div>
            ))}
          </div>
          </details>
        </section>
      )}

      {/* ====================================================================== */}
      {/* ALL RECOMMENDATIONS */}
      {/* ====================================================================== */}
      {assessment.recommendations && assessment.recommendations.length > 0 && (
        <section className="space-y-3">
          <details open className="group">
            <summary className="cursor-pointer list-none">
              <div className="mb-4 flex items-center gap-2">
                <span className="text-slate-400 transition-transform group-open:rotate-90">
                  ▶
                </span>
                <h2 className="text-xl font-bold text-slate-100">
                  All Recommendations ({assessment.recommendations.length})
                </h2>
              </div>
            </summary>
          <div className="space-y-4 rounded-lg border border-slate-700 bg-slate-900/50 p-6">
            {assessment.recommendations.map((rec, idx) => (
              <div key={rec.id || idx} className="space-y-1.5">
                <div className="text-xs font-semibold uppercase text-slate-500">
                  {rec.priority}
                </div>
                <div className="text-sm font-medium text-slate-200">
                  {rec.tag}
                </div>
                <p className="text-sm leading-relaxed text-slate-300">
                  {rec.description}
                </p>
                {rec.evidence && (
                  <p className="text-xs text-slate-500">
                    Evidence: {rec.evidence}
                  </p>
                )}
              </div>
            ))}
          </div>
          </details>
        </section>
      )}

      {/* ====================================================================== */}
      {/* CONVERSION STRATEGIST VIEW (V5.8) */}
      {/* ====================================================================== */}
      {labResult?.strategistViews?.conversion && (
        <section className="space-y-3">
          <details open className="group">
            <summary className="cursor-pointer list-none">
              <div className="mb-4 flex items-center gap-2">
                <span className="text-slate-400 transition-transform group-open:rotate-90">
                  ▶
                </span>
                <h2 className="text-xl font-bold text-slate-100">
                  Conversion Strategist View
                </h2>
              </div>
            </summary>
            <div className="space-y-4 rounded-lg border border-slate-700 bg-slate-900/50 p-6">
              <div className="text-sm text-slate-300">
                <strong className="text-slate-200">Conversion Readiness:</strong>{' '}
                {labResult.strategistViews.conversion.conversionReadinessScore}/100
              </div>
              <div className="whitespace-pre-line text-sm leading-relaxed text-slate-300">
                {labResult.strategistViews.conversion.narrative}
              </div>
            </div>
          </details>
        </section>
      )}

      {/* ====================================================================== */}
      {/* COPYWRITING STRATEGIST VIEW (V5.9) */}
      {/* ====================================================================== */}
      {labResult?.strategistViews?.copywriting && (
        <section className="space-y-3">
          <details open className="group">
            <summary className="cursor-pointer list-none">
              <div className="mb-4 flex items-center gap-2">
                <span className="text-slate-400 transition-transform group-open:rotate-90">
                  ▶
                </span>
                <h2 className="text-xl font-bold text-slate-100">
                  Copywriting Strategist View
                </h2>
              </div>
            </summary>
            <div className="space-y-4 rounded-lg border border-slate-700 bg-slate-900/50 p-6">
              <div className="text-sm text-slate-300">
                <strong className="text-slate-200">Messaging Clarity:</strong>{' '}
                {labResult.strategistViews.copywriting.messagingClarityScore}/100
              </div>
              <div className="whitespace-pre-line text-sm leading-relaxed text-slate-300">
                {labResult.strategistViews.copywriting.narrative}
              </div>
              {labResult.strategistViews.copywriting.toneAnalysis && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Tone Analysis
                  </h3>
                  <div className="text-xs text-slate-400">
                    Detected: {labResult.strategistViews.copywriting.toneAnalysis.detectedTone}
                  </div>
                </div>
              )}
            </div>
          </details>
        </section>
      )}

      {/* ====================================================================== */}
      {/* PERSONA SIMULATION (Enhanced V5.7) */}
      {/* ====================================================================== */}
      {labResult?.personas && labResult.personas.length > 0 && (
        <section className="space-y-3">
          <details open className="group">
            <summary className="cursor-pointer list-none">
              <div className="mb-4 flex items-center gap-2">
                <span className="text-slate-400 transition-transform group-open:rotate-90">
                  ▶
                </span>
                <h2 className="text-xl font-bold text-slate-100">
                  Persona Simulation ({labResult.personas.length} personas)
                </h2>
              </div>
            </summary>
          <div className="space-y-4 rounded-lg border border-slate-700 bg-slate-900/50 p-6">
            {labResult.personas.map((persona, idx) => (
              <div key={idx} className="space-y-2 rounded border border-slate-700 bg-slate-900/30 p-3">
                <div className="flex items-center justify-between">
                  <strong className="text-sm text-slate-200">
                    {persona.persona.replace(/_/g, ' ').toUpperCase()}
                  </strong>
                  <span className={`text-xs ${persona.success ? 'text-green-400' : 'text-red-400'}`}>
                    {persona.success ? '✓ Success' : '✗ Failed'}
                  </span>
                </div>
                <div className="text-xs text-slate-400">
                  <strong>Goal:</strong> {persona.goal}
                </div>
                <div className="text-xs text-slate-400">
                  <strong>Clarity:</strong> {persona.perceivedClarityScore}/100
                </div>
                {persona.expectedPath && persona.expectedPath.length > 0 && (
                  <div className="text-xs text-slate-400">
                    <strong className="text-slate-300">Expected:</strong> {persona.expectedPath.join(' → ')}
                  </div>
                )}
                <div className="text-xs text-slate-400">
                  <strong className="text-slate-300">Actual:</strong> {persona.stepsTaken.join(' → ')}
                </div>
                {persona.personaSpecificFixes && persona.personaSpecificFixes.length > 0 && (
                  <div>
                    <div className="mb-1 text-xs font-semibold text-slate-500">
                      Persona-Specific Fixes:
                    </div>
                    <ul className="space-y-0.5">
                      {persona.personaSpecificFixes.map((fix, i) => (
                        <li key={i} className="text-xs text-slate-400">
                          • {fix}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {persona.frictionNotes && persona.frictionNotes.length > 0 && (
                  <div>
                    <div className="mb-1 text-xs font-semibold text-slate-500">
                      Friction Points:
                    </div>
                    <ul className="space-y-0.5">
                      {persona.frictionNotes.map((note, i) => (
                        <li key={i} className="text-xs text-slate-400">
                          • {note}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
          </details>
        </section>
      )}

      {/* ====================================================================== */}
      {/* FUNNEL & CONVERSION FLOW */}
      {/* ====================================================================== */}
      {(assessment.funnelHealthScore !== undefined ||
        assessment.multiPageConsistencyScore !== undefined) && (
        <section className="space-y-3">
          <details open className="group">
            <summary className="cursor-pointer list-none">
              <div className="mb-4 flex items-center gap-2">
                <span className="text-slate-400 transition-transform group-open:rotate-90">
                  ▶
                </span>
                <h2 className="text-xl font-bold text-slate-100">
                  Funnel & Conversion Flow
                </h2>
              </div>
            </summary>
          <div className="space-y-2 rounded-lg border border-slate-700 bg-slate-900/50 p-6">
            {assessment.funnelHealthScore !== undefined && (
              <div className="text-sm text-slate-300">
                <strong className="text-slate-200">Funnel health score:</strong>{' '}
                {assessment.funnelHealthScore}/100
              </div>
            )}
            {assessment.multiPageConsistencyScore !== undefined && (
              <div className="text-sm text-slate-300">
                <strong className="text-slate-200">
                  Multi-page consistency:
                </strong>{' '}
                {assessment.multiPageConsistencyScore}/100
              </div>
            )}
          </div>
          </details>
        </section>
      )}

      {/* ====================================================================== */}
      {/* CTA INTELLIGENCE (V5.1) */}
      {/* ====================================================================== */}
      {labResult?.ctaIntelligence && (
        <section className="space-y-3">
          <details open className="group">
            <summary className="cursor-pointer list-none">
              <div className="mb-4 flex items-center gap-2">
                <span className="text-slate-400 transition-transform group-open:rotate-90">
                  ▶
                </span>
                <h2 className="text-xl font-bold text-slate-100">
                  CTA Intelligence Analysis
                </h2>
              </div>
            </summary>
            <div className="space-y-4 rounded-lg border border-slate-700 bg-slate-900/50 p-6">
              {/* Summary Score */}
              <div className="text-sm text-slate-300">
                <strong className="text-slate-200">Overall CTA Quality:</strong>{' '}
                {labResult.ctaIntelligence.summaryScore}/100
              </div>

              {/* Narrative */}
              <div className="whitespace-pre-line text-sm leading-relaxed text-slate-300">
                {labResult.ctaIntelligence.narrative}
              </div>

              {/* Top CTAs */}
              {labResult.ctaIntelligence.ctas.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Top CTAs Analyzed ({labResult.ctaIntelligence.ctas.length})
                  </h3>
                  <div className="space-y-2">
                    {labResult.ctaIntelligence.ctas.slice(0, 5).map((cta, idx) => (
                      <div key={idx} className="text-xs text-slate-400">
                        <span className="font-medium text-slate-300">"{cta.text}"</span>
                        {' '}- Score: {cta.overallScore}/100
                        {cta.issues.length > 0 && (
                          <span className="ml-2 text-slate-500">
                            ({cta.issues[0]})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {labResult.ctaIntelligence.recommendations.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Key Recommendations
                  </h3>
                  <ul className="space-y-1">
                    {labResult.ctaIntelligence.recommendations.slice(0, 3).map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-slate-300">
                        <span className="mt-0.5 flex-shrink-0 text-slate-500">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </details>
        </section>
      )}

      {/* ====================================================================== */}
      {/* CONTENT INTELLIGENCE (V5.2) */}
      {/* ====================================================================== */}
      {labResult?.contentIntelligence && (
        <section className="space-y-3">
          <details open className="group">
            <summary className="cursor-pointer list-none">
              <div className="mb-4 flex items-center gap-2">
                <span className="text-slate-400 transition-transform group-open:rotate-90">
                  ▶
                </span>
                <h2 className="text-xl font-bold text-slate-100">
                  Content Intelligence Analysis
                </h2>
              </div>
            </summary>
            <div className="space-y-4 rounded-lg border border-slate-700 bg-slate-900/50 p-6">
              {/* Summary Score */}
              <div className="text-sm text-slate-300">
                <strong className="text-slate-200">Content Quality Score:</strong>{' '}
                {labResult.contentIntelligence.summaryScore}/100
              </div>

              {/* Narrative */}
              <div className="whitespace-pre-line text-sm leading-relaxed text-slate-300">
                {labResult.contentIntelligence.narrative}
              </div>

              {/* Quality Metrics */}
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Quality Metrics
                </h3>
                <div className="space-y-1 text-xs text-slate-400">
                  <div>Reading Level: Grade {labResult.contentIntelligence.qualityMetrics.readingLevel}</div>
                  <div>Jargon Density: {labResult.contentIntelligence.qualityMetrics.jargonDensity}%</div>
                  <div>Benefit Focus: {labResult.contentIntelligence.qualityMetrics.benefitRatio}%</div>
                  <div>Proof-Backed Claims: {labResult.contentIntelligence.qualityMetrics.proofBackedClaims}</div>
                </div>
              </div>

              {/* Improvements */}
              {labResult.contentIntelligence.improvements.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Key Improvements
                  </h3>
                  <ul className="space-y-1">
                    {labResult.contentIntelligence.improvements.map((imp, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-slate-300">
                        <span className="mt-0.5 flex-shrink-0 text-slate-500">•</span>
                        <span>{imp}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </details>
        </section>
      )}

      {/* ====================================================================== */}
      {/* TRUST SIGNAL ANALYSIS (V5.3) */}
      {/* ====================================================================== */}
      {labResult?.trustAnalysis && (
        <section className="space-y-3">
          <details open className="group">
            <summary className="cursor-pointer list-none">
              <div className="mb-4 flex items-center gap-2">
                <span className="text-slate-400 transition-transform group-open:rotate-90">
                  ▶
                </span>
                <h2 className="text-xl font-bold text-slate-100">
                  Trust Signal Analysis
                </h2>
              </div>
            </summary>
            <div className="space-y-4 rounded-lg border border-slate-700 bg-slate-900/50 p-6">
              {/* Summary Score */}
              <div className="text-sm text-slate-300">
                <strong className="text-slate-200">Trust Score:</strong>{' '}
                {labResult.trustAnalysis.trustScore}/100
                <span className="ml-4 text-slate-400">
                  Density: {labResult.trustAnalysis.overallDensity.toFixed(1)}/5
                </span>
              </div>

              {/* Narrative */}
              <div className="whitespace-pre-line text-sm leading-relaxed text-slate-300">
                {labResult.trustAnalysis.narrative}
              </div>

              {/* Trust Signals Found */}
              {labResult.trustAnalysis.signals.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Trust Signals Detected ({labResult.trustAnalysis.signals.length})
                  </h3>
                  <div className="space-y-1">
                    {labResult.trustAnalysis.signals.slice(0, 5).map((signal, idx) => (
                      <div key={idx} className="text-xs text-slate-400">
                        <span className="font-medium text-slate-300">{signal.type}</span>
                        {' '}- {signal.description.substring(0, 80)}...
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fixes */}
              {labResult.trustAnalysis.fixes.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Recommended Additions
                  </h3>
                  <ul className="space-y-1">
                    {labResult.trustAnalysis.fixes.map((fix, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-slate-300">
                        <span className="mt-0.5 flex-shrink-0 text-slate-500">•</span>
                        <span>{fix}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </details>
        </section>
      )}

      {/* ====================================================================== */}
      {/* VISUAL + BRAND EVALUATION (V5.4) */}
      {/* ====================================================================== */}
      {labResult?.visualBrandEvaluation && (
        <section className="space-y-3">
          <details open className="group">
            <summary className="cursor-pointer list-none">
              <div className="mb-4 flex items-center gap-2">
                <span className="text-slate-400 transition-transform group-open:rotate-90">
                  ▶
                </span>
                <h2 className="text-xl font-bold text-slate-100">
                  Visual + Brand Evaluation
                </h2>
              </div>
            </summary>
            <div className="space-y-4 rounded-lg border border-slate-700 bg-slate-900/50 p-6">
              {/* Summary Scores */}
              <div className="space-y-1 text-sm text-slate-300">
                <div>
                  <strong className="text-slate-200">Overall Visual Quality:</strong>{' '}
                  {labResult.visualBrandEvaluation.overallVisualScore}/100
                </div>
                <div className="text-xs text-slate-400">
                  Visual Modernity: {labResult.visualBrandEvaluation.visualModernityScore}/100
                  {' • '}
                  Brand Consistency: {labResult.visualBrandEvaluation.brandConsistencyScore}/100
                </div>
              </div>

              {/* Narrative */}
              <div className="whitespace-pre-line text-sm leading-relaxed text-slate-300">
                {labResult.visualBrandEvaluation.narrative}
              </div>

              {/* Color & Typography */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Color Palette
                  </h3>
                  <div className="text-xs text-slate-400">
                    {labResult.visualBrandEvaluation.colorHarmony.primaryColors.length} colors detected
                    <br />
                    Harmony: {labResult.visualBrandEvaluation.colorHarmony.harmonyScore}/100
                  </div>
                </div>
                <div>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Typography
                  </h3>
                  <div className="text-xs text-slate-400">
                    {labResult.visualBrandEvaluation.typography.fontFamilies.length} font families
                    <br />
                    Pairing: {labResult.visualBrandEvaluation.typography.pairingScore}/100
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              {labResult.visualBrandEvaluation.recommendations.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Visual Improvements
                  </h3>
                  <ul className="space-y-1">
                    {labResult.visualBrandEvaluation.recommendations.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-slate-300">
                        <span className="mt-0.5 flex-shrink-0 text-slate-500">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </details>
        </section>
      )}

      {/* ====================================================================== */}
      {/* IMPACT MATRIX (V5.5) */}
      {/* ====================================================================== */}
      {labResult?.impactMatrix && (
        <section className="space-y-3">
          <details open className="group">
            <summary className="cursor-pointer list-none">
              <div className="mb-4 flex items-center gap-2">
                <span className="text-slate-400 transition-transform group-open:rotate-90">
                  ▶
                </span>
                <h2 className="text-xl font-bold text-slate-100">
                  Impact Matrix - Prioritization Framework
                </h2>
              </div>
            </summary>
            <div className="space-y-4 rounded-lg border border-slate-700 bg-slate-900/50 p-6">
              {/* Narrative */}
              <div className="whitespace-pre-line text-sm leading-relaxed text-slate-300">
                {labResult.impactMatrix.narrative}
              </div>

              {/* Quick Wins */}
              {labResult.impactMatrix.quickWins.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    🎯 Quick Wins (High Impact, Low Effort)
                  </h3>
                  <div className="space-y-2">
                    {labResult.impactMatrix.quickWins.slice(0, 5).map((item, idx) => (
                      <div key={idx} className="rounded border border-slate-700 bg-slate-900/30 p-3">
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-200">
                            {item.title}
                          </span>
                          <span className="text-xs text-slate-400">
                            Est. +{item.estimatedLift}% lift
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">{item.description}</p>
                        <div className="mt-1 text-xs text-slate-500">
                          Impact: {item.impact}/5 • Effort: {item.effort}/5
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Major Projects */}
              {labResult.impactMatrix.majorProjects.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    🚀 Major Projects (High Impact, High Effort)
                  </h3>
                  <div className="space-y-1">
                    {labResult.impactMatrix.majorProjects.slice(0, 3).map((item, idx) => (
                      <div key={idx} className="text-sm text-slate-300">
                        • {item.title} (Est. +{item.estimatedLift}%)
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </details>
        </section>
      )}

      {/* ====================================================================== */}
      {/* SCENT TRAIL ANALYSIS (V5.6) */}
      {/* ====================================================================== */}
      {labResult?.scentTrailAnalysis && (
        <section className="space-y-3">
          <details open className="group">
            <summary className="cursor-pointer list-none">
              <div className="mb-4 flex items-center gap-2">
                <span className="text-slate-400 transition-transform group-open:rotate-90">
                  ▶
                </span>
                <h2 className="text-xl font-bold text-slate-100">
                  Scent Trail Analysis - Message Continuity
                </h2>
              </div>
            </summary>
            <div className="space-y-4 rounded-lg border border-slate-700 bg-slate-900/50 p-6">
              {/* Summary Score */}
              <div className="text-sm text-slate-300">
                <strong className="text-slate-200">Overall Scent Trail Score:</strong>{' '}
                {labResult.scentTrailAnalysis.overallScore}/100
              </div>

              {/* Narrative */}
              <div className="whitespace-pre-line text-sm leading-relaxed text-slate-300">
                {labResult.scentTrailAnalysis.narrative}
              </div>

              {/* Mismatches */}
              {labResult.scentTrailAnalysis.mismatches.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Detected Mismatches ({labResult.scentTrailAnalysis.mismatches.length})
                  </h3>
                  <div className="space-y-2">
                    {labResult.scentTrailAnalysis.mismatches.slice(0, 5).map((mismatch, idx) => (
                      <div key={idx} className="text-xs text-slate-400">
                        <span className="font-medium text-slate-300">{mismatch.type}</span>
                        {' '}- {mismatch.description}
                        <div className="mt-0.5 text-slate-500">
                          {mismatch.fromPage} → {mismatch.toPage}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fixes */}
              {labResult.scentTrailAnalysis.fixes.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Recommended Fixes
                  </h3>
                  <ul className="space-y-1">
                    {labResult.scentTrailAnalysis.fixes.map((fix, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-slate-300">
                        <span className="mt-0.5 flex-shrink-0 text-slate-500">•</span>
                        <span>{fix}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </details>
        </section>
      )}

      {/* ====================================================================== */}
      {/* RAW JSON (DEV ONLY - COLLAPSIBLE) */}
      {/* ====================================================================== */}
      {process.env.NODE_ENV !== 'production' && (
        <section>
          <details className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-slate-400 hover:text-slate-300">
              Raw JSON (Debug)
            </summary>
            <div className="mt-4 max-h-96 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-4">
              <pre className="text-xs text-slate-300">
                {JSON.stringify({ assessment, labResult }, null, 2)}
              </pre>
            </div>
          </details>
        </section>
      )}
    </div>
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatSectionKey(key: string): string {
  // Convert camelCase to Title Case with spaces
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

function formatDimensionLabel(dimension: WebsiteUxDimensionKey): string {
  const labels: Record<WebsiteUxDimensionKey, string> = {
    overall_experience: 'Overall Experience',
    hero_and_value_prop: 'Hero & Value Prop',
    navigation_and_structure: 'Navigation & Structure',
    trust_and_social_proof: 'Trust & Social Proof',
    conversion_flow: 'Conversion Flow',
    content_and_clarity: 'Content & Clarity',
    visual_and_mobile: 'Visual & Mobile',
    intent_alignment: 'Intent Alignment',
  };
  return labels[dimension] || dimension;
}
