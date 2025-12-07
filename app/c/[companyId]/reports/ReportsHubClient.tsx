'use client';

// app/c/[companyId]/reports/ReportsHubClient.tsx
// Reports Hub Client - Tabbed dashboard for Strategic Reports and Diagnostics
//
// Features:
// - Tab navigation: All | Strategic | Diagnostics
// - Strategic Reports section (Annual Plan + QBR)
// - Diagnostics History section (filterable table)

import { useState } from 'react';
import { StrategicReportsSection } from '@/components/reports/StrategicReportsSection';
import { DiagnosticsSection, type DiagnosticRunSummary } from '@/components/reports/DiagnosticsSection';
import type { ReportListItem } from '@/lib/reports/types';

interface Props {
  companyId: string;
  companyName: string;
  latestAnnual: ReportListItem | null;
  latestQbr: ReportListItem | null;
  diagnosticRuns: DiagnosticRunSummary[];
}

type TabValue = 'all' | 'strategic' | 'diagnostics';

export function ReportsHubClient({
  companyId,
  companyName,
  latestAnnual,
  latestQbr,
  diagnosticRuns,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabValue>('all');

  const tabs: { value: TabValue; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'strategic', label: 'Strategic' },
    { value: 'diagnostics', label: 'Diagnostics' },
  ];

  return (
    <div>
      {/* Tab Navigation */}
      <div className="flex items-center gap-1 p-1 bg-slate-900/50 rounded-lg border border-slate-800 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
              activeTab === tab.value
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50 border border-transparent'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="mt-8">
        {/* All Tab - Shows both sections */}
        {activeTab === 'all' && (
          <div className="space-y-10">
            <StrategicReportsSection
              companyId={companyId}
              latestAnnual={latestAnnual}
              latestQbr={latestQbr}
            />
            <DiagnosticsSection
              companyId={companyId}
              runs={diagnosticRuns}
            />
          </div>
        )}

        {/* Strategic Tab - Only strategic reports */}
        {activeTab === 'strategic' && (
          <StrategicReportsSection
            companyId={companyId}
            latestAnnual={latestAnnual}
            latestQbr={latestQbr}
          />
        )}

        {/* Diagnostics Tab - Only diagnostics history */}
        {activeTab === 'diagnostics' && (
          <DiagnosticsSection
            companyId={companyId}
            runs={diagnosticRuns}
          />
        )}
      </div>
    </div>
  );
}
