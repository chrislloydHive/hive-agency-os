'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { CompanyRecord } from '@/lib/airtable/companies';
import { CompanyMetaEditDialog } from './CompanyMetaEditDialog';

interface CompaniesListWithFiltersProps {
  companies: CompanyRecord[];
  atRiskCompanyIds?: Set<string>;
}

export function CompaniesListWithFilters({
  companies,
  atRiskCompanyIds = new Set(),
}: CompaniesListWithFiltersProps) {
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [lifecycleFilter, setLifecycleFilter] = useState<string>('all');
  const [atRiskFilter, setAtRiskFilter] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [editingCompany, setEditingCompany] = useState<CompanyRecord | null>(null);

  // Get unique values for filters
  const uniqueStages = useMemo(() => {
    const stages = companies
      .map((c) => c.stage)
      .filter((s): s is NonNullable<typeof s> => !!s);
    return Array.from(new Set(stages));
  }, [companies]);

  const uniqueTiers = useMemo(() => {
    const tiers = companies
      .map((c) => c.tier)
      .filter((t): t is NonNullable<typeof t> => !!t);
    return Array.from(new Set(tiers));
  }, [companies]);

  const uniqueLifecycleStatuses = useMemo(() => {
    const statuses = companies
      .map((c) => c.lifecycleStatus)
      .filter((s): s is NonNullable<typeof s> => !!s);
    return Array.from(new Set(statuses));
  }, [companies]);

  const uniqueOwners = useMemo(() => {
    const owners = companies
      .map((c) => c.owner)
      .filter((o): o is NonNullable<typeof o> => !!o);
    return Array.from(new Set(owners));
  }, [companies]);

  // Filter companies based on selected filters
  const filteredCompanies = useMemo(() => {
    return companies.filter((company) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const nameMatch = company.name.toLowerCase().includes(query);
        const domainMatch = company.domain?.toLowerCase().includes(query);
        if (!nameMatch && !domainMatch) return false;
      }

      if (stageFilter !== 'all' && company.stage !== stageFilter) return false;
      if (tierFilter !== 'all' && company.tier !== tierFilter) return false;
      if (lifecycleFilter !== 'all' && company.lifecycleStatus !== lifecycleFilter)
        return false;
      if (atRiskFilter && !atRiskCompanyIds.has(company.id)) return false;
      return true;
    });
  }, [
    companies,
    stageFilter,
    tierFilter,
    lifecycleFilter,
    atRiskFilter,
    searchQuery,
    atRiskCompanyIds,
  ]);

  // Helper functions for styling
  const getStagePill = (stage?: string) => {
    if (!stage) return null;

    const stageStyles: Record<string, string> = {
      Prospect: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      Client: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      Internal: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
      Dormant: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
      Lost: 'bg-red-500/10 text-red-400 border-red-500/30',
    };

    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
          stageStyles[stage] || 'bg-slate-500/10 text-slate-400 border-slate-500/30'
        }`}
      >
        {stage}
      </span>
    );
  };

  const getTierPill = (tier?: string) => {
    if (!tier) return null;

    const tierStyles: Record<string, string> = {
      A: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      B: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      C: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    };

    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
          tierStyles[tier] || 'bg-slate-500/10 text-slate-400 border-slate-500/30'
        }`}
      >
        Tier {tier}
      </span>
    );
  };

  const isAtRisk = (companyId: string) => atRiskCompanyIds.has(companyId);

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
        <div className="flex flex-wrap gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Search
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or domain..."
              className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
          </div>

          {/* Stage Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Stage
            </label>
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            >
              <option value="all">All Stages</option>
              {uniqueStages.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </select>
          </div>

          {/* Tier Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Tier
            </label>
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            >
              <option value="all">All Tiers</option>
              {uniqueTiers.sort().map((tier) => (
                <option key={tier} value={tier}>
                  Tier {tier}
                </option>
              ))}
            </select>
          </div>

          {/* Lifecycle Status Filter (optional) */}
          {uniqueLifecycleStatuses.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Lifecycle
              </label>
              <select
                value={lifecycleFilter}
                onChange={(e) => setLifecycleFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              >
                <option value="all">All Statuses</option>
                {uniqueLifecycleStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* At-Risk Filter */}
          {atRiskCompanyIds.size > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Health
              </label>
              <button
                onClick={() => setAtRiskFilter(!atRiskFilter)}
                className={`px-3 py-1.5 rounded text-sm font-medium border transition-colors ${
                  atRiskFilter
                    ? 'bg-red-500/20 text-red-400 border-red-500/50'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600'
                }`}
              >
                At Risk ({atRiskCompanyIds.size})
              </button>
            </div>
          )}

          {/* Results Count */}
          <div className="flex items-end">
            <div className="text-sm text-slate-400">
              {filteredCompanies.length} of {companies.length} companies
            </div>
          </div>
        </div>
      </div>

      {/* Companies Table */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Name
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Domain
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Industry
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Meta
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Owner
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredCompanies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No companies match the selected filters
                  </td>
                </tr>
              ) : (
                filteredCompanies.map((company) => (
                  <tr
                    key={company.id}
                    className="border-b border-slate-800/50 last:border-0 hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-200 font-medium">
                          {company.name}
                        </span>
                        {isAtRisk(company.id) && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-500/20 text-red-400 border border-red-500/30">
                            AT RISK
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {company.website?.replace(/^https?:\/\//, '') || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {company.industry || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {getStagePill(company.stage)}
                        {getTierPill(company.tier)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {company.owner || '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditingCompany(company)}
                          className="text-xs text-blue-500 hover:text-blue-400 font-medium"
                        >
                          Manage
                        </button>
                        <Link
                          href={`/c/${company.id}`}
                          className="text-xs text-amber-500 hover:text-amber-400 font-medium"
                        >
                          View →
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Dialog */}
      {editingCompany && (
        <CompanyMetaEditDialog
          company={editingCompany}
          onClose={() => setEditingCompany(null)}
        />
      )}
    </div>
  );
}
