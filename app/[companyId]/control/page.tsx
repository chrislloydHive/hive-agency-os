import { getCompanyById } from '@/lib/airtable/companies';
import { getLatestOsGapFullReportForCompany } from '@/lib/airtable/gapFullReports';
import { getGapPlanRunsForCompany } from '@/lib/airtable/gapPlanRuns';
import { RunOsControls } from './RunOsControls';
import { ClickableRow } from './ClickableRow';

interface ControlPageProps {
  params: Promise<{ companyId: string }>;
}

export default async function ControlPage({ params }: ControlPageProps) {
  const { companyId } = await params;
  const company = await getCompanyById(companyId);

  if (!company) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Company not found</p>
      </div>
    );
  }

  // Load data for the control panel
  const [latestReport, recentRuns] = await Promise.all([
    getLatestOsGapFullReportForCompany(companyId),
    getGapPlanRunsForCompany(companyId, 10),
  ]);

  // Extract latest report date if available
  const latestReportDate = latestReport?.fields?.['Report Date'] as
    | string
    | undefined;

  // Status badge helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'running':
      case 'processing':
      case 'pending':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'error':
        return 'bg-red-500/10 text-red-400 border-red-500/30';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    }
  };

  // Format date helper
  const formatDate = (dateString?: string) => {
    if (!dateString) return '—';
    try {
      return new Date(dateString).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  // Calculate duration in seconds
  const getDuration = (
    createdAt?: string,
    completedAt?: string
  ): string => {
    if (!createdAt || !completedAt) return '—';
    try {
      const start = new Date(createdAt).getTime();
      const end = new Date(completedAt).getTime();
      const seconds = Math.round((end - start) / 1000);
      if (seconds < 60) return `${seconds}s`;
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}m ${remainingSeconds}s`;
    } catch {
      return '—';
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <span>Hive OS</span>
          <span>·</span>
          <span>Control</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-100 mb-1">
          Control Panel for {company.name}
        </h1>
        <p className="text-sm text-slate-400">
          Run OS analyses, view recent GAP runs, and manage integrations.{' '}
          <span className="text-amber-500">Operator-only.</span>
        </p>
      </div>

      {/* Main Content: 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT COLUMN */}
        <div className="space-y-6">
          {/* Section A: Run OS Analysis */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-slate-200 mb-1">
              Run OS Analysis
            </h2>
            <p className="text-sm text-slate-400 mb-4">
              Trigger a new analysis for {company.name}
            </p>

            <RunOsControls companyId={companyId} companyName={company.name} />
          </div>

          {/* Section B: Recent GAP Runs */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-200">
                Recent GAP Runs
              </h2>
              <span className="text-xs text-slate-500">
                Last {recentRuns.length} runs
              </span>
            </div>

            {recentRuns.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                No GAP runs yet for this company
              </div>
            ) : (
              <div className="overflow-x-auto -mx-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs">
                      <th className="text-left px-6 py-2 font-semibold text-slate-400">
                        Status
                      </th>
                      <th className="text-left px-4 py-2 font-semibold text-slate-400">
                        Score
                      </th>
                      <th className="text-left px-4 py-2 font-semibold text-slate-400">
                        Started
                      </th>
                      <th className="text-right px-6 py-2 font-semibold text-slate-400">
                        Duration
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentRuns.map((run) => {
                      const isCompleted = run.status === 'completed';
                      const href = isCompleted
                        ? `/os/${companyId}/reports/${run.id}`
                        : undefined;
                      const className = isCompleted
                        ? 'border-b border-slate-800/50 last:border-0 hover:bg-slate-800/30 transition-colors'
                        : 'border-b border-slate-800/50 last:border-0';

                      return (
                        <ClickableRow key={run.id} href={href} className={className}>
                          <td className="px-6 py-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getStatusBadge(
                                run.status
                              )}`}
                            >
                              {run.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {run.overallScore !== undefined ? (
                              <span className="text-slate-200 font-medium">
                                {Math.round(run.overallScore * 10)}/10
                              </span>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-400 text-xs">
                            {formatDate(run.createdAt)}
                            {isCompleted && (
                              <span className="ml-2 text-emerald-400">
                                → View
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-3 text-right text-slate-400 text-xs">
                            {getDuration(run.createdAt, run.completedAt)}
                          </td>
                        </ClickableRow>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {recentRuns.length > 0 && recentRuns[0].errorMessage && (
              <div className="mt-3 p-3 bg-red-900/20 border border-red-700/50 rounded text-sm text-red-300">
                <span className="font-medium">Last error:</span>{' '}
                {recentRuns[0].errorMessage.substring(0, 80)}
                {recentRuns[0].errorMessage.length > 80 && '...'}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6">
          {/* Section C: Integrations & Telemetry */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-slate-200 mb-4">
              Integrations & Telemetry
            </h2>

            <div className="space-y-4">
              {/* GA4 Status */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-300 mb-1">
                    Google Analytics 4
                  </div>
                  {company.ga4PropertyId ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                        <span className="text-xs text-slate-400">
                          Connected
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 font-mono">
                        {company.ga4PropertyId}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-slate-600 rounded-full"></div>
                      <span className="text-xs text-slate-500">
                        Not configured
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Search Console Status */}
              <div className="flex items-start justify-between pt-4 border-t border-slate-800">
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-300 mb-1">
                    Google Search Console
                  </div>
                  {company.searchConsoleSiteUrl ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                        <span className="text-xs text-slate-400">
                          Connected
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 break-all">
                        {company.searchConsoleSiteUrl}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-slate-600 rounded-full"></div>
                      <span className="text-xs text-slate-500">
                        Not configured
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Last telemetry update */}
              {latestReportDate && (
                <div className="pt-4 border-t border-slate-800">
                  <div className="text-sm font-medium text-slate-300 mb-1">
                    Last Report
                  </div>
                  <div className="text-xs text-slate-400">
                    {formatDate(latestReportDate)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section D: Automation (stub) */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-slate-200 mb-2">
              Automation
            </h2>
            <p className="text-sm text-slate-500">
              Scheduled analysis and monitoring controls will appear here.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
