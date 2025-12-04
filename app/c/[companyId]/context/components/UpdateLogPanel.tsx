'use client';

// app/c/[companyId]/context/components/UpdateLogPanel.tsx
// Update Log Panel Component
//
// Displays history of all changes to the context graph with full audit trail.
// Shows who changed what, when, and why.

import { useState, useEffect, useMemo } from 'react';
import type { UpdateLogEntry } from '@/lib/contextGraph/governance/updateLog';

// ============================================================================
// Types
// ============================================================================

interface UpdateLogPanelProps {
  companyId: string;
  logs?: UpdateLogEntry[];
  onNavigateToField?: (path: string) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
}

// ============================================================================
// Utility Functions
// ============================================================================

function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  } catch {
    return dateStr;
  }
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '(empty)';
  if (typeof value === 'string') {
    return value.length > 50 ? value.slice(0, 50) + '...' : value;
  }
  if (typeof value === 'object') {
    const str = JSON.stringify(value);
    return str.length > 50 ? str.slice(0, 50) + '...' : str;
  }
  return String(value);
}

function getUpdaterIcon(updatedBy: 'human' | 'ai' | 'system'): React.ReactNode {
  switch (updatedBy) {
    case 'human':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      );
    case 'ai':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      );
    case 'system':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
  }
}

function getStatusBadge(status: UpdateLogEntry['status']): { label: string; className: string } {
  switch (status) {
    case 'applied':
      return { label: 'Applied', className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
    case 'pending':
      return { label: 'Pending', className: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
    case 'rejected':
      return { label: 'Rejected', className: 'bg-red-500/20 text-red-300 border-red-500/30' };
    default:
      return { label: status, className: 'bg-slate-500/20 text-slate-300 border-slate-500/30' };
  }
}

// ============================================================================
// Main Component
// ============================================================================

export function UpdateLogPanel({
  companyId,
  logs = [],
  onNavigateToField,
  onLoadMore,
  hasMore = false,
  isLoading = false,
}: UpdateLogPanelProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'human' | 'ai' | 'system'>('all');

  const filteredLogs = useMemo(() => {
    if (filter === 'all') return logs;
    return logs.filter(log => log.updatedBy === filter);
  }, [logs, filter]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Group logs by date
  const groupedLogs = useMemo(() => {
    const groups: Record<string, UpdateLogEntry[]> = {};

    for (const log of filteredLogs) {
      const date = new Date(log.updatedAt).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(log);
    }

    return groups;
  }, [filteredLogs]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-slate-100">Update Log</h3>
          <p className="text-[11px] text-slate-500">
            {logs.length} change{logs.length !== 1 ? 's' : ''} recorded
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 bg-slate-800 rounded-md p-0.5">
          {(['all', 'human', 'ai', 'system'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-2 py-1 text-[10px] rounded transition-colors capitalize',
                filter === f
                  ? 'bg-slate-700 text-slate-200'
                  : 'text-slate-500 hover:text-slate-300'
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Empty State */}
      {logs.length === 0 && !isLoading && (
        <div className="rounded-lg border border-dashed border-slate-800 bg-slate-950/50 p-6 text-center">
          <svg className="w-8 h-8 mx-auto text-slate-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm text-slate-500">No updates yet</p>
          <p className="text-xs text-slate-600 mt-1">Changes will appear here when fields are modified</p>
        </div>
      )}

      {/* Grouped Logs */}
      <div className="space-y-4">
        {Object.entries(groupedLogs).map(([date, entries]) => (
          <div key={date}>
            {/* Date Header */}
            <div className="sticky top-0 bg-slate-950 py-1 mb-2">
              <span className="text-[10px] uppercase tracking-wide text-slate-500">
                {date}
              </span>
            </div>

            {/* Log Entries */}
            <div className="space-y-2">
              {entries.map((log) => {
                const isExpanded = expandedIds.has(log.updateId);
                const status = getStatusBadge(log.status);

                return (
                  <div
                    key={log.updateId}
                    className="rounded-lg border border-slate-800 bg-slate-900/50 overflow-hidden"
                  >
                    {/* Entry Header */}
                    <button
                      onClick={() => toggleExpand(log.updateId)}
                      className="w-full px-3 py-2.5 flex items-start gap-2 text-left hover:bg-white/5 transition-colors"
                    >
                      {/* Updater Icon */}
                      <span
                        className={cn(
                          'mt-0.5 p-1 rounded-md flex-shrink-0',
                          log.updatedBy === 'human' && 'bg-blue-500/20 text-blue-400',
                          log.updatedBy === 'ai' && 'bg-amber-500/20 text-amber-400',
                          log.updatedBy === 'system' && 'bg-slate-500/20 text-slate-400'
                        )}
                      >
                        {getUpdaterIcon(log.updatedBy)}
                      </span>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-medium text-slate-100">
                            {log.path.split('.').pop()}
                          </span>
                          <span className={cn(
                            'rounded-full px-1.5 py-0.5 text-[9px] font-medium border',
                            status.className
                          )}>
                            {status.label}
                          </span>
                          {log.sourceTool && (
                            <span className="text-[10px] text-slate-500">
                              via {log.sourceTool.replace(/_/g, ' ')}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                          {log.path}
                        </p>
                      </div>

                      {/* Time & Expand */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[10px] text-slate-500">
                          {formatRelativeTime(log.updatedAt)}
                        </span>
                        <svg
                          className={cn(
                            'w-4 h-4 text-slate-500 transition-transform',
                            isExpanded && 'rotate-180'
                          )}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="px-3 pb-3 border-t border-slate-800/50 space-y-3">
                        {/* Value Diff */}
                        <div className="pt-3 grid grid-cols-2 gap-2">
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">
                              Old Value
                            </div>
                            <div className="rounded-md bg-red-500/10 border border-red-500/20 px-2 py-1.5 text-xs text-red-300 font-mono break-all">
                              {formatValue(log.oldValue)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">
                              New Value
                            </div>
                            <div className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-1.5 text-xs text-emerald-300 font-mono break-all">
                              {formatValue(log.newValue)}
                            </div>
                          </div>
                        </div>

                        {/* Reasoning */}
                        {log.reasoning && (
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">
                              Reasoning
                            </div>
                            <p className="text-xs text-slate-300">{log.reasoning}</p>
                          </div>
                        )}

                        {/* Accepted/Rejected By */}
                        {(log.acceptedBy || log.rejectedBy) && (
                          <div className="flex items-center gap-2 text-[11px] text-slate-500">
                            {log.acceptedBy && (
                              <span>Accepted by <span className="text-slate-300">{log.acceptedBy}</span></span>
                            )}
                            {log.rejectedBy && (
                              <span>Rejected by <span className="text-slate-300">{log.rejectedBy}</span></span>
                            )}
                          </div>
                        )}

                        {/* View Field Button */}
                        <button
                          onClick={() => onNavigateToField?.(log.path)}
                          className="text-xs text-amber-400 hover:text-amber-300"
                        >
                          View Field →
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Load More */}
      {hasMore && (
        <button
          onClick={onLoadMore}
          disabled={isLoading}
          className={cn(
            'w-full py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors',
            'border border-slate-800 rounded-lg hover:bg-slate-800/50',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {isLoading ? 'Loading...' : 'Load More'}
        </button>
      )}
    </div>
  );
}

export default UpdateLogPanel;
