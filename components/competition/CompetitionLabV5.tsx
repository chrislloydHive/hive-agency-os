// components/competition/CompetitionLabV5.tsx
// Competition Lab V5 - Full V4 Data Integration
//
// AUTHORITATIVE MODE:
// - NO user toggles for competitor inclusion/exclusion
// - System deterministically decides competitor placement
// - Transparency via declarative copy, not user delegation
//
// Features:
// - V4 data with tiered competitor buckets (primary, contextual, alternatives, excluded)
// - Competitive Context Banner with authoritative modality inference
// - Competitive Pressure Matrix (multi-dimensional, replaces single threat score)
// - Tiered Competitor Sections with rich per-competitor details
// - Strategic Narrative Panel with derived insights
//
// Product Principle: Hive OS explains competition — it does not ask users to define it.

'use client';

import { useState, useCallback } from 'react';
import { useCompetitionV4, getCompetitorCounts } from './useCompetitionV4';
import {
  CompetitiveContextBanner,
  TieredCompetitorSections,
  CompetitivePressureMatrix,
  StrategicNarrativePanel,
  CompetitionPlotMap,
} from './v4';

// ============================================================================
// Types
// ============================================================================

interface Props {
  companyId: string;
  companyName: string;
}

type LabTab = 'overview' | 'competitors' | 'analysis' | 'plotmap';

// Tab descriptions for narrative flow
const TAB_DESCRIPTIONS: Record<LabTab, string> = {
  overview: 'Key strategic questions answered',
  competitors: 'Who competes and how they do it',
  analysis: 'Where competition actually hurts',
  plotmap: 'Spatial view of the landscape',
};

// ============================================================================
// Sub-components
// ============================================================================

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
// Quick Stats Bar
// ============================================================================

function QuickStatsBar({
  primary,
  contextual,
  alternatives,
  excluded,
}: {
  primary: number;
  contextual: number;
  alternatives: number;
  excluded: number;
}) {
  return (
    <div className="flex items-center gap-6 px-4 py-3 bg-slate-800/30 border border-slate-700 rounded-lg">
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full bg-red-500" />
        <span className="text-sm text-slate-300">
          <span className="font-semibold text-white">{primary}</span> Primary
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full bg-amber-500" />
        <span className="text-sm text-slate-300">
          <span className="font-semibold text-white">{contextual}</span> Contextual
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full bg-slate-500" />
        <span className="text-sm text-slate-300">
          <span className="font-semibold text-white">{alternatives}</span> Alternatives
        </span>
      </div>
      {excluded > 0 && (
        <div className="flex items-center gap-2 text-slate-500">
          <span className="w-3 h-3 rounded-full bg-slate-700" />
          <span className="text-sm">
            <span className="font-medium">{excluded}</span> Excluded
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
              Discover competitors, classify them by tier, and generate strategic insights.
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
            Run Competition Analysis to discover competitors, classify them by tier (primary, contextual, alternatives),
            and generate strategic insights for positioning.
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="border border-slate-700 rounded-lg bg-slate-800/30 p-6">
        <div className="flex items-start gap-6">
          <div className="w-10 h-10 rounded-lg bg-slate-700" />
          <div className="flex-1 space-y-3">
            <div className="h-6 w-48 bg-slate-700 rounded" />
            <div className="h-4 w-full bg-slate-700 rounded" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-16 bg-slate-800/50 rounded-lg" />
        ))}
      </div>
      <div className="h-64 bg-slate-800/30 rounded-lg" />
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function CompetitionLabV5({ companyId, companyName }: Props) {
  const [activeTab, setActiveTab] = useState<LabTab>('overview');

  // Fetch V4 data directly (no modality toggle needed)
  const {
    data,
    isLoading,
    isRunning,
    error,
    runError,
    runDiscovery,
  } = useCompetitionV4(companyId);

  // Get counts for display
  const counts = getCompetitorCounts(data);

  // Handle run discovery
  const handleRunDiscovery = useCallback(async () => {
    await runDiscovery();
  }, [runDiscovery]);

  // If no data yet and not loading, show empty state
  if (!data && !isLoading && !isRunning) {
    return <EmptyState onRunAnalysis={handleRunDiscovery} isRunning={isRunning} />;
  }

  // Loading state
  if (isLoading && !data) {
    return <LoadingSkeleton />;
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
      {(error || runError) && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-4 text-sm text-red-400">
          <div className="font-medium">{error ? 'Error loading data' : 'Analysis failed'}</div>
          <div className="mt-1">{error || runError}</div>
        </div>
      )}

      {data && (
        <>
          {/* Competitive Context Banner (authoritative, no toggle) */}
          <CompetitiveContextBanner data={data} />

          {/* Quick Stats Bar */}
          <QuickStatsBar
            primary={counts.primary}
            contextual={counts.contextual}
            alternatives={counts.alternatives}
            excluded={counts.excluded}
          />

          {/* Tab Navigation with helper text */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              {/* Tab Buttons */}
              <div className="border-b border-slate-700 flex items-center gap-1">
                <TabButton
                  id="overview"
                  label="Strategic Overview"
                  isActive={activeTab === 'overview'}
                  onClick={() => setActiveTab('overview')}
                />
                <TabButton
                  id="competitors"
                  label="Competitors"
                  count={counts.total}
                  isActive={activeTab === 'competitors'}
                  onClick={() => setActiveTab('competitors')}
                />
                <TabButton
                  id="analysis"
                  label="Pressure Analysis"
                  isActive={activeTab === 'analysis'}
                  onClick={() => setActiveTab('analysis')}
                />
                <TabButton
                  id="plotmap"
                  label="Plot Map"
                  isActive={activeTab === 'plotmap'}
                  onClick={() => setActiveTab('plotmap')}
                />
              </div>

              {/* Re-run Button */}
              <button
                onClick={handleRunDiscovery}
                disabled={isRunning}
                className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-colors ${
                  isRunning
                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                }`}
              >
                {isRunning ? (
                  <span className="flex items-center gap-2">
                    <Spinner />
                    Running...
                  </span>
                ) : (
                  'Re-run Analysis'
                )}
              </button>
            </div>

            {/* Tab Description */}
            <p className="text-xs text-slate-500 pl-1">
              {TAB_DESCRIPTIONS[activeTab]}
            </p>
          </div>

          {/* Tab Content */}
          <div className="min-h-[400px]">
            {activeTab === 'overview' && (
              <StrategicNarrativePanel
                data={data}
                companyName={companyName}
              />
            )}

            {activeTab === 'competitors' && (
              <TieredCompetitorSections
                data={data}
                subjectCompanyName={companyName}
              />
            )}

            {activeTab === 'analysis' && (
              <CompetitivePressureMatrix data={data} />
            )}

            {activeTab === 'plotmap' && (
              <CompetitionPlotMap data={data} companyName={companyName} />
            )}
          </div>

          {/* Footer with metadata */}
          {data.execution?.completedAt && (
            <div className="px-4 py-3 bg-slate-800/30 border border-slate-700 rounded-lg flex items-center justify-between text-xs text-slate-500">
              <span>
                Analysis completed: {new Date(data.execution.completedAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </span>
              <span>
                Duration: {Math.round((data.execution.durationMs || 0) / 1000)}s
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
