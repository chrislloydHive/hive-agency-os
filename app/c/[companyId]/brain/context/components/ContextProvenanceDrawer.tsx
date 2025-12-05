'use client';

// app/c/[companyId]/brain/context/components/ContextProvenanceDrawer.tsx
// Interactive Provenance Drawer for Context Graph fields
//
// Shows:
// - Ordered list of provenance items with sourceType, runId, confidence, timestamp
// - Diff view if applicable
// - Actions: Promote source, Dismiss source, Lock field

import { useState, useCallback } from 'react';
import type { ProvenanceTag } from '@/lib/contextGraph/types';
import type { ContextFieldDef } from '@/lib/contextGraph/schema';

// ============================================================================
// Types
// ============================================================================

interface ContextProvenanceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  fieldPath: string;
  fieldLabel: string;
  fieldDef?: ContextFieldDef;
  currentValue: string | null;
  provenance: ProvenanceTag[];
  onPromoteSource?: (provenanceIndex: number) => Promise<void>;
  onDismissSource?: (provenanceIndex: number) => Promise<void>;
  onLockField?: () => Promise<void>;
  onRevertToSource?: (provenanceIndex: number) => Promise<void>;
}

// ============================================================================
// Helper Functions
// ============================================================================

function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  } catch {
    return dateStr;
  }
}

function formatSourceName(source: string): string {
  const sourceNames: Record<string, string> = {
    user: 'User Edit',
    manual: 'Manual Entry',
    setup_wizard: 'Setup Wizard',
    gap_ia: 'GAP IA',
    gap_full: 'GAP Full',
    gap_heavy: 'GAP Heavy',
    website_lab: 'Website Lab',
    brand_lab: 'Brand Lab',
    audience_lab: 'Audience Lab',
    media_lab: 'Media Lab',
    creative_lab: 'Creative Lab',
    content_lab: 'Content Lab',
    seo_lab: 'SEO Lab',
    ops_lab: 'Ops Lab',
    demand_lab: 'Demand Lab',
    qbr: 'QBR',
    strategy: 'Strategic Plan',
    analytics_ga4: 'GA4 Analytics',
    analytics_gsc: 'Search Console',
    analytics_gads: 'Google Ads',
    import: 'Data Import',
    inferred: 'AI Inferred',
    airtable: 'Airtable Sync',
  };
  return sourceNames[source] || source.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function getSourceColor(source: string): { bg: string; text: string; border: string } {
  // Human sources - gold/amber
  if (['user', 'manual', 'setup_wizard', 'qbr', 'strategy'].includes(source)) {
    return {
      bg: 'bg-amber-500/20',
      text: 'text-amber-400',
      border: 'border-amber-500/30',
    };
  }
  // Analytics - green
  if (source.startsWith('analytics_')) {
    return {
      bg: 'bg-emerald-500/20',
      text: 'text-emerald-400',
      border: 'border-emerald-500/30',
    };
  }
  // Labs - blue
  if (source.endsWith('_lab')) {
    return {
      bg: 'bg-blue-500/20',
      text: 'text-blue-400',
      border: 'border-blue-500/30',
    };
  }
  // GAP - purple
  if (source.startsWith('gap_')) {
    return {
      bg: 'bg-purple-500/20',
      text: 'text-purple-400',
      border: 'border-purple-500/30',
    };
  }
  // Default - slate
  return {
    bg: 'bg-slate-500/20',
    text: 'text-slate-400',
    border: 'border-slate-500/30',
  };
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.9) return 'text-emerald-400';
  if (confidence >= 0.7) return 'text-amber-400';
  return 'text-red-400';
}

// ============================================================================
// Main Component
// ============================================================================

