'use client';
// components/website/v5/V5ResultsPanel.tsx
// V5 Results Panel - Main container for complete V5 diagnostic display

import { useState } from 'react';
import type { V5DiagnosticOutput } from '@/lib/types/websiteLabV5';
import { V5HeaderSummary } from './V5HeaderSummary';
import { V5BlockingIssues } from './V5BlockingIssues';
import { V5PersonaJourneys } from './V5PersonaJourneys';
import { V5PageObservations } from './V5PageObservations';
import { V5Recommendations } from './V5Recommendations';

// Re-export the type for convenience
export type V5DiagnosticData = V5DiagnosticOutput;

type TabId = 'issues' | 'journeys' | 'recommendations' | 'observations';

type Props = {
  data: V5DiagnosticData;
  companyId?: string;
  runId?: string;
};

function TabButton({
  id,
  label,
  count,
  isActive,
  onClick,
  alertCount,
}: {
  id: TabId;
  label: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
  alertCount?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
        isActive
          ? 'text-slate-100 border-blue-500'
          : 'text-slate-400 border-transparent hover:text-slate-200 hover:border-slate-600'
      }`}
    >
      {label}
      <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
        isActive ? 'bg-blue-500/20 text-blue-300' : 'bg-slate-700 text-slate-400'
      }`}>
        {count}
      </span>
      {alertCount && alertCount > 0 && (
        <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-300">
          {alertCount}
        </span>
      )}
    </button>
  );
}

export function V5ResultsPanel({ data }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('issues');

  if (!data) {
    return (
      <div className="border border-slate-700 rounded-lg bg-slate-800/30 p-8 text-center">
        <p className="text-slate-400">No V5 diagnostic data available.</p>
      </div>
    );
  }

  // Calculate counts for tabs
  const issuesCount = data.blockingIssues?.length || 0;
  const highSeverityCount = data.blockingIssues?.filter(i => i.severity === 'high').length || 0;
  const journeysCount = data.personaJourneys?.length || 0;
  const failedJourneysCount = data.personaJourneys?.filter(j => !j.succeeded).length || 0;
  const recommendationsCount = (data.quickWins?.length || 0) + (data.structuralChanges?.length || 0);
  const observationsCount = data.observations?.length || 0;

  return (
    <div className="space-y-6">
      {/* Header Summary - Always visible */}
      <V5HeaderSummary output={data} />

      {/* Tab Navigation */}
      <div className="border-b border-slate-700 flex items-center gap-1 overflow-x-auto">
        <TabButton
          id="issues"
          label="Blocking Issues"
          count={issuesCount}
          alertCount={highSeverityCount}
          isActive={activeTab === 'issues'}
          onClick={() => setActiveTab('issues')}
        />
        <TabButton
          id="journeys"
          label="Persona Journeys"
          count={journeysCount}
          alertCount={failedJourneysCount}
          isActive={activeTab === 'journeys'}
          onClick={() => setActiveTab('journeys')}
        />
        <TabButton
          id="recommendations"
          label="Recommendations"
          count={recommendationsCount}
          isActive={activeTab === 'recommendations'}
          onClick={() => setActiveTab('recommendations')}
        />
        <TabButton
          id="observations"
          label="Page Details"
          count={observationsCount}
          isActive={activeTab === 'observations'}
          onClick={() => setActiveTab('observations')}
        />
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'issues' && (
          <V5BlockingIssues issues={data.blockingIssues || []} />
        )}
        {activeTab === 'journeys' && (
          <V5PersonaJourneys journeys={data.personaJourneys || []} />
        )}
        {activeTab === 'recommendations' && (
          <V5Recommendations
            quickWins={data.quickWins || []}
            structuralChanges={data.structuralChanges || []}
          />
        )}
        {activeTab === 'observations' && (
          <V5PageObservations observations={data.observations || []} />
        )}
      </div>
    </div>
  );
}
