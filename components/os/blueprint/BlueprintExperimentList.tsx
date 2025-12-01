'use client';

// components/os/blueprint/BlueprintExperimentList.tsx
// List component for displaying Blueprint experiments with action buttons

import { useState } from 'react';
import type { BlueprintExperiment } from '@/lib/os/analytics/blueprint';

interface BlueprintExperimentListProps {
  experiments: BlueprintExperiment[];
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

const EFFORT_STYLES = {
  high: 'bg-red-500/20 text-red-300',
  medium: 'bg-amber-500/20 text-amber-300',
  low: 'bg-emerald-500/20 text-emerald-300',
};

export function BlueprintExperimentList({
  experiments,
  onCreateExperiment,
}: BlueprintExperimentListProps) {
  const [creatingIds, setCreatingIds] = useState<Set<string>>(new Set());
  const [successIds, setSuccessIds] = useState<Set<string>>(new Set());

  const handleCreate = async (exp: BlueprintExperiment) => {
    if (!onCreateExperiment) return;

    setCreatingIds((prev) => new Set(prev).add(exp.id));
    try {
      await onCreateExperiment(exp.label, exp.hypothesis, exp.description);
      setSuccessIds((prev) => new Set(prev).add(exp.id));
      setTimeout(() => {
        setSuccessIds((prev) => {
          const next = new Set(prev);
          next.delete(exp.id);
          return next;
        });
      }, 3000);
    } finally {
      setCreatingIds((prev) => {
        const next = new Set(prev);
        next.delete(exp.id);
        return next;
      });
    }
  };

  if (experiments.length === 0) return null;

  return (
    <div className="space-y-2">
      <h5 className="text-xs font-medium text-slate-500 uppercase tracking-wide">Experiments</h5>
      <div className="space-y-2">
        {experiments.map((exp) => {
          const isCreating = creatingIds.has(exp.id);
          const isSuccess = successIds.has(exp.id);

          return (
            <div
              key={exp.id}
              className="bg-slate-900/50 border border-purple-500/20 rounded p-3"
            >
              <div className="flex items-start gap-2">
                <svg
                  className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                  />
                </svg>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-200">{exp.label}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${PRIORITY_STYLES[exp.priority]}`}>
                      {exp.priority}
                    </span>
                    {exp.effort && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${EFFORT_STYLES[exp.effort]}`}>
                        {exp.effort} effort
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1 italic">{exp.hypothesis}</p>
                  <p className="text-xs text-purple-300/80 mt-1">{exp.description}</p>

                  {onCreateExperiment && (
                    <button
                      onClick={() => handleCreate(exp)}
                      disabled={isCreating}
                      className={`mt-2 text-xs px-2 py-0.5 rounded transition-colors ${
                        isSuccess
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : isCreating
                            ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                            : 'bg-purple-500/10 text-purple-300 hover:bg-purple-500/20'
                      }`}
                    >
                      {isSuccess ? 'Created!' : isCreating ? 'Creating...' : '+ Add as Experiment'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
