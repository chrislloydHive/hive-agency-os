// components/competition/CompetitionLabV5.tsx
// Competition Lab V5 - Updated UI matching Website Lab V5 pattern
//
// Features:
// - V5-style header summary with score gauge and stats
// - Clean tab navigation matching V5ResultsPanel
// - Strategist View (default): AI-generated strategic intelligence
// - Data View: Full V3 positioning map and competitor list

'use client';

import { useState, useCallback, useMemo } from 'react';
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
// Sub-components
// ============================================================================

function ThreatGauge({ score }: { score: number }) {
  // Calculate stroke dasharray for the circular progress
  const circumference = 2 * Math.PI * 45; // radius = 45
  const strokeDashoffset = circumference - (score / 100) * circumference;

  // Determine color based on threat level
  let colorClass = 'text-emerald-400';
  if (score >= 70) colorClass = 'text-red-400';
  else if (score >= 50) colorClass = 'text-amber-400';
  else if (score >= 30) colorClass = 'text-yellow-400';

  return (
    <div className="relative w-28 h-28">
      {/* Background circle */}
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-slate-700"
        />
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={colorClass}
          style={{ transition: 'stroke-dashoffset 0.5s ease-in-out' }}
        />
      </svg>

      {/* Score text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-bold ${colorClass}`}>{score}</span>
        <span className="text-xs text-slate-500">/ 100</span>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-slate-400 mt-0.5">{label}</div>
    </div>
  );
}

function TabButton({
  id,
  label,
  count,
  isActive,
  onClick,
}: {
  id: LabTab;
  label: string;
  count?: number;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
        isActive
          ? 'text-slate-100 border-purple-500'
          : 'text-slate-400 border-transparent hover:text-slate-200 hover:border-slate-600'
      }`}
    >
      {label}
      {count !== undefined && (
        <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
          isActive ? 'bg-purple-500/20 text-purple-300' : 'bg-slate-700 text-slate-400'
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}

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

// ============================================================================
// Header Summary Component
// ============================================================================

function CompetitionHeaderSummary({
  totalCompetitors,
  coreCompetitors,
  avgThreatScore,
  strategicSummary,
  lastRunAt,
  onRunAnalysis,
  isRunning,
}: {
  totalCompetitors: number;
  coreCompetitors: number;
  avgThreatScore: number;
  strategicSummary?: string;
  lastRunAt?: string;
  onRunAnalysis: () => void;
  isRunning: boolean;
}) {
  // Determine threat level label
  let threatLabel = 'Low Pressure';
  let threatBgColor = 'bg-emerald-500/20';
  let threatTextColor = 'text-emerald-400';
  if (avgThreatScore >= 70) {
    threatLabel = 'High Threat';
    threatBgColor = 'bg-red-500/20';
    threatTextColor = 'text-red-400';
  } else if (avgThreatScore >= 50) {
    threatLabel = 'Moderate Threat';
    threatBgColor = 'bg-amber-500/20';
    threatTextColor = 'text-amber-400';
  } else if (avgThreatScore >= 30) {
    threatLabel = 'Some Competition';
    threatBgColor = 'bg-yellow-500/20';
    threatTextColor = 'text-yellow-400';
  }

  return (
    <div className="border border-slate-700 rounded-lg bg-slate-800/30 overflow-hidden">
      {/* Top section - Score and Summary */}
      <div className="p-6 flex items-start gap-6">
        {/* Threat gauge */}
        <ThreatGauge score={avgThreatScore} />

        {/* Summary and actions */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${threatBgColor} ${threatTextColor}`}>
                {threatLabel}
              </span>
              <span className="text-sm text-slate-500">
                Average Threat Score
              </span>
            </div>

            {/* Run button */}
            <button
              onClick={onRunAnalysis}
              disabled={isRunning}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                isRunning
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white'
              }`}
            >
              {isRunning ? (
                <span className="flex items-center gap-2">
                  <Spinner />
                  Running...
                </span>
              ) : totalCompetitors > 0 ? (
                'Re-run Analysis'
              ) : (
                'Run Analysis'
              )}
            </button>
          </div>

          <p className="text-sm text-slate-300 leading-relaxed">
            {strategicSummary || 'Run competitive analysis to discover competitors, classify them by type, and generate strategic insights.'}
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="px-6 pb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Total Competitors"
            value={totalCompetitors}
            color="text-slate-100"
          />
          <StatCard
            label="Direct Threats"
            value={coreCompetitors}
            color={coreCompetitors > 0 ? 'text-red-400' : 'text-slate-400'}
          />
          <StatCard
            label="Avg Threat"
            value={`${avgThreatScore}/100`}
            color={avgThreatScore >= 50 ? 'text-amber-400' : 'text-emerald-400'}
          />
          <StatCard
            label="Market Position"
            value={avgThreatScore >= 70 ? 'Crowded' : avgThreatScore >= 40 ? 'Competitive' : 'Open'}
            color="text-indigo-400"
          />
        </div>
      </div>

      {/* Footer with last run info */}
      {lastRunAt && (
        <div className="px-6 py-3 bg-slate-800/50 border-t border-slate-700/50 flex items-center justify-between text-xs text-slate-500">
          <span>
            Last updated: {new Date(lastRunAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Empty State
// ============================================================================

function EmptyState({ onRunAnalysis, isRunning }: { onRunAnalysis: () => void; isRunning: boolean }) {
  return (
    <div className="space-y-6">
      {/* Header with run button */}
      <div className="border border-slate-700 rounded-lg bg-slate-800/30 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white mb-1">Competitive Landscape</h2>
            <p className="text-sm text-slate-400">
              Discover competitors, analyze threat levels, and generate strategic insights.
            </p>
          </div>
          <button
            onClick={onRunAnalysis}
            disabled={isRunning}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              isRunning
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white'
            }`}
          >
            {isRunning ? (
              <span className="flex items-center gap-2">
                <Spinner />
                Running...
              </span>
            ) : (
              'Run Analysis'
            )}
          </button>
        </div>
      </div>

      {/* Empty state illustration */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-12 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center">
            <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <p className="text-slate-300 text-sm font-medium mb-2">No competitive analysis yet</p>
          <p className="text-slate-500 text-xs leading-relaxed">
            Run Competition Analysis to discover competitors, classify them by type,
            and generate strategic insights for positioning.
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function CompetitionLabV5({ companyId, companyName }: Props) {
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

  // Calculate direct/core competitors count
  const coreCompetitorsCount = useMemo(() => {
    if (!runData?.competitors) return 0;
    return runData.competitors.filter(c => c.type === 'direct').length;
  }, [runData?.competitors]);

  // Get strategic summary from strategist (using elevator field)
  const strategicSummary = useMemo(() => {
    if (!strategist?.elevator) return undefined;
    // Take first sentence or first 200 chars
    const summary = strategist.elevator;
    const firstSentence = summary.split('.')[0];
    return firstSentence.length > 200 ? summary.slice(0, 200) + '...' : firstSentence + '.';
  }, [strategist?.elevator]);

  // If no run yet, show empty state
  if (!runData && !runLoading && !isRunning) {
    return <EmptyState onRunAnalysis={handleRunDiscovery} isRunning={isRunning} />;
  }

  return (
    <div className="space-y-6">
      {/* Progress Banner (when running) */}
      {isRunning && (
        <div className="rounded-lg bg-purple-500/10 border border-purple-500/30 p-3 flex items-center gap-3">
          <div className="flex-shrink-0">
            <svg className="animate-spin h-5 w-5 text-purple-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-purple-300">Analyzing competitive landscape...</p>
            <p className="text-xs text-purple-400/70">This typically takes 30-60 seconds</p>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {(runError || runFailError) && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-4 text-sm text-red-400">
          <div className="font-medium">{runError ? 'Error loading data' : 'Analysis failed'}</div>
          <div className="mt-1">{runError || runFailError}</div>
        </div>
      )}

      {/* Header Summary - V5 style */}
      {runData && (
        <CompetitionHeaderSummary
          totalCompetitors={runData.summary.totalCompetitors}
          coreCompetitors={coreCompetitorsCount}
          avgThreatScore={runData.summary.avgThreatScore}
          strategicSummary={strategicSummary}
          lastRunAt={runData.completedAt}
          onRunAnalysis={handleRunDiscovery}
          isRunning={isRunning}
        />
      )}

      {/* Loading skeleton for header */}
      {runLoading && !runData && (
        <div className="border border-slate-700 rounded-lg bg-slate-800/30 p-6 animate-pulse">
          <div className="flex items-start gap-6">
            <div className="w-28 h-28 rounded-full bg-slate-700" />
            <div className="flex-1 space-y-3">
              <div className="h-8 w-32 bg-slate-700 rounded-full" />
              <div className="h-4 w-full bg-slate-700 rounded" />
              <div className="h-4 w-3/4 bg-slate-700 rounded" />
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation - V5 style */}
      {runData && (
        <>
          <div className="border-b border-slate-700 flex items-center gap-1 overflow-x-auto">
            <TabButton
              id="strategist"
              label="Strategic View"
              isActive={activeTab === 'strategist'}
              onClick={() => setActiveTab('strategist')}
            />
            <TabButton
              id="data"
              label="Competitor Data"
              count={runData.summary.totalCompetitors}
              isActive={activeTab === 'data'}
              onClick={() => setActiveTab('data')}
            />
          </div>

          {/* Tab Content */}
          <div className="min-h-[400px]">
            {activeTab === 'strategist' ? (
              strategistLoading ? (
                <StrategistViewSkeleton />
              ) : strategistError || !strategist ? (
                <StrategistViewError message={strategistResponse?.error} />
              ) : (
                <CompetitionLabStrategistView
                  strategist={strategist}
                  verticalCategory={runData?.queryContext?.verticalCategory}
                />
              )
            ) : (
              <CompetitionLabDataView
                companyId={companyId}
                companyName={companyName}
                data={runData}
                isLoading={runLoading}
                businessModelCategory={runData?.queryContext?.businessModelCategory ?? null}
                verticalCategory={runData?.queryContext?.verticalCategory ?? null}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
