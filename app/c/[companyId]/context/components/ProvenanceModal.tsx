'use client';

// app/c/[companyId]/context/components/ProvenanceModal.tsx
// Full Provenance Inspector Modal
//
// Shows complete provenance chain for a field with:
// - Timeline view of all updates
// - Source details and confidence
// - Raw data inspection

import { useState } from 'react';
import type { ProvenanceTag } from '@/lib/contextGraph/types';

// ============================================================================
// Types
// ============================================================================

interface ProvenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  fieldPath: string;
  fieldLabel: string;
  value: string | null;
  provenance: ProvenanceTag[];
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
      month: 'short',
      day: 'numeric',
      year: 'numeric',
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
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  } catch {
    return dateStr;
  }
}

function getSourceIcon(source: string): string {
  const lower = source.toLowerCase();
  if (lower.includes('ai') || lower.includes('gpt') || lower.includes('claude')) return '🤖';
  if (lower.includes('user') || lower.includes('manual')) return '👤';
  if (lower.includes('api') || lower.includes('integration')) return '🔗';
  if (lower.includes('diagnostic') || lower.includes('lab')) return '🧪';
  if (lower.includes('import') || lower.includes('csv')) return '📥';
  return '📝';
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'text-emerald-400';
  if (confidence >= 0.6) return 'text-amber-400';
  return 'text-red-400';
}

function getConfidenceBg(confidence: number): string {
  if (confidence >= 0.8) return 'bg-emerald-500/20';
  if (confidence >= 0.6) return 'bg-amber-500/20';
  return 'bg-red-500/20';
}

// ============================================================================
// Main Component
// ============================================================================

export function ProvenanceModal({
  isOpen,
  onClose,
  fieldPath,
  fieldLabel,
  value,
  provenance,
}: ProvenanceModalProps) {
  const [showRawJson, setShowRawJson] = useState(false);

  if (!isOpen) return null;

  // Calculate validity information
  const latestProv = provenance[0];
  const validUntil = latestProv?.validForDays && latestProv?.updatedAt
    ? new Date(new Date(latestProv.updatedAt).getTime() + latestProv.validForDays * 24 * 60 * 60 * 1000)
    : null;
  const isExpired = validUntil ? validUntil < new Date() : false;
  const daysUntilExpiry = validUntil
    ? Math.ceil((validUntil.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[85vh] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-800">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-slate-100">{fieldLabel}</h2>
            <p className="mt-1 text-xs text-slate-500 font-mono">{fieldPath}</p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Current Value */}
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Current Value</div>
            <div className="rounded-lg bg-slate-950 border border-slate-800 p-4">
              {value ? (
                <div className="text-sm text-slate-200 whitespace-pre-wrap break-words">{value}</div>
              ) : (
                <div className="text-sm text-slate-500 italic">Not set</div>
              )}
            </div>
          </div>

          {/* Validity Status */}
          {latestProv && (
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Validity Status</div>
              <div className={cn(
                'rounded-lg border p-4 flex items-center gap-4',
                isExpired
                  ? 'bg-red-500/10 border-red-500/30'
                  : daysUntilExpiry !== null && daysUntilExpiry < 7
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : 'bg-slate-950 border-slate-800'
              )}>
                <div className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center text-lg',
                  isExpired ? 'bg-red-500/20' : 'bg-slate-800'
                )}>
                  {isExpired ? '⚠️' : '✓'}
                </div>
                <div className="flex-1">
                  {isExpired ? (
                    <>
                      <div className="text-sm font-medium text-red-300">Expired</div>
                      <div className="text-xs text-slate-500">
                        This data is past its validity period and should be refreshed.
                      </div>
                    </>
                  ) : validUntil ? (
                    <>
                      <div className="text-sm font-medium text-slate-200">
                        Valid for {daysUntilExpiry} more day{daysUntilExpiry !== 1 ? 's' : ''}
                      </div>
                      <div className="text-xs text-slate-500">
                        Expires {formatDate(validUntil.toISOString())}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-sm font-medium text-slate-200">No expiry set</div>
                      <div className="text-xs text-slate-500">
                        This field doesn't have a defined validity period.
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Provenance Chain */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">
                Provenance Chain ({provenance.length} source{provenance.length !== 1 ? 's' : ''})
              </div>
              <button
                onClick={() => setShowRawJson(!showRawJson)}
                className="text-[11px] text-slate-500 hover:text-slate-300 underline"
              >
                {showRawJson ? 'Hide' : 'Show'} raw JSON
              </button>
            </div>

            {showRawJson ? (
              <pre className="rounded-lg bg-slate-950 border border-slate-800 p-4 text-xs text-slate-300 overflow-x-auto">
                {JSON.stringify(provenance, null, 2)}
              </pre>
            ) : (
              <div className="space-y-3">
                {provenance.map((prov, index) => (
                  <ProvenanceEntry
                    key={`${prov.source}-${prov.updatedAt}-${index}`}
                    provenance={prov}
                    isLatest={index === 0}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Provenance Entry Component
// ============================================================================

function ProvenanceEntry({
  provenance,
  isLatest,
}: {
  provenance: ProvenanceTag;
  isLatest: boolean;
}) {
  const confidence = provenance.confidence ?? 0;
  const sourceIcon = getSourceIcon(provenance.source);
  const sourceName = provenance.source.replace(/_/g, ' ');

  return (
    <div className={cn(
      'rounded-lg border p-4',
      isLatest ? 'bg-slate-900 border-slate-700' : 'bg-slate-950 border-slate-800'
    )}>
      <div className="flex items-start gap-3">
        {/* Source Icon */}
        <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-lg flex-shrink-0">
          {sourceIcon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-slate-200 capitalize">{sourceName}</span>
            {isLatest && (
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300 font-medium border border-emerald-500/30">
                Current
              </span>
            )}
          </div>

          {/* Timestamp */}
          {provenance.updatedAt && (
            <div className="mt-1 text-xs text-slate-500">
              {formatDate(provenance.updatedAt)}
              <span className="mx-1.5">·</span>
              {formatRelativeTime(provenance.updatedAt)}
            </div>
          )}

          {/* Metadata Row */}
          <div className="mt-3 flex items-center gap-4 flex-wrap">
            {/* Confidence */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wide text-slate-500">Confidence</span>
              <span className={cn(
                'rounded-full px-2 py-0.5 text-xs font-medium',
                getConfidenceBg(confidence),
                getConfidenceColor(confidence)
              )}>
                {Math.round(confidence * 100)}%
              </span>
            </div>

            {/* Validity Period */}
            {provenance.validForDays && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wide text-slate-500">Valid For</span>
                <span className="text-xs text-slate-400">
                  {provenance.validForDays} day{provenance.validForDays !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>

          {/* Run ID if present */}
          {provenance.runId && (
            <div className="mt-2 text-[10px] text-slate-600 font-mono">
              Run: {provenance.runId}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProvenanceModal;
