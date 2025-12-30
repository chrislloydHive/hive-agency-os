'use client';

// components/os/work/WorkListPanel.tsx
// Master list panel for work items with search, filters, and grouping

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Search,
  Filter,
  Layers,
  ChevronDown,
  ChevronRight,
  Calendar,
  Target,
  Milestone,
  CheckSquare,
  Activity,
  Loader2,
} from 'lucide-react';
import type { WorkItemRecord, WorkItemStatus } from '@/lib/airtable/workItems';

// ============================================================================
// Types
// ============================================================================

export interface WorkListPanelProps {
  workItems: WorkItemRecord[];
  selectedWorkItemId: string | null;
  onSelectWorkItem: (item: WorkItemRecord | null) => void;
  companyId: string;
  isLoading?: boolean;
}

type StatusFilter = 'all' | WorkItemStatus;
type TypeFilter = 'all' | 'deliverable' | 'milestone' | 'task';
type GroupMode = 'none' | 'type' | 'status';

// ============================================================================
// Constants
// ============================================================================

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'In Progress', label: 'In Progress' },
  { value: 'Planned', label: 'Planned' },
  { value: 'Backlog', label: 'Backlog' },
  { value: 'Done', label: 'Done' },
];

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'milestone', label: 'Milestones' },
  { value: 'deliverable', label: 'Deliverables' },
  { value: 'task', label: 'Tasks' },
];

const STATUS_COLORS: Record<WorkItemStatus, string> = {
  'In Progress': 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  'Planned': 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  'Backlog': 'bg-slate-600/30 text-slate-300 border-slate-500/40',
  'Done': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Infer work item type from programWorkKey or other signals
 */
function inferWorkItemType(item: WorkItemRecord): 'milestone' | 'deliverable' | 'task' {
  if (item.programWorkKey) {
    if (item.programWorkKey.startsWith('milestone::')) return 'milestone';
    if (item.programWorkKey.startsWith('del::')) return 'deliverable';
  }
  // Check title patterns
  if (item.title.toLowerCase().includes('milestone')) return 'milestone';
  return 'task';
}

/**
 * Get type icon
 */
function TypeIcon({ type }: { type: 'milestone' | 'deliverable' | 'task' }) {
  switch (type) {
    case 'milestone':
      return <Milestone className="w-3.5 h-3.5 text-amber-400" />;
    case 'deliverable':
      return <Target className="w-3.5 h-3.5 text-cyan-400" />;
    case 'task':
      return <CheckSquare className="w-3.5 h-3.5 text-slate-400" />;
  }
}

/**
 * Format date for display
 */
function formatDueDate(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'Overdue';
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays <= 7) return `${diffDays}d`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return null;
  }
}

// ============================================================================
// Main Component
// ============================================================================

