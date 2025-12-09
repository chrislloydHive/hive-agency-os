'use client';

// app/c/[companyId]/findings/FindingsClient.tsx
// Plan Page Client Component (formerly "Findings")
//
// Strategic planning surface that shows:
// - Summary strip showing counts by severity
// - Filters for labs, severities, categories, converted status
// - Table of prioritized findings from all diagnostics
// - Detail drawer for individual findings with "Add to Work" CTA
// - Links to run more diagnostics and generate formal reports

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { FindingsSummaryStrip } from './FindingsSummaryStrip';
import { FindingsFilters } from './FindingsFilters';
import { FindingsTable } from './FindingsTable';
import { FindingDetailDrawer } from './FindingDetailDrawer';
import type { DiagnosticDetailFinding } from '@/lib/airtable/diagnosticDetails';
import type { FindingsSummary, FindingsFilter } from '@/lib/os/findings/companyFindings';

// ============================================================================
// Types
// ============================================================================

interface CompanyData {
  id: string;
  name: string;
  website?: string | null;
}

export interface FindingsClientProps {
  company: CompanyData;
}

interface FilterOption {
  value: string;
  label: string;
  color?: string;
}

interface FilterOptions {
  labs: FilterOption[];
  severities: FilterOption[];
  categories: FilterOption[];
}

// ============================================================================
// Main Component
// ============================================================================

export function FindingsClient({ company }: FindingsClientProps) {
  // State
  const [findings, setFindings] = useState<DiagnosticDetailFinding[]>([]);
  const [summary, setSummary] = useState<FindingsSummary | null>(null);
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedLabs, setSelectedLabs] = useState<string[]>([]);
  const [selectedSeverities, setSelectedSeverities] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [showConverted, setShowConverted] = useState<'all' | 'no' | 'only'>('all');

  // Selected finding for drawer
  const [selectedFinding, setSelectedFinding] = useState<DiagnosticDetailFinding | null>(null);

  // Fetch findings
  const fetchFindings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();

      if (selectedLabs.length > 0) {
        params.set('labs', selectedLabs.join(','));
      }
      if (selectedSeverities.length > 0) {
        params.set('severities', selectedSeverities.join(','));
      }
      if (selectedCategories.length > 0) {
        params.set('categories', selectedCategories.join(','));
      }
      if (showConverted === 'no') {
        params.set('converted', 'false');
      } else if (showConverted === 'only') {
        params.set('converted', 'only');
      }

      const url = `/api/os/companies/${company.id}/findings?${params.toString()}`;
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch findings');
      }

      setFindings(data.findings || []);
      setSummary(data.summary || null);
      setFilterOptions(data.filterOptions || null);
    } catch (err) {
      console.error('[FindingsClient] Error fetching findings:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch findings');
    } finally {
      setLoading(false);
    }
  }, [company.id, selectedLabs, selectedSeverities, selectedCategories, showConverted]);

  // Initial fetch
  useEffect(() => {
    fetchFindings();
  }, [fetchFindings]);

  // Handle finding selection
  const handleSelectFinding = useCallback((finding: DiagnosticDetailFinding | null) => {
    setSelectedFinding(finding);
  }, []);

  // Handle work item conversion
  const handleConvertToWorkItem = useCallback(async (finding: DiagnosticDetailFinding) => {
    if (!finding.id) return;

    try {
      const response = await fetch(`/api/os/findings/${finding.id}/convert-to-work-item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ finding }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to convert to work item');
      }

      // Update the finding in state
      setFindings(prev => prev.map(f =>
        f.id === finding.id ? { ...f, isConvertedToWorkItem: true, workItemId: data.workItem.id } : f
      ));

      // Update selected finding if it's the same
      if (selectedFinding?.id === finding.id) {
        setSelectedFinding({ ...selectedFinding, isConvertedToWorkItem: true, workItemId: data.workItem.id });
      }

      // Refresh to get updated summary
      fetchFindings();

      return data.workItem;
    } catch (err) {
      console.error('[FindingsClient] Error converting to work item:', err);
      throw err;
    }
  }, [selectedFinding, fetchFindings]);

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setSelectedLabs([]);
    setSelectedSeverities([]);
    setSelectedCategories([]);
    setShowConverted('all');
  }, []);

  const hasActiveFilters =
    selectedLabs.length > 0 ||
    selectedSeverities.length > 0 ||
    selectedCategories.length > 0 ||
    showConverted !== 'all';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Plan</h1>
          <p className="text-sm text-slate-400 mt-1">
            Prioritize findings from diagnostics and build your strategic roadmap
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/c/${company.id}/blueprint`}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20 transition-all text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Run Diagnostics
          </Link>
          <Link
            href={`/c/${company.id}/reports/qbr`}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/30 hover:bg-purple-500/20 transition-all text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Generate QBR
          </Link>
          <Link
            href={`/c/${company.id}/work`}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            View Work
          </Link>
        </div>
      </div>

      {/* Summary Strip */}
      <FindingsSummaryStrip summary={summary} loading={loading} />

      {/* Filters */}
      <FindingsFilters
        filterOptions={filterOptions}
        selectedLabs={selectedLabs}
        selectedSeverities={selectedSeverities}
        selectedCategories={selectedCategories}
        showConverted={showConverted}
        onLabsChange={setSelectedLabs}
        onSeveritiesChange={setSelectedSeverities}
        onCategoriesChange={setSelectedCategories}
        onConvertedChange={setShowConverted}
        onClearFilters={handleClearFilters}
        hasActiveFilters={hasActiveFilters}
        loading={loading}
      />

      {/* Error State */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
          <button
            onClick={fetchFindings}
            className="mt-2 text-sm text-red-300 hover:text-red-200 underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Findings Table */}
      <FindingsTable
        findings={findings}
        loading={loading}
        onSelectFinding={handleSelectFinding}
        selectedFindingId={selectedFinding?.id}
        companyId={company.id}
      />

      {/* Finding Detail Drawer */}
      <FindingDetailDrawer
        finding={selectedFinding}
        onClose={() => setSelectedFinding(null)}
        onConvertToWorkItem={handleConvertToWorkItem}
        companyId={company.id}
      />
    </div>
  );
}
