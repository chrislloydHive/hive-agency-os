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
import { DataConfidenceBadge, type DataSource } from '@/components/diagnostics/DataConfidenceBadge';
import type { CompanyStrategicSnapshot } from '@/lib/airtable/companyStrategySnapshot';
import type { DiagnosticRunStatus, DiagnosticToolId, CompanyScoreTrends } from '@/lib/os/diagnostics/runs';
import type { CompanyWorkSummary } from '@/lib/os/companies/workSummary';
import type { CompanyAlert } from '@/lib/os/companies/alerts';
import type { PerformancePulse } from '@/lib/os/analytics/performancePulse';
import type { MediaLabSummary } from '@/lib/types/mediaLab';
import { deriveNextBestAction, getPriorityColorClasses } from '@/lib/os/companies/nextBestAction';
import type { CompanySummary } from '@/lib/os/companySummary';
import { type SetupStatus } from '@/lib/types/company';
import { ArrowRight, BarChart3, ClipboardList, CheckCircle, FileText, Brain } from 'lucide-react';

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
  baselineStatus?: {
    initialized: boolean;
    initializedAt: string | null;
    healthScore?: number;
    completeness?: number;
  } | null;
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
}: CompanyOverviewPageProps) {
  // Extract company data (prefer summary when available)
  const companyId = summary?.companyId ?? company.id;

  // Prefer summary scores when available
  const overallScore = summary?.scores.latestBlueprintScore ??
    strategySnapshot?.overallScore ?? null;
  const maturityStage = summary?.scores.maturityStage ??
    strategySnapshot?.maturityStage;

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

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {/* Run Diagnostics */}
          <Link
            href={`/c/${companyId}/blueprint`}
            className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-slate-800/40 border border-slate-700/40 hover:border-amber-500/50 hover:bg-amber-500/5 hover:-translate-y-0.5 transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-amber-500/15 flex items-center justify-center group-hover:bg-amber-500/25 transition-colors">
              <BarChart3 className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-center">
              <p className="text-xs font-medium text-slate-200">Run Diagnostics</p>
              <p className="text-[10px] text-slate-500">Full scan</p>
            </div>
          </Link>

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
        </div>
      </div>

      {/* ================================================================== */}
      {/* 3. RECENT ACTIVITY SNIPPET */}
      {/* ================================================================== */}
      <div className="border-t border-slate-800/40 pt-4">
        <ActivitySnippet companyId={companyId} />
      </div>
    </div>
  );
}

export default CompanyOverviewPage;
