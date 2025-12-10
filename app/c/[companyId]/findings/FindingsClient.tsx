'use client';

// app/c/[companyId]/findings/FindingsClient.tsx
// Plan Page Client Component
//
// Strategic planning workspace that shows:
// - Summary snapshot with severity breakdown
// - View toggle: Themes / Priority / Lab / All
// - Themed/Priority/Lab grouped findings with cards
// - Detail drawer for individual findings
// - AI synthesis modal
// - Links to Diagnostics, QBR, Work

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Camera, Loader2, Lightbulb, BarChart3, ClipboardList } from 'lucide-react';
import { FindingsSummaryStrip } from './FindingsSummaryStrip';
import { FindingsFilters } from './FindingsFilters';
import { FindingsTable } from './FindingsTable';
import { FindingDetailDrawer } from './FindingDetailDrawer';
import { PlanSnapshot } from '@/components/plan/PlanSnapshot';
import { ViewToggle, type PlanViewType } from '@/components/plan/ViewToggle';
import { ThemeView } from '@/components/plan/ThemeView';
import { PriorityView } from '@/components/plan/PriorityView';
import { LabView } from '@/components/plan/LabView';
import { PlanSynthesisModal, type PlanSynthesis } from '@/components/plan/PlanSynthesisModal';
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
  const router = useRouter();

  // State
  const [findings, setFindings] = useState<DiagnosticDetailFinding[]>([]);
  const [summary, setSummary] = useState<FindingsSummary | null>(null);
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);

  // View state
  const [activeView, setActiveView] = useState<PlanViewType>('themes');

  // Filters
  const [selectedLabs, setSelectedLabs] = useState<string[]>([]);
  const [selectedSeverities, setSelectedSeverities] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [showConverted, setShowConverted] = useState<'all' | 'no' | 'only'>('all');

  // Selected finding for drawer
  const [selectedFinding, setSelectedFinding] = useState<DiagnosticDetailFinding | null>(null);

  // AI Synthesis state
  const [showSynthesisModal, setShowSynthesisModal] = useState(false);
  const [synthesis, setSynthesis] = useState<PlanSynthesis | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthesisError, setSynthesisError] = useState<string | null>(null);

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

  // Handle bulk conversion to work items
  const handleBulkConvert = useCallback(async (findingsToConvert: DiagnosticDetailFinding[]) => {
    try {
      const response = await fetch(`/api/os/companies/${company.id}/work/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: findingsToConvert.map(f => ({
            title: f.description || 'Finding from diagnostic',
            description: f.recommendation || '',
            priority: f.severity === 'critical' || f.severity === 'high' ? 'P1' :
                     f.severity === 'medium' ? 'P2' : 'P3',
            domain: f.category || f.labSlug || 'Other',
            sourceLabSlug: f.labSlug,
            sourceRunId: f.labRunId,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Failed to create work items');
      }

      // Refresh findings to show updated status
      fetchFindings();
    } catch (err) {
      console.error('[FindingsClient] Error bulk converting:', err);
      throw err;
    }
  }, [company.id, fetchFindings]);

  // Handle creating a plan snapshot
  const handleCreateSnapshot = useCallback(async () => {
    setIsCreatingSnapshot(true);
    try {
      const response = await fetch(`/api/os/companies/${company.id}/snapshot/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create snapshot');
      }

      // Navigate to reports page
      router.push(`/c/${company.id}/reports`);
    } catch (err) {
      console.error('[FindingsClient] Error creating snapshot:', err);
    } finally {
      setIsCreatingSnapshot(false);
    }
  }, [company.id, router]);

  // Handle AI synthesis
  const handleSynthesize = useCallback(async () => {
    setShowSynthesisModal(true);
    setIsSynthesizing(true);
    setSynthesisError(null);

    try {
      const response = await fetch(`/api/os/companies/${company.id}/plan/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate synthesis');
      }

      setSynthesis(data.synthesis);
    } catch (err) {
      console.error('[FindingsClient] Error synthesizing plan:', err);
      setSynthesisError(err instanceof Error ? err.message : 'Failed to generate synthesis');
    } finally {
      setIsSynthesizing(false);
    }
  }, [company.id]);

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
          <h1 className="text-2xl font-bold text-white">Plan</h1>
          <p className="text-sm text-slate-400 mt-1">
            Prioritize findings and build your strategic roadmap
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/c/${company.id}/blueprint`}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition-all text-sm font-medium"
          >
            <Lightbulb className="w-4 h-4" />
            Run Diagnostics
          </Link>
          <Link
            href={`/c/${company.id}/work`}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition-all text-sm font-medium"
          >
            <ClipboardList className="w-4 h-4" />
            View Work
          </Link>
          <button
            onClick={handleCreateSnapshot}
            disabled={isCreatingSnapshot}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition-all text-sm font-semibold disabled:opacity-50"
          >
            {isCreatingSnapshot ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Camera className="w-4 h-4" />
            )}
            Generate Snapshot
          </button>
        </div>
      </div>

      {/* Plan Snapshot Strip */}
      <PlanSnapshot
        summary={summary}
        loading={loading}
        onSynthesize={handleSynthesize}
        isSynthesizing={isSynthesizing}
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

      {/* View Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* View Toggle */}
        <ViewToggle activeView={activeView} onViewChange={setActiveView} />

        {/* Filters (only show for 'all' view or when filters are active) */}
        {(activeView === 'all' || hasActiveFilters) && (
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
        )}
      </div>

      {/* Main Content - Different Views */}
      {activeView === 'themes' && (
        <ThemeView
          findings={findings}
          onConvert={handleConvertToWorkItem}
          onSelectFinding={handleSelectFinding}
        />
      )}

      {activeView === 'priority' && (
        <PriorityView
          findings={findings}
          onConvert={handleConvertToWorkItem}
          onSelectFinding={handleSelectFinding}
        />
      )}

      {activeView === 'lab' && (
        <LabView
          findings={findings}
          onConvert={handleConvertToWorkItem}
          onSelectFinding={handleSelectFinding}
        />
      )}

      {activeView === 'all' && (
        <FindingsTable
          findings={findings}
          loading={loading}
          onSelectFinding={handleSelectFinding}
          selectedFindingId={selectedFinding?.id}
          companyId={company.id}
          onBulkConvert={handleBulkConvert}
        />
      )}

      {/* Finding Detail Drawer */}
      <FindingDetailDrawer
        finding={selectedFinding}
        onClose={() => setSelectedFinding(null)}
        onConvertToWorkItem={handleConvertToWorkItem}
        companyId={company.id}
      />

      {/* AI Synthesis Modal */}
      <PlanSynthesisModal
        isOpen={showSynthesisModal}
        onClose={() => setShowSynthesisModal(false)}
        synthesis={synthesis}
        isLoading={isSynthesizing}
        error={synthesisError}
      />
    </div>
  );
}
