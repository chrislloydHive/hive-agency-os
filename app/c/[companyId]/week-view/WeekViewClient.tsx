'use client';

// app/c/[companyId]/week-view/WeekViewClient.tsx
// Week View Dashboard Client Component
//
// Single daily/weekly home base for Car Toys programs showing:
// - This Week Deliverables
// - Overdue Deliverables
// - Recently Created Work
// - Scope Drift Summary (from ScopeDriftDetectorPanel)
// - Program Health Summary
// - Approvals Needed
//
// Key Features:
// - "Sync Deliverables" triggers Inngest job for upcoming deliverables
// - Approvals section connected to real approvals inbox

import { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Calendar,
  AlertTriangle,
  Clock,
  Target,
  Activity,
  CheckCircle2,
  ChevronRight,
  RefreshCw,
  ArrowRight,
  Package,
  TrendingUp,
  Shield,
  Loader2,
  Zap,
  XCircle,
} from 'lucide-react';
import type { PlanningProgram, PlanningDeliverable } from '@/lib/types/program';
import type { WorkItemRecord } from '@/lib/airtable/workItems';
import {
  calculateProgramHealth,
  calculateCompanyCapacity,
  getHealthBadgeStyle,
  getLoadBadgeStyle,
  type HealthStatus,
} from '@/lib/os/programs/programHealth';
import { RunbookPanel } from '@/components/os/programs/RunbookPanel';
import { RecurrenceHealthPanel } from '@/components/os/programs/RecurrenceHealthPanel';
import { WeeklyBriefPanel } from '@/components/os/weekview/WeeklyBriefPanel';

// ============================================================================
// Types
// ============================================================================

interface WeekViewClientProps {
  companyId: string;
  programs: PlanningProgram[];
  workItems: WorkItemRecord[];
}

interface DeliverableWithProgram {
  deliverable: PlanningDeliverable;
  program: PlanningProgram;
  daysUntilDue: number;
}

// ============================================================================
// Main Component
// ============================================================================

