'use client';

// components/os/overview/KeySignals.tsx
// Key Signals - Collapsed Diagnostic Summary
//
// Moves diagnostics below the fold and collapses them.
// Groups into 3 simple buckets:
// 1. What's working
// 2. What's not working
// 3. Key risks
//
// No charts by default. Just short bullets.

import { useState } from 'react';
import Link from 'next/link';
import {
  ChevronDown,
  ChevronUp,
  Activity,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import type { RecentDiagnostic } from '@/components/os/blueprint/types';
import type { CompanyAlert } from '@/lib/os/companies/alerts';

// ============================================================================
// Types
// ============================================================================

export interface KeySignal {
  id: string;
  text: string;
  source?: string;
}

export interface KeySignalsProps {
  companyId: string;
  /** What's working well */
  strengths: KeySignal[];
  /** What needs improvement */
  weaknesses: KeySignal[];
  /** Key risks to address */
  risks: KeySignal[];
  /** Force expanded by default */
  forceExpanded?: boolean;
  /** Latest diagnostic score for summary */
  latestScore?: number | null;
  /** Has diagnostics been run */
  hasDiagnostics?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function KeySignals({
  companyId,
  strengths,
  weaknesses,
  risks,
  forceExpanded = false,
  latestScore,
  hasDiagnostics = false,
}: KeySignalsProps) {
  const hasRisks = risks.length > 0;
  const [isExpanded, setIsExpanded] = useState(forceExpanded || hasRisks);

  // Summary counts
  const totalSignals = strengths.length + weaknesses.length + risks.length;
  const summaryText = hasDiagnostics
    ? `${strengths.length} strengths · ${weaknesses.length} areas to improve${risks.length > 0 ? ` · ${risks.length} risks` : ''}`
    : 'No diagnostics run yet';

  return (
    <div className="bg-slate-900/30 border border-slate-800 rounded-xl overflow-hidden">
      {/* Header (always visible) */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-700/50 flex items-center justify-center">
            <Activity className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-white">Key Signals</h3>
              {latestScore !== null && latestScore !== undefined && (
                <span className={`
                  px-2 py-0.5 text-xs font-medium rounded-full
                  ${latestScore >= 70 ? 'bg-emerald-500/20 text-emerald-400' :
                    latestScore >= 50 ? 'bg-amber-500/20 text-amber-400' :
                    'bg-red-500/20 text-red-400'}
                `}>
                  {latestScore}%
                </span>
              )}
              {hasRisks && (
                <span className="px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded-full">
                  {risks.length} risk{risks.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">{summaryText}</p>
          </div>
        </div>

        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-slate-800">
          {!hasDiagnostics ? (
            <div className="p-6 text-center">
              <p className="text-sm text-slate-500 mb-3">
                Run diagnostics to see what's working and what needs attention.
              </p>
              <Link
                href={`/c/${companyId}/diagnostics`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg transition-colors"
              >
                Run Diagnostics
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : totalSignals === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm text-slate-500">
                No specific signals identified. View full diagnostics for details.
              </p>
              <Link
                href={`/c/${companyId}/diagnostics`}
                className="inline-flex items-center gap-2 px-4 py-2 mt-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg transition-colors"
              >
                View Full Diagnostics
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <div className="p-4 grid md:grid-cols-3 gap-4">
              {/* What's Working */}
              <SignalBucket
                title="What's Working"
                icon={<CheckCircle className="w-4 h-4 text-emerald-400" />}
                signals={strengths}
                emptyText="No strengths identified"
                colorClass="text-emerald-400"
              />

              {/* What's Not Working */}
              <SignalBucket
                title="Needs Attention"
                icon={<XCircle className="w-4 h-4 text-amber-400" />}
                signals={weaknesses}
                emptyText="No issues identified"
                colorClass="text-amber-400"
              />

              {/* Key Risks */}
              <SignalBucket
                title="Key Risks"
                icon={<AlertTriangle className="w-4 h-4 text-red-400" />}
                signals={risks}
                emptyText="No risks identified"
                colorClass="text-red-400"
              />
            </div>
          )}

          {/* Footer CTA */}
          {hasDiagnostics && totalSignals > 0 && (
            <div className="p-3 bg-slate-800/30 border-t border-slate-800">
              <Link
                href={`/c/${companyId}/diagnostics`}
                className="text-xs text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-1"
              >
                View full diagnostics
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Signal Bucket Sub-component
// ============================================================================

function SignalBucket({
  title,
  icon,
  signals,
  emptyText,
  colorClass,
}: {
  title: string;
  icon: React.ReactNode;
  signals: KeySignal[];
  emptyText: string;
  colorClass: string;
}) {
  return (
    <div>
      <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-2">
        {icon}
        {title}
      </h4>
      {signals.length > 0 ? (
        <ul className="space-y-1.5">
          {signals.slice(0, 3).map((signal) => (
            <li key={signal.id} className="text-sm text-slate-300 flex items-start gap-2">
              <span className={`mt-1.5 w-1 h-1 rounded-full flex-shrink-0 ${colorClass.replace('text-', 'bg-')}`} />
              <span>{signal.text}</span>
            </li>
          ))}
          {signals.length > 3 && (
            <li className="text-xs text-slate-500">
              +{signals.length - 3} more
            </li>
          )}
        </ul>
      ) : (
        <p className="text-sm text-slate-500 italic">{emptyText}</p>
      )}
    </div>
  );
}

// ============================================================================
// Helper: Extract Signals from Diagnostics
// ============================================================================

export function extractKeySignals(
  diagnostics: RecentDiagnostic[],
  alerts: CompanyAlert[]
): { strengths: KeySignal[]; weaknesses: KeySignal[]; risks: KeySignal[] } {
  const strengths: KeySignal[] = [];
  const weaknesses: KeySignal[] = [];
  const risks: KeySignal[] = [];

  // Extract from diagnostics scores
  diagnostics.forEach((diag) => {
    if (diag.status !== 'complete' || diag.score === null) return;

    if (diag.score >= 80) {
      strengths.push({
        id: `diag-${diag.id}`,
        text: `${diag.toolLabel}: Strong performance (${diag.score}%)`,
        source: diag.toolLabel,
      });
    } else if (diag.score < 50) {
      weaknesses.push({
        id: `diag-${diag.id}`,
        text: `${diag.toolLabel}: Needs improvement (${diag.score}%)`,
        source: diag.toolLabel,
      });
    }
  });

  // Extract from alerts
  alerts.forEach((alert) => {
    if (alert.severity === 'critical') {
      risks.push({
        id: `alert-${alert.id}`,
        text: alert.title,
        source: 'Alert',
      });
    } else if (alert.severity === 'warning') {
      weaknesses.push({
        id: `alert-${alert.id}`,
        text: alert.title,
        source: 'Alert',
      });
    }
  });

  return { strengths, weaknesses, risks };
}
