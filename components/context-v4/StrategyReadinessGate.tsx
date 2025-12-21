'use client';

// components/context-v4/StrategyReadinessGate.tsx
// Strategy Readiness Gate Component
//
// Gates Strategy generation based on Context V4 readiness.
// Shows missing required keys with links to Review Queue.
// Allows "Override anyway" with warning.

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, AlertCircle, CheckCircle, ArrowRight, Sparkles, Lock, Loader2 } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface ReadinessResponse {
  ok: boolean;
  companyId: string;
  readinessScore: number;
  ready: boolean;
  threshold: number;
  requiredKeysMissing: string[];
  requiredKeysConfirmed: string[];
  requiredKeysProposed: string[];
  confirmedCount: number;
  proposedCount: number;
  hasErrorState: boolean;
  error?: string;
}

export interface StrategyReadinessGateProps {
  companyId: string;
  /** Called when user clicks "Generate Strategy" (only if ready or overridden) */
  onProceed: () => void;
  /** Text for the generate button */
  generateLabel?: string;
  /** Whether the parent is currently generating */
  isGenerating?: boolean;
  /** Minimum threshold (default 60) */
  threshold?: number;
  /** Whether to allow override when not ready */
  allowOverride?: boolean;
}

// Field key to human-readable label mapping
const FIELD_LABELS: Record<string, string> = {
  'identity.companyDescription': 'Company Description',
  'identity.industry': 'Industry',
  'audience.primaryAudience': 'Primary Audience',
  'audience.audienceSegments': 'Audience Segments',
  'productOffer.valueProposition': 'Value Proposition',
  'productOffer.keyProducts': 'Key Products',
  'brand.positioningStatement': 'Positioning Statement',
  'brand.brandVoice': 'Brand Voice',
  'website.websiteScore': 'Website Score',
  'website.websiteSummary': 'Website Summary',
};

function getFieldLabel(key: string): string {
  return FIELD_LABELS[key] || key.split('.').pop() || key;
}

// ============================================================================
// Component
// ============================================================================

