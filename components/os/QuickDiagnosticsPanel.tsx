'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Zap, Loader2, ExternalLink } from 'lucide-react';
import type { DiagnosticToolId } from '@/lib/os/diagnostics/runs';
import { getToolConfig, getToolViewPath } from '@/lib/os/diagnostics/tools';

interface QuickDiagnosticsPanelProps {
  companyId: string;
  companyName: string;
  websiteUrl: string;
}

// Quick diagnostic tools for pipeline opportunities (use registry for config)
const QUICK_TOOL_IDS: DiagnosticToolId[] = ['gapSnapshot'];

export function QuickDiagnosticsPanel({
  companyId,
  companyName,
  websiteUrl,
}: QuickDiagnosticsPanelProps) {
  const [runningTool, setRunningTool] = useState<DiagnosticToolId | null>(null);
  const [lastResult, setLastResult] = useState<{
    toolId: DiagnosticToolId;
    success: boolean;
    score?: number;
    summary?: string;
    error?: string;
    runId?: string;
  } | null>(null);

  // Get tool configs from registry
  const quickTools = QUICK_TOOL_IDS.map(id => getToolConfig(id)).filter(Boolean);

  const runTool = async (toolId: DiagnosticToolId) => {
    if (runningTool) return;

    const tool = getToolConfig(toolId);
    if (!tool) return;

    setRunningTool(toolId);
    setLastResult(null);

    try {
      const response = await fetch(tool.runApiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      });

      if (!response.ok) {
        throw new Error('Failed to run diagnostic');
      }

      const data = await response.json();

      setLastResult({
        toolId,
        success: data.result?.success ?? true,
        score: data.result?.score,
        summary: data.result?.summary,
        error: data.result?.error,
        runId: data.run?.id,
      });
    } catch (error) {
      setLastResult({
        toolId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setRunningTool(null);
    }
  };

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
          Quick Diagnostics
        </h2>
        <Link
          href={`/c/${companyId}/diagnostics`}
          className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
        >
          All Tools <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      <div className="space-y-3">
        {quickTools.map((tool) => {
          if (!tool) return null;
          const isRunning = runningTool === tool.id;
          const hasResult = lastResult?.toolId === tool.id;

          return (
            <div key={tool.id}>
              <button
                onClick={() => runTool(tool.id)}
                disabled={!!runningTool}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isRunning
                    ? 'bg-amber-500/10 border border-amber-500/30 cursor-wait'
                    : 'bg-slate-800 hover:bg-slate-700 border border-transparent'
                }`}
              >
                {isRunning ? (
                  <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
                ) : (
                  <Zap className="w-5 h-5 text-amber-500" />
                )}
                <div className="flex-1 text-left">
                  <div className="text-sm font-medium text-slate-200">
                    {isRunning ? 'Running...' : tool.label}
                  </div>
                  <div className="text-xs text-slate-500">{tool.description}</div>
                </div>
              </button>

              {/* Result display */}
              {hasResult && lastResult && (
                <div
                  className={`mt-2 p-3 rounded-lg text-sm ${
                    lastResult.success
                      ? 'bg-emerald-500/10 border border-emerald-500/30'
                      : 'bg-red-500/10 border border-red-500/30'
                  }`}
                >
                  {lastResult.success ? (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-300">Score</span>
                        <span className="text-lg font-bold text-amber-500">
                          {lastResult.score !== undefined ? lastResult.score : '—'}
                        </span>
                      </div>
                      {lastResult.summary && (
                        <div className="text-xs text-slate-400 mb-3">{lastResult.summary}</div>
                      )}
                      {lastResult.runId && tool.viewPath && (
                        <Link
                          href={getToolViewPath(tool, companyId, lastResult.runId)}
                          className="text-xs text-blue-400 hover:text-blue-300"
                        >
                          View Details →
                        </Link>
                      )}
                    </>
                  ) : (
                    <div className="text-red-400">
                      {lastResult.error || 'Failed to run diagnostic'}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-slate-500">
        Run a quick diagnostic to assess {companyName}&apos;s marketing presence.
      </p>
    </div>
  );
}

export default QuickDiagnosticsPanel;