export function ContextProvenanceDrawer({
  isOpen,
  onClose,
  companyId,
  fieldPath,
  fieldLabel,
  fieldDef,
  currentValue,
  provenance,
  onPromoteSource,
  onDismissSource,
  onLockField,
  onRevertToSource,
}: ContextProvenanceDrawerProps) {
  const [isLocking, setIsLocking] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<number | null>(null);

  const handleLockField = useCallback(async () => {
    if (!onLockField) return;
    setIsLocking(true);
    try {
      await onLockField();
    } finally {
      setIsLocking(false);
    }
  }, [onLockField]);

  const handlePromoteSource = useCallback(async (index: number) => {
    if (!onPromoteSource) return;
    setActionInProgress(index);
    try {
      await onPromoteSource(index);
    } finally {
      setActionInProgress(null);
    }
  }, [onPromoteSource]);

  const handleRevertToSource = useCallback(async (index: number) => {
    if (!onRevertToSource) return;
    setActionInProgress(index);
    try {
      await onRevertToSource(index);
    } finally {
      setActionInProgress(null);
    }
  }, [onRevertToSource]);

  if (!isOpen) return null;

  const latestProvenance = provenance[0];
  const isHumanSource = latestProvenance && ['user', 'manual', 'setup_wizard', 'qbr', 'strategy'].includes(latestProvenance.source);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-full max-w-lg bg-slate-900 border-l border-slate-700 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-800">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-slate-100 truncate">
              {fieldLabel}
            </h2>
            <p className="text-xs text-slate-500 font-mono mt-0.5">{fieldPath}</p>
            {fieldDef?.description && (
              <p className="text-xs text-slate-400 mt-2">{fieldDef.description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors ml-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Current Value */}
        <div className="p-5 border-b border-slate-800">
          <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">
            Current Value
          </div>
          <div className="rounded-lg bg-slate-950/80 p-3">
            {currentValue ? (
              <p className="text-sm text-slate-200 whitespace-pre-wrap break-words">
                {currentValue.length > 500 ? currentValue.slice(0, 500) + '...' : currentValue}
              </p>
            ) : (
              <p className="text-sm text-slate-500 italic">Not set</p>
            )}
          </div>
          {latestProvenance && (
            <div className="flex items-center gap-2 mt-2">
              <span className={cn(
                'text-xs px-2 py-0.5 rounded-full border',
                getSourceColor(latestProvenance.source).bg,
                getSourceColor(latestProvenance.source).text,
                getSourceColor(latestProvenance.source).border
              )}>
                {formatSourceName(latestProvenance.source)}
              </span>
              {latestProvenance.confidence != null && (
                <span className={cn('text-xs', getConfidenceColor(latestProvenance.confidence))}>
                  {Math.round(latestProvenance.confidence * 100)}% confidence
                </span>
              )}
              {latestProvenance.updatedAt && (
                <span className="text-xs text-slate-500">
                  {formatRelativeTime(latestProvenance.updatedAt)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Provenance History */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs uppercase tracking-wide text-slate-500">
              Provenance History ({provenance.length})
            </h3>
            {onLockField && (
              <button
                onClick={handleLockField}
                disabled={isLocking}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 transition-colors disabled:opacity-50"
              >
                {isLocking ? (
                  <div className="w-3 h-3 rounded-full border-2 border-amber-400/30 border-t-amber-400 animate-spin" />
                ) : (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                )}
                Lock from auto-updates
              </button>
            )}
          </div>

          {provenance.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-700 p-6 text-center">
              <p className="text-sm text-slate-500">No provenance history available</p>
            </div>
          ) : (
            <div className="space-y-3">
              {provenance.map((prov, index) => {
                const sourceColors = getSourceColor(prov.source);
                const isLatest = index === 0;
                const isActionInProgress = actionInProgress === index;

                return (
                  <div
                    key={`${prov.source}-${prov.updatedAt}-${index}`}
                    className={cn(
                      'rounded-lg border p-4 transition-colors',
                      isLatest
                        ? 'border-amber-500/30 bg-amber-500/5'
                        : 'border-slate-800 bg-slate-950/50'
                    )}
                  >
                    {/* Source Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn(
                          'text-xs px-2 py-0.5 rounded-full border',
                          sourceColors.bg,
                          sourceColors.text,
                          sourceColors.border
                        )}>
                          {formatSourceName(prov.source)}
                        </span>
                        {isLatest && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            CURRENT
                          </span>
                        )}
                      </div>
                      {prov.updatedAt && (
                        <span className="text-xs text-slate-500 flex-shrink-0">
                          {formatRelativeTime(prov.updatedAt)}
                        </span>
                      )}
                    </div>

                    {/* Details */}
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center gap-4 text-xs">
                        {prov.confidence != null && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500">Confidence:</span>
                            <span className={getConfidenceColor(prov.confidence)}>
                              {Math.round(prov.confidence * 100)}%
                            </span>
                          </div>
                        )}
                        {prov.runId && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500">Run:</span>
                            <span className="text-slate-400 font-mono">{prov.runId.slice(0, 8)}</span>
                          </div>
                        )}
                        {prov.validForDays != null && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500">Valid for:</span>
                            <span className="text-slate-400">{prov.validForDays}d</span>
                          </div>
                        )}
                      </div>

                      {prov.notes && (
                        <p className="text-xs text-slate-400 italic">{prov.notes}</p>
                      )}
                    </div>

                    {/* Actions (only for non-latest items) */}
                    {!isLatest && (onRevertToSource || onPromoteSource) && (
                      <div className="mt-3 pt-3 border-t border-slate-800 flex items-center gap-2">
                        {onRevertToSource && (
                          <button
                            onClick={() => handleRevertToSource(index)}
                            disabled={isActionInProgress}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-colors disabled:opacity-50"
                          >
                            {isActionInProgress ? (
                              <div className="w-3 h-3 rounded-full border-2 border-blue-400/30 border-t-blue-400 animate-spin" />
                            ) : (
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                              </svg>
                            )}
                            Revert to this
                          </button>
                        )}
                        {onPromoteSource && (
                          <button
                            onClick={() => handlePromoteSource(index)}
                            disabled={isActionInProgress}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors disabled:opacity-50"
                          >
                            Promote as canonical
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50">
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-500">
              {isHumanSource ? (
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Human override - protected from auto-updates
                </span>
              ) : (
                <span>Auto-managed by {formatSourceName(latestProvenance?.source || 'unknown')}</span>
              )}
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:text-slate-100 hover:bg-slate-800 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ContextProvenanceDrawer;
