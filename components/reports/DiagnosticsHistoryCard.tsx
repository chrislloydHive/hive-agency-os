'use client';

// components/reports/DiagnosticsHistoryCard.tsx
// Diagnostics History Card - Card wrapper with table, filters, and empty states
//
// Features:
// - Card wrapper with header
// - Compact filter selects
// - Restyled table
// - Empty states (global and filter-empty)
// - Footer with results count

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  ExternalLink,
  ChevronDown,
  Activity,
  ArrowRight,
  XCircle,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface DiagnosticRunSummary {
  id: string;
  type: string;
  label: string;
  createdAt: string;
  createdBy?: string;
  status: 'success' | 'running' | 'failed' | 'pending';
  scoreSummary?: string;
  link?: string;
}

export interface DiagnosticsHistoryCardProps {
  companyId: string;
  runs: DiagnosticRunSummary[];
}

// ============================================================================
// Filter Options
// ============================================================================

const TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'gap', label: 'GAP Analysis' },
  { value: 'website', label: 'Website Lab' },
  { value: 'brand', label: 'Brand Lab' },
  { value: 'competition', label: 'Competition Lab' },
  { value: 'creative', label: 'Creative Lab' },
  { value: 'seo', label: 'SEO Lab' },
  { value: 'content', label: 'Content Lab' },
  { value: 'demand', label: 'Demand Lab' },
  { value: 'ops', label: 'Ops Lab' },
  { value: 'other', label: 'Other' },
];

const TIME_OPTIONS = [
  { value: 'all', label: 'All Time' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '180', label: 'Last 6 months' },
];

// ============================================================================
// Custom Select Component
// ============================================================================

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}

function CustomSelect({ value, onChange, options, className = '' }: SelectProps) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none w-full h-8 px-3 pr-8 text-xs font-medium rounded-lg border border-slate-800 bg-slate-900 text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
    </div>
  );
}

// ============================================================================
// Status Chip Component
// ============================================================================

