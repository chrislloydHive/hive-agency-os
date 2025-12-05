'use client';

// components/TerritoriesSection.tsx
// Displays creative territories with themes, visual direction, and example headlines

import { useState } from 'react';
import type { CreativeTerritory } from '@/lib/contextGraph/domains/creative';

interface TerritoriesSectionProps {
  territories: CreativeTerritory[];
  onUpdate: (territories: CreativeTerritory[]) => void;
}

// Color palette for territories
const TERRITORY_COLORS = [
  { bg: 'from-blue-500/20 to-cyan-500/20', border: 'border-blue-500/30', accent: 'text-blue-400' },
  { bg: 'from-purple-500/20 to-pink-500/20', border: 'border-purple-500/30', accent: 'text-purple-400' },
  { bg: 'from-amber-500/20 to-orange-500/20', border: 'border-amber-500/30', accent: 'text-amber-400' },
  { bg: 'from-emerald-500/20 to-teal-500/20', border: 'border-emerald-500/30', accent: 'text-emerald-400' },
];

export function TerritoriesSection({ territories, onUpdate }: TerritoriesSectionProps) {
  const [expandedTerritory, setExpandedTerritory] = useState<number | null>(0);

  if (territories.length === 0) {
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
              d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-slate-300 mb-2">No Creative Territories</h3>
        <p className="text-slate-500 max-w-md">
          Generate a creative strategy to create distinct creative territories for your campaigns.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Territory Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {territories.map((territory, idx) => {
          const colors = TERRITORY_COLORS[idx % TERRITORY_COLORS.length];
          const isExpanded = expandedTerritory === idx;

          return (
            <div
              key={idx}
              className={`rounded-xl bg-gradient-to-br ${colors.bg} border ${colors.border} overflow-hidden transition-all ${
                isExpanded ? 'col-span-full' : ''
              }`}
            >
              {/* Header */}
              <button
                onClick={() => setExpandedTerritory(isExpanded ? null : idx)}
                className="w-full px-5 py-4 flex items-start justify-between text-left hover:bg-white/5 transition-colors"
              >
                <div className="flex-1">
                  <h3 className={`text-lg font-semibold ${colors.accent}`}>{territory.name}</h3>
                  <p className="text-sm text-slate-300 mt-1">{territory.theme}</p>
                </div>
                <svg
                  className={`w-5 h-5 text-slate-400 transition-transform mt-1 ${
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
                <div className="px-5 pb-5 space-y-5 border-t border-white/10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-5">
                    {/* Visual Direction */}
                    <div>
                      <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                        Visual Direction
                      </h4>
                      <p className="text-sm text-slate-300">{territory.visualDirection}</p>
                    </div>

                    {/* Tone */}
                    <div>
                      <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                        Tone
                      </h4>
                      <p className="text-sm text-slate-300">{territory.tone}</p>
                    </div>
                  </div>

                  {/* Example Headlines */}
                  <div>
                    <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
                      Example Headlines
                    </h4>
                    <div className="space-y-2">
                      {territory.exampleHeadlines.map((headline, hidx) => (
                        <div
                          key={hidx}
                          className="px-4 py-3 rounded-lg bg-black/20 border border-white/5"
                        >
                          <p className="text-white font-medium">{headline}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recommended Formats */}
                  <div>
                    <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
                      Recommended Formats
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {territory.formats.map((format, fidx) => (
                        <span
                          key={fidx}
                          className="px-3 py-1.5 rounded-full bg-black/20 text-slate-300 text-xs border border-white/10"
                        >
                          {format}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
