'use client';

// components/media/scenarios/MediaScenarioList.tsx
// Left rail component for scenario list and selection
//
// Features:
// - List all scenarios for a company
// - Select a scenario to edit
// - Create new scenario
// - Duplicate scenario
// - Mark as recommended

import { useState } from 'react';
import type { MediaScenario } from '@/lib/media/types';
import { formatCurrency, TIME_HORIZON_OPTIONS } from '@/lib/media/types';

interface MediaScenarioListProps {
  scenarios: MediaScenario[];
  activeScenarioId: string | null;
  onSelect: (scenarioId: string) => void;
  onCreate: () => void;
  onDuplicate: (scenarioId: string) => void;
  onSetRecommended: (scenarioId: string, recommended: boolean) => void;
  onDelete: (scenarioId: string) => void;
  isLoading?: boolean;
}

function getTimeHorizonLabel(horizon: string): string {
  const option = TIME_HORIZON_OPTIONS.find(o => o.value === horizon);
  return option?.label || horizon;
}

function getTimeHorizonBadgeColor(horizon: string): string {
  switch (horizon) {
    case 'month':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    case 'quarter':
      return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
    case 'year':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    default:
      return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
  }
}

interface ScenarioCardProps {
  scenario: MediaScenario;
  isActive: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onSetRecommended: (recommended: boolean) => void;
  onDelete: () => void;
}

function ScenarioCard({
  scenario,
  isActive,
  onSelect,
  onDuplicate,
  onSetRecommended,
  onDelete,
}: ScenarioCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div
      onClick={onSelect}
      className={`relative p-3 rounded-lg border cursor-pointer transition-all ${
        isActive
          ? 'bg-amber-500/10 border-amber-500/40'
          : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600/50 hover:bg-slate-800'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium text-slate-200 truncate">{scenario.name}</h4>
            {scenario.isRecommended && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40">
                <svg className="w-3 h-3 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="text-[10px] text-amber-400 font-medium">Rec</span>
              </span>
            )}
          </div>
          {scenario.periodLabel && (
            <p className="text-[10px] text-slate-500 mt-0.5">{scenario.periodLabel}</p>
          )}
        </div>

        {/* Menu button */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1 rounded text-slate-400 hover:text-slate-300 hover:bg-slate-700/50"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                }}
              />
              <div className="absolute right-0 top-full mt-1 z-20 w-36 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicate();
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-1.5 text-left text-xs text-slate-300 hover:bg-slate-700/50"
                >
                  Duplicate
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetRecommended(!scenario.isRecommended);
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-1.5 text-left text-xs text-slate-300 hover:bg-slate-700/50"
                >
                  {scenario.isRecommended ? 'Remove Recommendation' : 'Set as Recommended'}
                </button>
                <div className="border-t border-slate-700 my-1" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Delete this scenario?')) {
                      onDelete();
                    }
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-slate-700/50"
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Badges & metrics */}
      <div className="flex items-center gap-2 mb-2">
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${getTimeHorizonBadgeColor(scenario.timeHorizon)}`}>
          {getTimeHorizonLabel(scenario.timeHorizon)}
        </span>
        <span className="text-xs text-slate-400 tabular-nums">
          {formatCurrency(scenario.totalBudget)}
        </span>
      </div>

      {/* Forecast summary (if available) */}
      {scenario.forecastSummary && (
        <div className="flex items-center gap-3 text-[10px] text-slate-500">
          {scenario.forecastSummary.expectedInstalls !== undefined && (
            <span>
              <span className="text-slate-400">{scenario.forecastSummary.expectedInstalls}</span> installs
            </span>
          )}
          {scenario.forecastSummary.expectedCPA !== undefined && (
            <span>
              <span className="text-slate-400">{formatCurrency(scenario.forecastSummary.expectedCPA)}</span> CPA
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function MediaScenarioList({
  scenarios,
  activeScenarioId,
  onSelect,
  onCreate,
  onDuplicate,
  onSetRecommended,
  onDelete,
  isLoading,
}: MediaScenarioListProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-200">Scenarios</h3>
        <button
          onClick={onCreate}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30 transition-colors"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New
        </button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && scenarios.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <p className="text-sm text-slate-400 mb-1">No scenarios yet</p>
          <p className="text-xs text-slate-500 mb-4">
            Create your first scenario to start planning
          </p>
          <button
            onClick={onCreate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Scenario
          </button>
        </div>
      )}

      {/* Scenario list */}
      {!isLoading && scenarios.length > 0 && (
        <div className="flex-1 overflow-y-auto space-y-2">
          {scenarios.map((scenario) => (
            <ScenarioCard
              key={scenario.id}
              scenario={scenario}
              isActive={scenario.id === activeScenarioId}
              onSelect={() => onSelect(scenario.id)}
              onDuplicate={() => onDuplicate(scenario.id)}
              onSetRecommended={(rec) => onSetRecommended(scenario.id, rec)}
              onDelete={() => onDelete(scenario.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default MediaScenarioList;
