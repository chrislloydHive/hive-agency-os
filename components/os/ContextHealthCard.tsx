'use client';

// components/os/ContextHealthCard.tsx
// Context Graph Health Card
//
// Displays comprehensive health/completeness of a company's Context Graph.
// Shows overall score, sub-metrics (completeness, critical coverage, freshness),
// section breakdown, and missing critical fields with deep links.

import { useState, useEffect } from 'react';
import Link from 'next/link';

// ============================================================================
// Types
// ============================================================================

interface SectionScore {
  section: string;
  label: string;
  completeness: number;
  criticalCoverage: number;
  freshness: number;
  totalFields: number;
  populatedFields: number;
  criticalFields: number;
  criticalPopulated: number;
  staleFields: number;
}

interface MissingField {
  path: string;
  label: string;
  section: string;
  primarySources: string[];
}

interface Recommendation {
  action: string;
  section: string;
  path: string;
  priority: 'high' | 'medium' | 'low';
}

interface ContextHealthData {
  // New comprehensive scores
  overallScore?: number;
  completenessScore: number | null;
  criticalCoverageScore?: number;
  freshnessScore?: number;
  confidenceScore?: number;
  severity?: 'healthy' | 'degraded' | 'unhealthy';
  severityLabel?: string;
  sectionScores?: SectionScore[];
  missingCriticalFields?: MissingField[];
  recommendations?: Recommendation[];
  stats?: {
    totalFields: number;
    populatedFields: number;
    criticalFields: number;
    criticalPopulated: number;
    staleFields: number;
    averageConfidence: number;
  };
  // Legacy fields
  domainCoverage: Record<string, number> | null;
  lastUpdated: string | null;
  lastFusionAt: string | null;
  fieldCount: {
    total: number;
    populated: number;
  };
  staleFields: number;
  healthScore?: number;
  healthStatus?: 'healthy' | 'fair' | 'needs_attention' | 'critical';
}

