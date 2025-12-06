// components/labs/RefinementSummary.tsx
// Shared UI components for Lab refinement feedback
//
// Used in:
// - Audience Lab, Brand Lab, Creative Lab UIs (after refinement runs)
// - Brain → Context page (for fields updated by Labs)

'use client';

import { useState } from 'react';
import type {
  LabRefinementRunResult,
  RefinementApplyResult,
  LabDiagnostic,
  RefinedField,
  RefinementLabId,
} from '@/lib/labs/refinementTypes';

// ============================================================================
// Types
// ============================================================================

interface RefinementSummaryProps {
  result: LabRefinementRunResult;
  className?: string;
  showDetails?: boolean;
}

interface RefinementBadgeProps {
  labId: RefinementLabId;
  updatedAt?: string;
  className?: string;
}

interface ApplyResultSummaryProps {
  result: RefinementApplyResult;
  className?: string;
}

// ============================================================================
// Lab Colors
// ============================================================================

const LAB_COLORS: Record<RefinementLabId, { bg: string; text: string; border: string }> = {
  audience: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
  },
  brand: {
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    border: 'border-purple-500/30',
  },
  creative: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
  },
  competitor: {
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    border: 'border-rose-500/30',
  },
  website: {
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-400',
    border: 'border-cyan-500/30',
  },
};

const LAB_LABELS: Record<RefinementLabId, string> = {
  audience: 'Audience Lab',
  brand: 'Brand Lab',
  creative: 'Creative Lab',
  competitor: 'Competitor Lab',
  website: 'Website Lab',
};

// ============================================================================
// Main Components
// ============================================================================

/**
 * Full refinement summary panel shown after a Lab run
 */
