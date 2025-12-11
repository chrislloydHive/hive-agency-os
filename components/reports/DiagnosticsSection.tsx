'use client';

// components/reports/DiagnosticsSection.tsx
// Diagnostics History Section - Filterable table of diagnostic runs
//
// Part of the redesigned Reports hub. Shows all diagnostic runs (GAP, Labs, etc.)
// with filtering by type and time range, wrapped in a parent card.

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

export interface DiagnosticsSectionProps {
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
        className="appearance-none w-full h-7 px-2.5 pr-7 text-xs font-medium rounded-md border border-slate-700 bg-slate-800 text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function DiagnosticsSection({
  companyId,
  runs,
}: DiagnosticsSectionProps) {
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

  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-4 md:p-5 space-y-3">
      {/* Section Header with Runs Summary */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Diagnostics History</h2>
          <p className="text-[11px] text-muted-foreground">
            AI-powered labs and assessments for this company.
          </p>
        </div>
        {runs.length > 0 && (
          <div className="text-[11px] text-muted-foreground">
            {runs.length} run{runs.length === 1 ? '' : 's'}
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2">
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
        {(typeFilter !== 'all' || timeFilter !== 'all') && (
          <button
            onClick={() => { setTypeFilter('all'); setTimeFilter('all'); }}
            className="text-[11px] text-slate-400 hover:text-slate-300 ml-1"
          >
            Clear
          </button>
        )}
        <span className="ml-auto text-[11px] text-slate-500">
          {filteredRuns.length} result{filteredRuns.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="max-h-[380px] overflow-auto">
        <table className="w-full table-fixed border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="text-[11px] text-slate-400 border-b border-border/60">
              <th className="px-2 py-2 text-left w-[16%] font-medium">Type</th>
              <th className="px-2 py-2 text-left w-[32%] font-medium">Report Name</th>
              <th className="px-2 py-2 text-left w-[14%] font-medium">Date</th>
              <th className="px-2 py-2 text-left w-[12%] font-medium">Status</th>
              <th className="px-2 py-2 text-left font-medium">Summary</th>
              <th className="px-2 py-2 text-right w-[10%] font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredRuns.map((run) => (
              <tr key={run.id} className="border-t border-border/40 hover:bg-slate-800/20">
                <td className="px-2 py-2 align-middle">
                  <span className="inline-block rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
                    {run.type}
                  </span>
                </td>
                <td className="px-2 py-2 align-middle text-slate-200 truncate" title={run.label}>
                  {run.label}
                </td>
                <td className="px-2 py-2 align-middle text-slate-400">
                  {formatDate(run.createdAt)}
                </td>
                <td className="px-2 py-2 align-middle">
                  <StatusPill status={run.status} />
                </td>
                <td className="px-2 py-2 align-middle text-slate-400 truncate" title={run.scoreSummary}>
                  {run.scoreSummary ?? '-'}
                </td>
                <td className="px-2 py-2 align-middle text-right">
                  {run.link && run.status === 'success' ? (
                    <Link
                      href={run.link}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-700 text-[10px] font-medium text-slate-300 hover:bg-slate-700 hover:text-slate-100 transition-colors"
                    >
                      View
                      <ExternalLink className="w-2.5 h-2.5" />
                    </Link>
                  ) : (
                    <span className="text-slate-600">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredRuns.length === 0 && runs.length > 0 && (
          <div className="py-8 text-center text-xs text-slate-400">
            No diagnostics found for this filter.
          </div>
        )}

        {runs.length === 0 && (
          <div className="py-10 flex flex-col items-center justify-center text-center">
            <div className="p-3 rounded-full bg-slate-800 mb-4">
              <Activity className="w-6 h-6 text-slate-500" />
            </div>
            <h3 className="text-sm font-semibold text-slate-200 mb-1">
              No diagnostics yet
            </h3>
            <p className="text-xs text-slate-400 mb-4 max-w-xs">
              Run a diagnostic lab to analyze this company and see results here.
            </p>
            <Link
              href={`/c/${companyId}/diagnostics`}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors"
            >
              Go to Diagnostics
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Status Pill Component
// ============================================================================

function StatusPill({ status }: { status: DiagnosticRunSummary['status'] }) {
  const config = {
    success: {
      icon: CheckCircle,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      label: 'Done',
    },
    running: {
      icon: Loader2,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      label: 'Running',
      animate: true,
    },
    failed: {
      icon: AlertCircle,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
      label: 'Failed',
    },
    pending: {
      icon: Clock,
      color: 'text-slate-400',
      bg: 'bg-slate-500/10',
      label: 'Pending',
    },
  };

  const c = config[status];
  const Icon = c.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${c.bg} ${c.color}`}>
      <Icon className={`w-2.5 h-2.5 ${(c as { animate?: boolean }).animate ? 'animate-spin' : ''}`} />
      {c.label}
    </span>
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