export function StrategyReadinessGate({
  companyId,
  onProceed,
  generateLabel = 'Generate Strategy',
  isGenerating = false,
  threshold = 60,
  allowOverride = true,
}: StrategyReadinessGateProps) {
  const [readiness, setReadiness] = useState<ReadinessResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showOverrideConfirm, setShowOverrideConfirm] = useState(false);

  useEffect(() => {
    async function fetchReadiness() {
      try {
        const response = await fetch(
          `/api/os/companies/${companyId}/context/v4/readiness?threshold=${threshold}`,
          { cache: 'no-store' }
        );
        const data = await response.json();

        if (!data.ok) {
          setError(data.error || 'Failed to check readiness');
        } else {
          setReadiness(data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchReadiness();
  }, [companyId, threshold]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
        <span className="ml-2 text-slate-400">Checking context readiness...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-red-200 font-medium">Failed to check readiness</h3>
            <p className="text-red-300/70 text-sm mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Ready state - show green indicator and proceed button
  if (readiness?.ready) {
    return (
      <div className="space-y-4">
        <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 shrink-0" />
            <div className="flex-1">
              <h3 className="text-green-200 font-medium">Context Ready for Strategy</h3>
              <p className="text-green-300/70 text-sm mt-1">
                {readiness.confirmedCount} confirmed fields ({readiness.readinessScore}% readiness)
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={onProceed}
          disabled={isGenerating}
          className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              {generateLabel}
            </>
          )}
        </button>
      </div>
    );
  }

  // Not ready - show warning with missing fields
  const reviewQueuePath = `/context-v4/${companyId}/review`;
  const missingCount = readiness?.requiredKeysMissing.length || 0;
  const proposedCount = readiness?.requiredKeysProposed.length || 0;

  return (
    <div className="space-y-4">
      {/* Warning Banner */}
      <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
          <div className="flex-1">
            <h3 className="text-amber-200 font-medium">
              Context Not Ready for Strategy
            </h3>
            <p className="text-amber-300/70 text-sm mt-1">
              {readiness?.readinessScore || 0}% readiness (threshold: {threshold}%)
              {missingCount > 0 && ` • ${missingCount} required fields missing`}
              {proposedCount > 0 && ` • ${proposedCount} awaiting review`}
            </p>

            {/* Missing fields list */}
            {readiness && readiness.requiredKeysMissing.length > 0 && (
              <div className="mt-3 space-y-1">
                <p className="text-xs text-amber-400 font-medium uppercase tracking-wide">
                  Missing Required Fields:
                </p>
                {readiness.requiredKeysMissing.slice(0, 5).map((key) => {
                  const domain = key.split('.')[0];
                  return (
                    <Link
                      key={key}
                      href={`${reviewQueuePath}?domain=${encodeURIComponent(domain)}`}
                      className="flex items-center gap-2 text-sm text-amber-300/90 hover:text-amber-200 transition-colors"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400/60" />
                      <span>{getFieldLabel(key)}</span>
                      <ArrowRight className="w-3 h-3 opacity-50" />
                    </Link>
                  );
                })}
                {readiness.requiredKeysMissing.length > 5 && (
                  <p className="text-xs text-amber-400/70">
                    +{readiness.requiredKeysMissing.length - 5} more
                  </p>
                )}
              </div>
            )}

            {/* Proposed fields (awaiting review) */}
            {readiness && readiness.requiredKeysProposed.length > 0 && (
              <div className="mt-3 space-y-1">
                <p className="text-xs text-amber-400 font-medium uppercase tracking-wide">
                  Awaiting Review:
                </p>
                {readiness.requiredKeysProposed.slice(0, 3).map((key) => {
                  const domain = key.split('.')[0];
                  return (
                    <Link
                      key={key}
                      href={`${reviewQueuePath}?domain=${encodeURIComponent(domain)}`}
                      className="flex items-center gap-2 text-sm text-amber-300/90 hover:text-amber-200 transition-colors"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400/60" />
                      <span>{getFieldLabel(key)}</span>
                      <ArrowRight className="w-3 h-3 opacity-50" />
                    </Link>
                  );
                })}
                {readiness.requiredKeysProposed.length > 3 && (
                  <p className="text-xs text-amber-400/70">
                    +{readiness.requiredKeysProposed.length - 3} more
                  </p>
                )}
              </div>
            )}

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <Link
                href={reviewQueuePath}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded transition-colors"
              >
                Review Context
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Generate Button - Disabled or Override */}
      {allowOverride ? (
        showOverrideConfirm ? (
          <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
              <div className="flex-1">
                <h3 className="text-red-200 font-medium">
                  Generate with incomplete context?
                </h3>
                <p className="text-red-300/70 text-sm mt-1">
                  Strategy quality may be affected. Missing context often leads to generic or incorrect recommendations.
                </p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={onProceed}
                    disabled={isGenerating}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded transition-colors disabled:opacity-50"
                  >
                    {isGenerating ? 'Generating...' : 'Generate Anyway'}
                  </button>
                  <button
                    onClick={() => setShowOverrideConfirm(false)}
                    className="px-3 py-1.5 text-slate-400 hover:text-slate-300 text-sm font-medium rounded transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowOverrideConfirm(true)}
            disabled={isGenerating}
            className="w-full py-3 px-4 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium rounded-lg flex items-center justify-center gap-2 transition-colors border border-slate-600"
          >
            <Lock className="w-4 h-4" />
            {generateLabel} (Context Incomplete)
          </button>
        )
      ) : (
        <button
          disabled
          className="w-full py-3 px-4 bg-slate-800 text-slate-500 font-medium rounded-lg flex items-center justify-center gap-2 cursor-not-allowed"
        >
          <Lock className="w-4 h-4" />
          Complete Context to Generate
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Hook for programmatic access
// ============================================================================

export function useStrategyReadiness(companyId: string, threshold: number = 60) {
  const [readiness, setReadiness] = useState<ReadinessResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReadiness() {
      try {
        const response = await fetch(
          `/api/os/companies/${companyId}/context/v4/readiness?threshold=${threshold}`,
          { cache: 'no-store' }
        );
        const data = await response.json();

        if (!data.ok) {
          setError(data.error || 'Failed to check readiness');
        } else {
          setReadiness(data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchReadiness();
  }, [companyId, threshold]);

  return {
    readiness,
    loading,
    error,
    isReady: readiness?.ready ?? false,
    readinessScore: readiness?.readinessScore ?? 0,
    missingKeys: readiness?.requiredKeysMissing ?? [],
    proposedKeys: readiness?.requiredKeysProposed ?? [],
  };
}
