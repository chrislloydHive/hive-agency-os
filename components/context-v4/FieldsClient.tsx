'use client';

// components/context-v4/FieldsClient.tsx
// All Fields Client Component
//
// Searchable table view of all context fields across all domains.
// Shows status (confirmed/proposed/missing), source, confidence, and value.

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type {
  FactSheetResponseV4,
  FactSheetDomainV4,
  ContextFieldV4,
  MissingFieldInfoV4,
} from '@/lib/types/contextField';

// Extended domain type with missingFields
interface FactSheetDomainExtended extends FactSheetDomainV4 {
  missingFields?: MissingFieldInfoV4[];
}

// Extended response type
interface FactSheetResponseExtended extends Omit<FactSheetResponseV4, 'domains'> {
  domains: FactSheetDomainExtended[];
}

// Unified field type for display
interface DisplayField {
  key: string;
  label: string;
  domain: string;
  domainLabel: string;
  status: 'confirmed' | 'proposed' | 'missing';
  value?: unknown;
  source?: string;
  confidence?: number;
  lockedAt?: string;
  canPropose?: boolean;
  explanation?: string;
}

interface FieldsClientProps {
  companyId: string;
  companyName: string;
  initialQuery?: string;
  initialStatus?: string;
  initialDomain?: string;
}

export function FieldsClient({
  companyId,
  initialQuery = '',
  initialStatus = '',
  initialDomain = '',
}: FieldsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [data, setData] = useState<FactSheetResponseExtended | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [query, setQuery] = useState(initialQuery);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [domainFilter, setDomainFilter] = useState(initialDomain);

  // Fetch data
  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(
          `/api/os/companies/${companyId}/context/v4`,
          { cache: 'no-store' }
        );
        const json = await response.json();

        if (!json.ok) {
          throw new Error(json.error || 'Failed to load fields');
        }

        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [companyId]);

  // Convert data to flat list of fields
  const allFields = useMemo((): DisplayField[] => {
    if (!data) return [];

    const fields: DisplayField[] = [];

    for (const domain of data.domains) {
      // Confirmed fields
      for (const field of domain.confirmed) {
        fields.push({
          key: field.key,
          label: field.key.split('.').slice(1).join('.'),
          domain: domain.domain,
          domainLabel: domain.label,
          status: 'confirmed',
          value: field.value,
          source: field.source,
          confidence: field.confidence,
          lockedAt: field.lockedAt,
        });
      }

      // Missing fields
      if (domain.missingFields) {
        for (const field of domain.missingFields) {
          fields.push({
            key: field.key,
            label: field.label,
            domain: domain.domain,
            domainLabel: domain.label,
            status: 'missing',
            canPropose: field.canPropose,
            explanation: field.explanation,
          });
        }
      }
    }

    return fields;
  }, [data]);

  // Filter fields
  const filteredFields = useMemo(() => {
    return allFields.filter((field) => {
      // Text search
      if (query) {
        const q = query.toLowerCase();
        const matchesKey = field.key.toLowerCase().includes(q);
        const matchesLabel = field.label.toLowerCase().includes(q);
        const matchesValue = field.value
          ? String(field.value).toLowerCase().includes(q)
          : false;
        if (!matchesKey && !matchesLabel && !matchesValue) {
          return false;
        }
      }

      // Status filter
      if (statusFilter && field.status !== statusFilter) {
        return false;
      }

      // Domain filter
      if (domainFilter && field.domain !== domainFilter) {
        return false;
      }

      return true;
    });
  }, [allFields, query, statusFilter, domainFilter]);

  // Get unique domains for filter
  const domains = useMemo(() => {
    if (!data) return [];
    return data.domains.map((d) => ({ id: d.domain, label: d.label }));
  }, [data]);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (query) params.set('q', query);
    else params.delete('q');
    if (statusFilter) params.set('status', statusFilter);
    else params.delete('status');
    if (domainFilter) params.set('domain', domainFilter);
    else params.delete('domain');

    const newUrl = params.toString()
      ? `/context-v4/${companyId}/fields?${params.toString()}`
      : `/context-v4/${companyId}/fields`;

    router.replace(newUrl, { scroll: false });
  }, [query, statusFilter, domainFilter, companyId, router, searchParams]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-red-400">
        <p>Error: {error}</p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
          <p className="text-slate-400 text-sm">Confirmed</p>
          <p className="text-2xl font-semibold text-green-400">
            {data.totalConfirmed}
          </p>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
          <p className="text-slate-400 text-sm">Proposed</p>
          <p className="text-2xl font-semibold text-amber-400">
            {data.totalProposed}
          </p>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
          <p className="text-slate-400 text-sm">Missing</p>
          <p className="text-2xl font-semibold text-slate-500">
            {data.totalMissing}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search fields..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          />
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
        >
          <option value="">All statuses</option>
          <option value="confirmed">Confirmed</option>
          <option value="proposed">Proposed</option>
          <option value="missing">Missing</option>
        </select>

        {/* Domain filter */}
        <select
          value={domainFilter}
          onChange={(e) => setDomainFilter(e.target.value)}
          className="px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
        >
          <option value="">All domains</option>
          {domains.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>

        {/* Clear filters */}
        {(query || statusFilter || domainFilter) && (
          <button
            onClick={() => {
              setQuery('');
              setStatusFilter('');
              setDomainFilter('');
            }}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Results count */}
      <p className="text-sm text-slate-500 mb-4">
        Showing {filteredFields.length} of {allFields.length} fields
      </p>

      {/* Fields Table */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800 text-left">
              <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                Field
              </th>
              <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                Domain
              </th>
              <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                Value
              </th>
              <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                Source
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {filteredFields.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-slate-500"
                >
                  No fields match your filters
                </td>
              </tr>
            ) : (
              filteredFields.map((field) => (
                <tr key={field.key} className="hover:bg-slate-800/30">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-white">
                      {field.label}
                    </p>
                    <p className="text-xs text-slate-500 truncate max-w-[200px]">
                      {field.key}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-slate-400">
                      {field.domainLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={field.status} />
                  </td>
                  <td className="px-4 py-3">
                    {field.status === 'confirmed' ? (
                      <p className="text-sm text-white truncate max-w-[250px]">
                        {formatValue(field.value)}
                      </p>
                    ) : field.status === 'missing' ? (
                      <p className="text-xs text-slate-600 italic">
                        {field.explanation || 'Not available'}
                      </p>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {field.source ? (
                      <span className="text-xs text-slate-500">
                        {field.source}
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: 'confirmed' | 'proposed' | 'missing' }) {
  const styles = {
    confirmed: 'bg-green-500/10 text-green-400 border-green-500/20',
    proposed: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    missing: 'bg-slate-700/50 text-slate-500 border-slate-600/50',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border ${styles[status]}`}
    >
      {status}
    </span>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '—';
  }
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(', ') : '—';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}
