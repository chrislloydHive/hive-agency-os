'use client';

// components/context-v4/ContextV4HealthGate.tsx
// Context V4 Health Gate Component
//
// Soft gate that informs users about Context V4 baseline health before AI generation.
// - GREEN: Renders nothing (or optional subtle indicator)
// - YELLOW: Soft warning with CTA to review
// - RED: Strong warning but still allows proceeding
//
// Does NOT hard block - always allows users to continue.

import Link from 'next/link';
import { AlertTriangle, AlertCircle, CheckCircle, ArrowRight, Sparkles } from 'lucide-react';
import type { V4HealthResponse, V4HealthStatus, V4HealthReason } from '@/lib/types/contextV4Health';
import { V4_HEALTH_REASON_LABELS } from '@/lib/types/contextV4Health';

// ============================================================================
// Types
// ============================================================================

export interface ContextV4HealthGateProps {
  health: V4HealthResponse;
  companyId: string;
  /** Called when user clicks "Continue Anyway" or "Generate Anyway" */
  onContinue?: () => void;
  /** Whether to show the continue button (set false if parent handles it) */
  showContinueButton?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function ContextV4HealthGate({
  health,
  companyId,
  onContinue,
  showContinueButton = true,
}: ContextV4HealthGateProps) {
  // GREEN status - render nothing (baseline is healthy)
  if (health.status === 'GREEN') {
    return null;
  }

  const isRed = health.status === 'RED';
  const reviewQueuePath = `/context-v4/${companyId}/review`;

  // Limit reasons displayed to 3 for UX
  const displayReasons = health.reasons.slice(0, 3);
  const hasMoreReasons = health.reasons.length > 3;

  return (
    <div
      className={`
        rounded-lg border p-4 mb-6 max-w-lg w-full text-left
        ${isRed
          ? 'bg-red-900/20 border-red-700/50'
          : 'bg-amber-900/20 border-amber-700/50'
        }
      `}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="shrink-0 mt-0.5">
          {isRed ? (
            <AlertCircle className="w-5 h-5 text-red-400" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1">
          {/* Title */}
          <h3
            className={`font-medium mb-1 ${
              isRed ? 'text-red-200' : 'text-amber-200'
            }`}
          >
            {isRed ? 'Baseline is broken or missing' : 'Your baseline may be incomplete'}
          </h3>

          {/* Description */}
          <p
            className={`text-sm mb-3 ${
              isRed ? 'text-red-300/70' : 'text-amber-300/70'
            }`}
          >
            {isRed
              ? 'Program generation may fail or produce incorrect output until these issues are resolved.'
              : 'We found issues that may reduce the quality of AI-generated programs.'}
          </p>

          {/* Reasons List */}
          <div className="space-y-1.5 mb-4">
            {displayReasons.map((reason) => (
              <div
                key={reason}
                className={`text-sm flex items-start gap-2 ${
                  isRed ? 'text-red-300/90' : 'text-amber-300/90'
                }`}
              >
                <span className="mt-0.5">•</span>
                <span>{V4_HEALTH_REASON_LABELS[reason]}</span>
              </div>
            ))}
            {hasMoreReasons && (
              <div
                className={`text-xs ${
                  isRed ? 'text-red-400/70' : 'text-amber-400/70'
                }`}
              >
                +{health.reasons.length - 3} more issues
              </div>
            )}
          </div>

          {/* CTAs */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Primary CTA - Review / Fix Baseline */}
            <Link
              href={reviewQueuePath}
              className={`
                inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded transition-colors
                ${isRed
                  ? 'bg-red-600 hover:bg-red-500 text-white'
                  : 'bg-amber-600 hover:bg-amber-500 text-white'
                }
              `}
            >
              {isRed ? 'Fix Baseline' : 'Review Context Baseline'}
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>

            {/* Secondary CTA - Continue Anyway */}
            {showContinueButton && onContinue && (
              <button
                onClick={onContinue}
                className={`
                  inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded transition-colors
                  ${isRed
                    ? 'text-red-400/80 hover:text-red-300 hover:bg-red-900/30'
                    : 'text-amber-400/80 hover:text-amber-300 hover:bg-amber-900/30'
                  }
                `}
              >
                <Sparkles className="w-3.5 h-3.5" />
                {isRed ? 'Generate Anyway' : 'Continue Anyway'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Inline Warning (for under buttons)
// ============================================================================

export interface ContextV4HealthInlineWarningProps {
  health: V4HealthResponse;
}

/**
 * Small inline warning text to show under Generate button
 * when health status is not GREEN.
 */
export function ContextV4HealthInlineWarning({ health }: ContextV4HealthInlineWarningProps) {
  if (health.status === 'GREEN') {
    return null;
  }

  const isRed = health.status === 'RED';

  return (
    <p className={`text-xs mt-2 flex items-center gap-1 ${isRed ? 'text-red-400' : 'text-amber-400'}`}>
      {isRed ? (
        <AlertCircle className="w-3 h-3" />
      ) : (
        <AlertTriangle className="w-3 h-3" />
      )}
      Baseline issues detected — output quality may be affected.
    </p>
  );
}

// ============================================================================
// Subtle Green Indicator (optional nice-to-have)
// ============================================================================

export interface ContextV4HealthReadyIndicatorProps {
  health: V4HealthResponse;
}

/**
 * Subtle "Baseline ready" indicator shown when status is GREEN.
 * Optional - can be used to show users their baseline is healthy.
 */
export function ContextV4HealthReadyIndicator({ health }: ContextV4HealthReadyIndicatorProps) {
  if (health.status !== 'GREEN') {
    return null;
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-green-400/70 mb-4">
      <CheckCircle className="w-3.5 h-3.5" />
      <span>Baseline ready</span>
    </div>
  );
}
