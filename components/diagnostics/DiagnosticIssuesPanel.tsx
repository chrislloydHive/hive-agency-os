'use client';

// components/diagnostics/DiagnosticIssuesPanel.tsx
// Standardized panel for displaying diagnostic issues with actions
//
// Features:
// - Selectable issues with checkboxes
// - Severity badges
// - Domain/category tags
// - Bulk actions: Add to Plan, Create Work Items

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  CheckCircle,
  Loader2,
  Plus,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface DiagnosticIssue {
  id: string;
  title: string;
  description?: string;
  severity: IssueSeverity;
  domain?: string;
  category?: string;
  recommendedAction?: string;
}

interface DiagnosticIssuesPanelProps {
  companyId: string;
  labSlug: string;
  runId: string;
  issues: DiagnosticIssue[];
  title?: string;
  showSelectAll?: boolean;
}

// ============================================================================
// Severity Configuration
// ============================================================================

const severityConfig: Record<IssueSeverity, {
  label: string;
  icon: typeof AlertTriangle;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  critical: {
    label: 'Critical',
    icon: AlertTriangle,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
  },
  high: {
    label: 'High',
    icon: AlertTriangle,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
  },
  medium: {
    label: 'Medium',
    icon: AlertCircle,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
  },
  low: {
    label: 'Low',
    icon: Info,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
  },
  info: {
    label: 'Info',
    icon: Info,
    color: 'text-slate-400',
    bgColor: 'bg-slate-500/10',
    borderColor: 'border-slate-500/30',
  },
};

// ============================================================================
// Component
// ============================================================================

