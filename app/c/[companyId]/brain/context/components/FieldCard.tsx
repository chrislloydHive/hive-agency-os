'use client';

// app/c/[companyId]/context/components/FieldCard.tsx
// Enhanced Field Card Component (Phase 3)
//
// Rich field display with:
// - Expandable value view
// - Provenance pills with modal trigger
// - Freshness indicator
// - Open in Lab action
// - AI explain button integration
// - Inline editing (Phase 3)
// - Lock badges (Phase 3)
// - Suggest fix button (Phase 3)

import { useState, useCallback } from 'react';
import Link from 'next/link';
import type { GraphFieldUi } from '@/lib/contextGraph/uiHelpers';
import { CONTEXT_DOMAIN_META } from '@/lib/contextGraph/uiHelpers';
import type { NeedsRefreshFlag } from '@/lib/contextGraph/contextHealth';
import type { ProvenanceTag } from '@/lib/contextGraph/types';
import type { FieldLock } from '@/lib/contextGraph/governance/locks';
import { InlineEditor } from './InlineEditor';
import { LockBadge, LockIcon } from './LockBadge';
import { RefinementBadge, getLabIdFromSource, isLabSource } from '@/components/labs/RefinementSummary';

// ============================================================================
// Types
// ============================================================================

interface FieldCardProps {
  field: GraphFieldUi;
  issue?: NeedsRefreshFlag;
  companyId: string;
  lock?: FieldLock | null;
  onOpenProvenance: (field: GraphFieldUi) => void;
  onExplainField: (field: GraphFieldUi) => void;
  onSave?: (path: string, newValue: string) => Promise<{ success: boolean; error?: string }>;
  onLock?: (path: string) => void;
  onUnlock?: (path: string) => void;
  onSuggestFix?: (field: GraphFieldUi) => void;
  canEdit?: boolean;
  /** Whether this field is currently selected */
  isSelected?: boolean;
  /** Callback when this field is clicked to select it */
  onSelect?: () => void;
}

// ============================================================================
// Utility Functions
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
    return date.toLocaleDateString();
  } catch {
    return dateStr;
  }
}

// ============================================================================
// Main Component
// ============================================================================

