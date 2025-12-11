import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCompanyById } from '@/lib/airtable/companies';
import { getFullReportsForCompany } from '@/lib/airtable/fullReports';
import { getWorkItemsForCompanyByPlanInitiativeId } from '@/lib/airtable/workItems';
import type {
  PlanPayload,
  PlanInitiative,
  PlanTimeHorizon,
} from '@/lib/gap/types';
import type { WorkItemRecord } from '@/lib/airtable/workItems';
import InitiativeCardWithAction from './InitiativeCardWithAction';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export const dynamic = 'force-dynamic';

export default async function PlanPage({ params }: PageProps) {
  const { companyId } = await params;

  // Load company
  const company = await getCompanyById(companyId);
  if (!company) {
    return notFound();
  }

  // Load full reports for this company
  const reports = await getFullReportsForCompany(companyId);
  const latestReport = reports[0]; // Sorted newest first

  // Extract plan from latest report
  const planJson: PlanPayload | undefined = latestReport?.planJson;
  const prioritiesJson = latestReport?.prioritiesJson;

  // Load work items indexed by plan initiative ID
  const workItemsByPlanId = await getWorkItemsForCompanyByPlanInitiativeId(companyId);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Hive OS · Plan</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100">
            Growth Plan
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            90-day roadmap generated from the latest Full Report (v2)
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href={`/c/${companyId}`}
            className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800"
          >
            Overview
          </Link>
          <Link
            href={`/c/${companyId}/diagnostics`}
            className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800"
          >
            Diagnostics
          </Link>
          <Link
            href={`/c/${companyId}/work`}
            className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800"
          >
            Work
          </Link>
          <Link
            href={`/c/${companyId}/reports/qbr`}
            className="rounded-full border border-blue-600/50 bg-blue-500/10 px-3 py-1 text-xs text-blue-400 hover:bg-blue-500/20"
          >
            QBR
          </Link>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-[1.5fr,1fr]">
        {/* Left: Timeline / Phases (30/60/90 days) */}
        <section className="space-y-4">
          <PlanTimeline
            planJson={planJson}
            prioritiesJson={prioritiesJson}
            companyId={companyId}
            fullReportId={latestReport?.id || ''}
            workItemsByPlanId={workItemsByPlanId}
          />
        </section>

        {/* Right: Summary + Meta */}
        <aside className="space-y-4">
          <PlanSummary planJson={planJson} />
          <PlanMeta planJson={planJson} />
        </aside>
      </div>
    </div>
  );
}

/**
 * Plan Timeline Component (Left Column)
 * Shows 30/60/90-day phases with initiatives
 */
function PlanTimeline({
  planJson,
  prioritiesJson,
  companyId,
  fullReportId,
  workItemsByPlanId,
}: {
  planJson?: PlanPayload;
  prioritiesJson?: any;
  companyId: string;
  fullReportId: string;
  workItemsByPlanId: Record<string, WorkItemRecord>;
}) {
  if (!planJson) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center">
        <div className="mb-4">
          <svg
            className="mx-auto h-12 w-12 text-slate-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-slate-200 mb-2">
          No Plan Found
        </h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          No structured plan found on the latest Full Report. Re-run the GAP Engine with plan
          generation enabled.
        </p>
      </div>
    );
  }

  // Extract all initiatives (from phases or flat list)
  const allInitiatives: PlanInitiative[] = [];

  // If phases exist, extract initiatives from them
  if (planJson.phases && planJson.phases.length > 0) {
    for (const phase of planJson.phases) {
      if (phase.initiatives) {
        allInitiatives.push(...phase.initiatives);
      }
    }
  }

  // Also add any flat initiatives
  if (planJson.initiatives) {
    allInitiatives.push(...planJson.initiatives);
  }

  // Group initiatives by time horizon
  const groupedInitiatives: Record<PlanTimeHorizon, PlanInitiative[]> = {
    '30_days': [],
    '60_days': [],
    '90_days': [],
    'beyond_90_days': [],
  };

  for (const initiative of allInitiatives) {
    groupedInitiatives[initiative.timeHorizon].push(initiative);
  }

  // Define phase metadata
  const phaseMetadata: Record<
    PlanTimeHorizon,
    { label: string; color: string; description: string }
  > = {
    '30_days': {
      label: 'First 30 Days',
      color: 'emerald',
      description: 'Quick wins and immediate actions',
    },
    '60_days': {
      label: 'Next 60 Days',
      color: 'blue',
      description: 'Building momentum',
    },
    '90_days': {
      label: 'Next 90 Days',
      color: 'purple',
      description: 'Strategic initiatives',
    },
    'beyond_90_days': {
      label: 'Beyond 90 Days',
      color: 'slate',
      description: 'Long-term opportunities',
    },
  };

  return (
    <div className="space-y-6">
      {(['30_days', '60_days', '90_days', 'beyond_90_days'] as PlanTimeHorizon[]).map(
        (horizon) => {
          const initiatives = groupedInitiatives[horizon];
          if (initiatives.length === 0) return null;

          const { label, description } = phaseMetadata[horizon];

          return (
            <div key={horizon} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              {/* Phase header */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-base font-semibold text-slate-200">{label}</h2>
                  <span className="text-xs text-slate-500">({initiatives.length})</span>
                </div>
                <p className="text-xs text-slate-400">{description}</p>
              </div>

              {/* Initiatives */}
              <div className="space-y-3">
                {initiatives.map((initiative, idx) => {
                  const workItem = initiative.id ? workItemsByPlanId[initiative.id] : undefined;
                  const hasWorkItem = !!workItem;

                  return (
                    <InitiativeCardWithAction
                      key={initiative.id || idx}
                      initiative={initiative}
                      companyId={companyId}
                      fullReportId={fullReportId}
                      hasWorkItem={hasWorkItem}
                      workItemStatus={workItem?.status}
                      prioritiesJson={prioritiesJson}
                    />
                  );
                })}
              </div>
            </div>
          );
        }
      )}

      {allInitiatives.length === 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center">
          <p className="text-sm text-slate-400">No initiatives found in plan</p>
        </div>
      )}
    </div>
  );
}

