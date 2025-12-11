'use client';

// components/qbr/QBREmptyState.tsx
// Empty state component for QBR when insufficient data is available

import Link from 'next/link';
import {
  FileText,
  Activity,
  ClipboardList,
  Brain,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';

interface QBREmptyStateProps {
  companyId: string;
  reason: 'no-diagnostics' | 'no-findings' | 'no-data' | 'first-time';
  diagnosticsCount?: number;
  findingsCount?: number;
  workItemsCount?: number;
  onGenerate?: () => void;
  generating?: boolean;
}

export function QBREmptyState({
  companyId,
  reason,
  diagnosticsCount = 0,
  findingsCount = 0,
  workItemsCount = 0,
  onGenerate,
  generating = false,
}: QBREmptyStateProps) {
  // Determine what actions are needed
  const needsDiagnostics = diagnosticsCount < 2;
  const needsFindings = findingsCount < 3;
  const needsWork = workItemsCount === 0;

  const readinessItems = [
    {
      label: 'Run at least 2 diagnostic labs',
      done: diagnosticsCount >= 2,
      count: diagnosticsCount,
      target: 2,
      link: `/c/${companyId}/diagnostics`,
    },
    {
      label: 'Generate diagnostic findings',
      done: findingsCount >= 3,
      count: findingsCount,
      target: 3,
      link: `/c/${companyId}/plan`,
    },
    {
      label: 'Create work items from plan',
      done: workItemsCount > 0,
      count: workItemsCount,
      target: 1,
      link: `/c/${companyId}/work`,
    },
  ];

  const readinessScore = readinessItems.filter(item => item.done).length;
  const canGenerate = readinessScore >= 1;

  return (
    <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/50 p-8 sm:p-12">
      <div className="max-w-xl mx-auto text-center">
        {/* Icon */}
        <div className="inline-flex p-4 rounded-full bg-slate-800 mb-6">
          {reason === 'first-time' ? (
            <FileText className="w-10 h-10 text-slate-400" />
          ) : (
            <AlertTriangle className="w-10 h-10 text-amber-400" />
          )}
        </div>

        {/* Title */}
        <h2 className="text-xl font-semibold text-slate-100 mb-3">
          {reason === 'first-time'
            ? 'Generate Your First QBR'
            : reason === 'no-diagnostics'
            ? 'Run Diagnostics First'
            : reason === 'no-findings'
            ? 'Generate Diagnostic Findings'
            : 'Get Started with QBR'}
        </h2>

        {/* Description */}
        <p className="text-sm text-slate-400 mb-8 max-w-md mx-auto">
          {reason === 'first-time'
            ? 'Create an AI-powered quarterly business review to understand your marketing health, identify wins and challenges, and get prioritized recommendations.'
            : reason === 'no-diagnostics'
            ? 'QBR requires diagnostic data to generate meaningful insights. Run at least 2 diagnostic labs to get started.'
            : reason === 'no-findings'
            ? 'Generate findings from your diagnostic runs to populate the QBR with actionable insights.'
            : 'Complete the steps below to generate a comprehensive QBR.'}
        </p>

        {/* Readiness checklist */}
        <div className="bg-slate-800/50 rounded-lg p-5 mb-8 text-left">
          <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-4">
            QBR Readiness ({readinessScore}/{readinessItems.length})
          </h3>
          <ul className="space-y-3">
            {readinessItems.map((item, idx) => (
              <li key={idx} className="flex items-center gap-3">
                {item.done ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-slate-600 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <span className={`text-sm ${item.done ? 'text-slate-300' : 'text-slate-400'}`}>
                    {item.label}
                  </span>
                  {!item.done && (
                    <span className="text-xs text-slate-500 ml-2">
                      ({item.count}/{item.target})
                    </span>
                  )}
                </div>
                {!item.done && (
                  <Link
                    href={item.link}
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    Go <ArrowRight className="w-3 h-3" />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Quick links */}
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          {needsDiagnostics && (
            <Link
              href={`/c/${companyId}/diagnostics`}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors"
            >
              <Activity className="w-4 h-4" />
              Run Diagnostics
            </Link>
          )}
          {needsFindings && (
            <Link
              href={`/c/${companyId}/plan`}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
            >
              <Brain className="w-4 h-4" />
              View Plan
            </Link>
          )}
          {needsWork && (
            <Link
              href={`/c/${companyId}/work`}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
            >
              <ClipboardList className="w-4 h-4" />
              Manage Work
            </Link>
          )}
        </div>

        {/* Generate button */}
        {canGenerate && onGenerate && (
          <button
            onClick={onGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-6 py-3 mx-auto rounded-lg text-sm font-semibold bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white shadow-lg shadow-blue-500/25 transition-colors disabled:opacity-50"
          >
            {generating ? (
              <>
                <Sparkles className="w-4 h-4 animate-pulse" />
                Generating QBR...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate QBR Anyway
              </>
            )}
          </button>
        )}

        {canGenerate && onGenerate && (
          <p className="text-xs text-slate-500 mt-3">
            You can generate a QBR with limited data, but results will be more useful with more diagnostics.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Helper function to determine empty state reason
 */
export function getQBREmptyStateReason(
  diagnosticsCount: number,
  findingsCount: number,
  workItemsCount: number
): 'no-diagnostics' | 'no-findings' | 'no-data' | 'first-time' {
  if (diagnosticsCount === 0 && findingsCount === 0 && workItemsCount === 0) {
    return 'first-time';
  }
  if (diagnosticsCount === 0) {
    return 'no-diagnostics';
  }
  if (findingsCount === 0) {
    return 'no-findings';
  }
  return 'no-data';
}
