'use client';

// components/context-v4/FlowReadinessBanner.tsx
// Unified Flow Readiness Banner Component
//
// Displays flow readiness status with consistent styling across surfaces.
// Supports both:
// - Legacy V4HealthResponse (backward compatible)
// - Multi-signal FlowReadinessResolved
//
// Variants:
// - "compact": Inline indicator/pill for headers
// - "full": Full banner with reasons, details, and CTAs

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ExternalLink,
  RefreshCw,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import type { V4HealthResponse, V4HealthStatus } from '@/lib/types/contextV4Health';
import { V4_HEALTH_STATUS_LABELS, V4_HEALTH_REASON_LABELS } from '@/lib/types/contextV4Health';
import type {
  FlowReadinessResolved,
  FlowReadinessStatus,
  FlowReadinessSignal,
  RankedReason,
} from '@/lib/types/flowReadiness';
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/types/flowReadiness';
import { resolveFlowReadiness, getAllCtas } from '@/lib/flowReadiness/resolveFlowReadiness';
import { contextV4HealthToSignal } from '@/lib/flowReadiness/adapters/contextV4HealthAdapter';

// ============================================================================
// Types
// ============================================================================

/** Common props for both input modes */
interface CommonProps {
  /** Display variant */
  variant?: 'compact' | 'full';
  /** Whether to show action buttons for YELLOW/RED (default: true) */
  showActions?: boolean;
  /** Handler for re-triggering proposal (if provided, shows button) */
  onRetriggerProposal?: () => Promise<void> | void;
  /** Whether re-trigger is in progress */
  retriggerLoading?: boolean;
  /** Override link to context inspector */
  inspectorHref?: string;
  /** Override link to review queue */
  reviewQueueHref?: string;
  /** Whether to show expandable details panel (default: true for full variant) */
  showDetails?: boolean;
  /** Callback when user dismisses/continues past the banner */
  onContinue?: () => void;
  /** Whether to show continue button */
  showContinueButton?: boolean;
  /** Handler map for CTA onClickIds */
  onClickHandlers?: Record<string, () => Promise<void> | void>;
}

/** Legacy props with V4HealthResponse */
interface HealthProps extends CommonProps {
  /** V4 health data (legacy mode) */
  health: V4HealthResponse;
  readiness?: never;
}

/** New props with FlowReadinessResolved */
interface ReadinessProps extends CommonProps {
  /** Resolved multi-signal readiness (new mode) */
  readiness: FlowReadinessResolved;
  health?: never;
}

export type FlowReadinessBannerProps = HealthProps | ReadinessProps;

// ============================================================================
// Status Styles (for legacy compatibility)
// ============================================================================

const STATUS_STYLES: Record<V4HealthStatus, {
  bg: string;
  border: string;
  text: string;
  dot: string;
  icon: typeof CheckCircle;
}> = {
  GREEN: {
    bg: 'bg-green-500/20',
    border: 'border-green-500/30',
    text: 'text-green-400',
    dot: 'bg-green-400',
    icon: CheckCircle,
  },
  YELLOW: {
    bg: 'bg-amber-500/20',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    dot: 'bg-amber-400',
    icon: AlertTriangle,
  },
  RED: {
    bg: 'bg-red-500/20',
    border: 'border-red-500/30',
    text: 'text-red-400',
    dot: 'bg-red-400',
    icon: AlertCircle,
  },
};

// ============================================================================
// Helpers
// ============================================================================

function formatAge(minutes: number | null): string {
  if (minutes === null) return 'Unknown';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}

/**
 * Get icon for a status
 */
function getStatusIcon(status: FlowReadinessStatus) {
  switch (status) {
    case 'GREEN':
      return CheckCircle;
    case 'YELLOW':
      return AlertTriangle;
    case 'RED':
      return AlertCircle;
  }
}

/**
 * Normalize props to resolved readiness
 */
