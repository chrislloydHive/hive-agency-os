'use client';

// app/c/[companyId]/reports/ReportsHubClient.tsx
// Reports Hub Client - Modern Report Hub Dashboard
//
// Features:
// - Tab navigation: All | Strategic | Diagnostics
// - Strategic Reports section (hero cards row)
// - Diagnostics Summary strip (bold stats band)
// - Diagnostics History card (table with filters + empty states)
//
// Visual style matches QBR Story View, Plan, and Diagnostics pages.

import { useState } from 'react';
import { StrategicReportsSection } from '@/components/reports/StrategicReportsSection';
import { ReportStatsStrip } from '@/components/reports/ReportStatsStrip';
import { DiagnosticsHistoryCard, type DiagnosticRunSummary } from '@/components/reports/DiagnosticsHistoryCard';
import type { ReportListItem } from '@/lib/reports/types';

// ============================================================================
// Types
// ============================================================================

interface Props {
  companyId: string;
  companyName: string;
  latestAnnual: ReportListItem | null;
  latestQbr: ReportListItem | null;
  diagnosticRuns: DiagnosticRunSummary[];
}

type TabValue = 'all' | 'strategic' | 'diagnostics';

// ============================================================================
// Tab Configuration
// ============================================================================

const TABS: { value: TabValue; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'strategic', label: 'Strategic' },
  { value: 'diagnostics', label: 'Diagnostics' },
];

// ============================================================================
// Main Component
// ============================================================================

export function ReportsHubClient({
  companyId,
  companyName,
  latestAnnual,
  latestQbr,
  diagnosticRuns,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabValue>('all');

  const hasDiagnostics = diagnosticRuns.length > 0;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Tab Navigation */}
      <div className="flex items-center gap-1 p-1 bg-slate-900/60 rounded-xl border border-slate-800/80 w-fit mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
              activeTab === tab.value
                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50 border border-transparent'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {/* ============================================================ */}
        {/* All Tab - Shows all sections */}
        {/* ============================================================ */}
        {activeTab === 'all' && (
          <>
            {/* Strategic Reports */}
            <StrategicReportsSection
              companyId={companyId}
              latestAnnual={latestAnnual}
              latestQbr={latestQbr}
            />

            {/* Diagnostics Summary Strip (only if has runs) */}
            {hasDiagnostics && (
              <ReportStatsStrip
                companyId={companyId}
                runs={diagnosticRuns}
              />
            )}

            {/* Diagnostics History */}
            <DiagnosticsHistoryCard
              companyId={companyId}
              runs={diagnosticRuns}
            />
          </>
        )}

        {/* ============================================================ */}
        {/* Strategic Tab - Only strategic reports */}
        {/* ============================================================ */}
        {activeTab === 'strategic' && (
          <StrategicReportsSection
            companyId={companyId}
            latestAnnual={latestAnnual}
            latestQbr={latestQbr}
          />
        )}

        {/* ============================================================ */}
        {/* Diagnostics Tab - Summary strip + history */}
        {/* ============================================================ */}
        {activeTab === 'diagnostics' && (
          <>
            {/* Diagnostics Summary Strip (only if has runs) */}
            {hasDiagnostics && (
              <ReportStatsStrip
                companyId={companyId}
                runs={diagnosticRuns}
              />
            )}

            {/* Diagnostics History */}
            <DiagnosticsHistoryCard
              companyId={companyId}
              runs={diagnosticRuns}
            />
          </>
        )}
      </div>
    </div>
  );
}
