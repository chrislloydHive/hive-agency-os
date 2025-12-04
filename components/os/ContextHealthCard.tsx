'use client';

// components/os/ContextHealthCard.tsx
// Context Graph Health Card
//
// Displays the health/completeness of a company's Context Graph.
// Shows domain coverage, freshness, and a rebuild button.

import { useState, useEffect } from 'react';

// ============================================================================
// Types
// ============================================================================

interface NeedsRefreshFlag {
  domain: string;
  field: string;
  reason: 'missing' | 'stale' | 'low_confidence' | 'expired';
  freshness?: number;
}

interface ContextHealthData {
  completenessScore: number | null;
  domainCoverage: Record<string, number> | null;
  lastUpdated: string | null;
  lastFusionAt: string | null;
  fieldCount: {
    total: number;
    populated: number;
  };
  staleFields: number;
  // New fields from contextHealth module
  healthScore?: number;
  healthStatus?: 'healthy' | 'fair' | 'needs_attention' | 'critical';
  needsRefresh?: NeedsRefreshFlag[];
}

interface ContextHealthCardProps {
  companyId: string;
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getHealthColor(score: number | null): string {
  if (score === null) return 'text-slate-400';
  if (score >= 70) return 'text-emerald-400';
  if (score >= 40) return 'text-amber-400';
  return 'text-red-400';
}

function getHealthBgColor(score: number | null): string {
  if (score === null) return 'bg-slate-500/20';
  if (score >= 70) return 'bg-emerald-500/20';
  if (score >= 40) return 'bg-amber-500/20';
  return 'bg-red-500/20';
}

function getHealthLabel(score: number | null): string {
  if (score === null) return 'Not initialized';
  if (score >= 70) return 'Good coverage';
  if (score >= 40) return 'Partial coverage';
  return 'Needs data';
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

      const result = await response.json();

      // Refresh health data after rebuild
      setHealthData({
        completenessScore: result.graph?.meta?.completenessScore ?? null,
        domainCoverage: result.graph?.meta?.domainCoverage ?? null,
        lastUpdated: result.graph?.meta?.updatedAt ?? null,
        lastFusionAt: result.graph?.meta?.lastFusionAt ?? null,
        fieldCount: {
          total: result.fieldsUpdated ?? 0,
          populated: result.fieldsUpdated ?? 0,
        },
        staleFields: 0,
      });
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

  // No context graph yet
  if (!healthData) {
    return (
      <div className={`bg-slate-900 border border-slate-800 rounded-xl p-5 ${className}`}>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">
          Context Graph
        </h2>

        <div className="text-center py-4">
          <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
          </div>
          <p className="text-sm text-slate-300 mb-1">No Context Graph Yet</p>
          <p className="text-xs text-slate-500 mb-4">
            Run diagnostics to build the company's knowledge graph.
          </p>

          <button
            onClick={handleRebuild}
            disabled={rebuilding}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {rebuilding ? (
              <>
                <div className="w-3 h-3 rounded-full border-2 border-blue-400/30 border-t-blue-400 animate-spin" />
                Building...
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Initialize Context Graph
              </>
            )}
          </button>
        </div>

        {error && (
          <p className="text-xs text-red-400 mt-2 text-center">{error}</p>
        )}
      </div>
    );
  }

  // Main view with health data
  // Prefer new healthScore if available, fall back to completenessScore
  const score = healthData.healthScore ?? healthData.completenessScore;
  const healthColor = getHealthColor(score);
  const healthBg = getHealthBgColor(score);
  const healthLabel = healthData.healthStatus
    ? healthData.healthStatus.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())
    : getHealthLabel(score);

  // Get top domains by coverage
  const sortedDomains = healthData.domainCoverage
    ? Object.entries(healthData.domainCoverage)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
    : [];

  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-xl p-5 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
          Context Graph
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

      {/* Health Score */}
      <div className="flex items-center gap-4 mb-4">
        <div className={`flex-shrink-0 w-16 h-16 rounded-lg ${healthBg} flex items-center justify-center`}>
          <span className={`text-2xl font-bold tabular-nums ${healthColor}`}>
            {score !== null ? `${score}%` : '—'}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${healthColor}`}>{healthLabel}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Last updated: {formatRelativeTime(healthData.lastUpdated)}
          </p>
          {(healthData.needsRefresh && healthData.needsRefresh.length > 0) ? (
            <p className="text-xs text-amber-400 mt-0.5">
              {healthData.needsRefresh.length} areas need attention
            </p>
          ) : healthData.staleFields > 0 && (
            <p className="text-xs text-amber-400 mt-0.5">
              {healthData.staleFields} stale fields need refresh
            </p>
          )}
        </div>
      </div>

      {/* Domain Coverage */}
      {sortedDomains.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Domain Coverage</p>
          {sortedDomains.map(([domain, coverage]) => (
            <div key={domain} className="flex items-center gap-3">
              <span className="text-xs text-slate-400 w-24 truncate capitalize">
                {domain.replace(/([A-Z])/g, ' $1').trim()}
              </span>
              <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    coverage >= 70 ? 'bg-emerald-500' : coverage >= 40 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${coverage}%` }}
                />
              </div>
              <span className="text-xs text-slate-500 tabular-nums w-8 text-right">
                {coverage}%
              </span>
            </div>
          ))}
        </div>
      )}

      {/* View Context Graph Link */}
      <div className="mt-4 pt-4 border-t border-slate-800">
        <a
          href={`/c/${companyId}/context`}
          className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-amber-300 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Open Context Graph
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </a>
      </div>

      {error && (
        <p className="text-xs text-red-400 mt-3">{error}</p>
      )}
    </div>
  );
}

export default ContextHealthCard;
