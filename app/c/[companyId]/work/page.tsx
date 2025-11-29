import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCompanyById } from '@/lib/airtable/companies';
import { getFullReportsForCompany } from '@/lib/airtable/fullReports';
import { getWorkItemsForCompany, getWorkItemsForCompanyByPriorityId } from '@/lib/airtable/workItems';
import { getCompanyStrategySnapshot } from '@/lib/os/companies/strategySnapshot';
import type {
  WorkItemRecord,
  WorkItemStatus,
  WorkItemArea,
  WorkItemSeverity,
} from '@/lib/airtable/workItems';
import type { PriorityItem, PrioritiesPayload } from '@/lib/airtable/fullReports';
import type { EvidencePayload } from '@/lib/gap/types';
import type { CompanyStrategicSnapshot } from '@/lib/airtable/companyStrategySnapshot';
import PriorityCardWithAction from './PriorityCardWithAction';
import WorkItemCardWithStatus from './WorkItemCardWithStatus';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export const dynamic = 'force-dynamic';

export default async function WorkPage({ params }: PageProps) {
  const { companyId } = await params;

  // Load company
  const company = await getCompanyById(companyId);
  if (!company) {
    return notFound();
  }

  // Load full reports for this company
  const reports = await getFullReportsForCompany(companyId);
  const latestReport = reports[0]; // Assuming sorted newest first

  // Load work items
  const workItems = await getWorkItemsForCompany(companyId);

  // Load work items indexed by priority ID for quick lookup
  const workItemsByPriorityId = await getWorkItemsForCompanyByPriorityId(companyId);

  // Load strategic snapshot for focus areas
  const strategicSnapshot = await getCompanyStrategySnapshot(companyId);

  // Extract priorities from latest report
  const prioritiesPayload: PrioritiesPayload | undefined = latestReport?.prioritiesJson;
  const priorities = prioritiesPayload?.items || [];

  // Extract evidence (telemetry) from latest report
  const evidence = latestReport?.evidenceJson as EvidencePayload | undefined;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Hive OS · Work</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100">
            {company.name}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {company.website || 'No website set'}
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
            href={`/c/${companyId}/tools`}
            className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800"
          >
            Tools
          </Link>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-[1.5fr,1fr]">
        {/* Left: Active Work Items */}
        <section className="space-y-4">
          <ActiveWorkItems workItems={workItems} companyId={companyId} />
        </section>

        {/* Right: Suggested Work from OS */}
        <aside className="space-y-4">
          {/* Telemetry Highlights */}
          {evidence && (evidence.metrics?.length || evidence.insights?.length) && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-3">
                Telemetry Highlights
              </h2>

              {/* Focus on SEO/Content/Website UX insights */}
              {evidence.insights && evidence.insights.length > 0 && (
                <div className="space-y-2.5 mb-4">
                  {evidence.insights
                    .filter(
                      (insight) =>
                        !insight.area ||
                        insight.area === 'SEO' ||
                        insight.area === 'Content' ||
                        insight.area === 'Website UX'
                    )
                    .slice(0, 3)
                    .map((insight) => {
                      const headline = insight.headline || insight.title || 'Untitled';
                      const detail = insight.detail || insight.description;

                      return (
                      <div
                        key={insight.id}
                        className="rounded-lg border border-slate-700/50 bg-[#050509]/50 px-3 py-2.5"
                      >
                        <div className="flex items-start gap-2">
                          {insight.severity && (
                            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${
                              insight.severity.toLowerCase() === 'critical'
                                ? 'bg-red-500'
                                : insight.severity.toLowerCase() === 'high'
                                ? 'bg-orange-500'
                                : insight.severity.toLowerCase() === 'medium'
                                ? 'bg-amber-500'
                                : insight.severity.toLowerCase() === 'low'
                                ? 'bg-sky-500'
                                : 'bg-blue-500'
                            }`} />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-slate-200 leading-snug">
                              {headline}
                            </p>
                            {detail && (
                              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                                {detail}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-1.5">
                              {insight.source && (
                                <span className="text-[9px] uppercase tracking-wide text-slate-500">
                                  {insight.source}
                                </span>
                              )}
                              {insight.area && (
                                <span className="text-[9px] text-slate-500">
                                  · {insight.area}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                    })}
                </div>
              )}

              {/* Show one key metric */}
              {evidence.metrics && evidence.metrics.length > 0 && (
                <div className="rounded-lg border border-slate-800 bg-[#050509]/70 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-300">
                        {evidence.metrics[0].label}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {evidence.metrics[0].source?.toUpperCase()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums text-slate-100">
                        {evidence.metrics[0].value}
                        {evidence.metrics[0].unit && (
                          <span className="text-xs text-slate-400 ml-0.5">
                            {evidence.metrics[0].unit}
                          </span>
                        )}
                      </p>
                      {evidence.metrics[0].change !== undefined && (
                        <p className={`text-[10px] font-medium mt-0.5 ${
                          evidence.metrics[0].change > 0
                            ? 'text-emerald-400'
                            : evidence.metrics[0].change < 0
                            ? 'text-red-400'
                            : 'text-slate-500'
                        }`}>
                          {evidence.metrics[0].change > 0 ? '▲' : evidence.metrics[0].change < 0 ? '▼' : '—'}
                          {' '}
                          {evidence.metrics[0].change > 0 ? '+' : ''}
                          {evidence.metrics[0].change.toFixed(1)}%
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <SuggestedWork
            priorities={priorities}
            latestReport={latestReport}
            companyId={companyId}
            workItemsByPriorityId={workItemsByPriorityId}
            evidence={evidence}
            strategicSnapshot={strategicSnapshot}
          />
        </aside>
      </div>
    </div>
  );
}

/**
 * Active Work Items Section (Left Column)
 */
function ActiveWorkItems({
  workItems,
  companyId,
}: {
  workItems: WorkItemRecord[];
  companyId: string;
}) {
  // Group work items by status
  const grouped = {
    'In Progress': workItems.filter((item) => item.status === 'In Progress'),
    'Planned': workItems.filter((item) => item.status === 'Planned'),
    'Backlog': workItems.filter((item) => item.status === 'Backlog'),
    'Done': workItems.filter((item) => item.status === 'Done'),
  };

  const hasWorkItems = workItems.length > 0;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Active Work Items
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          {workItems.length} {workItems.length === 1 ? 'item' : 'items'}
        </p>
      </div>

      {!hasWorkItems ? (
        <div className="text-center py-8">
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
            No Work Items Yet
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mb-1">
            Work Items represent initiatives you have committed to.
          </p>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Suggested Work from the OS appears on the right, based on the latest Full Report.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {(Object.keys(grouped) as WorkItemStatus[]).map((status) => {
            const items = grouped[status];
            if (items.length === 0) return null;

            return (
              <div key={status}>
                <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-2">
                  {status} ({items.length})
                </h3>
                <div className="space-y-2">
                  {items.map((item) => (
                    <WorkItemCardWithStatus key={item.id} item={item} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Suggested Work Section (Right Column)
 */
function SuggestedWork({
  priorities,
  latestReport,
  companyId,
  workItemsByPriorityId,
  evidence,
  strategicSnapshot,
}: {
  priorities: PriorityItem[];
  latestReport?: any;
  companyId: string;
  workItemsByPriorityId: Record<string, WorkItemRecord>;
  evidence?: EvidencePayload;
  strategicSnapshot?: CompanyStrategicSnapshot | null;
}) {
  const hasPriorities = priorities.length > 0;
  const hasFocusAreas = strategicSnapshot?.focusAreas && strategicSnapshot.focusAreas.length > 0;
  const fullReportId = latestReport?.id;

  return (
    <div className="space-y-4">
      {/* Strategic Focus Areas */}
      {hasFocusAreas && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Strategic Focus Areas
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              From Brain synthesis
            </p>
          </div>
          <ol className="space-y-2">
            {strategicSnapshot!.focusAreas.slice(0, 5).map((area, index) => (
              <li key={index} className="flex items-start gap-3 group">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 text-blue-300 text-xs font-medium flex items-center justify-center border border-blue-500/30">
                  {index + 1}
                </span>
                <span className="flex-1 text-sm text-slate-300 pt-0.5">{area}</span>
              </li>
            ))}
          </ol>
          {strategicSnapshot?.maturityStage && (
            <div className="mt-4 pt-4 border-t border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Current Stage:</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  strategicSnapshot.maturityStage === 'Leading' ? 'bg-emerald-500/20 text-emerald-300' :
                  strategicSnapshot.maturityStage === 'Optimizing' ? 'bg-blue-500/20 text-blue-300' :
                  strategicSnapshot.maturityStage === 'Scaling' ? 'bg-amber-500/20 text-amber-300' :
                  strategicSnapshot.maturityStage === 'Growing' ? 'bg-orange-500/20 text-orange-300' :
                  'bg-slate-500/20 text-slate-300'
                }`}>
                  {strategicSnapshot.maturityStage}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Suggested Work from Full Report */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Suggested Work from OS
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            From latest Full Report
          </p>
        </div>

      {!hasPriorities ? (
        <div className="text-center py-8">
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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-slate-200 mb-2">
            No Priorities Found
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-1">
            No structured priorities were found on the latest Full Report.
          </p>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            You may need to re-run the OS diagnostics or update GAP Engine output.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {priorities.slice(0, 10).map((priority, idx) => {
            const hasWorkItem = priority.id ? !!workItemsByPriorityId[priority.id] : false;

            // Find matching evidence insight for SEO/Content/Website UX priorities
            const matchingInsight =
              (priority.area === 'SEO' ||
                priority.area === 'Content' ||
                priority.area === 'Website UX') &&
              evidence?.insights
                ? evidence.insights.find((insight) => insight.area === priority.area)
                : undefined;

            return (
              <PriorityCardWithAction
                key={priority.id || idx}
                priority={priority}
                companyId={companyId}
                fullReportId={fullReportId || ''}
                hasWorkItem={hasWorkItem}
                evidenceInsight={matchingInsight}
              />
            );
          })}

          {priorities.length > 10 && (
            <p className="text-xs text-slate-500 text-center pt-2">
              + {priorities.length - 10} more priorities
            </p>
          )}
        </div>
      )}
      </div>
    </div>
  );
}

/**
 * Severity Pill Component
 */
function SeverityPill({ severity }: { severity: string }) {
  const normalized = severity.toLowerCase();

  const classes =
    normalized === 'critical'
      ? 'bg-red-500/20 text-red-300 border-red-500/50'
      : normalized === 'high'
      ? 'bg-orange-500/20 text-orange-300 border-orange-500/50'
      : normalized === 'medium'
      ? 'bg-amber-500/20 text-amber-200 border-amber-500/40'
      : normalized === 'low'
      ? 'bg-sky-500/20 text-sky-200 border-sky-500/40'
      : normalized === 'info'
      ? 'bg-blue-500/20 text-blue-200 border-blue-500/40'
      : 'bg-slate-700/50 text-slate-200 border-slate-600';

  const label = severity.charAt(0).toUpperCase() + severity.slice(1);

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${classes}`}
    >
      {label}
    </span>
  );
}

/**
 * Area Pill Component
 */
function AreaPill({ area, variant = 'default' }: { area: string; variant?: 'default' | 'subtle' }) {
  const baseClasses = variant === 'subtle'
    ? 'bg-slate-700/30 text-slate-300 border-slate-600/30'
    : 'bg-slate-700/50 text-slate-200 border-slate-600';

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${baseClasses}`}
    >
      {area}
    </span>
  );
}

/**
 * Format date helper
 */
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}
