'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { CompanyRecord } from '@/lib/airtable/companies';
import type { WorkItemRecord } from '@/lib/airtable/workItems';
import type { OsDiagnosticResult } from '@/lib/diagnostics/types';
import type { FullReportRecord } from '@/lib/airtable/fullReports';
import type { DiagnosticRun } from '@/lib/os/diagnostics/runs';
import { DiagnosticsPanel } from './DiagnosticsPanel';
import { CompanyAnalyticsTab } from './CompanyAnalyticsTab';
import { CompanyOpportunitiesTab } from './CompanyOpportunitiesTab';

interface CompanyDetailClientProps {
  company: CompanyRecord;
  currentTab: string;
  gapIaRuns: any[];
  gapPlanRuns: any[];
  latestOsResult: OsDiagnosticResult | null;
  fullReports: FullReportRecord[];
  workItems: WorkItemRecord[];
  latestAssessment: any;
  latestPlan: any;
  diagnosticRuns?: DiagnosticRun[];
}

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'opportunities', label: 'Opportunities' },
  { id: 'diagnostics', label: 'Diagnostics' },
  { id: 'gap', label: 'GAP' },
  { id: 'work', label: 'Work' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'notes', label: 'Notes' },
];

// Helper to format dates
const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
};

export function CompanyDetailClient({
  company,
  currentTab,
  gapIaRuns,
  gapPlanRuns,
  latestOsResult,
  fullReports,
  workItems,
  latestAssessment,
  latestPlan,
  diagnosticRuns = [],
}: CompanyDetailClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(currentTab);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    router.push(`/companies/${company.id}?tab=${tabId}`, { scroll: false });
  };

  return (
    <div>
      {/* Tab Navigation */}
      <div className="border-b border-slate-800 mb-6">
        <nav className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-slate-800 text-slate-100 border-b-2 border-amber-500'
                  : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'
              }`}
            >
              {tab.label}
              {tab.id === 'work' && workItems.length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-xs bg-slate-700 rounded">
                  {workItems.filter((w) => w.status !== 'Done').length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab
          company={company}
          latestAssessment={latestAssessment}
          latestPlan={latestPlan}
          latestOsResult={latestOsResult}
          workItems={workItems}
        />
      )}
      {activeTab === 'opportunities' && (
        <CompanyOpportunitiesTab
          companyId={company.id}
          companyName={company.name}
        />
      )}
      {activeTab === 'diagnostics' && (
        <DiagnosticsPanel
          companyId={company.id}
          companyName={company.name}
          runs={diagnosticRuns}
        />
      )}
      {activeTab === 'gap' && (
        <GapTab
          company={company}
          gapIaRuns={gapIaRuns}
          gapPlanRuns={gapPlanRuns}
          fullReports={fullReports}
        />
      )}
      {activeTab === 'work' && (
        <WorkTab company={company} workItems={workItems} />
      )}
      {activeTab === 'analytics' && (
        <CompanyAnalyticsTab
          companyId={company.id}
          companyName={company.name}
          ga4PropertyId={company.ga4PropertyId}
          searchConsoleSiteUrl={company.searchConsoleSiteUrl}
        />
      )}
      {activeTab === 'notes' && (
        <NotesTab
          company={company}
          gapIaRuns={gapIaRuns}
          gapPlanRuns={gapPlanRuns}
          workItems={workItems}
        />
      )}
    </div>
  );
}

// ============================================================================
// Overview Tab
// ============================================================================

function OverviewTab({
  company,
  latestAssessment,
  latestPlan,
  latestOsResult,
  workItems,
}: {
  company: CompanyRecord;
  latestAssessment: any;
  latestPlan: any;
  latestOsResult: OsDiagnosticResult | null;
  workItems: WorkItemRecord[];
}) {
  const activeWorkItems = workItems.filter((w) => w.status !== 'Done');

  return (
    <div className="space-y-6">
      {/* Company Info + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Basic Info */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
            Company Info
          </h3>
          <dl className="space-y-3">
            <div>
              <dt className="text-xs text-slate-500">Domain</dt>
              <dd className="text-sm text-slate-200">{company.domain}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Industry</dt>
              <dd className="text-sm text-slate-200">
                {company.industry || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Company Type</dt>
              <dd className="text-sm text-slate-200">
                {company.companyType || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Owner</dt>
              <dd className="text-sm text-slate-200">{company.owner || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Added</dt>
              <dd className="text-sm text-slate-200">
                {formatDate(company.createdAt)}
              </dd>
            </div>
          </dl>
        </div>

        {/* Latest Assessment */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
            Latest Assessment
          </h3>
          {latestAssessment ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-slate-500">
                  {formatDate(latestAssessment.createdAt)}
                </span>
                {latestAssessment.overallScore && (
                  <span className="text-lg font-bold text-amber-500">
                    {latestAssessment.overallScore}
                  </span>
                )}
              </div>
              {latestOsResult?.pillarScores && (
                <div className="space-y-2">
                  {latestOsResult.pillarScores.slice(0, 4).map((pillar) => (
                    <div
                      key={pillar.pillar}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-slate-400 capitalize">
                        {pillar.pillar}
                      </span>
                      <span className="text-slate-200">{pillar.score}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-slate-500 py-4 text-center">
              No assessments yet
            </div>
          )}
        </div>

        {/* Current Plan */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
            Current Plan
          </h3>
          {latestPlan ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-slate-500">
                  {formatDate(latestPlan.createdAt)}
                </span>
                {latestPlan.maturityStage && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/30">
                    {latestPlan.maturityStage}
                  </span>
                )}
              </div>
              <div className="text-sm text-slate-400">
                {latestPlan.status === 'completed' ? (
                  <span className="text-emerald-400">Plan ready</span>
                ) : (
                  <span className="text-blue-400">
                    {latestPlan.status || 'In progress'}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-500 py-4 text-center">
              No growth plan yet
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
          Quick Actions
        </h3>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/c/${company.id}/diagnostics`}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium rounded-lg transition-colors text-sm"
          >
            Run Diagnostics
          </Link>
          <Link
            href={`/snapshot?url=${encodeURIComponent(company.website || company.domain)}`}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg transition-colors text-sm"
          >
            Run GAP Assessment
          </Link>
          <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg transition-colors text-sm">
            Add Work Item
          </button>
          <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg transition-colors text-sm">
            Log Opportunity
          </button>
        </div>
      </div>

      {/* Active Work Preview */}
      {activeWorkItems.length > 0 && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
              Active Work ({activeWorkItems.length})
            </h3>
            <button
              onClick={() => {}}
              className="text-xs text-amber-500 hover:text-amber-400"
            >
              View All →
            </button>
          </div>
          <div className="space-y-2">
            {activeWorkItems.slice(0, 3).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-200 truncate">
                    {item.title}
                  </div>
                  {item.dueDate && (
                    <div className="text-xs text-slate-500 mt-0.5">
                      Due {formatDate(item.dueDate)}
                    </div>
                  )}
                </div>
                <span
                  className={`ml-3 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    item.status === 'In Progress'
                      ? 'bg-blue-500/10 text-blue-400'
                      : 'bg-slate-500/10 text-slate-400'
                  }`}
                >
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// GAP Tab
// ============================================================================

function GapTab({
  company,
  gapIaRuns,
  gapPlanRuns,
  fullReports,
}: {
  company: CompanyRecord;
  gapIaRuns: any[];
  gapPlanRuns: any[];
  fullReports: FullReportRecord[];
}) {
  return (
    <div className="space-y-6">
      {/* Run New Assessment Button */}
      <div className="flex justify-end">
        <Link
          href={`/snapshot?url=${encodeURIComponent(company.website || company.domain)}`}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium rounded-lg transition-colors text-sm"
        >
          Run New Assessment
        </Link>
      </div>

      {/* Assessments */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
          GAP Assessments ({gapIaRuns.length})
        </h3>
        {gapIaRuns.length === 0 ? (
          <div className="text-sm text-slate-500 py-8 text-center">
            No assessments yet. Run your first GAP assessment above.
          </div>
        ) : (
          <div className="space-y-3">
            {gapIaRuns.map((run) => (
              <div
                key={run.id}
                className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-200 font-medium">
                      {run.domain}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        run.status === 'completed'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : run.status === 'processing'
                          ? 'bg-blue-500/10 text-blue-400'
                          : 'bg-slate-500/10 text-slate-400'
                      }`}
                    >
                      {run.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {formatDate(run.createdAt)}
                  </div>
                </div>
                {run.overallScore && (
                  <span className="text-lg font-bold text-amber-500">
                    {run.overallScore}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Plans */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
          Growth Plans ({gapPlanRuns.length})
        </h3>
        {gapPlanRuns.length === 0 ? (
          <div className="text-sm text-slate-500 py-8 text-center">
            No plans generated yet.
          </div>
        ) : (
          <div className="space-y-3">
            {gapPlanRuns.map((plan) => (
              <div
                key={plan.id}
                className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-200 font-medium">
                      Growth Plan
                    </span>
                    {plan.maturityStage && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/30">
                        {plan.maturityStage}
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        plan.status === 'completed'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-slate-500/10 text-slate-400'
                      }`}
                    >
                      {plan.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {formatDate(plan.createdAt)}
                  </div>
                </div>
                {plan.overallScore && (
                  <span className="text-lg font-bold text-slate-300">
                    {plan.overallScore}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Work Tab
// ============================================================================

function WorkTab({
  company,
  workItems,
}: {
  company: CompanyRecord;
  workItems: WorkItemRecord[];
}) {
  const activeItems = workItems.filter((w) => w.status !== 'Done');
  const doneItems = workItems.filter((w) => w.status === 'Done');

  return (
    <div className="space-y-6">
      {/* Active Work */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
            Active Work ({activeItems.length})
          </h3>
          <button className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium rounded-lg transition-colors text-xs">
            Add Work Item
          </button>
        </div>
        {activeItems.length === 0 ? (
          <div className="text-sm text-slate-500 py-8 text-center">
            No active work items. Add work from priorities or create manually.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-400 uppercase">
                    Title
                  </th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-400 uppercase">
                    Area
                  </th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-400 uppercase">
                    Status
                  </th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-400 uppercase">
                    Due
                  </th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-400 uppercase">
                    Owner
                  </th>
                </tr>
              </thead>
              <tbody>
                {activeItems.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-slate-800/50 hover:bg-slate-800/30"
                  >
                    <td className="px-3 py-3 text-slate-200">{item.title}</td>
                    <td className="px-3 py-3 text-slate-400 text-xs">
                      {item.area || '—'}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          item.status === 'In Progress'
                            ? 'bg-blue-500/10 text-blue-400'
                            : item.status === 'Planned'
                            ? 'bg-purple-500/10 text-purple-400'
                            : 'bg-slate-500/10 text-slate-400'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-400 text-xs">
                      {formatDate(item.dueDate)}
                    </td>
                    <td className="px-3 py-3 text-slate-400 text-xs">
                      {item.owner || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Completed Work */}
      {doneItems.length > 0 && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
            Completed ({doneItems.length})
          </h3>
          <div className="space-y-2">
            {doneItems.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg opacity-70"
              >
                <span className="text-sm text-slate-400 line-through">
                  {item.title}
                </span>
                <span className="text-xs text-emerald-500">Done</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Notes Tab
// ============================================================================

function NotesTab({
  company,
  gapIaRuns,
  gapPlanRuns,
  workItems,
}: {
  company: CompanyRecord;
  gapIaRuns: any[];
  gapPlanRuns: any[];
  workItems: WorkItemRecord[];
}) {
  // Build timeline from all activities
  type TimelineItem = {
    type: 'gap-ia' | 'gap-plan' | 'work' | 'note';
    title: string;
    subtitle?: string;
    timestamp: string;
    status?: string;
  };

  const timeline: TimelineItem[] = [];

  // Add GAP IA runs
  gapIaRuns.forEach((run) => {
    timeline.push({
      type: 'gap-ia',
      title: 'GAP Assessment',
      subtitle: run.status === 'completed' ? `Score: ${run.overallScore || '—'}` : undefined,
      timestamp: run.createdAt,
      status: run.status,
    });
  });

  // Add GAP Plan runs
  gapPlanRuns.forEach((plan) => {
    timeline.push({
      type: 'gap-plan',
      title: 'Growth Plan Generated',
      subtitle: plan.maturityStage,
      timestamp: plan.createdAt,
      status: plan.status,
    });
  });

  // Add work items
  workItems.forEach((item) => {
    timeline.push({
      type: 'work',
      title: item.title,
      subtitle: item.area,
      timestamp: item.createdAt || '',
      status: item.status,
    });
  });

  // Sort by timestamp (newest first)
  timeline.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="space-y-6">
      {/* Internal Notes */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
          Internal Notes
        </h3>
        {company.internalNotes || company.notes ? (
          <div className="text-sm text-slate-300 whitespace-pre-wrap">
            {company.internalNotes || company.notes}
          </div>
        ) : (
          <div className="text-sm text-slate-500 py-4 text-center">
            No notes yet. Add notes from the company settings.
          </div>
        )}
      </div>

      {/* Activity Timeline */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
          Activity Timeline
        </h3>
        {timeline.length === 0 ? (
          <div className="text-sm text-slate-500 py-8 text-center">
            No activity yet
          </div>
        ) : (
          <div className="space-y-4">
            {timeline.slice(0, 20).map((item, index) => (
              <div key={index} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      item.type === 'gap-ia'
                        ? 'bg-amber-500'
                        : item.type === 'gap-plan'
                        ? 'bg-purple-500'
                        : 'bg-blue-500'
                    }`}
                  />
                  {index < timeline.length - 1 && (
                    <div className="w-px h-full bg-slate-800 mt-2" />
                  )}
                </div>
                <div className="flex-1 pb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-200">{item.title}</span>
                    {item.status && (
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          item.status === 'completed' || item.status === 'Done'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-slate-500/10 text-slate-400'
                        }`}
                      >
                        {item.status}
                      </span>
                    )}
                  </div>
                  {item.subtitle && (
                    <div className="text-xs text-slate-500 mt-0.5">
                      {item.subtitle}
                    </div>
                  )}
                  <div className="text-xs text-slate-600 mt-1">
                    {formatDate(item.timestamp)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
