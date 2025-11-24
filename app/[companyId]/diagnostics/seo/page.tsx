import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCompanyById } from '@/lib/airtable/companies';
import { getHeavyGapRunsByCompanyId } from '@/lib/airtable/gapHeavyRuns';
import type { DiagnosticModuleResult } from '@/lib/gap-heavy/types';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export const dynamic = 'force-dynamic';

export default async function SeoDetailPage({ params }: PageProps) {
  const { companyId } = await params;

  // Fetch company
  const company = await getCompanyById(companyId);
  if (!company) {
    return notFound();
  }

  // Fetch most recent Heavy Run
  const heavyRuns = await getHeavyGapRunsByCompanyId(companyId, 1);
  const latestHeavyRun = heavyRuns[0] || null;

  // Extract SEO module result
  let seoModuleResult: DiagnosticModuleResult | null = null;

  if (latestHeavyRun?.evidencePack) {
    const seoModule = latestHeavyRun.evidencePack.modules?.find(
      (m) => m.module === 'seo'
    );
    if (seoModule) {
      seoModuleResult = seoModule;
    }
  }

  // If no SEO diagnostics run yet, show empty state
  if (!seoModuleResult) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center">
          <h2 className="text-lg font-semibold text-slate-200 mb-2">
            SEO Diagnostics Not Run Yet
          </h2>
          <p className="text-sm text-slate-400 mb-6">
            Run the SEO module to see detailed technical SEO analysis, meta tag audits, and indexability checks.
          </p>
          <Link
            href={`/os/${companyId}/diagnostics`}
            className="inline-block rounded-full border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
          >
            ← Back to Diagnostics
          </Link>
        </div>
      </div>
    );
  }

  const score = seoModuleResult.score as number | undefined;
  const summary = seoModuleResult.summary as string | undefined;
  const issues = (seoModuleResult.issues as string[] | undefined) ?? [];
  const recommendations = (seoModuleResult.recommendations as string[] | undefined) ?? [];
  const rawEvidence = seoModuleResult.rawEvidence as Record<string, unknown> | undefined;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">SEO Diagnostics</h1>
          <p className="text-sm text-slate-400 mt-1">
            Technical SEO analysis for {company.name}
          </p>
        </div>
        <Link
          href={`/os/${companyId}/diagnostics`}
          className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
        >
          ← Back to Diagnostics
        </Link>
      </div>

      {/* Score Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-1">
              SEO Score
            </h2>
            <p className="text-xs text-slate-500">
              Overall technical SEO health
            </p>
          </div>
          <div className="text-right">
            <p className="text-5xl font-bold tabular-nums text-slate-100">
              {score ?? '—'}
            </p>
            <p className="text-xs text-slate-500 mt-1">out of 100</p>
          </div>
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-3">
            Summary
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">{summary}</p>
        </div>
      )}

      {/* Issues & Recommendations Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Issues */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-4">
            Issues Found ({issues.length})
          </h2>
          {issues.length > 0 ? (
            <div className="space-y-3">
              {issues.map((issue, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-red-900/30 bg-red-950/20 p-3"
                >
                  <p className="text-sm text-slate-200 leading-relaxed">{issue}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No issues found</p>
          )}
        </div>

        {/* Recommendations */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-4">
            Recommendations ({recommendations.length})
          </h2>
          {recommendations.length > 0 ? (
            <div className="space-y-3">
              {recommendations.map((rec, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-blue-900/30 bg-blue-950/20 p-3"
                >
                  <p className="text-sm text-slate-200 leading-relaxed">{rec}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No recommendations</p>
          )}
        </div>
      </div>

      {/* Raw Evidence (if available) */}
      {rawEvidence && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-4">
            Technical Details
          </h2>
          <pre className="text-xs text-slate-400 overflow-x-auto bg-[#050509]/50 p-4 rounded-lg">
            {JSON.stringify(rawEvidence, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
