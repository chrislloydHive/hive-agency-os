// app/tools/[toolSlug]/page.tsx
// Individual tool page showing info about the tool
// For diagnostic tools with runs, shows recent runs across companies
// For strategic/openRoute tools, shows tool info with link to use it

import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  COMPANY_TOOL_DEFS,
  getToolBySlug,
  getCategoryColor,
  type CompanyToolDefinition,
  type ToolIcon,
} from '@/lib/tools/registry';
import { getRunsByTool } from '@/lib/os/diagnostics/runs';
import { getCompanyById } from '@/lib/airtable/companies';
import type { DiagnosticToolId } from '@/lib/os/diagnostics/runs';

// Tool icon component using inline SVGs (consistent with Tools hub)
function ToolIconSvg({ icon, className }: { icon: ToolIcon; className?: string }) {
  const baseClass = className || 'w-5 h-5';

  switch (icon) {
    case 'zap':
      return (
        <svg className={baseClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
    case 'fileText':
      return (
        <svg className={baseClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    case 'layers':
      return (
        <svg className={baseClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      );
    case 'globe':
      return (
        <svg className={baseClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
        </svg>
      );
    case 'sparkles':
      return (
        <svg className={baseClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      );
    case 'search':
      return (
        <svg className={baseClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      );
    case 'fileEdit':
      return (
        <svg className={baseClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      );
    case 'trendingUp':
      return (
        <svg className={baseClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      );
    case 'settings':
      return (
        <svg className={baseClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    case 'barChart':
      return (
        <svg className={baseClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      );
    case 'tv':
      return (
        <svg className={baseClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      );
    case 'users':
      return (
        <svg className={baseClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      );
    default:
      return (
        <svg className={baseClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
  }
}

interface Props {
  params: Promise<{ toolSlug: string }>;
}

export default async function ToolPage({ params }: Props) {
  const { toolSlug } = await params;

  // Find tool by URL slug or by id
  const tool = getToolBySlug(toolSlug) || COMPANY_TOOL_DEFS.find(t => t.id === toolSlug);

  if (!tool) {
    notFound();
  }

  // For diagnostic tools with runs, fetch the runs
  let runsWithCompanies: { run: any; company: any }[] = [];

  if (tool.behavior === 'diagnosticRun' && tool.diagnosticToolId) {
    const runs = await getRunsByTool(tool.diagnosticToolId as DiagnosticToolId, 50);
    runsWithCompanies = await Promise.all(
      runs.map(async (run) => {
        const company = await getCompanyById(run.companyId);
        return { run, company };
      })
    );
  }

  const isDiagnosticWithRuns = tool.behavior === 'diagnosticRun' && tool.diagnosticToolId;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/tools"
          className="text-sm text-slate-500 hover:text-slate-300 mb-4 inline-flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Tools
        </Link>

        <div className="flex items-center gap-4 mt-4">
          <div className={`p-3 rounded-xl ${getCategoryColor(tool.category)}`}>
            <ToolIconSvg icon={tool.icon} className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-100">{tool.label}</h1>
            <p className="text-slate-400">{tool.description}</p>
          </div>
        </div>

        {/* Category Badge */}
        <div className="mt-4 flex items-center gap-3">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${getCategoryColor(tool.category)}`}>
            {tool.category}
          </span>
          <span className={`text-xs px-2.5 py-1 rounded-full ${
            tool.section === 'strategic'
              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
              : 'bg-slate-500/10 text-slate-400 border border-slate-500/30'
          }`}>
            {tool.section === 'strategic' ? 'Strategic' : 'Diagnostic'}
          </span>
          {tool.status === 'beta' && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
              Beta
            </span>
          )}
        </div>
      </div>

      {/* Blueprint Meta (if available) */}
      {tool.blueprintMeta && (
        <div className="mb-8 bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">About This Tool</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Why Run It</h3>
              <p className="text-sm text-slate-300">{tool.blueprintMeta.whyRun}</p>
            </div>
            <div>
              <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Question Answered</h3>
              <p className="text-sm text-slate-300">{tool.blueprintMeta.answersQuestion}</p>
            </div>
            <div>
              <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">When to Use</h3>
              <p className="text-sm text-slate-300">{tool.blueprintMeta.typicalUseWhen}</p>
            </div>
            <div>
              <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Influences</h3>
              <div className="flex flex-wrap gap-1.5">
                {tool.blueprintMeta.influences.map((influence) => (
                  <span
                    key={influence}
                    className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400"
                  >
                    {influence}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* For openRoute tools (like Media Lab, Audience Lab), show info about accessing it */}
      {tool.behavior === 'openRoute' && (
        <div className="mb-8 bg-slate-900/50 border border-slate-800 rounded-xl p-8 text-center">
          <ToolIconSvg icon={tool.icon} className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-100 mb-2">
            Open from Company Page
          </h2>
          <p className="text-slate-400 text-sm max-w-md mx-auto mb-4">
            This tool opens directly within a company context. Navigate to a company's Blueprint page and open {tool.label} from there.
          </p>
          <p className="text-xs text-slate-500">
            Access via: Company → Blueprint → {tool.label}
          </p>
        </div>
      )}

      {/* For diagnostic tools with runs, show stats and runs table */}
      {isDiagnosticWithRuns && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
              <div className="text-2xl font-bold text-slate-100">{runsWithCompanies.length}</div>
              <div className="text-sm text-slate-500">Total Runs</div>
            </div>
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
              <div className="text-2xl font-bold text-emerald-400">
                {runsWithCompanies.filter((r) => r.run.status === 'complete').length}
              </div>
              <div className="text-sm text-slate-500">Completed</div>
            </div>
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
              <div className="text-2xl font-bold text-slate-100">
                {runsWithCompanies.filter((r) => r.run.score != null).length > 0
                  ? Math.round(
                      runsWithCompanies
                        .filter((r) => r.run.score != null)
                        .reduce((acc, r) => acc + (r.run.score || 0), 0) /
                        runsWithCompanies.filter((r) => r.run.score != null).length
                    )
                  : '—'}
              </div>
              <div className="text-sm text-slate-500">Avg Score</div>
            </div>
          </div>

          {/* Runs Table */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800">
              <h2 className="text-lg font-semibold text-slate-100">Recent Runs</h2>
            </div>

            {runsWithCompanies.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <ToolIconSvg icon={tool.icon} className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                <p className="text-slate-500">No runs yet for this tool.</p>
                <p className="text-sm text-slate-600 mt-1">
                  Run a diagnostic from a company's page to see results here.
                </p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-800 text-left">
                    <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Company
                    </th>
                    <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Score
                    </th>
                    <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {runsWithCompanies.map(({ run, company }) => (
                    <tr key={run.id} className="hover:bg-slate-800/30">
                      <td className="px-6 py-4">
                        {company ? (
                          <Link
                            href={`/c/${run.companyId}`}
                            className="text-slate-100 hover:text-amber-400 font-medium"
                          >
                            {company.name}
                          </Link>
                        ) : (
                          <span className="text-slate-500">Unknown Company</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            run.status === 'complete'
                              ? 'bg-emerald-400/10 text-emerald-400'
                              : run.status === 'running'
                              ? 'bg-blue-400/10 text-blue-400'
                              : run.status === 'failed'
                              ? 'bg-red-400/10 text-red-400'
                              : 'bg-slate-400/10 text-slate-400'
                          }`}
                        >
                          {run.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {run.score != null ? (
                          <span
                            className={`font-medium ${
                              run.score >= 70
                                ? 'text-emerald-400'
                                : run.score >= 50
                                ? 'text-amber-400'
                                : 'text-red-400'
                            }`}
                          >
                            {run.score}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {new Date(run.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        {tool.viewPath ? (
                          <Link
                            href={tool.viewPath(run.companyId, run.id)}
                            className="text-sm text-slate-400 hover:text-amber-400"
                          >
                            View Report
                          </Link>
                        ) : (
                          <Link
                            href={`/c/${run.companyId}/diagnostics`}
                            className="text-sm text-slate-400 hover:text-amber-400"
                          >
                            View
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