export function WorkListPanel({
  workItems,
  selectedWorkItemId,
  onSelectWorkItem,
  companyId,
  isLoading = false,
}: WorkListPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [groupMode, setGroupMode] = useState<GroupMode>('type');
  const [showFilters, setShowFilters] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLDivElement>(null);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedWorkItemId && selectedRef.current) {
      selectedRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedWorkItemId]);

  // Filter and group work items
  const { filteredItems, groupedItems } = useMemo(() => {
    // Apply search filter
    let items = workItems;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter(
        item =>
          item.title.toLowerCase().includes(query) ||
          item.notes?.toLowerCase().includes(query) ||
          item.area?.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      items = items.filter(item => item.status === statusFilter);
    }

    // Apply type filter
    if (typeFilter !== 'all') {
      items = items.filter(item => inferWorkItemType(item) === typeFilter);
    }

    // Group items
    const grouped: Record<string, WorkItemRecord[]> = {};

    if (groupMode === 'none') {
      grouped['All'] = items;
    } else if (groupMode === 'type') {
      // Group by type with milestones first
      const milestones = items.filter(i => inferWorkItemType(i) === 'milestone');
      const deliverables = items.filter(i => inferWorkItemType(i) === 'deliverable');
      const tasks = items.filter(i => inferWorkItemType(i) === 'task');

      if (milestones.length > 0) grouped['Milestones'] = milestones;
      if (deliverables.length > 0) grouped['Deliverables'] = deliverables;
      if (tasks.length > 0) grouped['Tasks'] = tasks;
    } else if (groupMode === 'status') {
      // Group by status
      const order: WorkItemStatus[] = ['In Progress', 'Planned', 'Backlog', 'Done'];
      for (const status of order) {
        const statusItems = items.filter(i => i.status === status);
        if (statusItems.length > 0) grouped[status] = statusItems;
      }
    }

    return { filteredItems: items, groupedItems: grouped };
  }, [workItems, searchQuery, statusFilter, typeFilter, groupMode]);

  // Toggle group collapse
  const toggleGroup = useCallback((group: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const currentIndex = filteredItems.findIndex(i => i.id === selectedWorkItemId);
        let nextIndex: number;

        if (e.key === 'ArrowDown') {
          nextIndex = currentIndex < filteredItems.length - 1 ? currentIndex + 1 : 0;
        } else {
          nextIndex = currentIndex > 0 ? currentIndex - 1 : filteredItems.length - 1;
        }

        if (filteredItems[nextIndex]) {
          onSelectWorkItem(filteredItems[nextIndex]);
        }
      } else if (e.key === 'Escape') {
        onSelectWorkItem(null);
      }
    },
    [filteredItems, selectedWorkItemId, onSelectWorkItem]
  );

  return (
    <div
      className="flex flex-col h-full bg-slate-900/50 border-r border-slate-800"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Sticky Header with Search and Filters */}
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800 p-3 space-y-2">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search work items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-slate-800/70 border border-slate-700 rounded-lg text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30"
          />
        </div>

        {/* Filter Row */}
        <div className="flex items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="flex-1 px-2 py-1.5 text-xs bg-slate-800/70 border border-slate-700 rounded-md text-slate-300 focus:outline-none focus:border-cyan-500/50"
          >
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
            className="flex-1 px-2 py-1.5 text-xs bg-slate-800/70 border border-slate-700 rounded-md text-slate-300 focus:outline-none focus:border-cyan-500/50"
          >
            {TYPE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {/* Group Toggle */}
          <button
            onClick={() => setGroupMode(prev => prev === 'type' ? 'none' : 'type')}
            className={`px-2 py-1.5 text-xs rounded-md border transition-colors ${
              groupMode === 'type'
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                : 'bg-slate-800/70 text-slate-400 border-slate-700 hover:text-slate-300'
            }`}
            title="Group by type"
          >
            <Layers className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Result Count */}
        <div className="text-xs text-slate-500">
          {filteredItems.length} of {workItems.length} items
        </div>
      </div>

      {/* List */}
      <div ref={listRef} className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12 px-4">
            <p className="text-sm text-slate-500">No work items found</p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="mt-2 text-xs text-cyan-400 hover:text-cyan-300"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-800/50">
            {Object.entries(groupedItems).map(([group, items]) => (
              <div key={group}>
                {/* Group Header */}
                {groupMode !== 'none' && (
                  <button
                    onClick={() => toggleGroup(group)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-400 bg-slate-800/30 hover:bg-slate-800/50 transition-colors"
                  >
                    {collapsedGroups.has(group) ? (
                      <ChevronRight className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                    <span className="uppercase tracking-wide">{group}</span>
                    <span className="text-slate-500">({items.length})</span>
                  </button>
                )}

                {/* Group Items */}
                {!collapsedGroups.has(group) && (
                  <div>
                    {items.map(item => {
                      const isSelected = item.id === selectedWorkItemId;
                      const itemType = inferWorkItemType(item);
                      const dueDate = formatDueDate(item.dueDate);

                      return (
                        <div
                          key={item.id}
                          ref={isSelected ? selectedRef : null}
                          onClick={() => onSelectWorkItem(item)}
                          className={`px-3 py-2.5 cursor-pointer transition-all duration-150 border-l-2 ${
                            isSelected
                              ? 'bg-slate-800/80 border-l-cyan-400'
                              : 'border-l-transparent hover:bg-slate-800/40'
                          }`}
                        >
                          {/* Row 1: Title */}
                          <div className="flex items-start gap-2">
                            <TypeIcon type={itemType} />
                            <h4 className={`flex-1 text-sm font-medium leading-snug ${
                              isSelected ? 'text-white' : 'text-slate-200'
                            } ${item.status === 'Done' ? 'line-through opacity-60' : ''}`}>
                              {item.title}
                            </h4>
                          </div>

                          {/* Row 2: Metadata */}
                          <div className="mt-1.5 ml-5.5 flex items-center gap-1.5 flex-wrap">
                            {/* Status Pill */}
                            <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded border ${STATUS_COLORS[item.status as WorkItemStatus] || 'bg-slate-600/30 text-slate-300 border-slate-500/40'}`}>
                              {item.status || 'Unknown'}
                            </span>

                            {/* Due Date */}
                            {dueDate && (
                              <span className={`flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded border ${
                                dueDate === 'Overdue'
                                  ? 'bg-red-500/20 text-red-300 border-red-500/40'
                                  : dueDate === 'Today'
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                  : 'bg-slate-700/50 text-slate-400 border-slate-600/50'
                              }`}>
                                <Calendar className="w-3 h-3" />
                                {dueDate}
                              </span>
                            )}

                            {/* Program Badge */}
                            {item.programId && (
                              <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                                <Activity className="w-3 h-3" />
                                Program
                              </span>
                            )}

                            {/* Strategy Badge */}
                            {item.strategyLink && (
                              <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded bg-blue-500/10 text-blue-300 border border-blue-500/30">
                                <Layers className="w-3 h-3" />
                                Strategy
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default WorkListPanel;
