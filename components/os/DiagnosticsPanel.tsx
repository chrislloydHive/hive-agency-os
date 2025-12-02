'use client';

import { useState } from 'react';
import {
  DIAGNOSTIC_TOOLS,
  getToolsByCategory,
  getCategoryLabel,
  getCategoryColor,
  getToolViewPath,
  type DiagnosticToolConfig,
  type DiagnosticToolCategory,
} from '@/lib/os/diagnostics/tools';
import type { DiagnosticRun, DiagnosticToolId } from '@/lib/os/diagnostics/runs';
import {
  formatErrorForUser,
  getSuccessMessage,
  toolIdToSuccessType,
  getToolProgressStages,
  type DiagnosticError,
  type DiagnosticSuccessMessage,
} from '@/lib/os/diagnostics/messages';
import { Zap, FileText, Globe, Sparkles, FileEdit, Loader2, CheckCircle2, XCircle, Clock, Search, TrendingUp, Settings, ArrowRight, RefreshCw } from 'lucide-react';

// ============================================================================
// Toast Types
// ============================================================================

interface ToastState {
  type: 'success' | 'error';
  toolLabel: string;
  // Error toast data
  error?: DiagnosticError;
  // Success toast data
  success?: DiagnosticSuccessMessage;
  runId?: string;
  viewPath?: string;
}

// Icon map for tool icons
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Zap,
  FileText,
  Globe,
  Sparkles,
  FileEdit,
  Search,
  TrendingUp,
  Settings,
};

interface DiagnosticsPanelProps {
  companyId: string;
  companyName: string;
  runs: DiagnosticRun[];
}

// Helper to format dates
const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
};

