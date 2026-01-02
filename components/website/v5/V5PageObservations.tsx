'use client';
// components/website/v5/V5PageObservations.tsx
// V5 Page Observations - Accordion grouped by pagePath with factual observations

import { useState } from 'react';
import type { V5PageObservation } from '@/lib/types/websiteLabV5';

type Props = {
  observations: V5PageObservation[];
};

function PageTypeLabel({ type }: { type: string }) {
  const typeColors: Record<string, string> = {
    home: 'bg-blue-500/20 text-blue-300',
    pricing: 'bg-emerald-500/20 text-emerald-300',
    about: 'bg-purple-500/20 text-purple-300',
    contact: 'bg-amber-500/20 text-amber-300',
    product: 'bg-cyan-500/20 text-cyan-300',
    service: 'bg-indigo-500/20 text-indigo-300',
    blog: 'bg-pink-500/20 text-pink-300',
    resource: 'bg-orange-500/20 text-orange-300',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeColors[type] || 'bg-slate-500/20 text-slate-300'}`}>
      {type}
    </span>
  );
}

function ObservationCard({ observation, isOpen, onToggle }: {
  observation: V5PageObservation;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const hasCTAs = observation.primaryCTAs?.length > 0;
  const hasTrustElements = observation.trustProofElements?.length > 0;
  const hasMissing = observation.missingUnclearElements?.length > 0;

  return (
    <div className="border border-slate-700 rounded-lg bg-slate-800/50 overflow-hidden">
      {/* Header - always visible */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-700/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className={`text-slate-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}>
            ▶
          </span>
          <code className="text-sm font-mono text-slate-200">{observation.pagePath}</code>
          <PageTypeLabel type={observation.pageType} />
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {hasCTAs && <span>{observation.primaryCTAs.length} CTAs</span>}
          {hasMissing && <span className="text-amber-400">{observation.missingUnclearElements.length} issues</span>}
        </div>
      </button>

      {/* Expanded content */}
      {isOpen && (
        <div className="px-4 pb-4 pt-2 border-t border-slate-700/50 space-y-4">
          {/* Above Fold Elements */}
          {observation.aboveFoldElements?.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
                Above the Fold
              </h4>
              <ul className="space-y-1">
                {observation.aboveFoldElements.map((el, i) => (
                  <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                    <span className="text-slate-600">•</span>
                    {el}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Primary CTAs */}
          {hasCTAs && (
            <div>
              <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
                Primary CTAs
              </h4>
              <div className="flex flex-wrap gap-2">
                {observation.primaryCTAs.map((cta, i) => (
                  <div key={i} className="inline-flex items-center gap-2 bg-slate-700/50 rounded px-2 py-1">
                    <span className="text-sm font-medium text-slate-200">"{cta.text}"</span>
                    <span className="text-xs text-slate-500">
                      {cta.position.replace('_', ' ')}
                    </span>
                    {cta.destination && (
                      <span className="text-xs text-slate-600">→ {cta.destination}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trust Proof Elements */}
          {hasTrustElements && (
            <div>
              <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
                Trust Signals
              </h4>
              <div className="flex flex-wrap gap-1">
                {observation.trustProofElements.map((el, i) => (
                  <span key={i} className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded">
                    {el}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Missing/Unclear Elements */}
          {hasMissing && (
            <div>
              <h4 className="text-xs font-medium text-amber-400 uppercase tracking-wide mb-2">
                Missing or Unclear
              </h4>
              <ul className="space-y-1">
                {observation.missingUnclearElements.map((el, i) => (
                  <li key={i} className="text-sm text-amber-300/80 flex items-start gap-2">
                    <span className="text-amber-500">⚠</span>
                    {el}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function V5PageObservations({ observations }: Props) {
  const [openPages, setOpenPages] = useState<Set<string>>(new Set());

  if (!observations || observations.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        No page observations available.
      </div>
    );
  }

  const togglePage = (pagePath: string) => {
    setOpenPages(prev => {
      const next = new Set(prev);
      if (next.has(pagePath)) {
        next.delete(pagePath);
      } else {
        next.add(pagePath);
      }
      return next;
    });
  };

  const expandAll = () => {
    setOpenPages(new Set(observations.map(o => o.pagePath)));
  };

  const collapseAll = () => {
    setOpenPages(new Set());
  };

  return (
    <div className="space-y-4">
      {/* Header with expand/collapse controls */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-100">
          Page Observations
          <span className="ml-2 text-sm font-normal text-slate-500">
            ({observations.length} pages)
          </span>
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={expandAll}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            Expand all
          </button>
          <span className="text-slate-600">|</span>
          <button
            onClick={collapseAll}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            Collapse all
          </button>
        </div>
      </div>

      {/* Observation cards */}
      <div className="space-y-2">
        {observations.map((obs) => (
          <ObservationCard
            key={obs.pagePath}
            observation={obs}
            isOpen={openPages.has(obs.pagePath)}
            onToggle={() => togglePage(obs.pagePath)}
          />
        ))}
      </div>
    </div>
  );
}