/**
 * Plan Summary Component (Right Column)
 */
function PlanSummary({ planJson }: { planJson?: PlanPayload }) {
  if (!planJson) return null;

  const hasNarrative = planJson.narrativeSummary;
  const hasTheme = planJson.overallTheme;

  if (!hasNarrative && !hasTheme) return null;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-3">
        Plan Summary
      </h2>

      {hasTheme && (
        <div className="mb-3">
          <p className="text-xs text-slate-500 mb-1">Overall Theme:</p>
          <p className="text-sm text-slate-200 font-medium">{planJson.overallTheme}</p>
        </div>
      )}

      {hasNarrative && (
        <div className="prose prose-sm prose-invert max-w-none">
          <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
            {planJson.narrativeSummary}
          </p>
        </div>
      )}

      {planJson.notes && (
        <div className="mt-3 pt-3 border-t border-slate-800">
          <p className="text-[10px] text-slate-500 leading-relaxed">{planJson.notes}</p>
        </div>
      )}
    </div>
  );
}

/**
 * Plan Meta Stats Component (Right Column)
 */
function PlanMeta({ planJson }: { planJson?: PlanPayload }) {
  if (!planJson) return null;

  // Extract all initiatives
  const allInitiatives: PlanInitiative[] = [];
  if (planJson.phases) {
    for (const phase of planJson.phases) {
      if (phase.initiatives) {
        allInitiatives.push(...phase.initiatives);
      }
    }
  }
  if (planJson.initiatives) {
    allInitiatives.push(...planJson.initiatives);
  }

  if (allInitiatives.length === 0) return null;

  // Count by time horizon
  const count30 = allInitiatives.filter((i) => i.timeHorizon === '30_days').length;
  const count60 = allInitiatives.filter((i) => i.timeHorizon === '60_days').length;
  const count90 = allInitiatives.filter((i) => i.timeHorizon === '90_days').length;
  const countBeyond = allInitiatives.filter((i) => i.timeHorizon === 'beyond_90_days').length;

  // Count by area
  const countByArea: Record<string, number> = {};
  for (const initiative of allInitiatives) {
    if (initiative.area) {
      countByArea[initiative.area] = (countByArea[initiative.area] || 0) + 1;
    }
  }

  // Count by status
  const countByStatus: Record<string, number> = {};
  for (const initiative of allInitiatives) {
    if (initiative.status) {
      countByStatus[initiative.status] = (countByStatus[initiative.status] || 0) + 1;
    }
  }

  // Count with priority links
  const countWithPriority = allInitiatives.filter((i) => i.priorityId).length;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-3">
        Plan Stats
      </h2>

      <div className="space-y-3">
        {/* Total initiatives */}
        <div>
          <p className="text-xs text-slate-500 mb-1">Total Initiatives</p>
          <p className="text-2xl font-bold text-slate-100">{allInitiatives.length}</p>
        </div>

        {/* By time horizon */}
        <div>
          <p className="text-xs text-slate-500 mb-2">By Time Horizon</p>
          <div className="space-y-1.5">
            {count30 > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">First 30 days</span>
                <span className="font-medium text-emerald-400">{count30}</span>
              </div>
            )}
            {count60 > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Next 60 days</span>
                <span className="font-medium text-blue-400">{count60}</span>
              </div>
            )}
            {count90 > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Next 90 days</span>
                <span className="font-medium text-purple-400">{count90}</span>
              </div>
            )}
            {countBeyond > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Beyond 90 days</span>
                <span className="font-medium text-slate-400">{countBeyond}</span>
              </div>
            )}
          </div>
        </div>

        {/* By area */}
        {Object.keys(countByArea).length > 0 && (
          <div>
            <p className="text-xs text-slate-500 mb-2">By Area</p>
            <div className="space-y-1.5">
              {Object.entries(countByArea)
                .sort((a, b) => b[1] - a[1])
                .map(([area, count]) => (
                  <div key={area} className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">{area}</span>
                    <span className="font-medium text-slate-300">{count}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* By status */}
        {Object.keys(countByStatus).length > 0 && (
          <div>
            <p className="text-xs text-slate-500 mb-2">By Status</p>
            <div className="space-y-1.5">
              {Object.entries(countByStatus)
                .sort((a, b) => b[1] - a[1])
                .map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 capitalize">
                      {status.replace(/_/g, ' ')}
                    </span>
                    <span className="font-medium text-slate-300">{count}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Linked to priorities */}
        {countWithPriority > 0 && (
          <div className="pt-3 border-t border-slate-800">
            <p className="text-[10px] text-slate-500">
              {countWithPriority} initiative{countWithPriority !== 1 ? 's' : ''} mapped to
              priorities
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

