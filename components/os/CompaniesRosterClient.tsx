'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { CompanyRecord } from '@/lib/airtable/companies';
import type { CompanyHealth } from '@/lib/os/types';
import { CompanyHealthBadge, calculateCompanyHealth } from './CompanyHealthBadge';

type HealthStatus = 'Healthy' | 'Watch' | 'At Risk' | null;

interface EnrichedCompany extends CompanyRecord {
  healthStatus: HealthStatus;
  lastActivityDate: string | null;
  latestOverallScore?: number | null;
  opportunityCount?: number;
  workItemCount?: number;
}

interface CompaniesRosterClientProps {
  companies: EnrichedCompany[];
  defaultView: string;
}

type ViewFilter = 'All' | 'Clients' | 'Prospects' | 'At Risk' | 'Needs Attention';

const VIEW_FILTERS: ViewFilter[] = ['All', 'Clients', 'Prospects', 'At Risk', 'Needs Attention'];

// Format relative date
const formatLastActivity = (dateStr: string | null) => {
  if (!dateStr) return 'No activity';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
  } catch {
    return 'Unknown';
  }
};

export function CompaniesRosterClient({
  companies,
  defaultView,
}: CompaniesRosterClientProps) {
  const [activeView, setActiveView] = useState<ViewFilter>(defaultView as ViewFilter);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<EnrichedCompany | null>(null);

  // Helper to get computed health for a company
  const getComputedHealth = (company: EnrichedCompany): CompanyHealth => {
    // If company has a healthStatus from server, map it
    if (company.healthStatus === 'At Risk') return 'critical';
    if (company.healthStatus === 'Watch') return 'at-risk';
    if (company.healthStatus === 'Healthy') return 'healthy';

    // Otherwise calculate from available data
    const daysSinceLastActivity = company.lastActivityDate
      ? Math.floor((Date.now() - new Date(company.lastActivityDate).getTime()) / (1000 * 60 * 60 * 24))
      : undefined;

    return calculateCompanyHealth({
      daysSinceLastAssessment: daysSinceLastActivity,
      overallScore: company.latestOverallScore ?? undefined,
      hasActivePlan: (company.workItemCount ?? 0) > 0,
      overdueWorkItems: 0, // We don't have this data yet
    });
  };

  // Check if company needs attention (no recent activity, low score, or no GAP)
  const needsAttention = (company: EnrichedCompany): boolean => {
    // No activity in 60+ days
    if (company.lastActivityDate) {
      const days = Math.floor((Date.now() - new Date(company.lastActivityDate).getTime()) / (1000 * 60 * 60 * 24));
      if (days > 60) return true;
    } else if (company.stage === 'Client') {
      // Client with no activity ever
      return true;
    }
    // Low score
    if (company.latestOverallScore && company.latestOverallScore < 50) return true;
    return false;
  };

  // Filter companies based on view and search
  const filteredCompanies = useMemo(() => {
    return companies.filter((company) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const nameMatch = company.name.toLowerCase().includes(query);
        const domainMatch = company.domain?.toLowerCase().includes(query);
        const industryMatch = company.industry?.toLowerCase().includes(query);
        if (!nameMatch && !domainMatch && !industryMatch) return false;
      }

      // View filter
      switch (activeView) {
        case 'All':
          return true;
        case 'Clients':
          return company.stage === 'Client';
        case 'Prospects':
          return company.stage === 'Prospect';
        case 'At Risk':
          return company.healthStatus === 'At Risk';
        case 'Needs Attention':
          return needsAttention(company);
        default:
          return true;
      }
    });
  }, [companies, activeView, searchQuery]);

  // Count for each view
  const viewCounts = useMemo(() => {
    return {
      All: companies.length,
      Clients: companies.filter((c) => c.stage === 'Client').length,
      Prospects: companies.filter((c) => c.stage === 'Prospect').length,
      'At Risk': companies.filter((c) => c.healthStatus === 'At Risk').length,
      'Needs Attention': companies.filter(needsAttention).length,
    };
  }, [companies]);

  // Stage badge styling
  const getStageBadge = (stage?: string) => {
    if (!stage) return null;

    const styles: Record<string, string> = {
      Lead: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
      Prospect: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      Client: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      Partner: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
      Churned: 'bg-red-500/10 text-red-400 border-red-500/30',
      // Legacy stages
      Internal: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
      Dormant: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
      Lost: 'bg-red-500/10 text-red-400 border-red-500/30',
    };

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${styles[stage] || 'bg-slate-500/10 text-slate-400 border-slate-500/30'}`}>
        {stage}
      </span>
    );
  };

  // Score badge styling
  const getScoreBadge = (score?: number | null) => {
    if (score === null || score === undefined) return null;

    let colorClass = 'bg-slate-500/10 text-slate-400';
    if (score >= 70) colorClass = 'bg-emerald-500/10 text-emerald-400';
    else if (score >= 50) colorClass = 'bg-amber-500/10 text-amber-400';
    else colorClass = 'bg-red-500/10 text-red-400';

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${colorClass}`}>
        {score}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* View Pills */}
      <div className="flex flex-wrap items-center gap-2">
        {VIEW_FILTERS.map((view) => {
          const count = viewCounts[view];
          const isActive = activeView === view;
          const isAtRisk = view === 'At Risk';
          const isNeedsAttention = view === 'Needs Attention';

          return (
            <button
              key={view}
              onClick={() => setActiveView(view)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? isAtRisk
                    ? 'bg-red-500 text-white'
                    : isNeedsAttention
                    ? 'bg-amber-500 text-slate-900'
                    : 'bg-amber-500 text-slate-900'
                  : isAtRisk && count > 0
                  ? 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20'
                  : isNeedsAttention && count > 0
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {view}
              {count > 0 && (
                <span className={`ml-1.5 ${isActive ? 'opacity-70' : 'text-slate-500'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or domain..."
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
          </div>
          <div className="text-sm text-slate-400">
            {filteredCompanies.length} companies
          </div>
        </div>
      </div>

      {/* Main Content: Table + Preview Panel */}
      <div className="flex gap-6">
        {/* Table */}
        <div className={`flex-1 bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden ${selectedCompany ? 'lg:max-w-[65%]' : ''}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Company
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden sm:table-cell">
                    Stage
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Health
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden md:table-cell">
                    Score
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden lg:table-cell">
                    Last Activity
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden xl:table-cell">
                    Owner
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredCompanies.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                      No companies match the selected filters
                    </td>
                  </tr>
                ) : (
                  filteredCompanies.map((company) => {
                    const computedHealth = getComputedHealth(company);
                    return (
                      <tr
                        key={company.id}
                        onClick={() => setSelectedCompany(company)}
                        className={`border-b border-slate-800/50 last:border-0 hover:bg-slate-800/30 transition-colors cursor-pointer ${
                          selectedCompany?.id === company.id ? 'bg-slate-800/50' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="text-slate-200 font-medium">{company.name}</span>
                            <span className="text-xs text-slate-500">{company.domain || '—'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          {getStageBadge(company.stage)}
                        </td>
                        <td className="px-4 py-3">
                          {company.stage === 'Client' && (
                            <CompanyHealthBadge health={computedHealth} size="sm" />
                          )}
                        </td>
                        <td className="px-4 py-3 text-center hidden md:table-cell">
                          {getScoreBadge(company.latestOverallScore)}
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs hidden lg:table-cell">
                          {formatLastActivity(company.lastActivityDate)}
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs hidden xl:table-cell">
                          {company.owner || '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/c/${company.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-amber-500 hover:text-amber-400 font-medium"
                          >
                            Open →
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Preview Panel (right side) */}
        {selectedCompany && (
          <div className="hidden lg:block w-[35%] max-w-md bg-slate-900/70 border border-slate-800 rounded-xl p-5 sticky top-6 h-fit">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-100">{selectedCompany.name}</h3>
                <p className="text-sm text-slate-400">{selectedCompany.domain}</p>
              </div>
              <button
                onClick={() => setSelectedCompany(null)}
                className="text-slate-500 hover:text-slate-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Status Row */}
            <div className="flex items-center gap-2 mb-4">
              {getStageBadge(selectedCompany.stage)}
              {selectedCompany.stage === 'Client' && (
                <CompanyHealthBadge health={getComputedHealth(selectedCompany)} size="sm" />
              )}
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-slate-800/50 rounded-lg p-3">
                <div className="text-xs text-slate-500 mb-1">GAP Score</div>
                <div className="text-sm font-medium">
                  {selectedCompany.latestOverallScore ? (
                    <span className={
                      selectedCompany.latestOverallScore >= 70
                        ? 'text-emerald-400'
                        : selectedCompany.latestOverallScore >= 50
                        ? 'text-amber-400'
                        : 'text-red-400'
                    }>
                      {selectedCompany.latestOverallScore}/100
                    </span>
                  ) : (
                    <span className="text-slate-500">No score</span>
                  )}
                </div>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3">
                <div className="text-xs text-slate-500 mb-1">Last Activity</div>
                <div className="text-sm text-slate-200 font-medium">
                  {formatLastActivity(selectedCompany.lastActivityDate)}
                </div>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3">
                <div className="text-xs text-slate-500 mb-1">Owner</div>
                <div className="text-sm text-slate-200 font-medium">
                  {selectedCompany.owner || 'Unassigned'}
                </div>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3">
                <div className="text-xs text-slate-500 mb-1">Tier</div>
                <div className="text-sm text-slate-200 font-medium">
                  {selectedCompany.tier ? `Tier ${selectedCompany.tier}` : '—'}
                </div>
              </div>
            </div>

            {/* Industry (if available) */}
            {selectedCompany.industry && (
              <div className="mb-4 text-sm text-slate-400">
                {selectedCompany.industry}
              </div>
            )}

            {/* Next Steps */}
            <div className="border-t border-slate-700 pt-4 mb-4">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                Suggested Actions
              </h4>
              <div className="space-y-2">
                {selectedCompany.healthStatus === 'At Risk' || getComputedHealth(selectedCompany) === 'critical' ? (
                  <>
                    <div className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="text-red-400 mt-0.5">•</span>
                      <span>Schedule check-in call</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="text-red-400 mt-0.5">•</span>
                      <span>Run new GAP assessment</span>
                    </div>
                  </>
                ) : selectedCompany.healthStatus === 'Watch' || getComputedHealth(selectedCompany) === 'at-risk' ? (
                  <>
                    <div className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="text-amber-400 mt-0.5">•</span>
                      <span>Review recent work progress</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="text-amber-400 mt-0.5">•</span>
                      <span>Check for overdue items</span>
                    </div>
                  </>
                ) : selectedCompany.stage === 'Prospect' ? (
                  <>
                    <div className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="text-blue-400 mt-0.5">•</span>
                      <span>Run full GAP assessment</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="text-blue-400 mt-0.5">•</span>
                      <span>Create proposal</span>
                    </div>
                  </>
                ) : !selectedCompany.lastActivityDate || !selectedCompany.latestOverallScore ? (
                  <div className="flex items-start gap-2 text-sm text-slate-300">
                    <span className="text-slate-400 mt-0.5">•</span>
                    <span>Run GAP assessment to get started</span>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No urgent actions needed</p>
                )}
              </div>
            </div>

            {/* CTA */}
            <Link
              href={`/c/${selectedCompany.id}`}
              className="block w-full text-center px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium rounded-lg transition-colors"
            >
              Open Company
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