function StatusChip({ status }: { status: DiagnosticRunSummary['status'] }) {
  const config = {
    success: {
      icon: CheckCircle,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      label: 'Done',
    },
    running: {
      icon: Loader2,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      label: 'Running',
      animate: true,
    },
    failed: {
      icon: AlertCircle,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      label: 'Failed',
    },
    pending: {
      icon: Clock,
      color: 'text-slate-400',
      bg: 'bg-slate-500/10',
      border: 'border-slate-700',
      label: 'Pending',
    },
  };

  const c = config[status];
  const Icon = c.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${c.bg} ${c.border} ${c.color}`}>
      <Icon className={`w-3 h-3 ${(c as { animate?: boolean }).animate ? 'animate-spin' : ''}`} />
      {c.label}
    </span>
  );
}

// ============================================================================
// Type Badge Component
// ============================================================================

function TypeBadge({ type }: { type: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-[11px] font-medium text-slate-300">
      {type}
    </span>
  );
}

// ============================================================================
// Empty States
// ============================================================================

interface GlobalEmptyStateProps {
  companyId: string;
}

function GlobalEmptyState({ companyId }: GlobalEmptyStateProps) {
  return (
    <div className="py-12 flex flex-col items-center justify-center text-center min-h-[200px]">
      <div className="p-4 rounded-full bg-slate-800/50 border border-slate-700/50 mb-4">
        <Activity className="w-8 h-8 text-slate-500" />
      </div>
      <h3 className="text-sm font-semibold text-slate-200 mb-1">
        No diagnostics yet
      </h3>
      <p className="text-xs text-slate-400 mb-5 max-w-xs">
        Run your first Full GAP or lab to start building your report history.
      </p>
      <Link
        href={`/c/${companyId}/diagnostics`}
        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 text-white shadow-lg shadow-sky-500/20 transition-colors"
      >
        Go to Diagnostics
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}

interface FilterEmptyStateProps {
  onClear: () => void;
}

function FilterEmptyState({ onClear }: FilterEmptyStateProps) {
  return (
    <div className="py-10 flex flex-col items-center justify-center text-center">
      <div className="p-3 rounded-full bg-slate-800/50 border border-slate-700/50 mb-3">
        <XCircle className="w-6 h-6 text-slate-500" />
      </div>
      <p className="text-sm text-slate-400 mb-3">
        No diagnostics match these filters.
      </p>
      <button
        onClick={onClear}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
      >
        Clear filters
      </button>
    </div>
  );
}

// ============================================================================
// Utilities
// ============================================================================

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

// ============================================================================
// Main Component
// ============================================================================

export function DiagnosticsHistoryCard({
  companyId,
  runs,
}: DiagnosticsHistoryCardProps) {
  const [typeFilter, setTypeFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all');

  const filteredRuns = useMemo(() => {
    let result = [...runs];

    if (typeFilter !== 'all') {
      result = result.filter((run) => {
        const typeLower = run.type.toLowerCase();
        switch (typeFilter) {
          case 'gap':
            return typeLower.includes('gap');
          case 'website':
            return typeLower.includes('website');
          case 'brand':
            return typeLower.includes('brand');
          case 'competition':
            return typeLower.includes('competition') || typeLower.includes('competitor');
          case 'creative':
            return typeLower.includes('creative');
          case 'seo':
            return typeLower.includes('seo');
          case 'content':
            return typeLower.includes('content');
          case 'demand':
            return typeLower.includes('demand');
          case 'ops':
            return typeLower.includes('ops');
          case 'other':
            return !['gap', 'website', 'brand', 'competition', 'competitor', 'creative', 'seo', 'content', 'demand', 'ops']
              .some(t => typeLower.includes(t));
          default:
            return true;
        }
      });
    }

    if (timeFilter !== 'all') {
      const days = parseInt(timeFilter, 10);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      result = result.filter((run) => new Date(run.createdAt) >= cutoff);
    }

    return result;
  }, [runs, typeFilter, timeFilter]);

  const clearFilters = () => {
    setTypeFilter('all');
    setTimeFilter('all');
  };

  const hasFilters = typeFilter !== 'all' || timeFilter !== 'all';

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/80 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 md:p-5 border-b border-slate-800/60">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Diagnostics History</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            AI-powered labs and assessments for this company.
          </p>
        </div>

        {/* Filters */}
        {runs.length > 0 && (
          <div className="flex items-center gap-2">
            <CustomSelect
              value={typeFilter}
              onChange={setTypeFilter}
              options={TYPE_OPTIONS}
              className="w-[130px]"
            />
            <CustomSelect
              value={timeFilter}
              onChange={setTimeFilter}
              options={TIME_OPTIONS}
              className="w-[120px]"
            />
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-slate-400 hover:text-slate-300 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {runs.length === 0 ? (
        <GlobalEmptyState companyId={companyId} />
      ) : filteredRuns.length === 0 ? (
        <FilterEmptyState onClear={clearFilters} />
      ) : (
        <>
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-slate-200">
              <thead className="bg-slate-900/80 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Type
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Report Name
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Date
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Status
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Summary
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRuns.map((run, idx) => (
                  <tr
                    key={run.id}
                    className={`border-b border-slate-800/60 last:border-b-0 hover:bg-slate-900/60 transition-colors ${
                      idx % 2 === 0 ? 'bg-transparent' : 'bg-slate-900/30'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <TypeBadge type={run.type} />
                    </td>
                    <td className="px-4 py-3 text-slate-200 max-w-[200px] truncate" title={run.label}>
                      {run.label}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {formatDate(run.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusChip status={run.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs max-w-[180px] truncate" title={run.scoreSummary}>
                      {run.scoreSummary ?? '\u2014'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {run.link && run.status === 'success' ? (
                        <Link
                          href={run.link}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-700 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-slate-100 transition-colors"
                        >
                          View
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      ) : (
                        <span className="text-slate-600">\u2014</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800/60 bg-slate-900/50">
            <span className="text-xs text-slate-500">
              {filteredRuns.length} result{filteredRuns.length !== 1 ? 's' : ''}
            </span>
            <span className="text-xs text-slate-500">
              Most recent first
            </span>
          </div>
        </>
      )}
    </div>
  );
}
