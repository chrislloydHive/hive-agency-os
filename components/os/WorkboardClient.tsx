'use client';

// components/os/WorkboardClient.tsx
// Daily Job Board view with time bucket grouping and deep-linkable work items

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  type CompanyStage,
  COMPANY_STAGE_OPTIONS,
} from '@/lib/types/company';
import {
  type WorkSource,
  type WorkItem,
  getSourceLabel,
  isAnalyticsSource,
  areaToCategory,
  severityToPriority,
} from '@/lib/types/work';
import {
  groupWorkItemsByTimeBucket,
  type TimeBucket,
  TIME_BUCKET_CONFIG,
  getUniqueOwners,
  getUniqueStatuses,
  filterByOwner,
  filterByStatus,
} from '@/lib/work/grouping';
import WorkCard from './WorkCard';
import WorkDetailPanel from './WorkDetailPanel';

// ============================================================================
// Types
// ============================================================================

// Local interface for company data passed from server
interface CompanyRecord {
  id: string;
  name: string;
  stage?: string;
}

// Work item from server (may have legacy or new fields)
interface ServerWorkItem {
  id: string;
  title: string;
  companyId?: string;
  companyName?: string;
  companyStage?: CompanyStage;
  area?: string;
  status: string;
  severity?: string;
  owner?: string;
  ownerName?: string;
  dueDate?: string;
  notes?: string;
  effort?: string;
  impact?: string;
  createdAt?: string;
  updatedAt?: string;
  lastTouchedAt?: string;
  source?: WorkSource;
  aiAdditionalInfo?: string;
}

interface WorkboardClientProps {
  workItems: ServerWorkItem[];
  companies: CompanyRecord[];
}

// ============================================================================
// Constants
// ============================================================================

const STATUS_OPTIONS = ['All', 'Backlog', 'Planned', 'In Progress', 'Done'];
const VIEW_OPTIONS = ['board', 'table'] as const;
type ViewOption = typeof VIEW_OPTIONS[number];

// ============================================================================
// Helpers
// ============================================================================

// Convert server work item to client WorkItem with normalized fields
function normalizeWorkItem(item: ServerWorkItem): WorkItem {
  return {
    ...item,
    status: (item.status || 'Backlog') as WorkItem['status'],
    area: item.area as WorkItem['area'],
    severity: item.severity as WorkItem['severity'],
    ownerName: item.ownerName || item.owner,
    priority: severityToPriority(item.severity as WorkItem['severity']),
    category: areaToCategory(item.area as WorkItem['area']),
  };
}

// Get stage badge styling
const getStageBadgeStyle = (stage?: CompanyStage) => {
  switch (stage) {
    case 'client':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    case 'prospect':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    case 'internal':
      return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
    case 'dormant':
      return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    case 'lost':
      return 'bg-red-500/10 text-red-400 border-red-500/30';
    default:
      return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
  }
};

// ============================================================================
// Main Component
// ============================================================================

