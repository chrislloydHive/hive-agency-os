'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  type CompanyRecord,
  type CompanyStage,
  COMPANY_STAGE_OPTIONS,
} from '@/lib/airtable/companies';

interface WorkItem {
  id: string;
  title: string;
  companyId?: string;
  companyName?: string;
  companyStage?: CompanyStage;
  area?: string;
  status: string;
  severity?: string;
  owner?: string;
  dueDate?: string;
  notes?: string;
  effort?: string;
  impact?: string;
  createdAt?: string;
}

interface WorkboardClientProps {
  workItems: WorkItem[];
  companies: CompanyRecord[];
}

const STATUS_OPTIONS = ['All', 'Backlog', 'Planned', 'In Progress', 'Done'];
const AREA_OPTIONS = [
  'All',
  'Brand',
  'Content',
  'SEO',
  'Website UX',
  'Funnel',
  'Analytics',
  'Strategy',
  'Operations',
  'Other',
];
const GROUP_BY_OPTIONS = ['none', 'status', 'company', 'area', 'owner'] as const;
type GroupByOption = typeof GROUP_BY_OPTIONS[number];

// Helper to format dates
const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
};

// Check if a date is overdue
const isOverdue = (dateStr?: string) => {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
};

// Check if a date is today
const isToday = (dateStr?: string) => {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
};

