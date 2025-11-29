'use client';

import { useState, useCallback, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  COMPANY_TOOL_DEFS,
  getEnabledTools,
  getComingSoonTools,
  type CompanyToolDefinition,
  type CompanyToolId,
  type ToolIcon,
} from '@/lib/tools/registry';
import type { DiagnosticRun } from '@/lib/os/diagnostics/runs';
import type { CompanyRecord } from '@/lib/airtable/companies';

// ============================================================================
// Types
// ============================================================================

interface CompanyToolsTabProps {
  companyId: string;
  company: CompanyRecord;
  diagnosticRuns: DiagnosticRun[];
}

interface ToolCardProps {
  tool: CompanyToolDefinition;
  companyId: string;
  company: CompanyRecord;
  lastRun: DiagnosticRun | null;
  onRunTool: (tool: CompanyToolDefinition) => Promise<void>;
  isRunning: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      if (diffMinutes < 1) return 'Just now';
      return `${diffMinutes}m ago`;
    }
    return `${diffHours}h ago`;
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

function getToolIconSvg(icon: ToolIcon): ReactNode {
  switch (icon) {
    case 'zap':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
    case 'fileText':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    case 'layers':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      );
    case 'globe':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        </svg>
      );
    case 'sparkles':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      );
    case 'fileEdit':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      );
    case 'search':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      );
    case 'trendingUp':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      );
    case 'settings':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    case 'barChart':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      );
    default:
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
  }
}

// ============================================================================
// Tool Card Component
// ============================================================================

