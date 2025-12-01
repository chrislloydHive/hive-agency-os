'use client';

// components/os/blueprint/BlueprintLayout.tsx
// Main layout component for displaying a complete Blueprint

import type { Blueprint } from '@/lib/os/analytics/blueprint';
import { BlueprintThemeCard } from './BlueprintThemeCard';

interface BlueprintLayoutProps {
  blueprint: Blueprint;
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
  onRefresh?: () => void;
  className?: string;
}

export function BlueprintLayout({
  blueprint,
  onCreateWorkItem,
  onCreateExperiment,
  onRefresh,
  className = '',
}: BlueprintLayoutProps) {
  const { summary, themes, notes } = blueprint;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100">{summary.title}</h2>
          <div className="flex items-center gap-3 mt-1 text-sm text-slate-400">
            {summary.periodLabel && <span>{summary.periodLabel}</span>}
            {summary.sourceName && (
              <>
                <span className="text-slate-600">•</span>
                <span>{summary.sourceName}</span>
              </>
            )}
          </div>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="text-sm text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Regenerate
          </button>
        )}
      </div>

      {/* Notes/Narrative */}
      {notes && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-amber-300 mb-2">Strategic Notes</h3>
          <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{notes}</p>
        </div>
      )}

      {/* Themes */}
      {themes.length > 0 ? (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-200">
            Strategic Themes ({themes.length})
          </h3>
          {themes.map((theme, index) => (
            <BlueprintThemeCard
              key={theme.id}
              theme={theme}
              onCreateWorkItem={onCreateWorkItem}
              onCreateExperiment={onCreateExperiment}
              defaultExpanded={index === 0}
            />
          ))}
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center">
          <p className="text-slate-400">No strategic themes identified.</p>
          <p className="text-sm text-slate-500 mt-1">
            Try collecting more data or regenerating the blueprint.
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="text-xs text-slate-500 pt-4 border-t border-slate-800 flex items-center justify-between">
        <span>Generated: {new Date(summary.generatedAt).toLocaleString()}</span>
        <span className="text-slate-600">Source: {summary.sourceType}</span>
      </div>
    </div>
  );
}
