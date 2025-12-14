// components/context/StrategyInputsReadinessBanner.tsx
// Strategy Inputs Readiness Banner (Binding-Based)
//
// Uses the Strategy ↔ Context Bindings as the source of truth.
// Real-time sync via useContextNodes hook.
//
// Features:
// - Shows missing required fields with deep links to Context
// - Distinguishes between confirmed and proposed values
// - Updates in real-time when Context changes
// - Provides "AI Propose" action for missing AI-proposable fields

'use client';

import { useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Sparkles,
  Loader2,
} from 'lucide-react';
import {
  useContextNodes,
  proposeContextValues,
  type ContextNodesResponse,
  type ResolvedBinding,
} from '@/hooks/useContextNodes';

// ============================================================================
// Types
// ============================================================================

interface StrategyInputsReadinessBannerProps {
  /** Company ID */
  companyId: string;
  /** Optional: Compact mode for smaller displays */
  compact?: boolean;
  /** Optional: Show AI propose action */
  showAIPropose?: boolean;
  /** Optional: Callback when readiness changes */
  onReadinessChange?: (readiness: ContextNodesResponse['readiness']) => void;
}

// ============================================================================
// Component
// ============================================================================

export function StrategyInputsReadinessBanner({
  companyId,
  compact = false,
  showAIPropose = true,
  onReadinessChange,
}: StrategyInputsReadinessBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const [proposing, setProposing] = useState(false);
  const [proposeError, setProposeError] = useState<string | null>(null);

  // Real-time sync with Context nodes
  const { data, error, isLoading, isValidating, mutate } = useContextNodes(companyId);

  // Extract readiness data
  const readiness = data?.readiness;
  const resolvedBindings = data?.resolvedBindings || [];
  const recommendedNext = data?.recommendedNext;

  // Notify parent of readiness changes
  useMemo(() => {
    if (readiness && onReadinessChange) {
      onReadinessChange(readiness);
    }
  }, [readiness, onReadinessChange]);

  // Categorize bindings
  const { missingRequired, proposedRequired, confirmedRequired } = useMemo(() => {
    const missing: typeof resolvedBindings = [];
    const proposed: typeof resolvedBindings = [];
    const confirmed: typeof resolvedBindings = [];

    for (const rb of resolvedBindings) {
      if (!rb.binding.required) continue;

      if (rb.status === 'missing') {
        missing.push(rb);
      } else if (rb.status === 'proposed') {
        proposed.push(rb);
      } else if (rb.status === 'confirmed') {
        confirmed.push(rb);
      }
    }

    return {
      missingRequired: missing,
      proposedRequired: proposed,
      confirmedRequired: confirmed,
    };
  }, [resolvedBindings]);

  // Get AI-proposable missing fields
  const aiProposableFields = useMemo(() => {
    return missingRequired
      .filter(rb => rb.binding.aiProposable)
      .map(rb => rb.binding.contextKey);
  }, [missingRequired]);

  // Handle AI propose action
  const handleAIPropose = useCallback(async () => {
    if (aiProposableFields.length === 0) return;

    setProposing(true);
    setProposeError(null);

    const result = await proposeContextValues(companyId, aiProposableFields);

    setProposing(false);

    if (!result.success) {
      setProposeError(result.error || 'Failed to generate proposals');
    } else if (result.proposalCount && result.proposalCount > 0) {
      // Refresh data to show new proposals
      mutate();
    }
  }, [companyId, aiProposableFields, mutate]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50">
        <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
        <span className="text-sm text-slate-400">Loading context...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
        <AlertTriangle className="w-4 h-4 text-red-400" />
        <span className="text-sm text-red-400">Failed to load context</span>
      </div>
    );
  }

  // No data
  if (!readiness) return null;

  // Fully ready
  const isFullyReady = readiness.missingRequiredCount === 0 && readiness.proposedRequiredCount === 0;

  // Has proposed but no missing
  const hasPendingProposals = readiness.proposedRequiredCount > 0 && readiness.missingRequiredCount === 0;

  // Determine status styling
  const statusColor = isFullyReady
    ? 'text-emerald-400'
    : hasPendingProposals
    ? 'text-amber-400'
    : 'text-amber-400';

  const bgColor = isFullyReady
    ? 'bg-emerald-500/10 border-emerald-500/20'
    : hasPendingProposals
    ? 'bg-amber-500/10 border-amber-500/20'
    : 'bg-amber-500/10 border-amber-500/20';

  const StatusIcon = isFullyReady ? CheckCircle : hasPendingProposals ? Clock : AlertTriangle;

  // Status text
  const statusText = isFullyReady
    ? 'Strategy-Ready'
    : hasPendingProposals
    ? `${readiness.proposedRequiredCount} pending review`
    : `${readiness.missingRequiredCount} inputs missing`;

  // Compact mode
  if (compact) {
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${bgColor}`}>
        <StatusIcon className={`w-4 h-4 ${statusColor}`} />
        <span className={`text-sm font-medium ${statusColor}`}>{statusText}</span>
        <span className="text-xs text-slate-500">
          {readiness.readinessPercent}%
        </span>
        {isValidating && (
          <Loader2 className="w-3 h-3 text-slate-500 animate-spin" />
        )}
      </div>
    );
  }

  // Full ready - minimal display
  if (isFullyReady) {
    return (
      <div className={`rounded-lg border ${bgColor} px-4 py-3`}>
        <div className="flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-400" />
          <div>
            <span className="text-sm font-medium text-emerald-400">Strategy-Ready</span>
            <span className="text-xs text-slate-500 ml-2">
              All required inputs confirmed
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Full banner with expandable details
  return (
    <div className={`rounded-xl border ${bgColor} overflow-hidden`}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`p-1.5 rounded-lg ${
            hasPendingProposals ? 'bg-amber-500/20' : 'bg-amber-500/20'
          }`}>
            <StatusIcon className={`w-4 h-4 ${statusColor}`} />
          </div>
          <div className="text-left">
            <span className={`text-sm font-medium ${statusColor}`}>
              Strategy Inputs Incomplete
            </span>
            <span className={`ml-2 px-1.5 py-0.5 text-xs font-medium rounded ${
              readiness.readinessPercent >= 75
                ? 'bg-emerald-500/20 text-emerald-400'
                : readiness.readinessPercent >= 50
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-red-500/20 text-red-400'
            }`}>
              {readiness.readinessPercent}% complete
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isValidating && (
            <Loader2 className="w-3 h-3 text-slate-500 animate-spin" />
          )}
          {(missingRequired.length > 0 || proposedRequired.length > 0) && (
            expanded ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/5">
          {/* Missing required fields */}
          {missingRequired.length > 0 && (
            <div className="pt-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                  Missing Required ({missingRequired.length})
                </h4>
                {showAIPropose && aiProposableFields.length > 0 && (
                  <button
                    onClick={handleAIPropose}
                    disabled={proposing}
                    className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-purple-400 bg-purple-500/10 rounded hover:bg-purple-500/20 transition-colors disabled:opacity-50"
                  >
                    {proposing ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Sparkles className="w-3 h-3" />
                    )}
                    AI Propose ({aiProposableFields.length})
                  </button>
                )}
              </div>
              {proposeError && (
                <p className="text-xs text-red-400 mb-2">{proposeError}</p>
              )}
              <ul className="space-y-1.5">
                {missingRequired.map((rb) => (
                  <MissingFieldItem
                    key={rb.binding.contextKey}
                    binding={rb}
                    companyId={companyId}
                  />
                ))}
              </ul>
            </div>
          )}

          {/* Proposed fields (need confirmation) */}
          {proposedRequired.length > 0 && (
            <div className={missingRequired.length > 0 ? 'pt-2' : 'pt-3'}>
              <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
                Pending Review ({proposedRequired.length})
              </h4>
              <ul className="space-y-1.5">
                {proposedRequired.map((rb) => (
                  <ProposedFieldItem
                    key={rb.binding.contextKey}
                    binding={rb}
                    companyId={companyId}
                  />
                ))}
              </ul>
            </div>
          )}

          {/* Synthesize blocked message */}
          {!readiness.canSynthesize && (
            <div className="mt-3 pt-2 border-t border-amber-500/20">
              <p className="text-xs text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3" />
                Synthesize Strategy disabled until critical inputs are added
              </p>
            </div>
          )}

          {/* Recommended next action */}
          {recommendedNext && (
            <div className="mt-3 pt-2 border-t border-slate-700">
              <p className="text-xs text-slate-500 mb-1">Recommended next:</p>
              <Link
                href={recommendedNext.route}
                className="inline-flex items-center gap-1.5 text-sm text-cyan-400 hover:text-cyan-300"
              >
                Add {recommendedNext.label}
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

interface FieldItemProps {
  binding: ResolvedBinding;
  companyId: string;
}

function MissingFieldItem({ binding, companyId }: FieldItemProps) {
  // Build route from serialized binding data
  const route = `/c/${companyId}/context?focusKey=${encodeURIComponent(binding.binding.contextKey)}&zone=${encodeURIComponent(binding.binding.zone)}`;

  return (
    <li className="flex items-center justify-between gap-2 text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-slate-500">•</span>
        <span className="text-slate-300 truncate">
          {binding.binding.shortLabel || binding.binding.label}
        </span>
        {binding.binding.aiProposable && (
          <Sparkles className="w-3 h-3 text-purple-400/50 flex-shrink-0" />
        )}
      </div>
      <Link
        href={route}
        className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 whitespace-nowrap"
      >
        {binding.binding.emptyStateCTA || 'Add'}
        <ExternalLink className="w-3 h-3" />
      </Link>
    </li>
  );
}

function ProposedFieldItem({ binding, companyId }: FieldItemProps) {
  // Build route from serialized binding data
  const route = `/c/${companyId}/context?focusKey=${encodeURIComponent(binding.binding.contextKey)}&zone=${encodeURIComponent(binding.binding.zone)}`;

  // Format the proposed value for display
  const valuePreview = useMemo(() => {
    const value = binding.value;
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value.slice(0, 30) + (value.length > 30 ? '...' : '');
    if (Array.isArray(value)) return `${value.length} item${value.length !== 1 ? 's' : ''}`;
    return 'Proposed';
  }, [binding.value]);

  return (
    <li className="flex items-center justify-between gap-2 text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <Clock className="w-3 h-3 text-amber-400 flex-shrink-0" />
        <span className="text-slate-300 truncate">
          {binding.binding.shortLabel || binding.binding.label}
        </span>
        <span className="text-xs text-slate-500 truncate">
          {valuePreview}
        </span>
      </div>
      <Link
        href={route}
        className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 whitespace-nowrap"
      >
        Review
        <ExternalLink className="w-3 h-3" />
      </Link>
    </li>
  );
}

export default StrategyInputsReadinessBanner;
