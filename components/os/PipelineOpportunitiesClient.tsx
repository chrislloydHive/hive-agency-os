'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { CompanyRecord } from '@/lib/airtable/companies';
import type { OpportunityItem } from '@/lib/types/pipeline';
import {
  OPPORTUNITY_STAGES,
  ACTIVE_OPPORTUNITY_STAGES,
  getStageColorClasses,
  getStageLabel,
  getDealHealthLabel,
  getDealHealthColorClasses,
  isNextStepOverdue,
} from '@/lib/types/pipeline';

// Extended opportunity with enriched company data
interface EnrichedOpportunity extends OpportunityItem {
  companyDomain?: string;
  companyStage?: string;
}

interface PipelineOpportunitiesClientProps {
  opportunities: EnrichedOpportunity[];
  companies: CompanyRecord[];
}

const STAGES = OPPORTUNITY_STAGES;
const ACTIVE_STAGES = ACTIVE_OPPORTUNITY_STAGES;

// Helper to format dates
const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
};

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

export function PipelineOpportunitiesClient({
  opportunities,
  companies,
}: PipelineOpportunitiesClientProps) {
  const [stageFilter, setStageFilter] = useState<string>('Active');
  const [searchQuery, setSearchQuery] = useState('');
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [healthFilter, setHealthFilter] = useState<string>('all');

  // Filter opportunities
  const filteredOpportunities = useMemo(() => {
    return opportunities.filter((opp) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const nameMatch = opp.companyName.toLowerCase().includes(query);
        const deliverableMatch = opp.deliverableName?.toLowerCase().includes(query);
        const notesMatch = opp.notes?.toLowerCase().includes(query);
        const nextStepMatch = opp.nextStep?.toLowerCase().includes(query);
        if (!nameMatch && !deliverableMatch && !notesMatch && !nextStepMatch) return false;
      }

      // Stage filter
      const oppStageLabel = getStageLabel(opp.stage);
      if (stageFilter === 'Active') {
        if (!ACTIVE_STAGES.includes(oppStageLabel as typeof ACTIVE_STAGES[number])) return false;
      } else if (stageFilter !== 'All' && oppStageLabel !== stageFilter) {
        return false;
      }

      // Company filter
      if (companyFilter !== 'all' && opp.companyId !== companyFilter) {
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
  }, [opportunities, stageFilter, searchQuery, companyFilter, healthFilter]);

  // Stats
  const stats = useMemo(() => {
    const active = opportunities.filter((o) =>
      ACTIVE_STAGES.includes(getStageLabel(o.stage) as typeof ACTIVE_STAGES[number])
    );
    const activeValue = active.reduce((sum, o) => sum + (o.value || 0), 0);
    const overdueCount = active.filter((o) => isNextStepOverdue(o.nextStepDue)).length;
    const atRiskCount = active.filter((o) => o.dealHealth === 'at_risk' || o.dealHealth === 'stalled').length;

    const byStage: Record<string, { count: number; value: number }> = {};
    for (const stage of STAGES) {
      const stageOpps = opportunities.filter((o) => getStageLabel(o.stage) === stage);
      byStage[stage] = {
        count: stageOpps.length,
        value: stageOpps.reduce((sum, o) => sum + (o.value || 0), 0),
      };
    }

    return {
      active: active.length,
      activeValue,
      overdueCount,
      atRiskCount,
      byStage,
      won: byStage['Won']?.count || 0,
      wonValue: byStage['Won']?.value || 0,
    };
  }, [opportunities]);

  if (opportunities.length === 0) {
    return (
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
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-slate-300 mb-2">
            No Opportunities Yet
          </h2>
          <p className="text-slate-500 mb-6">
            Track deals, run GAP assessments for prospects, and manage your
            sales pipeline.
          </p>
          <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg text-left">
            <p className="text-sm text-blue-300">
              <strong>To set up opportunities:</strong>
            </p>
            <ul className="mt-2 space-y-1 text-sm text-blue-300">
              <li>Create an Opportunities table in Airtable</li>
              <li>Fields: Name, Company (linked), Stage, Value, Close Date, Deal Health, Next Step, Next Step Due</li>
              <li>Stages: Interest Confirmed, Discovery / Clarification, Solution Shaping, Proposal / RFP Submitted, Decision, Won, Lost, Dormant</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          <div className="text-2xl font-bold text-slate-100">{stats.active}</div>
          <div className="text-xs text-slate-500">Active Opportunities</div>
        </div>
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          <div className="text-2xl font-bold text-amber-500">
            {formatCurrency(stats.activeValue)}
          </div>
          <div className="text-xs text-slate-500">Pipeline Value</div>
        </div>
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          <div className={`text-2xl font-bold ${stats.overdueCount > 0 ? 'text-red-400' : 'text-slate-400'}`}>
            {stats.overdueCount}
          </div>
          <div className="text-xs text-slate-500">Overdue Next Steps</div>
        </div>
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          <div className="text-2xl font-bold text-emerald-400">
            {stats.won}
            <span className="text-base font-normal text-slate-500 ml-1">
              ({formatCurrency(stats.wonValue)})
            </span>
          </div>
          <div className="text-xs text-slate-500">Won</div>
        </div>
      </div>

      {/* Pipeline Funnel */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
          Pipeline by Stage
        </h3>
        <div className="flex gap-2">
          {STAGES.map((stage) => {
            const data = stats.byStage[stage];
            const isActive = ACTIVE_STAGES.includes(stage as typeof ACTIVE_STAGES[number]);
            return (
              <div
                key={stage}
                className={`flex-1 p-3 rounded-lg ${
                  stage === 'Won'
                    ? 'bg-emerald-500/10 border border-emerald-500/30'
                    : stage === 'Lost'
                    ? 'bg-red-500/10 border border-red-500/30'
                    : isActive
                    ? 'bg-slate-800/50 border border-slate-700'
                    : 'bg-slate-800/30 border border-slate-800'
                }`}
              >
                <div className="text-xs text-slate-400 mb-1">{stage}</div>
                <div
                  className={`text-lg font-bold ${
                    stage === 'Won'
                      ? 'text-emerald-400'
                      : stage === 'Lost'
                      ? 'text-red-400'
                      : 'text-slate-200'
                  }`}
                >
                  {data?.count || 0}
                </div>
                <div className="text-xs text-slate-500">
                  {formatCurrency(data?.value)}
                </div>
              </div>
            );
          })}
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

          {/* Stage Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Stage
            </label>
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            >
              <option value="Active">Active</option>
              <option value="All">All</option>
              {STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
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

          {/* Company Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Company
            </label>
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            >
              <option value="all">All Companies</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>

          {/* Results */}
          <div className="text-sm text-slate-400">
            {filteredOpportunities.length} opportunities
          </div>
        </div>
      </div>

      {/* Opportunities Table */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Opportunity
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Company
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
                      <div className="text-slate-200 font-medium">
                        {opp.deliverableName || opp.companyName}
                      </div>
                      {opp.deliverableName && (
                        <div className="text-xs text-slate-500 mt-0.5">
                          {opp.companyName}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {opp.companyId ? (
                        <Link
                          href={`/c/${opp.companyId}`}
                          className="text-amber-500 hover:text-amber-400 text-xs"
                        >
                          {opp.companyName || 'View Company'}
                        </Link>
                      ) : (
                        <span className="text-slate-400 text-xs">{opp.companyName}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getStageColorClasses(opp.stage)}`}
                      >
                        {getStageLabel(opp.stage)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {opp.dealHealth ? (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getDealHealthColorClasses(opp.dealHealth)}`}
                        >
                          {getDealHealthLabel(opp.dealHealth)}
                        </span>
                      ) : (
                        <span className="text-slate-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="max-w-[180px]">
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
                      <span className="text-slate-200 font-medium">
                        {formatCurrency(opp.value)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {formatDate(opp.closeDate)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {opp.companyDomain && (
                          <Link
                            href={`/snapshot?url=${encodeURIComponent(
                              opp.companyDomain
                            )}`}
                            className="text-xs text-blue-500 hover:text-blue-400 font-medium"
                          >
                            Run GAP
                          </Link>
                        )}
                        <Link
                          href={`/pipeline/opportunities/${opp.id}`}
                          className="text-xs text-amber-500 hover:text-amber-400 font-medium"
                        >
                          View →
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
