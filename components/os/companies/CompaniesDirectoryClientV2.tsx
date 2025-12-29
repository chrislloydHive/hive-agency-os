'use client';

// components/os/companies/CompaniesDirectoryClientV2.tsx
// Enhanced Companies Directory with attention chips, sorting, and quick actions

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type {
  CompanyRowVM,
  CompaniesPageSummaryVM,
  CompanyListFilterV2,
  CompanyStage,
  AttentionFilter,
  SortField,
  SortDirection,
  CompanyHealthStatus,
} from '@/lib/os/companies/types';
import {
  getHealthLabel,
  getHealthBadgeClasses,
  getStageBadgeClasses,
  getScoreColorClass,
} from '@/lib/os/companies/types';

// ============================================================================
// Types
// ============================================================================

interface CompaniesDirectoryClientV2Props {
  initialCompanies: CompanyRowVM[];
  summary: CompaniesPageSummaryVM;
  initialFilter: CompanyListFilterV2;
}

type StageTab = CompanyStage | 'All';

const STAGE_TABS: { value: StageTab; label: string }[] = [
  { value: 'All', label: 'All' },
  { value: 'Client', label: 'Clients' },
  { value: 'Prospect', label: 'Prospects' },
  { value: 'Internal', label: 'Internal' },
  { value: 'Dormant', label: 'Dormant' },
  { value: 'Lost', label: 'Lost' },
];

