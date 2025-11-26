'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type {
  CompanyListItem,
  CompanyListFilter,
  CompanyStage,
  CompanyHealth,
} from '@/lib/os/companies/list';
import { CompanyPreviewPanel } from './CompanyPreviewPanel';

// ============================================================================
// Types
// ============================================================================

interface CompaniesDirectoryClientProps {
  initialCompanies: CompanyListItem[];
  initialFilter: CompanyListFilter;
}

type StageFilter = CompanyStage | 'All';

const STAGE_FILTERS: { value: StageFilter; label: string }[] = [
  { value: 'All', label: 'All' },
  { value: 'Client', label: 'Clients' },
  { value: 'Prospect', label: 'Prospects' },
  { value: 'Internal', label: 'Internal' },
  { value: 'Dormant', label: 'Dormant' },
  { value: 'Lost', label: 'Lost' },
];

// ============================================================================
// Helper Functions
// ============================================================================

function formatLastActivity(dateStr: string | null | undefined): string {
  if (!dateStr) return 'No activity';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
  } catch {
    return 'Unknown';
  }
}

function getStageBadgeStyles(stage: CompanyStage): string {
  const styles: Record<CompanyStage, string> = {
    Prospect: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    Client: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    Internal: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    Dormant: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    Lost: 'bg-red-500/10 text-red-400 border-red-500/30',
  };
  return styles[stage] || 'bg-slate-500/10 text-slate-400 border-slate-500/30';
}

function getHealthBadgeStyles(health: CompanyHealth): string {
  const styles: Record<CompanyHealth, string> = {
    Healthy: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    'At Risk': 'bg-red-500/10 text-red-400 border-red-500/30',
    Unknown: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  };
  return styles[health] || 'bg-slate-500/10 text-slate-400 border-slate-500/30';
}

function getScoreColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'text-slate-500';
  if (score >= 70) return 'text-emerald-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-red-400';
}

// ============================================================================
// Component
// ============================================================================

