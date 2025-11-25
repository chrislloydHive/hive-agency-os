// app/[companyId]/diagnostics/page.tsx
// Diagnostics Hub - Unified view of all diagnostic tools
//
// This page provides a summary of all diagnostic tools available for a company,
// showing the latest run status and scores for each tool.

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCompanyById } from '@/lib/airtable/companies';
import { listDiagnosticRunsForCompany, getRunsGroupedByTool } from '@/lib/os/diagnostics/runs';
import type { DiagnosticRun, DiagnosticToolId } from '@/lib/os/diagnostics/runs';
import {
  DIAGNOSTIC_TOOLS,
  getToolConfig,
  getAllCategories,
  getCategoryLabel,
  getCategoryColor,
} from '@/lib/os/diagnostics/tools';
import type { DiagnosticToolConfig, DiagnosticToolCategory } from '@/lib/os/diagnostics/tools';
import { DiagnosticsHubClient } from './DiagnosticsHubClient';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export const dynamic = 'force-dynamic';

export default async function DiagnosticsHubPage({ params }: PageProps) {
  const { companyId } = await params;

  // Fetch company
  const company = await getCompanyById(companyId);
  if (!company) {
    return notFound();
  }

  // Fetch all diagnostic runs grouped by tool
  const runsByTool = await getRunsGroupedByTool(companyId);

  // Build tool summaries with latest run data
  const toolSummaries = DIAGNOSTIC_TOOLS.map((tool) => {
    const runs = runsByTool[tool.id] || [];
    const latestRun = runs[0] || null;

    return {
      tool,
      latestRun,
      runCount: runs.length,
    };
  });

  // Group by category for display
  const categories = getAllCategories();
  const toolsByCategory = new Map<DiagnosticToolCategory, typeof toolSummaries>();

  for (const category of categories) {
    const categoryTools = toolSummaries.filter((s) => s.tool.category === category);
    if (categoryTools.length > 0) {
      toolsByCategory.set(category, categoryTools);
    }
  }

  // Calculate overall stats
  const completedRuns = toolSummaries.filter((s) => s.latestRun?.status === 'complete');
  const runsWithScores = completedRuns.filter((s) => s.latestRun?.score != null);
  const averageScore =
    runsWithScores.length > 0
      ? Math.round(
          runsWithScores.reduce((acc, s) => acc + (s.latestRun?.score || 0), 0) /
            runsWithScores.length
        )
      : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-100">Diagnostics Suite</h1>
            <p className="mt-1 text-sm text-slate-400">
              Run diagnostic tools to assess {company.name}&apos;s marketing performance
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Overall Score</p>
            <p className="text-3xl font-bold tabular-nums text-slate-100">
              {averageScore ?? '—'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {completedRuns.length} of {DIAGNOSTIC_TOOLS.filter((t) => t.defaultEnabled).length} tools run
            </p>
          </div>
        </div>
      </div>

      {/* Tool Cards by Category */}
      {categories.map((category) => {
        const categoryToolSummaries = toolsByCategory.get(category);
        if (!categoryToolSummaries || categoryToolSummaries.length === 0) return null;

        // Only show categories with enabled tools (or any runs)
        const hasEnabledOrRun = categoryToolSummaries.some(
          (s) => s.tool.defaultEnabled || s.runCount > 0
        );
        if (!hasEnabledOrRun) return null;

        return (
          <section key={category} className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                {getCategoryLabel(category)}
              </h2>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${getCategoryColor(
                  category
                )}`}
              >
                {categoryToolSummaries.length} tools
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {categoryToolSummaries.map(({ tool, latestRun, runCount }) => (
                <ToolCard
                  key={tool.id}
                  tool={tool}
                  latestRun={latestRun}
                  runCount={runCount}
                  companyId={companyId}
                />
              ))}
            </div>
          </section>
        );
      })}

      {/* Client-side runner component */}
      <DiagnosticsHubClient companyId={companyId} />
    </div>
  );
}

// ============================================================================
// Tool Card Component
// ============================================================================

interface ToolCardProps {
  tool: DiagnosticToolConfig;
  latestRun: DiagnosticRun | null;
  runCount: number;
  companyId: string;
}

function ToolCard({ tool, latestRun, runCount, companyId }: ToolCardProps) {
  const hasRun = latestRun != null;
  const isComplete = latestRun?.status === 'complete';
  const score = latestRun?.score;

  // Status indicator
  const statusColor =
    !hasRun
      ? 'bg-slate-600'
      : latestRun.status === 'complete'
      ? 'bg-emerald-500'
      : latestRun.status === 'running'
      ? 'bg-amber-500 animate-pulse'
      : latestRun.status === 'failed'
      ? 'bg-red-500'
      : 'bg-slate-500';

  // Score color
  const scoreColor =
    score == null
      ? 'text-slate-400'
      : score >= 80
      ? 'text-emerald-400'
      : score >= 60
      ? 'text-amber-400'
      : 'text-red-400';

  // Determine if this tool is enabled
  const isEnabled = tool.defaultEnabled || runCount > 0;

  return (
    <div
      className={`rounded-xl border bg-[#050509]/80 p-4 transition-all ${
        isEnabled
          ? 'border-slate-700 hover:border-slate-600'
          : 'border-slate-800/50 opacity-60'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${statusColor}`} />
            <h3 className="text-sm font-semibold text-slate-200 truncate">{tool.label}</h3>
          </div>
          <p className="mt-1 text-xs text-slate-400 line-clamp-2">{tool.description}</p>
        </div>

        {/* Score */}
        <div className="text-right flex-shrink-0">
          <p className={`text-2xl font-bold tabular-nums ${scoreColor}`}>
            {score ?? '—'}
          </p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Score</p>
        </div>
      </div>

      {/* Latest run info */}
      {latestRun && (
        <div className="mb-3 rounded-lg bg-slate-900/50 px-3 py-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">
              {latestRun.status === 'running' ? 'Running...' : 'Last run'}
            </span>
            <span className="text-slate-500">
              {new Date(latestRun.createdAt).toLocaleDateString()}
            </span>
          </div>
          {latestRun.summary && (
            <p className="mt-1 text-slate-300 line-clamp-2">{latestRun.summary}</p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {isEnabled ? (
          <>
            <Link
              href={`/c/${companyId}/diagnostics/${tool.id.replace('Lab', '').toLowerCase()}`}
              className="flex-1 rounded-lg bg-slate-800/50 px-3 py-2 text-xs font-medium text-slate-300 text-center hover:bg-slate-700/50 border border-slate-700/50 transition-all"
            >
              {hasRun ? 'View Details' : tool.primaryActionLabel}
            </Link>
            {hasRun && (
              <button
                className="rounded-lg bg-blue-500/10 px-3 py-2 text-xs font-medium text-blue-400 hover:bg-blue-500/20 border border-blue-500/30 transition-all"
                data-tool-id={tool.id}
              >
                ↻ Re-run
              </button>
            )}
          </>
        ) : (
          <span className="flex-1 text-center text-xs text-slate-500 py-2">
            Coming soon
          </span>
        )}
      </div>

      {/* Run count */}
      {runCount > 1 && (
        <p className="mt-2 text-[10px] text-slate-500 text-right">
          {runCount} total runs
        </p>
      )}
    </div>
  );
}