function useResolvedReadiness(props: FlowReadinessBannerProps): FlowReadinessResolved {
  return useMemo(() => {
    if ('readiness' in props && props.readiness) {
      return props.readiness;
    }
    // Legacy mode: adapt health → signal → resolve
    const signal = contextV4HealthToSignal(props.health);
    return resolveFlowReadiness([signal]);
  }, [props]);
}

/**
 * Get legacy health from props (for backward compatible rendering)
 */
function getLegacyHealth(props: FlowReadinessBannerProps): V4HealthResponse | null {
  if ('health' in props && props.health) {
    return props.health;
  }
  return null;
}

// ============================================================================
// Compact Variant Components
// ============================================================================

interface StatusPillPropsMulti {
  status: FlowReadinessStatus;
  label: string;
  expanded: boolean;
  onToggle: () => void;
}

function StatusPillMulti({ status, label, expanded, onToggle }: StatusPillPropsMulti) {
  const style = STATUS_COLORS[status];

  return (
    <button
      onClick={onToggle}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${style.bg} ${style.text} ${style.border} hover:opacity-80 transition-opacity`}
    >
      <span className={`w-2 h-2 rounded-full ${style.dot}`} />
      {label}
      <ChevronDown
        className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
      />
    </button>
  );
}

interface DetailsDropdownMultiProps {
  readiness: FlowReadinessResolved;
  health: V4HealthResponse | null;
  onRetriggerProposal?: () => Promise<void> | void;
  retriggerLoading?: boolean;
  inspectorHref?: string;
  onClickHandlers?: Record<string, () => Promise<void> | void>;
}

function DetailsDropdownMulti({
  readiness,
  health,
  onRetriggerProposal,
  retriggerLoading,
  inspectorHref,
  onClickHandlers,
}: DetailsDropdownMultiProps) {
  const style = STATUS_COLORS[readiness.status];
  const allCtas = getAllCtas(readiness);

  // Default inspector href (use health if available)
  const inspectorUrl = inspectorHref || (health
    ? `/api/os/companies/${health.companyId}/context/v4/inspect`
    : undefined);

  return (
    <div className="absolute right-0 top-full mt-2 w-80 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50">
      <div className="p-4">
        {/* Status Header */}
        <div className="flex items-center justify-between mb-3">
          <span className={`text-sm font-medium ${style.text}`}>
            {STATUS_LABELS[readiness.status]}
          </span>
          <span className="text-xs text-slate-500">v{readiness.version}</span>
        </div>

        {/* Signals Summary */}
        {readiness.signals.length > 1 && (
          <div className="mb-3">
            <p className="text-xs text-slate-500 mb-1.5">Signals</p>
            <div className="space-y-1">
              {readiness.signals.map((signal) => (
                <div key={signal.id} className="flex items-center gap-2 text-xs">
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    signal.severity === 'PASS' ? 'bg-green-400' :
                    signal.severity === 'WARN' ? 'bg-amber-400' : 'bg-red-400'
                  }`} />
                  <span className="text-slate-300">{signal.label}</span>
                  <span className="text-slate-500">
                    ({signal.reasons.length} issue{signal.reasons.length !== 1 ? 's' : ''})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reasons */}
        {readiness.rankedReasons.length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-slate-500 mb-1.5">Issues</p>
            <ul className="space-y-1">
              {readiness.rankedReasons.slice(0, 5).map((reason, idx) => (
                <li
                  key={`${reason.signalId}-${reason.code}-${idx}`}
                  className="text-xs text-slate-300 flex items-start gap-1.5"
                >
                  <span className={`mt-0.5 ${
                    reason.severity === 'FAIL' ? 'text-red-400' :
                    reason.severity === 'WARN' ? 'text-amber-400' : 'text-green-400'
                  }`}>•</span>
                  {reason.label}
                </li>
              ))}
              {readiness.rankedReasons.length > 5 && (
                <li className="text-xs text-slate-500">
                  +{readiness.rankedReasons.length - 5} more
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Legacy WebsiteLab Info (if health available) */}
        {health?.websiteLab.hasRun && (
          <div className="mb-3 text-xs">
            <p className="text-slate-500 mb-1">WebsiteLab Run</p>
            <div className="flex items-center gap-2 text-slate-400">
              <span>{health.websiteLab.runId?.slice(0, 8)}...</span>
              <span className="text-slate-600">•</span>
              <span>{formatAge(health.websiteLab.ageMinutes)}</span>
            </div>
          </div>
        )}

        {/* Legacy Store Counts (if health available) */}
        {health && health.store.total !== null && (
          <div className="mb-3">
            <p className="text-xs text-slate-500 mb-1.5">V4 Store</p>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-amber-400">{health.store.proposed} proposed</span>
              <span className="text-green-400">{health.store.confirmed} confirmed</span>
              <span className="text-slate-500">{health.store.rejected} rejected</span>
            </div>
          </div>
        )}

        {/* Legacy Feature Flags (if health available) */}
        {health && (
          <div className="mb-4">
            <p className="text-xs text-slate-500 mb-1.5">Feature Flags</p>
            <div className="flex items-center gap-2 text-xs">
              <span className={health.flags.CONTEXT_V4_ENABLED ? 'text-green-400' : 'text-red-400'}>
                V4: {health.flags.CONTEXT_V4_ENABLED ? 'ON' : 'OFF'}
              </span>
              <span className="text-slate-600">•</span>
              <span className={health.flags.CONTEXT_V4_INGEST_WEBSITELAB ? 'text-green-400' : 'text-red-400'}>
                Ingest: {health.flags.CONTEXT_V4_INGEST_WEBSITELAB ? 'ON' : 'OFF'}
              </span>
            </div>
          </div>
        )}

        {/* Actions */}
        {readiness.status !== 'GREEN' && (
          <div className="flex items-center gap-2 pt-3 border-t border-slate-800">
            {/* Re-trigger from props or CTA */}
            {onRetriggerProposal && (
              <button
                onClick={() => onRetriggerProposal()}
                disabled={retriggerLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded text-xs font-medium disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${retriggerLoading ? 'animate-spin' : ''}`} />
                {retriggerLoading ? 'Proposing...' : 'Re-trigger Proposal'}
              </button>
            )}
            {inspectorUrl && (
              <a
                href={inspectorUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1.5 text-slate-400 hover:text-white text-xs"
              >
                Inspector
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}

        {/* All Good */}
        {readiness.status === 'GREEN' && readiness.rankedReasons.length === 0 && (
          <div className="flex items-center gap-2 text-xs text-green-400">
            <CheckCircle className="w-3.5 h-3.5" />
            All systems operational
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Compact Variant
// ============================================================================

function CompactBanner(props: FlowReadinessBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const readiness = useResolvedReadiness(props);
  const health = getLegacyHealth(props);

  return (
    <div className="relative">
      <StatusPillMulti
        status={readiness.status}
        label={STATUS_LABELS[readiness.status]}
        expanded={expanded}
        onToggle={() => setExpanded(!expanded)}
      />
      {expanded && (
        <DetailsDropdownMulti
          readiness={readiness}
          health={health}
          onRetriggerProposal={props.onRetriggerProposal}
          retriggerLoading={props.retriggerLoading}
          inspectorHref={props.inspectorHref}
          onClickHandlers={props.onClickHandlers}
        />
      )}
    </div>
  );
}

// ============================================================================
// Full Variant
// ============================================================================

function FullBanner(props: FlowReadinessBannerProps) {
  const {
    showActions = true,
    onRetriggerProposal,
    retriggerLoading,
    inspectorHref,
    reviewQueueHref,
    showDetails = true,
    onContinue,
    showContinueButton = true,
    onClickHandlers,
  } = props;

  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const readiness = useResolvedReadiness(props);
  const health = getLegacyHealth(props);

  // GREEN status - render nothing or minimal indicator
  if (readiness.status === 'GREEN') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-green-400/70 mb-4">
        <CheckCircle className="w-3.5 h-3.5" />
        <span>Baseline ready</span>
      </div>
    );
  }

  const isRed = readiness.status === 'RED';
  const style = STATUS_COLORS[readiness.status];
  const Icon = getStatusIcon(readiness.status);

  // Limit reasons to 3 for UX
  const displayReasons = readiness.rankedReasons.slice(0, 3);
  const hasMoreReasons = readiness.rankedReasons.length > 3;

  // Default links (use health if available for backward compat)
  const companyId = health?.companyId || (readiness.signals[0]?.meta?.companyId as string) || '';
  const reviewPath = reviewQueueHref || `/context-v4/${companyId}/review`;
  const inspectorPath = inspectorHref || (health?.links.inspectorPath || '');

  return (
    <div
      className={`rounded-lg border p-4 mb-6 max-w-lg w-full text-left ${
        isRed ? 'bg-red-900/20 border-red-700/50' : 'bg-amber-900/20 border-amber-700/50'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="shrink-0 mt-0.5">
          <Icon className={`w-5 h-5 ${style.text}`} />
        </div>

        {/* Content */}
        <div className="flex-1">
          {/* Title */}
          <h3
            className={`font-medium mb-1 ${isRed ? 'text-red-200' : 'text-amber-200'}`}
          >
            {isRed ? 'Baseline is broken or missing' : 'Your baseline may be incomplete'}
          </h3>

          {/* Description */}
          <p
            className={`text-sm mb-3 ${isRed ? 'text-red-300/70' : 'text-amber-300/70'}`}
          >
            {isRed
              ? 'Program generation may fail or produce incorrect output until these issues are resolved.'
              : 'We found issues that may reduce the quality of AI-generated programs.'}
          </p>

          {/* Multi-signal indicator */}
          {readiness.signals.length > 1 && (
            <div className="flex items-center gap-2 mb-3">
              {readiness.signals.map((signal) => (
                <span
                  key={signal.id}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                    signal.severity === 'PASS' ? 'bg-green-500/20 text-green-400' :
                    signal.severity === 'WARN' ? 'bg-amber-500/20 text-amber-400' :
                    'bg-red-500/20 text-red-400'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    signal.severity === 'PASS' ? 'bg-green-400' :
                    signal.severity === 'WARN' ? 'bg-amber-400' : 'bg-red-400'
                  }`} />
                  {signal.label}
                </span>
              ))}
            </div>
          )}

          {/* Reasons List */}
          <div className="space-y-1.5 mb-4">
            {displayReasons.map((reason, idx) => (
              <div
                key={`${reason.signalId}-${reason.code}-${idx}`}
                className={`text-sm flex items-start gap-2 ${
                  isRed ? 'text-red-300/90' : 'text-amber-300/90'
                }`}
              >
                <span className="mt-0.5">•</span>
                <span>{reason.label}</span>
              </div>
            ))}
            {hasMoreReasons && (
              <div
                className={`text-xs ${isRed ? 'text-red-400/70' : 'text-amber-400/70'}`}
              >
                +{readiness.rankedReasons.length - 3} more issues
              </div>
            )}
          </div>

          {/* Expandable Details */}
          {showDetails && health && (
            <div className="mb-4">
              <button
                onClick={() => setDetailsExpanded(!detailsExpanded)}
                className={`text-xs flex items-center gap-1 ${
                  isRed ? 'text-red-400/70 hover:text-red-300' : 'text-amber-400/70 hover:text-amber-300'
                }`}
              >
                <ChevronDown
                  className={`w-3 h-3 transition-transform ${detailsExpanded ? 'rotate-180' : ''}`}
                />
                {detailsExpanded ? 'Hide details' : 'Show details'}
              </button>

              {detailsExpanded && (
                <div className={`mt-2 p-2 rounded text-xs space-y-2 ${
                  isRed ? 'bg-red-950/50' : 'bg-amber-950/50'
                }`}>
                  {/* Store Counts */}
                  {health.store.total !== null && (
                    <div>
                      <span className="text-slate-500">Store: </span>
                      <span className="text-amber-400">{health.store.proposed} proposed</span>
                      <span className="text-slate-600"> · </span>
                      <span className="text-green-400">{health.store.confirmed} confirmed</span>
                      <span className="text-slate-600"> · </span>
                      <span className="text-slate-400">{health.store.rejected} rejected</span>
                    </div>
                  )}

                  {/* WebsiteLab Age */}
                  {health.websiteLab.hasRun && (
                    <div>
                      <span className="text-slate-500">WebsiteLab: </span>
                      <span className="text-slate-300">{formatAge(health.websiteLab.ageMinutes)}</span>
                      {health.websiteLab.ageMinutes !== null &&
                        health.websiteLab.ageMinutes > health.websiteLab.staleThresholdMinutes && (
                          <span className="text-amber-400 ml-1">(stale)</span>
                        )}
                    </div>
                  )}

                  {/* Flags */}
                  <div>
                    <span className="text-slate-500">Flags: </span>
                    <span className={health.flags.CONTEXT_V4_ENABLED ? 'text-green-400' : 'text-red-400'}>
                      V4 {health.flags.CONTEXT_V4_ENABLED ? 'ON' : 'OFF'}
                    </span>
                    <span className="text-slate-600"> · </span>
                    <span className={health.flags.CONTEXT_V4_INGEST_WEBSITELAB ? 'text-green-400' : 'text-red-400'}>
                      Ingest {health.flags.CONTEXT_V4_INGEST_WEBSITELAB ? 'ON' : 'OFF'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CTAs */}
          {showActions && (
            <div className="flex flex-wrap items-center gap-2">
              {/* Primary CTA - Review / Fix Baseline */}
              {companyId && (
                <Link
                  href={reviewPath}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                    isRed
                      ? 'bg-red-600 hover:bg-red-500 text-white'
                      : 'bg-amber-600 hover:bg-amber-500 text-white'
                  }`}
                >
                  {isRed ? 'Fix Baseline' : 'Review Context Baseline'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}

              {/* Re-trigger Proposal */}
              {onRetriggerProposal && (
                <button
                  onClick={() => onRetriggerProposal()}
                  disabled={retriggerLoading}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded transition-colors disabled:opacity-50 ${
                    isRed
                      ? 'text-red-400/80 hover:text-red-300 hover:bg-red-900/30'
                      : 'text-amber-400/80 hover:text-amber-300 hover:bg-amber-900/30'
                  }`}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${retriggerLoading ? 'animate-spin' : ''}`} />
                  {retriggerLoading ? 'Proposing...' : 'Re-trigger Proposal'}
                </button>
              )}

              {/* Inspector Link */}
              {inspectorPath && (
                <a
                  href={inspectorPath.startsWith('/api') ? inspectorPath : `/api/os/companies/${companyId}/context/v4/inspect`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1 px-2 py-1.5 text-sm ${
                    isRed ? 'text-red-400/60 hover:text-red-300' : 'text-amber-400/60 hover:text-amber-300'
                  }`}
                >
                  Inspector
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}

              {/* Continue Anyway */}
              {showContinueButton && onContinue && (
                <button
                  onClick={onContinue}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                    isRed
                      ? 'text-red-400/80 hover:text-red-300 hover:bg-red-900/30'
                      : 'text-amber-400/80 hover:text-amber-300 hover:bg-amber-900/30'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {isRed ? 'Generate Anyway' : 'Continue Anyway'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function FlowReadinessBanner(props: FlowReadinessBannerProps) {
  const { variant = 'full' } = props;

  if (variant === 'compact') {
    return <CompactBanner {...props} />;
  }

  return <FullBanner {...props} />;
}

// ============================================================================
// Inline Components (for backward compatibility)
// ============================================================================

/**
 * Small inline warning text to show under Generate buttons
 * when health status is not GREEN.
 */
export function FlowReadinessInlineWarning({ health }: { health: V4HealthResponse }) {
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

/**
 * Subtle "Baseline ready" indicator shown when status is GREEN.
 */
export function FlowReadinessReadyIndicator({ health }: { health: V4HealthResponse }) {
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

// ============================================================================
// Multi-signal Components
// ============================================================================

/**
 * Inline warning for multi-signal readiness.
 */
export function FlowReadinessInlineWarningMulti({ readiness }: { readiness: FlowReadinessResolved }) {
  if (readiness.status === 'GREEN') {
    return null;
  }

  const isRed = readiness.status === 'RED';

  return (
    <p className={`text-xs mt-2 flex items-center gap-1 ${isRed ? 'text-red-400' : 'text-amber-400'}`}>
      {isRed ? (
        <AlertCircle className="w-3 h-3" />
      ) : (
        <AlertTriangle className="w-3 h-3" />
      )}
      {readiness.signals.length > 1
        ? `${readiness.signals.length} signals need attention — output quality may be affected.`
        : 'Baseline issues detected — output quality may be affected.'}
    </p>
  );
}

/**
 * Ready indicator for multi-signal readiness.
 */
export function FlowReadinessReadyIndicatorMulti({ readiness }: { readiness: FlowReadinessResolved }) {
  if (readiness.status !== 'GREEN') {
    return null;
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-green-400/70 mb-4">
      <CheckCircle className="w-3.5 h-3.5" />
      <span>All {readiness.signals.length > 1 ? 'signals' : 'baselines'} ready</span>
    </div>
  );
}

// ============================================================================
// Competition Warning Banner
// ============================================================================

interface CompetitionWarningBannerProps {
  /** Competition awareness from resolved readiness */
  competitionAwareness: FlowReadinessResolved['competitionAwareness'];
  /** Company ID for links */
  companyId: string;
  /** Optional callback for "Run Competition" button */
  onRunCompetition?: () => Promise<void> | void;
  /** Whether run is in progress */
  runningCompetition?: boolean;
}

/**
 * Yellow banner shown when competition is low/missing.
 * Non-blocking - just informational.
 */
export function CompetitionWarningBanner({
  competitionAwareness,
  companyId,
  onRunCompetition,
  runningCompetition,
}: CompetitionWarningBannerProps) {
  // Only show if competition is not high confidence
  if (!competitionAwareness || competitionAwareness.competitionInformed) {
    return null;
  }

  const competitionPath = `/c/${companyId}/context#competitive`;
  const isMissing = competitionAwareness.competitionConfidence === 'missing';

  return (
    <div className="rounded-lg border p-3 mb-4 bg-amber-900/20 border-amber-700/50 max-w-lg">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-sm text-amber-200 mb-2">
            {isMissing
              ? 'Strategy generated without competitive context.'
              : 'Strategy generated with limited competitive context.'}
          </p>
          <p className="text-xs text-amber-300/70 mb-3">
            Results should be validated once competitors are reviewed.
          </p>
          <div className="flex items-center gap-2">
            <Link
              href={competitionPath}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded bg-amber-600 hover:bg-amber-500 text-white transition-colors"
            >
              Improve Competitive Context
              <ArrowRight className="w-3 h-3" />
            </Link>
            {onRunCompetition && (
              <button
                onClick={() => onRunCompetition()}
                disabled={runningCompetition}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded text-amber-400/80 hover:text-amber-300 hover:bg-amber-900/30 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${runningCompetition ? 'animate-spin' : ''}`} />
                {runningCompetition ? 'Running...' : 'Run Competition Analysis'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Inline text warning about competition confidence.
 * For use under buttons or in status areas.
 */
export function CompetitionInlineWarning({
  competitionAwareness,
}: {
  competitionAwareness: FlowReadinessResolved['competitionAwareness'];
}) {
  if (!competitionAwareness || competitionAwareness.competitionInformed) {
    return null;
  }

  return (
    <p className="text-xs mt-2 flex items-center gap-1 text-amber-400">
      <AlertTriangle className="w-3 h-3" />
      {competitionAwareness.competitionSummary || 'Limited competitive context'}
    </p>
  );
}

export default FlowReadinessBanner;
