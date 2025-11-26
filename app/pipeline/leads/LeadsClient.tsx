'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { InboundLeadItem } from '@/lib/types/pipeline';

interface EnrichedLead extends InboundLeadItem {
  companyInfo?: { name: string; industry?: string; sizeBand?: string } | null;
}

interface LeadsClientProps {
  leads: EnrichedLead[];
}

const STATUS_OPTIONS = ['All', 'New', 'Contacted', 'Qualified', 'Routed', 'Disqualified'];
const SOURCE_OPTIONS = ['All', 'DMA', 'GAP', 'Referral', 'Outbound', 'Inbound', 'Other'];

// Format date
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

// Get status badge classes
const getStatusClass = (status?: string | null) => {
  switch (status?.toLowerCase()) {
    case 'new':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    case 'contacted':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    case 'qualified':
      return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
    case 'routed':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    case 'disqualified':
      return 'bg-red-500/10 text-red-400 border-red-500/30';
    default:
      return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
  }
};

export function LeadsClient({ leads }: LeadsClientProps) {
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [sourceFilter, setSourceFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [routingIds, setRoutingIds] = useState<Set<string>>(new Set());
  const [convertingIds, setConvertingIds] = useState<Set<string>>(new Set());

  // Filter leads
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const nameMatch = lead.name?.toLowerCase().includes(query);
        const emailMatch = lead.email?.toLowerCase().includes(query);
        const companyMatch = lead.companyName?.toLowerCase().includes(query);
        const websiteMatch = lead.website?.toLowerCase().includes(query);
        if (!nameMatch && !emailMatch && !companyMatch && !websiteMatch) return false;
      }

      // Status filter
      if (statusFilter !== 'All' && lead.status !== statusFilter) return false;

      // Source filter
      if (sourceFilter !== 'All' && !lead.leadSource?.includes(sourceFilter)) return false;

      return true;
    });
  }, [leads, statusFilter, sourceFilter, searchQuery]);

  // Stats by status
  const stats = useMemo(() => {
    const newCount = leads.filter((l) => l.status === 'New').length;
    const contacted = leads.filter((l) => l.status === 'Contacted').length;
    const qualified = leads.filter((l) => l.status === 'Qualified').length;
    const routed = leads.filter((l) => l.status === 'Routed').length;
    return { newCount, contacted, qualified, routed };
  }, [leads]);

  // Handle route lead
  const handleRouteLead = async (leadId: string) => {
    setRoutingIds((prev) => new Set(prev).add(leadId));
    try {
      const response = await fetch('/api/pipeline/route-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId }),
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Lead routed to ${data.assignee}`);
        window.location.reload();
      } else {
        const error = await response.json();
        alert(`Failed to route lead: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to route lead:', error);
      alert('Failed to route lead');
    } finally {
      setRoutingIds((prev) => {
        const next = new Set(prev);
        next.delete(leadId);
        return next;
      });
    }
  };

  // Handle convert to company
  const handleConvertToCompany = async (leadId: string) => {
    setConvertingIds((prev) => new Set(prev).add(leadId));
    try {
      const response = await fetch('/api/pipeline/convert-lead-to-company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId }),
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Created company: ${data.companyName}`);
        window.location.reload();
      } else {
        const error = await response.json();
        alert(`Failed to create company: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to convert lead:', error);
      alert('Failed to create company');
    } finally {
      setConvertingIds((prev) => {
        const next = new Set(prev);
        next.delete(leadId);
        return next;
      });
    }
  };

  // Handle convert to opportunity
  const handleConvertToOpportunity = async (leadId: string) => {
    setConvertingIds((prev) => new Set(prev).add(leadId));
    try {
      const response = await fetch('/api/pipeline/convert-lead-to-opportunity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId }),
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Created opportunity: ${data.opportunityId}`);
        window.location.reload();
      } else {
        const error = await response.json();
        alert(`Failed to create opportunity: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to convert lead:', error);
      alert('Failed to create opportunity');
    } finally {
      setConvertingIds((prev) => {
        const next = new Set(prev);
        next.delete(leadId);
        return next;
      });
    }
  };

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
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-slate-300 mb-2">No Leads Yet</h2>
          <p className="text-slate-500 mb-6">
            Leads will appear here from DMA audits, referrals, and outreach.
          </p>
          <Link
            href="/c/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium rounded-lg transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Prospect
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          <div className="text-2xl font-bold text-blue-400">{stats.newCount}</div>
          <div className="text-xs text-slate-500">New</div>
        </div>
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          <div className="text-2xl font-bold text-amber-400">{stats.contacted}</div>
          <div className="text-xs text-slate-500">Contacted</div>
        </div>
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          <div className="text-2xl font-bold text-purple-400">{stats.qualified}</div>
          <div className="text-xs text-slate-500">Qualified</div>
        </div>
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          <div className="text-2xl font-bold text-emerald-400">{stats.routed}</div>
          <div className="text-xs text-slate-500">Routed</div>
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
              placeholder="Search by name, email, company..."
              className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
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
              {SOURCE_OPTIONS.map((source) => (
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

      {/* Leads Table */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Lead
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Company/Website
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Source
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Assignee
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Created
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((lead) => (
                <tr
                  key={lead.id}
                  className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div>
                      <div className="text-slate-200 font-medium">
                        {lead.name || 'Unknown'}
                      </div>
                      {lead.email && (
                        <div className="text-xs text-slate-500">{lead.email}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-300 text-xs">
                          {lead.companyName || lead.companyInfo?.name || '—'}
                        </span>
                        {lead.companyId && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            Linked
                          </span>
                        )}
                      </div>
                      {lead.website && (
                        <a
                          href={
                            lead.website.startsWith('http')
                              ? lead.website
                              : `https://${lead.website}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:text-blue-300"
                        >
                          {lead.website}
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-700 text-slate-300">
                      {lead.leadSource || 'Unknown'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getStatusClass(
                        lead.status
                      )}`}
                    >
                      {lead.status || 'Unknown'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {lead.assignee || '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {formatDate(lead.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2 flex-wrap">
                      {/* Route Lead */}
                      {!lead.assignee && (
                        <button
                          onClick={() => handleRouteLead(lead.id)}
                          disabled={routingIds.has(lead.id)}
                          className="text-xs text-purple-400 hover:text-purple-300 disabled:text-slate-600 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          {routingIds.has(lead.id) ? 'Routing...' : 'Route Lead'}
                        </button>
                      )}

                      {/* Create Company */}
                      {!lead.companyId && lead.website && (
                        <button
                          onClick={() => handleConvertToCompany(lead.id)}
                          disabled={convertingIds.has(lead.id)}
                          className="text-xs text-amber-400 hover:text-amber-300 disabled:text-slate-600 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          {convertingIds.has(lead.id) ? 'Creating...' : 'Create Company'}
                        </button>
                      )}

                      {/* View Company */}
                      {lead.companyId && (
                        <Link
                          href={`/c/${lead.companyId}`}
                          className="text-xs text-emerald-400 hover:text-emerald-300 whitespace-nowrap"
                        >
                          View Company
                        </Link>
                      )}

                      {/* Create Opportunity */}
                      {lead.companyId && (
                        <button
                          onClick={() => handleConvertToOpportunity(lead.id)}
                          disabled={convertingIds.has(lead.id)}
                          className="text-xs text-blue-400 hover:text-blue-300 disabled:text-slate-600 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          Create Opp
                        </button>
                      )}

                      {/* Run GAP */}
                      {lead.website && !lead.gapIaRunId && (
                        <Link
                          href={`/snapshot?url=${encodeURIComponent(lead.website)}`}
                          className="text-xs text-cyan-400 hover:text-cyan-300 whitespace-nowrap"
                        >
                          Run GAP
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
