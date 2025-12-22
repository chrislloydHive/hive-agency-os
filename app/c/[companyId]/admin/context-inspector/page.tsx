// app/c/[companyId]/admin/context-inspector/page.tsx
// Context Inspector UI - Truth-First debugging panel
//
// Shows raw data sources vs canonical context graph,
// identifies promotion opportunities, and allows manual hydration.

import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getCompanyById } from '@/lib/airtable/companies';

interface PageProps {
  params: Promise<{ companyId: string }>;
}

interface InspectorData {
  companyId: string;
  companyName: string;
  domain: string;
  diagnosticRuns: Array<{
    id: string;
    status: string;
    createdAt: string;
    modulesCompleted: string[];
    dataTypes: string[];
    hasWebsiteLab: boolean;
    hasBrandLab: boolean;
    hasModules: boolean;
  }>;
  gapRuns: Array<{
    type: 'ia' | 'plan' | 'heavy';
    id: string;
    status: string;
    createdAt: string;
    hasCore: boolean;
    hasInsights: boolean;
    hasDimensions: boolean;
    domain: string;
  }>;
  findingsCount: number;
  contextGraph: {
    exists: boolean;
    completeness: number;
    nodeCount: number;
    lastUpdated: string | null;
    populatedDomains: string[];
  };
  importers: Array<{
    id: string;
    label: string;
    hasData: boolean;
    priority: number;
  }>;
  potentialPromotions: Array<{
    source: string;
    fields: string[];
  }>;
  health: {
    hasRawData: boolean;
    hasContextGraph: boolean;
    isStale: boolean;
    staleDays: number | null;
    promotionOpportunity: boolean;
  };
}

async function fetchInspectorData(companyId: string): Promise<InspectorData | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000');

    const response = await fetch(
      `${baseUrl}/api/os/companies/${companyId}/context/inspector`,
      { cache: 'no-store' }
    );

    if (!response.ok) {
      console.error('[inspector-page] API returned error:', response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('[inspector-page] Failed to fetch inspector data:', error);
    return null;
  }
}

