'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { DiagnosticArea, DiagnosticIssue } from "@/lib/airtable/fullReports";
import type { DiagnosticModuleKey, PageEvaluationResult } from '@/lib/gap-heavy/types';
import { PageEvaluationsTable } from './PageEvaluationsTable';

interface DiagnosticAreaCardProps {
  label: string;
  area?: DiagnosticArea;
  companyId: string;
  moduleKey: DiagnosticModuleKey;
  pageEvaluations?: PageEvaluationResult[];
}

export function DiagnosticAreaCard({
  label,
  area,
  companyId,
  moduleKey,
  pageEvaluations,
}: DiagnosticAreaCardProps) {
  const [isRunning, setIsRunning] = useState(false);
  const score = area?.score;
  const summary = area?.summary;
  const issues = area?.issues ?? [];

  const statusColor =
    score == null
      ? "bg-slate-700"
      : score >= 80
      ? "bg-emerald-500"
      : score >= 60
      ? "bg-amber-400"
      : "bg-red-500";

  const handleRunModule = async () => {
    setIsRunning(true);

    try {
      const response = await fetch('/api/os/diagnostics/run-heavy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          modules: [moduleKey],
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to run module');
      }

      // Refresh page after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Error running module:', error);
      setIsRunning(false);
    }
  };

  return (
    <div className="flex flex-col rounded-xl border border-slate-800 bg-[#050509]/80 p-4">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
          {summary && (
            <p className="mt-1 text-xs text-slate-300 line-clamp-2">{summary}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${statusColor}`} />
            <span className="text-xs text-slate-400">Score</span>
          </div>
          <span className="text-lg font-semibold tabular-nums">
            {score != null ? score : "—"}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-2 mb-3 flex gap-2">
        <button
          onClick={handleRunModule}
          disabled={isRunning}
          className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
            isRunning
              ? 'bg-slate-700 text-slate-300 cursor-wait'
              : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 hover:text-slate-300 border border-slate-700/50'
          }`}
        >
          {isRunning ? (
            <span className="flex items-center justify-center gap-1.5">
              <svg
                className="animate-spin h-3 w-3"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Running...
            </span>
          ) : (
            `↻ Run ${label}`
          )}
        </button>

        <Link
          href={`/c/${companyId}/diagnostics/${moduleKey}`}
          className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/30 whitespace-nowrap"
        >
          View Details →
        </Link>
      </div>

      {issues.length > 0 ? (
        <div className="space-y-2 text-xs">
          {issues.slice(0, 4).map((issue, idx) => (
            <div
              key={issue.id ?? `${label}-${idx}`}
              className="rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2"
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="font-medium text-slate-100">
                  {issue.title ?? "Issue"}
                </p>
                {issue.severity && (
                  <SeverityPill severity={issue.severity} />
                )}
              </div>
              {issue.suggestion && (
                <p className="text-[11px] text-slate-400 line-clamp-2">
                  {issue.suggestion}
                </p>
              )}
            </div>
          ))}
          {issues.length > 4 && (
            <p className="text-[11px] text-slate-500">
              + {issues.length - 4} more issues in this area
            </p>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-slate-500">
          No issues listed for this area in the diagnostics JSON.
        </p>
      )}

      {/* Page Evaluations (Website/UX module only) */}
      {moduleKey === 'website' && pageEvaluations && (
        <div className="mt-4 pt-4 border-t border-slate-800">
          <PageEvaluationsTable
            pageEvaluations={pageEvaluations}
            companyId={companyId}
          />
        </div>
      )}
    </div>
  );
}

function SeverityPill({ severity }: { severity: DiagnosticIssue["severity"] }) {
  if (!severity) return null;
  const label = severity.charAt(0).toUpperCase() + severity.slice(1);

  const classes =
    severity === "critical"
      ? "bg-red-500/20 text-red-300 border-red-500/50"
      : severity === "high"
      ? "bg-orange-500/20 text-orange-300 border-orange-500/50"
      : severity === "medium"
      ? "bg-amber-500/20 text-amber-200 border-amber-500/40"
      : severity === "low"
      ? "bg-sky-500/20 text-sky-200 border-sky-500/40"
      : "bg-slate-700/50 text-slate-200 border-slate-600";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${classes}`}
    >
      {label}
    </span>
  );
}
