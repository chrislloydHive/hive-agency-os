'use client';

// components/os/strategy/StrategyAttributionPanel.tsx
// Strategy Attribution Panel - Show impact & attribution for strategy changes
//
// Design principle: Deterministic, explainable attribution display.
// No AI interpretation, just clear data visualization.

import { useState, useCallback, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronRight,
  BarChart3,
  Loader2,
  AlertTriangle,
  Clock,
  Info,
  Eye,
  X,
  Settings,
} from 'lucide-react';
import type {
  EventAttribution,
  AttributionRollups,
  AttributionWindow,
  TopDriver,
  AttributionDirection,
} from '@/lib/types/strategyAttribution';
import {
  getDirectionColorClass,
  getScoreColorClass,
  getConfidenceColorClass,
  getDirectionLabel,
  formatAttributionScore,
  formatConfidence,
  DEFAULT_ATTRIBUTION_WINDOW,
} from '@/lib/types/strategyAttribution';

// ============================================================================
// Types
// ============================================================================

interface StrategyAttributionPanelProps {
  companyId: string;
  strategyId: string;
  /** Whether panel starts collapsed */
  defaultCollapsed?: boolean;
  /** Callback to view evolution event details */
  onViewEvent?: (eventId: string) => void;
}

interface AttributionData {
  window: AttributionWindow;
  attributions: EventAttribution[];
  rollups: AttributionRollups;
  summary: {
    hasData: boolean;
    totalEvents: number;
    eventsWithSignals: number;
    overallTrend: 'positive' | 'neutral' | 'negative';
    averageScore: number;
    topPositiveChange: EventAttribution | null;
    topNegativeChange: EventAttribution | null;
  };
  meta: {
    strategyId: string;
    companyId: string;
    totalEvents: number;
    totalSignals: number;
    processedAt: string;
  };
}

// ============================================================================
// Main Component
// ============================================================================

