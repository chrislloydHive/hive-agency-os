'use client';

// components/os/CompanyOverviewPage.tsx
// Slim Company Overview - Orientation + Direction Only
//
// This is the intentionally calm landing page when viewing a company.
// The layout provides: company name, website, back link, and tabs.
// This component focuses on:
// 1. Decision Entry Point: "What do you need help with?"
// 2. Health/Freshness strip: Where are we?

import Link from 'next/link';
import { IntentSelector, type PrimaryIntent } from './IntentSelector';
import type { CompanyStrategicSnapshot } from '@/lib/airtable/companyStrategySnapshot';
import type { DiagnosticRunStatus, DiagnosticToolId, CompanyScoreTrends } from '@/lib/os/diagnostics/runs';
import type { CompanyWorkSummary } from '@/lib/os/companies/workSummary';
import type { CompanyAlert } from '@/lib/os/companies/alerts';
import type { PerformancePulse } from '@/lib/os/analytics/performancePulse';
import type { MediaLabSummary } from '@/lib/types/mediaLab';
import type { CompanySummary } from '@/lib/os/companySummary';
import { type SetupStatus } from '@/lib/types/company';
import { Activity, Clock, CheckCircle, AlertCircle } from 'lucide-react';

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
  baselineStatus?: {
    initialized: boolean;
    initializedAt: string | null;
    healthScore?: number;
    completeness?: number;
  } | null;
  qbrSummary?: QBRSummaryData | null;
  /** Current primary intent (if set) */
  primaryIntent?: PrimaryIntent | null;
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

function getScoreBgColor(score: number | null): string {
  if (score === null) return 'bg-slate-500/10';
  if (score >= 80) return 'bg-emerald-500/10';
  if (score >= 60) return 'bg-amber-500/10';
  return 'bg-red-500/10';
}

function formatTimeAgo(dateString: string | null | undefined): string {
  if (!dateString) return '';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffDays > 30) {
    const diffMonths = Math.floor(diffDays / 30);
    return `${diffMonths} month${diffMonths === 1 ? '' : 's'} ago`;
  }
  if (diffDays > 0) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  }
  if (diffHours > 0) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  }
  return 'just now';
}

// ============================================================================
// Main Component
// ============================================================================

export function CompanyOverviewPage({
  company,
  strategySnapshot,
  recentDiagnostics,
  summary,
  primaryIntent,
}: CompanyOverviewPageProps) {
  // Extract company data (prefer summary when available)
  const companyId = summary?.companyId ?? company.id;

  // Prefer summary scores when available
  const overallScore = summary?.scores.latestBlueprintScore ??
    strategySnapshot?.overallScore ?? null;

  // Get latest completed diagnostic
  const latestDiagnostic = recentDiagnostics.find(d => d.status === 'complete');
  const hasDiagnostics = !!latestDiagnostic;

  return (
    <div className="space-y-6">
      {/* ================================================================== */}
      {/* 1. DECISION ENTRY POINT: "What do you need help with?" */}
      {/* ================================================================== */}
      <IntentSelector
        companyId={companyId}
        currentIntent={primaryIntent}
      />

      {/* ================================================================== */}
      {/* 2. HEALTH / FRESHNESS STRIP: "Where are we?" */}
      {/* ================================================================== */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-4">
        <div className="flex items-center justify-between">
          {/* Left: Health Score */}
          <div className="flex items-center gap-4">
            <div className={`flex items-center justify-center w-14 h-14 rounded-xl ${getScoreBgColor(overallScore)}`}>
              <span className={`text-2xl font-bold tabular-nums ${getScoreColor(overallScore)}`}>
                {overallScore ?? '—'}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-white">
                {overallScore !== null ? 'Overall Health' : 'No health score yet'}
              </p>
              <p className="text-xs text-slate-500">
                {overallScore !== null
                  ? overallScore >= 80
                    ? 'Looking good'
                    : overallScore >= 60
                      ? 'Room for improvement'
                      : 'Needs attention'
                  : 'Run diagnostics to establish baseline'
                }
              </p>
            </div>
          </div>

          {/* Right: Last Diagnostic */}
          <div className="text-right">
            {hasDiagnostics ? (
              <Link
                href={latestDiagnostic.reportPath || `/c/${companyId}/diagnostics`}
                className="group"
              >
                <div className="flex items-center gap-2 justify-end text-emerald-400 group-hover:text-emerald-300">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">{latestDiagnostic.toolLabel}</span>
                </div>
                <div className="flex items-center gap-1.5 justify-end text-xs text-slate-500 mt-0.5">
                  <Clock className="w-3 h-3" />
                  <span>{formatTimeAgo(latestDiagnostic.completedAt)}</span>
                </div>
              </Link>
            ) : (
              <div>
                <div className="flex items-center gap-2 justify-end text-slate-400">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">No diagnostics yet</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select an option above to get started
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CompanyOverviewPage;
