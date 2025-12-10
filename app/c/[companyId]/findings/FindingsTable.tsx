'use client';

// app/c/[companyId]/findings/FindingsTable.tsx
// Table of diagnostic findings with multi-select and bulk actions
//
// Features:
// - Checkbox multi-select with Select All
// - Bulk "Add to Work" action
// - Individual row click for detail drawer

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Loader2, CheckCircle, ClipboardList } from 'lucide-react';
import type { DiagnosticDetailFinding } from '@/lib/airtable/diagnosticDetails';

// ============================================================================
// Types
// ============================================================================

interface FindingsTableProps {
  findings: DiagnosticDetailFinding[];
  loading: boolean;
  onSelectFinding: (finding: DiagnosticDetailFinding | null) => void;
  selectedFindingId?: string;
  companyId: string;
  onBulkConvert?: (findings: DiagnosticDetailFinding[]) => Promise<void>;
}

// ============================================================================
// Severity Colors & Icons
// ============================================================================

const severityConfig: Record<string, { bg: string; text: string; icon: string }> = {
  critical: { bg: 'bg-red-500/20', text: 'text-red-400', icon: '!' },
  high: { bg: 'bg-orange-500/20', text: 'text-orange-400', icon: '!' },
  medium: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: '~' },
  low: { bg: 'bg-slate-500/20', text: 'text-slate-400', icon: '-' },
};

function SeverityBadge({ severity }: { severity?: string }) {
  const config = severityConfig[severity || 'medium'] || severityConfig.medium;
  return (
    <span
      className={`
        inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold
        ${config.bg} ${config.text}
      `}
      title={severity || 'Medium'}
    >
      {config.icon}
    </span>
  );
}

// ============================================================================
// Lab Badge
// ============================================================================

function LabBadge({ lab }: { lab?: string }) {
  if (!lab) return <span className="text-slate-500">-</span>;

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-cyan-500/10 text-cyan-400 capitalize">
      {lab}
    </span>
  );
}

// ============================================================================
// Work Item Status
// ============================================================================

function WorkItemStatus({ finding, companyId }: { finding: DiagnosticDetailFinding; companyId: string }) {
  if (finding.isConvertedToWorkItem && finding.workItemId) {
    return (
      <Link
        href={`/c/${companyId}/work`}
        className="text-emerald-400 hover:text-emerald-300 text-sm"
        onClick={(e) => e.stopPropagation()}
      >
        Work Item
      </Link>
    );
  }

  return (
    <span className="text-slate-500 text-sm">Not created</span>
  );
}

// ============================================================================
// Empty State
// ============================================================================

function EmptyState() {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-12 text-center">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center">
        <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      </div>
      <h3 className="text-lg font-medium text-white mb-2">No findings yet</h3>
      <p className="text-slate-400 text-sm max-w-md mx-auto">
        Run diagnostic Labs to discover issues and opportunities for this company.
        Findings will appear here as Labs complete.
      </p>
    </div>
  );
}

// ============================================================================
// Loading State
// ============================================================================

