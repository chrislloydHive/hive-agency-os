'use client';

// components/intelligence/OvernightSummary.tsx
// Component for displaying overnight activity summary

import type { OvernightSummary as OvernightSummaryType } from '@/lib/intelligence/types';

interface OvernightSummaryProps {
  summary: OvernightSummaryType;
}

export function OvernightSummary({ summary }: OvernightSummaryProps) {
  return (
    <div className="bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border border-purple-500/30 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-purple-500/20">
          <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
            />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-100">What Happened Overnight</h2>
          <p className="text-sm text-slate-400">Activity since yesterday</p>
        </div>
      </div>

      {/* Headline */}
      <p className="text-slate-200 mb-4">{summary.headline}</p>

      {/* Activity Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-slate-800/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-emerald-400">{summary.workCompleted}</div>
          <div className="text-xs text-slate-400">Work Completed</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-blue-400">{summary.newWorkCreated}</div>
          <div className="text-xs text-slate-400">Work Created</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-amber-400">{summary.diagnosticsRun}</div>
          <div className="text-xs text-slate-400">Diagnostics</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-purple-400">{summary.newOpportunities}</div>
          <div className="text-xs text-slate-400">Opportunities</div>
        </div>
      </div>

      {/* Highlights */}
      {summary.highlights.length > 0 && (
        <div className="space-y-2">
          {summary.highlights.map((highlight, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2 text-sm text-slate-300"
            >
              <span className="text-purple-400 mt-0.5">-</span>
              <span>{highlight}</span>
            </div>
          ))}
        </div>
      )}

      {/* Risk Changes */}
      {summary.atRiskChanges.length > 0 && (
        <div className="mt-4 pt-4 border-t border-purple-500/20">
          <h4 className="text-sm font-medium text-red-400 mb-2">At-Risk Changes</h4>
          <div className="space-y-1">
            {summary.atRiskChanges.map((change, idx) => (
              <div key={idx} className="text-sm text-slate-400">
                {change}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GA4/GSC Shifts */}
      {(summary.ga4Shifts.length > 0 || summary.gscSignals.length > 0) && (
        <div className="mt-4 pt-4 border-t border-purple-500/20">
          <h4 className="text-sm font-medium text-blue-400 mb-2">Analytics Signals</h4>
          <div className="space-y-1">
            {summary.ga4Shifts.map((shift, idx) => (
              <div key={`ga4-${idx}`} className="text-sm text-slate-400 flex items-center gap-2">
                <span className="text-xs px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded">GA4</span>
                {shift}
              </div>
            ))}
            {summary.gscSignals.map((signal, idx) => (
              <div key={`gsc-${idx}`} className="text-sm text-slate-400 flex items-center gap-2">
                <span className="text-xs px-1.5 py-0.5 bg-green-500/20 text-green-300 rounded">GSC</span>
                {signal}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default OvernightSummary;
