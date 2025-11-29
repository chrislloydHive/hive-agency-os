'use client';

// components/os/WorkspaceOperatorDashboard.tsx
// Workspace Operator Dashboard - OS-Level Analytics View
//
// This component displays the operator dashboard for the entire Hive OS workspace.
// It answers: "Is the OS working? What's broken? Where's the biggest leverage?"

import { useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import type {
  WorkspaceOperatorOverview,
  WorkspaceHealthStatus,
  WorkspaceRiskItem,
  WorkspaceOpportunityItem,
  WorkspaceCompanyAttentionItem,
} from '@/lib/os/analytics/workspaceOverview';

// ============================================================================
// Types
// ============================================================================

interface WorkspaceOperatorDashboardProps {
  overview: WorkspaceOperatorOverview | null;
  error: string | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getHealthStatusStyles(status: WorkspaceHealthStatus): {
  bg: string;
  text: string;
  border: string;
  label: string;
} {
  switch (status) {
    case 'healthy':
      return {
        bg: 'bg-emerald-500/20',
        text: 'text-emerald-300',
        border: 'border-emerald-500/30',
        label: 'Healthy',
      };
    case 'watching':
      return {
        bg: 'bg-amber-500/20',
        text: 'text-amber-300',
        border: 'border-amber-500/30',
        label: 'Watching',
      };
    case 'at_risk':
      return {
        bg: 'bg-red-500/20',
        text: 'text-red-300',
        border: 'border-red-500/30',
        label: 'At Risk',
      };
  }
}

function getSeverityStyles(severity: 'critical' | 'high' | 'medium'): {
  bg: string;
  text: string;
  border: string;
} {
  switch (severity) {
    case 'critical':
      return {
        bg: 'bg-red-500/10',
        text: 'text-red-400',
        border: 'border-red-500/30',
      };
    case 'high':
      return {
        bg: 'bg-orange-500/10',
        text: 'text-orange-400',
        border: 'border-orange-500/30',
      };
    case 'medium':
      return {
        bg: 'bg-amber-500/10',
        text: 'text-amber-400',
        border: 'border-amber-500/30',
      };
  }
}

function getImpactStyles(impact: 'high' | 'medium' | 'low'): {
  bg: string;
  text: string;
  border: string;
} {
  switch (impact) {
    case 'high':
      return {
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-400',
        border: 'border-emerald-500/30',
      };
    case 'medium':
      return {
        bg: 'bg-blue-500/10',
        text: 'text-blue-400',
        border: 'border-blue-500/30',
      };
    case 'low':
      return {
        bg: 'bg-slate-500/10',
        text: 'text-slate-400',
        border: 'border-slate-500/30',
      };
  }
}

function getScoreColor(score: number | null): string {
  if (score === null) return 'text-slate-400';
  if (score >= 70) return 'text-emerald-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-red-400';
}

function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Never';
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return 'Unknown';
  }
}

// ============================================================================
// Main Component
// ============================================================================

