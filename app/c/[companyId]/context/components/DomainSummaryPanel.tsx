'use client';

// app/c/[companyId]/context/components/DomainSummaryPanel.tsx
// Domain Summary Panel Component
//
// Shows statistics and health summary for the selected domain:
// - Field count (populated vs total)
// - Average freshness
// - Issues count by type
// - Quick actions

import Link from 'next/link';
import type { GraphFieldUi, ContextDomainId } from '@/lib/contextGraph/uiHelpers';
import { CONTEXT_DOMAIN_META } from '@/lib/contextGraph/uiHelpers';
import type { NeedsRefreshFlag } from '@/lib/contextGraph/contextHealth';

// ============================================================================
// Types
// ============================================================================

interface DomainSummaryPanelProps {
  domainId: ContextDomainId;
  fields: GraphFieldUi[];
  issues: NeedsRefreshFlag[];
  companyId: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

// ============================================================================
// Main Component
// ============================================================================

export function DomainSummaryPanel({
  domainId,
  fields,
  issues,
  companyId,
}: DomainSummaryPanelProps) {
  const meta = CONTEXT_DOMAIN_META[domainId];
  const labLink = meta?.labLink?.(companyId);

  // Calculate stats
  const totalFields = fields.length;
  const populatedFields = fields.filter(f => f.value !== null && f.value !== '').length;
  const populationPct = totalFields > 0 ? Math.round((populatedFields / totalFields) * 100) : 0;

  // Calculate average freshness
  const fieldsWithFreshness = fields.filter(f => f.freshness?.normalized != null);
  const avgFreshness = fieldsWithFreshness.length > 0
    ? Math.round(
        fieldsWithFreshness.reduce((sum, f) => sum + (f.freshness?.normalized ?? 0), 0) /
        fieldsWithFreshness.length * 100
      )
    : null;

  // Count issues by type
  const missingCount = issues.filter(i => i.reason === 'missing').length;
  const staleCount = issues.filter(i => i.reason === 'stale').length;
  const expiredCount = issues.filter(i => i.reason === 'expired').length;
  const lowConfidenceCount = issues.filter(i => i.reason === 'low_confidence').length;

  // Calculate domain health score (simple weighted average)
  const healthScore = Math.max(0, Math.min(100,
    populationPct * 0.4 +
    (avgFreshness ?? 80) * 0.4 +
    Math.max(0, 100 - issues.length * 10) * 0.2
  ));

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">{meta.label}</h3>
          {meta.description && (
            <p className="mt-0.5 text-xs text-slate-500">{meta.description}</p>
          )}
        </div>
        {labLink && (
          <Link
            href={labLink}
            className="text-xs text-slate-400 hover:text-amber-300 underline"
          >
            Open Lab →
          </Link>
        )}
      </div>

      {/* Health Score */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-wide text-slate-500">Domain Health</span>
          <span className={cn(
            'text-sm font-bold',
            healthScore >= 70 && 'text-emerald-400',
            healthScore >= 40 && healthScore < 70 && 'text-amber-400',
            healthScore < 40 && 'text-red-400'
          )}>
            {Math.round(healthScore)}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              healthScore >= 70 && 'bg-emerald-500',
              healthScore >= 40 && healthScore < 70 && 'bg-amber-500',
              healthScore < 40 && 'bg-red-500'
            )}
            style={{ width: `${healthScore}%` }}
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Population */}
        <div className="rounded-lg bg-slate-950/60 p-3">
          <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Populated</div>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold text-slate-200">{populatedFields}</span>
            <span className="text-xs text-slate-500">/ {totalFields}</span>
          </div>
          <div className="mt-1 text-[10px] text-slate-500">
            {populationPct}% complete
          </div>
        </div>

        {/* Freshness */}
        <div className="rounded-lg bg-slate-950/60 p-3">
          <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Avg Freshness</div>
          {avgFreshness !== null ? (
            <>
              <div className={cn(
                'text-lg font-bold',
                avgFreshness >= 70 && 'text-emerald-400',
                avgFreshness >= 40 && avgFreshness < 70 && 'text-amber-400',
                avgFreshness < 40 && 'text-red-400'
              )}>
                {avgFreshness}%
              </div>
              <div className="mt-1 text-[10px] text-slate-500">
                {fieldsWithFreshness.length} tracked
              </div>
            </>
          ) : (
            <div className="text-sm text-slate-500 italic">N/A</div>
          )}
        </div>
      </div>

      {/* Issues Breakdown */}
      {issues.length > 0 && (
        <div className="border-t border-slate-800 pt-4">
          <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">
            Issues ({issues.length})
          </div>
          <div className="space-y-1.5">
            {missingCount > 0 && (
              <IssueRow type="missing" count={missingCount} />
            )}
            {staleCount > 0 && (
              <IssueRow type="stale" count={staleCount} />
            )}
            {expiredCount > 0 && (
              <IssueRow type="expired" count={expiredCount} />
            )}
            {lowConfidenceCount > 0 && (
              <IssueRow type="low_confidence" count={lowConfidenceCount} />
            )}
          </div>
        </div>
      )}

      {/* No Issues */}
      {issues.length === 0 && populatedFields > 0 && (
        <div className="border-t border-slate-800 pt-4 flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span className="text-xs text-slate-400">All fields healthy</span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Issue Row Component
// ============================================================================

function IssueRow({ type, count }: { type: string; count: number }) {
  const config: Record<string, { label: string; color: string; bg: string }> = {
    missing: { label: 'Missing', color: 'text-red-300', bg: 'bg-red-500/20' },
    stale: { label: 'Stale', color: 'text-amber-300', bg: 'bg-amber-500/20' },
    expired: { label: 'Expired', color: 'text-orange-300', bg: 'bg-orange-500/20' },
    low_confidence: { label: 'Low Confidence', color: 'text-blue-300', bg: 'bg-blue-500/20' },
  };

  const { label, color, bg } = config[type] ?? config.stale;

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className={cn('w-1.5 h-1.5 rounded-full', bg.replace('/20', ''))} />
        <span className={cn('text-xs', color)}>{label}</span>
      </div>
      <span className="text-xs text-slate-500">{count}</span>
    </div>
  );
}

export default DomainSummaryPanel;