interface ContextHealthCardProps {
  companyId: string;
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getScoreColor(score: number | null): string {
  if (score === null) return 'text-slate-400';
  if (score >= 80) return 'text-emerald-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-red-400';
}

function getScoreBgColor(score: number | null): string {
  if (score === null) return 'bg-slate-500/20';
  if (score >= 80) return 'bg-emerald-500/20';
  if (score >= 50) return 'bg-amber-500/20';
  return 'bg-red-500/20';
}

function getScoreBorderColor(score: number | null): string {
  if (score === null) return 'border-slate-500/30';
  if (score >= 80) return 'border-emerald-500/30';
  if (score >= 50) return 'border-amber-500/30';
  return 'border-red-500/30';
}

function getSeverityConfig(severity: string | undefined): {
  color: string;
  bg: string;
  border: string;
  label: string;
} {
  switch (severity) {
    case 'healthy':
      return {
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/20',
        border: 'border-emerald-500/30',
        label: 'Healthy',
      };
    case 'degraded':
      return {
        color: 'text-amber-400',
        bg: 'bg-amber-500/20',
        border: 'border-amber-500/30',
        label: 'Needs Improvement',
      };
    case 'unhealthy':
    default:
      return {
        color: 'text-red-400',
        bg: 'bg-red-500/20',
        border: 'border-red-500/30',
        label: 'Weak / Incomplete',
      };
  }
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  } catch {
    return 'Unknown';
  }
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

export function ContextHealthCard({ companyId, className = '' }: ContextHealthCardProps) {
  const [healthData, setHealthData] = useState<ContextHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch context health data
  useEffect(() => {
    async function fetchHealth() {
      try {
        setLoading(true);
        const response = await fetch(`/api/os/companies/${companyId}/context-health`);

        if (!response.ok) {
          if (response.status === 404) {
            // Context graph doesn't exist yet - that's OK
            setHealthData(null);
            return;
          }
          throw new Error('Failed to fetch context health');
        }

        const data = await response.json();
        setHealthData(data);
      } catch (err) {
        console.error('[ContextHealthCard] Error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchHealth();
  }, [companyId]);

  // Handle rebuild button click
  const handleRebuild = async () => {
    try {
      setRebuilding(true);
      setError(null);

      const response = await fetch(`/api/os/companies/${companyId}/context-rebuild`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to rebuild context');
      }

      // Re-fetch health data after rebuild
      const healthResponse = await fetch(`/api/os/companies/${companyId}/context-health`);
      if (healthResponse.ok) {
        const data = await healthResponse.json();
        setHealthData(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rebuild failed');
    } finally {
      setRebuilding(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className={`bg-slate-900 border border-slate-800 rounded-xl p-5 ${className}`}>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full border-2 border-slate-600 border-t-slate-400 animate-spin" />
          <span className="text-sm text-slate-400">Loading context health...</span>
        </div>
      </div>
    );
  }

  // No context graph yet or score not available
  if (!healthData || healthData.overallScore === undefined) {
    return (
      <div className={`bg-slate-900 border border-slate-800 rounded-xl p-5 ${className}`}>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">
          Context Health
        </h2>

        <div className="text-center py-4">
          <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
          </div>
          <p className="text-sm text-slate-300 mb-1">No Context Graph Yet</p>
          <p className="text-xs text-slate-500 mb-4">
            Complete Setup to build the company's knowledge graph.
          </p>

          <Link
            href={`/c/${companyId}/brain/setup`}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Start Setup
          </Link>
        </div>

        {error && (
          <p className="text-xs text-red-400 mt-2 text-center">{error}</p>
        )}
      </div>
    );
  }

  // Main view with comprehensive health data
  const { severity } = healthData;
  const severityConfig = getSeverityConfig(severity);
  const overallScore = healthData.overallScore ?? 0;

  // Get sections with critical fields, sorted by critical coverage (lowest first)
  const sectionsWithCritical = (healthData.sectionScores || [])
    .filter(s => s.criticalFields > 0)
    .sort((a, b) => a.criticalCoverage - b.criticalCoverage);

  const weakSections = sectionsWithCritical.filter(s => s.criticalCoverage < 60);

  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-xl overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Context Health
          </h2>
          <button
            onClick={handleRebuild}
            disabled={rebuilding}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-50"
            title="Rebuild context from all diagnostics"
          >
            {rebuilding ? (
              <div className="w-3 h-3 rounded-full border-2 border-slate-500 border-t-slate-300 animate-spin" />
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            Rebuild
          </button>
        </div>

        {/* Overall Score with Severity Badge */}
        <div className="flex items-center gap-4">
          <div className={`flex-shrink-0 w-16 h-16 rounded-lg ${severityConfig.bg} border ${severityConfig.border} flex items-center justify-center`}>
            <span className={`text-2xl font-bold tabular-nums ${severityConfig.color}`}>
              {overallScore}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-sm font-medium ${severityConfig.color}`}>
                {severityConfig.label}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Last updated: {formatRelativeTime(healthData.lastUpdated)}
            </p>
          </div>
        </div>

        {/* Sub-metrics */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          <div className="text-center p-2 rounded-lg bg-slate-800/50">
            <div className={`text-lg font-semibold tabular-nums ${getScoreColor(healthData.completenessScore)}`}>
              {healthData.completenessScore ?? 0}%
            </div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wide">Complete</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-slate-800/50">
            <div className={`text-lg font-semibold tabular-nums ${getScoreColor(healthData.criticalCoverageScore ?? null)}`}>
              {healthData.criticalCoverageScore ?? 0}%
            </div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wide">Critical</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-slate-800/50">
            <div className={`text-lg font-semibold tabular-nums ${getScoreColor(healthData.freshnessScore ?? null)}`}>
              {healthData.freshnessScore ?? 100}%
            </div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wide">Fresh</div>
          </div>
        </div>
      </div>

      {/* Weak Sections Warning */}
      {weakSections.length > 0 && (
        <div className="px-4 pb-3">
          <div className="flex flex-wrap gap-1">
            {weakSections.slice(0, 3).map((section) => (
              <span
                key={section.section}
                className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30"
              >
                {section.label}: {section.criticalCoverage}%
              </span>
            ))}
            {weakSections.length > 3 && (
              <span className="text-xs text-slate-500 px-1">
                +{weakSections.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Missing Critical Fields (top 3) */}
      {healthData.missingCriticalFields && healthData.missingCriticalFields.length > 0 && (
        <div className="px-4 pb-3">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Top Missing</p>
          <div className="space-y-2">
            {healthData.missingCriticalFields.slice(0, 3).map((field) => (
              <div key={field.path} className="text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">{field.label}</span>
                  <span className="text-slate-500">{field.section}</span>
                </div>
                {field.primarySources.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {field.primarySources.slice(0, 2).map((source) => (
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
          </div>
        </div>
      )}

      {/* Footer Links */}
      <div className="px-4 py-3 border-t border-slate-800 flex items-center justify-between">
        <Link
          href={`/c/${companyId}/brain/context`}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-amber-300 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Improve Context
        </Link>
        <Link
          href={`/c/${companyId}/brain/setup`}
          className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Setup
        </Link>
      </div>

      {error && (
        <p className="text-xs text-red-400 px-4 pb-3">{error}</p>
      )}
    </div>
  );
}

export default ContextHealthCard;
