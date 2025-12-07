// components/competition/CompetitionLabV4.tsx
// Competition Lab V4 - Main Client Component with Strategist/Data Tabs
//
// Features:
// - Strategist View (default): AI-generated strategic intelligence
// - Data View: Full V3 positioning map and competitor list
// - Shared header with run controls

'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { CompetitionLabStrategistView, StrategistViewSkeleton, StrategistViewError } from './CompetitionLabStrategistView';
import { CompetitionLabDataView } from './CompetitionLabDataView';
import { useCompetitionV3 } from './useCompetitionV3';
import type { CompetitionStrategistModel } from '@/lib/competition-v3/strategist-types';

// ============================================================================
// Types
// ============================================================================

interface Props {
  companyId: string;
  companyName: string;
}

type LabTab = 'strategist' | 'data';

// Fetcher for SWR
const fetcher = (url: string) => fetch(url).then(res => res.json());

// ============================================================================
// Component
// ============================================================================

export function CompetitionLabV4({ companyId, companyName }: Props) {
  const [activeTab, setActiveTab] = useState<LabTab>('strategist');

  // Fetch V3 data
  const {
    data: runData,
    isLoading: runLoading,
    isRunning,
    error: runError,
    runError: runFailError,
    refetch,
    runDiscovery,
  } = useCompetitionV3(companyId);

  // Fetch strategist model (only when we have a run)
  const {
    data: strategistResponse,
    isLoading: strategistLoading,
    error: strategistError,
    mutate: refetchStrategist,
  } = useSWR<{ success: boolean; strategist?: CompetitionStrategistModel; error?: string }>(
    runData ? `/api/os/companies/${companyId}/competition/strategist` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // Cache for 1 minute
    }
  );

  const strategist = strategistResponse?.success ? strategistResponse.strategist : null;

  // Handle run discovery with refetch of strategist
  const handleRunDiscovery = useCallback(async () => {
    await runDiscovery();
    // After successful run, refetch strategist
    refetchStrategist();
  }, [runDiscovery, refetchStrategist]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    await refetch();
    refetchStrategist();
  }, [refetch, refetchStrategist]);

  const tabs: { id: LabTab; label: string }[] = [
    { id: 'strategist', label: 'Strategist' },
    { id: 'data', label: 'Data' },
  ];

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between bg-slate-900/50 border border-slate-800 rounded-lg p-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Competition Lab</h2>
          <p className="text-xs text-slate-400">
            {runData
              ? `${runData.summary.totalCompetitors} competitors analyzed • Avg threat: ${runData.summary.avgThreatScore}/100`
              : 'Discover and analyze your competitive landscape'
            }
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Run Button */}
          <button
            onClick={handleRunDiscovery}
            disabled={isRunning}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              isRunning
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white'
            }`}
          >
            {isRunning ? (
              <span className="flex items-center gap-2">
                <Spinner />
                Running...
              </span>
            ) : runData ? (
              'Re-run Analysis'
            ) : (
              'Run Competition Analysis'
            )}
          </button>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={runLoading}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-300 hover:bg-slate-800 transition-colors"
            title="Refresh"
          >
            <svg className={`w-5 h-5 ${runLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {(runError || runFailError) && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-4 text-sm text-red-400">
          <div className="font-medium">{runError ? 'Error loading data' : 'Run failed'}</div>
          <div className="mt-1">{runError || runFailError}</div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-slate-800 pb-0">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? tab.id === 'strategist'
                  ? 'text-amber-400 border-amber-400'
                  : 'text-slate-100 border-slate-400'
                : 'text-slate-400 border-transparent hover:text-slate-300 hover:border-slate-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="mt-4">
        {activeTab === 'strategist' ? (
          !runData ? (
            <EmptyState />
          ) : strategistLoading ? (
            <StrategistViewSkeleton />
          ) : strategistError || !strategist ? (
            <StrategistViewError message={strategistResponse?.error} />
          ) : (
            <CompetitionLabStrategistView strategist={strategist} />
          )
        ) : (
          <CompetitionLabDataView
            companyId={companyId}
            companyName={companyName}
            data={runData}
            isLoading={runLoading}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Empty State
// ============================================================================

function EmptyState() {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-12 flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center">
          <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        </div>
        <p className="text-slate-300 text-sm font-medium mb-2">No analysis yet</p>
        <p className="text-slate-500 text-xs leading-relaxed">
          Run Competition Analysis to discover competitors, classify them by type,
          and generate strategic insights.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Spinner
// ============================================================================

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
