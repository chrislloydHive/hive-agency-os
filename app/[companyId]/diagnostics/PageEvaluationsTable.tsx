'use client';

import Link from 'next/link';
import type { PageEvaluationResult } from '@/lib/gap-heavy/types';

interface PageEvaluationsTableProps {
  pageEvaluations: PageEvaluationResult[];
  companyId: string;
}

export function PageEvaluationsTable({
  pageEvaluations,
  companyId,
}: PageEvaluationsTableProps) {
  if (!pageEvaluations || pageEvaluations.length === 0) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4 text-center">
        <p className="text-xs text-slate-400 mb-2">
          No page-level evaluations yet.
        </p>
        <p className="text-[11px] text-slate-500">
          Run Website diagnostics to populate this section.
        </p>
      </div>
    );
  }

  // Show top 5 pages
  const topPages = pageEvaluations.slice(0, 5);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] uppercase tracking-wide text-slate-500">
          Page Evaluations ({pageEvaluations.length})
        </p>
      </div>

      <div className="space-y-2">
        {topPages.map((page, idx) => (
          <PageEvaluationRow
            key={page.url}
            page={page}
            companyId={companyId}
            index={idx}
          />
        ))}
      </div>

      {pageEvaluations.length > 5 && (
        <p className="text-[11px] text-slate-500 mt-2">
          + {pageEvaluations.length - 5} more pages evaluated
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Page Evaluation Row
// ============================================================================

interface PageEvaluationRowProps {
  page: PageEvaluationResult;
  companyId: string;
  index: number;
}

function PageEvaluationRow({ page, companyId, index }: PageEvaluationRowProps) {
  // Extract page path from URL
  const pagePath = extractPagePath(page.url);

  // Determine overall score color
  const scoreColor =
    page.overallScore >= 80
      ? 'text-emerald-400'
      : page.overallScore >= 60
      ? 'text-amber-400'
      : 'text-red-400';

  // Check for high traffic / low conversion
  const sessions = page.ga4Snapshot?.sessions || 0;
  const conversions = page.ga4Snapshot?.conversions || 0;
  const isHighTraffic = sessions > 100;
  const isLowConversion = sessions > 50 && conversions === 0;

  return (
    <div className="rounded-lg border border-slate-800 bg-[#050509]/50 p-3">
      {/* Header: Path + Overall Score */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-200 truncate">
            {pagePath}
          </p>
          {page.pageTitle && (
            <p className="text-[10px] text-slate-500 truncate mt-0.5">
              {page.pageTitle}
            </p>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <p className={`text-sm font-semibold tabular-nums ${scoreColor}`}>
            {page.overallScore}
          </p>
          <p className="text-[9px] text-slate-500">Overall</p>
        </div>
      </div>

      {/* Scores Grid */}
      <div className="grid grid-cols-3 gap-2 mb-2">
        <ScorePill label="Content" score={page.contentScore} />
        <ScorePill label="UX" score={page.uxScore} />
        <ScorePill label="Convert" score={page.conversionScore} />
      </div>

      {/* GA4 Chips */}
      {(isHighTraffic || isLowConversion) && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {isHighTraffic && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-[9px] font-medium text-blue-400">
              <svg
                className="w-2.5 h-2.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
              High traffic ({sessions.toLocaleString()})
            </span>
          )}
          {isLowConversion && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 border border-red-500/20 px-2 py-0.5 text-[9px] font-medium text-red-400">
              <svg
                className="w-2.5 h-2.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              Low conversion
            </span>
          )}
        </div>
      )}

      {/* View Details Link */}
      <Link
        href={`/os/${companyId}/tools/page-evaluator?url=${encodeURIComponent(
          page.url
        )}`}
        className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-emerald-400 transition-colors"
      >
        View details
        <svg
          className="w-3 h-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </Link>
    </div>
  );
}

// ============================================================================
// Score Pill Component
// ============================================================================

interface ScorePillProps {
  label: string;
  score: number;
}

function ScorePill({ label, score }: ScorePillProps) {
  const scoreColor =
    score >= 80
      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
      : score >= 60
      ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
      : 'text-red-400 bg-red-500/10 border-red-500/20';

  return (
    <div
      className={`rounded border px-2 py-1 flex flex-col items-center ${scoreColor}`}
    >
      <p className="text-[9px] text-slate-500">{label}</p>
      <p className="text-xs font-semibold tabular-nums">{score}</p>
    </div>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract readable page path from full URL
 */
function extractPagePath(url: string): string {
  try {
    const urlObj = new URL(url);
    let path = urlObj.pathname;

    // Remove trailing slash
    if (path.endsWith('/') && path.length > 1) {
      path = path.slice(0, -1);
    }

    // Return "/" for homepage
    if (!path || path === '/') {
      return '/';
    }

    return path;
  } catch (e) {
    // If URL parsing fails, return original
    return url;
  }
}