export function WorkspaceOperatorDashboard({
  overview,
  error,
}: WorkspaceOperatorDashboardProps) {
  const [refreshing, setRefreshing] = useState(false);

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center">
        <p className="text-red-400 font-medium">Error loading dashboard</p>
        <p className="text-red-300 text-sm mt-2">{error}</p>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400 mb-4" />
        <p className="text-slate-400">Loading operator dashboard...</p>
      </div>
    );
  }

  const { health, risks, opportunities, funnel, attentionList, aiInsights, dmaContribution } = overview;
  const healthStyles = getHealthStatusStyles(health.status);

  return (
    <div className="space-y-6">
      {/* ================================================================== */}
      {/* Band 1: Workspace Health + Next Best Action */}
      {/* ================================================================== */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Workspace Health Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                Workspace Health
              </h2>
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border ${healthStyles.bg} ${healthStyles.text} ${healthStyles.border}`}
                >
                  {healthStyles.label}
                </span>
                {health.averageScore !== null && (
                  <span className="text-sm text-slate-400">
                    Avg Score:{' '}
                    <span className={`font-bold ${getScoreColor(health.averageScore)}`}>
                      {health.averageScore}
                    </span>
                  </span>
                )}
              </div>
            </div>
            <div className="text-right text-sm text-slate-500">
              <p>{health.companiesTotal} companies</p>
              <p className="text-xs">{health.companiesWithData} with scores</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <div className="text-2xl font-bold text-emerald-400">
                {health.healthyCompanies}
              </div>
              <div className="text-xs text-emerald-300/70">Healthy</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="text-2xl font-bold text-amber-400">
                {health.unknownCompanies}
              </div>
              <div className="text-xs text-amber-300/70">Unknown</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <div className="text-2xl font-bold text-red-400">
                {health.atRiskCompanies}
              </div>
              <div className="text-xs text-red-300/70">At Risk</div>
            </div>
          </div>

          {(health.criticalAlertCount > 0 || health.warningAlertCount > 0) && (
            <div className="mt-4 pt-4 border-t border-slate-800 flex items-center gap-4 text-sm">
              {health.criticalAlertCount > 0 && (
                <span className="text-red-400">
                  {health.criticalAlertCount} critical alert
                  {health.criticalAlertCount !== 1 && 's'}
                </span>
              )}
              {health.warningAlertCount > 0 && (
                <span className="text-amber-400">
                  {health.warningAlertCount} warning
                  {health.warningAlertCount !== 1 && 's'}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Next Best Action Card */}
        <div className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/30 rounded-xl p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-xs font-semibold text-blue-300 uppercase tracking-wide mb-1">
                Next Best Action
              </h2>
              <p className="text-sm font-medium text-blue-100">
                {aiInsights?.nextBestAction || 'Review at-risk companies'}
              </p>
            </div>
          </div>

          {aiInsights?.summary && (
            <div className="text-sm text-slate-300 leading-relaxed mb-4">
              {aiInsights.summary}
            </div>
          )}

          {aiInsights?.topRisks && aiInsights.topRisks.length > 0 && (
            <div className="text-xs text-slate-400">
              <span className="text-red-400 mr-1">Top risk:</span>
              {aiInsights.topRisks[0]}
            </div>
          )}
        </div>
      </div>

      {/* ================================================================== */}
      {/* Band 2: System Risks & Opportunities */}
      {/* ================================================================== */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* System Risks */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">
            System Risks
          </h2>

          {risks.length === 0 ? (
            <div className="text-center py-6 text-slate-500">
              <svg
                className="w-8 h-8 mx-auto mb-2 text-emerald-400/50"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <p className="text-sm">No critical risks detected</p>
            </div>
          ) : (
            <div className="space-y-3">
              {risks.map((risk) => (
                <RiskCard key={risk.id} risk={risk} />
              ))}
            </div>
          )}
        </div>

        {/* System Opportunities */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">
            System Opportunities
          </h2>

          {opportunities.length === 0 ? (
            <div className="text-center py-6 text-slate-500">
              <svg
                className="w-8 h-8 mx-auto mb-2 text-slate-400/50"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
              <p className="text-sm">Run more diagnostics to surface opportunities</p>
            </div>
          ) : (
            <div className="space-y-3">
              {opportunities.map((opp) => (
                <OpportunityCard key={opp.id} opportunity={opp} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ================================================================== */}
      {/* Band 3: OS Funnel */}
      {/* ================================================================== */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            OS Funnel
          </h2>
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-500">{funnel.periodLabel}</span>
            <Link
              href="/analytics/dma"
              className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
            >
              View DMA Funnel
            </Link>
          </div>
        </div>

        {funnel.stages.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <p className="text-sm">No funnel data available</p>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            {funnel.stages.map((stage, idx) => {
              const isLast = idx === funnel.stages.length - 1;
              const nextStage = funnel.stages[idx + 1];
              const conversionKey = `${stage.id}→${nextStage?.id}`;
              const conversionRate = funnel.conversionRates[conversionKey];

              return (
                <div key={stage.id} className="flex-1 flex items-center">
                  <div className="flex-1 text-center">
                    <div className="bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-lg p-4">
                      <div className="text-3xl font-bold text-amber-400">
                        {stage.count}
                      </div>
                      <div className="text-xs text-amber-300/70 mt-1">{stage.label}</div>
                    </div>
                  </div>

                  {!isLast && (
                    <div className="flex flex-col items-center px-2 text-slate-500">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 7l5 5m0 0l-5 5m5-5H6"
                        />
                      </svg>
                      {conversionRate !== undefined && (
                        <span className="text-xs text-slate-400 mt-1">
                          {conversionRate}%
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ================================================================== */}
      {/* Band 4: Companies Requiring Attention */}
      {/* ================================================================== */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Companies Requiring Attention
          </h2>
          <Link
            href="/companies"
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            View all companies
          </Link>
        </div>

        {attentionList.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <svg
              className="w-10 h-10 mx-auto mb-3 text-emerald-400/50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm">All companies look healthy</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left">
                  <th className="pb-3 font-medium text-slate-400">Company</th>
                  <th className="pb-3 font-medium text-slate-400 text-center">Score</th>
                  <th className="pb-3 font-medium text-slate-400 text-center">Health</th>
                  <th className="pb-3 font-medium text-slate-400 text-center">Alerts</th>
                  <th className="pb-3 font-medium text-slate-400">Last Diagnostic</th>
                  <th className="pb-3 font-medium text-slate-400">Reason</th>
                  <th className="pb-3 font-medium text-slate-400 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {attentionList.map((company) => (
                  <CompanyAttentionRow key={company.companyId} company={company} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ================================================================== */}
      {/* Band 5: AI Insights */}
      {/* ================================================================== */}
      {aiInsights && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* AI Opportunities */}
          {aiInsights.topOpportunities.length > 0 && (
            <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-emerald-300 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                Top Opportunities
              </h3>
              <ul className="space-y-2">
                {aiInsights.topOpportunities.map((opp, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-emerald-100">
                    <span className="text-emerald-400 mt-0.5">+</span>
                    <span>{opp}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* AI Risks */}
          {aiInsights.topRisks.length > 0 && (
            <div className="bg-gradient-to-br from-red-500/10 to-rose-500/10 border border-red-500/30 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-red-300 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                Top Risks
              </h3>
              <ul className="space-y-2">
                {aiInsights.topRisks.map((risk, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-red-100">
                    <span className="text-red-400 mt-0.5">!</span>
                    <span>{risk}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function RiskCard({ risk }: { risk: WorkspaceRiskItem }) {
  const styles = getSeverityStyles(risk.severity);

  return (
    <div className={`p-3 rounded-lg border ${styles.bg} ${styles.border}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-sm font-medium ${styles.text}`}>{risk.label}</span>
            <span
              className={`px-1.5 py-0.5 rounded text-xs ${styles.bg} ${styles.text} border ${styles.border}`}
            >
              {risk.severity}
            </span>
          </div>
          {risk.description && (
            <p className="text-xs text-slate-400 mb-2">{risk.description}</p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-500">
              {risk.companiesAffected} companies affected
            </span>
            {risk.exampleCompanyNames.length > 0 && (
              <>
                <span className="text-xs text-slate-600">|</span>
                {risk.exampleCompanyNames.slice(0, 2).map((name, idx) => (
                  <Link
                    key={idx}
                    href={`/c/${risk.exampleCompanyIds[idx]}`}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    {name}
                  </Link>
                ))}
                {risk.exampleCompanyNames.length > 2 && (
                  <span className="text-xs text-slate-500">
                    +{risk.companiesAffected - 2} more
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function OpportunityCard({ opportunity }: { opportunity: WorkspaceOpportunityItem }) {
  const styles = getImpactStyles(opportunity.impact);

  return (
    <div className={`p-3 rounded-lg border ${styles.bg} ${styles.border}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-sm font-medium ${styles.text}`}>{opportunity.label}</span>
            <span
              className={`px-1.5 py-0.5 rounded text-xs ${styles.bg} ${styles.text} border ${styles.border}`}
            >
              {opportunity.impact}
            </span>
          </div>
          {opportunity.description && (
            <p className="text-xs text-slate-400 mb-2">{opportunity.description}</p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-500">
              {opportunity.companiesAffected} companies
            </span>
            {opportunity.exampleCompanyNames.length > 0 && (
              <>
                <span className="text-xs text-slate-600">|</span>
                {opportunity.exampleCompanyNames.slice(0, 2).map((name, idx) => (
                  <Link
                    key={idx}
                    href={`/c/${opportunity.exampleCompanyIds[idx]}`}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    {name}
                  </Link>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CompanyAttentionRow({ company }: { company: WorkspaceCompanyAttentionItem }) {
  const healthStyles = getHealthStatusStyles(company.health);

  return (
    <tr className="border-b border-slate-800/50 last:border-0">
      <td className="py-3">
        <Link
          href={`/c/${company.companyId}`}
          className="text-slate-200 hover:text-white font-medium transition-colors"
        >
          {company.name}
        </Link>
      </td>
      <td className="py-3 text-center">
        <span className={`font-bold ${getScoreColor(company.overallScore)}`}>
          {company.overallScore ?? '—'}
        </span>
      </td>
      <td className="py-3 text-center">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${healthStyles.bg} ${healthStyles.text} ${healthStyles.border}`}
        >
          {healthStyles.label}
        </span>
      </td>
      <td className="py-3 text-center">
        {company.criticalAlerts > 0 && (
          <span className="text-xs text-red-400 mr-2">
            {company.criticalAlerts} crit
          </span>
        )}
        {company.warningAlerts > 0 && (
          <span className="text-xs text-amber-400">
            {company.warningAlerts} warn
          </span>
        )}
        {company.criticalAlerts === 0 && company.warningAlerts === 0 && (
          <span className="text-xs text-slate-500">—</span>
        )}
      </td>
      <td className="py-3 text-xs text-slate-400">
        {formatRelativeTime(company.latestDiagnosticsAt)}
      </td>
      <td className="py-3 text-xs text-slate-400 max-w-xs truncate">
        {company.primaryReason}
      </td>
      <td className="py-3 text-right">
        <Link
          href={`/c/${company.companyId}`}
          className="px-2.5 py-1 rounded text-xs bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
        >
          Open
        </Link>
      </td>
    </tr>
  );
}
