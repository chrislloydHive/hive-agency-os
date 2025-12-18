'use client';

// components/os/briefs/BriefQualityBadge.tsx
// Brief Quality Badge Component
//
// Displays a quality indicator (High/Medium/Low) with a tooltip
// explaining why and suggestions for improvement.

import { useState, useRef, useEffect } from 'react';
import { Info, CheckCircle, AlertTriangle, AlertCircle, Sparkles } from 'lucide-react';
import type { Brief } from '@/lib/types/brief';
import {
  computeBriefQuality,
  getQualitySummary,
  QUALITY_BADGE_COLORS,
  QUALITY_LABELS,
  QUALITY_REASON_LABELS,
  QUALITY_REASON_SUGGESTIONS,
  type BriefQualityResult,
} from '@/lib/briefs/briefQuality';

// ============================================================================
// Types
// ============================================================================

interface BriefQualityBadgeProps {
  brief: Brief;
  /** Optional: when context was last updated */
  contextUpdatedAt?: string | null;
  /** Optional: callback when user clicks "Improve Brief" */
  onImprove?: () => void;
  /** Whether to show the improve CTA */
  showImproveCta?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function BriefQualityBadge({
  brief,
  contextUpdatedAt,
  onImprove,
  showImproveCta = true,
}: BriefQualityBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLButtonElement>(null);

  // Compute quality
  const result: BriefQualityResult = computeBriefQuality({
    brief,
    contextUpdatedAt,
  });

  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tooltipRef.current &&
        badgeRef.current &&
        !tooltipRef.current.contains(event.target as Node) &&
        !badgeRef.current.contains(event.target as Node)
      ) {
        setShowTooltip(false);
      }
    };

    if (showTooltip) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showTooltip]);

  // Get quality icon
  const QualityIcon = result.quality === 'high'
    ? CheckCircle
    : result.quality === 'medium'
    ? AlertTriangle
    : AlertCircle;

  return (
    <div className="relative">
      {/* Badge */}
      <button
        ref={badgeRef}
        onClick={() => setShowTooltip(!showTooltip)}
        className={`
          inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded border
          transition-colors cursor-pointer hover:opacity-80
          ${QUALITY_BADGE_COLORS[result.quality]}
        `}
        title="Click to see quality details"
      >
        <QualityIcon className="w-3 h-3" />
        <span>Quality: {QUALITY_LABELS[result.quality]}</span>
        <Info className="w-3 h-3 opacity-60" />
      </button>

      {/* Tooltip/Popover */}
      {showTooltip && (
        <div
          ref={tooltipRef}
          className="absolute top-full left-0 mt-2 w-80 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-700">
            <div className="flex items-center gap-2">
              <QualityIcon className={`w-4 h-4 ${
                result.quality === 'high' ? 'text-emerald-400' :
                result.quality === 'medium' ? 'text-amber-400' : 'text-red-400'
              }`} />
              <span className="text-sm font-medium text-white">
                {QUALITY_LABELS[result.quality]} Quality Brief
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {getQualitySummary(result)}
            </p>
          </div>

          {/* Reasons */}
          {result.reasons.length > 0 ? (
            <div className="px-4 py-3">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
                Areas for Improvement
              </p>
              <ul className="space-y-2">
                {result.reasons.map((reason) => (
                  <li key={reason} className="text-xs">
                    <div className="flex items-start gap-2">
                      <span className="text-slate-500 mt-0.5">-</span>
                      <div>
                        <span className="text-slate-300">
                          {QUALITY_REASON_LABELS[reason]}
                        </span>
                        <p className="text-slate-500 mt-0.5">
                          {QUALITY_REASON_SUGGESTIONS[reason]}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="px-4 py-3">
              <p className="text-xs text-emerald-400 flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5" />
                All quality checks passed
              </p>
            </div>
          )}

          {/* Improve CTA */}
          {showImproveCta && result.quality !== 'high' && onImprove && (
            <div className="px-4 py-3 border-t border-slate-700 bg-slate-800/50 rounded-b-lg">
              <button
                onClick={() => {
                  setShowTooltip(false);
                  onImprove();
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-white bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Improve Brief with AI
              </button>
            </div>
          )}

          {/* Close hint */}
          <div className="px-4 py-2 border-t border-slate-700/50 bg-slate-900/50 rounded-b-lg">
            <p className="text-[10px] text-slate-500 text-center">
              Click outside to close
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default BriefQualityBadge;