export function WeekViewClient({
  companyId,
  programs,
  workItems,
}: WeekViewClientProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    success: boolean;
    message: string;
    debugId?: string;
  } | null>(null);

  // Trigger Inngest job for ensuring upcoming deliverables
  const handleSyncDeliverables = useCallback(async () => {
    setIsSyncing(true);
    setSyncResult(null);

    try {
      const response = await fetch('/api/inngest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'os/ensure-upcoming-deliverables.requested',
          data: {
            companyId,
            requestedBy: 'week-view-ui',
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to trigger sync');
      }

      const result = await response.json();
      setSyncResult({
        success: true,
        message: 'Sync started! Deliverables will be created shortly.',
        debugId: result.ids?.[0],
      });

      // Clear success message after 5 seconds
      setTimeout(() => setSyncResult(null), 5000);
    } catch (error) {
      setSyncResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to sync',
      });
    } finally {
      setIsSyncing(false);
    }
  }, [companyId]);

  // Calculate dates
  const now = new Date();
  const sevenDaysFromNow = new Date(now);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // ============================================================================
  // Compute Deliverables Due This Week & Overdue
  // ============================================================================

  const { thisWeekDeliverables, overdueDeliverables } = useMemo(() => {
    const thisWeek: DeliverableWithProgram[] = [];
    const overdue: DeliverableWithProgram[] = [];

    for (const program of programs) {
      if (program.status === 'archived') continue;

      const deliverables = program.scope?.deliverables || [];
      for (const deliverable of deliverables) {
        if (!deliverable.dueDate || deliverable.status === 'completed') continue;

        const dueDate = new Date(deliverable.dueDate);
        const daysUntilDue = Math.ceil(
          (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (dueDate < now) {
          overdue.push({ deliverable, program, daysUntilDue });
        } else if (dueDate <= sevenDaysFromNow) {
          thisWeek.push({ deliverable, program, daysUntilDue });
        }
      }
    }

    // Sort by due date
    thisWeek.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
    overdue.sort((a, b) => a.daysUntilDue - b.daysUntilDue);

    return { thisWeekDeliverables: thisWeek, overdueDeliverables: overdue };
  }, [programs, now, sevenDaysFromNow]);

  // ============================================================================
  // Recent Work Items (created in last 7 days)
  // ============================================================================

  const recentWorkItems = useMemo(() => {
    return workItems
      .filter((w) => {
        if (!w.createdAt) return false;
        const createdDate = new Date(w.createdAt);
        return createdDate >= sevenDaysAgo;
      })
      .sort((a, b) => {
        const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bDate - aDate;
      })
      .slice(0, 10);
  }, [workItems, sevenDaysAgo]);

  // ============================================================================
  // Program Health Summary
  // ============================================================================

  const healthSnapshots = useMemo(() => {
    return programs
      .filter((p) => p.status !== 'archived')
      .map((p) => calculateProgramHealth(p, workItems));
  }, [programs, workItems]);

  const capacitySummary = useMemo(() => {
    return calculateCompanyCapacity(programs.filter((p) => p.status !== 'archived'));
  }, [programs]);

  const healthCounts = useMemo(() => {
    const counts: Record<HealthStatus, number> = {
      Healthy: 0,
      Attention: 0,
      'At Risk': 0,
    };
    for (const snapshot of healthSnapshots) {
      counts[snapshot.status]++;
    }
    return counts;
  }, [healthSnapshots]);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Calendar className="w-7 h-7 text-amber-400" />
            Week View
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Your weekly dashboard for programs and deliverables
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Sync Deliverables Button */}
          <button
            onClick={handleSyncDeliverables}
            disabled={isSyncing}
            className="flex items-center gap-2 px-3 py-2 text-sm text-amber-300 hover:text-amber-200 hover:bg-amber-900/30 border border-amber-700/50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSyncing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            <span>{isSyncing ? 'Syncing...' : 'Sync Deliverables'}</span>
          </button>
          {/* Refresh Button */}
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-800"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Sync Result Toast */}
      {syncResult && (
        <div
          className={`flex items-center gap-3 p-3 rounded-lg ${
            syncResult.success
              ? 'bg-emerald-900/30 border border-emerald-700/50 text-emerald-300'
              : 'bg-red-900/30 border border-red-700/50 text-red-300'
          }`}
        >
          {syncResult.success ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          ) : (
            <XCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <span className="text-sm">{syncResult.message}</span>
          {syncResult.debugId && (
            <span className="text-xs opacity-75">ID: {syncResult.debugId}</span>
          )}
        </div>
      )}

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<Clock className="w-5 h-5 text-amber-400" />}
          label="Due This Week"
          value={thisWeekDeliverables.length}
          subtext={`${overdueDeliverables.length} overdue`}
          variant={overdueDeliverables.length > 0 ? 'warning' : 'default'}
        />
        <StatCard
          icon={<Activity className="w-5 h-5 text-blue-400" />}
          label="In Progress"
          value={workItems.filter((w) => w.status === 'In Progress').length}
          subtext={`of ${workItems.length} total`}
        />
        <StatCard
          icon={<Target className="w-5 h-5 text-emerald-400" />}
          label="Programs"
          value={healthCounts['Healthy']}
          subtext={`${healthCounts['Attention'] + healthCounts['At Risk']} need attention`}
          variant={healthCounts['At Risk'] > 0 ? 'warning' : 'default'}
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5 text-purple-400" />}
          label="Capacity"
          value={capacitySummary.totalLoadScore}
          subtext={`${capacitySummary.estimatedWeeklyLoad} load`}
          variant={capacitySummary.warningThreshold ? 'warning' : 'default'}
        />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Weekly Brief - Monday Morning Summary */}
          <WeeklyBriefPanel companyId={companyId} />

          {/* This Week Deliverables */}
          <SectionCard
            title="Due This Week"
            icon={<Clock className="w-5 h-5" />}
            iconBg="bg-amber-500/10"
            iconColor="text-amber-400"
            count={thisWeekDeliverables.length}
            emptyMessage="No deliverables due this week"
          >
            {thisWeekDeliverables.slice(0, 5).map(({ deliverable, program, daysUntilDue }) => (
              <DeliverableRow
                key={deliverable.id}
                deliverable={deliverable}
                program={program}
                daysUntilDue={daysUntilDue}
                companyId={companyId}
              />
            ))}
            {thisWeekDeliverables.length > 5 && (
              <MoreLink
                href={`/c/${companyId}/deliver?filter=due_soon`}
                count={thisWeekDeliverables.length - 5}
              />
            )}
          </SectionCard>

          {/* Overdue Deliverables */}
          {overdueDeliverables.length > 0 && (
            <SectionCard
              title="Overdue"
              icon={<AlertTriangle className="w-5 h-5" />}
              iconBg="bg-red-500/10"
              iconColor="text-red-400"
              count={overdueDeliverables.length}
              variant="danger"
            >
              {overdueDeliverables.slice(0, 5).map(({ deliverable, program, daysUntilDue }) => (
                <DeliverableRow
                  key={deliverable.id}
                  deliverable={deliverable}
                  program={program}
                  daysUntilDue={daysUntilDue}
                  companyId={companyId}
                  isOverdue
                />
              ))}
              {overdueDeliverables.length > 5 && (
                <MoreLink
                  href={`/c/${companyId}/deliver?filter=overdue`}
                  count={overdueDeliverables.length - 5}
                />
              )}
            </SectionCard>
          )}

          {/* Recent Work */}
          <SectionCard
            title="Recently Created Work"
            icon={<Package className="w-5 h-5" />}
            iconBg="bg-blue-500/10"
            iconColor="text-blue-400"
            count={recentWorkItems.length}
            emptyMessage="No work items created recently"
          >
            {recentWorkItems.slice(0, 5).map((work) => (
              <WorkItemRow key={work.id} work={work} companyId={companyId} />
            ))}
            {recentWorkItems.length > 5 && (
              <MoreLink
                href={`/c/${companyId}/work`}
                count={recentWorkItems.length - 5}
              />
            )}
          </SectionCard>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Program Health Summary */}
          <SectionCard
            title="Program Health"
            icon={<Activity className="w-5 h-5" />}
            iconBg="bg-emerald-500/10"
            iconColor="text-emerald-400"
            count={healthSnapshots.length}
            emptyMessage="No active programs"
          >
            <div className="space-y-3">
              {/* Health Distribution */}
              <div className="flex gap-2 mb-4">
                <HealthPill status="Healthy" count={healthCounts['Healthy']} />
                <HealthPill status="Attention" count={healthCounts['Attention']} />
                <HealthPill status="At Risk" count={healthCounts['At Risk']} />
              </div>

              {/* Programs needing attention */}
              {healthSnapshots
                .filter((h) => h.status !== 'Healthy')
                .slice(0, 5)
                .map((snapshot) => (
                  <ProgramHealthRow
                    key={snapshot.programId}
                    snapshot={snapshot}
                    companyId={companyId}
                  />
                ))}

              {healthSnapshots.filter((h) => h.status !== 'Healthy').length === 0 && (
                <p className="text-sm text-slate-500 text-center py-2">
                  All programs are healthy
                </p>
              )}
            </div>
          </SectionCard>

          {/* Capacity Warning */}
          {capacitySummary.warningThreshold && (
            <div className="p-4 bg-amber-950/30 border border-amber-700/50 rounded-xl">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-amber-300">
                    Capacity Warning
                  </h4>
                  <p className="text-sm text-amber-200/80 mt-1">
                    {capacitySummary.recommendation}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Scope Drift Summary */}
          <SectionCard
            title="Scope Drift"
            icon={<Shield className="w-5 h-5" />}
            iconBg="bg-purple-500/10"
            iconColor="text-purple-400"
          >
            <ScopeDriftSummary companyId={companyId} />
          </SectionCard>

          {/* Approvals Needed */}
          <SectionCard
            title="Approvals Needed"
            icon={<CheckCircle2 className="w-5 h-5" />}
            iconBg="bg-cyan-500/10"
            iconColor="text-cyan-400"
          >
            <ApprovalsSection companyId={companyId} />
          </SectionCard>

          {/* Runbook (Operator Checklist) */}
          <RunbookPanel companyId={companyId} />

          {/* Recurrence Health (Internal SLO Panel) */}
          <RecurrenceHealthPanel companyId={companyId} />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

function StatCard({
  icon,
  label,
  value,
  subtext,
  variant = 'default',
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  subtext: string;
  variant?: 'default' | 'warning';
}) {
  return (
    <div className="p-4 bg-slate-900 border border-slate-700 rounded-xl">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm text-slate-400">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span
          className={`text-2xl font-bold ${
            variant === 'warning' ? 'text-amber-400' : 'text-white'
          }`}
        >
          {value}
        </span>
        <span className="text-xs text-slate-500">{subtext}</span>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  icon,
  iconBg,
  iconColor,
  count,
  emptyMessage,
  variant = 'default',
  children,
}: {
  title: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  count?: number;
  emptyMessage?: string;
  variant?: 'default' | 'danger';
  children: React.ReactNode;
}) {
  const borderColor = variant === 'danger' ? 'border-red-800/50' : 'border-slate-700';

  return (
    <div className={`bg-slate-900 border ${borderColor} rounded-xl overflow-hidden`}>
      <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${iconBg}`}>
            <span className={iconColor}>{icon}</span>
          </div>
          <h3 className="text-sm font-medium text-white">{title}</h3>
        </div>
        {count !== undefined && (
          <span className="px-2 py-0.5 text-xs bg-slate-800 text-slate-400 rounded-full">
            {count}
          </span>
        )}
      </div>
      <div className="p-4">
        {count === 0 && emptyMessage ? (
          <p className="text-sm text-slate-500 text-center py-4">{emptyMessage}</p>
        ) : (
          <div className="space-y-2">{children}</div>
        )}
      </div>
    </div>
  );
}

function DeliverableRow({
  deliverable,
  program,
  daysUntilDue,
  companyId,
  isOverdue = false,
}: {
  deliverable: PlanningDeliverable;
  program: PlanningProgram;
  daysUntilDue: number;
  companyId: string;
  isOverdue?: boolean;
}) {
  const dueText = isOverdue
    ? `${Math.abs(daysUntilDue)} days overdue`
    : daysUntilDue === 0
    ? 'Due today'
    : daysUntilDue === 1
    ? 'Due tomorrow'
    : `Due in ${daysUntilDue} days`;

  return (
    <Link
      href={`/c/${companyId}/deliver?programId=${program.id}&deliverableId=${deliverable.id}`}
      className="flex items-center justify-between p-2 -mx-2 rounded-lg hover:bg-slate-800/50 transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">{deliverable.title}</p>
        <p className="text-xs text-slate-500 truncate">{program.title}</p>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`text-xs px-2 py-0.5 rounded ${
            isOverdue
              ? 'bg-red-500/10 text-red-400'
              : 'bg-amber-500/10 text-amber-400'
          }`}
        >
          {dueText}
        </span>
        <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400" />
      </div>
    </Link>
  );
}

function WorkItemRow({
  work,
  companyId,
}: {
  work: WorkItemRecord;
  companyId: string;
}) {
  const createdAgo = work.createdAt
    ? formatTimeAgo(new Date(work.createdAt))
    : '';

  return (
    <Link
      href={`/c/${companyId}/work?workItemId=${work.id}`}
      className="flex items-center justify-between p-2 -mx-2 rounded-lg hover:bg-slate-800/50 transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">{work.title}</p>
        <p className="text-xs text-slate-500">
          {work.status} {createdAgo && `· ${createdAgo}`}
        </p>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400" />
    </Link>
  );
}

function ProgramHealthRow({
  snapshot,
  companyId,
}: {
  snapshot: ReturnType<typeof calculateProgramHealth>;
  companyId: string;
}) {
  const style = getHealthBadgeStyle(snapshot.status);

  return (
    <Link
      href={`/c/${companyId}/deliver?programId=${snapshot.programId}`}
      className="flex items-center justify-between p-2 -mx-2 rounded-lg hover:bg-slate-800/50 transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">{snapshot.programTitle}</p>
        <p className="text-xs text-slate-500 truncate">
          {snapshot.issues.slice(0, 2).join(' · ')}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`text-xs px-2 py-0.5 rounded ${style.bg} ${style.text} border ${style.border}`}
        >
          {snapshot.status}
        </span>
        <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400" />
      </div>
    </Link>
  );
}

function HealthPill({
  status,
  count,
}: {
  status: HealthStatus;
  count: number;
}) {
  const style = getHealthBadgeStyle(status);

  return (
    <div
      className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${style.bg} ${style.text} border ${style.border}`}
    >
      <span>{count}</span>
      <span className="text-xs opacity-75">{status}</span>
    </div>
  );
}

