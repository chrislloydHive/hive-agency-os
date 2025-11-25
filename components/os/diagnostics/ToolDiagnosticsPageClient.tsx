'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { DiagnosticToolId, DiagnosticRun } from '@/lib/os/diagnostics/runs';
import type { DiagnosticToolConfig } from '@/lib/os/diagnostics/tools';
import type { DiagnosticInsights, DiagnosticInsightsResponse, SuggestedWorkItem } from '@/lib/os/diagnostics/aiInsights';

// ============================================================================
// Types
// ============================================================================

export interface ToolDiagnosticsPageClientProps {
  companyId: string;
  companyName: string;
  tool: DiagnosticToolConfig;
  latestRun: DiagnosticRun | null;
  /** Optional: Custom content to render for tool-specific data */
  children?: React.ReactNode;
}

// ============================================================================
// Component
// ============================================================================

export function ToolDiagnosticsPageClient({
  companyId,
  companyName,
  tool,
  latestRun,
  children,
}: ToolDiagnosticsPageClientProps) {
  const router = useRouter();

  // State
  const [isRunning, setIsRunning] = useState(false);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [insights, setInsights] = useState<DiagnosticInsights | null>(null);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [creatingWorkItems, setCreatingWorkItems] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Toast helper
  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  }, []);

  // Fetch AI insights when we have a complete run
  useEffect(() => {
    if (latestRun?.status === 'complete' && !insights && !isLoadingInsights) {
      fetchInsights();
    }
  }, [latestRun?.status]);

  const fetchInsights = async () => {
    if (!latestRun) return;

    setIsLoadingInsights(true);
    setInsightsError(null);

    try {
      const response = await fetch(`/api/os/diagnostics/ai-insights/${tool.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, runId: latestRun.id }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch insights');
      }

      const data: DiagnosticInsightsResponse = await response.json();
      setInsights(data.insights);
    } catch (error) {
      console.error('Error fetching insights:', error);
      setInsightsError(error instanceof Error ? error.message : 'Failed to load insights');
    } finally {
      setIsLoadingInsights(false);
    }
  };

  const runDiagnostic = async () => {
    if (isRunning) return;

    setIsRunning(true);
    showToast(`Starting ${tool.label}...`, 'success');

    try {
      const response = await fetch(tool.runApiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to run diagnostic');
      }

      showToast(`${tool.label} completed! Refreshing...`, 'success');

      // Reset insights to trigger re-fetch
      setInsights(null);

      // Refresh page
      setTimeout(() => {
        router.refresh();
      }, 1000);
    } catch (error) {
      console.error('Error running diagnostic:', error);
      showToast(error instanceof Error ? error.message : 'Failed to run diagnostic', 'error');
    } finally {
      setIsRunning(false);
    }
  };

  const createWorkItems = async (items: SuggestedWorkItem[]) => {
    if (creatingWorkItems || items.length === 0) return;

    setCreatingWorkItems(true);
    showToast(`Creating ${items.length} work items...`, 'success');

    try {
      const response = await fetch('/api/os/diagnostics/work-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          toolId: tool.id,
          diagnosticRunId: latestRun?.id,
          suggestedItems: items,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create work items');
      }

      showToast(`Created ${result.created?.length || 0} work items!`, 'success');
    } catch (error) {
      console.error('Error creating work items:', error);
      showToast(error instanceof Error ? error.message : 'Failed to create work items', 'error');
    } finally {
      setCreatingWorkItems(false);
    }
  };

  // Score display
  const score = latestRun?.score;
  const scoreColor =
    score == null
      ? 'text-slate-400'
      : score >= 80
      ? 'text-emerald-400'
      : score >= 60
      ? 'text-amber-400'
      : 'text-red-400';

  const hasRun = latestRun != null;
  const isComplete = latestRun?.status === 'complete';

  return (
    <div className="min-h-screen bg-[#050509]">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 rounded-lg px-4 py-3 shadow-lg ${
            toast.type === 'success'
              ? 'bg-emerald-900/90 border border-emerald-700 text-emerald-100'
              : 'bg-red-900/90 border border-red-700 text-red-100'
          }`}
        >
          <p className="text-sm font-medium">{toast.message}</p>
        </div>
      )}

      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/c/${companyId}/diagnostics`}
                className="text-sm text-slate-400 hover:text-slate-300"
              >
                ← Back to Diagnostics
              </Link>
              <span className="text-slate-600">|</span>
              <span className="text-sm text-slate-500">{companyName}</span>
            </div>
            <span className="text-xs font-medium text-slate-500">{tool.label}</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Tool Header Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-100">{tool.label}</h1>
              <p className="mt-1 text-sm text-slate-400">{tool.description}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Score</p>
              <p className={`text-4xl font-bold tabular-nums ${scoreColor}`}>
                {score ?? '—'}
              </p>
              {latestRun && (
                <p className="text-xs text-slate-500 mt-1">
                  {new Date(latestRun.createdAt).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>

          {/* Run Button */}
          <div className="mt-6 flex gap-3">
            <button
              onClick={runDiagnostic}
              disabled={isRunning}
              className={`rounded-xl px-6 py-3 font-semibold text-sm transition-all ${
                isRunning
                  ? 'bg-emerald-700 text-white cursor-wait'
                  : 'bg-emerald-600 text-white hover:bg-emerald-500'
              }`}
            >
              {isRunning ? (
                <span className="flex items-center gap-2">
                  <Spinner />
                  Running...
                </span>
              ) : hasRun ? (
                `Re-run ${tool.shortLabel || tool.label}`
              ) : (
                tool.primaryActionLabel
              )}
            </button>
            {tool.estimatedTime && (
              <span className="self-center text-xs text-slate-500">
                Est. {tool.estimatedTime}
              </span>
            )}
          </div>
        </div>

        {/* Content Grid */}
        {hasRun && isComplete && (
          <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
            {/* Left Column - Main Content */}
            <div className="space-y-6">
              {/* Summary */}
              {latestRun.summary && (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-3">
                    Summary
                  </h2>
                  <p className="text-slate-200 leading-relaxed">{latestRun.summary}</p>
                </div>
              )}

              {/* Tool-specific content */}
              {children && (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                  {children}
                </div>
              )}

              {/* AI Insights */}
              {isLoadingInsights ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                  <div className="flex items-center gap-3 text-slate-400">
                    <Spinner />
                    <span>Loading AI insights...</span>
                  </div>
                </div>
              ) : insightsError ? (
                <div className="rounded-2xl border border-red-900/50 bg-red-900/20 p-6">
                  <p className="text-sm text-red-400">{insightsError}</p>
                  <button
                    onClick={fetchInsights}
                    className="mt-3 text-sm text-red-300 hover:text-red-200 underline"
                  >
                    Retry
                  </button>
                </div>
              ) : insights ? (
                <InsightsPanel
                  insights={insights}
                  onCreateWorkItems={createWorkItems}
                  creatingWorkItems={creatingWorkItems}
                />
              ) : null}
            </div>

            {/* Right Column - Sidebar */}
            <div className="space-y-6">
              {/* Quick Stats */}
              {insights && (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-4">
                    Quick Stats
                  </h3>
                  <div className="space-y-3">
                    <StatItem label="Strengths" value={insights.strengths.length} color="emerald" />
                    <StatItem label="Issues" value={insights.issues.length} color="red" />
                    <StatItem label="Quick Wins" value={insights.quickWins.length} color="amber" />
                    <StatItem
                      label="Suggested Work Items"
                      value={insights.suggestedWorkItems.length}
                      color="blue"
                    />
                  </div>
                </div>
              )}

              {/* Run History Placeholder */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-4">
                  Run Info
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Status</span>
                    <span className="text-emerald-400">{latestRun.status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Run ID</span>
                    <span className="text-slate-400 font-mono">{latestRun.id.slice(-8)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Created</span>
                    <span className="text-slate-400">
                      {new Date(latestRun.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* No Run State */}
        {!hasRun && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-12 text-center">
            <div className="mb-4">
              <svg
                className="mx-auto h-12 w-12 text-slate-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-slate-200 mb-2">No {tool.label} Run Yet</h2>
            <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto">
              Run your first {tool.label} diagnostic to get insights and recommendations.
            </p>
          </div>
        )}

        {/* Running State */}
        {hasRun && latestRun.status === 'running' && (
          <div className="rounded-2xl border border-amber-900/50 bg-amber-900/20 p-6">
            <div className="flex items-center gap-3">
              <Spinner />
              <span className="text-amber-200">Diagnostic is running...</span>
            </div>
          </div>
        )}

        {/* Failed State */}
        {hasRun && latestRun.status === 'failed' && (
          <div className="rounded-2xl border border-red-900/50 bg-red-900/20 p-6">
            <p className="text-sm text-red-400">
              The last diagnostic run failed. Please try running again.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function StatItem({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: 'emerald' | 'red' | 'amber' | 'blue';
}) {
  const colorClasses = {
    emerald: 'text-emerald-400',
    red: 'text-red-400',
    amber: 'text-amber-400',
    blue: 'text-blue-400',
  };

  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${colorClasses[color]}`}>{value}</span>
    </div>
  );
}

