'use client';

// components/os/CompanyOpportunitiesTab.tsx
// Opportunities tab for company detail page - shows pipeline opportunities

import { useState, useEffect } from 'react';
import type { Opportunity, OpportunityPriority, OpportunityArea } from '@/lib/os/types';

interface CompanyOpportunitiesTabProps {
  companyId: string;
  companyName: string;
}

// Priority badge colors
const priorityColors: Record<OpportunityPriority, string> = {
  critical: 'bg-red-500/10 text-red-400 border-red-500/30',
  high: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  medium: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  low: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
};

// Area badge colors
const areaColors: Record<OpportunityArea, string> = {
  Brand: 'bg-purple-500/10 text-purple-400',
  Content: 'bg-emerald-500/10 text-emerald-400',
  SEO: 'bg-blue-500/10 text-blue-400',
  'Website UX': 'bg-amber-500/10 text-amber-400',
  Funnel: 'bg-pink-500/10 text-pink-400',
  Analytics: 'bg-cyan-500/10 text-cyan-400',
  Strategy: 'bg-slate-500/10 text-slate-300',
  Operations: 'bg-orange-500/10 text-orange-400',
};

export function CompanyOpportunitiesTab({
  companyId,
  companyName,
}: CompanyOpportunitiesTabProps) {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{
    total: number;
    byPriority: Record<OpportunityPriority, number>;
    estimatedTotalValue: number;
  } | null>(null);

  const fetchOpportunities = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/os/pipeline/opportunities?companyId=${companyId}&includeGrowthPlans=true`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch opportunities');
      }

      const data = await response.json();
      setOpportunities(data.opportunities || []);
      setSummary(data.summary || null);
    } catch (err) {
      console.error('Error fetching opportunities:', err);
      setError(err instanceof Error ? err.message : 'Failed to load opportunities');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpportunities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  // Loading state
  if (loading) {
    return (
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
        <p className="text-slate-400 mt-4">Loading opportunities...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
        <p className="text-red-400">{error}</p>
        <button
          onClick={fetchOpportunities}
          className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      {summary && summary.total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">
              Total Opportunities
            </div>
            <div className="text-2xl font-bold text-slate-100">{summary.total}</div>
          </div>
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">
              Critical / High
            </div>
            <div className="text-2xl font-bold text-amber-400">
              {summary.byPriority.critical + summary.byPriority.high}
            </div>
          </div>
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">
              Medium Priority
            </div>
            <div className="text-2xl font-bold text-blue-400">
              {summary.byPriority.medium}
            </div>
          </div>
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">
              Est. Value
            </div>
            <div className="text-2xl font-bold text-emerald-400">
              ${summary.estimatedTotalValue.toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* Opportunities List */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
            Opportunities
          </h3>
          <button
            onClick={fetchOpportunities}
            className="text-xs text-slate-500 hover:text-slate-300"
          >
            Refresh
          </button>
        </div>

        {opportunities.length === 0 ? (
          <div className="p-12 text-center">
            <svg
              className="w-12 h-12 mx-auto text-slate-600 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-slate-500">
              No opportunities found for {companyName}.
            </p>
            <p className="text-xs text-slate-600 mt-2">
              Run a GAP assessment or diagnostics to generate opportunities.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/50">
            {opportunities.map((opp) => (
              <div
                key={opp.id}
                className="p-4 hover:bg-slate-800/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                          priorityColors[opp.priority]
                        }`}
                      >
                        {opp.priority}
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          areaColors[opp.area]
                        }`}
                      >
                        {opp.area}
                      </span>
                      <span className="text-xs text-slate-600">
                        via {opp.source.replace(/-/g, ' ')}
                      </span>
                    </div>
                    <h4 className="text-sm font-medium text-slate-200">
                      {opp.title}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                      {opp.description}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {opp.estimatedValue && (
                      <span className="text-sm font-semibold text-emerald-400">
                        ${opp.estimatedValue.toLocaleString()}
                      </span>
                    )}
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      {opp.estimatedEffort && (
                        <span className="px-1.5 py-0.5 bg-slate-800 rounded">
                          {opp.estimatedEffort} effort
                        </span>
                      )}
                      {opp.estimatedImpact && (
                        <span className="px-1.5 py-0.5 bg-slate-800 rounded">
                          {opp.estimatedImpact} impact
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <button className="px-3 py-1 text-xs bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium rounded transition-colors">
                    Convert to Work
                  </button>
                  <button className="px-3 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors">
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
