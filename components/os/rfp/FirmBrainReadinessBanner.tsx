'use client';

// components/os/rfp/FirmBrainReadinessBanner.tsx
// Displays Firm Brain readiness warnings for RFP generation
// Used in RFP Create modal and RFP Builder

import { AlertTriangle, CheckCircle, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';
import type { FirmBrainReadiness } from '@/lib/os/ai/firmBrainReadiness';
import {
  getReadinessLabel,
  getReadinessColorClass,
  getReadinessBgClass,
} from '@/lib/os/ai/firmBrainReadiness';

interface FirmBrainReadinessBannerProps {
  readiness: FirmBrainReadiness;
  /** Variant: 'compact' for modals, 'expanded' for pages */
  variant?: 'compact' | 'expanded';
  /** Whether to show the "Go to Settings" link */
  showSettingsLink?: boolean;
}

export function FirmBrainReadinessBanner({
  readiness,
  variant = 'compact',
  showSettingsLink = true,
}: FirmBrainReadinessBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const { score, missing, weak, qualityWarnings, recommendGeneration } = readiness;

  // Determine icon and styling based on score
  const label = getReadinessLabel(score);
  const colorClass = getReadinessColorClass(score);
  const bgClass = getReadinessBgClass(score);

  const Icon = score >= 60 ? CheckCircle : score >= 40 ? Info : AlertTriangle;

  // Compact variant - single line with optional expand
  if (variant === 'compact') {
    return (
      <div className={`rounded-lg border ${bgClass} ${
        score >= 60 ? 'border-emerald-500/20' :
        score >= 40 ? 'border-amber-500/20' :
        'border-red-500/20'
      }`}>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="w-full px-3 py-2 flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <Icon className={`w-4 h-4 ${colorClass}`} />
            <span className="text-sm text-slate-300">
              Firm Brain readiness: <span className={colorClass}>{score}%</span>
              <span className="text-slate-500 ml-1">({label})</span>
            </span>
          </div>
          {(missing.length > 0 || weak.length > 0 || qualityWarnings.length > 0) && (
            expanded
              ? <ChevronUp className="w-4 h-4 text-slate-500" />
              : <ChevronDown className="w-4 h-4 text-slate-500" />
          )}
        </button>

        {expanded && (missing.length > 0 || weak.length > 0 || qualityWarnings.length > 0) && (
          <div className="px-3 pb-3 space-y-2 border-t border-slate-700/50 pt-2">
            {missing.length > 0 && (
              <div className="text-xs text-red-400">
                <span className="font-medium">Missing:</span> {missing.join(', ')}
              </div>
            )}
            {weak.length > 0 && (
              <div className="text-xs text-amber-400">
                <span className="font-medium">Needs attention:</span> {weak.join(', ')}
              </div>
            )}
            {qualityWarnings.length > 0 && (
              <ul className="text-xs text-slate-400 space-y-0.5">
                {qualityWarnings.slice(0, 3).map((w, i) => (
                  <li key={i}>• {w}</li>
                ))}
              </ul>
            )}
            {showSettingsLink && score < 60 && (
              <Link
                href="/settings/firm-brain"
                className="inline-block text-xs text-purple-400 hover:text-purple-300"
              >
                Configure Firm Brain →
              </Link>
            )}
          </div>
        )}
      </div>
    );
  }

  // Expanded variant - full display for pages
  return (
    <div className={`rounded-xl border ${bgClass} ${
      score >= 60 ? 'border-emerald-500/20' :
      score >= 40 ? 'border-amber-500/20' :
      'border-red-500/20'
    } p-4`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <Icon className={`w-5 h-5 mt-0.5 ${colorClass}`} />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">
                Firm Brain Readiness
              </span>
              <span className={`text-sm font-bold ${colorClass}`}>
                {score}%
              </span>
              <span className={`text-xs px-1.5 py-0.5 rounded ${bgClass} ${colorClass}`}>
                {label}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {readiness.summary}
            </p>
          </div>
        </div>

        {showSettingsLink && score < 80 && (
          <Link
            href="/settings/firm-brain"
            className="text-xs text-purple-400 hover:text-purple-300 whitespace-nowrap"
          >
            Configure →
          </Link>
        )}
      </div>

      {(missing.length > 0 || weak.length > 0) && (
        <div className="mt-3 pt-3 border-t border-slate-700/50 grid grid-cols-2 gap-3">
          {missing.length > 0 && (
            <div>
              <span className="text-xs font-medium text-red-400">Missing</span>
              <ul className="mt-1 text-xs text-slate-400 space-y-0.5">
                {missing.map((m, i) => (
                  <li key={i}>• {m}</li>
                ))}
              </ul>
            </div>
          )}
          {weak.length > 0 && (
            <div>
              <span className="text-xs font-medium text-amber-400">Needs Attention</span>
              <ul className="mt-1 text-xs text-slate-400 space-y-0.5">
                {weak.map((w, i) => (
                  <li key={i}>• {w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {qualityWarnings.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-700/50">
          <span className="text-xs font-medium text-slate-500">AI Quality Notes</span>
          <ul className="mt-1 text-xs text-slate-400 space-y-0.5">
            {qualityWarnings.map((w, i) => (
              <li key={i}>• {w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Simple inline readiness indicator
 */
export function FirmBrainReadinessInline({
  score,
}: {
  score: number;
}) {
  const colorClass = getReadinessColorClass(score);

  return (
    <span className={`text-xs ${colorClass}`}>
      Firm Brain: {score}%
    </span>
  );
}