function MoreLink({ href, count }: { href: string; count: number }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-center gap-1 p-2 text-xs text-slate-400 hover:text-white transition-colors"
    >
      <span>+{count} more</span>
      <ArrowRight className="w-3 h-3" />
    </Link>
  );
}

function ScopeDriftSummary({ companyId }: { companyId: string }) {
  // This will fetch from the events API when data is available
  // For now, show a placeholder
  return (
    <div className="text-center py-4">
      <p className="text-sm text-slate-500">
        No scope violations in the last 30 days
      </p>
      <Link
        href={`/c/${companyId}/deliver?view=drift`}
        className="text-xs text-slate-400 hover:text-white mt-2 inline-flex items-center gap-1"
      >
        View drift analysis
        <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
}

interface ApprovalRequest {
  id: string;
  capabilityName: string;
  description: string;
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
}

function ApprovalsSection({ companyId }: { companyId: string }) {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchApprovals() {
      try {
        const response = await fetch(
          `/api/os/companies/${companyId}/approvals?status=pending&limit=5`
        );
        if (!response.ok) throw new Error('Failed to fetch approvals');
        const data = await response.json();
        setApprovals(data.approvals || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setIsLoading(false);
      }
    }
    fetchApprovals();
  }, [companyId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  if (approvals.length === 0) {
    return (
      <div className="text-center py-4">
        <CheckCircle2 className="w-8 h-8 text-emerald-500/50 mx-auto mb-2" />
        <p className="text-sm text-slate-500">No pending approvals</p>
        <p className="text-xs text-slate-600 mt-1">
          AI actions requiring approval will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {approvals.map((approval) => (
        <Link
          key={approval.id}
          href={`/c/${companyId}/approvals?id=${approval.id}`}
          className="flex items-center justify-between p-2 -mx-2 rounded-lg hover:bg-slate-800/50 transition-colors group"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white truncate">{approval.capabilityName}</p>
            <p className="text-xs text-slate-500 truncate">{approval.description}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400">
              Pending
            </span>
            <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400" />
          </div>
        </Link>
      ))}
      {approvals.length > 0 && (
        <Link
          href={`/c/${companyId}/approvals`}
          className="flex items-center justify-center gap-1 p-2 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <span>View all approvals</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
