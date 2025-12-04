'use client';

// app/c/[companyId]/context/components/AIConsistencyPanel.tsx
// AI Consistency Check Panel Component
//
// Runs AI-powered consistency checks on the context graph:
// - Detects contradictions between fields
// - Flags incomplete or inconsistent data
// - Suggests fixes

import { useState } from 'react';

// ============================================================================
// Types
// ============================================================================

interface ConsistencyIssue {
  type: 'contradiction' | 'incomplete' | 'inconsistent' | 'suggestion';
  severity: 'high' | 'medium' | 'low';
  fields: string[];
  description: string;
  suggestion?: string;
}

interface ConsistencyResult {
  overallScore: number;
  status: 'consistent' | 'minor_issues' | 'needs_review' | 'critical';
  issues: ConsistencyIssue[];
  summary: string;
}

interface AIConsistencyPanelProps {
  companyId: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'high': return 'text-red-300';
    case 'medium': return 'text-amber-300';
    case 'low': return 'text-blue-300';
    default: return 'text-slate-300';
  }
}

function getSeverityBg(severity: string): string {
  switch (severity) {
    case 'high': return 'bg-red-500/20 border-red-500/30';
    case 'medium': return 'bg-amber-500/20 border-amber-500/30';
    case 'low': return 'bg-blue-500/20 border-blue-500/30';
    default: return 'bg-slate-800 border-slate-700';
  }
}

function getTypeIcon(type: string): string {
  switch (type) {
    case 'contradiction': return '⚠️';
    case 'incomplete': return '📝';
    case 'inconsistent': return '🔄';
    case 'suggestion': return '💡';
    default: return '❓';
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'consistent': return 'text-emerald-400';
    case 'minor_issues': return 'text-blue-400';
    case 'needs_review': return 'text-amber-400';
    case 'critical': return 'text-red-400';
    default: return 'text-slate-400';
  }
}

// ============================================================================
// Main Component
// ============================================================================

export function AIConsistencyPanel({ companyId }: AIConsistencyPanelProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<ConsistencyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedIssue, setExpandedIssue] = useState<number | null>(null);

  const handleRunCheck = async () => {
    setIsRunning(true);
    setError(null);

    try {
      const response = await fetch(`/api/os/companies/${companyId}/context-consistency`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to run consistency check');
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">AI Consistency Check</h3>
            <p className="text-[11px] text-slate-500">Detect contradictions and gaps</p>
          </div>
        </div>

        <button
          onClick={handleRunCheck}
          disabled={isRunning}
          className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
            isRunning
              ? 'bg-slate-800 text-slate-400 cursor-not-allowed'
              : 'bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30'
          )}
        >
          {isRunning ? (
            <span className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full border-2 border-purple-400/30 border-t-purple-400 animate-spin" />
              Analyzing...
            </span>
          ) : (
            'Run Check'
          )}
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-4 text-center">
          <p className="text-sm text-red-300">{error}</p>
          <button
            onClick={handleRunCheck}
            className="mt-2 text-xs text-red-400 hover:text-red-300 underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* No Result Yet */}
      {!result && !error && !isRunning && (
        <div className="rounded-lg border border-dashed border-slate-800 bg-slate-950/60 p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <p className="text-sm text-slate-400">Run an AI consistency check</p>
          <p className="text-xs text-slate-500 mt-1">
            Detect contradictions and inconsistencies in your context graph.
          </p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Score Summary */}
          <div className="flex items-center gap-4 p-4 rounded-lg bg-slate-950/60">
            <div className={cn(
              'w-14 h-14 rounded-lg flex items-center justify-center text-xl font-bold',
              result.overallScore >= 80 && 'bg-emerald-500/20 text-emerald-400',
              result.overallScore >= 60 && result.overallScore < 80 && 'bg-amber-500/20 text-amber-400',
              result.overallScore < 60 && 'bg-red-500/20 text-red-400'
            )}>
              {result.overallScore}
            </div>
            <div className="flex-1">
              <div className={cn('text-sm font-medium capitalize', getStatusColor(result.status))}>
                {result.status.replace(/_/g, ' ')}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{result.summary}</p>
            </div>
          </div>

          {/* Issues List */}
          {result.issues.length > 0 ? (
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-wide text-slate-500">
                Issues Found ({result.issues.length})
              </div>
              {result.issues.map((issue, index) => (
                <div
                  key={index}
                  className={cn(
                    'rounded-lg border p-3 cursor-pointer transition-colors',
                    getSeverityBg(issue.severity),
                    expandedIssue === index && 'ring-1 ring-slate-600'
                  )}
                  onClick={() => setExpandedIssue(expandedIssue === index ? null : index)}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-sm">{getTypeIcon(issue.type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn('text-xs font-medium', getSeverityColor(issue.severity))}>
                          {issue.type.charAt(0).toUpperCase() + issue.type.slice(1)}
                        </span>
                        <span className="text-[10px] text-slate-500 uppercase">
                          {issue.severity}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1">{issue.description}</p>

                      {/* Expanded Details */}
                      {expandedIssue === index && (
                        <div className="mt-3 pt-3 border-t border-slate-700 space-y-2">
                          {/* Affected Fields */}
                          <div>
                            <span className="text-[10px] uppercase tracking-wide text-slate-500">
                              Affected Fields
                            </span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {issue.fields.map((field) => (
                                <span
                                  key={field}
                                  className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400 font-mono"
                                >
                                  {field}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Suggestion */}
                          {issue.suggestion && (
                            <div>
                              <span className="text-[10px] uppercase tracking-wide text-slate-500">
                                Suggestion
                              </span>
                              <p className="text-xs text-slate-400 mt-1">{issue.suggestion}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium text-emerald-300">All Clear</div>
                <p className="text-xs text-slate-400">No consistency issues detected.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AIConsistencyPanel;
