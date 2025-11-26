'use client';

import Link from 'next/link';
import type { CompanyListItem, CompanyStage, CompanyHealth } from '@/lib/os/companies/list';

// ============================================================================
// Types
// ============================================================================

interface CompanyPreviewPanelProps {
  company: CompanyListItem;
  onClose: () => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatLastActivity(dateStr: string | null | undefined): string {
  if (!dateStr) return 'No activity';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  } catch {
    return 'Unknown';
  }
}

function getStageBadgeStyles(stage: CompanyStage): string {
  const styles: Record<CompanyStage, string> = {
    Prospect: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    Client: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    Internal: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    Dormant: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    Lost: 'bg-red-500/10 text-red-400 border-red-500/30',
  };
  return styles[stage] || 'bg-slate-500/10 text-slate-400 border-slate-500/30';
}

function getHealthBadgeStyles(health: CompanyHealth): string {
  const styles: Record<CompanyHealth, string> = {
    Healthy: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    'At Risk': 'bg-red-500/10 text-red-400 border-red-500/30',
    Unknown: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  };
  return styles[health] || 'bg-slate-500/10 text-slate-400 border-slate-500/30';
}

function getScoreColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'text-slate-500';
  if (score >= 70) return 'text-emerald-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-red-400';
}

// ============================================================================
// Component
// ============================================================================

export function CompanyPreviewPanel({ company, onClose }: CompanyPreviewPanelProps) {
  return (
    <div className="hidden lg:block w-[35%] max-w-md bg-slate-900/70 border border-slate-800 rounded-xl p-5 sticky top-6 h-fit">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-slate-100 truncate">
            {company.name}
          </h3>
          {company.domain && (
            <a
              href={company.website || `https://${company.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-amber-500 hover:text-amber-400 truncate block"
            >
              {company.domain} →
            </a>
          )}
        </div>
        <button
          onClick={onClose}
          className="ml-2 text-slate-500 hover:text-slate-300 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Status Badges */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getStageBadgeStyles(
            company.stage
          )}`}
        >
          {company.stage}
        </span>

        {company.stage === 'Client' && (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getHealthBadgeStyles(
              company.health
            )}`}
          >
            {company.health === 'At Risk' && (
              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            {company.health}
          </span>
        )}

        {company.tier && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border bg-amber-500/10 text-amber-400 border-amber-500/30">
            Tier {company.tier}
          </span>
        )}
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-slate-800/50 rounded-lg p-3">
          <div className="text-xs text-slate-500 mb-1">GAP Score</div>
          <div className="text-sm font-medium">
            {company.latestGapScore !== null && company.latestGapScore !== undefined ? (
              <span className={getScoreColor(company.latestGapScore)}>
                {company.latestGapScore}/100
              </span>
            ) : (
              <span className="text-slate-500">No score</span>
            )}
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-lg p-3">
          <div className="text-xs text-slate-500 mb-1">Last Activity</div>
          <div className="text-sm text-slate-200 font-medium">
            {company.lastActivityLabel || formatLastActivity(company.lastActivityAt)}
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-lg p-3">
          <div className="text-xs text-slate-500 mb-1">Owner</div>
          <div className="text-sm text-slate-200 font-medium">
            {company.owner || 'Unassigned'}
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-lg p-3">
          <div className="text-xs text-slate-500 mb-1">Open Work</div>
          <div className="text-sm font-medium">
            {company.openWorkCount > 0 ? (
              <span className="text-blue-400">{company.openWorkCount} items</span>
            ) : (
              <span className="text-slate-500">None</span>
            )}
          </div>
        </div>
      </div>

      {/* Industry if available */}
      {company.industry && (
        <div className="mb-4 text-sm text-slate-400">{company.industry}</div>
      )}

      {/* Suggested Actions */}
      <div className="border-t border-slate-700 pt-4 mb-4">
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
          Suggested Actions
        </h4>
        <div className="space-y-2">
          {company.health === 'At Risk' ? (
            <>
              <SuggestedAction
                icon="alert"
                color="red"
                text="Schedule check-in call"
              />
              <SuggestedAction
                icon="refresh"
                color="red"
                text="Run new GAP assessment"
              />
            </>
          ) : company.stage === 'Prospect' ? (
            <>
              <SuggestedAction
                icon="chart"
                color="blue"
                text="Run full GAP assessment"
              />
              <SuggestedAction
                icon="document"
                color="blue"
                text="Create proposal"
              />
            </>
          ) : !company.lastActivityAt || !company.latestGapScore ? (
            <SuggestedAction
              icon="play"
              color="slate"
              text="Run GAP assessment to get started"
            />
          ) : company.openWorkCount === 0 ? (
            <SuggestedAction
              icon="plus"
              color="slate"
              text="Add work items from latest assessment"
            />
          ) : (
            <p className="text-sm text-slate-500">No urgent actions needed</p>
          )}
        </div>
      </div>

      {/* Diagnostics Summary (if available) */}
      {company.latestDiagnosticsSummary && (
        <div className="border-t border-slate-700 pt-4 mb-4">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Latest Diagnostics
          </h4>
          <p className="text-sm text-slate-300 line-clamp-3">
            {company.latestDiagnosticsSummary}
          </p>
        </div>
      )}

      {/* CTA Button */}
      <Link
        href={`/c/${company.id}`}
        className="block w-full text-center px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium rounded-lg transition-colors"
      >
        Open Company
      </Link>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

interface SuggestedActionProps {
  icon: 'alert' | 'refresh' | 'chart' | 'document' | 'play' | 'plus';
  color: 'red' | 'blue' | 'slate' | 'amber';
  text: string;
}

function SuggestedAction({ icon, color, text }: SuggestedActionProps) {
  const colorClass = {
    red: 'text-red-400',
    blue: 'text-blue-400',
    slate: 'text-slate-400',
    amber: 'text-amber-400',
  }[color];

  const iconSvg = {
    alert: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    ),
    refresh: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    ),
    chart: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    ),
    document: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    ),
    play: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
      />
    ),
    plus: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
      />
    ),
  }[icon];

  return (
    <div className="flex items-start gap-2 text-sm text-slate-300">
      <svg
        className={`w-4 h-4 mt-0.5 ${colorClass}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        {iconSvg}
      </svg>
      <span>{text}</span>
    </div>
  );
}
