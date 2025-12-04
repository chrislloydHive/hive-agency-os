'use client';

// app/c/[companyId]/context/components/ValidationPanel.tsx
// Validation Panel Component
//
// Displays validation rule results including contradictions,
// missing dependencies, and logical issues.

import { useState, useEffect } from 'react';
import type { ValidationIssue } from '@/lib/contextGraph/governance/rules';

// ============================================================================
// Types
// ============================================================================

interface ValidationPanelProps {
  companyId: string;
  issues?: ValidationIssue[];
  onNavigateToField?: (path: string) => void;
  onSuggestFix?: (issue: ValidationIssue) => void;
}

// ============================================================================
// Utility Functions
// ============================================================================

function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

function getCategoryIcon(category: ValidationIssue['category']): React.ReactNode {
  switch (category) {
    case 'contradiction':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    case 'missing_dependency':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      );
    case 'stale_data':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'logical_issue':
    default:
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
  }
}

function getSeverityStyles(severity: 'error' | 'warning' | 'info'): { bg: string; border: string; text: string; icon: string } {
  switch (severity) {
    case 'error':
      return {
        bg: 'bg-red-500/10',
        border: 'border-red-500/30',
        text: 'text-red-300',
        icon: 'text-red-400',
      };
    case 'warning':
      return {
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/30',
        text: 'text-amber-300',
        icon: 'text-amber-400',
      };
    default:
      return {
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/30',
        text: 'text-blue-300',
        icon: 'text-blue-400',
      };
  }
}

function getCategoryLabel(category: ValidationIssue['category']): string {
  switch (category) {
    case 'contradiction': return 'Contradiction';
    case 'missing_dependency': return 'Missing Dependency';
    case 'stale_data': return 'Stale Data';
    case 'logical_issue': return 'Logical Issue';
    default: return 'Issue';
  }
}

// ============================================================================
// Main Component
// ============================================================================

export function ValidationPanel({
  companyId,
  issues = [],
  onNavigateToField,
  onSuggestFix,
}: ValidationPanelProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'error' | 'warning'>('all');

  const filteredIssues = issues.filter(issue => {
    if (filter === 'all') return true;
    return issue.severity === filter;
  });

  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;

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

  return (
    <div className="space-y-4">
      {/* Header with Summary */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-slate-100">Validation Rules</h3>
          <div className="flex items-center gap-3 mt-1">
            {errorCount > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-red-400">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                {errorCount} error{errorCount !== 1 ? 's' : ''}
              </span>
            )}
            {warningCount > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                {warningCount} warning{warningCount !== 1 ? 's' : ''}
              </span>
            )}
            {errorCount === 0 && warningCount === 0 && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                All checks passed
              </span>
            )}
          </div>
        </div>

        {/* Filter Tabs */}
        {issues.length > 0 && (
          <div className="flex items-center gap-1 bg-slate-800 rounded-md p-0.5">
            {(['all', 'error', 'warning'] as const).map((f) => (
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
        )}
      </div>

      {/* Empty State */}
      {issues.length === 0 && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
          <svg className="w-8 h-8 mx-auto text-emerald-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-emerald-300">No validation issues found</p>
          <p className="text-xs text-emerald-400/70 mt-1">Your context graph is consistent</p>
        </div>
      )}

      {/* Issue List */}
      <div className="space-y-2">
        {filteredIssues.map((issue) => {
          const isExpanded = expandedIds.has(issue.id);
          const styles = getSeverityStyles(issue.severity);

          return (
            <div
              key={issue.id}
              className={cn(
                'rounded-lg border overflow-hidden',
                styles.bg,
                styles.border
              )}
            >
              {/* Issue Header */}
              <button
                onClick={() => toggleExpand(issue.id)}
                className="w-full px-3 py-2.5 flex items-start gap-2 text-left hover:bg-white/5 transition-colors"
              >
                <span className={cn('mt-0.5 flex-shrink-0', styles.icon)}>
                  {getCategoryIcon(issue.category)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn('text-xs font-medium', styles.text)}>
                      {getCategoryLabel(issue.category)}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {issue.path}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5 line-clamp-2">
                    {issue.issue}
                  </p>
                </div>
                <svg
                  className={cn(
                    'w-4 h-4 text-slate-500 transition-transform flex-shrink-0',
                    isExpanded && 'rotate-180'
                  )}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="px-3 pb-3 border-t border-slate-800/50">
                  {/* Related Fields */}
                  {issue.relatedPaths && issue.relatedPaths.length > 0 && (
                    <div className="pt-3">
                      <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">
                        Related Fields
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {issue.relatedPaths.map((p) => (
                          <button
                            key={p}
                            onClick={() => onNavigateToField?.(p)}
                            className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suggested Fix */}
                  {issue.suggestedFix && (
                    <div className="pt-3">
                      <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">
                        Suggested Fix
                      </div>
                      <p className="text-xs text-slate-300">{issue.suggestedFix}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-3">
                    <button
                      onClick={() => onNavigateToField?.(issue.path)}
                      className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors border border-slate-700 text-slate-300 hover:bg-slate-800"
                    >
                      View Field
                    </button>
                    {issue.autoFixable && onSuggestFix && (
                      <button
                        onClick={() => onSuggestFix(issue)}
                        className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:bg-amber-500/30"
                      >
                        Auto-Fix
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ValidationPanel;
