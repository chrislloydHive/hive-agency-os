'use client';

// components/reports/DiagnosticsSection.tsx
// Diagnostics History Section - Filterable table of diagnostic runs
//
// Part of the redesigned Reports hub. Shows all diagnostic runs (GAP, Labs, etc.)
// with filtering by type and time range.

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ============================================================================
// Types
// ============================================================================

export interface DiagnosticRunSummary {
  id: string;
  type: string;          // "GAP-IA" | "GAP-Full" | "Website Lab" | "Competition Lab" | ...
  label: string;         // Human readable, e.g. "Website Lab – UX & Conversion"
  createdAt: string;
  createdBy?: string;
  status: 'success' | 'running' | 'failed' | 'pending';
  scoreSummary?: string; // e.g. "Website 62 / SEO 48 / Brand 70"
  link?: string;         // link to full report / lab
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
// Main Component
// ============================================================================

export function DiagnosticsSection({
  companyId,
  runs,
}: DiagnosticsSectionProps) {
  const [typeFilter, setTypeFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all');

  // Filter runs based on selected filters
  const filteredRuns = useMemo(() => {
    let result = [...runs];

    // Filter by type
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

    // Filter by time
    if (timeFilter !== 'all') {
      const days = parseInt(timeFilter, 10);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      result = result.filter((run) => new Date(run.createdAt) >= cutoff);
    }

    return result;
  }, [runs, typeFilter, timeFilter]);

  return (
    <div className="space-y-3">
      {/* Section Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Diagnostics History</h2>
          <p className="text-xs text-muted-foreground">
            AI-powered diagnostics and labs run for this company.
          </p>
        </div>
      </div>

      {/* Card with Filters + Table */}
      <Card className="p-3 bg-card/70 border-border/60">
        {/* Filter Bar */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={timeFilter} onValueChange={setTimeFilter}>
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue placeholder="Time" />
            </SelectTrigger>
            <SelectContent>
              {TIME_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(typeFilter !== 'all' || timeFilter !== 'all') && (
            <button
              onClick={() => { setTypeFilter('all'); setTimeFilter('all'); }}
              className="text-[11px] text-slate-400 hover:text-slate-300 ml-1"
            >
              Clear filters
            </button>
          )}

          <span className="ml-auto text-[11px] text-slate-500">
            {filteredRuns.length} run{filteredRuns.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Table */}
        <div className="max-h-[420px] overflow-auto text-xs">
          <table className="w-full table-fixed border-collapse">
            <thead className="sticky top-0 z-10 bg-background/95">
              <tr className="text-[11px] text-muted-foreground border-b border-border/40">
                <th className="px-2 py-2 text-left w-[18%] font-medium">Type</th>
                <th className="px-2 py-2 text-left w-[30%] font-medium">Report</th>
                <th className="px-2 py-2 text-left w-[16%] font-medium">Date</th>
                <th className="px-2 py-2 text-left w-[12%] font-medium">Status</th>
                <th className="px-2 py-2 text-left font-medium">Summary</th>
                <th className="px-2 py-2 text-right w-[10%] font-medium">Open</th>
              </tr>
            </thead>
            <tbody>
              {filteredRuns.map((run) => (
                <tr key={run.id} className="border-t border-border/40 hover:bg-muted/30">
                  <td className="px-2 py-2 align-top">
                    <span className="inline-block rounded-full bg-muted px-2 py-[2px] text-[10px] font-medium">
                      {run.type}
                    </span>
                  </td>
                  <td className="px-2 py-2 align-top text-slate-200 truncate" title={run.label}>
                    {run.label}
                  </td>
                  <td className="px-2 py-2 align-top text-muted-foreground">
                    {formatDate(run.createdAt)}
                  </td>
                  <td className="px-2 py-2 align-top">
                    <StatusPill status={run.status} />
                  </td>
                  <td className="px-2 py-2 align-top text-muted-foreground truncate" title={run.scoreSummary}>
                    {run.scoreSummary ?? '-'}
                  </td>
                  <td className="px-2 py-2 align-top text-right">
                    {run.link && run.status === 'success' ? (
                      <Link
                        href={run.link}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-700 text-[10px] font-medium text-slate-300 hover:bg-slate-800 hover:text-slate-100 transition-colors"
                      >
                        View
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredRuns.length === 0 && (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No diagnostics found for this filter.
            </div>
          )}
        </div>
      </Card>

      {/* Subtle hint for future types */}
      <p className="text-[11px] text-slate-600 text-center">
        More strategic report types (campaign reviews, competitive decks) will appear here over time.
      </p>
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
      label: 'Completed',
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
      <Icon className={`w-3 h-3 ${(c as { animate?: boolean }).animate ? 'animate-spin' : ''}`} />
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
