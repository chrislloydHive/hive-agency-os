'use client';

// components/CampaignConceptsSection.tsx
// Displays campaign concepts with insights, ideas, and channel recommendations

import { useState } from 'react';
import type { CampaignConcept } from '@/lib/contextGraph/domains/creative';

interface CampaignConceptsSectionProps {
  concepts: CampaignConcept[];
  onUpdate: (concepts: CampaignConcept[]) => void;
}

export function CampaignConceptsSection({ concepts, onUpdate }: CampaignConceptsSectionProps) {
  const [expandedConcept, setExpandedConcept] = useState<number | null>(0);

  if (concepts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mb-4">
          <svg
            className="w-6 h-6 text-slate-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-slate-300 mb-2">No Campaign Concepts</h3>
        <p className="text-slate-500 max-w-md">
          Generate a creative strategy to create campaign concepts with insights and channel recommendations.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {concepts.map((concept, idx) => {
        const isExpanded = expandedConcept === idx;

        return (
          <div
            key={idx}
            className="rounded-xl bg-slate-900/50 border border-slate-800 overflow-hidden"
          >
            {/* Header */}
            <button
              onClick={() => setExpandedConcept(isExpanded ? null : idx)}
              className="w-full px-6 py-5 flex items-start justify-between text-left hover:bg-slate-800/30 transition-colors"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-medium">
                    Campaign {idx + 1}
                  </span>
                </div>
                <h3 className="text-xl font-semibold text-white">{concept.name}</h3>
                <p className="text-sm text-slate-400 mt-2 line-clamp-2">{concept.concept}</p>
              </div>
              <svg
                className={`w-5 h-5 text-slate-400 transition-transform mt-1 shrink-0 ml-4 ${
                  isExpanded ? 'rotate-180' : ''
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {/* Expanded Content */}
            {isExpanded && (
              <div className="px-6 pb-6 space-y-6 border-t border-slate-800/50">
                {/* Insight */}
                <div className="pt-5">
                  <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                    Audience Insight
                  </h4>
                  <div className="px-4 py-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <p className="text-sm text-blue-300 italic">&ldquo;{concept.insight}&rdquo;</p>
                  </div>
                </div>

                {/* Concept */}
                <div>
                  <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                    Creative Concept
                  </h4>
                  <p className="text-slate-200">{concept.concept}</p>
                </div>

                {/* Example Ads */}
                <div>
                  <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
                    Example Ad Executions
                  </h4>
                  <div className="space-y-3">
                    {concept.exampleAds.map((ad, aidx) => (
                      <div
                        key={aidx}
                        className="px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700/50"
                      >
                        <div className="flex items-start gap-3">
                          <span className="shrink-0 w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 text-xs font-medium flex items-center justify-center">
                            {aidx + 1}
                          </span>
                          <p className="text-sm text-slate-300">{ad}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Channels */}
                  <div>
                    <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
                      Recommended Channels
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {concept.channels.map((channel, cidx) => (
                        <span
                          key={cidx}
                          className="px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs border border-emerald-500/20"
                        >
                          {channel}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Measurement */}
                  <div>
                    <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
                      Success Metrics
                    </h4>
                    <ul className="space-y-2">
                      {concept.measurement.map((metric, midx) => (
                        <li key={midx} className="text-sm text-slate-300 flex items-start gap-2">
                          <svg
                            className="w-4 h-4 text-purple-400 mt-0.5 shrink-0"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                            />
                          </svg>
                          {metric}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
