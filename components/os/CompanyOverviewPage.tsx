'use client';

// components/os/CompanyOverviewPage.tsx
// Simplified Company Overview Dashboard
//
// This is the streamlined landing page when viewing a company in Hive OS.
// The layout already provides: company name, website, back link, and tabs.
// This component focuses on:
// 1. Status Strip: Overall health + Next Best Action + Data Confidence
// 2. Job Launcher: 5 primary actions
// 3. Recent Activity Snippet

import Link from 'next/link';
import { ActivitySnippet } from './ActivitySnippet';
import { NextBestActionsCard } from './NextBestActionsCard';
import { RunDiagnosticsButton } from './RunDiagnosticsButton';
import { DataConfidenceBadge, type DataSource } from '@/components/diagnostics/DataConfidenceBadge';
import { CompanyStatusHeader } from '@/components/company/CompanyStatusHeader';
import type { CompanyStatusHeader as StatusHeaderData } from '@/lib/os/companies/companyStatus';
import type { CompanyStrategicSnapshot } from '@/lib/airtable/companyStrategySnapshot';
import type { DiagnosticRunStatus, DiagnosticToolId, CompanyScoreTrends } from '@/lib/os/diagnostics/runs';
import type { CompanyWorkSummary } from '@/lib/os/companies/workSummary';
import type { CompanyAlert } from '@/lib/os/companies/alerts';
import type { PerformancePulse } from '@/lib/os/analytics/performancePulse';
import type { MediaLabSummary } from '@/lib/types/mediaLab';
import { deriveNextBestAction, getPriorityColorClasses } from '@/lib/os/companies/nextBestAction.types';
import type { CompanySummary } from '@/lib/os/companySummary';
import type { CompanyStatusSummary } from '@/lib/types/companyStatus';
import { type SetupStatus } from '@/lib/types/company';
import { ArrowRight, ClipboardList, CheckCircle, FileText, Brain, TrendingUp, Activity, Search, Zap, FolderKanban, Plus, Globe, ScrollText } from 'lucide-react';
import type { Project } from '@/lib/types/project';
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS, PROJECT_TYPE_LABELS } from '@/lib/types/project';
import { formatPercentChange, getChangeColorClass, getChangeArrow } from '@/lib/os/analytics/pulseUtils';

// ============================================================================
// Types
// ============================================================================

interface CompanyData {
  id: string;
  name: string;
  website?: string | null;
  industry?: string | null;
  stage?: string | null;
  companyType?: string | null;
  sizeBand?: string | null;
  owner?: string | null;
  hasMediaProgram?: boolean;
  setupStatus?: SetupStatus | string | null;
  lastSetupAt?: string | null;
  lastQbrAt?: string | null;
}

interface RecentDiagnostic {
  id: string;
  toolId: DiagnosticToolId;
  toolLabel: string;
  status: DiagnosticRunStatus;
  score: number | null;
  completedAt?: string | null;
  reportPath?: string | null;
}

interface QBRSummaryData {
  healthScore: number;
  overallHealthScore: number;
  diagnosticsScore: number | null;
  contextScore: number | null;
  activeWorkItems: number;
  unresolvedFindings: number;
  lastDiagnosticRun: string | null;
}