export function RefinementSummary({
  result,
  className = '',
  showDetails = false,
}: RefinementSummaryProps) {
  const [detailsExpanded, setDetailsExpanded] = useState(showDetails);
  const { refinement, applyResult, labId, durationMs } = result;

  const colors = LAB_COLORS[labId];
  const totalRefinements = refinement.refinedContext.length;

  // Summary stats
  const updated = applyResult?.updated ?? 0;
  const skippedHuman = applyResult?.skippedHumanOverride ?? 0;
  const skippedPriority = applyResult?.skippedHigherPriority ?? 0;
  const skippedUnchanged = applyResult?.skippedUnchanged ?? 0;

  return (
    <div className={`rounded-lg border ${colors.border} ${colors.bg} p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <LabIcon labId={labId} className="w-5 h-5" />
          <span className={`font-medium ${colors.text}`}>
            {LAB_LABELS[labId]} Refinement
          </span>
        </div>
        <span className="text-xs text-slate-500">
          {(durationMs / 1000).toFixed(1)}s
        </span>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        <StatBox label="Refined" value={updated} variant="success" />
        <StatBox label="Human Override" value={skippedHuman} variant="warning" />
        <StatBox label="Higher Source" value={skippedPriority} variant="info" />
        <StatBox label="Unchanged" value={skippedUnchanged} variant="neutral" />
      </div>

      {/* Summary text */}
      {refinement.summary && (
        <p className="text-sm text-slate-400 mb-3">{refinement.summary}</p>
      )}

      {/* Diagnostics */}
      {refinement.diagnostics.length > 0 && (
        <div className="mb-3">
          <DiagnosticsList diagnostics={refinement.diagnostics} />
        </div>
      )}

      {/* Details toggle */}
      {totalRefinements > 0 && (
        <>
          <button
            onClick={() => setDetailsExpanded(!detailsExpanded)}
            className="text-xs text-slate-400 hover:text-slate-300 flex items-center gap-1"
          >
            <svg
              className={`w-3 h-3 transition-transform ${detailsExpanded ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {detailsExpanded ? 'Hide' : 'Show'} field details ({totalRefinements})
          </button>

          {detailsExpanded && applyResult && applyResult.fieldResults && (
            <div className="mt-3 space-y-2">
              {applyResult.fieldResults.map((field, i) => (
                <FieldResultRow key={i} {...field} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Small badge showing which Lab refined a field
 */
export function RefinementBadge({
  labId,
  updatedAt,
  className = '',
}: RefinementBadgeProps) {
  const colors = LAB_COLORS[labId];

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${colors.bg} ${colors.text} ${className}`}
      title={updatedAt ? `Refined ${new Date(updatedAt).toLocaleDateString()}` : undefined}
    >
      <LabIcon labId={labId} className="w-3 h-3" />
      <span className="font-medium">{LAB_LABELS[labId]}</span>
    </span>
  );
}

/**
 * Compact apply result summary
 */
export function ApplyResultSummary({
  result,
  className = '',
}: ApplyResultSummaryProps) {
  const { updated, skippedHumanOverride, skippedHigherPriority, skippedUnchanged } = result;

  const parts: string[] = [];
  if (updated > 0) parts.push(`${updated} refined`);
  if (skippedHumanOverride > 0) parts.push(`${skippedHumanOverride} preserved (human)`);
  if (skippedHigherPriority > 0) parts.push(`${skippedHigherPriority} preserved (source)`);
  if (skippedUnchanged > 0) parts.push(`${skippedUnchanged} unchanged`);

  if (parts.length === 0) {
    return <span className={`text-sm text-slate-500 ${className}`}>No changes</span>;
  }

  return (
    <span className={`text-sm text-slate-400 ${className}`}>
      {parts.join(' · ')}
    </span>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function StatBox({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant: 'success' | 'warning' | 'info' | 'neutral';
}) {
  const variantStyles = {
    success: 'bg-emerald-500/10 text-emerald-400',
    warning: 'bg-amber-500/10 text-amber-400',
    info: 'bg-blue-500/10 text-blue-400',
    neutral: 'bg-slate-800 text-slate-400',
  };

  return (
    <div className={`rounded px-2 py-1.5 text-center ${variantStyles[variant]}`}>
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs opacity-80">{label}</div>
    </div>
  );
}

function DiagnosticsList({ diagnostics }: { diagnostics: LabDiagnostic[] }) {
  return (
    <div className="space-y-1">
      {diagnostics.map((d, i) => (
        <div
          key={i}
          className={`flex items-start gap-2 text-xs ${
            d.severity === 'error'
              ? 'text-red-400'
              : d.severity === 'warning'
              ? 'text-amber-400'
              : 'text-slate-400'
          }`}
        >
          <DiagnosticIcon severity={d.severity} />
          <span>{d.message}</span>
        </div>
      ))}
    </div>
  );
}

function DiagnosticIcon({ severity }: { severity: LabDiagnostic['severity'] }) {
  if (severity === 'error') {
    return (
      <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
  if (severity === 'warning') {
    return (
      <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    );
  }
  return (
    <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function FieldResultRow({
  path,
  status,
  reason,
  previousValue,
  newValue,
}: {
  path: string;
  status: 'updated' | 'skipped_human_override' | 'skipped_higher_priority' | 'skipped_unchanged' | 'error';
  reason?: string;
  previousValue?: unknown;
  newValue?: unknown;
}) {
  const statusStyles = {
    updated: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Updated' },
    skipped_human_override: { bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'Human' },
    skipped_higher_priority: { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Source' },
    skipped_unchanged: { bg: 'bg-slate-800', text: 'text-slate-500', label: 'Same' },
    error: { bg: 'bg-red-500/10', text: 'text-red-400', label: 'Error' },
  };

  const style = statusStyles[status];

  return (
    <div className="flex items-center justify-between rounded px-2 py-1.5 bg-slate-800/50 text-xs">
      <div className="flex items-center gap-2">
        <span className={`px-1.5 py-0.5 rounded ${style.bg} ${style.text}`}>
          {style.label}
        </span>
        <code className="text-slate-300">{path}</code>
      </div>
      {reason && (
        <span className="text-slate-500 truncate max-w-[200px]" title={reason}>
          {reason}
        </span>
      )}
    </div>
  );
}

function LabIcon({ labId, className = '' }: { labId: RefinementLabId; className?: string }) {
  const colors = LAB_COLORS[labId];

  if (labId === 'audience') {
    return (
      <svg className={`${colors.text} ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    );
  }

  if (labId === 'brand') {
    return (
      <svg className={`${colors.text} ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      </svg>
    );
  }

  if (labId === 'competitor') {
    return (
      <svg className={`${colors.text} ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    );
  }

  if (labId === 'website') {
    return (
      <svg className={`${colors.text} ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
      </svg>
    );
  }

  // creative (default)
  return (
    <svg className={`${colors.text} ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  );
}

// ============================================================================
// Utility to map provenance source to Lab badge
// ============================================================================

/**
 * Get the Lab ID from a provenance source name
 */
export function getLabIdFromSource(source: string): RefinementLabId | null {
  if (source === 'audience_lab') return 'audience';
  if (source === 'brand_lab') return 'brand';
  if (source === 'creative_lab') return 'creative';
  if (source === 'competitor_lab') return 'competitor';
  if (source === 'website_lab') return 'website';
  return null;
}

/**
 * Check if a source is from a refinement Lab
 */
export function isLabSource(source: string): boolean {
  return getLabIdFromSource(source) !== null;
}
