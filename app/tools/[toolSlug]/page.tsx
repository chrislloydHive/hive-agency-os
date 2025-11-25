// app/tools/[toolSlug]/page.tsx
// Individual tool page showing all runs across companies

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { DIAGNOSTIC_TOOLS, getToolConfig, getCategoryColor } from '@/lib/os/diagnostics/tools';
import { getRunsByTool } from '@/lib/os/diagnostics/runs';
import { getCompanyById } from '@/lib/airtable/companies';
import * as LucideIcons from 'lucide-react';
import type { DiagnosticToolId } from '@/lib/os/diagnostics/runs';

// Map URL slugs to tool IDs
const slugToToolId: Record<string, DiagnosticToolId> = {
  'gap-snapshot': 'gapSnapshot',
  'gap-plan': 'gapPlan',
  'website-lab': 'websiteLab',
  'brand-lab': 'brandLab',
  'content-lab': 'contentLab',
  'seo-lab': 'seoLab',
  'demand-lab': 'demandLab',
  'ops-lab': 'opsLab',
};

interface Props {
  params: Promise<{ toolSlug: string }>;
}

export default async function ToolPage({ params }: Props) {
  const { toolSlug } = await params;
  const toolId = slugToToolId[toolSlug];

  if (!toolId) {
    notFound();
  }

  const tool = getToolConfig(toolId);
  if (!tool) {
    notFound();
  }

  // Get all runs for this tool
  const runs = await getRunsByTool(toolId, 50);

  // Get company details for each run
  const runsWithCompanies = await Promise.all(
    runs.map(async (run) => {
      const company = await getCompanyById(run.companyId);
      return { run, company };
    })
  );

  const IconComponent = (LucideIcons as any)[tool.icon] || LucideIcons.HelpCircle;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/tools"
          className="text-sm text-slate-500 hover:text-slate-300 mb-4 inline-flex items-center gap-1"
        >
          <LucideIcons.ArrowLeft className="w-4 h-4" />
          Back to Tools
        </Link>

        <div className="flex items-center gap-4 mt-4">
          <div className={`p-3 rounded-xl ${getCategoryColor(tool.category)}`}>
            <IconComponent className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-100">{tool.label}</h1>
            <p className="text-slate-400">{tool.description}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <div className="text-2xl font-bold text-slate-100">{runs.length}</div>
          <div className="text-sm text-slate-500">Total Runs</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <div className="text-2xl font-bold text-emerald-400">
            {runs.filter((r) => r.status === 'complete').length}
          </div>
          <div className="text-sm text-slate-500">Completed</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <div className="text-2xl font-bold text-slate-100">
            {runs.filter((r) => r.score != null).length > 0
              ? Math.round(
                  runs
                    .filter((r) => r.score != null)
                    .reduce((acc, r) => acc + (r.score || 0), 0) /
                    runs.filter((r) => r.score != null).length
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
            <IconComponent className="w-12 h-12 text-slate-700 mx-auto mb-4" />
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
                        className="text-slate-100 hover:text-yellow-400 font-medium"
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
                            ? 'text-yellow-400'
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
                    <Link
                      href={`/c/${run.companyId}/diagnostics`}
                      className="text-sm text-slate-400 hover:text-yellow-400"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
