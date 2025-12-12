// REUSE REQUIRED
// - Must reuse existing Context Workspace section components if present
// - Must map to Context Graph domains (no parallel context model)
// - Must render existing Proposal type (no new diff format)

// components/context/ContextQualityBanner.tsx
// Context V2 Quality Banner
//
// Shows context quality assessment based on lab weighting.
// Displays when context quality is low or has recommendations.

'use client';

import { useState } from 'react';
import type { ContextQualityAssessment, FieldWeight } from '@/lib/os/contextV2/labWeighting';

interface ContextQualityBannerProps {
  quality: ContextQualityAssessment;
  className?: string;
  /** Whether to show in compact mode (just score + expand) */
  compact?: boolean;
}

const WEIGHT_COLORS: Record<FieldWeight, { bg: string; text: string; border: string }> = {
  high: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  medium: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  low: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
  none: { bg: 'bg-slate-800/50', text: 'text-slate-500', border: 'border-slate-700' },
};

export function ContextQualityBanner({
  quality,
  className = '',
  compact = false,
}: ContextQualityBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const colors = WEIGHT_COLORS[quality.overallWeight];

  // Don't show banner if quality is high and no issues
  if (
    quality.overallWeight === 'high' &&
    quality.needsReviewInputs.length === 0 &&
    quality.recommendations.length === 0
  ) {
    return null;
  }

  const hasDetails =
    quality.lowConfidenceInputs.length > 0 ||
    quality.needsReviewInputs.length > 0 ||
    quality.recommendations.length > 0;

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text} border ${colors.border}`}
        >
          <QualityIcon weight={quality.overallWeight} />
          {quality.overallScore}% Quality
        </span>
        {hasDetails && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-slate-500 hover:text-slate-300 underline"
          >
            {isExpanded ? 'Hide details' : 'Show details'}
          </button>
        )}
        {isExpanded && hasDetails && (
          <ExpandedDetails quality={quality} />
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-lg border ${colors.border} ${colors.bg} p-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <QualityIcon weight={quality.overallWeight} />
          <div>
            <span className={`text-sm font-medium ${colors.text}`}>
              Context Quality: {quality.overallScore}%
            </span>
            <span className="text-xs text-slate-500 ml-2">
              ({quality.overallWeight === 'high' ? 'Good' : quality.overallWeight === 'medium' ? 'Fair' : 'Needs work'})
            </span>
          </div>
        </div>
        {hasDetails && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            <svg
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}
      </div>

      {/* Inline Summary */}
      {!isExpanded && (
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {quality.lowConfidenceInputs.length > 0 && (
            <span className="text-red-400/80">
              {quality.lowConfidenceInputs.length} low confidence
            </span>
          )}
          {quality.needsReviewInputs.length > 0 && (
            <span className="text-blue-400/80">
              {quality.needsReviewInputs.length} need review
            </span>
          )}
        </div>
      )}

      {/* Expanded Details */}
      {isExpanded && hasDetails && (
        <ExpandedDetails quality={quality} />
      )}
    </div>
  );
}

function QualityIcon({ weight }: { weight: FieldWeight }) {
  const colors = WEIGHT_COLORS[weight];

  if (weight === 'high') {
    return (
      <svg className={`w-4 h-4 ${colors.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }

  if (weight === 'medium') {
    return (
      <svg className={`w-4 h-4 ${colors.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    );
  }

  return (
    <svg className={`w-4 h-4 ${colors.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ExpandedDetails({ quality }: { quality: ContextQualityAssessment }) {
  return (
    <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-3">
      {/* Low Confidence Inputs */}
      {quality.lowConfidenceInputs.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
            Low Confidence Fields
          </div>
          <div className="flex flex-wrap gap-1">
            {quality.lowConfidenceInputs.map((field) => (
              <span
                key={field}
                className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30"
              >
                {field}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Needs Review */}
      {quality.needsReviewInputs.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
            Needs Review
          </div>
          <div className="flex flex-wrap gap-1">
            {quality.needsReviewInputs.map((field) => (
              <span
                key={field}
                className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30"
              >
                {field}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {quality.recommendations.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
            Recommendations
          </div>
          <ul className="space-y-1">
            {quality.recommendations.map((rec, i) => (
              <li key={i} className="text-xs text-slate-400 flex items-start gap-1.5">
                <svg className="w-3 h-3 mt-0.5 text-amber-500/70 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