export function DiagnosticsPanel({ companyId, companyName, runs }: DiagnosticsPanelProps) {
  const [runningTools, setRunningTools] = useState<Set<DiagnosticToolId>>(new Set());
  const [localRuns, setLocalRuns] = useState<DiagnosticRun[]>(runs);
  const [toast, setToast] = useState<ToastState | null>(null);

  // Group tools by category - show all categories with tools
  const toolCategories: DiagnosticToolCategory[] = ['strategy', 'website', 'brand', 'content', 'seo', 'demand', 'ops'];

  // Get most recent run for a tool
  const getLatestRun = (toolId: DiagnosticToolId): DiagnosticRun | undefined => {
    return localRuns.find((r) => r.toolId === toolId);
  };

  // Clear toast
  const clearToast = () => setToast(null);

  // Run a diagnostic tool
  const runTool = async (tool: DiagnosticToolConfig) => {
    if (runningTools.has(tool.id)) return;

    setRunningTools((prev) => new Set(prev).add(tool.id));
    setToast(null);

    try {
      const response = await fetch(tool.runApiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to run diagnostic');
      }

      // Add the new run to local state
      if (data.run) {
        setLocalRuns((prev) => [data.run, ...prev.filter((r) => r.id !== data.run.id)]);

        // Show success toast
        const successType = toolIdToSuccessType(tool.id);
        const successMessage = getSuccessMessage(successType, {
          score: data.result?.score,
          summary: data.result?.summary,
        });

        setToast({
          type: 'success',
          toolLabel: tool.label,
          success: successMessage,
          runId: data.run.id,
          viewPath: tool.viewPath ? getToolViewPath(tool, companyId, data.run.id) : undefined,
        });

        // Auto-dismiss success toast after 10 seconds
        setTimeout(() => setToast((current) => current?.type === 'success' ? null : current), 10000);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to run diagnostic';
      console.error('Error running diagnostic:', errorMessage);

      // Format error with user-friendly message
      const formattedError = formatErrorForUser(errorMessage);

      setToast({
        type: 'error',
        toolLabel: tool.label,
        error: formattedError,
      });

      // Auto-dismiss error toast after 12 seconds (longer for errors)
      setTimeout(() => setToast((current) => current?.type === 'error' ? null : current), 12000);
    } finally {
      setRunningTools((prev) => {
        const next = new Set(prev);
        next.delete(tool.id);
        return next;
      });
    }
  };

  // Retry handler for failed diagnostics
  const handleRetry = (tool: DiagnosticToolConfig) => {
    setToast(null);
    runTool(tool);
  };

  // Find the tool config for retry functionality
  const getToolByLabel = (label: string) => DIAGNOSTIC_TOOLS.find(t => t.label === label);

  return (
    <div className="space-y-8">
      {/* Toast Notification */}
      {toast && (
        <DiagnosticToast
          toast={toast}
          onDismiss={clearToast}
          onRetry={toast.error?.retryable ? () => {
            const tool = getToolByLabel(toast.toolLabel);
            if (tool) handleRetry(tool);
          } : undefined}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Diagnostics Suite</h2>
          <p className="text-sm text-slate-400 mt-1">
            Run comprehensive diagnostic tools for {companyName}
          </p>
        </div>
      </div>

      {/* Tool Categories */}
      {toolCategories.map((category) => {
        const categoryTools = getToolsByCategory(category);
        if (categoryTools.length === 0) return null;

        return (
          <div key={category} className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
              {getCategoryLabel(category)}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {categoryTools.map((tool) => {
                const isRunning = runningTools.has(tool.id);
                const latestRun = getLatestRun(tool.id);
                const Icon = ICON_MAP[tool.icon] || Zap;
                const categoryColorClass = getCategoryColor(category);

                return (
                  <ToolCard
                    key={tool.id}
                    tool={tool}
                    latestRun={latestRun}
                    isRunning={isRunning}
                    onRun={() => runTool(tool)}
                    Icon={Icon}
                    categoryColorClass={categoryColorClass}
                    companyId={companyId}
                  />
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Run History */}
      {localRuns.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
            Recent Runs
          </h3>
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">
                    Tool
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">
                    Score
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">
                    Summary
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {localRuns.slice(0, 10).map((run) => {
                  const tool = DIAGNOSTIC_TOOLS.find((t) => t.id === run.toolId);
                  return (
                    <tr
                      key={run.id}
                      className="border-b border-slate-800/50 hover:bg-slate-800/30"
                    >
                      <td className="px-4 py-3 text-slate-200">
                        {tool?.label || run.toolId}
                      </td>
                      <td className="px-4 py-3">
                        <RunStatusBadge status={run.status} />
                      </td>
                      <td className="px-4 py-3">
                        {run.score !== null ? (
                          <span className="font-semibold text-amber-500">{run.score}</span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs max-w-xs truncate">
                        {run.summary || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs text-right">
                        {formatDate(run.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Tool Card Component
// ============================================================================

interface ToolCardProps {
  tool: DiagnosticToolConfig;
  latestRun?: DiagnosticRun;
  isRunning: boolean;
  runStartTime?: number;
  onRun: () => void;
  Icon: React.ComponentType<{ className?: string }>;
  categoryColorClass: string;
  companyId: string;
}

function ToolCard({
  tool,
  latestRun,
  isRunning,
  runStartTime,
  onRun,
  Icon,
  categoryColorClass,
  companyId,
}: ToolCardProps) {
  const hasResult = latestRun?.status === 'complete';
  const hasFailed = latestRun?.status === 'failed';
  const stages = getToolProgressStages(tool.id);

  return (
    <div className={`bg-slate-900/70 border rounded-xl p-5 flex flex-col ${
      isRunning ? 'border-amber-700/50' : hasFailed ? 'border-red-800/30' : 'border-slate-800'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg border ${
            isRunning ? 'border-amber-500/50 bg-amber-500/10' : categoryColorClass
          }`}>
            {isRunning ? (
              <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
            ) : (
              <Icon className="w-5 h-5" />
            )}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-100">{tool.label}</h4>
            {!isRunning && tool.estimatedTime && (
              <span className="text-xs text-slate-500">{tool.estimatedTime}</span>
            )}
            {isRunning && (
              <span className="text-xs text-amber-400">Running...</span>
            )}
          </div>
        </div>
        {hasResult && latestRun.score !== null && !isRunning && (
          <div className="text-right">
            <div className="text-lg font-bold text-amber-500">{latestRun.score}</div>
            <div className="text-xs text-slate-500">score</div>
          </div>
        )}
      </div>

      {/* Running Progress Indicator */}
      {isRunning && stages.length > 0 && (
        <div className="mb-4 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-amber-400">
              Processing...
            </span>
            <span className="text-xs text-slate-500">
              {tool.estimatedTime}
            </span>
          </div>
          <div className="flex gap-1">
            {stages.map((stage, i) => (
              <div
                key={stage.id}
                className="flex-1 h-1 rounded-full bg-slate-700 overflow-hidden"
              >
                <div
                  className="h-full bg-amber-400 animate-pulse"
                  style={{
                    animationDelay: `${i * 0.2}s`,
                    opacity: 0.3 + (i * 0.15),
                  }}
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {stages[0]?.description}
          </p>
        </div>
      )}

      {/* Description - hide when running */}
      {!isRunning && (
        <p className="text-xs text-slate-400 mb-4 flex-1">{tool.description}</p>
      )}

      {/* Latest Result Summary - hide when running */}
      {!isRunning && hasResult && latestRun.summary && (
        <div className="text-xs text-slate-500 mb-4 p-2 bg-slate-800/50 rounded-lg truncate">
          {latestRun.summary}
        </div>
      )}

      {/* Failed State */}
      {!isRunning && hasFailed && (
        <div className="text-xs text-red-400/80 mb-4 p-2 bg-red-900/20 border border-red-800/30 rounded-lg">
          Last run failed. Click to retry.
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between gap-3 mt-auto">
        <button
          onClick={onRun}
          disabled={isRunning || !tool.defaultEnabled}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${
            isRunning
              ? 'bg-amber-500/20 text-amber-400 cursor-wait border border-amber-500/30'
              : !tool.defaultEnabled
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
              : hasFailed
              ? 'bg-amber-500 hover:bg-amber-400 text-slate-900'
              : 'bg-amber-500 hover:bg-amber-400 text-slate-900'
          }`}
        >
          {isRunning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Running...
            </>
          ) : hasFailed ? (
            <>
              <RefreshCw className="w-4 h-4" />
              Retry
            </>
          ) : (
            tool.primaryActionLabel
          )}
        </button>

        {hasResult && tool.viewPath && !isRunning && (
          <a
            href={getToolViewPath(tool, companyId, latestRun.id)}
            className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors"
          >
            View
          </a>
        )}
      </div>

      {/* Last run timestamp */}
      {latestRun && !isRunning && (
        <div className="mt-3 text-xs text-slate-600">
          Last run: {formatDate(latestRun.createdAt)}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Status Badge Component
// ============================================================================

function RunStatusBadge({ status }: { status: string }) {
  const config = {
    pending: { icon: Clock, className: 'text-slate-400 bg-slate-500/10' },
    running: { icon: Loader2, className: 'text-amber-400 bg-amber-500/10', animate: true },
    complete: { icon: CheckCircle2, className: 'text-emerald-400 bg-emerald-500/10' },
    failed: { icon: XCircle, className: 'text-red-400 bg-red-500/10' },
  }[status] || { icon: Clock, className: 'text-slate-400 bg-slate-500/10' };

  const StatusIcon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${config.className}`}
    >
      <StatusIcon className={`w-3 h-3 ${config.animate ? 'animate-spin' : ''}`} />
      {status}
    </span>
  );
}

// ============================================================================
// Diagnostic Toast Component
// ============================================================================

interface DiagnosticToastProps {
  toast: ToastState;
  onDismiss: () => void;
  onRetry?: () => void;
}

function DiagnosticToast({ toast, onDismiss, onRetry }: DiagnosticToastProps) {
  if (toast.type === 'error' && toast.error) {
    return (
      <div className="fixed bottom-4 right-4 z-50 w-96 rounded-xl bg-slate-900/95 border border-red-800/50 shadow-2xl shadow-red-900/20 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-red-900/30 border-b border-red-800/30">
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-400" />
            <span className="text-sm font-semibold text-red-100">
              {toast.toolLabel} Failed
            </span>
          </div>
          <button
            onClick={onDismiss}
            className="text-red-400 hover:text-red-200 transition-colors"
          >
            <XCircle className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-3 space-y-3">
          {/* User-friendly message */}
          <p className="text-sm text-slate-200">{toast.error.userMessage}</p>

          {/* Suggestion */}
          {toast.error.suggestion && (
            <p className="text-xs text-slate-400">{toast.error.suggestion}</p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            {onRetry && toast.error.retryable && (
              <button
                onClick={onRetry}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg transition-colors"
              >
                <RefreshCw className="h-3 w-3" />
                Try Again
              </button>
            )}
            <span className="text-xs text-slate-600">
              Error: {toast.error.code}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (toast.type === 'success' && toast.success) {
    return (
      <div className="fixed bottom-4 right-4 z-50 w-96 rounded-xl bg-slate-900/95 border border-emerald-800/50 shadow-2xl shadow-emerald-900/20 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-emerald-900/30 border-b border-emerald-800/30">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            <span className="text-sm font-semibold text-emerald-100">
              {toast.success.headline}
            </span>
          </div>
          <button
            onClick={onDismiss}
            className="text-emerald-400 hover:text-emerald-200 transition-colors"
          >
            <XCircle className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-3 space-y-3">
          {/* Summary */}
          {toast.success.detail && (
            <p className="text-sm text-slate-300 line-clamp-2">{toast.success.detail}</p>
          )}

          {/* Next Steps */}
          {toast.success.nextSteps.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Next Steps
              </p>
              <ul className="space-y-1">
                {toast.success.nextSteps.slice(0, 2).map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                    <ArrowRight className="h-3 w-3 mt-0.5 text-emerald-500 flex-shrink-0" />
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* View Results Button */}
          {toast.viewPath && (
            <div className="pt-1">
              <a
                href={toast.viewPath}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition-colors"
              >
                View Results
                <ArrowRight className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}

export default DiagnosticsPanel;
