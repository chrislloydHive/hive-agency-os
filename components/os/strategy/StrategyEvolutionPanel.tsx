'use client';

// components/os/strategy/StrategyEvolutionPanel.tsx
// Strategy Evolution History Panel - Timeline of strategy changes
//
// Design principle: Append-only history. Rollback creates new events.
// Shows version timeline, diff summaries, and allows rollback.

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  History,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  AlertTriangle,
  Loader2,
  CheckCircle,
  ArrowRight,
  Clock,
  GitCommit,
  Eye,
  X,
  HelpCircle,
} from 'lucide-react';
import type { StrategyEvolutionEvent, DiffRiskFlag } from '@/lib/types/strategyEvolution';
import {
  getRiskFlagLabel,
  getImpactScoreColorClass,
  getImpactScoreLabel,
  getTriggerColorClass,
} from '@/lib/types/strategyEvolution';
import { getConfidenceColorClass } from '@/lib/types/strategyRevision';
import type { EventAttribution, TopDriver, AttributionDirection } from '@/lib/types/strategyAttribution';
import {
  getDirectionColorClass,
  getScoreColorClass,
  getConfidenceColorClass as getAttributionConfidenceColorClass,
  getDirectionLabel,
  formatAttributionScore,
  formatConfidence,
  DEFAULT_ATTRIBUTION_WINDOW,
} from '@/lib/types/strategyAttribution';
import { TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react';

// ============================================================================
// Module-Level Attribution Cache
// ============================================================================

/**
 * Cache for attribution data to avoid refetching repeatedly.
 * Key format: companyId|strategyId|preDays|postDays
 */
interface AttributionCacheEntry {
  map: Map<string, EventAttribution>;
  fetchedAt: number;
}

const attributionCache = new Map<string, AttributionCacheEntry>();

/** Cache TTL: 5 minutes */
const ATTRIBUTION_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Build cache key from parameters
 */
function buildAttributionCacheKey(
  companyId: string,
  strategyId: string,
  preDays: number,
  postDays: number
): string {
  return `${companyId}|${strategyId}|${preDays}|${postDays}`;
}

/**
 * Get cached attribution data if valid
 */
function getCachedAttribution(key: string): Map<string, EventAttribution> | null {
  const entry = attributionCache.get(key);
  if (!entry) return null;

  // Check TTL
  if (Date.now() - entry.fetchedAt > ATTRIBUTION_CACHE_TTL_MS) {
    attributionCache.delete(key);
    return null;
  }

  return entry.map;
}

/**
 * Set attribution cache
 */
function setCachedAttribution(key: string, map: Map<string, EventAttribution>): void {
  attributionCache.set(key, {
    map,
    fetchedAt: Date.now(),
  });
}

// ============================================================================
// Types
// ============================================================================

interface StrategyEvolutionPanelProps {
  companyId: string;
  strategyId: string;
  /** Whether panel starts collapsed */
  defaultCollapsed?: boolean;
  /** Callback when restore is performed */
  onRollback?: () => void;
  /** Callback when user wants to view evidence signals */
  onViewSignals?: (signalIds: string[]) => void;
  /** Callback when user wants to view related work items */
  onViewWork?: (workItemIds: string[]) => void;
}

interface EvolutionEventWithMeta extends StrategyEvolutionEvent {
  isRecent?: boolean;
}

// ============================================================================
// Main Component
// ============================================================================

export function StrategyEvolutionPanel({
  companyId,
  strategyId,
  defaultCollapsed = true,
  onRollback,
  onViewSignals,
  onViewWork,
}: StrategyEvolutionPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [events, setEvents] = useState<EvolutionEventWithMeta[]>([]);
  const [currentVersion, setCurrentVersion] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rollingBackId, setRollingBackId] = useState<string | null>(null);
  const [confirmingRollbackId, setConfirmingRollbackId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Attribution data keyed by eventId
  const [attributionMap, setAttributionMap] = useState<Map<string, EventAttribution>>(new Map());
  const [attributionLoading, setAttributionLoading] = useState(false);
  const [attributionFetched, setAttributionFetched] = useState(false);

  // Ref to track if component is mounted (for preventing setState after unmount)
  const isMountedRef = useRef(true);

  // Fetch evolution events
  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/os/companies/${companyId}/strategy/${strategyId}/evolution`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch evolution events');
      }

      const data = await response.json();

      // Mark recent events (within last hour)
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      const eventsWithMeta = (data.events || []).map((event: StrategyEvolutionEvent) => ({
        ...event,
        isRecent: new Date(event.createdAt).getTime() > oneHourAgo,
      }));

      setEvents(eventsWithMeta);
      setCurrentVersion(data.currentVersion || 0);
      setError(null);
    } catch (err) {
      console.error('[StrategyEvolutionPanel] Error fetching events:', err);
      setError('Failed to load evolution history');
    } finally {
      setLoading(false);
    }
  }, [companyId, strategyId]);

  // Fetch attribution data for events (with cache and AbortController)
  const fetchAttribution = useCallback(async (signal?: AbortSignal) => {
    const preDays = DEFAULT_ATTRIBUTION_WINDOW.preDays;
    const postDays = DEFAULT_ATTRIBUTION_WINDOW.postDays;
    const cacheKey = buildAttributionCacheKey(companyId, strategyId, preDays, postDays);

    // Check cache first
    const cached = getCachedAttribution(cacheKey);
    if (cached) {
      if (isMountedRef.current) {
        setAttributionMap(cached);
        setAttributionFetched(true);
      }
      return;
    }

    try {
      if (isMountedRef.current) {
        setAttributionLoading(true);
      }

      const response = await fetch(
        `/api/os/companies/${companyId}/strategy/${strategyId}/attribution?preDays=${preDays}&postDays=${postDays}`,
        { signal }
      );

      // Check if aborted or unmounted
      if (signal?.aborted || !isMountedRef.current) return;

      if (!response.ok) {
        // Silently fail - attribution is supplementary, don't block timeline
        console.warn('[StrategyEvolutionPanel] Attribution fetch failed:', response.status);
        if (isMountedRef.current) {
          setAttributionFetched(true);
        }
        return;
      }

      const data = await response.json();

      // Check again after async operation
      if (!isMountedRef.current) return;

      // Build map keyed by eventId
      const map = new Map<string, EventAttribution>();
      if (data.eventAttributions && Array.isArray(data.eventAttributions)) {
        for (const attr of data.eventAttributions) {
          map.set(attr.eventId, attr);
        }
      }

      // Update cache
      setCachedAttribution(cacheKey, map);

      setAttributionMap(map);
      setAttributionFetched(true);
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') return;

      // Silently fail - attribution is supplementary
      console.warn('[StrategyEvolutionPanel] Error fetching attribution:', err);
      if (isMountedRef.current) {
        setAttributionFetched(true);
      }
    } finally {
      if (isMountedRef.current) {
        setAttributionLoading(false);
      }
    }
  }, [companyId, strategyId]);

  // Rollback to event
  const handleRollback = useCallback(async (eventId: string) => {
    try {
      setRollingBackId(eventId);
      setError(null);

      const response = await fetch(
        `/api/os/companies/${companyId}/strategy/${strategyId}/evolution`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventId }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to rollback');
      }

      // Refresh events
      await fetchEvents();
      setConfirmingRollbackId(null);
      onRollback?.();
    } catch (err) {
      console.error('[StrategyEvolutionPanel] Error rolling back:', err);
      setError(err instanceof Error ? err.message : 'Failed to rollback');
    } finally {
      setRollingBackId(null);
    }
  }, [companyId, strategyId, fetchEvents, onRollback]);

  // Load events and attribution on mount
  useEffect(() => {
    isMountedRef.current = true;
    const abortController = new AbortController();

    fetchEvents();
    fetchAttribution(abortController.signal);

    return () => {
      isMountedRef.current = false;
      abortController.abort();
    };
  }, [fetchEvents, fetchAttribution]);

  const eventCount = events.length;

  return (
    <div className="bg-slate-900/30 border border-slate-800 rounded-xl overflow-hidden">
      {/* Header - always visible */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-blue-500/10 rounded-lg">
            <History className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-medium text-white">Evolution History</h3>
            <p className="text-xs text-slate-500">
              {currentVersion > 0
                ? `Version ${currentVersion} • ${eventCount} change${eventCount !== 1 ? 's' : ''}`
                : 'No evolution history yet'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Version badge */}
          {currentVersion > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded">
              v{currentVersion}
            </span>
          )}

          {isCollapsed ? (
            <ChevronRight className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          )}
        </div>
      </button>

      {/* Content - collapsible */}
      {!isCollapsed && (
        <div className="px-4 pb-4 border-t border-slate-800">
          {/* Error message */}
          {error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-red-400">
                <AlertTriangle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
            </div>
          )}

          {/* Empty state */}
          {!loading && events.length === 0 && (
            <div className="py-6 text-center">
              <GitCommit className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-500">
                No evolution history yet. Strategy changes will be tracked here.
              </p>
            </div>
          )}

          {/* Events timeline */}
          {!loading && events.length > 0 && (
            <div className="mt-4 space-y-2">
              {events.map((event, index) => (
                <EventCard
                  key={event.id}
                  event={event}
                  isLatest={index === 0}
                  onRollback={() => setConfirmingRollbackId(event.id)}
                  onConfirmRollback={() => handleRollback(event.id)}
                  onCancelRollback={() => setConfirmingRollbackId(null)}
                  onViewDetails={() => setSelectedEventId(event.id)}
                  isRollingBack={rollingBackId === event.id}
                  isConfirmingRollback={confirmingRollbackId === event.id}
                  attribution={attributionMap.get(event.id)}
                  attributionLoading={attributionLoading}
                  attributionFetched={attributionFetched}
                />
              ))}
            </div>
          )}

          {/* Note about history */}
          <div className="mt-4 pt-3 border-t border-slate-800/50">
            <p className="text-[10px] text-slate-600 text-center">
              History is append-only. Restore creates a new version.
            </p>
          </div>
        </div>
      )}

      {/* Event Details Modal */}
      {selectedEventId && (
        <EventDetailsModal
          companyId={companyId}
          strategyId={strategyId}
          eventId={selectedEventId}
          onClose={() => setSelectedEventId(null)}
          onViewSignals={onViewSignals}
          onViewWork={onViewWork}
          attribution={attributionMap.get(selectedEventId)}
        />
      )}
    </div>
  );
}

// ============================================================================
// Event Card
// ============================================================================

function EventCard({
  event,
  isLatest,
  onRollback,
  onConfirmRollback,
  onCancelRollback,
  onViewDetails,
  isRollingBack,
  isConfirmingRollback,
  attribution,
  attributionLoading,
  attributionFetched,
}: {
  event: EvolutionEventWithMeta;
  isLatest: boolean;
  onRollback: () => void;
  onConfirmRollback: () => void;
  onCancelRollback: () => void;
  onViewDetails: () => void;
  isRollingBack: boolean;
  isConfirmingRollback: boolean;
  attribution?: EventAttribution;
  attributionLoading?: boolean;
  attributionFetched?: boolean;
}) {
  const isRestore = Boolean(event.rollbackOfEventId);
  const triggerLabel = isRestore
    ? 'Restore'
    : event.proposalId
    ? 'Proposal'
    : 'Manual';

  return (
    <div className={`p-3 bg-slate-800/30 border rounded-lg ${
      event.isRecent ? 'border-blue-500/30' : 'border-slate-700/50'
    }`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {/* Version badge */}
            <span className="text-xs font-mono text-slate-400">
              v{event.versionFrom} → v{event.versionTo}
            </span>

            {/* Trigger badge */}
            <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded border ${getTriggerColorClass(isRestore ? 'rollback' : event.proposalId ? 'proposal' : 'manual')}`}>
              {triggerLabel}
            </span>

            {/* Impact badge */}
            <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded border ${getImpactScoreColorClass(event.diffSummary.impactScore)}`}>
              {getImpactScoreLabel(event.diffSummary.impactScore)}
            </span>

            {/* Recent badge */}
            {event.isRecent && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded">
                Recent
              </span>
            )}

            {/* Attribution badges */}
            {attributionLoading && (
              <span className="px-1.5 py-0.5 text-[10px] text-slate-500">
                <Loader2 className="w-3 h-3 animate-spin inline" />
              </span>
            )}
            {!attributionLoading && attribution && (
              <AttributionBadge attribution={attribution} />
            )}
            {!attributionLoading && !attribution && attributionFetched && (
              <AttributionFallbackBadge />
            )}
          </div>

          {/* Title */}
          <h4 className="text-sm font-medium text-white">{event.title}</h4>

          {/* Diff summary */}
          <p className="text-xs text-slate-400 mt-0.5">
            {event.diffSummary.summary}
          </p>
        </div>

        {/* Timestamp */}
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <Clock className="w-3 h-3" />
          <span>{formatRelativeTime(event.createdAt)}</span>
        </div>
      </div>

      {/* Risk flags */}
      {event.diffSummary.riskFlags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {event.diffSummary.riskFlags.map((flag) => (
            <span
              key={flag}
              className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded"
            >
              {getRiskFlagLabel(flag)}
            </span>
          ))}
        </div>
      )}

      {/* Confirmation dialog */}
      {isConfirmingRollback && (
        <div className="mt-3 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <p className="text-xs text-amber-400 mb-2">
            Restore strategy to version {event.versionFrom}? This creates a new version.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onConfirmRollback}
              disabled={isRollingBack}
              className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded transition-colors disabled:opacity-50"
            >
              {isRollingBack ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Confirm Restore'}
            </button>
            <button
              onClick={onCancelRollback}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      {!isConfirmingRollback && (
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={onViewDetails}
            className="flex items-center justify-center gap-1 px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors"
          >
            <Eye className="w-3 h-3" />
            Details
          </button>
          {!isLatest && !event.rolledBack && (
            <button
              onClick={onRollback}
              disabled={isRollingBack}
              className="flex items-center justify-center gap-1 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-medium rounded-lg border border-amber-500/30 transition-colors disabled:opacity-50"
            >
              <RotateCcw className="w-3 h-3" />
              Restore
            </button>
          )}
          {event.rolledBack && (
            <span className="text-xs text-slate-500 italic">Already rolled back</span>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Attribution Badge
// ============================================================================

function AttributionBadge({ attribution }: { attribution: EventAttribution }) {
  const DirectionIcon = attribution.direction === 'positive'
    ? TrendingUp
    : attribution.direction === 'negative'
    ? TrendingDown
    : Minus;

  const windowLabel = `${attribution.window.preDays}d pre / ${attribution.window.postDays}d post`;

  return (
    <div className="flex items-center gap-1" title={`Attribution window: ${windowLabel}`}>
      {/* Direction + Score badge */}
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded border ${getDirectionColorClass(attribution.direction)}`}>
        <DirectionIcon className="w-3 h-3" />
        <span>{formatAttributionScore(attribution.attributionScore)}</span>
      </span>

      {/* Confidence badge */}
      <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded border ${getAttributionConfidenceColorClass(attribution.confidence)}`}>
        {formatConfidence(attribution.confidence)}
      </span>
    </div>
  );
}

// ============================================================================
// Attribution Fallback Badge
// ============================================================================

function AttributionFallbackBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 bg-slate-800/50 border border-slate-700/50 rounded cursor-help"
      title="Not enough outcome data yet"
    >
      <HelpCircle className="w-3 h-3" />
      <span>Attribution —</span>
    </span>
  );
}

// ============================================================================
// Attribution Section (for modal)
// ============================================================================

function AttributionSection({ attribution }: { attribution: EventAttribution }) {
  const DirectionIcon = attribution.direction === 'positive'
    ? TrendingUp
    : attribution.direction === 'negative'
    ? TrendingDown
    : Minus;

  // Calculate delta from weighted totals
  const delta = attribution.postWeightedTotal - attribution.preWeightedTotal;
  const deltaStr = delta >= 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1);

  const windowLabel = `${attribution.window.preDays}d pre / ${attribution.window.postDays}d post`;

  return (
    <div className="p-3 bg-slate-800/50 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-slate-400" />
          <p className="text-xs text-slate-500 uppercase tracking-wide">Attribution</p>
        </div>
        <span className="text-[10px] text-slate-600" title="Attribution analysis window">
          {windowLabel}
        </span>
      </div>

      {/* Score summary */}
      <div className="flex items-center gap-4 text-sm mb-3">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Pre:</span>
          <span className="text-slate-300">{attribution.preWeightedTotal.toFixed(1)}</span>
        </div>
        <ArrowRight className="w-3 h-3 text-slate-600" />
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Post:</span>
          <span className="text-slate-300">{attribution.postWeightedTotal.toFixed(1)}</span>
        </div>
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded ${getDirectionColorClass(attribution.direction)}`}>
          <DirectionIcon className="w-3 h-3" />
          <span className="text-xs font-medium">{deltaStr}</span>
        </div>
      </div>

      {/* Overall score and confidence */}
      <div className="flex items-center gap-4 text-xs mb-3">
        <span className="text-slate-400">
          Attribution Score: <span className="text-white font-medium">{formatAttributionScore(attribution.attributionScore)}</span>
        </span>
        <span className="text-slate-400">
          Direction: <span className={`font-medium ${getDirectionColorClass(attribution.direction).split(' ')[0]}`}>{getDirectionLabel(attribution.direction)}</span>
        </span>
        <span className="text-slate-400">
          Confidence: <span className="text-white font-medium">{formatConfidence(attribution.confidence)}</span>
        </span>
      </div>

      {/* Top drivers */}
      {attribution.topDrivers.length > 0 && (
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-2">Top Drivers</p>
          <div className="flex flex-wrap gap-1.5">
            {attribution.topDrivers.slice(0, 5).map((driver, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-slate-700/50 text-slate-300 rounded border border-slate-600/50"
                title={`${driver.type}: contribution ${driver.contribution.toFixed(0)}%`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                {driver.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Deltas summary */}
      {attribution.deltas.length > 0 && (
        <details className="mt-3 text-xs">
          <summary className="text-slate-500 cursor-pointer hover:text-slate-400">
            {attribution.deltas.length} signal delta{attribution.deltas.length !== 1 ? 's' : ''}
          </summary>
          <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
            {attribution.deltas.map((d, idx) => (
              <div key={idx} className="flex items-center justify-between text-slate-400 py-0.5">
                <span className="truncate max-w-[200px]">{d.key}</span>
                <span className={d.delta >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {d.delta >= 0 ? '+' : ''}{d.delta}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

// ============================================================================
// Event Details Modal
// ============================================================================

function EventDetailsModal({
  companyId,
  strategyId,
  eventId,
  onClose,
  onViewSignals,
  onViewWork,
  attribution,
}: {
  companyId: string;
  strategyId: string;
  eventId: string;
  onClose: () => void;
  onViewSignals?: (signalIds: string[]) => void;
  onViewWork?: (workItemIds: string[]) => void;
  attribution?: EventAttribution;
}) {
  const [event, setEvent] = useState<StrategyEvolutionEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/os/companies/${companyId}/strategy/${strategyId}/evolution/${eventId}`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch event details');
        }

        const data = await response.json();
        setEvent(data.event);
        setError(null);
      } catch (err) {
        console.error('[EventDetailsModal] Error:', err);
        setError('Failed to load event details');
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [companyId, strategyId, eventId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-xl shadow-xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
          <h3 className="text-sm font-medium text-white">Event Details</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-800 rounded transition-colors"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {event && (
            <div className="space-y-4">
              {/* Title & meta */}
              <div>
                <h4 className="text-lg font-medium text-white">{event.title}</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Version {event.versionFrom} → {event.versionTo} • {formatTimestamp(event.createdAt)}
                </p>
              </div>

              {/* Diff summary */}
              <div className="p-3 bg-slate-800/50 rounded-lg">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Diff Summary</p>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-emerald-400">+{event.diffSummary.added} added</span>
                  <span className="text-red-400">-{event.diffSummary.removed} removed</span>
                  <span className="text-blue-400">~{event.diffSummary.modified} modified</span>
                </div>
                <p className="text-sm text-slate-300 mt-2">{event.diffSummary.summary}</p>
              </div>

              {/* Changes */}
              {event.diffSummary.changes.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Changes</p>
                  <div className="space-y-2">
                    {event.diffSummary.changes.map((change, idx) => (
                      <div key={idx} className="p-2 bg-slate-800/50 rounded text-xs">
                        <span className={`font-medium ${
                          change.type === 'add' ? 'text-emerald-400' :
                          change.type === 'remove' ? 'text-red-400' :
                          'text-blue-400'
                        }`}>
                          {change.type.toUpperCase()}
                        </span>
                        <span className="text-slate-400 ml-2">{change.target}</span>
                        <p className="text-slate-300 mt-1">{change.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Risk flags */}
              {event.diffSummary.riskFlags.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Risk Flags</p>
                  <div className="flex flex-wrap gap-2">
                    {event.diffSummary.riskFlags.map((flag) => (
                      <span
                        key={flag}
                        className="px-2 py-1 text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded"
                      >
                        {getRiskFlagLabel(flag)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Attribution */}
              {attribution && (
                <AttributionSection attribution={attribution} />
              )}

              {/* Evidence */}
              {(event.evidenceSnippets.length > 0 || event.evidenceSignalIds.length > 0) && (
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Evidence</p>

                  {/* Signal IDs with view link */}
                  {event.evidenceSignalIds.length > 0 && onViewSignals && (
                    <button
                      onClick={() => onViewSignals(event.evidenceSignalIds)}
                      className="mb-2 flex items-center gap-1.5 px-2 py-1 text-xs text-blue-400 bg-blue-500/10 border border-blue-500/30 rounded hover:bg-blue-500/20 transition-colors"
                    >
                      <Eye className="w-3 h-3" />
                      View {event.evidenceSignalIds.length} signal{event.evidenceSignalIds.length !== 1 ? 's' : ''}
                    </button>
                  )}

                  <div className="space-y-1">
                    {event.evidenceSnippets.map((snippet, idx) => (
                      <p key={idx} className="text-xs text-slate-400 flex items-start gap-2">
                        <span className="w-1 h-1 rounded-full bg-slate-600 mt-1.5 flex-shrink-0" />
                        <span>{snippet}</span>
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Hashes (collapsed by default for debugging) */}
              <details className="text-xs">
                <summary className="text-slate-500 cursor-pointer hover:text-slate-400">
                  Technical Details
                </summary>
                <div className="mt-2 p-2 bg-slate-800/50 rounded font-mono">
                  <p className="text-slate-400">Event ID: {event.id}</p>
                  <p className="text-slate-400">Hash Before: {event.snapshotHashBefore}</p>
                  <p className="text-slate-400">Hash After: {event.snapshotHashAfter}</p>
                  <p className="text-slate-400">Confidence: {event.confidenceAtApply}</p>
                </div>
              </details>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = Date.now();
  const diff = now - date.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default StrategyEvolutionPanel;
