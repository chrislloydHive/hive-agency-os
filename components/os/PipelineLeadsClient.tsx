'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

interface Lead {
  id: string;
  name: string;
  domain?: string;
  email?: string;
  source: string;
  status: string;
  notes?: string;
  companyId?: string;
  opportunityId?: string;
  createdAt?: string;
}

interface PipelineLeadsClientProps {
  leads: Lead[];
}

const STATUS_OPTIONS = ['All', 'New', 'Contacted', 'Qualified', 'Disqualified'];
const SOURCE_OPTIONS = ['All', 'DMA', 'Referral', 'Outbound', 'Inbound', 'Other'];

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

export function PipelineLeadsClient({ leads }: PipelineLeadsClientProps) {
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [sourceFilter, setSourceFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter leads
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const nameMatch = lead.name.toLowerCase().includes(query);
        const domainMatch = lead.domain?.toLowerCase().includes(query);
        const emailMatch = lead.email?.toLowerCase().includes(query);
        if (!nameMatch && !domainMatch && !emailMatch) return false;
      }

      // Status filter
      if (statusFilter !== 'All' && lead.status !== statusFilter) return false;

      // Source filter
      if (sourceFilter !== 'All' && lead.source !== sourceFilter) return false;

      return true;
    });
  }, [leads, statusFilter, sourceFilter, searchQuery]);

  // Stats by status
  const stats = useMemo(() => {
    const newCount = leads.filter((l) => l.status === 'New').length;
    const contacted = leads.filter((l) => l.status === 'Contacted').length;
    const qualified = leads.filter((l) => l.status === 'Qualified').length;
    const converted = leads.filter((l) => l.companyId || l.opportunityId).length;
    return { newCount, contacted, qualified, converted };
  }, [leads]);

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
          <h2 className="text-xl font-semibold text-slate-300 mb-2">
            No Leads Yet
          </h2>
          <p className="text-slate-500 mb-6">
            Leads will appear here from DMA audits, referrals, and outreach.
          </p>
          <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg text-left">
            <p className="text-sm text-blue-300">
              <strong>To set up leads:</strong>
            </p>
            <ul className="mt-2 space-y-1 text-sm text-blue-300">
              <li>• Create a "Leads" table in Airtable</li>
              <li>• Fields: Name, Domain, Email, Source, Status, Notes</li>
              <li>• Link to Companies and Opportunities tables</li>
            </ul>
          </div>
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
          <div className="text-2xl font-bold text-emerald-400">{stats.converted}</div>
          <div className="text-xs text-slate-500">Converted</div>
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
              placeholder="Search by name, domain, or email..."
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
                  Name
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Domain
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Source
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Status
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
                      <div className="text-slate-200 font-medium">{lead.name}</div>
                      {lead.email && (
                        <div className="text-xs text-slate-500">{lead.email}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {lead.domain || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-700 text-slate-300">
                      {lead.source}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        lead.status === 'New'
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                          : lead.status === 'Contacted'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          : lead.status === 'Qualified'
                          ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                          : lead.status === 'Disqualified'
                          ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                          : 'bg-slate-500/10 text-slate-400 border border-slate-500/30'
                      }`}
                    >
                      {lead.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {formatDate(lead.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {lead.companyId ? (
                        <Link
                          href={`/os/companies/${lead.companyId}`}
                          className="text-xs text-emerald-500 hover:text-emerald-400 font-medium"
                        >
                          View Company
                        </Link>
                      ) : (
                        <button className="text-xs text-amber-500 hover:text-amber-400 font-medium">
                          Create Company
                        </button>
                      )}
                      {lead.domain && !lead.companyId && (
                        <Link
                          href={`/snapshot?url=${encodeURIComponent(lead.domain)}`}
                          className="text-xs text-blue-500 hover:text-blue-400 font-medium"
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
