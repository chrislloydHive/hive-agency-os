// components/gap/GrowthPlanNarrativeReport.tsx
// Growth Acceleration Plan - Narrative Report (Text-First, Consultant Style)

import type { GrowthAccelerationPlan } from '@/lib/growth-plan/growthActionPlanSchema';

type Props = {
  plan: GrowthAccelerationPlan;
};

export function GrowthPlanNarrativeReport({ plan }: Props) {
  const overallScore = plan.executiveSummary?.overallScore || plan.scorecard?.overall || 0;

  return (
    <div className="mx-auto max-w-4xl space-y-8 py-8">
      {/* ====================================================================== */}
      {/* EXECUTIVE SUMMARY */}
      {/* ====================================================================== */}
      <section className="space-y-4">
        <div>
          <h1 className="mb-1 text-3xl font-bold text-slate-100">
            {plan.companyName}
          </h1>
          {plan.websiteUrl && (
            <p className="text-sm text-slate-400">{plan.websiteUrl.replace(/^https?:\/\//, '')}</p>
          )}
          <p className="text-xs text-slate-500 mt-2">
            Powered by Hive — your on-demand marketing operations partner.
          </p>
        </div>

        {/* Compact Dimension Scorecard */}
        {plan.scorecard && (
          <div className="rounded-lg border border-slate-700/50 bg-slate-900/30 p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              {plan.scorecard.brand !== undefined && (
                <div>
                  <div className="text-xs text-slate-500 mb-1">Brand</div>
                  <div className="text-sm font-bold text-slate-200">{Math.round(plan.scorecard.brand)}</div>
                </div>
              )}
              {plan.scorecard.content !== undefined && (
                <div>
                  <div className="text-xs text-slate-500 mb-1">Content</div>
                  <div className="text-sm font-bold text-slate-200">{Math.round(plan.scorecard.content)}</div>
                </div>
              )}
              {plan.scorecard.seo !== undefined && (
                <div>
                  <div className="text-xs text-slate-500 mb-1">SEO</div>
                  <div className="text-sm font-bold text-slate-200">{Math.round(plan.scorecard.seo)}</div>
                </div>
              )}
              {plan.scorecard.website !== undefined && (
                <div>
                  <div className="text-xs text-slate-500 mb-1">Website</div>
                  <div className="text-sm font-bold text-slate-200">{Math.round(plan.scorecard.website)}</div>
                </div>
              )}
              {plan.scorecard.authority !== undefined && (
                <div>
                  <div className="text-xs text-slate-500 mb-1">Authority</div>
                  <div className="text-sm font-bold text-slate-200">{Math.round(plan.scorecard.authority)}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Business Context Snapshot */}
        {plan.executiveSummary?.maturityStage && (
          <div className="rounded-lg border border-amber-700/50 bg-amber-900/10 p-6">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-amber-400">
              Business Context Snapshot
            </h3>

            <div className="grid grid-cols-2 gap-4 text-sm">
              {plan.executiveSummary?.maturityStage && (
                <div>
                  <div className="text-xs text-slate-400 mb-1">Maturity Stage</div>
                  <div className="font-medium text-slate-200">
                    {plan.executiveSummary.maturityStage}
                  </div>
                </div>
              )}

              <div>
                <div className="text-xs text-slate-400 mb-1">Overall Score</div>
                <div className="text-xl font-bold text-amber-400">
                  {Math.round(overallScore)}/100
                </div>
              </div>
            </div>
          </div>
        )}

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
                Overall Growth Score: {Math.round(overallScore)}/100
                {plan.executiveSummary?.maturityStage && (
                  <span className="text-slate-400"> ({plan.executiveSummary.maturityStage})</span>
                )}
              </p>
            </div>

            {/* Narrative */}
            {plan.executiveSummary?.narrative && (
              <div>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
                  Overview
                </h3>
                <p className="text-sm leading-relaxed text-slate-300 whitespace-pre-line">
                  {plan.executiveSummary.narrative}
                </p>
              </div>
            )}

            {/* Key Strengths */}
            {plan.executiveSummary?.strengths && plan.executiveSummary.strengths.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
                  Key Strengths
                </h3>
                <ul className="space-y-1 text-sm text-slate-300">
                  {plan.executiveSummary.strengths.map((strength, idx) => (
                    <li key={idx}>• {strength}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Key Issues */}
            {plan.executiveSummary?.keyIssues && plan.executiveSummary.keyIssues.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
                  Key Issues
                </h3>
                <ul className="space-y-1 text-sm text-slate-300">
                  {plan.executiveSummary.keyIssues.map((issue, idx) => (
                    <li key={idx}>• {issue}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Strategic Priorities */}
            {plan.executiveSummary?.strategicPriorities && plan.executiveSummary.strategicPriorities.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
                  Strategic Priorities
                </h3>
                <ul className="space-y-1 text-sm text-slate-300">
                  {plan.executiveSummary.strategicPriorities.map((priority, idx) => (
                    <li key={idx}>• {priority}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </details>
      </section>

      {/* ====================================================================== */}
      {/* SCORECARD */}
      {/* ====================================================================== */}
      {plan.scorecard && (
        <section className="space-y-3">
          <details open className="group">
            <summary className="cursor-pointer list-none">
              <div className="mb-4 flex items-center gap-2">
                <span className="text-slate-400 transition-transform group-open:rotate-90">
                  ▶
                </span>
                <h2 className="text-xl font-bold text-slate-100">Scorecard</h2>
              </div>
            </summary>
            <div className="space-y-4 rounded-lg border border-slate-700 bg-slate-900/50 p-6">
              <p className="text-sm text-slate-400">
                Each dimension is scored 0-100 based on industry best practices and competitive benchmarks. Scores indicate current performance and highlight areas for improvement.
              </p>
              <div className="space-y-2">
              {plan.scorecard.brand !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">Brand & Positioning</span>
                  <span className="text-sm font-semibold tabular-nums text-slate-100">
                    {Math.round(plan.scorecard.brand)}/100
                  </span>
                </div>
              )}
              {plan.scorecard.content !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">Content & Messaging</span>
                  <span className="text-sm font-semibold tabular-nums text-slate-100">
                    {Math.round(plan.scorecard.content)}/100
                  </span>
                </div>
              )}
              {plan.scorecard.seo !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">SEO & Visibility</span>
                  <span className="text-sm font-semibold tabular-nums text-slate-100">
                    {Math.round(plan.scorecard.seo)}/100
                  </span>
                </div>
              )}
              {plan.scorecard.website !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">Website & Conversion</span>
                  <span className="text-sm font-semibold tabular-nums text-slate-100">
                    {Math.round(plan.scorecard.website)}/100
                  </span>
                </div>
              )}
              </div>
            </div>
          </details>
        </section>
      )}

      {/* ====================================================================== */}
      {/* QUICK WINS */}
      {/* ====================================================================== */}
      {plan.quickWins && plan.quickWins.length > 0 && (
        <section className="space-y-3">
          <details open className="group">
            <summary className="cursor-pointer list-none">
              <div className="mb-4 flex items-center gap-2">
                <span className="text-slate-400 transition-transform group-open:rotate-90">
                  ▶
                </span>
                <h2 className="text-xl font-bold text-slate-100">
                  0–30 Days
                </h2>
              </div>
            </summary>
            <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-6 space-y-4">
              <div className="mb-4">
                <p className="text-sm text-slate-400">
                  High-priority, low-effort actions for immediate impact
                </p>
              </div>
              <div className="space-y-3">
                {plan.quickWins.slice(0, 10).map((win, idx) => (
                  <div
                    key={win.id}
                    className="rounded-lg border border-slate-600/50 bg-slate-800/50 p-4 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="text-sm leading-relaxed text-slate-300">
                          {(() => {
                            const sentences = win.title.split(/(?<=[.!?])\s+/);
                            const firstSentence = sentences[0];
                            const restSentences = sentences.slice(1).join(' ');

                            return (
                              <>
                                <span className="font-semibold text-slate-100">
                                  {idx + 1}. {firstSentence}
                                </span>
                                {restSentences && (
                                  <span> {restSentences}</span>
                                )}
                              </>
                            );
                          })()}
                        </p>
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-2">
                        {(win as any).category && (
                          <span className="text-xs font-medium text-slate-400">
                            {(win as any).category}
                          </span>
                        )}
                        {(win as any).expectedImpact && (
                          <span className={`text-xs font-medium capitalize ${
                            (win as any).expectedImpact === 'high' ? 'text-green-400' :
                            (win as any).expectedImpact === 'medium' ? 'text-amber-400' :
                            'text-slate-400'
                          }`}>
                            {(win as any).expectedImpact} impact
                          </span>
                        )}
                        {(win as any).effortLevel && (
                          <span className="text-xs font-medium text-slate-500">
                            {(win as any).effortLevel} effort
                          </span>
                        )}
                      </div>
                    </div>
                    {win.description && win.description !== win.title && (
                      <p className="text-sm leading-relaxed text-slate-300">
                        {win.description}
                      </p>
                    )}
                    {win.expectedOutcome && (
                      <p className="text-xs text-slate-400">
                        Expected: {win.expectedOutcome}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </details>
        </section>
      )}

      {/* ====================================================================== */}
      {/* STRATEGIC PRIORITIES */}
      {/* ====================================================================== */}
      {plan.strategicInitiatives && plan.strategicInitiatives.length > 0 && (
        <section className="space-y-3">
          <details open className="group">
            <summary className="cursor-pointer list-none">
              <div className="mb-4 flex items-center gap-2">
                <span className="text-slate-400 transition-transform group-open:rotate-90">
                  ▶
                </span>
                <h2 className="text-xl font-bold text-slate-100">
                  Strategic Priorities
                </h2>
              </div>
            </summary>
            <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-6 space-y-4">
              <div className="mb-4">
                <p className="text-sm text-slate-400">
                  Long-term priorities for sustainable growth
                </p>
              </div>
              <div className="space-y-4">
                {plan.strategicInitiatives.slice(0, 10).map((priority, idx) => (
                  <div
                    key={priority.id}
                    className="rounded-lg border border-slate-600/50 bg-slate-800/50 p-4 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-sm font-semibold text-slate-100">
                        {idx + 1}. {priority.title}
                      </h3>
                      <span className="flex-shrink-0 text-xs font-medium capitalize text-slate-400">
                        {priority.timeHorizon?.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed text-slate-300">
                      {priority.description}
                    </p>
                    {priority.expectedOutcome && (
                      <p className="text-xs text-slate-400">
                        Expected: {priority.expectedOutcome}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </details>
        </section>
      )}

      {/* ====================================================================== */}
      {/* SECTION ANALYSES */}
      {/* ====================================================================== */}
      {plan.sectionAnalyses && Object.keys(plan.sectionAnalyses).length > 0 &&
        Object.entries(plan.sectionAnalyses).map(([key, analysis]) => {
            const sectionLabels: Record<string, string> = {
              brand: 'Brand & Positioning',
              content: 'Content & Messaging',
              seo: 'SEO & Visibility',
              website: 'Website & Conversion',
              brandAndPositioning: 'Brand & Positioning',
              contentAndMessaging: 'Content & Messaging',
              seoAndVisibility: 'SEO & Visibility',
              websiteAndConversion: 'Website & Conversion',
            };

            const sectionLabel = sectionLabels[key] || key;
            const sectionData = analysis as any;

            // Get narrative from dimensionNarratives if available
            const narrative = plan.dimensionNarratives?.[key as keyof typeof plan.dimensionNarratives];

            // Debug: log to see if narrative exists
            if (typeof window !== 'undefined') {
              console.log(`[${key}] Has narrative:`, !!narrative, 'First 100 chars:', narrative?.substring(0, 100));
            }

            return (
              <section key={key} className="space-y-3">
                <details open className="group">
                  <summary className="cursor-pointer list-none">
                    <div className="mb-4 flex items-center gap-2">
                      <span className="text-slate-400 transition-transform group-open:rotate-90">
                        ▶
                      </span>
                      <h2 className="text-xl font-bold text-slate-100">
                        {sectionLabel}
                      </h2>
                    </div>
                  </summary>
                  <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-6 space-y-4">
                    {narrative && (
                      <div>
                        <p className="text-sm leading-relaxed text-slate-300 whitespace-pre-line">
                          {narrative}
                        </p>
                      </div>
                    )}

                    {sectionData.summary && (
                      <div>
                        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Summary
                        </h4>
                        <p className="text-sm leading-relaxed text-slate-300">
                          {sectionData.summary}
                        </p>
                      </div>
                    )}

                    {sectionData.keyFindings && sectionData.keyFindings.length > 0 && (
                      <div>
                        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Key Findings
                        </h4>
                        <ul className="space-y-1 text-sm text-slate-300">
                          {sectionData.keyFindings.map((finding: string, idx: number) => (
                            <li key={idx}>• {finding}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {sectionData.quickWins && sectionData.quickWins.length > 0 && (
                      <div>
                        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Quick Wins
                        </h4>
                        <ul className="space-y-1 text-sm text-slate-300">
                          {sectionData.quickWins.map((win: string, idx: number) => (
                            <li key={idx}>• {win}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {sectionData.deeperInitiatives && sectionData.deeperInitiatives.length > 0 && (
                      <div>
                        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Deeper Initiatives
                        </h4>
                        <ul className="space-y-1 text-sm text-slate-300">
                          {sectionData.deeperInitiatives.map((initiative: string, idx: number) => (
                            <li key={idx}>• {initiative}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </details>
              </section>
            );
          })
      }

      {/* ====================================================================== */}
      {/* 90-DAY ROADMAP */}
      {/* ====================================================================== */}
      {plan.roadmap && plan.roadmap.length > 0 && (
        <section className="space-y-3">
          <details open className="group">
            <summary className="cursor-pointer list-none">
              <div className="mb-4 flex items-center gap-2">
                <span className="text-slate-400 transition-transform group-open:rotate-90">
                  ▶
                </span>
                <h2 className="text-xl font-bold text-slate-100">
                  90-Day Execution Roadmap
                </h2>
              </div>
            </summary>

            <div className="space-y-6">
              {plan.roadmap.map((phase, idx) => (
                <div key={idx} className="rounded-lg border border-slate-700 bg-slate-900/50 p-6 space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-100">{phase.phase}</h3>
                    <p className="text-sm text-slate-400">{phase.focus}</p>
                  </div>

                  {phase.businessRationale && (
                    <div className="pl-15">
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Why This Phase Matters
                      </h4>
                      <p className="text-sm leading-relaxed text-slate-300">
                        {phase.businessRationale}
                      </p>
                    </div>
                  )}

                  <div className="pl-15">
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Key Actions
                    </h4>
                    <ul className="space-y-2 text-sm text-slate-300">
                      {phase.actions.map((action, actionIdx) => (
                        <li key={actionIdx} className="flex items-start gap-2">
                          <span className="text-amber-400 mt-1">→</span>
                          <span>{action}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </details>
        </section>
      )}

      {/* ====================================================================== */}
      {/* KEY PERFORMANCE INDICATORS */}
      {/* ====================================================================== */}
      {plan.kpis && plan.kpis.length > 0 && (
        <section className="space-y-3">
          <details open className="group">
            <summary className="cursor-pointer list-none">
              <div className="mb-4 flex items-center gap-2">
                <span className="text-slate-400 transition-transform group-open:rotate-90">
                  ▶
                </span>
                <h2 className="text-xl font-bold text-slate-100">
                  Key Performance Indicators
                </h2>
              </div>
            </summary>

            <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-6">
              <div className="space-y-4">
                {plan.kpis.map((kpi, idx) => (
                  <div key={idx} className="pb-4 border-b border-slate-800 last:border-b-0 last:pb-0">
                    <h3 className="text-base font-semibold text-slate-100 mb-2">
                      {kpi.name}
                    </h3>

                    <div className="space-y-2">
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                          What It Measures
                        </h4>
                        <p className="text-sm text-slate-300">{kpi.description}</p>
                      </div>

                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                          Why It Matters
                        </h4>
                        <p className="text-sm text-slate-300">{kpi.whyItMatters}</p>
                      </div>

                      {kpi.whatGoodLooksLike && (
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                            What Good Looks Like
                          </h4>
                          <p className="text-sm text-slate-300">{kpi.whatGoodLooksLike}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </details>
        </section>
      )}

      {/* ====================================================================== */}
      {/* NEXT STEPS */}
      {/* ====================================================================== */}
      {plan.nextSteps && plan.nextSteps.length > 0 && (
        <section className="space-y-3">
          <details open className="group">
            <summary className="cursor-pointer list-none">
              <div className="mb-4 flex items-center gap-2">
                <span className="text-slate-400 transition-transform group-open:rotate-90">
                  ▶
                </span>
                <h2 className="text-xl font-bold text-slate-100">
                  Next Steps
                </h2>
              </div>
            </summary>
            <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-6">
              <ul className="space-y-2 text-sm text-slate-300">
                {plan.nextSteps.map((step, idx) => (
                  <li key={idx}>
                    {idx + 1}. {step}
                  </li>
                ))}
              </ul>
            </div>
          </details>
        </section>
      )}

      {/* What to do with this plan */}
      <section className="space-y-3">
        <div className="rounded-lg border-l-4 border-blue-500 bg-blue-900/10 p-6">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center mt-0.5">
              <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-blue-300 mb-2">What to do with this plan</h3>
              <p className="text-xs text-slate-300 leading-relaxed mb-3">
                This plan is designed to be actionable. Start with the 0–30 Days section, pick 2–3 initiatives that align with your capacity, and work through them systematically. Revisit your strategic priorities monthly to ensure you're making progress on what matters most.
              </p>
              <p className="text-xs text-slate-300 leading-relaxed">
                If you need help implementing any of these initiatives, consider working with a marketing consultant or agency who can execute the tactical work while you focus on running your business.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What to Do Next */}
      <section className="space-y-3">
        <details open className="group">
          <summary className="cursor-pointer list-none">
            <div className="mb-4 flex items-center gap-2">
              <span className="text-slate-400 transition-transform group-open:rotate-90">
                ▶
              </span>
              <h2 className="text-xl font-bold text-slate-100">
                What to Do Next
              </h2>
            </div>
          </summary>
          <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-6 space-y-4">
            <ol className="space-y-3 text-sm text-slate-300">
              <li className="flex gap-3">
                <span className="font-semibold text-slate-400">1.</span>
                <span>Share this report with your team and align on the 90-day focus.</span>
              </li>
              <li className="flex gap-3">
                <span className="font-semibold text-slate-400">2.</span>
                <span>Choose 1–2 priorities from each 30-day phase and assign owners.</span>
              </li>
              <li className="flex gap-3">
                <span className="font-semibold text-slate-400">3.</span>
                <span>If you'd like help executing, our team at Hive can turn this into a concrete project plan with timelines, team assignments, and an estimated budget.</span>
              </li>
            </ol>
            <div className="pt-2">
              <a
                href="https://calendar.app.google/JsQ4JYeaWqotyZ5W8"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-semibold rounded-lg transition-all duration-200 hover:scale-105"
              >
                Book a Free 30-Minute GAP Review with Hive
              </a>
            </div>
          </div>
        </details>
      </section>
    </div>
  );
}
