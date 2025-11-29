'use client';

// components/os/TodayDashboardClient.tsx
// Client component for AI-enhanced Daily Briefing

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { DailyBriefingV2, BriefingItem, BriefingPriority } from '@/lib/intelligence/dailyBriefing';

export function TodayDashboardClient() {
  const [data, setData] = useState<DailyBriefingV2 | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBriefing = useCallback(async (forceRefresh = false) => {
    try {
      if (forceRefresh) setRefreshing(true);
      else setLoading(true);

      const url = forceRefresh
        ? '/api/briefing/daily?refresh=true'
        : '/api/briefing/daily';

      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch briefing');
      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load briefing');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchBriefing();
  }, [fetchBriefing]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400 mx-auto mb-4" />
          <p className="text-slate-400">Generating today&apos;s briefing...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
        <p className="text-red-400 font-medium">Error loading daily briefing</p>
        <p className="text-slate-400 text-sm mt-2">{error || 'Unknown error'}</p>
        <button
          onClick={() => fetchBriefing(true)}
          className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Refresh Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {data.aiGenerated && (
            <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">
              AI-Enhanced
            </span>
          )}
          <span className="text-xs text-slate-500">
            Updated {new Date(data.generatedAt).toLocaleTimeString()}
          </span>
        </div>
        <button
          onClick={() => fetchBriefing(true)}
          disabled={refreshing}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
        >
          <svg
            className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Band 1: Overnight Summary */}
      <OvernightSummaryCard summary={data.overnightSummary} />

      {/* Band 2: Today's Focus Plan */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FocusListCard
          title="Key Actions"
          items={data.focusPlan.keyActions}
          icon="target"
          accentColor="amber"
        />
        <FocusListCard
          title="Quick Wins"
          items={data.focusPlan.quickWins}
          icon="bolt"
          accentColor="emerald"
        />
        <FocusListCard
          title="Risks to Address"
          items={data.focusPlan.risks}
          icon="warning"
          accentColor="red"
        />
        <FocusListCard
          title="Outreach Tasks"
          items={data.focusPlan.outreachTasks}
          icon="phone"
          accentColor="blue"
        />
      </div>

      {/* Band 3: Priority Queue + Pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PriorityQueueCard items={data.priorityQueue} />
        <PipelineHighlightsCard pipeline={data.pipelineHighlights} />
      </div>

      {/* Band 4: Diagnostic Review Queue */}
      {data.diagnosticReviewQueue.length > 0 && (
        <DiagnosticReviewCard items={data.diagnosticReviewQueue} />
      )}

      {/* Band 5: Yesterday Activity */}
      <YesterdayActivityCard activity={data.yesterdayActivity} />

      {/* Band 6: Owner Issues */}
      {data.ownerIssues.length > 0 && (
        <OwnerIssuesCard issues={data.ownerIssues} />
      )}

      {/* Band 7: Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <QuickActionButton
          href="/analytics/os"
          icon="chart"
          label="View OS Health"
          variant="primary"
        />
        <QuickActionButton
          href="/companies?filter=at-risk"
          icon="warning"
          label="At-Risk Companies"
          variant="danger"
        />
        <QuickActionButton
          href="/work"
          icon="tasks"
          label="View Work Board"
          variant="default"
        />
        <QuickActionButton
          href="/c/new"
          icon="plus"
          label="Add Company"
          variant="success"
        />
      </div>
    </div>
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

function OvernightSummaryCard({ summary }: { summary: DailyBriefingV2['overnightSummary'] }) {
  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-xl p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-amber-500/20 rounded-lg">
            <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-slate-100">Good Morning</h2>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <Stat label="Created" value={summary.workCreated} />
          <Stat label="Completed" value={summary.workCompleted} />
          <Stat label="Diagnostics" value={summary.diagnosticsRun} />
        </div>
      </div>

      <p className="text-slate-200 text-lg mb-4">{summary.headline}</p>

      {summary.highlights.length > 0 && (
        <ul className="space-y-2">
          {summary.highlights.map((highlight, idx) => (
            <li key={idx} className="flex items-center gap-2 text-sm text-slate-400">
              <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
              {highlight}
            </li>
          ))}
        </ul>
      )}

      {summary.atRiskChanges.length > 0 && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-xs text-red-400 font-medium mb-1">Attention Required</p>
          <ul className="space-y-1">
            {summary.atRiskChanges.map((change, idx) => (
              <li key={idx} className="text-sm text-red-300">{change}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-2xl font-bold text-slate-100">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function FocusListCard({
  title,
  items,
  icon,
  accentColor,
}: {
  title: string;
  items: BriefingItem[];
  icon: 'target' | 'bolt' | 'warning' | 'phone';
  accentColor: 'amber' | 'emerald' | 'red' | 'blue';
}) {
  const colorClasses = {
    amber: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    emerald: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    red: 'bg-red-500/10 border-red-500/30 text-red-400',
    blue: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
  };

  const icons = {
    target: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />,
    bolt: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />,
    warning: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />,
    phone: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />,
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className={`border-b px-4 py-3 flex items-center gap-2 ${colorClasses[accentColor]}`}>
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {icons[icon]}
        </svg>
        <h3 className="font-semibold text-slate-100">{title}</h3>
        <span className="ml-auto text-xs text-slate-400">{items.length} items</span>
      </div>

      <div className="divide-y divide-slate-800">
        {items.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-slate-500">
            No items
          </div>
        ) : (
          items.map((item) => (
            <FocusItemRow key={item.id} item={item} />
          ))
        )}
      </div>
    </div>
  );
}

function FocusItemRow({ item }: { item: BriefingItem }) {
  const priorityColors: Record<BriefingPriority, string> = {
    critical: 'bg-red-500 text-white',
    high: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
    medium: 'bg-slate-700 text-slate-300',
    low: 'bg-slate-800 text-slate-400',
  };

  const content = (
    <div className="px-4 py-3 hover:bg-slate-800/50 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-200 truncate">{item.title}</p>
          {item.description && (
            <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{item.description}</p>
          )}
          {item.companyName && (
            <p className="text-xs text-slate-500 mt-1">{item.companyName}</p>
          )}
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${priorityColors[item.priority]}`}>
          {item.priority}
        </span>
      </div>
    </div>
  );

  if (item.linkHref) {
    return <Link href={item.linkHref} className="block">{content}</Link>;
  }

  return content;
}

function PriorityQueueCard({ items }: { items: DailyBriefingV2['priorityQueue'] }) {
  const severityColors: Record<BriefingPriority, string> = {
    critical: 'border-l-red-500 bg-red-500/5',
    high: 'border-l-amber-500 bg-amber-500/5',
    medium: 'border-l-blue-500',
    low: 'border-l-slate-600',
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="font-semibold text-slate-100">Priority Queue</h3>
        </div>
        <span className="text-xs text-slate-400">{items.length} companies</span>
      </div>

      <div className="divide-y divide-slate-800">
        {items.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-slate-500">
            No priority items - all clear!
          </div>
        ) : (
          items.map((item) => (
            <Link
              key={item.companyId}
              href={`/c/${item.companyId}`}
              className={`block px-4 py-3 hover:bg-slate-800/50 transition-colors border-l-4 ${severityColors[item.severity]}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-200">{item.companyName}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{item.reason}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  item.severity === 'critical' ? 'bg-red-500/20 text-red-300 border border-red-500/40' :
                  item.severity === 'high' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                  'bg-slate-700 text-slate-300'
                }`}>
                  {item.severity}
                </span>
              </div>
              {item.issues.length > 1 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {item.issues.slice(1).map((issue, idx) => (
                    <span key={idx} className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded">
                      {issue}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

function PipelineHighlightsCard({ pipeline }: { pipeline: DailyBriefingV2['pipelineHighlights'] }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="bg-emerald-500/10 border-b border-emerald-500/30 px-4 py-3 flex items-center gap-2">
        <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
        <h3 className="font-semibold text-slate-100">Pipeline</h3>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-slate-800/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-emerald-400">{pipeline.newLeads}</p>
            <p className="text-xs text-slate-400">New Leads (7d)</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-blue-400">{pipeline.qualifiedProspects}</p>
            <p className="text-xs text-slate-400">Qualified Prospects</p>
          </div>
        </div>

        {pipeline.readyToClose.length > 0 && (
          <div>
            <p className="text-xs text-slate-500 mb-2">Ready to Convert</p>
            <div className="space-y-2">
              {pipeline.readyToClose.map((item) => (
                <Link
                  key={item.companyId}
                  href={`/c/${item.companyId}`}
                  className="block p-2 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <p className="text-sm font-medium text-slate-200">{item.companyName}</p>
                  <p className="text-xs text-slate-400">{item.reason}</p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DiagnosticReviewCard({ items }: { items: DailyBriefingV2['diagnosticReviewQueue'] }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="bg-blue-500/10 border-b border-blue-500/30 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <h3 className="font-semibold text-slate-100">Diagnostic Review Queue</h3>
        </div>
        <span className="text-xs text-slate-400">{items.length} pending</span>
      </div>

      <div className="divide-y divide-slate-800">
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/c/${item.companyId}?tab=diagnostics`}
            className="block px-4 py-3 hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-200">{item.companyName}</p>
                <p className="text-xs text-slate-400 mt-0.5">{item.toolName}</p>
              </div>
              <div className="flex items-center gap-3">
                {item.score !== undefined && (
                  <span className={`text-sm font-bold ${
                    item.score >= 70 ? 'text-emerald-400' :
                    item.score >= 50 ? 'text-amber-400' :
                    'text-red-400'
                  }`}>
                    {item.score}
                  </span>
                )}
                <span className="text-xs text-slate-500">
                  {new Date(item.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function YesterdayActivityCard({ activity }: { activity: DailyBriefingV2['yesterdayActivity'] }) {
  const activities = [
    { label: 'Work Created', value: activity.workCreated, color: 'bg-blue-500' },
    { label: 'Work Completed', value: activity.workCompleted, color: 'bg-emerald-500' },
    { label: 'Diagnostics Run', value: activity.diagnosticsRun, color: 'bg-amber-500' },
    { label: 'Plans Generated', value: activity.plansGenerated, color: 'bg-purple-500' },
  ];

  const maxValue = Math.max(...activities.map(a => a.value), 1);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-6">
        <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <h3 className="font-semibold text-slate-100">Yesterday&apos;s Activity</h3>
      </div>

      <div className="space-y-4">
        {activities.map((activity) => (
          <div key={activity.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-slate-400">{activity.label}</span>
              <span className="text-sm font-medium text-slate-200">{activity.value}</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full ${activity.color} rounded-full transition-all duration-500`}
                style={{ width: `${(activity.value / maxValue) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OwnerIssuesCard({ issues }: { issues: DailyBriefingV2['ownerIssues'] }) {
  const typeLabels: Record<DailyBriefingV2['ownerIssues'][0]['type'], string> = {
    no_owner: 'No Owner',
    no_strategist: 'No Strategist',
    stalled: 'Stalled',
    old_plan: 'Old Plan',
  };

  const typeColors: Record<DailyBriefingV2['ownerIssues'][0]['type'], string> = {
    no_owner: 'bg-red-500/20 text-red-300 border-red-500/40',
    no_strategist: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    stalled: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    old_plan: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <h3 className="font-semibold text-slate-100">Owner/Assignment Issues</h3>
        </div>
        <span className="text-xs text-slate-400">{issues.length} issues</span>
      </div>

      <div className="divide-y divide-slate-800">
        {issues.map((issue, idx) => (
          <Link
            key={`${issue.companyId}-${idx}`}
            href={`/c/${issue.companyId}`}
            className="block px-4 py-3 hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-200">{issue.companyName}</p>
                <p className="text-xs text-slate-400 mt-0.5">{issue.description}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${typeColors[issue.type]}`}>
                {typeLabels[issue.type]}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function QuickActionButton({
  href,
  icon,
  label,
  variant = 'default',
}: {
  href: string;
  icon: 'chart' | 'warning' | 'tasks' | 'plus';
  label: string;
  variant?: 'default' | 'primary' | 'danger' | 'success';
}) {
  const variantStyles = {
    default: 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700',
    primary: 'bg-amber-500/20 border-amber-500/40 text-amber-200 hover:bg-amber-500/30',
    danger: 'bg-red-500/20 border-red-500/40 text-red-200 hover:bg-red-500/30',
    success: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/30',
  };

  const icons = {
    chart: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    warning: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    tasks: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    plus: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    ),
  };

  return (
    <Link
      href={href}
      className={`flex flex-col items-center justify-center gap-2 p-4 border rounded-xl transition-colors ${variantStyles[variant]}`}
    >
      {icons[icon]}
      <span className="text-sm font-medium">{label}</span>
    </Link>
  );
}

export default TodayDashboardClient;