export function DiagnosticIssuesPanel({
  companyId,
  labSlug,
  runId,
  issues,
  title = 'Issues & Findings',
  showSelectAll = true,
}: DiagnosticIssuesPanelProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isAddingToPlan, setIsAddingToPlan] = useState(false);
  const [isCreatingWork, setIsCreatingWork] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Sort issues by severity
  const sortedIssues = useMemo(() => {
    const severityOrder: Record<IssueSeverity, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
      info: 4,
    };
    return [...issues].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  }, [issues]);

  // Group issues by severity for summary
  const issueCounts = useMemo(() => {
    const counts: Record<IssueSeverity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };
    issues.forEach(issue => {
      counts[issue.severity]++;
    });
    return counts;
  }, [issues]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === issues.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(issues.map(i => i.id)));
    }
  };

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

  const handleAddToPlan = async () => {
    if (selectedIds.size === 0) return;
    setIsAddingToPlan(true);

    try {
      const selectedIssues = issues.filter(i => selectedIds.has(i.id));
      const response = await fetch(`/api/os/companies/${companyId}/findings/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          findings: selectedIssues.map(issue => ({
            title: issue.title,
            description: issue.description || '',
            severity: issue.severity,
            domain: issue.domain || issue.category || labSlug,
            sourceLabSlug: labSlug,
            sourceRunId: runId,
            recommendedAction: issue.recommendedAction || '',
          })),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add to plan');
      }

      const data = await response.json();
      showToast(`Added ${data.created || selectedIds.size} findings to Plan`, 'success');
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Failed to add to plan:', error);
      showToast(error instanceof Error ? error.message : 'Failed to add to plan', 'error');
    } finally {
      setIsAddingToPlan(false);
    }
  };

  const handleCreateWork = async () => {
    if (selectedIds.size === 0) return;
    setIsCreatingWork(true);

    try {
      const selectedIssues = issues.filter(i => selectedIds.has(i.id));
      const response = await fetch(`/api/os/companies/${companyId}/work/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: selectedIssues.map(issue => ({
            title: issue.title,
            description: issue.recommendedAction || issue.description || '',
            priority: issue.severity === 'critical' || issue.severity === 'high' ? 'P1' :
                     issue.severity === 'medium' ? 'P2' : 'P3',
            domain: issue.domain || issue.category || labSlug,
            sourceLabSlug: labSlug,
            sourceRunId: runId,
          })),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create work items');
      }

      const data = await response.json();
      showToast(`Created ${data.created || selectedIds.size} work items`, 'success');
      setSelectedIds(new Set());

      // Navigate to work page after brief delay
      setTimeout(() => {
        router.push(`/c/${companyId}/work`);
      }, 1500);
    } catch (error) {
      console.error('Failed to create work items:', error);
      showToast(error instanceof Error ? error.message : 'Failed to create work', 'error');
    } finally {
      setIsCreatingWork(false);
    }
  };

  if (issues.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <div className="flex items-center gap-3 text-slate-400">
          <CheckCircle className="w-5 h-5 text-emerald-400" />
          <span>No issues found in this diagnostic run.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
          {/* Severity summary badges */}
          <div className="flex items-center gap-2">
            {issueCounts.critical > 0 && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-300">
                {issueCounts.critical} Critical
              </span>
            )}
            {issueCounts.high > 0 && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-500/20 text-orange-300">
                {issueCounts.high} High
              </span>
            )}
            {issueCounts.medium > 0 && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-500/20 text-amber-300">
                {issueCounts.medium} Medium
              </span>
            )}
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">{selectedIds.size} selected</span>
            <button
              onClick={handleAddToPlan}
              disabled={isAddingToPlan}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 disabled:opacity-50 transition-colors"
            >
              {isAddingToPlan ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              Add to Plan
            </button>
            <button
              onClick={handleCreateWork}
              disabled={isCreatingWork}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 disabled:opacity-50 transition-colors"
            >
              {isCreatingWork ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ClipboardList className="w-3.5 h-3.5" />
              )}
              Create Work
            </button>
          </div>
        )}
      </div>

      {/* Select All */}
      {showSelectAll && issues.length > 1 && (
        <div className="px-5 py-2 border-b border-slate-800/50 bg-slate-800/30">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedIds.size === issues.length}
              onChange={toggleSelectAll}
              className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500/30"
            />
            <span className="text-xs text-slate-400">
              {selectedIds.size === issues.length ? 'Deselect all' : 'Select all'}
            </span>
          </label>
        </div>
      )}

      {/* Issues List */}
      <div className="divide-y divide-slate-800/50">
        {sortedIssues.map((issue) => {
          const config = severityConfig[issue.severity];
          const SeverityIcon = config.icon;
          const isExpanded = expandedIds.has(issue.id);
          const hasDetails = issue.description || issue.recommendedAction;

          return (
            <div
              key={issue.id}
              className={`px-5 py-3 transition-colors ${selectedIds.has(issue.id) ? 'bg-slate-800/40' : 'hover:bg-slate-800/20'}`}
            >
              <div className="flex items-start gap-3">
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={selectedIds.has(issue.id)}
                  onChange={() => toggleSelect(issue.id)}
                  className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500/30"
                />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${config.bgColor} ${config.color} ${config.borderColor} border`}>
                        <SeverityIcon className="w-3 h-3" />
                        {config.label}
                      </span>
                      {issue.domain && (
                        <span className="px-2 py-0.5 rounded text-xs bg-slate-700 text-slate-300">
                          {issue.domain}
                        </span>
                      )}
                    </div>
                    {hasDetails && (
                      <button
                        onClick={() => toggleExpand(issue.id)}
                        className="flex-shrink-0 p-1 rounded hover:bg-slate-700 text-slate-400 transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-200">{issue.title}</p>

                  {/* Expanded details */}
                  {isExpanded && hasDetails && (
                    <div className="mt-3 space-y-2">
                      {issue.description && (
                        <p className="text-xs text-slate-400">{issue.description}</p>
                      )}
                      {issue.recommendedAction && (
                        <div className="flex items-start gap-2 text-xs">
                          <span className="text-slate-500">Recommended:</span>
                          <span className="text-emerald-400">{issue.recommendedAction}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 ${
          toast.type === 'success' ? 'bg-emerald-500/90 text-white' : 'bg-red-500/90 text-white'
        }`}>
          {toast.type === 'success' ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          <span className="text-sm">{toast.message}</span>
        </div>
      )}
    </div>
  );
}

export default DiagnosticIssuesPanel;
