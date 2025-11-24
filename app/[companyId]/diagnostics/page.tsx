import { notFound } from "next/navigation";
import Link from "next/link";
import { getHeavyGapRunsByCompanyId } from "@/lib/airtable/gapHeavyRuns";
import { getCompanyById } from "@/lib/airtable/companies";
import type { DiagnosticsPayload, DiagnosticArea, DiagnosticIssue } from "@/lib/airtable/fullReports";
import type { DiagnosticModuleResult } from "@/lib/gap-heavy/types";
import { DiagnosticsControls } from "./DiagnosticsControls";
import { DiagnosticAreaCard } from "./DiagnosticAreaCard";

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export const dynamic = "force-dynamic";

export default async function CompanyDiagnosticsPage({ params }: PageProps) {
  const { companyId } = await params;

  // Get company info first
  const company = await getCompanyById(companyId);
  if (!company) {
    return notFound();
  }

  // Fetch Heavy Runs (V4 diagnostics)
  const heavyRuns = await getHeavyGapRunsByCompanyId(companyId, 10);

  // If no runs, show helpful message and diagnostic controls
  if (!heavyRuns || heavyRuns.length === 0) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center">
          <div className="mb-4">
            <svg
              className="mx-auto h-12 w-12 text-slate-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-slate-200 mb-2">
            No OS Reports Yet
          </h2>
          <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto">
            This company doesn't have any Full Reports with diagnostics data yet.
            Run an OS diagnostic below to generate your first report with detailed analysis across all pillars.
          </p>
        </div>

        {/* Diagnostics Controls - Show even without existing reports */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-1">
              Run First Diagnostic
            </h2>
            <p className="text-xs text-slate-500">
              Run Heavy Worker V4 to create your first diagnostic report
            </p>
          </div>
          <DiagnosticsControls companyId={companyId} />
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 text-center">
          <div className="flex gap-3 justify-center">
            <Link
              href={`/os/${companyId}`}
              className="rounded-full border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
            >
              Back to Overview
            </Link>
            <Link
              href="/os"
              className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              All Companies
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const [latestRun, ...historyRuns] = heavyRuns;
  const evidencePack = latestRun.evidencePack;
  const moduleResults = evidencePack?.modules || [];

  // Extract page evaluations from evidence (if available)
  const pageEvaluations = (evidencePack as any)?.pageEvaluations || [];

  // Try to read basic metadata from latest run if available
  const latestCreatedAt = latestRun.createdAt ?? "Latest Diagnostic Run";

  // Calculate overall score as average of all module scores
  const moduleScores = moduleResults
    .map((m) => m.score)
    .filter((s): s is number => s !== undefined);
  const overallScore = moduleScores.length > 0
    ? Math.round(moduleScores.reduce((a, b) => a + b, 0) / moduleScores.length)
    : undefined;

  const orderedAreas: { key: keyof DiagnosticsPayload; label: string }[] = [
    { key: "brand", label: "Brand" },
    { key: "content", label: "Content" },
    { key: "seo", label: "SEO" },
    { key: "websiteUx", label: "Website UX" },
    { key: "funnel", label: "Funnel" },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <main className="grid gap-6 lg:grid-cols-[2.2fr,1.2fr]">
        {/* LEFT: Diagnostics by area */}
        <section className="space-y-4">
          {/* Diagnostics Controls */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-1">
                Run Diagnostics
              </h2>
              <p className="text-xs text-slate-500">
                Run Heavy Worker V4 to update diagnostics data
              </p>
            </div>
            <DiagnosticsControls companyId={companyId} />
          </div>

          {/* Specialized Diagnostic Tools */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-1">
                Specialized Tools
              </h2>
              <p className="text-xs text-slate-500">
                Deep-dive diagnostic tools for specific areas
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Link
                href={`/os/${companyId}/diagnostics/website`}
                className="rounded-lg border border-slate-700 bg-[#050509]/50 p-4 hover:bg-slate-900/50 hover:border-slate-600 transition-all group"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-200 group-hover:text-slate-100">
                      Website Lab
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Multi-page UX & conversion diagnostics
                    </p>
                  </div>
                  <svg className="h-4 w-4 text-slate-600 group-hover:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
              <Link
                href={`/os/${companyId}/diagnostics/brand`}
                className="rounded-lg border border-slate-700 bg-[#050509]/50 p-4 hover:bg-slate-900/50 hover:border-slate-600 transition-all group"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-200 group-hover:text-slate-100">
                      Brand Lab
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Brand health, clarity & positioning
                    </p>
                  </div>
                  <svg className="h-4 w-4 text-slate-600 group-hover:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                  Current Diagnostics
                </h2>
                <p className="text-xs text-slate-500">
                  Module results from latest Heavy Run V4
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Overall Score</p>
                <p className="text-3xl font-semibold leading-none tabular-nums">
                  {overallScore ?? "—"}
                </p>
              </div>
            </div>

            {moduleResults.length === 0 && (
              <p className="text-sm text-slate-400">
                No diagnostic modules found in the latest Heavy Run. Run a diagnostic above to see results.
              </p>
            )}

            {moduleResults.length > 0 && (
              <div className="grid gap-4 md:grid-cols-2">
                {moduleResults.map((moduleResult) => {
                  // Convert module result to DiagnosticArea format
                  const area: DiagnosticArea = {
                    score: moduleResult.score,
                    summary: moduleResult.summary,
                    issues: (moduleResult.issues || []).map((issueText, idx) => ({
                      id: `${moduleResult.module}-${idx}`,
                      title: issueText,
                      severity: 'medium' as const,
                      suggestion: moduleResult.recommendations?.[idx],
                    })),
                  };

                  // Get label for module
                  const labelMap: Record<string, string> = {
                    brand: 'Brand',
                    seo: 'SEO',
                    content: 'Content',
                    website: 'Website UX',
                    demand: 'Demand',
                    ops: 'Ops',
                  };

                  return (
                    <DiagnosticAreaCard
                      key={moduleResult.module}
                      label={labelMap[moduleResult.module] || moduleResult.module}
                      area={area}
                      companyId={companyId}
                      moduleKey={moduleResult.module}
                      pageEvaluations={moduleResult.module === 'website' ? pageEvaluations : undefined}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* RIGHT: Report history / meta */}
        <aside className="space-y-4">
          {/* Telemetry & Evidence */}
          {evidencePack && ((evidencePack as any).metrics?.length || (evidencePack as any).insights?.length) && (
            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Telemetry & Evidence
              </h2>

              {/* Key Metrics */}
              {(evidencePack as any).metrics && (evidencePack as any).metrics.length > 0 && (
                <div className="mb-4 space-y-2">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">
                    Key Metrics
                  </p>
                  {(evidencePack as any).metrics.slice(0, 4).map((metric: any) => (
                    <div
                      key={metric.id}
                      className="rounded-lg border border-slate-800 bg-[#050509]/70 px-3 py-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-200 truncate">
                            {metric.label}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {metric.source ? metric.source.toUpperCase() : 'Data'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold tabular-nums text-slate-100">
                            {metric.value}
                            {metric.unit && <span className="text-xs text-slate-400 ml-0.5">{metric.unit}</span>}
                          </p>
                          {metric.change !== undefined && (
                            <p className={`text-[10px] font-medium mt-0.5 ${
                              metric.change > 0
                                ? 'text-emerald-400'
                                : metric.change < 0
                                ? 'text-red-400'
                                : 'text-slate-500'
                            }`}>
                              {metric.change > 0 ? '▲' : metric.change < 0 ? '▼' : '—'}
                              {' '}
                              {metric.change > 0 ? '+' : ''}{metric.change.toFixed(1)}%
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Key Insights */}
              {(evidencePack as any).insights && (evidencePack as any).insights.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">
                    Key Insights
                  </p>
                  {(evidencePack as any).insights.slice(0, 3).map((insight: any) => {
                    const headline = insight.headline || insight.title || 'Untitled';
                    const detail = insight.detail || insight.description;

                    return (
                    <div
                      key={insight.id}
                      className="rounded-lg border border-slate-700/50 bg-[#050509]/50 px-3 py-2"
                    >
                      <div className="flex items-start gap-2">
                        {insight.severity && (
                          <SeverityIndicator severity={insight.severity} />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-200 leading-snug">
                            {headline}
                          </p>
                          {detail && (
                            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed line-clamp-2">
                              {detail}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1.5">
                            {insight.source && (
                              <span className="text-[9px] uppercase tracking-wide text-slate-500">
                                {insight.source}
                              </span>
                            )}
                            {insight.area && (
                              <span className="text-[9px] text-slate-500">
                                · {insight.area}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                  })}
                </div>
              )}

              {(evidencePack as any).lastUpdated && (
                <p className="text-[9px] text-slate-600 mt-3 text-right">
                  Last updated: {new Date((evidencePack as any).lastUpdated).toLocaleDateString()}
                </p>
              )}
            </section>
          )}

          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 text-sm">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Diagnostic Run History
            </h2>

            <div className="space-y-2 text-xs">
              {[latestRun, ...historyRuns].map((run) => {
                // Calculate overall score from module scores
                const runModuleScores = run.evidencePack?.modules
                  ?.map((m) => m.score)
                  .filter((s): s is number => s !== undefined) || [];
                const runOverallScore = runModuleScores.length > 0
                  ? Math.round(runModuleScores.reduce((a, b) => a + b, 0) / runModuleScores.length)
                  : undefined;

                return (
                  <div
                    key={run.id}
                    className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#050509]/70 px-3 py-2"
                  >
                    <div>
                      <p className="font-medium text-slate-200">
                        {run.createdAt ?? "Unknown date"}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {run.workerVersion ?? "—"} · {run.status}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">
                        {runOverallScore ?? "—"}
                      </p>
                      <p className="text-[11px] text-slate-500">Overall</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 text-xs text-slate-400">
            <p className="mb-1 font-medium text-slate-200">How this is populated</p>
            <ul className="list-disc space-y-1 pl-4">
              <li>
                Heavy Worker V4 runs diagnostic modules (Brand, SEO, Content, Website, Demand, Ops)
              </li>
              <li>
                Each module writes results to the{" "}
                <code className="rounded bg-slate-800 px-1 py-0.5 text-[10px]">
                  Evidence JSON
                </code>{" "}
                field in the GAP-Heavy Run table.
              </li>
              <li>
                Hive OS reads the latest Heavy Run's <code>evidencePack</code> to display module results.
              </li>
              <li>
                No scores or diagnostics are stored in the Companies table.
              </li>
            </ul>
          </section>
        </aside>
      </main>
    </div>
  );
}

function SeverityIndicator({ severity }: { severity: string }) {
  const normalized = severity.toLowerCase();

  const dotColor =
    normalized === "critical"
      ? "bg-red-500"
      : normalized === "high"
      ? "bg-orange-500"
      : normalized === "medium"
      ? "bg-amber-500"
      : normalized === "low"
      ? "bg-sky-500"
      : normalized === "info"
      ? "bg-blue-500"
      : "bg-slate-500";

  return (
    <div className={`w-1.5 h-1.5 rounded-full ${dotColor} flex-shrink-0 mt-1.5`} />
  );
}
