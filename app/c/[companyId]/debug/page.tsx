// app/c/[companyId]/debug/page.tsx
// Dev-only page for inspecting a company's Context Graph
//
// Shows the full graph structure, domain coverage, refresh flags, and recent snapshots.
// Only visible in development mode.

import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getCompanyById } from '@/lib/airtable/companies';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { getNeedsRefreshReport } from '@/lib/contextGraph/needsRefresh';
import { listSnapshotSummaries } from '@/lib/contextGraph/history';
import { calculateCompleteness, calculateDomainCoverage, DOMAIN_NAMES } from '@/lib/contextGraph/companyContextGraph';

interface PageProps {
  params: Promise<{ companyId: string }>;
}

export default async function ContextGraphDebugPage({ params }: PageProps) {
  // Only show in development
  if (process.env.NODE_ENV === 'production') {
    redirect('/');
  }

  const { companyId } = await params;

  // Load company
  const company = await getCompanyById(companyId);
  if (!company) {
    notFound();
  }

  // Load context graph
  const graph = await loadContextGraph(companyId);
  const snapshots = await listSnapshotSummaries(companyId, 5);

  // Calculate stats if graph exists
  const completenessScore = graph ? calculateCompleteness(graph) : 0;
  const domainCoverage = graph ? calculateDomainCoverage(graph) : null;
  const needsRefresh = graph ? getNeedsRefreshReport(graph) : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link
            href={`/c/${companyId}`}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            &larr; Back to Company
          </Link>
          <span className="text-slate-600">|</span>
          <span className="text-amber-400 text-xs font-mono uppercase tracking-wide">
            Dev Only
          </span>
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">
          Context Graph Inspector
        </h1>
        <p className="text-slate-400 mb-8">
          {company.name} ({companyId})
        </p>

        {!graph ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">No Context Graph</h2>
            <p className="text-slate-400 mb-4">
              Run diagnostics or trigger fusion to create a context graph for this company.
            </p>
            <code className="text-xs bg-slate-800 text-slate-300 px-3 py-2 rounded">
              POST /api/context-graph {'{'} companyId: "{companyId}" {'}'}
            </code>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Stats Overview */}
            <div className="grid grid-cols-4 gap-4">
              <StatCard
                label="Completeness"
                value={`${completenessScore}%`}
                color={completenessScore >= 70 ? 'emerald' : completenessScore >= 40 ? 'amber' : 'red'}
              />
              <StatCard
                label="Schema Version"
                value={graph.meta.version}
                color="slate"
              />
              <StatCard
                label="Last Fusion"
                value={graph.meta.lastFusionAt ? formatRelativeTime(graph.meta.lastFusionAt) : 'Never'}
                color="slate"
              />
              <StatCard
                label="Stale Fields"
                value={needsRefresh?.totalStaleFields ?? 0}
                color={needsRefresh?.totalStaleFields === 0 ? 'emerald' : 'amber'}
              />
            </div>

            {/* Refresh Status */}
            {needsRefresh && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
                  Refresh Status: {needsRefresh.overallStatus}
                </h2>
                {needsRefresh.topPriorityFields.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-amber-400 mb-2">Top priority fields needing refresh:</p>
                    <div className="flex flex-wrap gap-2">
                      {needsRefresh.topPriorityFields.slice(0, 10).map((field) => (
                        <span
                          key={`${field.domain}.${field.field}`}
                          className="text-xs bg-amber-500/20 text-amber-300 px-2 py-1 rounded"
                        >
                          {field.domain}.{field.field}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Domain Coverage */}
            {domainCoverage && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
                  Domain Coverage
                </h2>
                <div className="grid grid-cols-3 gap-3">
                  {DOMAIN_NAMES.map((domain) => {
                    const coverage = domainCoverage[domain] ?? 0;
                    return (
                      <div key={domain} className="flex items-center gap-3">
                        <span className="text-xs text-slate-400 w-32 truncate capitalize">
                          {domain.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                        <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              coverage >= 70 ? 'bg-emerald-500' : coverage >= 40 ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${coverage}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500 tabular-nums w-10 text-right">
                          {coverage}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent Snapshots */}
            {snapshots.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
                  Recent Versions ({snapshots.length})
                </h2>
                <div className="space-y-2">
                  {snapshots.map((snap) => (
                    <div
                      key={snap.versionId}
                      className="flex items-center gap-4 text-xs bg-slate-800/50 rounded px-3 py-2"
                    >
                      <span className="text-slate-400 font-mono">{snap.versionId.slice(0, 12)}...</span>
                      <span className="text-slate-500">{snap.changeReason}</span>
                      <span className="text-slate-600 ml-auto">{formatRelativeTime(snap.versionAt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Full Graph JSON */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
                Full Graph JSON
              </h2>
              <pre className="text-xs bg-slate-950 rounded-lg p-4 overflow-auto max-h-[600px] text-slate-300">
                {JSON.stringify(graph, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: 'emerald' | 'amber' | 'red' | 'slate';
}) {
  const colorClasses = {
    emerald: 'bg-emerald-500/20 text-emerald-400',
    amber: 'bg-amber-500/20 text-amber-400',
    red: 'bg-red-500/20 text-red-400',
    slate: 'bg-slate-800 text-slate-300',
  };

  return (
    <div className={`rounded-xl p-4 ${colorClasses[color]}`}>
      <p className="text-xs uppercase tracking-wide opacity-75 mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  } catch {
    return dateStr;
  }
}
