'use client';

// components/os/blueprint/BlueprintThemeCard.tsx
// Card component for displaying a single Blueprint Theme with its plays

import { useState } from 'react';
import type { BlueprintTheme } from '@/lib/os/analytics/blueprint';
import { BlueprintPlayCard } from './BlueprintPlayCard';

interface BlueprintThemeCardProps {
  theme: BlueprintTheme;
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
  defaultExpanded?: boolean;
}

const PRIORITY_STYLES = {
  high: 'bg-red-500/20 text-red-300 border-red-500/30',
  medium: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  low: 'bg-slate-600/20 text-slate-300 border-slate-600/30',
};

const PRIORITY_BORDER = {
  high: 'border-red-500/30',
  medium: 'border-amber-500/30',
  low: 'border-slate-700',
};

export function BlueprintThemeCard({
  theme,
  onCreateWorkItem,
  onCreateExperiment,
  defaultExpanded = true,
}: BlueprintThemeCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div
      className={`bg-slate-900/70 border ${PRIORITY_BORDER[theme.priority]} rounded-xl overflow-hidden`}
    >
      {/* Theme Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-start gap-3 hover:bg-slate-800/50 transition-colors text-left"
      >
        <svg
          className={`w-5 h-5 text-slate-400 mt-0.5 transition-transform flex-shrink-0 ${expanded ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-slate-100">{theme.label}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_STYLES[theme.priority]}`}>
              {theme.priority}
            </span>
            <span className="text-xs text-slate-500">
              {theme.plays.length} {theme.plays.length === 1 ? 'play' : 'plays'}
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1 line-clamp-2">{theme.description}</p>
        </div>
      </button>

      {/* Plays */}
      {expanded && theme.plays.length > 0 && (
        <div className="px-4 pb-4 pl-12 space-y-3">
          {theme.plays.map((play) => (
            <BlueprintPlayCard
              key={play.id}
              play={play}
              onCreateWorkItem={onCreateWorkItem}
              onCreateExperiment={onCreateExperiment}
            />
          ))}
        </div>
      )}
    </div>
  );
}
