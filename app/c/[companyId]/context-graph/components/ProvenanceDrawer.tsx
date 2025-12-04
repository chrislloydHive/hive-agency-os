'use client';

// app/c/[companyId]/context-graph/components/ProvenanceDrawer.tsx
// Drawer showing provenance history for a field

import type { ProvenanceTag } from '@/lib/contextGraph/types';

interface ProvenanceDrawerProps {
  path: string;
  provenance: unknown[];
  onClose: () => void;
}

/**
 * Format source name
 */
function formatSource(source: string | undefined): string {
  if (!source) return 'Unknown';
  return source
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Format date
 */
function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return 'Unknown';
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
}

/**
 * Format relative time
 */
function formatRelativeTime(dateStr: string | undefined): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  } catch {
    return '';
  }
}

/**
 * Get source color
 */
function getSourceColor(source: string | undefined): string {
  if (!source) return 'bg-slate-500/20 text-slate-400';

  // Color by source category
  if (source.startsWith('analytics_')) {
    return 'bg-blue-500/20 text-blue-400';
  }
  if (source.includes('lab')) {
    return 'bg-purple-500/20 text-purple-400';
  }
  if (source.includes('gap')) {
    return 'bg-amber-500/20 text-amber-400';
  }
  if (source === 'manual' || source === 'user') {
    return 'bg-emerald-500/20 text-emerald-400';
  }
  if (source === 'brain') {
    return 'bg-pink-500/20 text-pink-400';
  }
  if (source === 'inferred') {
    return 'bg-cyan-500/20 text-cyan-400';
  }

  return 'bg-slate-500/20 text-slate-400';
}

export function ProvenanceDrawer({ path, provenance, onClose }: ProvenanceDrawerProps) {
  const typedProvenance = provenance as ProvenanceTag[];

  // Sort by updatedAt descending
  const sortedProvenance = [...typedProvenance].sort((a, b) => {
    const dateA = new Date(a.updatedAt || 0).getTime();
    const dateB = new Date(b.updatedAt || 0).getTime();
    return dateB - dateA;
  });

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="absolute inset-y-0 right-0 max-w-md w-full bg-slate-900 border-l border-slate-800 shadow-xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Provenance History</h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Path */}
          <div className="mb-6">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
              Field Path
            </label>
            <code className="block text-sm text-slate-300 bg-slate-800 px-3 py-2 rounded-lg font-mono">
              {path}
            </code>
          </div>

          {/* Timeline */}
          <div className="mb-6">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">
              History ({sortedProvenance.length} entries)
            </label>

            {sortedProvenance.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-500">No provenance history available</p>
              </div>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-4 top-6 bottom-6 w-0.5 bg-slate-700" />

                {/* Timeline entries */}
                <div className="space-y-4">
                  {sortedProvenance.map((p, i) => (
                    <div key={i} className="relative pl-10">
                      {/* Timeline dot */}
                      <div className={`absolute left-2.5 top-2 w-3 h-3 rounded-full border-2 border-slate-900 ${
                        i === 0 ? 'bg-amber-500' : 'bg-slate-600'
                      }`} />

                      {/* Entry card */}
                      <div className={`rounded-lg p-4 ${
                        i === 0 ? 'bg-slate-800 border border-slate-700' : 'bg-slate-800/50'
                      }`}>
                        {/* Header */}
                        <div className="flex items-center justify-between mb-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSourceColor(p.source)}`}>
                            {formatSource(p.source)}
                          </span>
                          {i === 0 && (
                            <span className="text-xs font-medium text-amber-400">
                              Current
                            </span>
                          )}
                        </div>

                        {/* Timestamp */}
                        <div className="mb-2">
                          <p className="text-sm text-slate-300">
                            {formatDate(p.updatedAt)}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatRelativeTime(p.updatedAt)}
                          </p>
                        </div>

                        {/* Details */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-slate-500">Confidence:</span>
                            <span className="ml-1 text-slate-300">
                              {Math.round((p.confidence || 0) * 100)}%
                            </span>
                          </div>
                          {p.validForDays && (
                            <div>
                              <span className="text-slate-500">Valid for:</span>
                              <span className="ml-1 text-slate-300">
                                {p.validForDays} days
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Run ID */}
                        {(p.sourceRunId || p.runId) && (
                          <div className="mt-2 text-xs">
                            <span className="text-slate-500">Run ID:</span>
                            <code className="ml-1 text-slate-400 font-mono">
                              {(p.sourceRunId || p.runId || '').slice(0, 20)}...
                            </code>
                          </div>
                        )}

                        {/* Notes */}
                        {p.notes && (
                          <div className="mt-2 pt-2 border-t border-slate-700">
                            <p className="text-xs text-slate-400">{p.notes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-sm font-medium text-slate-300 hover:text-slate-100 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