export function CompaniesDirectoryClient({
  initialCompanies,
  initialFilter,
}: CompaniesDirectoryClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // State
  const [companies] = useState<CompanyListItem[]>(initialCompanies);
  const [stageFilter, setStageFilter] = useState<StageFilter>(
    (initialFilter.stage as StageFilter) || 'All'
  );
  const [atRiskOnly, setAtRiskOnly] = useState(initialFilter.atRiskOnly || false);
  const [searchQuery, setSearchQuery] = useState(initialFilter.search || '');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  // Update URL when filters change
  const updateUrl = useCallback(
    (newStage: StageFilter, newAtRisk: boolean, newSearch: string) => {
      const params = new URLSearchParams();
      if (newStage !== 'All') params.set('stage', newStage);
      if (newAtRisk) params.set('atRisk', 'true');
      if (newSearch) params.set('q', newSearch);

      const queryString = params.toString();
      router.push(queryString ? `/companies?${queryString}` : '/companies', {
        scroll: false,
      });
    },
    [router]
  );

  // Filter handlers
  const handleStageChange = (stage: StageFilter) => {
    setStageFilter(stage);
    updateUrl(stage, atRiskOnly, searchQuery);
  };

  const handleAtRiskToggle = () => {
    const newAtRisk = !atRiskOnly;
    setAtRiskOnly(newAtRisk);
    updateUrl(stageFilter, newAtRisk, searchQuery);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    // Debounce URL update for search
    const timeout = setTimeout(() => {
      updateUrl(stageFilter, atRiskOnly, value);
    }, 300);
    return () => clearTimeout(timeout);
  };

  // Filter companies client-side for immediate feedback
  const filteredCompanies = useMemo(() => {
    let result = [...companies];

    // Stage filter
    if (stageFilter !== 'All') {
      result = result.filter((c) => c.stage === stageFilter);
    }

    // At Risk filter
    if (atRiskOnly) {
      result = result.filter((c) => c.health === 'At Risk');
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((c) => {
        return (
          c.name.toLowerCase().includes(query) ||
          c.domain?.toLowerCase().includes(query) ||
          c.website?.toLowerCase().includes(query) ||
          c.owner?.toLowerCase().includes(query)
        );
      });
    }

    // Sort: At Risk first, then by name
    result.sort((a, b) => {
      if (a.health === 'At Risk' && b.health !== 'At Risk') return -1;
      if (a.health !== 'At Risk' && b.health === 'At Risk') return 1;
      return a.name.localeCompare(b.name);
    });

    return result;
  }, [companies, stageFilter, atRiskOnly, searchQuery]);

  // Count companies by stage for badges
  const stageCounts = useMemo(() => {
    const counts: Record<StageFilter, number> = {
      All: companies.length,
      Client: 0,
      Prospect: 0,
      Internal: 0,
      Dormant: 0,
      Lost: 0,
    };

    for (const c of companies) {
      counts[c.stage]++;
    }

    return counts;
  }, [companies]);

  // Count At Risk
  const atRiskCount = useMemo(
    () => companies.filter((c) => c.health === 'At Risk').length,
    [companies]
  );

  // Selected company for preview
  const selectedCompany = useMemo(
    () => companies.find((c) => c.id === selectedCompanyId) || null,
    [companies, selectedCompanyId]
  );

  return (
    <div className="space-y-4">
      {/* Stage Filter Pills */}
      <div className="flex flex-wrap items-center gap-2">
        {STAGE_FILTERS.map(({ value, label }) => {
          const count = stageCounts[value];
          const isActive = stageFilter === value;

          return (
            <button
              key={value}
              onClick={() => handleStageChange(value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-amber-500 text-slate-900'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {label}
              {count > 0 && (
                <span className={`ml-1.5 ${isActive ? 'opacity-70' : 'text-slate-500'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}

        {/* At Risk Toggle */}
        <button
          onClick={handleAtRiskToggle}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            atRiskOnly
              ? 'bg-red-500 text-white'
              : atRiskCount > 0
              ? 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}
        >
          At Risk
          {atRiskCount > 0 && (
            <span className={`ml-1.5 ${atRiskOnly ? 'opacity-70' : ''}`}>
              {atRiskCount}
            </span>
          )}
        </button>
      </div>

      {/* Search */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search by name or domain..."
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
          </div>
          <div className="text-sm text-slate-400">
            {filteredCompanies.length} {filteredCompanies.length === 1 ? 'company' : 'companies'}
          </div>
        </div>
      </div>

      {/* Main Content: Table + Preview Panel */}
      <div className="flex gap-6">
        {/* Table */}
        <div
          className={`flex-1 bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden ${
            selectedCompany ? 'lg:max-w-[65%]' : ''
          }`}
        >
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
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden md:table-cell">
                    Tier
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden lg:table-cell">
                    Owner
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden lg:table-cell">
                    Last Activity
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden xl:table-cell">
                    Open Work
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden xl:table-cell">
                    GAP Score
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredCompanies.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                      No companies match the selected filters
                    </td>
                  </tr>
                ) : (
                  filteredCompanies.map((company) => (
                    <tr
                      key={company.id}
                      onClick={() => setSelectedCompanyId(company.id)}
                      className={`border-b border-slate-800/50 last:border-0 hover:bg-slate-800/30 transition-colors cursor-pointer ${
                        selectedCompanyId === company.id ? 'bg-slate-800/50' : ''
                      }`}
                    >
                      {/* Company Name + Domain */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="text-slate-200 font-medium">
                            {company.name}
                          </span>
                          <span className="text-xs text-slate-500">
                            {company.domain || '—'}
                          </span>
                        </div>
                      </td>

                      {/* Stage */}
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getStageBadgeStyles(
                            company.stage
                          )}`}
                        >
                          {company.stage}
                        </span>
                      </td>

                      {/* Health */}
                      <td className="px-4 py-3">
                        {company.stage === 'Client' && (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getHealthBadgeStyles(
                              company.health
                            )}`}
                          >
                            {company.health === 'At Risk' && (
                              <svg
                                className="w-3 h-3 mr-1"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            )}
                            {company.health}
                          </span>
                        )}
                      </td>

                      {/* Tier */}
                      <td className="px-4 py-3 text-slate-400 text-xs hidden md:table-cell">
                        {company.tier ? `Tier ${company.tier}` : '—'}
                      </td>

                      {/* Owner */}
                      <td className="px-4 py-3 text-slate-400 text-xs hidden lg:table-cell">
                        {company.owner || '—'}
                      </td>

                      {/* Last Activity */}
                      <td className="px-4 py-3 text-slate-400 text-xs hidden lg:table-cell">
                        {company.lastActivityLabel || formatLastActivity(company.lastActivityAt)}
                      </td>

                      {/* Open Work */}
                      <td className="px-4 py-3 text-center hidden xl:table-cell">
                        {company.openWorkCount > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-400">
                            {company.openWorkCount}
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>

                      {/* GAP Score */}
                      <td className="px-4 py-3 text-center hidden xl:table-cell">
                        {company.latestGapScore !== null &&
                        company.latestGapScore !== undefined ? (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${getScoreColor(
                              company.latestGapScore
                            )}`}
                          >
                            {company.latestGapScore}
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/c/${company.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-amber-500 hover:text-amber-400 font-medium"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Preview Panel */}
        {selectedCompany && (
          <CompanyPreviewPanel
            company={selectedCompany}
            onClose={() => setSelectedCompanyId(null)}
          />
        )}
      </div>
    </div>
  );
}
