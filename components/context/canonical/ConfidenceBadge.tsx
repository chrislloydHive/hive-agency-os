// components/context/canonical/ConfidenceBadge.tsx
// Confidence Badge for Canonical Fields
//
// Displays confidence level as Low/Medium/High or percentage.

'use client';

import { useState, useRef } from 'react';

export interface ConfidenceBadgeProps {
  confidence: number; // 0-1
  showPercentage?: boolean;
}

/**
 * Get confidence level from numeric value
 */
function getConfidenceLevel(confidence: number): 'low' | 'medium' | 'high' {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.5) return 'medium';
  return 'low';
}

/**
 * Get color classes for confidence level
 */
function getConfidenceColors(level: 'low' | 'medium' | 'high') {
  switch (level) {
    case 'high':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    case 'medium':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    case 'low':
      return 'bg-red-500/10 text-red-400 border-red-500/20';
  }
}

export function ConfidenceBadge({ confidence, showPercentage = false }: ConfidenceBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const level = getConfidenceLevel(confidence);
  const colors = getConfidenceColors(level);
  const percentage = Math.round(confidence * 100);

  const displayLabel = showPercentage
    ? `${percentage}%`
    : level.charAt(0).toUpperCase() + level.slice(1);

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
        {displayLabel}
      </span>

      {showTooltip && (
        <div
          ref={tooltipRef}
          className="absolute left-0 top-full mt-1 z-50 w-32 p-2 bg-slate-800 border border-slate-700 rounded-lg shadow-lg"
        >
          <div className="text-xs">
            <p className="text-slate-300 font-medium">Confidence: {percentage}%</p>
            <p className="text-slate-500 mt-0.5">
              {level === 'high' && 'Reliable data from multiple sources'}
              {level === 'medium' && 'May need verification'}
              {level === 'low' && 'Needs review before use'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default ConfidenceBadge;