const ATTENTION_CHIPS: { key: AttentionFilter; label: string; icon: string; color: string }[] = [
  { key: 'highIntent', label: 'High Intent', icon: '🎯', color: 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20' },
  { key: 'overdueWork', label: 'Overdue Work', icon: '⚠️', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20' },
  { key: 'noBaseline', label: 'No Baseline', icon: '📊', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20' },
  { key: 'duplicates', label: 'Duplicates', icon: '👥', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30 hover:bg-purple-500/20' },
];

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'lastActivity', label: 'Last Activity' },
  { value: 'name', label: 'Name' },
  { value: 'gapScore', label: 'GAP Score' },
  { value: 'openWork', label: 'Open Work' },
  { value: 'health', label: 'Health' },
];

// ============================================================================
// Pinned Companies Storage
// ============================================================================

const PINNED_STORAGE_KEY = 'hive-os-pinned-companies';

function getPinnedCompanies(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(PINNED_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function setPinnedCompaniesStorage(ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Ignore storage errors
  }
}

// ============================================================================
// Quick Actions Menu
// ============================================================================

interface QuickActionsMenuProps {
  company: CompanyRowVM;
  isOpen: boolean;
  onClose: () => void;
  position: { x: number; y: number };
}

function QuickActionsMenu({ company, isOpen, onClose, position }: QuickActionsMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 min-w-[180px]"
      style={{
        left: Math.min(position.x, window.innerWidth - 200),
        top: Math.min(position.y, window.innerHeight - 250),
      }}
    >
      <Link
        href={`/c/${company.id}`}
        className="block px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
        onClick={onClose}
      >
        Open Company
      </Link>
      <Link
        href={`/c/${company.id}/diagnostics?run=gap-ia`}
        className="block px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
        onClick={onClose}
      >
        Run GAP-IA
      </Link>
      <Link
        href={`/c/${company.id}/diagnostics?run=full-gap`}
        className="block px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
        onClick={onClose}
      >
        Run Full GAP
      </Link>
      <div className="border-t border-slate-700 my-1" />
      <Link
        href={`/c/${company.id}/work?new=true`}
        className="block px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
        onClick={onClose}
      >
        Create Work Item
      </Link>
      <Link
        href={`/pipeline/opportunities?new=true&companyId=${company.id}`}
        className="block px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
        onClick={onClose}
      >
        Create Opportunity
      </Link>
      {company.isDuplicate && (
        <>
          <div className="border-t border-slate-700 my-1" />
          <button
            onClick={() => {
              alert('Merge functionality coming soon');
              onClose();
            }}
            className="w-full text-left px-4 py-2 text-sm text-purple-400 hover:bg-slate-700 transition-colors"
          >
            Merge Duplicate...
          </button>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function CompaniesDirectoryClientV2({
  initialCompanies,
  summary,
  initialFilter,
}: CompaniesDirectoryClientV2Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // State
  const [companies] = useState<CompanyRowVM[]>(initialCompanies);
  const [stageFilter, setStageFilter] = useState<StageTab>(
    (initialFilter.stage as StageTab) || 'All'
  );
  const [searchQuery, setSearchQuery] = useState(initialFilter.search || '');
  const [attentionFilter, setAttentionFilter] = useState<AttentionFilter | null>(
    initialFilter.attention || null
  );
  const [sortBy, setSortBy] = useState<SortField>(initialFilter.sortBy || 'lastActivity');
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    initialFilter.sortDirection || 'desc'
  );
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);

  // Quick actions menu state
  const [menuState, setMenuState] = useState<{
    companyId: string | null;
    position: { x: number; y: number };
  }>({ companyId: null, position: { x: 0, y: 0 } });

  // Load pinned companies on mount
  useEffect(() => {
    setPinnedIds(getPinnedCompanies());
  }, []);

  // Update URL when filters change
  const updateUrl = useCallback(
    (
      newStage: StageTab,
      newSearch: string,
      newAttention: AttentionFilter | null,
      newSortBy: SortField,
      newSortDirection: SortDirection
    ) => {
      const params = new URLSearchParams();
      if (newStage !== 'All') params.set('stage', newStage);
      if (newSearch) params.set('q', newSearch);
      if (newAttention) params.set('attention', newAttention);
      if (newSortBy !== 'lastActivity') params.set('sortBy', newSortBy);
      if (newSortDirection !== 'desc') params.set('sortDirection', newSortDirection);

      const queryString = params.toString();
      router.push(queryString ? `/companies?${queryString}` : '/companies', {
        scroll: false,
      });
    },
    [router]
  );

  // Handlers
  const handleStageChange = (stage: StageTab) => {
    setStageFilter(stage);
    updateUrl(stage, searchQuery, attentionFilter, sortBy, sortDirection);
  };

  const handleAttentionToggle = (attention: AttentionFilter) => {
    const newAttention = attentionFilter === attention ? null : attention;
    setAttentionFilter(newAttention);
    updateUrl(stageFilter, searchQuery, newAttention, sortBy, sortDirection);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    // Debounce URL update
    const timeout = setTimeout(() => {
      updateUrl(stageFilter, value, attentionFilter, sortBy, sortDirection);
    }, 300);
    return () => clearTimeout(timeout);
  };

  const handleSortChange = (field: SortField) => {
    const newDirection =
      sortBy === field ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'desc';
    setSortBy(field);
    setSortDirection(newDirection);
    updateUrl(stageFilter, searchQuery, attentionFilter, field, newDirection);
  };

  const handleTogglePin = useCallback((companyId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPinnedIds((prev) => {
      const newPinned = prev.includes(companyId)
        ? prev.filter((id) => id !== companyId)
        : [...prev, companyId];
      setPinnedCompaniesStorage(newPinned);
      return newPinned;
    });
  }, []);

  const handleQuickActions = (companyId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuState({
      companyId,
      position: { x: e.clientX, y: e.clientY },
    });
  };

  // Filter and sort companies client-side
  const filteredCompanies = useMemo(() => {
    let result = [...companies];

    // Stage filter
    if (stageFilter !== 'All') {
      result = result.filter((c) => c.stage === stageFilter);
    }

    // Attention filter
    if (attentionFilter) {
      switch (attentionFilter) {
        case 'highIntent':
          result = result.filter((c) => c.isHighIntent);
          break;
        case 'overdueWork':
          result = result.filter((c) => c.overdueWorkCount > 0);
          break;
        case 'noBaseline':
          result = result.filter((c) => c.hasNoBaseline);
          break;
        case 'duplicates':
          result = result.filter((c) => c.isDuplicate);
          break;
        case 'atRisk':
          result = result.filter((c) => c.health === 'AtRisk');
          break;
      }
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.domain?.toLowerCase().includes(query) ||
          c.website?.toLowerCase().includes(query) ||
          c.ownerName?.toLowerCase().includes(query)
      );
    }

    // Sort
    const multiplier = sortDirection === 'asc' ? 1 : -1;
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return multiplier * a.name.localeCompare(b.name);
        case 'lastActivity':
          if (!a.lastActivityAt && !b.lastActivityAt) return 0;
          if (!a.lastActivityAt) return multiplier;
          if (!b.lastActivityAt) return -multiplier;
          return (
            multiplier *
            (new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime())
          );
        case 'gapScore':
          if (a.latestGap.score === null && b.latestGap.score === null) return 0;
          if (a.latestGap.score === null) return multiplier;
          if (b.latestGap.score === null) return -multiplier;
          return multiplier * (a.latestGap.score - b.latestGap.score);
        case 'openWork':
          return multiplier * (b.openWorkCount - a.openWorkCount);
        case 'health': {
          const healthOrder: Record<CompanyHealthStatus, number> = {
            AtRisk: 0,
            Unknown: 1,
            Okay: 2,
            Good: 3,
          };
          return multiplier * (healthOrder[a.health] - healthOrder[b.health]);
        }
        default:
          return 0;
      }
    });

    return result;
  }, [companies, stageFilter, attentionFilter, searchQuery, sortBy, sortDirection]);

  // Get selected company for quick actions
  const selectedCompanyForMenu = useMemo(
    () => companies.find((c) => c.id === menuState.companyId) || null,
    [companies, menuState.companyId]
  );

  // Get attention counts for current stage filter
  const attentionCounts = useMemo(() => {
    const stageFiltered =
      stageFilter === 'All' ? companies : companies.filter((c) => c.stage === stageFilter);
    return {
      highIntent: stageFiltered.filter((c) => c.isHighIntent).length,
      overdueWork: stageFiltered.filter((c) => c.overdueWorkCount > 0).length,
      noBaseline: stageFiltered.filter((c) => c.hasNoBaseline).length,
      duplicates: stageFiltered.filter((c) => c.isDuplicate).length,
    };
  }, [companies, stageFilter]);

  return (
    <div className="space-y-4">
      {/* Needs Attention Chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500 uppercase tracking-wide font-semibold mr-2">
          Needs Attention
        </span>
        {ATTENTION_CHIPS.map(({ key, label, icon, color }) => {
          const count = attentionCounts[key as keyof typeof attentionCounts] || 0;
          const isActive = attentionFilter === key;

          if (count === 0) return null;

          return (
            <button
              key={key}
              onClick={() => handleAttentionToggle(key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                isActive
                  ? 'ring-2 ring-offset-1 ring-offset-slate-900 ring-amber-500'
                  : ''
              } ${color}`}
            >
              <span>{icon}</span>
              <span>{label}</span>
              <span className="ml-1 px-1.5 py-0.5 rounded bg-black/20 text-[10px]">
                {count}
              </span>
            </button>
          );
        })}

        {/* At Risk chip (separate from attention chips) */}
        {summary.needsAttention.atRiskCount > 0 && (
          <button
            onClick={() => handleAttentionToggle('atRisk')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              attentionFilter === 'atRisk'
                ? 'bg-red-500 text-white border-red-500 ring-2 ring-offset-1 ring-offset-slate-900 ring-red-500'
                : 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20'
            }`}
          >
            <span>⚠️</span>
            <span>At Risk</span>
            <span className="ml-1 px-1.5 py-0.5 rounded bg-black/20 text-[10px]">
              {summary.needsAttention.atRiskCount}
            </span>
          </button>
        )}

        {attentionFilter && (
          <button
            onClick={() => {
              setAttentionFilter(null);
              updateUrl(stageFilter, searchQuery, null, sortBy, sortDirection);
            }}
            className="text-xs text-slate-500 hover:text-slate-300 ml-2"
          >
            Clear
          </button>
        )}
      </div>

      {/* Stage Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {STAGE_TABS.map(({ value, label }) => {
          const count =
            value === 'All'
              ? summary.countsByStage.all
              : summary.countsByStage[value.toLowerCase() as keyof typeof summary.countsByStage] || 0;
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
      </div>

      {/* Search and Sort */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px] relative">
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
              placeholder="Search by name, domain, or owner..."
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => handleSortChange(e.target.value as SortField)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            >
              {SORT_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                const newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
                setSortDirection(newDirection);
                updateUrl(stageFilter, searchQuery, attentionFilter, sortBy, newDirection);
              }}
              className="p-2 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors"
              title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
            >
              {sortDirection === 'asc' ? (
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </button>
          </div>

          {/* Count */}
          <div className="text-sm text-slate-400">
            {filteredCompanies.length} {filteredCompanies.length === 1 ? 'company' : 'companies'}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="w-10 px-2 py-3 text-center">
                  <span className="sr-only">Pin</span>
                </th>
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
                  Work
                </th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden xl:table-cell">
                  GAP
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredCompanies.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <svg className="w-12 h-12 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <span>No companies match the selected filters</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCompanies.map((company) => {
                  const isPinned = pinnedIds.includes(company.id);
                  return (
                    <tr
                      key={company.id}
                      className={`border-b border-slate-800/50 last:border-0 hover:bg-slate-800/30 transition-colors ${
                        isPinned ? 'bg-amber-500/5' : ''
                      }`}
                    >
                      {/* Pin */}
                      <td className="px-2 py-3 text-center">
                        <button
                          onClick={(e) => handleTogglePin(company.id, e)}
                          className={`p-1 rounded transition-colors ${
                            isPinned
                              ? 'text-amber-400 hover:text-amber-300'
                              : 'text-slate-600 hover:text-slate-400'
                          }`}
                          title={isPinned ? 'Remove from My Companies' : 'Add to My Companies'}
                        >
                          <svg
                            className="w-4 h-4"
                            fill={isPinned ? 'currentColor' : 'none'}
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                            />
                          </svg>
                        </button>
                      </td>

                      {/* Company */}
                      <td className="px-4 py-3">
                        <Link href={`/c/${company.id}`} className="block group">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-200 font-medium group-hover:text-amber-400 transition-colors">
                              {company.name}
                            </span>
                            {company.isHighIntent && (
                              <span
                                className="px-1.5 py-0.5 text-[10px] rounded bg-red-500/10 text-red-400 border border-red-500/30"
                                title={company.highIntentReasons.join(', ')}
                              >
                                High Intent
                              </span>
                            )}
                            {company.isDuplicate && (
                              <span className="px-1.5 py-0.5 text-[10px] rounded bg-purple-500/10 text-purple-400 border border-purple-500/30">
                                Duplicate
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-500">{company.domain || '—'}</span>
                        </Link>
                      </td>

                      {/* Stage */}
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getStageBadgeClasses(
                            company.stage
                          )}`}
                        >
                          {company.stage}
                        </span>
                      </td>

                      {/* Health */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getHealthBadgeClasses(
                            company.health
                          )}`}
                          title={company.healthReasons.join(', ')}
                        >
                          {company.health === 'AtRisk' && (
                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fillRule="evenodd"
                                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                          {getHealthLabel(company.health)}
                        </span>
                      </td>

                      {/* Tier */}
                      <td className="px-4 py-3 text-slate-400 text-xs hidden md:table-cell">
                        {company.tier ? `Tier ${company.tier}` : '—'}
                      </td>

                      {/* Owner */}
                      <td className="px-4 py-3 text-slate-400 text-xs hidden lg:table-cell">
                        {company.ownerName || '—'}
                      </td>

                      {/* Last Activity */}
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="flex flex-col">
                          <span className="text-slate-300 text-xs">
                            {company.lastActivityLabel}
                          </span>
                          {company.lastActivitySource !== 'None' && (
                            <span className="text-[10px] text-slate-500">
                              {company.lastActivitySource}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Work */}
                      <td className="px-4 py-3 text-center hidden xl:table-cell">
                        {company.openWorkCount > 0 ? (
                          <div className="flex flex-col items-center">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                company.overdueWorkCount > 0
                                  ? 'bg-red-500/10 text-red-400'
                                  : 'bg-blue-500/10 text-blue-400'
                              }`}
                            >
                              {company.openWorkCount}
                            </span>
                            {company.overdueWorkCount > 0 && (
                              <span className="text-[10px] text-red-400 mt-0.5">
                                {company.overdueWorkCount} overdue
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>

                      {/* GAP */}
                      <td className="px-4 py-3 text-center hidden xl:table-cell">
                        {company.latestGap.score !== null ? (
                          <div className="flex flex-col items-center">
                            <span
                              className={`text-sm font-semibold ${getScoreColorClass(
                                company.latestGap.score
                              )}`}
                            >
                              {company.latestGap.score}
                            </span>
                            {company.latestGap.type && (
                              <span
                                className={`text-[10px] ${
                                  company.latestGap.type === 'FULL'
                                    ? 'text-purple-400'
                                    : 'text-blue-400'
                                }`}
                              >
                                {company.latestGap.type === 'FULL' ? 'Full' : 'IA'}
                              </span>
                            )}
                          </div>
                        ) : company.hasNoBaseline ? (
                          <span className="text-[10px] text-slate-500">No baseline</span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/c/${company.id}`}
                            className="text-xs text-amber-500 hover:text-amber-400 font-medium"
                          >
                            Open
                          </Link>
                          <button
                            onClick={(e) => handleQuickActions(company.id, e)}
                            className="p-1 text-slate-400 hover:text-slate-200 rounded transition-colors"
                            title="More actions"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Actions Menu */}
      {selectedCompanyForMenu && (
        <QuickActionsMenu
          company={selectedCompanyForMenu}
          isOpen={!!menuState.companyId}
          onClose={() => setMenuState({ companyId: null, position: { x: 0, y: 0 } })}
          position={menuState.position}
        />
      )}
    </div>
  );
}
