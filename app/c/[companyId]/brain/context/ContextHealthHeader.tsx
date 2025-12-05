// app/c/[companyId]/brain/context/ContextHealthHeader.tsx
// Compact Context Health Header for Brain → Context page
//
// Displays a compact health summary with:
// - Overall score and severity label
// - Sub-metrics (completeness, critical coverage, freshness)
// - Weak sections badges
// - Missing critical fields checklist

'use client';

import Link from 'next/link';
import type { ContextHealthScore, ContextSeverity } from '@/lib/contextGraph/health';

// ============================================================================
// Types
// ============================================================================

interface ContextHealthHeaderProps {
  healthScore: ContextHealthScore;
  companyId: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getSeverityConfig(severity: ContextSeverity): {
  color: string;
  bg: string;
  border: string;
  label: string;
} {
  switch (severity) {
    case 'healthy':
      return {
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/30',
        label: 'Healthy',
      };
    case 'degraded':
      return {
        color: 'text-amber-400',
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/30',
        label: 'Needs Improvement',
      };
    case 'unhealthy':
    default:
      return {
        color: 'text-red-400',
        bg: 'bg-red-500/10',
        border: 'border-red-500/30',
        label: 'Weak / Incomplete',
      };
  }
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-red-400';
}

function getSourcePath(source: string, companyId: string): string {
  const paths: Record<string, string> = {
    Setup: `/c/${companyId}/brain/setup`,
    GAP: `/c/${companyId}/gap`,
    GAPHeavy: `/c/${companyId}/gap`,
    AudienceLab: `/c/${companyId}/diagnostics/audience`,
    BrandLab: `/c/${companyId}/diagnostics/brand`,
    CreativeLab: `/c/${companyId}/labs/creative`,
    MediaLab: `/c/${companyId}/diagnostics/media`,
    WebsiteLab: `/c/${companyId}/diagnostics/website-lab`,
  };
  return paths[source] || `/c/${companyId}/brain/setup`;
}

function getSourceLabel(source: string): string {
  const labels: Record<string, string> = {
    Setup: 'Setup',
    GAP: 'GAP',
    GAPHeavy: 'GAP Heavy',
    AudienceLab: 'Audience Lab',
    BrandLab: 'Brand Lab',
    CreativeLab: 'Creative Lab',
    MediaLab: 'Media Lab',
    WebsiteLab: 'Website Lab',
  };
  return labels[source] || source;
}

// ============================================================================
// Main Component
// ============================================================================

export function ContextHealthHeader({ healthScore, companyId }: ContextHealthHeaderProps) {
  const severityConfig = getSeverityConfig(healthScore.severity);

  // Get weak sections (< 60% critical coverage)
  const weakSections = healthScore.sectionScores
    .filter(s => s.criticalFields > 0 && s.criticalCoverage < 60)
    .sort((a, b) => a.criticalCoverage - b.criticalCoverage);

  return (
    <div className={`rounded-lg border ${severityConfig.border} ${severityConfig.bg} p-4`}>
      {/* Main Stats Row */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Overall Score */}
        <div className="flex items-center gap-3">
          <div className={`text-3xl font-bold tabular-nums ${severityConfig.color}`}>
            {healthScore.overallScore}
          </div>
          <div>
            <div className={`text-sm font-medium ${severityConfig.color}`}>
              Context Health
            </div>
            <div className="text-xs text-slate-400">
              {severityConfig.label}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2 ml-auto">
          <Link
            href={`/c/${companyId}/brain/context?mode=editor`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Edit Context
          </Link>
          <Link
            href={`/c/${companyId}/brain/context?view=explorer`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            Explorer
          </Link>
        </div>

        {/* Divider */}
        <div className="h-10 w-px bg-slate-700/50 hidden sm:block" />

        {/* Sub-metrics */}
        <div className="flex items-center gap-4 text-xs">
          <div className="text-center">
            <div className={`text-lg font-semibold tabular-nums ${getScoreColor(healthScore.completenessScore)}`}>
              {healthScore.completenessScore}%
            </div>
            <div className="text-slate-500 uppercase tracking-wide">Complete</div>
          </div>
          <div className="text-center">
            <div className={`text-lg font-semibold tabular-nums ${getScoreColor(healthScore.criticalCoverageScore)}`}>
              {healthScore.criticalCoverageScore}%
            </div>
            <div className="text-slate-500 uppercase tracking-wide">Critical</div>
          </div>
          <div className="text-center">
            <div className={`text-lg font-semibold tabular-nums ${getScoreColor(healthScore.freshnessScore)}`}>
              {healthScore.freshnessScore}%
            </div>
            <div className="text-slate-500 uppercase tracking-wide">Fresh</div>
          </div>
        </div>

        {/* Divider */}
        {weakSections.length > 0 && (
          <div className="h-10 w-px bg-slate-700/50 hidden md:block" />
        )}

        {/* Weak Sections Badges */}
        {weakSections.length > 0 && (
          <div className="flex-1 min-w-0">
            <div className="text-xs text-slate-500 mb-1">Weak sections:</div>
            <div className="flex flex-wrap gap-1">
              {weakSections.slice(0, 4).map((section) => (
                <span
                  key={section.section}
                  className={`text-xs px-2 py-0.5 rounded ${
                    section.criticalCoverage < 30
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {section.label}: {section.criticalCoverage}%
                </span>
              ))}
              {weakSections.length > 4 && (
                <span className="text-xs text-slate-500">
                  +{weakSections.length - 4} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Missing Critical Fields Checklist */}
      {healthScore.missingCriticalFields.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-700/50">
          <div className="text-xs text-slate-400 mb-2">
            Missing critical fields ({healthScore.missingCriticalFields.length}):
          </div>
          <div className="flex flex-wrap gap-2">
            {healthScore.missingCriticalFields.slice(0, 6).map((field) => (
              <div
                key={field.path}
                className="flex items-center gap-2 text-xs bg-slate-800/50 rounded px-2 py-1"
              >
                <span className="text-slate-300">{field.label}</span>
                {field.primarySources.length > 0 && (
                  <div className="flex gap-1">
                    {field.primarySources.slice(0, 1).map((source) => (
                      <Link
                        key={source}
                        href={getSourcePath(source, companyId)}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                      >
                        {getSourceLabel(source)}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {healthScore.missingCriticalFields.length > 6 && (
              <span className="text-xs text-slate-500 self-center">
                +{healthScore.missingCriticalFields.length - 6} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