function ToolCard({
  tool,
  companyId,
  company,
  lastRun,
  onRunTool,
  isRunning,
}: ToolCardProps) {
  const router = useRouter();
  const isEnabled = tool.status === 'enabled';
  const hasWebsite = Boolean(company.website || company.domain);
  const canRun = isEnabled && (!tool.requiresWebsite || hasWebsite);

  const handleRun = async () => {
    if (!canRun || isRunning) return;

    // For openRoute tools, navigate directly
    if (tool.behavior === 'openRoute' && tool.openPath) {
      router.push(tool.openPath(companyId));
      return;
    }

    // For diagnosticRun tools, run via API
    await onRunTool(tool);
  };

  const handleViewReport = () => {
    if (tool.viewPath && lastRun) {
      router.push(tool.viewPath(companyId, lastRun.id));
    }
  };

  // Get status display
  let statusText = 'Not run yet';
  let statusColor = 'text-slate-500';
  if (lastRun) {
    if (lastRun.status === 'running') {
      statusText = 'Running...';
      statusColor = 'text-blue-400';
    } else if (lastRun.status === 'complete') {
      statusText = `Last run ${formatRelativeTime(lastRun.createdAt)}`;
      statusColor = 'text-slate-400';
    } else if (lastRun.status === 'failed') {
      statusText = `Failed ${formatRelativeTime(lastRun.createdAt)}`;
      statusColor = 'text-red-400';
    }
  }

  // For openRoute tools (like Analytics), show different status
  if (tool.behavior === 'openRoute') {
    statusText = 'Live data';
    statusColor = 'text-emerald-400';
  }

  return (
    <div
      className={`rounded-2xl bg-slate-900/80 border p-5 flex flex-col justify-between transition-all ${
        isEnabled
          ? 'border-slate-800 hover:border-slate-700'
          : 'border-slate-800/50 opacity-60'
      }`}
    >
      {/* Header */}
      <div>
        <div className="flex items-start justify-between mb-3">
          <div className={`p-2 rounded-lg ${isEnabled ? 'bg-slate-800 text-amber-500' : 'bg-slate-800/50 text-slate-600'}`}>
            {getToolIconSvg(tool.icon)}
          </div>
          {lastRun?.score !== null && lastRun?.score !== undefined && (
            <span className="text-lg font-bold text-amber-500">
              {lastRun.score}
            </span>
          )}
        </div>

        <h3 className="text-sm font-semibold text-slate-50 mb-1">
          {tool.label}
        </h3>
        <p className="text-xs text-slate-400 mb-1">
          {tool.category}
        </p>
        <p className="text-xs text-slate-300 leading-relaxed">
          {tool.description}
        </p>

        {/* Estimated time */}
        {tool.estimatedMinutes && tool.behavior === 'diagnosticRun' && (
          <p className="text-xs text-slate-500 mt-2">
            ~{tool.estimatedMinutes} min
          </p>
        )}

        {/* Status */}
        <div className={`text-xs mt-3 ${statusColor}`}>
          {isRunning ? (
            <span className="flex items-center gap-1.5">
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Running...
            </span>
          ) : (
            statusText
          )}
        </div>

        {/* Website required warning */}
        {tool.requiresWebsite && !hasWebsite && (
          <div className="text-xs text-amber-500/80 mt-2 flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Website required
          </div>
        )}

        {/* Not available */}
        {!isEnabled && (
          <div className="text-xs text-slate-500 mt-2">
            Coming soon
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-4 pt-4 border-t border-slate-800">
        <button
          onClick={handleRun}
          disabled={!canRun || isRunning}
          className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
            canRun && !isRunning
              ? 'bg-amber-500 hover:bg-amber-400 text-slate-900'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
          }`}
        >
          {isRunning
            ? 'Running...'
            : tool.behavior === 'openRoute'
            ? 'Open'
            : tool.primaryActionLabel || 'Run Tool'}
        </button>
        {tool.viewPath && lastRun && lastRun.status === 'complete' && tool.behavior === 'diagnosticRun' && (
          <button
            onClick={handleViewReport}
            className="flex-1 px-3 py-2 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            View Report
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function CompanyToolsTab({
  companyId,
  company,
  diagnosticRuns,
}: CompanyToolsTabProps) {
  const [runningTools, setRunningTools] = useState<Set<CompanyToolId>>(new Set());
  const [localRuns, setLocalRuns] = useState<DiagnosticRun[]>(diagnosticRuns);

  // Get the latest run for each tool
  const getLastRunForTool = useCallback(
    (tool: CompanyToolDefinition): DiagnosticRun | null => {
      if (!tool.diagnosticToolId) return null;

      const toolRuns = localRuns
        .filter((run) => run.toolId === tool.diagnosticToolId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return toolRuns[0] || null;
    },
    [localRuns]
  );

  // Handle running a tool
  const handleRunTool = useCallback(
    async (tool: CompanyToolDefinition) => {
      if (tool.behavior !== 'diagnosticRun' || !tool.runApiPath) return;

      setRunningTools((prev) => new Set(prev).add(tool.id));

      try {
        const response = await fetch(tool.runApiPath, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            url: company.website || company.domain,
          }),
        });

        const data = await response.json();

        if (response.ok && data.run) {
          // Add the new run to local state
          setLocalRuns((prev) => [data.run, ...prev]);
        } else {
          console.error(`[Tools] Failed to run ${tool.label}:`, data.error);
        }
      } catch (error) {
        console.error(`[Tools] Error running ${tool.label}:`, error);
      } finally {
        setRunningTools((prev) => {
          const next = new Set(prev);
          next.delete(tool.id);
          return next;
        });
      }
    },
    [companyId, company.website, company.domain]
  );

  // Group tools by status
  const enabledTools = getEnabledTools();
  const comingSoonTools = getComingSoonTools();

  return (
    <div className="space-y-8">
      {/* Active Tools Grid */}
      <div>
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
          Available Tools ({enabledTools.length})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {enabledTools.map((tool) => (
            <ToolCard
              key={tool.id}
              tool={tool}
              companyId={companyId}
              company={company}
              lastRun={getLastRunForTool(tool)}
              onRunTool={handleRunTool}
              isRunning={runningTools.has(tool.id)}
            />
          ))}
        </div>
      </div>

      {/* Coming Soon Tools */}
      {comingSoonTools.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
            Coming Soon ({comingSoonTools.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {comingSoonTools.map((tool) => (
              <ToolCard
                key={tool.id}
                tool={tool}
                companyId={companyId}
                company={company}
                lastRun={getLastRunForTool(tool)}
                onRunTool={handleRunTool}
                isRunning={false}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
