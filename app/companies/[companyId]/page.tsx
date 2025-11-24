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
import { CompanyDetailClient } from '@/components/os/CompanyDetailClient';

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
  const [gapIaRuns, gapPlanRuns, latestOsResult, fullReports, workItems] =
    await Promise.all([
      getGapIaRunsForCompany(companyId, 10),
      getGapPlanRunsForCompany(companyId, 10),
      getLatestOsResultForCompany(companyId),
      getFullReportsForCompany(companyId),
      getWorkItemsForCompany(companyId),
    ]);

  // Extract latest assessment summary
  const latestAssessment = gapIaRuns[0] || null;
  const latestPlan = gapPlanRuns[0] || null;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link href="/os/companies" className="hover:text-slate-300">
            Companies
          </Link>
          <span>/</span>
          <span className="text-slate-300">{company.name}</span>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-100">{company.name}</h1>
            <div className="flex items-center gap-3 mt-2">
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
              {latestOsResult?.overallScore && (
                <span className="inline-flex items-center px-2 py-1 rounded text-sm font-semibold bg-slate-800 text-amber-500">
                  Score: {latestOsResult.overallScore}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/snapshot?url=${encodeURIComponent(company.website || company.domain)}`}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium rounded-lg transition-colors text-sm"
            >
              Run GAP Assessment
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
      />
    </div>
  );
}