export function WorkboardClient({
  workItems: serverWorkItems,
  companies,
}: WorkboardClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Normalize work items
  const workItems = useMemo(
    () => serverWorkItems.map(normalizeWorkItem),
    [serverWorkItems]
  );

  // URL params state
  const selectedWorkId = searchParams.get('workId');
  const initialOwner = searchParams.get('owner');
  const initialStatus = searchParams.get('status');

  // Local state
  const [viewMode, setViewMode] = useState<ViewOption>('board');
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus || 'All');
  const [ownerFilter, setOwnerFilter] = useState<string | null>(initialOwner);
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [stageFilter, setStageFilter] = useState<CompanyStage | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<WorkItem | null>(null);

  // Deep-link: auto-select work item from URL
  useEffect(() => {
    if (selectedWorkId) {
      const item = workItems.find((w) => w.id === selectedWorkId);
      if (item) {
        setSelectedItem(item);
      }
    }
  }, [selectedWorkId, workItems]);

  // Update URL when selection changes
  const updateUrl = useCallback(
    (workId: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (workId) {
        params.set('workId', workId);
      } else {
        params.delete('workId');
      }
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  // Handle item click
  const handleItemClick = useCallback(
    (item: WorkItem) => {
      setSelectedItem(item);
      updateUrl(item.id);
    },
    [updateUrl]
  );

  // Handle panel close
  const handleClosePanel = useCallback(() => {
    setSelectedItem(null);
    updateUrl(null);
  }, [updateUrl]);

  // Get unique owners from work items
  const uniqueOwners = useMemo(() => getUniqueOwners(workItems), [workItems]);

  // Filter work items
  const filteredItems = useMemo(() => {
    let filtered = workItems;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.title.toLowerCase().includes(query) ||
          item.notes?.toLowerCase().includes(query)
      );
    }

    // Status filter (exclude Done by default in board view)
    if (statusFilter === 'All') {
      filtered = filtered.filter((item) => item.status !== 'Done');
    } else if (statusFilter !== 'All') {
      filtered = filtered.filter((item) => item.status === statusFilter);
    }

    // Company filter
    if (companyFilter !== 'all') {
      filtered = filtered.filter((item) => item.companyId === companyFilter);
    }

    // Stage filter
    if (stageFilter !== 'all') {
      filtered = filtered.filter((item) => item.companyStage === stageFilter);
    }

    // Owner filter
    if (ownerFilter) {
      filtered = filterByOwner(filtered, ownerFilter);
    }

    return filtered;
  }, [workItems, statusFilter, companyFilter, stageFilter, searchQuery, ownerFilter]);

  // Group by time bucket
  const groupedItems = useMemo(
    () => groupWorkItemsByTimeBucket(filteredItems),
    [filteredItems]
  );

  // Stats
  const stats = useMemo(() => {
    const activeItems = workItems.filter((w) => w.status !== 'Done');
    return {
      total: activeItems.length,
      overdue: groupedItems.overdue.length,
      today: groupedItems.today.length,
      thisWeek: groupedItems.this_week.length,
      inProgress: workItems.filter((w) => w.status === 'In Progress').length,
    };
  }, [workItems, groupedItems]);

  return (
    <div className="flex gap-6">
      {/* Main content */}
      <div className="flex-1 space-y-6">
        {/* Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <StatCard label="Total Active" value={stats.total} />
          <StatCard label="Overdue" value={stats.overdue} color="red" />
          <StatCard label="Due Today" value={stats.today} color="amber" />
          <StatCard label="This Week" value={stats.thisWeek} color="blue" />
          <StatCard label="In Progress" value={stats.inProgress} color="purple" />
        </div>

        {/* Stage Filter Bar */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-slate-400 mr-1">Stage:</span>
            <FilterButton
              active={stageFilter === 'all'}
              onClick={() => setStageFilter('all')}
            >
              All
            </FilterButton>
            {COMPANY_STAGE_OPTIONS.map((option) => (
              <FilterButton
                key={option.slug}
                active={stageFilter === option.slug}
                onClick={() => setStageFilter(option.slug)}
              >
                {option.label}
              </FilterButton>
            ))}
          </div>
        </div>

        {/* Filters Row */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <div className="flex flex-wrap items-end gap-4">
            {/* View Toggle */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                View
              </label>
              <div className="flex">
                <button
                  onClick={() => setViewMode('board')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-l-lg border transition-colors ${
                    viewMode === 'board'
                      ? 'bg-amber-500 text-slate-900 border-amber-500'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-300'
                  }`}
                >
                  Board
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-r-lg border-t border-r border-b transition-colors ${
                    viewMode === 'table'
                      ? 'bg-amber-500 text-slate-900 border-amber-500'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-300'
                  }`}
                >
                  Table
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

            {/* Owner Filter */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Owner
              </label>
              <select
                value={ownerFilter || 'all'}
                onChange={(e) =>
                  setOwnerFilter(e.target.value === 'all' ? null : e.target.value)
                }
                className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              >
                <option value="all">All Owners</option>
                {uniqueOwners.map((owner) => (
                  <option key={owner} value={owner}>
                    {owner}
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

            {/* Results Count */}
            <div className="text-sm text-slate-400">
              {filteredItems.length} items
            </div>
          </div>
        </div>

        {/* Work Items Display */}
        {viewMode === 'board' ? (
          <BoardView
            groupedItems={groupedItems}
            selectedItem={selectedItem}
            onItemClick={handleItemClick}
          />
        ) : (
          <TableView
            items={filteredItems}
            selectedItem={selectedItem}
            onItemClick={handleItemClick}
          />
        )}
      </div>

      {/* Detail Panel (slide-in from right) */}
      {selectedItem && (
        <WorkDetailPanel item={selectedItem} onClose={handleClosePanel} />
      )}
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: 'red' | 'amber' | 'blue' | 'purple';
}) {
  const colorClass = color
    ? {
        red: 'text-red-400',
        amber: 'text-amber-500',
        blue: 'text-blue-400',
        purple: 'text-purple-400',
      }[color]
    : 'text-slate-100';

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
      <div className={`text-2xl font-bold ${colorClass}`}>{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

function FilterButton({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
        active
          ? 'bg-amber-500 text-slate-900'
          : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300'
      }`}
    >
      {children}
    </button>
  );
}

function BoardView({
  groupedItems,
  selectedItem,
  onItemClick,
}: {
  groupedItems: ReturnType<typeof groupWorkItemsByTimeBucket>;
  selectedItem: WorkItem | null;
  onItemClick: (item: WorkItem) => void;
}) {
  const buckets: TimeBucket[] = ['overdue', 'today', 'this_week', 'later', 'no_date'];

  return (
    <div className="space-y-6">
      {buckets.map((bucket) => {
        const items = groupedItems[bucket];
        if (items.length === 0) return null;

        const config = TIME_BUCKET_CONFIG[bucket];
        const colorClasses = {
          red: 'border-red-500/30 bg-red-500/5',
          blue: 'border-blue-500/30 bg-blue-500/5',
          yellow: 'border-amber-500/30 bg-amber-500/5',
          gray: 'border-slate-700 bg-slate-900/50',
        }[config.color] || 'border-slate-700 bg-slate-900/50';

        return (
          <div key={bucket} className={`rounded-xl border p-4 ${colorClasses}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                {config.label}
              </h2>
              <span className="text-xs text-slate-500">{items.length} items</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <WorkCard
                  key={item.id}
                  item={item}
                  isSelected={selectedItem?.id === item.id}
                  onClick={onItemClick}
                  showCompany
                />
              ))}
            </div>
          </div>
        );
      })}

      {Object.values(groupedItems).every((items) => items.length === 0) && (
        <EmptyState />
      )}
    </div>
  );
}