export function WorkboardClient({
  workItems,
  companies,
}: WorkboardClientProps) {
  const [viewMode, setViewMode] = useState<'mine' | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [areaFilter, setAreaFilter] = useState<string>('All');
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [stageFilter, setStageFilter] = useState<CompanyStage | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [groupBy, setGroupBy] = useState<GroupByOption>('none');

  // Get unique owners
  const uniqueOwners = useMemo(() => {
    const owners = workItems
      .map((w) => w.owner)
      .filter((o): o is string => !!o);
    return Array.from(new Set(owners));
  }, [workItems]);

  // Filter work items
  const filteredItems = useMemo(() => {
    return workItems.filter((item) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!item.title.toLowerCase().includes(query)) return false;
      }

      // Status filter
      if (statusFilter !== 'All' && item.status !== statusFilter) return false;

      // Area filter
      if (areaFilter !== 'All' && item.area !== areaFilter) return false;

      // Company filter
      if (companyFilter !== 'all' && item.companyId !== companyFilter)
        return false;

      // Stage filter
      if (stageFilter !== 'all' && item.companyStage !== stageFilter)
        return false;

      // Mine filter (TODO: implement user context)
      // if (viewMode === 'mine' && item.owner !== currentUser) return false;

      return true;
    });
  }, [workItems, statusFilter, areaFilter, companyFilter, stageFilter, searchQuery, viewMode]);

  // Group items by selected grouping
  const groupedItems = useMemo(() => {
    if (groupBy === 'none') {
      return { 'All Items': filteredItems };
    }

    const groups: Record<string, WorkItem[]> = {};

    filteredItems.forEach((item) => {
      let key: string;

      switch (groupBy) {
        case 'status':
          key = item.status || 'Backlog';
          break;
        case 'company':
          key = item.companyName || 'No Company';
          break;
        case 'area':
          key = item.area || 'No Area';
          break;
        case 'owner':
          key = item.owner || 'Unassigned';
          break;
        default:
          key = 'All Items';
      }

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
    });

    // Sort groups by key
    const sortedGroups: Record<string, WorkItem[]> = {};
    Object.keys(groups)
      .sort((a, b) => {
        // For status, use custom order
        if (groupBy === 'status') {
          const statusOrder = ['In Progress', 'Planned', 'Backlog', 'Done'];
          return statusOrder.indexOf(a) - statusOrder.indexOf(b);
        }
        return a.localeCompare(b);
      })
      .forEach((key) => {
        sortedGroups[key] = groups[key];
      });

    return sortedGroups;
  }, [filteredItems, groupBy]);

  // Stats
  const stats = useMemo(() => {
    const today = workItems.filter(
      (w) => w.status !== 'Done' && isToday(w.dueDate)
    ).length;
    const overdue = workItems.filter(
      (w) =>
        w.status !== 'Done' && isOverdue(w.dueDate) && !isToday(w.dueDate)
    ).length;
    const inProgress = workItems.filter(
      (w) => w.status === 'In Progress'
    ).length;
    const total = workItems.filter((w) => w.status !== 'Done').length;

    return { today, overdue, inProgress, total };
  }, [workItems]);

  return (
    <div className="space-y-6">
      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          <div className="text-2xl font-bold text-slate-100">{stats.total}</div>
          <div className="text-xs text-slate-500">Total Active</div>
        </div>
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          <div className="text-2xl font-bold text-amber-500">{stats.today}</div>
          <div className="text-xs text-slate-500">Due Today</div>
        </div>
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          <div className="text-2xl font-bold text-red-400">{stats.overdue}</div>
          <div className="text-xs text-slate-500">Overdue</div>
        </div>
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          <div className="text-2xl font-bold text-blue-400">
            {stats.inProgress}
          </div>
          <div className="text-xs text-slate-500">In Progress</div>
        </div>
      </div>

      {/* Stage Filter Bar */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-slate-400 mr-1">Stage:</span>
          <button
            onClick={() => setStageFilter('all')}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              stageFilter === 'all'
                ? 'bg-amber-500 text-slate-900'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300'
            }`}
          >
            All
          </button>
          {COMPANY_STAGE_OPTIONS.map((option) => (
            <button
              key={option.slug}
              onClick={() => setStageFilter(option.slug)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                stageFilter === option.slug
                  ? 'bg-amber-500 text-slate-900'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
        <div className="flex flex-wrap items-end gap-4">
          {/* View Mode Toggle */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              View
            </label>
            <div className="flex">
              <button
                onClick={() => setViewMode('all')}
                className={`px-3 py-1.5 text-sm font-medium rounded-l-lg border transition-colors ${
                  viewMode === 'all'
                    ? 'bg-amber-500 text-slate-900 border-amber-500'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-300'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setViewMode('mine')}
                className={`px-3 py-1.5 text-sm font-medium rounded-r-lg border-t border-r border-b transition-colors ${
                  viewMode === 'mine'
                    ? 'bg-amber-500 text-slate-900 border-amber-500'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-300'
                }`}
              >
                Mine
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Search
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search work items..."
              className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          {/* Area Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Area
            </label>
            <select
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            >
              {AREA_OPTIONS.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
          </div>

          {/* Company Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Company
            </label>
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            >
              <option value="all">All Companies</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>

          {/* Group By */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Group By
            </label>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupByOption)}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            >
              <option value="none">No Grouping</option>
              <option value="status">Status</option>
              <option value="company">Company</option>
              <option value="area">Area</option>
              <option value="owner">Owner</option>
            </select>
          </div>

          {/* Results */}
          <div className="text-sm text-slate-400">
            {filteredItems.length} items
            {groupBy !== 'none' && ` in ${Object.keys(groupedItems).length} groups`}
          </div>
        </div>
      </div>

      {/* Work Items Table */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
        {filteredItems.length === 0 ? (
          <div className="p-12 text-center">
            <svg
              className="w-16 h-16 mx-auto text-slate-600 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
            <h3 className="text-lg font-semibold text-slate-300 mb-2">
              No work items found
            </h3>
            <p className="text-sm text-slate-500">
              {workItems.length === 0
                ? 'Create work items from company priorities or add them manually.'
                : 'Try adjusting your filters.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {Object.entries(groupedItems).map(([groupName, items]) => (
              <div key={groupName}>
                {/* Group Header (only show if grouping is enabled) */}
                {groupBy !== 'none' && (
                  <div className="px-4 py-3 bg-slate-900 border-b border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-300">
                        {groupName}
                      </span>
                      <span className="text-xs text-slate-500">
                        {items.length} item{items.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                )}

                {/* Table for this group */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    {groupBy === 'none' && (
                      <thead>
                        <tr className="border-b border-slate-800">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                            Title
                          </th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                            Company
                          </th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                            Area
                          </th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                            Status
                          </th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                            Due
                          </th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                            Owner
                          </th>
                        </tr>
                      </thead>
                    )}
                    <tbody>
                      {items.map((item) => {
                        const overdue =
                          item.status !== 'Done' &&
                          isOverdue(item.dueDate) &&
                          !isToday(item.dueDate);
                        const dueToday =
                          item.status !== 'Done' && isToday(item.dueDate);

                        return (
                          <tr
                            key={item.id}
                            className={`border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors ${
                              overdue ? 'bg-red-500/5' : ''
                            }`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="text-slate-200 font-medium">
                                  {item.title}
                                </span>
                                {item.severity === 'Critical' && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-500/20 text-red-400 border border-red-500/30">
                                    CRITICAL
                                  </span>
                                )}
                                {overdue && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-500/20 text-red-400">
                                    OVERDUE
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {item.companyId && groupBy !== 'company' ? (
                                <Link
                                  href={`/companies/${item.companyId}`}
                                  className="text-amber-500 hover:text-amber-400 text-xs"
                                >
                                  {item.companyName || 'View'}
                                </Link>
                              ) : groupBy === 'company' ? (
                                <span className="text-slate-500 text-xs">—</span>
                              ) : (
                                <span className="text-slate-500 text-xs">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {item.area && groupBy !== 'area' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-700 text-slate-300">
                                  {item.area}
                                </span>
                              ) : (
                                <span className="text-slate-500 text-xs">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {groupBy !== 'status' && (
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                    item.status === 'In Progress'
                                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                                      : item.status === 'Planned'
                                      ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                                      : item.status === 'Done'
                                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                      : 'bg-slate-500/10 text-slate-400 border border-slate-500/30'
                                  }`}
                                >
                                  {item.status}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`text-xs ${
                                  overdue
                                    ? 'text-red-400 font-semibold'
                                    : dueToday
                                    ? 'text-amber-400 font-semibold'
                                    : 'text-slate-400'
                                }`}
                              >
                                {formatDate(item.dueDate)}
                                {dueToday && ' (today)'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-400 text-xs">
                              {groupBy !== 'owner' ? item.owner || '—' : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
