'use client';

// app/c/[companyId]/brain/context/components/ContextNodeInspector.tsx
// Context Node Inspector - Detailed view for a selected context field
//
// Shows:
// - Field metadata (path, domain, label)
// - Current value with edit capability
// - Full provenance history
// - Freshness information
// - Lock status
// - Related fields and dependencies
// - Quick actions (edit, lock, explain, suggest)

import { useState, useCallback } from 'react';
import Link from 'next/link';
import type { GraphFieldUi } from '@/lib/contextGraph/uiHelpers';
import { CONTEXT_DOMAIN_META } from '@/lib/contextGraph/uiHelpers';
import type { NeedsRefreshFlag } from '@/lib/contextGraph/contextHealth';
import type { ProvenanceTag } from '@/lib/contextGraph/types';
import type { FieldLock } from '@/lib/contextGraph/governance/locks';

// ============================================================================
// Types
// ============================================================================

interface ContextNodeInspectorProps {
  field: GraphFieldUi;
  companyId: string;
  issue?: NeedsRefreshFlag;
  lock?: FieldLock | null;
  onClose: () => void;
  onEdit?: () => void;
  onLock?: (path: string) => void;
  onUnlock?: (path: string) => void;
  onExplain?: () => void;
}

// ============================================================================
// Utility Functions
// ============================================================================

function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
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
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
  } catch {
    return dateStr;
  }
}

function getSourceLabel(source: string): string {
  const labels: Record<string, string> = {
    human: 'Manual Entry',
    brand_lab: 'Brand Lab',
    audience_lab: 'Audience Lab',
    competition_lab: 'Competition Lab',
    website_lab: 'Website Lab',
    seo_lab: 'SEO Lab',
    creative_lab: 'Creative Lab',
    ai_infer: 'AI Inference',
    import: 'Data Import',
    onboarding: 'Onboarding',
    api: 'API',
  };
  return labels[source] || source.replace(/_/g, ' ');
}

function getSourceColor(source: string): string {
  if (source === 'human') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
  if (source.includes('lab')) return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
  if (source === 'ai_infer') return 'text-purple-400 bg-purple-500/10 border-purple-500/30';
  return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
}

// ============================================================================
// Main Component
// ============================================================================

