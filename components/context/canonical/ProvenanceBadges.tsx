// components/context/canonical/ProvenanceBadges.tsx
// Provenance Badges for Canonical Fields
//
// Shows source badges (Lab, GAP, User) with tooltips showing details.

'use client';

import { useState, useRef } from 'react';
import type { ContextFieldSource } from '@/lib/os/context/schema';

export interface ProvenanceBadgesProps {
  sources: ContextFieldSource[];
  maxVisible?: number;
}

/**
 * Get label for source type
 */
function getSourceLabel(source: ContextFieldSource): string {
  switch (source.type) {
    case 'lab':
      return source.lab ? `${source.lab.charAt(0).toUpperCase() + source.lab.slice(1)} Lab` : 'Lab';
    case 'gap':
      return 'Full GAP';
    case 'user':
      return 'User';
    default:
      return 'Unknown';
  }
}

/**
 * Get short label for badge
 */
function getShortLabel(source: ContextFieldSource): string {
  switch (source.type) {
    case 'lab':
      return 'Lab';
    case 'gap':
      return 'GAP';
    case 'user':
      return 'User';
    default:
      return '?';
  }
}

/**
 * Get color classes for source type
 */
function getSourceColors(type: ContextFieldSource['type']) {
  switch (type) {
    case 'lab':
      return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    case 'gap':
      return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
    case 'user':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    default:
      return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
  }
}

/**
 * Single provenance badge with tooltip
 */
function ProvenanceBadge({ source }: { source: ContextFieldSource }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const shortLabel = getShortLabel(source);
  const fullLabel = getSourceLabel(source);
  const colors = getSourceColors(source.type);

  // Build tooltip content
  const tooltipLines: string[] = [fullLabel];

  if (source.type === 'lab' && source.runId) {
    tooltipLines.push(`Run: ${source.runId.substring(0, 8)}...`);
  } else if (source.type === 'gap' && source.runId) {
    tooltipLines.push(`Run: ${source.runId.substring(0, 8)}...`);
  }

  if (source.evidence) {
    tooltipLines.push(`Evidence: ${source.evidence.substring(0, 50)}...`);
  }

  return (
    <div className="relative inline-flex">
      <span
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`
          inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium
          rounded border cursor-default select-none
          ${colors}
        `}
      >
        {shortLabel}
      </span>

      {showTooltip && (
        <div
          ref={tooltipRef}
          className="absolute left-0 top-full mt-1 z-50 w-40 p-2 bg-slate-800 border border-slate-700 rounded-lg shadow-lg"
        >
          <div className="text-xs space-y-0.5">
            {tooltipLines.map((line, i) => (
              <p
                key={i}
                className={i === 0 ? 'text-slate-300 font-medium' : 'text-slate-500'}
              >
                {line}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ProvenanceBadges({ sources, maxVisible = 3 }: ProvenanceBadgesProps) {
  if (!sources || sources.length === 0) {
    return (
      <span className="text-[10px] text-slate-500 italic">No source</span>
    );
  }

  // Deduplicate by type
  const uniqueSources = sources.reduce((acc, source) => {
    const key = source.type === 'lab' ? `lab-${source.lab}` : source.type;
    if (!acc.find(s => {
      const sKey = s.type === 'lab' ? `lab-${s.lab}` : s.type;
      return sKey === key;
    })) {
      acc.push(source);
    }
    return acc;
  }, [] as ContextFieldSource[]);

  const visibleSources = uniqueSources.slice(0, maxVisible);
  const remainingCount = uniqueSources.length - maxVisible;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {visibleSources.map((source, index) => (
        <ProvenanceBadge key={`${source.type}-${index}`} source={source} />
      ))}
      {remainingCount > 0 && (
        <span className="text-[10px] text-slate-500">
          +{remainingCount} more
        </span>
      )}
    </div>
  );
}

export default ProvenanceBadges;