interface InsightsPanelProps {
  insights: DiagnosticInsights;
  onCreateWorkItems: (items: SuggestedWorkItem[]) => void;
  creatingWorkItems: boolean;
}

function InsightsPanel({ insights, onCreateWorkItems, creatingWorkItems }: InsightsPanelProps) {
  return (
    <div className="space-y-6">
      {/* AI Summary */}
      {insights.summary && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-3">
            AI Summary
          </h2>
          <p className="text-slate-200 leading-relaxed">{insights.summary}</p>
        </div>
      )}

      {/* Strengths & Issues */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Strengths */}
        <div className="rounded-2xl border border-emerald-900/50 bg-emerald-900/10 p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-400 mb-3">
            Strengths
          </h3>
          <ul className="space-y-2">
            {insights.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                <span className="text-emerald-400 mt-0.5">✓</span>
                {s}
              </li>
            ))}
          </ul>
        </div>

        {/* Issues */}
        <div className="rounded-2xl border border-red-900/50 bg-red-900/10 p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-red-400 mb-3">
            Issues
          </h3>
          <ul className="space-y-2">
            {insights.issues.map((issue, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                <span className="text-red-400 mt-0.5">!</span>
                {issue}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Quick Wins */}
      {insights.quickWins.length > 0 && (
        <div className="rounded-2xl border border-amber-900/50 bg-amber-900/10 p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-400 mb-3">
            Quick Wins
          </h3>
          <ul className="space-y-2">
            {insights.quickWins.map((win, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                <span className="text-amber-400 mt-0.5">→</span>
                {win}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Experiments */}
      {insights.experiments.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-4">
            Suggested Experiments
          </h3>
          <div className="space-y-4">
            {insights.experiments.map((exp, i) => (
              <div key={i} className="rounded-lg border border-slate-700 bg-[#050509]/50 p-4">
                <h4 className="text-sm font-semibold text-slate-200 mb-2">{exp.name}</h4>
                <p className="text-xs text-slate-400 mb-2">{exp.hypothesis}</p>
                {exp.steps && exp.steps.length > 0 && (
                  <div className="mb-2">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Steps</p>
                    <ol className="list-decimal list-inside space-y-1 text-xs text-slate-400">
                      {exp.steps.map((step, j) => (
                        <li key={j}>{step}</li>
                      ))}
                    </ol>
                  </div>
                )}
                <p className="text-[10px] text-slate-500">
                  Success Metric: <span className="text-slate-400">{exp.successMetric}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggested Work Items */}
      {insights.suggestedWorkItems.length > 0 && (
        <div className="rounded-2xl border border-blue-900/50 bg-blue-900/10 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-blue-400">
              Suggested Work Items
            </h3>
            <button
              onClick={() => onCreateWorkItems(insights.suggestedWorkItems)}
              disabled={creatingWorkItems}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                creatingWorkItems
                  ? 'bg-blue-900/50 text-blue-300 cursor-wait'
                  : 'bg-blue-600 text-white hover:bg-blue-500'
              }`}
            >
              {creatingWorkItems ? 'Creating...' : `Add All to Work Items`}
            </button>
          </div>
          <div className="space-y-3">
            {insights.suggestedWorkItems.map((item, i) => (
              <div key={i} className="rounded-lg border border-slate-700 bg-[#050509]/50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-medium text-slate-200">{item.title}</h4>
                    <p className="text-xs text-slate-400 mt-1">{item.description}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        item.priority === 'high'
                          ? 'bg-red-500/20 text-red-300'
                          : item.priority === 'medium'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-slate-500/20 text-slate-300'
                      }`}
                    >
                      {item.priority}
                    </span>
                    <span className="text-[10px] text-slate-500 capitalize">{item.area}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