export default async function ContextInspectorPage({ params }: PageProps) {
  const { companyId } = await params;

  // Load company
  const company = await getCompanyById(companyId);
  if (!company) {
    notFound();
  }

  // Fetch inspector data
  const data = await fetchInspectorData(companyId);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link
            href={`/c/${companyId}`}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            &larr; Back to Company
          </Link>
          <span className="text-slate-600">|</span>
          <Link
            href={`/c/${companyId}/admin/flow-debug`}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            Flow Debug
          </Link>
          <span className="text-slate-600">|</span>
          <span className="text-cyan-400 text-xs font-mono uppercase tracking-wide">
            Context Inspector
          </span>
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">
          Context Inspector
        </h1>
        <p className="text-slate-400 mb-8">
          {company.name} ({companyId}) &mdash; Truth-First Debugging
        </p>

        {!data ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">Failed to Load Inspector Data</h2>
            <p className="text-slate-400 mb-4">
              Unable to fetch context inspector data. Please try again.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Health Status Banner */}
            <HealthBanner health={data.health} />

            {/* Data Sources Overview */}
            <div className="grid grid-cols-3 gap-4">
              <StatCard
                label="Diagnostic Runs"
                value={data.diagnosticRuns.length}
                detail={data.diagnosticRuns.filter(r => r.status === 'completed').length + ' completed'}
                color={data.diagnosticRuns.length > 0 ? 'emerald' : 'slate'}
              />
              <StatCard
                label="GAP Runs"
                value={data.gapRuns.length}
                detail={data.gapRuns.filter(r => r.status === 'completed').length + ' completed'}
                color={data.gapRuns.length > 0 ? 'emerald' : 'slate'}
              />
              <StatCard
                label="Findings"
                value={data.findingsCount}
                detail="diagnostic findings"
                color={data.findingsCount > 0 ? 'amber' : 'slate'}
              />
            </div>

            {/* Context Graph Status */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
                Context Graph Status
              </h2>
              {data.contextGraph.exists ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-6">
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Completeness</p>
                      <div className="flex items-center gap-3">
                        <div className="w-32 h-3 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              data.contextGraph.completeness >= 70
                                ? 'bg-emerald-500'
                                : data.contextGraph.completeness >= 40
                                ? 'bg-amber-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${data.contextGraph.completeness}%` }}
                          />
                        </div>
                        <span className="text-lg font-bold text-white tabular-nums">
                          {data.contextGraph.completeness}%
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Populated Fields</p>
                      <p className="text-lg font-bold text-white tabular-nums">
                        {data.contextGraph.nodeCount}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Last Updated</p>
                      <p className="text-sm text-white">
                        {data.contextGraph.lastUpdated
                          ? formatDate(data.contextGraph.lastUpdated)
                          : 'Never'}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-2">Populated Domains</p>
                    <div className="flex flex-wrap gap-2">
                      {data.contextGraph.populatedDomains.length > 0 ? (
                        data.contextGraph.populatedDomains.map((domain) => (
                          <span
                            key={domain}
                            className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded"
                          >
                            {domain}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-500">No domains populated</span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4 bg-slate-800/50 rounded-lg p-4">
                  <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white font-medium">No Context Graph</p>
                    <p className="text-sm text-slate-400">
                      Run promotion to create a context graph from raw data.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Importers with Data */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
                Available Importers
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-400 border-b border-slate-800">
                      <th className="pb-3 pr-4">Importer</th>
                      <th className="pb-3 pr-4">Priority</th>
                      <th className="pb-3">Has Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.importers.map((importer) => (
                      <tr key={importer.id} className="border-b border-slate-800/50">
                        <td className="py-3 pr-4 font-medium text-white">
                          {importer.label}
                          <span className="text-xs text-slate-500 ml-2 font-mono">
                            {importer.id}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-slate-400">
                          {importer.priority}
                        </td>
                        <td className="py-3">
                          {importer.hasData ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400">
                              <CheckIcon /> Yes
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-slate-500">
                              <MinusIcon /> No
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Diagnostic Runs */}
            {data.diagnosticRuns.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
                  Diagnostic Runs (GAP-Heavy)
                </h2>
                <div className="space-y-3">
                  {data.diagnosticRuns.map((run) => (
                    <div
                      key={run.id}
                      className="flex items-center justify-between bg-slate-800/50 rounded-lg px-4 py-3"
                    >
                      <div>
                        <p className="text-sm text-white font-mono">{run.id}</p>
                        <p className="text-xs text-slate-400">
                          {formatDate(run.createdAt)} &middot; Status: {run.status}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {run.hasWebsiteLab && (
                          <span className="text-xs bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded">
                            Website Lab
                          </span>
                        )}
                        {run.hasBrandLab && (
                          <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded">
                            Brand Lab
                          </span>
                        )}
                        {run.hasModules && (
                          <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded">
                            Modules ({run.modulesCompleted.length})
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* GAP Runs */}
            {data.gapRuns.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
                  GAP Runs
                </h2>
                <div className="space-y-3">
                  {data.gapRuns.map((run) => (
                    <div
                      key={run.id}
                      className="flex items-center justify-between bg-slate-800/50 rounded-lg px-4 py-3"
                    >
                      <div>
                        <p className="text-sm text-white">
                          <span className="font-mono">{run.id}</span>
                          <span className="text-xs text-slate-400 ml-2">
                            ({run.type.toUpperCase()})
                          </span>
                        </p>
                        <p className="text-xs text-slate-400">
                          {formatDate(run.createdAt)} &middot; {run.domain}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {run.hasCore && (
                          <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded">
                            Core
                          </span>
                        )}
                        {run.hasInsights && (
                          <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">
                            Insights
                          </span>
                        )}
                        {run.hasDimensions && (
                          <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded">
                            Dimensions
                          </span>
                        )}
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            run.status === 'completed'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : run.status === 'error'
                              ? 'bg-red-500/20 text-red-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {run.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Promotion Action */}
            {data.health.promotionOpportunity && (
              <div className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/30 rounded-xl p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-white mb-1">
                      Promotion Opportunity Detected
                    </h2>
                    <p className="text-sm text-slate-300">
                      Raw data is available but context graph is sparse.
                      Run promotion to hydrate the context graph.
                    </p>
                  </div>
                  <PromoteButton companyId={companyId} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Components
// ============================================================================

function HealthBanner({ health }: { health: InspectorData['health'] }) {
  if (health.promotionOpportunity) {
    return (
      <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center">
          <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div>
          <p className="text-cyan-300 font-medium">Promotion Recommended</p>
          <p className="text-xs text-cyan-400/80">
            Raw data available but context graph is sparse or missing
          </p>
        </div>
      </div>
    );
  }

  if (health.isStale && health.staleDays !== null) {
    return (
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
          <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <p className="text-amber-300 font-medium">Context Graph is Stale</p>
          <p className="text-xs text-amber-400/80">
            Last updated {health.staleDays} days ago. Consider re-running hydration.
          </p>
        </div>
      </div>
    );
  }

  if (health.hasContextGraph && !health.promotionOpportunity) {
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <p className="text-emerald-300 font-medium">Context Graph is Healthy</p>
          <p className="text-xs text-emerald-400/80">
            Data is synchronized and up to date
          </p>
        </div>
      </div>
    );
  }

  return null;
}

function StatCard({
  label,
  value,
  detail,
  color,
}: {
  label: string;
  value: number;
  detail: string;
  color: 'emerald' | 'amber' | 'slate';
}) {
  const colorClasses = {
    emerald: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    amber: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    slate: 'bg-slate-800/50 border-slate-700 text-slate-400',
  };

  return (
    <div className={`rounded-xl border p-4 ${colorClasses[color]}`}>
      <p className="text-xs uppercase tracking-wide opacity-75 mb-1">{label}</p>
      <p className="text-3xl font-bold text-white tabular-nums">{value}</p>
      <p className="text-xs mt-1 opacity-75">{detail}</p>
    </div>
  );
}

function PromoteButton({ companyId }: { companyId: string }) {
  return (
    <form action={`/api/os/companies/${companyId}/context/promote`} method="POST">
      <button
        type="submit"
        className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold px-6 py-2.5 rounded-lg transition-colors flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Run Promotion
      </button>
    </form>
  );
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
    </svg>
  );
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleString();
  } catch {
    return dateStr;
  }
}
