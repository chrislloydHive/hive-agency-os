/**
 * Company Detail Page
 *
 * Tabbed view showing:
 * - Overview (basic info, last assessment, current plan, mini analytics)
 * - GAP (assessments and plans for this company)
 * - Work (work items for this company)
 * - Analytics (per-company GA4/GSC - placeholder)
 * - Notes/Activity (timeline of activity)
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { getGapIaRunsForCompany } from '@/lib/airtable/gapIaRuns';
import { getGapPlanRunsForCompany } from '@/lib/airtable/gapPlanRuns';
import { getLatestOsResultForCompany, getFullReportsForCompany } from '@/lib/airtable/fullReports';
import { getWorkItemsForCompany } from '@/lib/airtable/workItems';
import { listDiagnosticRunsForCompany } from '@/lib/os/diagnostics/runs';
import { CompanyDetailClient } from '@/components/os/CompanyDetailClient';
import { buildCompanyActivitySnapshot, hasOverdueWorkItems, hasStaleBacklogItems } from '@/lib/os/companies/activity';
import { evaluateCompanyHealth } from '@/lib/os/companies/health';

interface CompanyDetailPageProps {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function CompanyDetailPage({
  params,
  searchParams,
}: CompanyDetailPageProps) {
  const { companyId } = await params;
  const { tab = 'overview' } = await searchParams;

  // Fetch company data
  const company = await getCompanyById(companyId);

  if (!company) {
    notFound();
  }

  // Fetch all related data in parallel
  const [gapIaRuns, gapPlanRuns, latestOsResult, fullReports, workItems, diagnosticRuns] =
    await Promise.all([
      getGapIaRunsForCompany(companyId, 10),
      getGapPlanRunsForCompany(companyId, 10),
      getLatestOsResultForCompany(companyId),
      getFullReportsForCompany(companyId),
      getWorkItemsForCompany(companyId),
      listDiagnosticRunsForCompany(companyId),
    ]);

  // Extract latest assessment summary
  const latestAssessment = gapIaRuns[0] || null;
  const latestPlan = gapPlanRuns[0] || null;

  // Build activity snapshot for health evaluation
  const activity = buildCompanyActivitySnapshot({
    gapIaRuns,
    gapPlanRuns,
    diagnosticRuns,
    workItems,
  });

  // Get latest GAP score for health evaluation
  const latestGapScore = (() => {
    if (!latestAssessment) return null;
    const runAny = latestAssessment as any;
    return runAny.summary?.overallScore ?? runAny.overallScore ?? null;
  })();

  // Evaluate company health (includes manual override support)
  const { health, reasons: healthReasons } = evaluateCompanyHealth({
    stage: company.stage,
    activity,
    hasOverdueWork: hasOverdueWorkItems(workItems),
    hasBacklogWork: hasStaleBacklogItems(workItems),
    latestGapScore,
    // Manual override fields from Airtable
    healthOverride: company.healthOverride,
    atRiskFlag: company.atRiskFlag,
  });

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link href="/companies" className="hover:text-slate-300">
            Companies
          </Link>
          <span>/</span>
          <span className="text-slate-300">{company.name}</span>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-100">{company.name}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              {company.website && (
                <a
                  href={company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-amber-500 hover:text-amber-400"
                >
                  {company.domain} →
                </a>
              )}
              {company.stage && (
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                    company.stage === 'Client'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : company.stage === 'Prospect'
                      ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                      : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                  }`}
                >
                  {company.stage}
                </span>
              )}
              {company.tier && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border bg-amber-500/10 text-amber-400 border-amber-500/30">
                  Tier {company.tier}
                </span>
              )}
              {/* Health Badge */}
              {company.stage === 'Client' || company.stage === 'Prospect' ? (
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                    health === 'At Risk'
                      ? 'bg-red-500/10 text-red-400 border-red-500/30'
                      : health === 'Healthy'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                  }`}
                >
                  {health === 'At Risk' && (
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                  {health}
                </span>
              ) : null}
              {latestOsResult?.overallScore && (
                <span className="inline-flex items-center px-2 py-1 rounded text-sm font-semibold bg-slate-800 text-amber-500">
                  Score: {latestOsResult.overallScore}
                </span>
              )}
              {/* Last Activity */}
              {activity.lastAnyActivityAt && (
                <span className="text-xs text-slate-500">
                  Last activity:{' '}
                  {new Date(activity.lastAnyActivityAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Quick Actions for Prospects */}
            {company.stage === 'Prospect' && (
              <Link
                href={`/pipeline/opportunities?create=true&companyId=${companyId}`}
                className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 font-medium rounded-lg transition-colors text-sm border border-emerald-500/30"
              >
                Add Opportunity
              </Link>
            )}
            <Link
              href={`/c/${companyId}/diagnostics`}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg transition-colors text-sm border border-slate-700"
            >
              Run Diagnostics
            </Link>
            <Link
              href={`/snapshot?url=${encodeURIComponent(company.website || company.domain)}`}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium rounded-lg transition-colors text-sm"
            >
              Run GAP Snapshot
            </Link>
          </div>
        </div>
      </div>

      {/* Tabbed Content */}
      <CompanyDetailClient
        company={company}
        currentTab={tab}
        gapIaRuns={gapIaRuns}
        gapPlanRuns={gapPlanRuns}
        latestOsResult={latestOsResult}
        fullReports={fullReports}
        workItems={workItems}
        latestAssessment={latestAssessment}
        latestPlan={latestPlan}
        diagnosticRuns={diagnosticRuns}
        health={health}
        lastActivityAt={activity.lastAnyActivityAt}
        healthReasons={healthReasons}
        activitySnapshot={activity}
      />
    </div>
  );
}
