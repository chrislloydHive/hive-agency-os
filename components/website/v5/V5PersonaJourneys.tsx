'use client';
// components/website/v5/V5PersonaJourneys.tsx
// V5 Persona Journeys - Tabbed view by persona type with pass/fail status

import { useState } from 'react';
import type { V5PersonaJourney, V5PersonaType } from '@/lib/types/websiteLabV5';
import { PERSONA_LABELS } from '@/lib/types/websiteLabV5';

type Props = {
  journeys: V5PersonaJourney[];
};

const PERSONA_ORDER: V5PersonaType[] = ['first_time', 'ready_to_buy', 'comparison_shopper'];

function JourneyCard({ journey }: { journey: V5PersonaJourney }) {
  const failed = !journey.succeeded;

  return (
    <div className={`border rounded-lg p-4 ${
      failed
        ? 'border-red-500/30 bg-red-500/5'
        : 'border-emerald-500/30 bg-emerald-500/5'
    }`}>
      {/* Status and Goal */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-medium px-2 py-0.5 rounded ${
              failed
                ? 'bg-red-500/20 text-red-300'
                : 'bg-emerald-500/20 text-emerald-300'
            }`}>
              {failed ? 'FAILED' : 'SUCCESS'}
            </span>
            <span className="text-xs text-slate-500">
              Confidence: {journey.confidenceScore}%
            </span>
          </div>
          <p className="text-sm text-slate-300">
            <span className="text-slate-500">Goal:</span> {journey.intendedGoal}
          </p>
        </div>
      </div>

      {/* Journey Path */}
      <div className="mb-4">
        <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
          Path Taken
        </h4>
        <div className="flex flex-wrap items-center gap-1">
          {journey.actualPath.map((page, i) => (
            <span key={i} className="flex items-center">
              <code className={`text-xs px-2 py-1 rounded ${
                journey.failurePoint?.page === page
                  ? 'bg-red-500/20 text-red-300 ring-1 ring-red-500/50'
                  : 'bg-slate-700/50 text-slate-300'
              }`}>
                {page}
              </code>
              {i < journey.actualPath.length - 1 && (
                <span className="text-slate-600 mx-1">→</span>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* Failure Point */}
      {journey.failurePoint && (
        <div className="border-t border-slate-700/50 pt-3">
          <h4 className="text-xs font-medium text-red-400 uppercase tracking-wide mb-2">
            Failure Point
          </h4>
          <div className="flex items-start gap-3">
            <code className="text-sm bg-red-500/20 text-red-300 px-2 py-1 rounded shrink-0">
              {journey.failurePoint.page}
            </code>
            <p className="text-sm text-slate-300">
              {journey.failurePoint.reason}
            </p>
          </div>
        </div>
      )}

      {/* Success message */}
      {!journey.failurePoint && journey.succeeded && (
        <div className="border-t border-slate-700/50 pt-3">
          <p className="text-sm text-emerald-400 flex items-center gap-2">
            <span>✓</span>
            Successfully completed journey from {journey.startingPage}
          </p>
        </div>
      )}
    </div>
  );
}

function PersonaTab({
  persona,
  isActive,
  onClick,
  hasFailures,
  count
}: {
  persona: V5PersonaType;
  isActive: boolean;
  onClick: () => void;
  hasFailures: boolean;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors relative ${
        isActive
          ? 'bg-slate-800 text-slate-100 border-t border-l border-r border-slate-700'
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
      }`}
    >
      {PERSONA_LABELS[persona]}
      {count > 0 && (
        <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
          hasFailures ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}

export function V5PersonaJourneys({ journeys }: Props) {
  const [activePersona, setActivePersona] = useState<V5PersonaType | 'all'>('all');

  if (!journeys || journeys.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        No persona journeys available.
      </div>
    );
  }

  // Group journeys by persona
  const journeysByPersona = PERSONA_ORDER.reduce((acc, persona) => {
    acc[persona] = journeys.filter(j => j.persona === persona);
    return acc;
  }, {} as Record<V5PersonaType, V5PersonaJourney[]>);

  // Count failures
  const failuresByPersona = PERSONA_ORDER.reduce((acc, persona) => {
    acc[persona] = journeysByPersona[persona].filter(j => !j.succeeded).length;
    return acc;
  }, {} as Record<V5PersonaType, number>);

  // Get visible journeys
  const visibleJourneys = activePersona === 'all'
    ? journeys
    : journeysByPersona[activePersona];

  // Summary stats
  const totalFailed = journeys.filter(j => !j.succeeded).length;
  const totalSucceeded = journeys.filter(j => j.succeeded).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-100">
          Persona Journeys
        </h3>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-emerald-400">
            {totalSucceeded} passed
          </span>
          <span className="text-red-400">
            {totalFailed} failed
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-700">
        <button
          onClick={() => setActivePersona('all')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            activePersona === 'all'
              ? 'bg-slate-800 text-slate-100 border-t border-l border-r border-slate-700'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          All
          <span className="ml-2 text-xs text-slate-500">
            ({journeys.length})
          </span>
        </button>
        {PERSONA_ORDER.map(persona => (
          <PersonaTab
            key={persona}
            persona={persona}
            isActive={activePersona === persona}
            onClick={() => setActivePersona(persona)}
            hasFailures={failuresByPersona[persona] > 0}
            count={journeysByPersona[persona].length}
          />
        ))}
      </div>

      {/* Journey cards */}
      <div className="space-y-3">
        {visibleJourneys.length === 0 ? (
          <div className="text-center py-6 text-slate-500">
            No journeys for this persona.
          </div>
        ) : (
          visibleJourneys.map((journey, i) => (
            <JourneyCard key={`${journey.persona}-${i}`} journey={journey} />
          ))
        )}
      </div>
    </div>
  );
}
