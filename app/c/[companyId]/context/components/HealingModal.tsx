'use client';

// app/c/[companyId]/context/components/HealingModal.tsx
// AI Auto-Healing Modal Component
//
// Shows AI-generated fixes for context graph issues.
// Allows accepting all, rejecting all, or individual fixes.

import { useState, useCallback } from 'react';
import type { HealingFix, HealingReport } from '@/lib/contextGraph/inference/aiHeal';

// ============================================================================
// Types
// ============================================================================

interface HealingModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  report: HealingReport | null;
  isLoading?: boolean;
  onAcceptFix: (fix: HealingFix) => Promise<void>;
  onRejectFix: (fix: HealingFix) => Promise<void>;
  onAcceptAll: () => Promise<void>;
  onRejectAll: () => Promise<void>;
  onRefresh: () => Promise<void>;
}

// ============================================================================
// Utility Functions
// ============================================================================

function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '(empty)';
  if (typeof value === 'string') {
    return value.length > 80 ? value.slice(0, 80) + '...' : value;
  }
  if (typeof value === 'object') {
    const str = JSON.stringify(value);
    return str.length > 80 ? str.slice(0, 80) + '...' : str;
  }
  return String(value);
}

function getPriorityStyles(priority: HealingFix['priority']): { bg: string; border: string; text: string } {
  switch (priority) {
    case 'critical':
      return { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-300' };
    case 'high':
      return { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-300' };
    case 'medium':
      return { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-300' };
    default:
      return { bg: 'bg-slate-500/10', border: 'border-slate-500/30', text: 'text-slate-300' };
  }
}

function getIssueTypeLabel(type: HealingFix['issueType']): string {
  switch (type) {
    case 'missing_required': return 'Missing Required';
    case 'stale': return 'Stale Data';
    case 'contradiction': return 'Contradiction';
    case 'incomplete': return 'Incomplete';
    default: return 'Issue';
  }
}

// ============================================================================
// Main Component
// ============================================================================

export function HealingModal({
  isOpen,
  onClose,
  companyId,
  report,
  isLoading = false,
  onAcceptFix,
  onRejectFix,
  onAcceptAll,
  onRejectAll,
  onRefresh,
}: HealingModalProps) {
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isProcessingAll, setIsProcessingAll] = useState(false);

  const handleAcceptFix = useCallback(async (fix: HealingFix) => {
    setProcessingIds(prev => new Set([...prev, fix.id]));
    try {
      await onAcceptFix(fix);
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(fix.id);
        return next;
      });
    }
  }, [onAcceptFix]);

  const handleRejectFix = useCallback(async (fix: HealingFix) => {
    setProcessingIds(prev => new Set([...prev, fix.id]));
    try {
      await onRejectFix(fix);
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(fix.id);
        return next;
      });
    }
  }, [onRejectFix]);

  const handleAcceptAll = useCallback(async () => {
    setIsProcessingAll(true);
    try {
      await onAcceptAll();
    } finally {
      setIsProcessingAll(false);
    }
  }, [onAcceptAll]);

  const handleRejectAll = useCallback(async () => {
    setIsProcessingAll(true);
    try {
      await onRejectAll();
    } finally {
      setIsProcessingAll(false);
    }
  }, [onRejectAll]);

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

  const selectAll = () => {
    if (report?.fixes) {
      setSelectedIds(new Set(report.fixes.map(f => f.id)));
    }
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[85vh] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100">Auto-Heal Context Graph</h2>
              <p className="text-xs text-slate-500">
                AI-generated fixes for detected issues
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Summary Stats */}
        {report && (
          <div className="px-5 py-3 border-b border-slate-800 flex items-center gap-6 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Issues:</span>
              <span className="font-medium text-slate-200">{report.analyzedIssues}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Fixes:</span>
              <span className="font-medium text-emerald-400">{report.fixes.length}</span>
            </div>
            {report.criticalCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-red-400">Critical:</span>
                <span className="font-medium text-red-300">{report.criticalCount}</span>
              </div>
            )}
            {report.highCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-amber-400">High:</span>
                <span className="font-medium text-amber-300">{report.highCount}</span>
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Loading State */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-10 h-10 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin mb-4" />
              <p className="text-sm text-slate-400">Analyzing context graph...</p>
              <p className="text-xs text-slate-500 mt-1">This may take a moment</p>
            </div>
          )}

          {/* No Fixes State */}
          {!isLoading && report && report.fixes.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12">
              <svg className="w-12 h-12 text-emerald-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-slate-300">No auto-fixes available</p>
              <p className="text-xs text-slate-500 mt-1">
                {report.analyzedIssues > 0
                  ? 'Issues found but require manual intervention'
                  : 'Your context graph is healthy'}
              </p>
            </div>
          )}

          {/* Fixes List */}
          {!isLoading && report && report.fixes.length > 0 && (
            <div className="space-y-3">
              {/* Select All / Deselect All */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <button
                    onClick={selectAll}
                    className="text-[11px] text-amber-400 hover:text-amber-300"
                  >
                    Select All
                  </button>
                  <button
                    onClick={deselectAll}
                    className="text-[11px] text-slate-500 hover:text-slate-300"
                  >
                    Deselect All
                  </button>
                </div>
                <span className="text-[11px] text-slate-500">
                  {selectedIds.size} of {report.fixes.length} selected
                </span>
              </div>

              {report.fixes.map((fix) => {
                const isProcessing = processingIds.has(fix.id);
                const isSelected = selectedIds.has(fix.id);
                const styles = getPriorityStyles(fix.priority);

                return (
                  <div
                    key={fix.id}
                    className={cn(
                      'rounded-lg border overflow-hidden transition-all',
                      isSelected ? 'border-amber-500/50 ring-1 ring-amber-500/20' : 'border-slate-800',
                      isProcessing && 'opacity-60'
                    )}
                  >
                    {/* Fix Header */}
                    <div className="px-4 py-3 bg-slate-900/80 flex items-start gap-3">
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(fix.id)}
                        disabled={isProcessing}
                        className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500/30"
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-slate-100">
                            {fix.fieldLabel}
                          </span>
                          <span className={cn(
                            'rounded-full px-1.5 py-0.5 text-[9px] font-medium border',
                            styles.bg, styles.border, styles.text
                          )}>
                            {fix.priority}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {getIssueTypeLabel(fix.issueType)}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                          {fix.path}
                        </p>
                      </div>

                      {/* Confidence */}
                      <div className="text-right">
                        <span className={cn(
                          'text-xs font-medium',
                          fix.confidence >= 0.8 ? 'text-emerald-400' :
                          fix.confidence >= 0.6 ? 'text-amber-400' : 'text-red-400'
                        )}>
                          {Math.round(fix.confidence * 100)}%
                        </span>
                        <p className="text-[10px] text-slate-500">confidence</p>
                      </div>
                    </div>

                    {/* Fix Details */}
                    <div className="px-4 py-3 space-y-3">
                      {/* Value Change */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Current</div>
                          <div className="rounded-md bg-red-500/10 border border-red-500/20 px-2 py-1 text-[11px] text-red-300 font-mono">
                            {formatValue(fix.oldValue)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Proposed</div>
                          <div className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 text-[11px] text-emerald-300 font-mono">
                            {formatValue(fix.newValue)}
                          </div>
                        </div>
                      </div>

                      {/* Reasoning */}
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Why</div>
                        <p className="text-xs text-slate-300">{fix.reasoning}</p>
                      </div>

                      {/* Original Issue */}
                      {fix.originalIssue && (
                        <div className="text-[11px] text-slate-500">
                          Issue: {fix.originalIssue}
                        </div>
                      )}

                      {/* Individual Actions */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => handleAcceptFix(fix)}
                          disabled={isProcessing || isProcessingAll}
                          className={cn(
                            'px-3 py-1 rounded-md text-[11px] font-medium transition-colors',
                            'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30',
                            'disabled:opacity-50 disabled:cursor-not-allowed'
                          )}
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleRejectFix(fix)}
                          disabled={isProcessing || isProcessingAll}
                          className={cn(
                            'px-3 py-1 rounded-md text-[11px] font-medium transition-colors',
                            'bg-slate-700 text-slate-300 hover:bg-slate-600',
                            'disabled:opacity-50 disabled:cursor-not-allowed'
                          )}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {report && report.fixes.length > 0 && (
          <div className="flex items-center justify-between p-4 border-t border-slate-800">
            <button
              onClick={onRefresh}
              disabled={isLoading || isProcessingAll}
              className={cn(
                'px-3 py-2 rounded-md text-xs font-medium transition-colors',
                'text-slate-400 hover:text-slate-200 hover:bg-slate-800',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              Refresh Analysis
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={handleRejectAll}
                disabled={isProcessingAll || report.fixes.length === 0}
                className={cn(
                  'px-4 py-2 rounded-md text-xs font-medium transition-colors',
                  'border border-slate-700 text-slate-300 hover:bg-slate-800',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                Reject All
              </button>
              <button
                onClick={handleAcceptAll}
                disabled={isProcessingAll || report.fixes.length === 0}
                className={cn(
                  'px-4 py-2 rounded-md text-xs font-medium transition-colors',
                  'bg-amber-500 hover:bg-amber-400 text-slate-900',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {isProcessingAll ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full border-2 border-slate-900/30 border-t-slate-900 animate-spin" />
                    Applying...
                  </span>
                ) : (
                  `Accept All (${report.fixes.length})`
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default HealingModal;
