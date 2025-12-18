// app/c/[companyId]/admin/flow-debug/page.tsx
// Flow System Debug Panel
//
// Internal admin page for inspecting flow readiness, domain coverage,
// recent flow events, and blocked writes.
//
// Protected by FLOW_SYSTEM_DEBUG_UI feature flag (or dev mode fallback).

import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getCompanyById } from '@/lib/airtable/companies';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { FEATURE_FLAGS } from '@/lib/config/featureFlags';
import {
  checkFlowReadinessFromGraph,
  getFlowDisplayName,
  type FlowType,
  type FlowReadiness,
} from '@/lib/os/flow/readiness';
import { calculateDomainCoverage, DOMAIN_NAMES } from '@/lib/contextGraph/companyContextGraph';
import { FLOW_EVENT_TYPE_VALUES } from '@/lib/observability/flowEvents';

interface PageProps {
  params: Promise<{ companyId: string }>;
}

const FLOW_TYPES: FlowType[] = ['strategy', 'gap_ia', 'gap_full', 'programs', 'website_optimization'];

export default async function FlowDebugPage({ params }: PageProps) {
  // Check feature flag (allow dev mode as fallback)
  if (!FEATURE_FLAGS.FLOW_SYSTEM_DEBUG_UI && process.env.NODE_ENV === 'production') {
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

  // Calculate flow readiness for each flow type
  const flowReadiness: Record<FlowType, FlowReadiness | null> = {
    strategy: null,
    gap_ia: null,
    gap_full: null,
    programs: null,
    website_optimization: null,
  };

  if (graph) {
    for (const flowType of FLOW_TYPES) {
      flowReadiness[flowType] = checkFlowReadinessFromGraph(graph, flowType, companyId);
    }
  }

  // Calculate domain coverage
  const domainCoverage = graph ? calculateDomainCoverage(graph) : null;

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
            href={`/c/${companyId}/debug`}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            Context Graph Debug
          </Link>
          <span className="text-slate-600">|</span>
          <span className="text-purple-400 text-xs font-mono uppercase tracking-wide">
            Flow Debug
          </span>
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">
          Flow System Debug Panel
        </h1>
        <p className="text-slate-400 mb-8">
          {company.name} ({companyId})
        </p>

        {!graph ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">No Context Graph</h2>
            <p className="text-slate-400 mb-4">
              Create a context graph first to see flow readiness.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Flow Readiness Snapshot */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
                Flow Readiness Snapshot
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-400 border-b border-slate-800">
                      <th className="pb-3 pr-4">Flow</th>
                      <th className="pb-3 pr-4">Ready</th>
                      <th className="pb-3 pr-4">Completeness</th>
                      <th className="pb-3 pr-4">Missing Critical</th>
                      <th className="pb-3">Missing Recommended</th>
                    </tr>
                  </thead>
                  <tbody>
                    {FLOW_TYPES.map((flowType) => {
                      const readiness = flowReadiness[flowType];
                      return (
                        <tr key={flowType} className="border-b border-slate-800/50">
                          <td className="py-3 pr-4 font-medium text-white">
                            {getFlowDisplayName(flowType)}
                          </td>
                          <td className="py-3 pr-4">
                            {readiness?.isReady ? (
                              <span className="inline-flex items-center gap-1 text-emerald-400">
                                <CheckIcon /> Ready
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-red-400">
                                <XIcon /> Blocked
                              </span>
                            )}
                          </td>
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              <div className="w-24 h-2 rounded-full bg-slate-800 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    (readiness?.completenessPercent ?? 0) >= 100
                                      ? 'bg-emerald-500'
                                      : (readiness?.completenessPercent ?? 0) >= 50
                                      ? 'bg-amber-500'
                                      : 'bg-red-500'
                                  }`}
                                  style={{ width: `${readiness?.completenessPercent ?? 0}%` }}
                                />
                              </div>
                              <span className="text-xs text-slate-400 tabular-nums">
                                {readiness?.completenessPercent ?? 0}%
                              </span>
                            </div>
                          </td>
                          <td className="py-3 pr-4">
                            {readiness?.missingCritical.length ? (
                              <div className="flex flex-wrap gap-1">
                                {readiness.missingCritical.map((r) => (
                                  <span
                                    key={r.domain}
                                    className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded"
                                  >
                                    {r.label}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-500 text-xs">None</span>
                            )}
                          </td>
                          <td className="py-3">
                            {readiness?.missingRecommended.length ? (
                              <div className="flex flex-wrap gap-1">
                                {readiness.missingRecommended.map((r) => (
                                  <span
                                    key={r.domain}
                                    className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded"
                                  >
                                    {r.label}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-500 text-xs">None</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Domain Coverage Grid */}
            {domainCoverage && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
                  Domain Coverage
                </h2>
                <div className="grid grid-cols-4 gap-3">
                  {DOMAIN_NAMES.map((domain) => {
                    const coverage = domainCoverage[domain] ?? 0;
                    const colorClass =
                      coverage >= 80
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : coverage >= 40
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        : 'bg-red-500/20 text-red-400 border-red-500/30';

                    return (
                      <div
                        key={domain}
                        className={`rounded-lg border p-3 ${colorClass}`}
                      >
                        <p className="text-xs uppercase tracking-wide opacity-75 mb-1 truncate">
                          {domain.replace(/([A-Z])/g, ' $1').trim()}
                        </p>
                        <p className="text-xl font-bold tabular-nums">{coverage}%</p>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-6 mt-4 text-xs text-slate-500">
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded bg-emerald-500" /> &gt;80% (Good)
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded bg-amber-500" /> 40-80% (Partial)
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded bg-red-500" /> &lt;40% (Missing)
                  </span>
                </div>
              </div>
            )}

            {/* Lab CTAs */}
            {flowReadiness.strategy?.labCTAs && flowReadiness.strategy.labCTAs.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
                  Recommended Actions
                </h2>
                <div className="space-y-2">
                  {flowReadiness.strategy.labCTAs.map((cta) => (
                    <div
                      key={cta.labKey}
                      className="flex items-center justify-between bg-slate-800/50 rounded-lg px-4 py-3"
                    >
                      <div>
                        <p className="text-sm text-white font-medium">{cta.labName}</p>
                        <p className="text-xs text-slate-400">{cta.description}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            cta.priority === 'critical'
                              ? 'bg-red-500/20 text-red-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {cta.priority}
                        </span>
                        <Link
                          href={cta.href}
                          className="text-xs bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 px-3 py-1.5 rounded transition-colors"
                        >
                          Run Lab
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Flow Event Types Reference */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
                Tracked Flow Event Types
              </h2>
              <p className="text-xs text-slate-400 mb-3">
                These events are logged to the Hive Events table for observability.
              </p>
              <div className="flex flex-wrap gap-2">
                {FLOW_EVENT_TYPE_VALUES.map((eventType) => (
                  <span
                    key={eventType}
                    className="text-xs bg-slate-800 text-slate-300 px-2 py-1 rounded font-mono"
                  >
                    {eventType}
                  </span>
                ))}
              </div>
            </div>

            {/* Graph Meta */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
                Graph Metadata
              </h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500 text-xs mb-1">Company ID</p>
                  <p className="text-white font-mono">{graph.companyId}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs mb-1">Schema Version</p>
                  <p className="text-white font-mono">{graph.meta.version}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs mb-1">Last Updated</p>
                  <p className="text-white">{formatDate(graph.meta.updatedAt)}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs mb-1">Last Fusion</p>
                  <p className="text-white">
                    {graph.meta.lastFusionAt ? formatDate(graph.meta.lastFusionAt) : 'Never'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
