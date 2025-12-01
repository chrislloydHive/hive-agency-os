'use client';

// components/os/blueprint/BlueprintPlayCard.tsx
// Card component for displaying a single Blueprint Play with KPIs and experiments

import { useState } from 'react';
import type { BlueprintPlay } from '@/lib/os/analytics/blueprint';
import { BlueprintExperimentList } from './BlueprintExperimentList';

interface BlueprintPlayCardProps {
  play: BlueprintPlay;
  onCreateWorkItem?: (
    title: string,
    description: string,
    priority: 'high' | 'medium' | 'low'
  ) => Promise<void>;
  onCreateExperiment?: (
    name: string,
    hypothesis: string,
    successMetric: string
  ) => Promise<void>;
}

const PRIORITY_STYLES = {
  high: 'bg-red-500/20 text-red-300',
  medium: 'bg-amber-500/20 text-amber-300',
  low: 'bg-slate-600/20 text-slate-300',
};

const TIMEFRAME_STYLES = {
  now: 'bg-emerald-500/20 text-emerald-300',
  next: 'bg-blue-500/20 text-blue-300',
  later: 'bg-slate-600/20 text-slate-400',
};

const TIMEFRAME_LABELS = {
  now: 'Now',
  next: 'Next',
  later: 'Later',
};

export function BlueprintPlayCard({
  play,
  onCreateWorkItem,
  onCreateExperiment,
}: BlueprintPlayCardProps) {
  const [creatingWork, setCreatingWork] = useState(false);
  const [workSuccess, setWorkSuccess] = useState(false);

  const handleCreateWorkItem = async () => {
    if (!onCreateWorkItem) return;
    setCreatingWork(true);
    try {
      const description = `${play.description}\n\nKPIs:\n${play.kpis.map((k) => `- ${k.label}${k.target ? ` (${k.target})` : ''}`).join('\n')}`;
      await onCreateWorkItem(play.label, description, play.priority);
      setWorkSuccess(true);
      setTimeout(() => setWorkSuccess(false), 3000);
    } finally {
      setCreatingWork(false);
    }
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-3">
      {/* Play Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-semibold text-slate-200">{play.label}</h4>
            <span className={`text-xs px-1.5 py-0.5 rounded ${PRIORITY_STYLES[play.priority]}`}>
              {play.priority}
            </span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${TIMEFRAME_STYLES[play.timeframe]}`}>
              {TIMEFRAME_LABELS[play.timeframe]}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">{play.description}</p>
        </div>
      </div>

      {/* KPIs */}
      {play.kpis.length > 0 && (
        <div className="space-y-1">
          <h5 className="text-xs font-medium text-slate-500 uppercase tracking-wide">KPIs</h5>
          <div className="flex flex-wrap gap-2">
            {play.kpis.map((kpi) => (
              <div
                key={kpi.id}
                className="bg-slate-900/50 border border-slate-700/50 rounded px-2 py-1"
              >
                <span className="text-xs text-slate-300">{kpi.label}</span>
                {kpi.target && (
                  <span className="text-xs text-emerald-400 ml-1.5">{kpi.target}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Experiments */}
      {play.experiments.length > 0 && (
        <BlueprintExperimentList
          experiments={play.experiments}
          onCreateExperiment={onCreateExperiment}
        />
      )}

      {/* Create Work Item button */}
      {onCreateWorkItem && (
        <div className="pt-2 border-t border-slate-700/50">
          <button
            onClick={handleCreateWorkItem}
            disabled={creatingWork}
            className={`text-xs px-3 py-1.5 rounded transition-colors ${
              workSuccess
                ? 'bg-emerald-500/20 text-emerald-300'
                : creatingWork
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
            }`}
          >
            {workSuccess ? 'Work Item Created!' : creatingWork ? 'Creating...' : '+ Create Work Item'}
          </button>
        </div>
      )}
    </div>
  );
}