export function ContextNodeInspector({
  field,
  companyId,
  issue,
  lock,
  onClose,
  onEdit,
  onLock,
  onUnlock,
  onExplain,
}: ContextNodeInspectorProps) {
  const { label, path, value, freshness, provenance, domain } = field;
  const domainMeta = CONTEXT_DOMAIN_META[domain];

  const freshnessPct =
    freshness && Number.isFinite(freshness.normalized)
      ? Math.round(freshness.normalized * 100)
      : null;

  const isLocked = !!lock;
  const isHardLocked = lock?.severity === 'hard';

  return (
    <div className="space-y-4">
      {/* Header with Close Button */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-wide text-amber-400 mb-1">
            Field Inspector
          </div>
          <h3 className="text-base font-medium text-slate-100 leading-tight">
            {label}
          </h3>
          <div className="mt-1 text-[11px] text-slate-500 font-mono break-all">
            {path}
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors flex-shrink-0"
          title="Close inspector"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Domain Badge */}
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-slate-800 px-2.5 py-1 text-[11px] text-slate-300 border border-slate-700">
          {domainMeta?.label || domain}
        </span>

        {/* Status Badges */}
        {issue && (
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

        {isLocked && (
          <span className={cn(
            'rounded-full px-2 py-0.5 text-[10px] font-medium flex items-center gap-1',
            isHardLocked
              ? 'bg-red-500/20 text-red-300 border border-red-500/30'
              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
          )}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            {isHardLocked ? 'Hard Locked' : 'Soft Locked'}
          </span>
        )}
      </div>

      {/* Current Value */}
      <div className="space-y-2">
        <div className="text-[11px] uppercase tracking-wide text-slate-500">
          Current Value
        </div>
        <div className="rounded-md bg-slate-950/80 p-3 border border-slate-800">
          {value === null || value === '' ? (
            <span className="text-xs text-slate-500 italic">Not set</span>
          ) : (
            <div className="text-sm text-slate-200 whitespace-pre-wrap break-words">
              {value}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        {onEdit && !isHardLocked && (
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-xs text-amber-300 transition-colors border border-amber-500/30"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Edit
          </button>
        )}

        {onExplain && (
          <button
            onClick={onExplain}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-colors border border-slate-700"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Explain
          </button>
        )}

        {!isLocked && onLock && (
          <button
            onClick={() => onLock(path)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-colors border border-slate-700"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
            </svg>
            Lock
          </button>
        )}

        {isLocked && onUnlock && (
          <button
            onClick={() => onUnlock(path)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-colors border border-slate-700"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
            </svg>
            Unlock
          </button>
        )}

        {domainMeta?.labLink && domainMeta.labLink(companyId) && (
          <Link
            href={domainMeta.labLink(companyId)!}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-colors border border-slate-700"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            Open Lab
          </Link>
        )}
      </div>

      {/* Freshness Info */}
      {freshnessPct !== null && (
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">
            Freshness
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  freshnessPct >= 75 && 'bg-emerald-500',
                  freshnessPct >= 50 && freshnessPct < 75 && 'bg-amber-500',
                  freshnessPct < 50 && 'bg-red-500'
                )}
                style={{ width: `${freshnessPct}%` }}
              />
            </div>
            <span
              className={cn(
                'text-sm font-semibold tabular-nums',
                freshnessPct >= 75 && 'text-emerald-400',
                freshnessPct >= 50 && freshnessPct < 75 && 'text-amber-400',
                freshnessPct < 50 && 'text-red-400'
              )}
            >
              {freshnessPct}%
            </span>
          </div>
          {freshness?.ageDays !== undefined && (
            <div className="text-xs text-slate-500">
              Age: {freshness.ageDays} {freshness.ageDays === 1 ? 'day' : 'days'}
            </div>
          )}
        </div>
      )}

      {/* Lock Info */}
      {lock && (
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">
            Lock Details
          </div>
          <div className="rounded-md bg-slate-950/80 p-3 border border-slate-800 space-y-2">
            <div className="text-xs text-slate-300">
              <span className="text-slate-500">Reason:</span> {lock.reason || 'No reason provided'}
            </div>
            {lock.lockedBy && (
              <div className="text-xs text-slate-300">
                <span className="text-slate-500">Locked by:</span> {lock.lockedBy}
              </div>
            )}
            {lock.lockedAt && (
              <div className="text-xs text-slate-300">
                <span className="text-slate-500">Locked:</span> {formatDate(lock.lockedAt)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Provenance History */}
      {provenance && provenance.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">
            Provenance History ({provenance.length})
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {provenance.map((p, idx) => (
              <ProvenanceHistoryItem key={idx} provenance={p} isLatest={idx === 0} />
            ))}
          </div>
        </div>
      )}

      {/* Deep Link */}
      <div className="pt-2 border-t border-slate-800">
        <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">
          Deep Link
        </div>
        <code className="block text-[10px] text-slate-400 bg-slate-950 px-2 py-1.5 rounded border border-slate-800 break-all">
          /c/{companyId}/brain/context?nodeId={path}
        </code>
      </div>
    </div>
  );
}

// ============================================================================
// Provenance History Item
// ============================================================================

function ProvenanceHistoryItem({
  provenance,
  isLatest,
}: {
  provenance: ProvenanceTag;
  isLatest: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-md p-2.5 border transition-colors',
        isLatest
          ? 'bg-amber-500/5 border-amber-500/20'
          : 'bg-slate-950/80 border-slate-800'
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border',
            getSourceColor(provenance.source)
          )}
        >
          {getSourceLabel(provenance.source)}
        </span>
        {isLatest && (
          <span className="text-[9px] text-amber-400 uppercase tracking-wide">
            Current
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 text-[11px]">
        {provenance.updatedAt && (
          <span className="text-slate-500">
            {formatRelativeTime(provenance.updatedAt)}
          </span>
        )}
        {provenance.confidence != null && (
          <span className="text-slate-500">
            Confidence: {Math.round(provenance.confidence * 100)}%
          </span>
        )}
      </div>

      {provenance.notes && (
        <div className="mt-1.5 text-xs text-slate-400 italic">
          {provenance.notes}
        </div>
      )}
    </div>
  );
}

export default ContextNodeInspector;
