'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { CompanyRecord } from '@/lib/airtable/companies';
import type { OpportunityItem, PipelineStage } from '@/lib/types/pipeline';
import {
  ALL_STAGES,
  ACTIVE_STAGES,
  getStageLabel,
  getStageColorClass,
} from '@/lib/types/pipeline';

interface OpportunitiesBoardClientProps {
  opportunities: OpportunityItem[];
  companies: CompanyRecord[];
}

// Format currency
const formatCurrency = (num?: number | null) => {
  if (num === null || num === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
};

// Format date
const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
};

// Opportunity Card Component
function OpportunityCard({
  opportunity,
  onRefreshScore,
  isScoring,
}: {
  opportunity: OpportunityItem;
  onRefreshScore: (id: string) => void;
  isScoring: boolean;
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 hover:bg-slate-800 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-slate-200 truncate">
            {opportunity.deliverableName || opportunity.companyName}
          </h4>
          {opportunity.deliverableName && (
            <p className="text-xs text-slate-500 truncate">{opportunity.companyName}</p>
          )}
        </div>
        {/* AI Score Badge */}
        {opportunity.opportunityScore != null && (
          <div
            className="relative"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold ${
                (opportunity.opportunityScore ?? 0) >= 70
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : (opportunity.opportunityScore ?? 0) >= 40
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-red-500/20 text-red-400'
              }`}
            >
              {opportunity.opportunityScore}
            </span>
            {/* Tooltip */}
            {showTooltip && opportunity.opportunityScoreExplanation && (
              <div className="absolute right-0 top-6 z-50 w-64 p-2 bg-slate-900 border border-slate-700 rounded-lg shadow-lg text-xs text-slate-300">
                {opportunity.opportunityScoreExplanation}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Value & Date */}
      <div className="flex items-center justify-between text-xs mb-2">
        <span className="text-emerald-400 font-medium">
          {formatCurrency(opportunity.value)}
        </span>
        {opportunity.probability && (
          <span className="text-slate-500">
            {Math.round((opportunity.probability > 1 ? opportunity.probability : opportunity.probability * 100))}%
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{opportunity.owner || 'Unassigned'}</span>
        <span>Close: {formatDate(opportunity.closeDate)}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-700">
        <button
          onClick={() => onRefreshScore(opportunity.id)}
          disabled={isScoring}
          className="text-xs text-blue-400 hover:text-blue-300 disabled:text-slate-600 disabled:cursor-not-allowed"
        >
          {isScoring ? 'Scoring...' : 'Refresh Score'}
        </button>
        <Link
          href={`/pipeline/opportunities/${opportunity.id}`}
          className="text-xs text-amber-400 hover:text-amber-300"
        >
          View →
        </Link>
      </div>
    </div>
  );
}

export function OpportunitiesBoardClient({
  opportunities,
  companies,
}: OpportunitiesBoardClientProps) {
  const [viewMode, setViewMode] = useState<'board' | 'table'>('board');
  const [searchQuery, setSearchQuery] = useState('');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const [scoringIds, setScoringIds] = useState<Set<string>>(new Set());

  // Get unique owners
  const owners = useMemo(() => {
    const ownerSet = new Set<string>();
    opportunities.forEach((o) => {
      if (o.owner) ownerSet.add(o.owner);
    });
    return Array.from(ownerSet).sort();
  }, [opportunities]);

  // Filter opportunities
  const filteredOpportunities = useMemo(() => {
    return opportunities.filter((opp) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const nameMatch = opp.companyName.toLowerCase().includes(query);
        const deliverableMatch = opp.deliverableName?.toLowerCase().includes(query);
        if (!nameMatch && !deliverableMatch) return false;
      }

      // Owner filter
      if (ownerFilter !== 'all' && opp.owner !== ownerFilter) {
        return false;
      }

      return true;
    });
  }, [opportunities, searchQuery, ownerFilter]);

  // Group opportunities by stage
  const opportunitiesByStage = useMemo(() => {
    const grouped: Record<string, OpportunityItem[]> = {};
    for (const stage of ALL_STAGES) {
      grouped[stage] = filteredOpportunities.filter((o) => o.stage === stage);
    }
    return grouped;
  }, [filteredOpportunities]);

  // Calculate stats
  const stats = useMemo(() => {
    const active = filteredOpportunities.filter((o) =>
      ACTIVE_STAGES.includes(o.stage as PipelineStage)
    );
    const totalValue = active.reduce((sum, o) => sum + (o.value ?? 0), 0);
    const weightedValue = active.reduce((sum, o) => {
      const prob = o.probability ?? 0.5;
      const normalizedProb = prob > 1 ? prob / 100 : prob;
      return sum + (o.value ?? 0) * normalizedProb;
    }, 0);
    return { count: active.length, totalValue, weightedValue };
  }, [filteredOpportunities]);

  // Handle AI score refresh
  const handleRefreshScore = async (id: string) => {
    setScoringIds((prev) => new Set(prev).add(id));
    try {
      const response = await fetch('/api/pipeline/opportunity-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunityId: id }),
      });

      if (response.ok) {
        // Reload the page to show updated score
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to refresh score:', error);
    } finally {
      setScoringIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          <div className="text-2xl font-bold text-slate-100">{stats.count}</div>
          <div className="text-xs text-slate-500">Active Opportunities</div>
        </div>
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          <div className="text-2xl font-bold text-amber-500">
            {formatCurrency(stats.totalValue)}
          </div>
          <div className="text-xs text-slate-500">Total Pipeline</div>
        </div>
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          <div className="text-2xl font-bold text-purple-400">
            {formatCurrency(stats.weightedValue)}
          </div>
          <div className="text-xs text-slate-500">Weighted Pipeline</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
        <div className="flex flex-wrap items-end gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Search
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search opportunities..."
              className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
          </div>

          {/* Owner Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Owner
            </label>
            <select
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            >
              <option value="all">All Owners</option>
              {owners.map((owner) => (
                <option key={owner} value={owner}>
                  {owner}
                </option>
              ))}
            </select>
          </div>

          {/* View Toggle */}
          <div className="flex rounded-lg bg-slate-800 p-0.5">
            <button
              onClick={() => setViewMode('board')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'board'
                  ? 'bg-slate-700 text-slate-100'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              Board
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'table'
                  ? 'bg-slate-700 text-slate-100'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              Table
            </button>
          </div>

          {/* Results count */}
          <div className="text-sm text-slate-400">
            {filteredOpportunities.length} opportunities
          </div>
        </div>
      </div>

      {/* Board View */}
      {viewMode === 'board' && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {ALL_STAGES.filter((stage) => stage !== 'other').map((stage) => {
            const stageOpps = opportunitiesByStage[stage] || [];
            const stageValue = stageOpps.reduce((sum, o) => sum + (o.value ?? 0), 0);

            return (
              <div
                key={stage}
                className="flex-shrink-0 w-72 bg-slate-900/50 border border-slate-800 rounded-xl"
              >
                {/* Column Header */}
                <div className="p-3 border-b border-slate-800">
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getStageColorClass(
                        stage
                      )}`}
                    >
                      {getStageLabel(stage)}
                    </span>
                    <span className="text-xs text-slate-500">{stageOpps.length}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {formatCurrency(stageValue)}
                  </div>
                </div>

                {/* Cards */}
                <div className="p-2 space-y-2 max-h-[600px] overflow-y-auto">
                  {stageOpps.length === 0 ? (
                    <div className="text-xs text-slate-600 text-center py-4">
                      No opportunities
                    </div>
                  ) : (
                    stageOpps.map((opp) => (
                      <OpportunityCard
                        key={opp.id}
                        opportunity={opp}
                        onRefreshScore={handleRefreshScore}
                        isScoring={scoringIds.has(opp.id)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Opportunity
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Stage
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Value
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    AI Score
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Close Date
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Owner
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredOpportunities.map((opp) => (
                  <tr
                    key={opp.id}
                    className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div>
                        <div className="text-slate-200 font-medium">
                          {opp.deliverableName || opp.companyName}
                        </div>
                        {opp.deliverableName && (
                          <div className="text-xs text-slate-500">{opp.companyName}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getStageColorClass(
                          opp.stage
                        )}`}
                      >
                        {getStageLabel(opp.stage)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-emerald-400 font-medium">
                        {formatCurrency(opp.value)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {opp.opportunityScore != null ? (
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold ${
                            (opp.opportunityScore ?? 0) >= 70
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : (opp.opportunityScore ?? 0) >= 40
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}
                        >
                          {opp.opportunityScore}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {formatDate(opp.closeDate)}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {opp.owner || '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleRefreshScore(opp.id)}
                          disabled={scoringIds.has(opp.id)}
                          className="text-xs text-blue-400 hover:text-blue-300 disabled:text-slate-600"
                        >
                          {scoringIds.has(opp.id) ? 'Scoring...' : 'Score'}
                        </button>
                        <Link
                          href={`/pipeline/opportunities/${opp.id}`}
                          className="text-xs text-amber-400 hover:text-amber-300"
                        >
                          View →
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