export function StrategyAttributionPanel({
  companyId,
  strategyId,
  defaultCollapsed = true,
  onViewEvent,
}: StrategyAttributionPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [data, setData] = useState<AttributionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [window, setWindow] = useState<AttributionWindow>(DEFAULT_ATTRIBUTION_WINDOW);

  // Fetch attribution data
  const fetchAttribution = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        preDays: String(window.preDays),
        postDays: String(window.postDays),
      });

      const response = await fetch(
        `/api/os/companies/${companyId}/strategy/${strategyId}/attribution?${params}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch attribution data');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('[StrategyAttributionPanel] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load attribution data');
    } finally {
      setLoading(false);
    }
  }, [companyId, strategyId, window]);

  // Fetch on mount and when window changes
  useEffect(() => {
    fetchAttribution();
  }, [fetchAttribution]);

  const selectedEvent = data?.attributions.find((a) => a.eventId === selectedEventId);

  return (
    <div className="bg-slate-900/30 border border-slate-800 rounded-xl overflow-hidden">
      {/* Header - always visible */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-purple-500/10 rounded-lg">
            <BarChart3 className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-medium text-white">Impact & Attribution</h3>
            <p className="text-xs text-slate-500">
              {data?.meta.totalEvents
                ? `${data.meta.totalEvents} changes analyzed`
                : 'Track strategy change impact'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Quick summary badges */}
          {data?.summary && data.summary.hasData && (
            <>
              <TrendBadge trend={data.summary.overallTrend} />
              {data.rollups.countByDirection.positive > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded">
                  <TrendingUp className="w-3 h-3" />
                  {data.rollups.countByDirection.positive}
                </span>
              )}
              {data.rollups.countByDirection.negative > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/30 rounded">
                  <TrendingDown className="w-3 h-3" />
                  {data.rollups.countByDirection.negative}
                </span>
              )}
            </>
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
          {!loading && data && !data.summary.hasData && (
            <div className="py-6 text-center">
              <BarChart3 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-500">
                No attribution data yet. Apply strategy changes and generate outcome signals to see impact.
              </p>
            </div>
          )}

          {/* Attribution content */}
          {!loading && data && data.summary.hasData && (
            <>
              {/* Settings toggle */}
              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  Window: {window.preDays}d before / {window.postDays}d after
                </p>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-1 hover:bg-slate-800 rounded transition-colors"
                >
                  <Settings className="w-3.5 h-3.5 text-slate-500" />
                </button>
              </div>

              {/* Window settings */}
              {showSettings && (
                <WindowSettings
                  window={window}
                  onChange={(newWindow) => {
                    setWindow(newWindow);
                    setShowSettings(false);
                  }}
                />
              )}

              {/* Top drivers summary */}
              {data.rollups.mostImpactfulDrivers.length > 0 && (
                <div className="mt-3 p-2 bg-slate-800/30 rounded-lg">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-2">
                    Top Impact Drivers
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {data.rollups.mostImpactfulDrivers.map((driver) => (
                      <DriverChip key={driver.label} driver={driver} />
                    ))}
                  </div>
                </div>
              )}

              {/* Attribution cards */}
              <div className="mt-4 space-y-2">
                {data.attributions.slice(0, 5).map((attr) => (
                  <AttributionCard
                    key={attr.eventId}
                    attribution={attr}
                    onViewDetails={() => setSelectedEventId(attr.eventId)}
                    onViewEvent={onViewEvent ? () => onViewEvent(attr.eventId) : undefined}
                  />
                ))}

                {data.attributions.length > 5 && (
                  <p className="text-xs text-slate-500 text-center pt-2">
                    +{data.attributions.length - 5} more events
                  </p>
                )}
              </div>

              {/* Note */}
              <div className="mt-4 pt-3 border-t border-slate-800/50">
                <p className="text-[10px] text-slate-600 text-center">
                  Attribution is deterministic and explainable. No AI used.
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Event Details Modal */}
      {selectedEvent && (
        <AttributionDetailsModal
          attribution={selectedEvent}
          onClose={() => setSelectedEventId(null)}
          onViewEvent={onViewEvent}
        />
      )}
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function TrendBadge({ trend }: { trend: 'positive' | 'neutral' | 'negative' }) {
  const config = {
    positive: {
      icon: TrendingUp,
      class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      label: 'Positive',
    },
    neutral: {
      icon: Minus,
      class: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
      label: 'Neutral',
    },
    negative: {
      icon: TrendingDown,
      class: 'bg-red-500/10 text-red-400 border-red-500/30',
      label: 'Negative',
    },
  };

  const { icon: Icon, class: className, label } = config[trend];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border ${className}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

function DriverChip({ driver }: { driver: TopDriver }) {
  const directionClass = {
    positive: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    neutral: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    negative: 'bg-red-500/10 text-red-400 border-red-500/30',
  };

  return (
    <span className={`px-2 py-0.5 text-[10px] font-medium rounded border ${directionClass[driver.direction]}`}>
      {driver.label}: {driver.contribution}%
    </span>
  );
}

function WindowSettings({
  window,
  onChange,
}: {
  window: AttributionWindow;
  onChange: (window: AttributionWindow) => void;
}) {
  const [preDays, setPreDays] = useState(String(window.preDays));
  const [postDays, setPostDays] = useState(String(window.postDays));

  const handleApply = () => {
    const pre = parseInt(preDays, 10);
    const post = parseInt(postDays, 10);
    if (pre > 0 && pre <= 365 && post > 0 && post <= 365) {
      onChange({ preDays: pre, postDays: post });
    }
  };

  return (
    <div className="mt-2 p-3 bg-slate-800/50 rounded-lg">
      <p className="text-xs text-slate-400 mb-2">Attribution Window</p>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <label className="text-[10px] text-slate-500">Days Before</label>
          <input
            type="number"
            min="1"
            max="365"
            value={preDays}
            onChange={(e) => setPreDays(e.target.value)}
            className="w-full mt-0.5 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-white"
          />
        </div>
        <div className="flex-1">
          <label className="text-[10px] text-slate-500">Days After</label>
          <input
            type="number"
            min="1"
            max="365"
            value={postDays}
            onChange={(e) => setPostDays(e.target.value)}
            className="w-full mt-0.5 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-white"
          />
        </div>
        <button
          onClick={handleApply}
          className="px-3 py-1 mt-3 bg-purple-500 hover:bg-purple-600 text-white text-xs font-medium rounded transition-colors"
        >
          Apply
        </button>
      </div>
    </div>
  );
}

function AttributionCard({
  attribution,
  onViewDetails,
  onViewEvent,
}: {
  attribution: EventAttribution;
  onViewDetails: () => void;
  onViewEvent?: () => void;
}) {
  const DirectionIcon = {
    positive: TrendingUp,
    neutral: Minus,
    negative: TrendingDown,
  }[attribution.direction];

  return (
    <div className="p-3 bg-slate-800/30 border border-slate-700/50 rounded-lg">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {/* Direction badge */}
            <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded border ${getDirectionColorClass(attribution.direction)}`}>
              <DirectionIcon className="w-3 h-3 inline mr-0.5" />
              {getDirectionLabel(attribution.direction)}
            </span>

            {/* Score badge */}
            <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded border ${getScoreColorClass(attribution.attributionScore)}`}>
              {formatAttributionScore(attribution.attributionScore)}
            </span>

            {/* Confidence */}
            <span className={`text-[10px] ${getConfidenceColorClass(attribution.confidence)}`}>
              {formatConfidence(attribution.confidence)} confidence
            </span>
          </div>

          {/* Title */}
          <h4 className="text-sm font-medium text-white truncate">{attribution.eventTitle}</h4>

          {/* Timestamp */}
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatRelativeTime(attribution.appliedAt)}
          </p>
        </div>
      </div>

      {/* Top drivers */}
      {attribution.topDrivers.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {attribution.topDrivers.slice(0, 3).map((driver) => (
            <DriverChip key={driver.label} driver={driver} />
          ))}
        </div>
      )}

      {/* Notes preview */}
      {attribution.notes.length > 0 && (
        <p className="mt-2 text-xs text-slate-500 line-clamp-1">
          {attribution.notes[0]}
        </p>
      )}

      {/* Actions */}
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={onViewDetails}
          className="flex items-center gap-1 px-2 py-1 bg-slate-700/50 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded transition-colors"
        >
          <Eye className="w-3 h-3" />
          Details
        </button>
        {onViewEvent && (
          <button
            onClick={onViewEvent}
            className="flex items-center gap-1 px-2 py-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-xs font-medium rounded border border-purple-500/30 transition-colors"
          >
            <Info className="w-3 h-3" />
            View Event
          </button>
        )}
      </div>
    </div>
  );
}

function AttributionDetailsModal({
  attribution,
  onClose,
  onViewEvent,
}: {
  attribution: EventAttribution;
  onClose: () => void;
  onViewEvent?: (eventId: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-xl shadow-xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
          <h3 className="text-sm font-medium text-white">Attribution Details</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-800 rounded transition-colors"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {/* Event info */}
          <div className="mb-4">
            <h4 className="text-lg font-medium text-white">{attribution.eventTitle}</h4>
            <p className="text-xs text-slate-400 mt-1">
              Applied {formatTimestamp(attribution.appliedAt)}
            </p>
          </div>

          {/* Score & Direction */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="p-3 bg-slate-800/50 rounded-lg text-center">
              <p className="text-[10px] text-slate-500 uppercase mb-1">Direction</p>
              <p className={`text-sm font-medium ${getDirectionColorClass(attribution.direction).split(' ')[1]}`}>
                {getDirectionLabel(attribution.direction)}
              </p>
            </div>
            <div className="p-3 bg-slate-800/50 rounded-lg text-center">
              <p className="text-[10px] text-slate-500 uppercase mb-1">Score</p>
              <p className="text-sm font-medium text-white">
                {formatAttributionScore(attribution.attributionScore)}
              </p>
            </div>
            <div className="p-3 bg-slate-800/50 rounded-lg text-center">
              <p className="text-[10px] text-slate-500 uppercase mb-1">Confidence</p>
              <p className={`text-sm font-medium ${getConfidenceColorClass(attribution.confidence)}`}>
                {formatConfidence(attribution.confidence)}
              </p>
            </div>
          </div>

          {/* Pre/Post comparison */}
          <div className="p-3 bg-slate-800/50 rounded-lg mb-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Signal Comparison</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] text-slate-500">Before ({attribution.window.preDays}d)</p>
                <p className="text-lg font-medium text-white">{attribution.preSignalCount} signals</p>
                <p className="text-xs text-slate-400">Score: {attribution.preWeightedTotal.toFixed(1)}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500">After ({attribution.window.postDays}d)</p>
                <p className="text-lg font-medium text-white">{attribution.postSignalCount} signals</p>
                <p className="text-xs text-slate-400">Score: {attribution.postWeightedTotal.toFixed(1)}</p>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-700">
              <p className="text-xs text-slate-400">
                Delta: {(attribution.postWeightedTotal - attribution.preWeightedTotal).toFixed(1)}
              </p>
            </div>
          </div>

          {/* Top drivers */}
          {attribution.topDrivers.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Top Drivers</p>
              <div className="space-y-2">
                {attribution.topDrivers.map((driver) => (
                  <div key={driver.label} className="flex items-center justify-between p-2 bg-slate-800/50 rounded">
                    <span className="text-sm text-white">{driver.label}</span>
                    <span className={`text-sm ${getDirectionColorClass(driver.direction).split(' ')[1]}`}>
                      {driver.contribution}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {attribution.notes.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Notes</p>
              <div className="space-y-1">
                {attribution.notes.map((note, idx) => (
                  <p key={idx} className="text-xs text-slate-400 flex items-start gap-2">
                    <Info className="w-3 h-3 mt-0.5 text-slate-500 flex-shrink-0" />
                    {note}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Action */}
          {onViewEvent && (
            <button
              onClick={() => onViewEvent(attribution.eventId)}
              className="w-full mt-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              View Evolution Event
            </button>
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

export default StrategyAttributionPanel;
