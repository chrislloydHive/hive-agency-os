'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { CompanyRecord } from '@/lib/airtable/companies';

interface WorkItem {
  id: string;
  title: string;
  companyId?: string;
  companyName?: string;
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
  'Other',
];

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
  const [searchQuery, setSearchQuery] = useState('');

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

      // Mine filter (TODO: implement user context)
      // if (viewMode === 'mine' && item.owner !== currentUser) return false;

      return true;
    });
  }, [workItems, statusFilter, areaFilter, companyFilter, searchQuery, viewMode]);

  // Group by status for kanban-style display
  const groupedByStatus = useMemo(() => {
    const groups: Record<string, WorkItem[]> = {
      Backlog: [],
      Planned: [],
      'In Progress': [],
      Done: [],
    };

    filteredItems.forEach((item) => {
      const status = item.status || 'Backlog';
      if (groups[status]) {
        groups[status].push(item);
      } else {
        groups['Backlog'].push(item);
      }
    });

    return groups;
  }, [filteredItems]);

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

          {/* Results */}
          <div className="text-sm text-slate-400">
            {filteredItems.length} items
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
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
              <tbody>
                {filteredItems.map((item) => {
                  const overdue =
                    item.status !== 'Done' &&
                    isOverdue(item.dueDate) &&
                    !isToday(item.dueDate);
                  const dueToday =
                    item.status !== 'Done' && isToday(item.dueDate);

                  return (
                    <tr
                      key={item.id}
                      className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
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
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {item.companyId ? (
                          <Link
                            href={`/os/companies/${item.companyId}`}
                            className="text-amber-500 hover:text-amber-400 text-xs"
                          >
                            {item.companyName || 'View'}
                          </Link>
                        ) : (
                          <span className="text-slate-500 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {item.area ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-700 text-slate-300">
                            {item.area}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
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
                          {overdue && ' (overdue)'}
                          {dueToday && ' (today)'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {item.owner || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
