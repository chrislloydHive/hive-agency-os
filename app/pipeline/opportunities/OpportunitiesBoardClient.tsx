'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import type { CompanyRecord } from '@/lib/airtable/companies';
import type { OpportunityItem, PipelineStage } from '@/lib/types/pipeline';
import {
  ALL_STAGES,
  ACTIVE_STAGES,
  getStageLabel,
  getStageColorClass,
  getDealHealthLabel,
  getDealHealthColorClasses,
  isNextStepOverdue,
} from '@/lib/types/pipeline';
import { NewOpportunityModal } from './NewOpportunityModal';

interface OpportunitiesBoardClientProps {
  opportunities: OpportunityItem[];
  companies: CompanyRecord[];
  showNewOpportunityButton?: boolean;
}

// Drag state type
interface DragState {
  opportunityId: string;
  fromStage: PipelineStage | 'other';
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
interface OpportunityCardProps {
  opportunity: OpportunityItem;
  onDragStart?: (e: React.DragEvent, opportunity: OpportunityItem) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
}

function OpportunityCard({ opportunity, onDragStart, onDragEnd, isDragging }: OpportunityCardProps) {
  const isOverdue = isNextStepOverdue(opportunity.nextStepDue);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart?.(e, opportunity)}
      onDragEnd={onDragEnd}
      className={`bg-slate-800/50 border border-slate-700 rounded-lg p-3 hover:bg-slate-800 transition-all cursor-grab active:cursor-grabbing ${
        isDragging ? 'opacity-50 scale-95 ring-2 ring-amber-500/50' : ''
      }`}
    >
      {/* Drag Handle Indicator */}
      <div className="flex items-center gap-2 mb-2">
        <svg className="w-4 h-4 text-slate-600 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM8 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM8 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM14 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM14 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" />
        </svg>
        {/* Header */}
        <div className="flex items-start justify-between gap-2 flex-1 min-w-0">
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-slate-200 truncate">
              {opportunity.deliverableName || opportunity.companyName}
            </h4>
            {opportunity.deliverableName && (
              <p className="text-xs text-slate-500 truncate">{opportunity.companyName}</p>
            )}
          </div>
          {/* Deal Health Badge */}
          {opportunity.dealHealth && (
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${getDealHealthColorClasses(
                opportunity.dealHealth
              )}`}
            >
              {getDealHealthLabel(opportunity.dealHealth)}
            </span>
          )}
        </div>
      </div>

      {/* Next Step - Primary Indicator */}
      {opportunity.nextStep && (
        <div className="mb-2 p-2 bg-slate-900/50 rounded border border-slate-700/50">
          <div className="text-xs text-slate-400 mb-0.5">Next Step</div>
          <div className="text-sm text-slate-200 line-clamp-2">{opportunity.nextStep}</div>
          {opportunity.nextStepDue && (
            <div
              className={`text-xs mt-1 ${
                isOverdue ? 'text-red-400 font-medium' : 'text-slate-500'
              }`}
            >
              {isOverdue ? '⚠️ Overdue: ' : 'Due: '}
              {formatDate(opportunity.nextStepDue)}
            </div>
          )}
        </div>
      )}

      {/* Value & Close Date */}
      <div className="flex items-center justify-between text-xs mb-2">
        <span className="text-emerald-400 font-medium">
          {formatCurrency(opportunity.value)}
        </span>
        <span className="text-slate-500">Close: {formatDate(opportunity.closeDate)}</span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-700">
        <span>{opportunity.owner || 'Unassigned'}</span>
        <Link
          href={`/pipeline/opportunities/${opportunity.id}`}
          className="text-amber-400 hover:text-amber-300"
          onClick={(e) => e.stopPropagation()}
        >
          View →
        </Link>
      </div>
    </div>
  );
}

export function OpportunitiesBoardClient({
  opportunities: initialOpportunities,
  companies,
  showNewOpportunityButton = false,
}: OpportunitiesBoardClientProps) {
  const [opportunities, setOpportunities] = useState(initialOpportunities);
  const [viewMode, setViewMode] = useState<'board' | 'table'>('board');
  const [searchQuery, setSearchQuery] = useState('');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const [healthFilter, setHealthFilter] = useState<string>('all');
  const [showNewModal, setShowNewModal] = useState(false);

  // Drag and drop state
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropTargetStage, setDropTargetStage] = useState<PipelineStage | 'other' | null>(null);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  // Drag handlers
  const handleDragStart = useCallback((e: React.DragEvent, opportunity: OpportunityItem) => {
    setDragState({
      opportunityId: opportunity.id,
      fromStage: opportunity.stage,
    });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', opportunity.id);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragState(null);
    setDropTargetStage(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, stage: PipelineStage | 'other') => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTargetStage(stage);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDropTargetStage(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, targetStage: PipelineStage | 'other') => {
    e.preventDefault();
    setDropTargetStage(null);

    if (!dragState || dragState.fromStage === targetStage || targetStage === 'other') {
      setDragState(null);
      return;
    }

    const opportunityId = dragState.opportunityId;
    const originalStage = dragState.fromStage;
    setDragState(null);

    // Optimistically update UI
    setOpportunities((prev) =>
      prev.map((opp) =>
        opp.id === opportunityId ? { ...opp, stage: targetStage } : opp
      )
    );
    setIsUpdating(opportunityId);

    try {
      const response = await fetch(`/api/pipeline/opportunities/${opportunityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: targetStage }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update stage');
      }

      if (data.opportunity) {
        setOpportunities((prev) =>
          prev.map((opp) => (opp.id === opportunityId ? data.opportunity : opp))
        );
      }
    } catch (error) {
      console.error('Failed to update opportunity stage:', error);
      // Revert on error
      setOpportunities((prev) =>
        prev.map((opp) =>
          opp.id === opportunityId ? { ...opp, stage: originalStage } : opp
        )
      );
    } finally {
      setIsUpdating(null);
    }
  }, [dragState]);

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
        const nextStepMatch = opp.nextStep?.toLowerCase().includes(query);
        if (!nameMatch && !deliverableMatch && !nextStepMatch) return false;
      }

      // Owner filter
      if (ownerFilter !== 'all' && opp.owner !== ownerFilter) {
        return false;
      }

      // Health filter
      if (healthFilter !== 'all') {
        if (healthFilter === 'overdue') {
          if (!isNextStepOverdue(opp.nextStepDue)) return false;
        } else if (opp.dealHealth !== healthFilter) {
          return false;
        }
      }

      return true;
    });
  }, [opportunities, searchQuery, ownerFilter, healthFilter]);

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
    const overdueCount = active.filter((o) => isNextStepOverdue(o.nextStepDue)).length;
    const atRiskCount = active.filter((o) => o.dealHealth === 'at_risk' || o.dealHealth === 'stalled').length;
    return { count: active.length, totalValue, overdueCount, atRiskCount };
  }, [filteredOpportunities]);

  // Show empty state if no opportunities at all
  if (opportunities.length === 0) {
    return (
      <div className="space-y-6">
        <NewOpportunityModal
          isOpen={showNewModal}
          onClose={() => setShowNewModal(false)}
          companies={companies}
        />

        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-12 text-center">
          <div className="max-w-md mx-auto">
            <div className="mb-4">
              <svg
                className="w-16 h-16 mx-auto text-slate-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-slate-300 mb-2">No opportunities yet</h2>
            <p className="text-slate-500 mb-6">
              Create your first opportunity or convert a qualified lead.
            </p>
            <button
              onClick={() => setShowNewModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Opportunity
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* New Opportunity Button */}
      {showNewOpportunityButton && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowNewModal(true)}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium rounded-lg transition-colors"
          >
            New Opportunity
          </button>
        </div>
      )}

      {/* New Opportunity Modal */}
      <NewOpportunityModal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        companies={companies}
      />

      {/* Stats Summary */}
      <div className="grid grid-cols-4 gap-4">
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
          <div className={`text-2xl font-bold ${stats.overdueCount > 0 ? 'text-red-400' : 'text-slate-400'}`}>
            {stats.overdueCount}
          </div>
          <div className="text-xs text-slate-500">Overdue Next Steps</div>
        </div>
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          <div className={`text-2xl font-bold ${stats.atRiskCount > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
            {stats.atRiskCount}
          </div>
          <div className="text-xs text-slate-500">At Risk / Stalled</div>
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

          {/* Health Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Health
            </label>
            <select
              value={healthFilter}
              onChange={(e) => setHealthFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            >
              <option value="all">All</option>
              <option value="overdue">Overdue</option>
              <option value="on_track">On Track</option>
              <option value="at_risk">At Risk</option>
              <option value="stalled">Stalled</option>
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
            const isDropTarget = dropTargetStage === stage && dragState?.fromStage !== stage;

            return (
              <div
                key={stage}
                onDragOver={(e) => handleDragOver(e, stage)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, stage)}
                className={`flex-shrink-0 w-72 bg-slate-900/50 border rounded-xl transition-all ${
                  isDropTarget
                    ? 'border-amber-500 bg-amber-500/5 ring-2 ring-amber-500/20'
                    : 'border-slate-800'
                }`}
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
                <div className={`p-2 space-y-2 max-h-[600px] overflow-y-auto min-h-[100px] ${
                  isDropTarget ? 'bg-amber-500/5' : ''
                }`}>
                  {stageOpps.length === 0 ? (
                    <div className={`text-xs text-center py-4 rounded-lg border-2 border-dashed transition-colors ${
                      isDropTarget ? 'border-amber-500/50 text-amber-400' : 'border-transparent text-slate-600'
                    }`}>
                      {isDropTarget ? 'Drop here' : 'No opportunities'}
                    </div>
                  ) : (
                    stageOpps.map((opp) => (
                      <div key={opp.id} className="relative">
                        <OpportunityCard
                          opportunity={opp}
                          onDragStart={handleDragStart}
                          onDragEnd={handleDragEnd}
                          isDragging={dragState?.opportunityId === opp.id}
                        />
                        {isUpdating === opp.id && (
                          <div className="absolute inset-0 bg-slate-900/70 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 animate-spin text-amber-500" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                          </div>
                        )}
                      </div>
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
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Health
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Next Step
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Value
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
                {filteredOpportunities.map((opp) => {
                  const isOverdue = isNextStepOverdue(opp.nextStepDue);
                  return (
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
                      <td className="px-4 py-3">
                        {opp.dealHealth ? (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getDealHealthColorClasses(
                              opp.dealHealth
                            )}`}
                          >
                            {getDealHealthLabel(opp.dealHealth)}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="max-w-[200px]">
                          {opp.nextStep ? (
                            <>
                              <div className="text-slate-300 text-xs truncate">{opp.nextStep}</div>
                              {opp.nextStepDue && (
                                <div
                                  className={`text-xs ${
                                    isOverdue ? 'text-red-400 font-medium' : 'text-slate-500'
                                  }`}
                                >
                                  {isOverdue ? '⚠️ ' : ''}
                                  {formatDate(opp.nextStepDue)}
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-slate-600 text-xs">No next step</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-emerald-400 font-medium">
                          {formatCurrency(opp.value)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {formatDate(opp.closeDate)}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {opp.owner || '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/pipeline/opportunities/${opp.id}`}
                          className="text-xs text-amber-400 hover:text-amber-300"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