function LoadingState() {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
      <div className="animate-pulse">
        {/* Header */}
        <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-slate-800/50 border-b border-slate-800">
          <div className="col-span-1 h-4 bg-slate-700 rounded" />
          <div className="col-span-1 h-4 bg-slate-700 rounded" />
          <div className="col-span-2 h-4 bg-slate-700 rounded" />
          <div className="col-span-2 h-4 bg-slate-700 rounded" />
          <div className="col-span-4 h-4 bg-slate-700 rounded" />
          <div className="col-span-2 h-4 bg-slate-700 rounded" />
        </div>
        {/* Rows */}
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="grid grid-cols-12 gap-4 px-4 py-4 border-b border-slate-800/50">
            <div className="col-span-1 h-6 bg-slate-800 rounded" />
            <div className="col-span-1 h-5 bg-slate-800 rounded" />
            <div className="col-span-2 h-4 bg-slate-800 rounded" />
            <div className="col-span-2 h-4 bg-slate-800 rounded" />
            <div className="col-span-4 h-4 bg-slate-800 rounded" />
            <div className="col-span-2 h-4 bg-slate-800 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function FindingsTable({
  findings,
  loading,
  onSelectFinding,
  selectedFindingId,
  companyId,
  onBulkConvert,
}: FindingsTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isConverting, setIsConverting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Get unconverted findings for selection
  const unconvertedFindings = findings.filter(f => !f.isConvertedToWorkItem);

  const toggleSelect = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === unconvertedFindings.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(unconvertedFindings.map(f => f.id!)));
    }
  }, [selectedIds.size, unconvertedFindings]);

  const handleBulkConvert = useCallback(async () => {
    if (selectedIds.size === 0 || !onBulkConvert) return;

    setIsConverting(true);
    try {
      const selectedFindings = findings.filter(f => selectedIds.has(f.id!));
      await onBulkConvert(selectedFindings);
      setSelectedIds(new Set());
      setToast({ message: `Created ${selectedFindings.length} work items`, type: 'success' });
      setTimeout(() => setToast(null), 4000);
    } catch (err) {
      setToast({ message: 'Failed to create work items', type: 'error' });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setIsConverting(false);
    }
  }, [selectedIds, findings, onBulkConvert]);

  if (loading) {
    return <LoadingState />;
  }

  if (findings.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-3">
      {/* Bulk Actions Bar */}
      {unconvertedFindings.length > 0 && onBulkConvert && (
        <div className="flex items-center justify-between px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedIds.size === unconvertedFindings.length && unconvertedFindings.length > 0}
              onChange={toggleSelectAll}
              className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500/30"
            />
            <span className="text-sm text-slate-400">
              {selectedIds.size > 0
                ? `${selectedIds.size} selected`
                : `Select all (${unconvertedFindings.length} unconverted)`}
            </span>
          </label>

          {selectedIds.size > 0 && (
            <button
              onClick={handleBulkConvert}
              disabled={isConverting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 disabled:opacity-50 transition-colors"
            >
              {isConverting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ClipboardList className="w-3.5 h-3.5" />
              )}
              Add to Work
            </button>
          )}
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-slate-800/50 border-b border-slate-800 text-xs font-medium text-slate-400 uppercase tracking-wide">
          <div className="col-span-1"></div>
          <div className="col-span-1">Sev</div>
          <div className="col-span-1">Lab</div>
          <div className="col-span-2">Category</div>
          <div className="col-span-1">Location</div>
          <div className="col-span-4">Description</div>
          <div className="col-span-2">Work Item</div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-slate-800/50">
          {findings.map(finding => {
            const isSelected = selectedIds.has(finding.id!);
            const isUnconverted = !finding.isConvertedToWorkItem;

            return (
              <div
                key={finding.id}
                onClick={() => onSelectFinding(finding)}
                className={`
                  w-full grid grid-cols-12 gap-4 px-4 py-3 text-left transition-colors cursor-pointer
                  ${selectedFindingId === finding.id
                    ? 'bg-cyan-500/10'
                    : isSelected
                    ? 'bg-amber-500/10'
                    : 'hover:bg-slate-800/50'
                  }
                `}
              >
                {/* Checkbox */}
                <div className="col-span-1 flex items-center">
                  {isUnconverted && onBulkConvert ? (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      onClick={(e) => toggleSelect(finding.id!, e)}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500/30"
                    />
                  ) : (
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                  )}
                </div>

                {/* Severity */}
                <div className="col-span-1 flex items-center">
                  <SeverityBadge severity={finding.severity} />
                </div>

                {/* Lab */}
                <div className="col-span-1 flex items-center">
                  <LabBadge lab={finding.labSlug} />
                </div>

                {/* Category / Dimension */}
                <div className="col-span-2 flex flex-col justify-center min-w-0">
                  <span className="text-sm text-white truncate">{finding.category || '-'}</span>
                  {finding.dimension && finding.dimension !== finding.category && (
                    <span className="text-xs text-slate-500 truncate">{finding.dimension}</span>
                  )}
                </div>

                {/* Location */}
                <div className="col-span-1 flex items-center min-w-0">
                  {finding.location ? (
                    <span className="text-sm text-slate-400 truncate" title={finding.location}>
                      {finding.location}
                    </span>
                  ) : (
                    <span className="text-slate-600">-</span>
                  )}
                </div>

                {/* Description */}
                <div className="col-span-4 flex items-center min-w-0">
                  <span className="text-sm text-slate-300 truncate" title={finding.description}>
                    {finding.description || '-'}
                  </span>
                </div>

                {/* Work Item */}
                <div className="col-span-2 flex items-center">
                  <WorkItemStatus finding={finding} companyId={companyId} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 ${
          toast.type === 'success' ? 'bg-emerald-500/90 text-white' : 'bg-red-500/90 text-white'
        }`}>
          <CheckCircle className="w-4 h-4" />
          <span className="text-sm">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