function TableView({
  items,
  selectedItem,
  onItemClick,
}: {
  items: WorkItem[];
  selectedItem: WorkItem | null;
  onItemClick: (item: WorkItem) => void;
}) {
  if (items.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
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
                Priority
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
            {items.map((item) => (
              <tr
                key={item.id}
                onClick={() => onItemClick(item)}
                className={`border-b border-slate-800/50 cursor-pointer transition-colors ${
                  selectedItem?.id === item.id
                    ? 'bg-amber-500/10'
                    : 'hover:bg-slate-800/30'
                }`}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-200 font-medium">{item.title}</span>
                    {isAnalyticsSource(item.source) && (
                      <span
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30"
                        title={getSourceLabel(item.source)}
                      >
                        AI
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {item.companyName ? (
                    <span className="text-slate-300 text-xs">{item.companyName}</span>
                  ) : (
                    <span className="text-slate-500 text-xs">-</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                      item.priority === 'P0'
                        ? 'bg-red-500/20 text-red-300'
                        : item.priority === 'P1'
                        ? 'bg-orange-500/20 text-orange-300'
                        : item.priority === 'P2'
                        ? 'bg-amber-500/20 text-amber-200'
                        : 'bg-slate-500/20 text-slate-300'
                    }`}
                  >
                    {item.priority || 'P2'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      item.status === 'In Progress'
                        ? 'bg-blue-500/10 text-blue-400'
                        : item.status === 'Done'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-slate-500/10 text-slate-400'
                    }`}
                  >
                    {item.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">
                  {item.dueDate
                    ? new Date(item.dueDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })
                    : '-'}
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">
                  {item.ownerName || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-12 text-center">
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
        Create work items from company priorities or add them manually.
      </p>
    </div>
  );
}

export default WorkboardClient;