export interface CompanyOverviewPageProps {
  company: CompanyData;
  strategySnapshot: CompanyStrategicSnapshot | null;
  recentDiagnostics: RecentDiagnostic[];
  workSummary: CompanyWorkSummary;
  scoreTrends: CompanyScoreTrends;
  alerts: CompanyAlert[];
  performancePulse?: PerformancePulse | null;
  mediaLabSummary?: MediaLabSummary | null;
  summary?: CompanySummary;
  /** Status summary with GAP score from diagnostic runs */
  statusSummary?: CompanyStatusSummary | null;
  baselineStatus?: {
    initialized: boolean;
    initializedAt: string | null;
    healthScore?: number;
    completeness?: number;
  } | null;
  qbrSummary?: QBRSummaryData | null;
  /** Recent projects for quick access */
  recentProjects?: Project[];
  /** Company status header data (performance, work, next action) */
  statusHeader?: StatusHeaderData | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getScoreColor(score: number | null): string {
  if (score === null) return 'text-slate-400';
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-amber-400';
  return 'text-red-400';
}

function getMaturityStageStyle(stage: string | undefined): string {
  switch (stage) {
    case 'World-Class':
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    case 'Advanced':
      return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    case 'Good':
      return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    case 'Developing':
      return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
    case 'Emerging':
    case 'Foundational':
      return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
    case 'Basic':
    default:
      return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
  }
}

/**
 * Compute data sources for the DataConfidenceBadge based on available data
 */
function computeDataSources(
  strategySnapshot: CompanyStrategicSnapshot | null,
  recentDiagnostics: RecentDiagnostic[],
  summary?: CompanySummary
): DataSource[] {
  const sources: DataSource[] = [];

  // Brain Context
  const hasBrainData = !!strategySnapshot || !!summary?.brain;
  sources.push({
    id: 'brain',
    name: 'Brain Context',
    type: 'brain',
    lastUpdated: strategySnapshot?.updatedAt || summary?.brain?.lastUpdatedAt || null,
    status: hasBrainData ? 'fresh' : 'missing',
    refreshHref: '/c/{companyId}/brain',
    description: hasBrainData ? 'Company context and strategy data' : 'No brain context yet',
  });

  // Recent diagnostics
  const latestDiag = recentDiagnostics.find(d => d.status === 'complete');
  sources.push({
    id: 'diagnostics',
    name: 'Diagnostics',
    type: 'diagnostic',
    lastUpdated: latestDiag?.completedAt || null,
    status: latestDiag ? 'fresh' : 'missing',
    refreshHref: '/c/{companyId}/blueprint',
    description: latestDiag
      ? `Last run: ${latestDiag.toolLabel}`
      : 'No diagnostics run yet',
  });

  // Strategic Snapshot scores
  const hasScores = strategySnapshot?.overallScore != null || summary?.scores?.latestBlueprintScore != null;
  sources.push({
    id: 'scores',
    name: 'Health Scores',
    type: 'analytics',
    lastUpdated: strategySnapshot?.updatedAt || null,
    status: hasScores ? 'fresh' : 'missing',
    description: hasScores ? 'Overall health and maturity scores' : 'Run GAP or diagnostics',
  });

  return sources;
}

// ============================================================================
// Main Component
// ============================================================================

export function CompanyOverviewPage({
  company,
  strategySnapshot,
  recentDiagnostics,
  alerts,
  summary,
  statusSummary,
  qbrSummary,
  performancePulse,
  recentProjects,
  statusHeader,
}: CompanyOverviewPageProps) {
  // Extract company data (prefer summary when available)
  const companyId = summary?.companyId ?? company.id;

  // Prefer summary scores when available, with statusSummary.gapScore as fallback
  // Priority: 1. CompanySummary scores, 2. StrategySnapshot score, 3. StatusSummary GAP score
  const overallScore = summary?.scores.latestBlueprintScore ??
    strategySnapshot?.overallScore ??
    statusSummary?.gapScore ?? null;
  const maturityStage = summary?.scores.maturityStage ??
    strategySnapshot?.maturityStage ??
    statusSummary?.gapMaturity;

  // Derive next best action
  const nextBestAction = deriveNextBestAction(companyId, {
    alerts,
    snapshot: strategySnapshot,
  });
  const nextBestActionColors = getPriorityColorClasses(nextBestAction.priority);

  // Compute data sources for confidence badge
  const dataSources = computeDataSources(strategySnapshot, recentDiagnostics, summary);

  return (
    <div className="space-y-4">
      {/* ================================================================== */}
      {/* 0. COMPANY STATUS HEADER: Performance + Work + Next Action */}
      {/* ================================================================== */}
      {statusHeader && (
        <CompanyStatusHeader status={statusHeader} />
      )}

      {/* ================================================================== */}
      {/* 1. STATUS STRIP: Overall Health + Next Best Action + Data Confidence */}
      {/* ================================================================== */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Left: Overall Health */}
          <div className="flex items-center gap-5">
            {/* Score */}
            <div className="text-center">
              <div className={`text-3xl font-bold tabular-nums ${getScoreColor(overallScore)}`}>
                {overallScore ?? '—'}
              </div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">
                Overall Health
              </p>
            </div>

            {/* Maturity Stage */}
            {maturityStage && (
              <div className="text-center">
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getMaturityStageStyle(maturityStage)}`}
                >
                  {maturityStage}
                </span>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide mt-1">
                  Maturity
                </p>
              </div>
            )}

            {/* Helper text + Data Confidence */}
            <div className="hidden sm:flex items-center gap-3 pl-5 border-l border-slate-800">
              <p className="text-xs text-slate-400">
                Based on recent diagnostics
              </p>
              <DataConfidenceBadge
                companyId={companyId}
                sources={dataSources}
              />
            </div>
          </div>

          {/* Right: Next Best Action */}
          <div className={`flex items-center gap-3 p-3 rounded-lg ${nextBestActionColors.bg} border ${nextBestActionColors.border}`}>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">Next Best Action</p>
              <p className={`text-sm font-medium ${nextBestActionColors.text} truncate`}>
                {nextBestAction.action}
              </p>
            </div>
            {nextBestAction.linkPath && (
              <Link
                href={nextBestAction.linkPath}
                className={`flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${nextBestActionColors.bg} ${nextBestActionColors.text} hover:opacity-80 border ${nextBestActionColors.border}`}
              >
                Go
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>

        {/* Mobile: Data Confidence Badge */}
        <div className="sm:hidden mt-3 pt-3 border-t border-slate-800 flex items-center justify-between">
          <p className="text-xs text-slate-400">Based on recent diagnostics</p>
          <DataConfidenceBadge companyId={companyId} sources={dataSources} />
        </div>
      </div>

      {/* ================================================================== */}
      {/* 2. JOB LAUNCHER: "What would you like to do?" */}
      {/* ================================================================== */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
        <div className="mb-2.5">
          <h2 className="text-lg font-semibold text-white">What would you like to do?</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Choose a guided path to move this account forward.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {/* Run Diagnostics - actually executes Full GAP + Competition */}
          <RunDiagnosticsButton companyId={companyId} variant="card" />

          {/* Build the Plan */}
          <Link
            href={`/c/${companyId}/findings`}
            className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-slate-800/40 border border-slate-700/40 hover:border-blue-500/50 hover:bg-blue-500/5 hover:-translate-y-0.5 transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-500/15 flex items-center justify-center group-hover:bg-blue-500/25 transition-colors">
              <ClipboardList className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-center">
              <p className="text-xs font-medium text-slate-200">Build the Plan</p>
              <p className="text-[10px] text-slate-500">Prioritize findings</p>
            </div>
          </Link>

          {/* Track Work */}
          <Link
            href={`/c/${companyId}/work`}
            className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-slate-800/40 border border-slate-700/40 hover:border-emerald-500/50 hover:bg-emerald-500/5 hover:-translate-y-0.5 transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center group-hover:bg-emerald-500/25 transition-colors">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-center">
              <p className="text-xs font-medium text-slate-200">Track Work</p>
              <p className="text-[10px] text-slate-500">Manage tasks</p>
            </div>
          </Link>

          {/* Prepare QBR */}
          <Link
            href={`/c/${companyId}/reports/qbr`}
            className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-slate-800/40 border border-slate-700/40 hover:border-purple-500/50 hover:bg-purple-500/5 hover:-translate-y-0.5 transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-purple-500/15 flex items-center justify-center group-hover:bg-purple-500/25 transition-colors">
              <FileText className="w-5 h-5 text-purple-400" />
            </div>
            <div className="text-center">
              <p className="text-xs font-medium text-slate-200">Prepare QBR</p>
              <p className="text-[10px] text-slate-500">Generate review</p>
            </div>
          </Link>

          {/* Update Context */}
          <Link
            href={`/c/${companyId}/brain`}
            className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-slate-800/40 border border-slate-700/40 hover:border-cyan-500/50 hover:bg-cyan-500/5 hover:-translate-y-0.5 transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-cyan-500/15 flex items-center justify-center group-hover:bg-cyan-500/25 transition-colors">
              <Brain className="w-5 h-5 text-cyan-400" />
            </div>
            <div className="text-center">
              <p className="text-xs font-medium text-slate-200">Update Context</p>
              <p className="text-[10px] text-slate-500">Edit company data</p>
            </div>
          </Link>

          {/* View Reports */}
          <Link
            href={`/c/${companyId}/reports`}
            className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-slate-800/40 border border-slate-700/40 hover:border-amber-500/50 hover:bg-amber-500/5 hover:-translate-y-0.5 transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-amber-500/15 flex items-center justify-center group-hover:bg-amber-500/25 transition-colors">
              <ScrollText className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-center">
              <p className="text-xs font-medium text-slate-200">View Reports</p>
              <p className="text-[10px] text-slate-500">Lab diagnostics</p>
            </div>
          </Link>
        </div>
      </div>

      {/* ================================================================== */}
      {/* 3. PROJECTS (Creative Briefs) */}
      {/* ================================================================== */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-500/15 flex items-center justify-center">
              <FolderKanban className="w-4 h-4 text-orange-400" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-white">Projects</h3>
              <p className="text-[10px] text-slate-500">Scoped deliverables with creative briefs</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/c/${companyId}/projects/website-optimize/setup`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-cyan-400 bg-cyan-500/10 rounded-md border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors"
            >
              <Globe className="w-3 h-3" />
              Website Optimize
            </Link>
            <Link
              href={`/c/${companyId}/projects`}
              className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1"
            >
              View All
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {recentProjects && recentProjects.length > 0 ? (
          <div className="space-y-2">
            {recentProjects.slice(0, 5).map((project) => (
              <Link
                key={project.id}
                href={`/c/${companyId}/projects/${project.id}`}
                className="flex items-center justify-between p-3 rounded-lg bg-slate-800/40 border border-slate-700/40 hover:border-orange-500/30 hover:bg-orange-500/5 transition-all group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate group-hover:text-orange-300 transition-colors">
                      {project.name}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {PROJECT_TYPE_LABELS[project.type]}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`px-2 py-0.5 text-[10px] rounded ${PROJECT_STATUS_COLORS[project.status]}`}>
                    {PROJECT_STATUS_LABELS[project.status]}
                  </span>
                  {project.briefApproved && (
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" aria-label="Brief Approved" />
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <FolderKanban className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-xs text-slate-500 mb-3">No projects yet</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
              <Link
                href={`/c/${companyId}/projects/website-optimize/setup`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-cyan-400 bg-cyan-500/10 rounded-lg border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors"
              >
                <Globe className="w-3.5 h-3.5" />
                Start Website Optimization
              </Link>
              <Link
                href={`/c/${companyId}/projects`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-orange-400 bg-orange-500/10 rounded-lg border border-orange-500/20 hover:bg-orange-500/20 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Create Custom Project
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ================================================================== */}
      {/* 4. QBR HEALTH SUMMARY */}
      {/* ================================================================== */}
      {qbrSummary && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-white">QBR Health Summary</h3>
                <p className="text-[10px] text-slate-500">Quarterly business review readiness</p>
              </div>
            </div>
            <Link
              href={`/c/${companyId}/reports/qbr`}
              className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
            >
              View QBR
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Overall Health Score */}
            <div className="bg-slate-800/40 rounded-lg p-3 text-center">
              <div className={`text-xl font-bold tabular-nums ${getScoreColor(qbrSummary.overallHealthScore)}`}>
                {qbrSummary.overallHealthScore}
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">Health Score</p>
            </div>

            {/* Diagnostics Score */}
            <div className="bg-slate-800/40 rounded-lg p-3 text-center">
              <div className={`text-xl font-bold tabular-nums ${getScoreColor(qbrSummary.diagnosticsScore)}`}>
                {qbrSummary.diagnosticsScore ?? '—'}
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">Diagnostics Avg</p>
            </div>

            {/* Active Work */}
            <div className="bg-slate-800/40 rounded-lg p-3 text-center">
              <div className="text-xl font-bold tabular-nums text-blue-400">
                {qbrSummary.activeWorkItems}
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">Active Work</p>
            </div>

            {/* Unresolved Findings */}
            <div className="bg-slate-800/40 rounded-lg p-3 text-center">
              <div className={`text-xl font-bold tabular-nums ${qbrSummary.unresolvedFindings > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {qbrSummary.unresolvedFindings}
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">Open Findings</p>
            </div>
          </div>

          {/* Last diagnostic run */}
          {qbrSummary.lastDiagnosticRun && (
            <p className="text-[10px] text-slate-500 mt-2 text-right">
              Last diagnostic: {new Date(qbrSummary.lastDiagnosticRun).toLocaleDateString()}
            </p>
          )}
        </div>
      )}

      {/* ================================================================== */}
      {/* 5. PERFORMANCE PULSE (7-day analytics) */}
      {/* ================================================================== */}
      {performancePulse && (performancePulse.hasGa4 || performancePulse.hasGsc) && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/15 flex items-center justify-center">
                <Activity className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-white">Performance Pulse</h3>
                <p className="text-[10px] text-slate-500">7-day analytics from connected integrations</p>
              </div>
            </div>
            {performancePulse.hasAnomalies && performancePulse.anomalySummary && (
              <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-1 rounded-md border border-amber-500/20">
                {performancePulse.anomalySummary}
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {/* Traffic (GA4) */}
            {performancePulse.hasGa4 && (
              <div className="bg-slate-800/40 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[10px] text-slate-500 uppercase tracking-wide">Traffic</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold tabular-nums text-white">
                    {performancePulse.currentSessions?.toLocaleString() ?? '—'}
                  </span>
                  <span className={`text-xs font-medium ${getChangeColorClass(performancePulse.trafficChange7d)}`}>
                    {getChangeArrow(performancePulse.trafficChange7d)} {formatPercentChange(performancePulse.trafficChange7d)}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">sessions vs prior week</p>
              </div>
            )}

            {/* Conversions (GA4) */}
            {performancePulse.hasGa4 && (
              <div className="bg-slate-800/40 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[10px] text-slate-500 uppercase tracking-wide">Conversions</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold tabular-nums text-white">
                    {performancePulse.currentConversions?.toLocaleString() ?? '—'}
                  </span>
                  <span className={`text-xs font-medium ${getChangeColorClass(performancePulse.conversionsChange7d)}`}>
                    {getChangeArrow(performancePulse.conversionsChange7d)} {formatPercentChange(performancePulse.conversionsChange7d)}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">vs prior week</p>
              </div>
            )}

            {/* SEO Visibility (GSC) */}
            {performancePulse.hasGsc && (
              <div className="bg-slate-800/40 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Search className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-[10px] text-slate-500 uppercase tracking-wide">SEO Clicks</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold tabular-nums text-white">
                    {performancePulse.currentClicks?.toLocaleString() ?? '—'}
                  </span>
                  <span className={`text-xs font-medium ${getChangeColorClass(performancePulse.seoVisibilityChange7d)}`}>
                    {getChangeArrow(performancePulse.seoVisibilityChange7d)} {formatPercentChange(performancePulse.seoVisibilityChange7d)}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">vs prior week</p>
              </div>
            )}
          </div>

          {/* Not connected message */}
          {!performancePulse.hasGa4 && !performancePulse.hasGsc && (
            <div className="text-center py-4">
              <p className="text-xs text-slate-500">
                Connect GA4 and Search Console in{' '}
                <Link href={`/c/${companyId}/brain/setup?step=9`} className="text-cyan-400 hover:underline">
                  Setup → Measurement
                </Link>
              </p>
            </div>
          )}
        </div>
      )}

      {/* ================================================================== */}
      {/* 6. NEXT BEST ACTIONS */}
      {/* ================================================================== */}
      <NextBestActionsCard
        companyId={companyId}
        limit={3}
        title="Next Best Actions"
        subtitle="Highest impact moves based on current diagnostics and plan."
        showViewAll
      />

      {/* ================================================================== */}
      {/* 7. RECENT ACTIVITY SNIPPET */}
      {/* ================================================================== */}
      <div className="border-t border-slate-800/40 pt-4">
        <ActivitySnippet companyId={companyId} />
      </div>
    </div>
  );
}

export default CompanyOverviewPage;
