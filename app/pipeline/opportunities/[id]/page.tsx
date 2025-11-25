/**
 * Opportunity Detail Page
 *
 * Shows:
 * - Opportunity info (company, stage, value, close date)
 * - Actions (Run GAP, Convert to Client)
 * - Notes / next steps
 * - GAP history for linked company
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { base } from '@/lib/airtable/client';
import { getCompanyById } from '@/lib/airtable/companies';
import { getGapIaRunsForCompany } from '@/lib/airtable/gapIaRuns';
import { QuickDiagnosticsPanel } from '@/components/os/QuickDiagnosticsPanel';

// Fetch opportunity by ID
async function getOpportunity(id: string) {
  try {
    const record = await base('Opportunities').find(id);
    return {
      id: record.id,
      name: (record.fields['Name'] as string) || 'Unnamed Opportunity',
      companyId: (record.fields['Company'] as string[])?.[0],
      stage: (record.fields['Stage'] as string) || 'Discovery',
      value: record.fields['Value'] as number,
      probability: record.fields['Probability'] as number,
      closeDate: record.fields['Close Date'] as string,
      owner: record.fields['Owner'] as string,
      notes: record.fields['Notes'] as string,
      nextSteps: record.fields['Next Steps'] as string,
      createdAt: record.fields['Created At'] as string,
    };
  } catch (error) {
    console.error('[Opportunity] Failed to fetch:', error);
    return null;
  }
}

// Helper to format dates
const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
};

// Format currency
const formatCurrency = (num?: number | null) => {
  if (num === null || num === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
};

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Fetch opportunity
  const opportunity = await getOpportunity(id);

  if (!opportunity) {
    notFound();
  }

  // Fetch linked company and their GAP runs if exists
  let company = null;
  let gapRuns: any[] = [];

  if (opportunity.companyId) {
    [company, gapRuns] = await Promise.all([
      getCompanyById(opportunity.companyId),
      getGapIaRunsForCompany(opportunity.companyId, 5),
    ]);
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/pipeline/opportunities"
          className="text-sm text-slate-400 hover:text-slate-300 mb-3 inline-block transition-colors"
        >
          ← Back to opportunities
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-100">
              {opportunity.name}
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  opportunity.stage === 'Won'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : opportunity.stage === 'Lost'
                    ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                    : opportunity.stage === 'Contract'
                    ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                    : opportunity.stage === 'Proposal'
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                    : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                }`}
              >
                {opportunity.stage}
              </span>
              {opportunity.value && (
                <span className="text-lg font-semibold text-amber-500">
                  {formatCurrency(opportunity.value)}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {company?.domain && (
              <Link
                href={`/snapshot?url=${encodeURIComponent(company.domain)}`}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium rounded-lg transition-colors text-sm"
              >
                Run GAP for Prospect
              </Link>
            )}
            {opportunity.stage !== 'Won' && opportunity.stage !== 'Lost' && (
              <button className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-medium rounded-lg transition-colors text-sm">
                Convert to Client
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Opportunity Details */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
              Opportunity Details
            </h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <dt className="text-xs text-slate-500">Company</dt>
                <dd className="text-sm text-slate-200 mt-1">
                  {company ? (
                    <Link
                      href={`/companies/${company.id}`}
                      className="text-amber-500 hover:text-amber-400"
                    >
                      {company.name}
                    </Link>
                  ) : (
                    <span className="text-slate-500">Not linked</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Stage</dt>
                <dd className="text-sm text-slate-200 mt-1">
                  {opportunity.stage}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Value</dt>
                <dd className="text-sm text-slate-200 mt-1">
                  {formatCurrency(opportunity.value)}
                  {opportunity.probability && (
                    <span className="text-slate-500 ml-1">
                      ({opportunity.probability}% probability)
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Close Date</dt>
                <dd className="text-sm text-slate-200 mt-1">
                  {formatDate(opportunity.closeDate)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Owner</dt>
                <dd className="text-sm text-slate-200 mt-1">
                  {opportunity.owner || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Created</dt>
                <dd className="text-sm text-slate-200 mt-1">
                  {formatDate(opportunity.createdAt)}
                </dd>
              </div>
            </div>
          </div>

          {/* Notes / Next Steps */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
              Notes & Next Steps
            </h2>
            {opportunity.notes || opportunity.nextSteps ? (
              <div className="space-y-4">
                {opportunity.notes && (
                  <div>
                    <h3 className="text-xs text-slate-500 mb-1">Notes</h3>
                    <p className="text-sm text-slate-300 whitespace-pre-wrap">
                      {opportunity.notes}
                    </p>
                  </div>
                )}
                {opportunity.nextSteps && (
                  <div>
                    <h3 className="text-xs text-slate-500 mb-1">Next Steps</h3>
                    <p className="text-sm text-slate-300 whitespace-pre-wrap">
                      {opportunity.nextSteps}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                No notes or next steps recorded.
              </p>
            )}
          </div>

          {/* GAP History */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
              GAP Assessment History
            </h2>
            {!company ? (
              <div className="text-center py-8">
                <p className="text-sm text-slate-500 mb-4">
                  Link this opportunity to a company to see GAP assessments.
                </p>
                <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg transition-colors text-sm">
                  Link Company
                </button>
              </div>
            ) : gapRuns.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-slate-500 mb-4">
                  No GAP assessments for {company.name} yet.
                </p>
                <Link
                  href={`/snapshot?url=${encodeURIComponent(company.domain || company.website || '')}`}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium rounded-lg transition-colors text-sm inline-block"
                >
                  Run GAP Assessment
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {gapRuns.map((run) => (
                  <div
                    key={run.id}
                    className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-200">
                          GAP Assessment
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            run.status === 'completed'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-blue-500/10 text-blue-400'
                          }`}
                        >
                          {run.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {formatDate(run.createdAt)}
                      </div>
                    </div>
                    {run.overallScore && (
                      <span className="text-lg font-bold text-amber-500">
                        {run.overallScore}
                      </span>
                    )}
                  </div>
                ))}
                <Link
                  href={`/companies/${company.id}?tab=gap`}
                  className="block text-center text-sm text-amber-500 hover:text-amber-400 mt-4"
                >
                  View all GAP history for {company.name} →
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
              Actions
            </h2>
            <div className="space-y-2">
              {company?.domain && (
                <Link
                  href={`/snapshot?url=${encodeURIComponent(company.domain)}`}
                  className="w-full px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                  Run GAP Assessment
                </Link>
              )}
              {opportunity.stage !== 'Won' && opportunity.stage !== 'Lost' && (
                <button className="w-full px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-medium rounded-lg transition-colors text-sm border border-emerald-500/30">
                  Convert to Client
                </button>
              )}
              <button className="w-full px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg transition-colors text-sm">
                Edit Opportunity
              </button>
              <button className="w-full px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg transition-colors text-sm">
                Add Note
              </button>
            </div>
          </div>

          {/* Quick Diagnostics */}
          {company && (
            <QuickDiagnosticsPanel
              companyId={company.id}
              companyName={company.name}
              websiteUrl={company.website || company.domain || ''}
            />
          )}

          {/* Linked Company Card */}
          {company && (
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
                Linked Company
              </h2>
              <Link
                href={`/companies/${company.id}`}
                className="block hover:bg-slate-800/50 rounded-lg p-3 -m-3 transition-colors"
              >
                <div className="text-slate-200 font-medium">{company.name}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {company.domain}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {company.stage && (
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        company.stage === 'Client'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : company.stage === 'Prospect'
                          ? 'bg-blue-500/10 text-blue-400'
                          : 'bg-slate-500/10 text-slate-400'
                      }`}
                    >
                      {company.stage}
                    </span>
                  )}
                  {company.tier && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-400">
                      Tier {company.tier}
                    </span>
                  )}
                </div>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
