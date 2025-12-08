'use client';

// app/c/[companyId]/findings/FindingsSummaryStrip.tsx
// Summary strip showing finding counts by severity, lab, and conversion status

import type { FindingsSummary } from '@/lib/os/findings/companyFindings';

// ============================================================================
// Types
// ============================================================================

interface FindingsSummaryStripProps {
  summary: FindingsSummary | null;
  loading: boolean;
}

// ============================================================================
// Severity Badge Colors
// ============================================================================

const severityColors: Record<string, { bg: string; text: string; ring: string }> = {
  critical: { bg: 'bg-red-500/20', text: 'text-red-400', ring: 'ring-red-500/30' },
  high: { bg: 'bg-orange-500/20', text: 'text-orange-400', ring: 'ring-orange-500/30' },
  medium: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', ring: 'ring-yellow-500/30' },
  low: { bg: 'bg-slate-500/20', text: 'text-slate-400', ring: 'ring-slate-500/30' },
};

// ============================================================================
// Component
// ============================================================================

export function FindingsSummaryStrip({ summary, loading }: FindingsSummaryStripProps) {
  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <div className="flex items-center gap-6 animate-pulse">
          <div className="h-12 w-24 bg-slate-800 rounded" />
          <div className="h-8 w-px bg-slate-800" />
          <div className="flex gap-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-8 w-16 bg-slate-800 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  // Order severities for display
  const severityOrder = ['critical', 'high', 'medium', 'low'];
  const orderedSeverities = severityOrder
    .filter(s => summary.bySeverity[s] > 0)
    .map(s => ({ severity: s, count: summary.bySeverity[s] }));

  // Get top labs by count
  const topLabs = Object.entries(summary.byLab)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([lab, count]) => ({ lab, count }));

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
      <div className="flex flex-wrap items-center gap-6">
        {/* Total Findings */}
        <div className="flex flex-col">
          <span className="text-3xl font-semibold text-white">{summary.total}</span>
          <span className="text-xs text-slate-400 uppercase tracking-wide">Total Findings</span>
        </div>

        {/* Divider */}
        <div className="h-12 w-px bg-slate-800" />

        {/* Severity Badges */}
        <div className="flex flex-wrap gap-2">
          {orderedSeverities.map(({ severity, count }) => {
            const colors = severityColors[severity] || severityColors.low;
            return (
              <span
                key={severity}
                className={`
                  inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium
                  ${colors.bg} ${colors.text} ring-1 ${colors.ring}
                `}
              >
                <span className="capitalize">{severity}</span>
                <span className="opacity-80">({count})</span>
              </span>
            );
          })}
        </div>

        {/* Divider */}
        {topLabs.length > 0 && <div className="h-12 w-px bg-slate-800" />}

        {/* Lab Badges */}
        {topLabs.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {topLabs.map(({ lab, count }) => (
              <span
                key={lab}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/20"
              >
                <span className="capitalize">{lab}</span>
                <span className="opacity-80">({count})</span>
              </span>
            ))}
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Conversion Status */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-slate-400">
              {summary.converted} converted
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-500" />
            <span className="text-slate-400">
              {summary.unconverted} pending
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
