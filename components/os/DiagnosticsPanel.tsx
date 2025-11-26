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
import { Zap, FileText, Globe, Sparkles, FileEdit, Loader2, CheckCircle2, XCircle, Clock, Search, TrendingUp, Settings } from 'lucide-react';

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
  const [error, setError] = useState<string | null>(null);

  // Group tools by category - show all categories with tools
  const toolCategories: DiagnosticToolCategory[] = ['strategy', 'website', 'brand', 'content', 'seo', 'demand', 'ops'];

  // Get most recent run for a tool
  const getLatestRun = (toolId: DiagnosticToolId): DiagnosticRun | undefined => {
    return localRuns.find((r) => r.toolId === toolId);
  };

  // Run a diagnostic tool
  const runTool = async (tool: DiagnosticToolConfig) => {
    if (runningTools.has(tool.id)) return;

    setRunningTools((prev) => new Set(prev).add(tool.id));
    setError(null);

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
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to run diagnostic';
      console.error('Error running diagnostic:', errorMessage);
      setError(errorMessage);
      setTimeout(() => setError(null), 8000);
    } finally {
      setRunningTools((prev) => {
        const next = new Set(prev);
        next.delete(tool.id);
        return next;
      });
    }
  };

  return (
    <div className="space-y-8">
      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-4 right-4 z-50 max-w-md rounded-lg bg-red-900/90 border border-red-700 px-4 py-3 shadow-lg">
          <div className="flex items-start gap-2">
            <XCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-100">Diagnostic Failed</p>
              <p className="text-xs text-red-300 mt-1">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="ml-2 text-red-400 hover:text-red-200"
            >
              ×
            </button>
          </div>
        </div>
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
  onRun: () => void;
  Icon: React.ComponentType<{ className?: string }>;
  categoryColorClass: string;
  companyId: string;
}

function ToolCard({
  tool,
  latestRun,
  isRunning,
  onRun,
  Icon,
  categoryColorClass,
  companyId,
}: ToolCardProps) {
  const hasResult = latestRun?.status === 'complete';

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg border ${categoryColorClass}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-100">{tool.label}</h4>
            {tool.estimatedTime && (
              <span className="text-xs text-slate-500">{tool.estimatedTime}</span>
            )}
          </div>
        </div>
        {hasResult && latestRun.score !== null && (
          <div className="text-right">
            <div className="text-lg font-bold text-amber-500">{latestRun.score}</div>
            <div className="text-xs text-slate-500">score</div>
          </div>
        )}
      </div>

      {/* Description */}
      <p className="text-xs text-slate-400 mb-4 flex-1">{tool.description}</p>

      {/* Latest Result Summary */}
      {hasResult && latestRun.summary && (
        <div className="text-xs text-slate-500 mb-4 p-2 bg-slate-800/50 rounded-lg truncate">
          {latestRun.summary}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={onRun}
          disabled={isRunning || !tool.defaultEnabled}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${
            isRunning
              ? 'bg-slate-700 text-slate-400 cursor-wait'
              : !tool.defaultEnabled
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
              : 'bg-amber-500 hover:bg-amber-400 text-slate-900'
          }`}
        >
          {isRunning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Running...
            </>
          ) : (
            tool.primaryActionLabel
          )}
        </button>

        {hasResult && tool.viewPath && (
          <a
            href={getToolViewPath(tool, companyId, latestRun.id)}
            className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors"
          >
            View
          </a>
        )}
      </div>

      {/* Last run timestamp */}
      {latestRun && (
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

export default DiagnosticsPanel;