export function FieldCard({
  field,
  issue,
  companyId,
  lock,
  onOpenProvenance,
  onExplainField,
  onSave,
  onLock,
  onUnlock,
  onSuggestFix,
  canEdit = true,
  isSelected = false,
  onSelect,
}: FieldCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const { label, path, value, freshness, provenance, domain } = field;

  const freshnessPct =
    freshness && Number.isFinite(freshness.normalized)
      ? Math.round(freshness.normalized * 100)
      : null;

  const topSource = provenance?.[0];
  const domainMeta = CONTEXT_DOMAIN_META[domain];
  const labLink = domainMeta?.labLink?.(companyId);

  // Check lock status
  const isLocked = !!lock;
  const isHardLocked = lock?.severity === 'hard';
  const canEditField = canEdit && (!isLocked || lock?.severity === 'soft');

  // Check if value is long and should be truncated
  const isLongValue = value && value.length > 200;
  const displayValue = isLongValue && !isExpanded
    ? value.slice(0, 200) + '...'
    : value;

  const handleSave = useCallback(async (newValue: string) => {
    if (!onSave) return { success: false, error: 'Save not available' };
    const result = await onSave(path, newValue);
    if (result.success) {
      setIsEditing(false);
    }
    return result;
  }, [onSave, path]);

  const handleStartEdit = useCallback(() => {
    if (canEditField) {
      setIsEditing(true);
    }
  }, [canEditField]);

  // If in editing mode, show the inline editor
  if (isEditing && onSave) {
    return (
      <InlineEditor
        path={path}
        value={value}
        label={label}
        companyId={companyId}
        isLocked={isHardLocked}
        lockReason={lock?.reason}
        onSave={handleSave}
        onCancel={() => setIsEditing(false)}
      />
    );
  }

  // Handle card click for selection
  const handleCardClick = useCallback((e: React.MouseEvent) => {
    // Don't select if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a') || target.closest('input')) {
      return;
    }
    onSelect?.();
  }, [onSelect]);

  return (
    <div
      className={cn(
        'rounded-lg border p-4 transition-colors group cursor-pointer',
        isSelected
          ? 'border-amber-500/60 bg-amber-500/10 ring-1 ring-amber-500/30'
          : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
      )}
      onClick={handleCardClick}
    >
      {/* Header Row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-medium text-slate-100">{label}</h3>

            {/* Lock Badge */}
            {lock && (
              <LockBadge
                lock={lock}
                canUnlock={!!onUnlock}
                onUnlock={() => onUnlock?.(path)}
              />
            )}

            {/* Lab Refinement Badge */}
            {topSource && isLabSource(topSource.source) && (
              <RefinementBadge
                labId={getLabIdFromSource(topSource.source)!}
                updatedAt={topSource.updatedAt}
              />
            )}

            {/* Issue Badge */}
            {issue && !lock && (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-medium',
                  issue.reason === 'missing'
                    ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                )}
              >
                {issue.reason === 'missing' ? 'Missing' : issue.reason === 'expired' ? 'Expired' : 'Stale'}
              </span>
            )}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500 font-mono">{path}</div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Edit Button (only show if can edit) */}
          {canEditField && onSave && (
            <button
              onClick={handleStartEdit}
              className="p-1.5 rounded-md text-slate-500 hover:text-amber-300 hover:bg-slate-800 transition-colors opacity-0 group-hover:opacity-100"
              title="Edit field"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}

          {/* Lock/Unlock Button */}
          {!isLocked && onLock && (
            <button
              onClick={() => onLock(path)}
              className="p-1.5 rounded-md text-slate-500 hover:text-amber-300 hover:bg-slate-800 transition-colors opacity-0 group-hover:opacity-100"
              title="Lock field"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
              </svg>
            </button>
          )}

          {/* Suggest Fix (show when there's an issue) */}
          {issue && onSuggestFix && (
            <button
              onClick={() => onSuggestFix(field)}
              className="p-1.5 rounded-md text-amber-500 hover:text-amber-300 hover:bg-slate-800 transition-colors"
              title="AI suggest fix"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </button>
          )}

          {/* Explain Button */}
          <button
            onClick={() => onExplainField(field)}
            className="p-1.5 rounded-md text-slate-500 hover:text-amber-300 hover:bg-slate-800 transition-colors"
            title="Explain this field with AI"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </button>

          {/* Lab Link */}
          {labLink && (
            <Link
              href={labLink}
              className="p-1.5 rounded-md text-slate-500 hover:text-blue-300 hover:bg-slate-800 transition-colors"
              title={`Open ${domainMeta.label} Lab`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </Link>
          )}

          {/* Freshness */}
          {freshnessPct !== null && (
            <div className="text-right ml-2">
              <div className="text-[10px] text-slate-500 uppercase tracking-wide">Fresh</div>
              <div
                className={cn(
                  'text-sm font-semibold',
                  freshnessPct >= 75 && 'text-emerald-400',
                  freshnessPct >= 50 && freshnessPct < 75 && 'text-amber-400',
                  freshnessPct < 50 && 'text-red-400'
                )}
              >
                {freshnessPct}%
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Value */}
      <div
        className={cn(
          'mt-3 rounded-md bg-slate-950/80 px-3 py-2',
          canEditField && onSave && 'cursor-pointer hover:bg-slate-950'
        )}
        onClick={canEditField && onSave ? handleStartEdit : undefined}
      >
        {value === null || value === '' ? (
          <span className="text-xs text-slate-500 italic">
            {canEditField ? 'Click to add value' : 'Not set'}
          </span>
        ) : (
          <>
            <div className="text-sm text-slate-200 whitespace-pre-wrap break-words">
              {displayValue}
            </div>
            {isLongValue && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className="mt-2 text-xs text-amber-400 hover:text-amber-300"
              >
                {isExpanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </>
        )}
      </div>

      {/* Provenance Row */}
      {topSource && (
        <div className="mt-3 flex items-center justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <ProvenancePill
              provenance={topSource}
              onClick={() => onOpenProvenance(field)}
            />
            {provenance && provenance.length > 1 && (
              <button
                onClick={() => onOpenProvenance(field)}
                className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
              >
                +{provenance.length - 1} more
              </button>
            )}
          </div>

          {/* View Full Provenance */}
          <button
            onClick={() => onOpenProvenance(field)}
            className="text-[10px] text-slate-500 hover:text-slate-300 underline"
          >
            View provenance
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Provenance Pill Component
// ============================================================================

function ProvenancePill({
  provenance,
  onClick,
}: {
  provenance: ProvenanceTag;
  onClick: () => void;
}) {
  const date = provenance.updatedAt ? new Date(provenance.updatedAt) : null;
  const shortSource = provenance.source.replace(/_/g, ' ');

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-2.5 py-1 text-[10px] text-slate-300 border border-slate-700 hover:border-slate-600 hover:bg-slate-700 transition-colors cursor-pointer"
    >
      <span className="capitalize">{shortSource}</span>
      {date && <span className="text-slate-500">· {formatRelativeTime(date.toISOString())}</span>}
      {provenance.confidence != null && (
        <span className="text-slate-500">· {Math.round(provenance.confidence * 100)}%</span>
      )}
    </button>
  );
}

export default FieldCard;
