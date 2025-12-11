'use client';

// app/pipeline/leads/PipelineTableClient.tsx
// Pipeline Table View - Sortable/filterable table for leads

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { InboundLeadItem, PipelineLeadStage } from '@/lib/types/pipeline';
import {
  getPipelineStageLabel,
  getPipelineStageColorClasses,
  getMaturityStageColorClasses,
  PIPELINE_LEAD_STAGES,
} from '@/lib/types/pipeline';

interface EnrichedLead extends InboundLeadItem {
  companyInfo?: { name: string; industry?: string; sizeBand?: string } | null;
}

interface PipelineTableClientProps {
  leads: EnrichedLead[];
}

type SortField = 'company' | 'stage' | 'score' | 'created' | 'lastActivity';
type SortDirection = 'asc' | 'desc';

// Format date
function formatDate(dateStr?: string | null): string {
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
}

// Format relative time
function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return formatDate(dateStr);
  } catch {
    return '—';
  }
}

export function PipelineTableClient({ leads }: PipelineTableClientProps) {
  const [stageFilter, setStageFilter] = useState<PipelineLeadStage | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('lastActivity');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [localLeads, setLocalLeads] = useState<EnrichedLead[]>(leads);

  // Get unique sources
  const sources = useMemo(() => {
    const sourceSet = new Set<string>();
    leads.forEach((lead) => {
      if (lead.leadSource) sourceSet.add(lead.leadSource);
    });
    return Array.from(sourceSet).sort();
  }, [leads]);

  // Filter and sort leads
  const filteredLeads = useMemo(() => {
    let result = localLeads.filter((lead) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const companyMatch = (lead.companyName || lead.companyInfo?.name || '').toLowerCase().includes(query);
        const contactMatch = (lead.name || '').toLowerCase().includes(query);
        const emailMatch = (lead.email || '').toLowerCase().includes(query);
        const domainMatch = (lead.website || '').toLowerCase().includes(query);
        if (!companyMatch && !contactMatch && !emailMatch && !domainMatch) return false;
      }

      // Stage filter
      if (stageFilter !== 'all') {
        const leadStage = lead.pipelineStage || 'new';
        if (leadStage !== stageFilter) return false;
      }

      // Source filter
      if (sourceFilter !== 'all' && lead.leadSource !== sourceFilter) return false;

      return true;
    });

    // Sort
    result.sort((a, b) => {
      let aVal: string | number | null = null;
      let bVal: string | number | null = null;

      switch (sortField) {
        case 'company':
          aVal = a.companyName || a.companyInfo?.name || '';
          bVal = b.companyName || b.companyInfo?.name || '';
          break;
        case 'stage':
          aVal = PIPELINE_LEAD_STAGES.indexOf(a.pipelineStage || 'new');
          bVal = PIPELINE_LEAD_STAGES.indexOf(b.pipelineStage || 'new');
          break;
        case 'score':
          aVal = a.gapOverallScore ?? -1;
          bVal = b.gapOverallScore ?? -1;
          break;
        case 'created':
          aVal = a.createdAt || '';
          bVal = b.createdAt || '';
          break;
        case 'lastActivity':
          aVal = a.lastActivityAt || a.createdAt || '';
          bVal = b.lastActivityAt || b.createdAt || '';
          break;
      }

      if (aVal === null || bVal === null) return 0;
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [localLeads, stageFilter, sourceFilter, searchQuery, sortField, sortDirection]);

  // Handle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Sort indicator
  const SortIndicator = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return (
      <span className="ml-1 text-amber-400">
        {sortDirection === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  // Handle stage change
  const handleStageChange = async (leadId: string, newStage: PipelineLeadStage) => {
    setUpdatingIds((prev) => new Set(prev).add(leadId));

    // Optimistic update
    setLocalLeads((prev) =>
      prev.map((lead) =>
        lead.id === leadId ? { ...lead, pipelineStage: newStage } : lead
      )
    );

    try {
      const response = await fetch('/api/pipeline/update-stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, stage: newStage }),
      });

      if (!response.ok) {
        throw new Error('Failed to update stage');
      }
    } catch (error) {
      console.error('Failed to update stage:', error);
      // Revert on error
      setLocalLeads(leads);
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(leadId);
        return next;
      });
    }
  };

  // Stats by stage
  const stageStats = useMemo(() => {
    const stats: Record<PipelineLeadStage, number> = {
      new: 0,
      qualified: 0,
      meeting_scheduled: 0,
      proposal: 0,
      won: 0,
      lost: 0,
    };
    localLeads.forEach((lead) => {
      const stage = lead.pipelineStage || 'new';
      if (stats[stage] !== undefined) stats[stage]++;
    });
    return stats;
  }, [localLeads]);

  if (leads.length === 0) {
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
                d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-slate-300 mb-2">No Pipeline Leads</h2>
          <p className="text-slate-500 mb-6">
            Leads from DMA Full GAP audits will appear here when prospects click Contact Us.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stage Stats */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {PIPELINE_LEAD_STAGES.map((stage) => (
          <button
            key={stage}
            onClick={() => setStageFilter(stageFilter === stage ? 'all' : stage)}
            className={`p-3 rounded-xl border transition-all ${
              stageFilter === stage
                ? 'bg-amber-500/10 border-amber-500/50'
                : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="text-xl font-bold text-slate-200">{stageStats[stage]}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wide">
              {getPipelineStageLabel(stage)}
            </div>
          </button>
        ))}
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
              placeholder="Search company, contact, domain..."
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
              onChange={(e) => setStageFilter(e.target.value as PipelineLeadStage | 'all')}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            >
              <option value="all">All Stages</option>
              {PIPELINE_LEAD_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {getPipelineStageLabel(stage)}
                </option>
              ))}
            </select>
          </div>

          {/* Source Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Source
            </label>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            >
              <option value="all">All Sources</option>
              {sources.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </div>

          {/* Results */}
          <div className="text-sm text-slate-400">{filteredLeads.length} leads</div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th
                  onClick={() => handleSort('company')}
                  className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide cursor-pointer hover:text-slate-300"
                >
                  Company
                  <SortIndicator field="company" />
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Domain
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Contact
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Source
                </th>
                <th
                  onClick={() => handleSort('score')}
                  className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide cursor-pointer hover:text-slate-300"
                >
                  GAP Score
                  <SortIndicator field="score" />
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Maturity
                </th>
                <th
                  onClick={() => handleSort('stage')}
                  className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide cursor-pointer hover:text-slate-300"
                >
                  Stage
                  <SortIndicator field="stage" />
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Owner
                </th>
                <th
                  onClick={() => handleSort('created')}
                  className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide cursor-pointer hover:text-slate-300"
                >
                  Created
                  <SortIndicator field="created" />
                </th>
                <th
                  onClick={() => handleSort('lastActivity')}
                  className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide cursor-pointer hover:text-slate-300"
                >
                  Activity
                  <SortIndicator field="lastActivity" />
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((lead) => {
                const companyName = lead.companyName || lead.companyInfo?.name || 'Unknown';
                const domain = lead.website?.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] || '—';
                const isDmaLead = lead.leadSource === 'DMA Full GAP';

                return (
                  <tr
                    key={lead.id}
                    className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                  >
                    {/* Company */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-200 font-medium truncate max-w-[150px]">
                          {companyName}
                        </span>
                        {lead.companyId && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            Linked
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Domain */}
                    <td className="px-4 py-3">
                      {lead.website ? (
                        <a
                          href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:text-blue-300 truncate max-w-[120px] block"
                        >
                          {domain}
                        </a>
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                    </td>

                    {/* Contact */}
                    <td className="px-4 py-3">
                      <div>
                        {lead.name && (
                          <div className="text-xs text-slate-300 truncate max-w-[120px]">{lead.name}</div>
                        )}
                        {lead.email && (
                          <div className="text-xs text-slate-500 truncate max-w-[120px]">{lead.email}</div>
                        )}
                        {!lead.name && !lead.email && (
                          <span className="text-xs text-slate-600">—</span>
                        )}
                      </div>
                    </td>

                    {/* Source */}
                    <td className="px-4 py-3">
                      {isDmaLead ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">
                          DMA Full GAP
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs text-slate-400 bg-slate-700">
                          {lead.leadSource || 'Unknown'}
                        </span>
                      )}
                    </td>

                    {/* GAP Score */}
                    <td className="px-4 py-3">
                      {lead.gapOverallScore !== null ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                          {lead.gapOverallScore}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                    </td>

                    {/* Maturity */}
                    <td className="px-4 py-3">
                      {lead.gapMaturityStage ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getMaturityStageColorClasses(lead.gapMaturityStage)}`}>
                          {lead.gapMaturityStage}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                    </td>

                    {/* Stage */}
                    <td className="px-4 py-3">
                      <select
                        value={lead.pipelineStage || 'new'}
                        onChange={(e) => handleStageChange(lead.id, e.target.value as PipelineLeadStage)}
                        disabled={updatingIds.has(lead.id)}
                        className={`px-2 py-1 rounded text-xs font-medium border bg-transparent cursor-pointer focus:outline-none focus:ring-1 focus:ring-amber-500/50 disabled:opacity-50 ${getPipelineStageColorClasses(lead.pipelineStage || 'new')}`}
                      >
                        {PIPELINE_LEAD_STAGES.map((stage) => (
                          <option key={stage} value={stage} className="bg-slate-800 text-slate-200">
                            {getPipelineStageLabel(stage)}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Owner */}
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-400">{lead.assignee || '—'}</span>
                    </td>

                    {/* Created */}
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-500">{formatDate(lead.createdAt)}</span>
                    </td>

                    {/* Last Activity */}
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-500">
                        {formatRelativeTime(lead.lastActivityAt || lead.createdAt)}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {lead.companyId && (
                          <Link
                            href={`/c/${lead.companyId}?from=pipeline&leadId=${lead.id}${lead.gapPlanRunId ? `&gapRunId=${lead.gapPlanRunId}` : ''}`}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-amber-500 hover:bg-amber-400 text-slate-900 transition-colors"
                          >
                            Open
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </Link>
                        )}
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
