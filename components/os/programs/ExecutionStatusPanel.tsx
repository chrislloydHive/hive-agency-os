'use client';

// components/os/programs/ExecutionStatusPanel.tsx
// Shows execution status for committed programs
//
// Displays:
// - Progress bar showing completion percentage
// - Status breakdown (Backlog, In Progress, Done)
// - List of work items with status indicators
// - Link to full work view

import React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import {
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  AlertCircle,
  ExternalLink,
  Activity,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface WorkItemSummary {
  id: string;
  title: string;
  status: 'Backlog' | 'Planned' | 'In Progress' | 'Done' | undefined;
  area: string | undefined;
  dueDate: string | undefined;
}

interface ExecutionStatusData {
  success: boolean;
  programId: string;
  programStatus: string;
  workItems: WorkItemSummary[];
  summary: {
    total: number;
    byStatus: Record<string, number>;
    completionPercent: number;
  };
  error?: string;
}

interface ExecutionStatusPanelProps {
  programId: string;
  companyId: string;
}

// ============================================================================
// Fetcher
// ============================================================================

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// ============================================================================
// Status Icon Helper
// ============================================================================

function StatusIcon({ status }: { status: string | undefined }) {
  switch (status) {
    case 'Done':
      return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    case 'In Progress':
      return <Clock className="w-4 h-4 text-blue-400" />;
    case 'Planned':
      return <Circle className="w-4 h-4 text-purple-400" />;
    default:
      return <Circle className="w-4 h-4 text-slate-500" />;
  }
}

// ============================================================================
// Component
// ============================================================================

export function ExecutionStatusPanel({ programId, companyId }: ExecutionStatusPanelProps) {
  const { data, error, isLoading } = useSWR<ExecutionStatusData>(
    `/api/os/programs/${programId}/work`,
    fetcher,
    { refreshInterval: 30000 } // Refresh every 30 seconds
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-lg p-4">
        <div className="flex items-center gap-2 text-cyan-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading execution status...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !data?.success) {
    return (
      <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">Failed to load execution status</span>
        </div>
      </div>
    );
  }

  const { workItems, summary } = data;

  // No work items
  if (summary.total === 0) {
    return (
      <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4">
        <div className="flex items-center gap-2 text-slate-400">
          <Activity className="w-4 h-4" />
          <span className="text-sm">No work items created yet</span>
        </div>
      </div>
    );
  }

  const doneCount = summary.byStatus['Done'] || 0;
  const inProgressCount = summary.byStatus['In Progress'] || 0;
  const backlogCount = (summary.byStatus['Backlog'] || 0) + (summary.byStatus['Planned'] || 0);

  return (
    <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-cyan-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <h4 className="text-sm font-medium text-white">Execution Status</h4>
          </div>
          <Link
            href={`/c/${companyId}/work?programId=${programId}`}
            className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            View all
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="px-4 py-3 border-b border-cyan-500/10">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-400">
            {doneCount} of {summary.total} complete
          </span>
          <span className="text-xs font-medium text-cyan-400">
            {summary.completionPercent}%
          </span>
        </div>
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-500"
            style={{ width: `${summary.completionPercent}%` }}
          />
        </div>
      </div>

      {/* Status Breakdown */}
      <div className="px-4 py-3 border-b border-cyan-500/10 flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-xs text-slate-400">Done: {doneCount}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-blue-400" />
          <span className="text-xs text-slate-400">In Progress: {inProgressCount}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-slate-500" />
          <span className="text-xs text-slate-400">Backlog: {backlogCount}</span>
        </div>
      </div>

      {/* Work Items (max 5) */}
      <div className="px-4 py-2">
        <ul className="space-y-1">
          {workItems.slice(0, 5).map((item) => (
            <li key={item.id} className="flex items-center gap-2 py-1.5">
              <StatusIcon status={item.status} />
              <span className="text-sm text-slate-300 truncate flex-1">
                {item.title}
              </span>
              {item.area && (
                <span className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-500 rounded">
                  {item.area}
                </span>
              )}
            </li>
          ))}
        </ul>
        {workItems.length > 5 && (
          <p className="text-xs text-slate-500 mt-2">
            +{workItems.length - 5} more items
          </p>
        )}
      </div>
    </div>
  );
}
