'use client';

// components/os/TodayIntelligenceDashboard.tsx
// Enhanced Today Dashboard with Intelligence-driven insights

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  OvernightSummary,
  DailyFocusList,
  PriorityCompanyList,
} from '@/components/intelligence';
import type { DailyBriefing, DiagnosticReviewItem, OwnerIssue } from '@/lib/intelligence/types';

export function TodayIntelligenceDashboard() {
  const [data, setData] = useState<DailyBriefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/os/today');
        if (!response.ok) throw new Error('Failed to fetch daily briefing');
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400 mx-auto mb-4" />
          <p className="text-slate-400">Loading today&apos;s briefing...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
        <p className="text-red-400 font-medium">Error loading daily briefing</p>
        <p className="text-slate-400 text-sm mt-2">{error || 'Unknown error'}</p>
      </div>
    );
  }

  const { overnightSummary, focusPlan, priorityQueue, diagnosticReviewQueue, yesterdayActivity, ownerIssues } = data;

  return (
    <div className="space-y-8">
      {/* ================================================================== */}
      {/* Band 1: Overnight Summary */}
      {/* ================================================================== */}
      <OvernightSummary summary={overnightSummary} />

      {/* ================================================================== */}
      {/* Band 2: Today's Focus Plan */}
      {/* ================================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <DailyFocusList
          title="Key Actions"
          items={focusPlan.keyActions}
          variant="actions"
        />
        <DailyFocusList
          title="Quick Wins"
          items={focusPlan.quickWins}
          variant="wins"
        />
        <DailyFocusList
          title="Risks to Monitor"
          items={focusPlan.risks}
          variant="risks"
        />
        <DailyFocusList
          title="Outreach Tasks"
          items={focusPlan.outreachTasks}
          variant="outreach"
        />
      </div>

      {/* ================================================================== */}
      {/* Band 3: High Priority Queue + Diagnostic Review */}
      {/* ================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PriorityCompanyList
          companies={priorityQueue}
          title="High Priority Queue"
        />

        <DiagnosticReviewQueue items={diagnosticReviewQueue} />
      </div>

      {/* ================================================================== */}
      {/* Band 4: Yesterday's Activity Heatmap */}
      {/* ================================================================== */}
      <YesterdayActivityCard activity={yesterdayActivity} />

      {/* ================================================================== */}
      {/* Band 5: Owner/Assignment Issues */}
      {/* ================================================================== */}
      {ownerIssues.length > 0 && (
        <OwnerIssuesCard issues={ownerIssues} />
      )}

      {/* ================================================================== */}
      {/* Band 6: Quick Actions */}
      {/* ================================================================== */}
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
// Helper Components
// ============================================================================

function DiagnosticReviewQueue({ items }: { items: DiagnosticReviewItem[] }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="bg-blue-500/10 border-b border-blue-500/30 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
            />
          </svg>
          <h3 className="font-semibold text-slate-100">Diagnostic Review Queue</h3>
        </div>
        <span className="text-xs text-slate-400">{items.length} pending</span>
      </div>

      <div className="divide-y divide-slate-800">
        {items.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <svg className="w-12 h-12 text-slate-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-slate-500">No diagnostics pending review</p>
          </div>
        ) : (
          items.map((item) => (
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
          ))
        )}
      </div>
    </div>
  );
}

function YesterdayActivityCard({ activity }: { activity: DailyBriefing['yesterdayActivity'] }) {
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

function OwnerIssuesCard({ issues }: { issues: OwnerIssue[] }) {
  const typeLabels: Record<OwnerIssue['type'], string> = {
    no_owner: 'No Owner',
    no_strategist: 'No Strategist',
    stalled: 'Stalled',
    old_plan: 'Old Plan',
  };

  const typeColors: Record<OwnerIssue['type'], string> = {
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
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
            />
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

export default TodayIntelligenceDashboard;
