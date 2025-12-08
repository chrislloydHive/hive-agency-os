'use client';

// app/c/[companyId]/brain/context/ContextEditorClient.tsx
// Context Editor Client Component
//
// Wraps the context editor UI with:
// - Toggle between Graph Editor and "What AI Sees" views
// - Provenance drawer integration
// - Diagnostics drawer integration
// - Inline field editing with autosave

import { useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';
import { DOMAIN_NAMES } from '@/lib/contextGraph/companyContextGraph';
import type { GraphFieldUi, ContextDomainId } from '@/lib/contextGraph/uiHelpers';
import { CONTEXT_DOMAIN_META } from '@/lib/contextGraph/uiHelpers';
import type { NeedsRefreshFlag } from '@/lib/contextGraph/contextHealth';
import type { ContextHealthScore } from '@/lib/contextGraph/health';
import type { GraphSanityReport } from '@/lib/contextGraph/diagnostics';
import type { ContextGatewayResult } from '@/lib/contextGraph/contextGateway';
import type { ProvenanceTag } from '@/lib/contextGraph/types';
import { FieldCard } from './components/FieldCard';
import { ContextProvenanceDrawer } from './components/ContextProvenanceDrawer';
import { ContextDiagnosticsDrawer } from './components/ContextDiagnosticsDrawer';
import { WhatAISeesView } from './components/WhatAISeesView';

// ============================================================================
// Types
// ============================================================================

interface ContextEditorClientProps {
  companyId: string;
  companyName: string;
  graph: CompanyContextGraph;
  fields: GraphFieldUi[];
  needsRefresh: NeedsRefreshFlag[];
  healthScore: ContextHealthScore;
  diagnostics: GraphSanityReport | null;
  aiContextData?: ContextGatewayResult | null;
}

type ViewMode = 'editor' | 'ai';

// ============================================================================
// Utility Functions
// ============================================================================

function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

// ============================================================================
// Main Component
// ============================================================================

export function ContextEditorClient({
  companyId,
  companyName,
  graph,
  fields,
  needsRefresh,
  healthScore,
  diagnostics,
  aiContextData,
}: ContextEditorClientProps) {
  // View mode toggle
  const [viewMode, setViewMode] = useState<ViewMode>('editor');

  // Domain navigation
  const [selectedDomain, setSelectedDomain] = useState<ContextDomainId>('identity');

  // Search and filters
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyMissing, setShowOnlyMissing] = useState(false);
  const [showOnlyStale, setShowOnlyStale] = useState(false);

  // Drawer states
  const [provenanceDrawerOpen, setProvenanceDrawerOpen] = useState(false);
  const [provenanceField, setProvenanceField] = useState<{
    path: string;
    label: string;
    value: string | null;
    provenance: ProvenanceTag[];
  } | null>(null);
  const [diagnosticsDrawerOpen, setDiagnosticsDrawerOpen] = useState(false);

  // Saving states
  const [savingField, setSavingField] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Group fields by domain
  const fieldsByDomain = useMemo(() => {
    const map = new Map<ContextDomainId, GraphFieldUi[]>();
    DOMAIN_NAMES.forEach((d) => map.set(d, []));
    fields.forEach((f) => {
      const arr = map.get(f.domain);
      if (arr) arr.push(f);
    });
    map.forEach((arr) => arr.sort((a, b) => a.label.localeCompare(b.label)));
    return map;
  }, [fields]);

  // Create needs-refresh lookup
  const needsRefreshByPath = useMemo(() => {
    const map = new Map<string, NeedsRefreshFlag>();
    needsRefresh.forEach((f) => {
      const path = `${f.domain}.${f.field}`;
      map.set(path, f);
    });
    return map;
  }, [needsRefresh]);

  // Calculate domain stats with health score (matching DomainSummaryPanel formula)
  const domainStats = useMemo(() => {
    const stats = new Map<ContextDomainId, { total: number; populated: number; issues: number; healthScore: number }>();
    DOMAIN_NAMES.forEach((domainId) => {
      const domainFields = fieldsByDomain.get(domainId) ?? [];
      const populated = domainFields.filter((f) => f.value !== null && f.value !== '').length;
      const issues = domainFields.filter((f) => needsRefreshByPath.has(f.path)).length;
      const total = domainFields.length;

      // Calculate population percentage
      const populationPct = total > 0 ? Math.round((populated / total) * 100) : 0;

      // Use population percentage directly as the health score for consistency
      // This matches what users expect: "30% populated" should show as "30%"
      const healthScore = populationPct;

      stats.set(domainId, { total, populated, issues, healthScore });
    });
    return stats;
  }, [fieldsByDomain, needsRefreshByPath]);

  // Filter fields for current domain
  const filteredFields = useMemo(() => {
    let domainFields = fieldsByDomain.get(selectedDomain) ?? [];

    // Apply search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      domainFields = domainFields.filter(
        (f) =>
          f.label.toLowerCase().includes(term) ||
          f.path.toLowerCase().includes(term) ||
          (f.value ?? '').toLowerCase().includes(term)
      );
    }

    // Apply missing filter
    if (showOnlyMissing) {
      domainFields = domainFields.filter((f) => f.value === null || f.value === '');
    }

    // Apply stale filter
    if (showOnlyStale) {
      domainFields = domainFields.filter((f) => needsRefreshByPath.has(f.path));
    }

    return domainFields;
  }, [fieldsByDomain, selectedDomain, searchTerm, showOnlyMissing, showOnlyStale, needsRefreshByPath]);

  // Count missing critical fields
  const missingCriticalCount = useMemo(() => {
    return needsRefresh.filter((f) => f.reason === 'missing').length;
  }, [needsRefresh]);

  // Handle field save
  const handleSaveField = useCallback(async (path: string, newValue: string) => {
    setSavingField(path);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const response = await fetch('/api/context/updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          path,
          value: newValue,
          updatedBy: 'human',
          createSnapshot: true,
        }),
      });

      const data = await response.json();

      if (data.ok) {
        setSaveSuccess(path);
        setTimeout(() => setSaveSuccess(null), 2000);
        // Reload to show updated data
        window.location.reload();
        return { success: true };
      } else {
        const error = data.blockedReason || data.error || 'Failed to save';
        setSaveError(error);
        return { success: false, error };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to save';
      setSaveError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setSavingField(null);
    }
  }, [companyId]);

  // Handle opening provenance drawer
  const handleOpenProvenance = useCallback((field: GraphFieldUi) => {
    setProvenanceField({
      path: field.path,
      label: field.label,
      value: field.value,
      provenance: field.provenance ?? [],
    });
    setProvenanceDrawerOpen(true);
  }, []);

  // Handle explain field (placeholder)
  const handleExplainField = useCallback((field: GraphFieldUi) => {
    // TODO: Implement explain field modal
    console.log('Explain field:', field.path);
  }, []);

  // Handle revert to source
  const handleRevertToSource = useCallback(async (provenanceIndex: number) => {
    if (!provenanceField) return;
    const prov = provenanceField.provenance[provenanceIndex];
    if (!prov) return;

    // The provenance item should contain the historical value
    // For now, just log - in practice, you'd need to fetch the historical value
    console.log('Revert to source:', prov.source, 'at index', provenanceIndex);
  }, [provenanceField]);

  // Handle lock field
  const handleLockField = useCallback(async () => {
    if (!provenanceField) return;

    try {
      const response = await fetch('/api/context/locks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          path: provenanceField.path,
          lockedBy: 'user',
          severity: 'soft',
          reason: 'Locked via Context Editor',
        }),
      });

      if (response.ok) {
        setProvenanceDrawerOpen(false);
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to lock field:', error);
    }
  }, [companyId, provenanceField]);

  const domainMeta = CONTEXT_DOMAIN_META[selectedDomain];

  return (
    <div className="flex h-full min-h-screen bg-slate-950 text-slate-50">
      {/* Left Sidebar - Domain Navigation */}
      <aside className="w-64 border-r border-slate-800 bg-slate-950/80 flex flex-col">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-800">
          <Link
            href={`/c/${companyId}/brain`}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            ← Brain
          </Link>
          <h1 className="mt-2 text-sm font-semibold text-slate-100">Context Editor</h1>
          <p className="mt-1 text-xs text-slate-500">
            Company knowledge graph
          </p>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-slate-800">
          <div className="relative">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search fields..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-900 pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400/60"
            />
          </div>
        </div>

        {/* Domain List */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {DOMAIN_NAMES.map((domainId) => {
            const meta = CONTEXT_DOMAIN_META[domainId];
            const stats = domainStats.get(domainId);
            const hasIssues = (stats?.issues ?? 0) > 0;
            const coverage = stats && stats.total > 0
              ? Math.round((stats.populated / stats.total) * 100)
              : 0;

            return (
              <button
                key={domainId}
                type="button"
                onClick={() => setSelectedDomain(domainId)}
                className={cn(
                  'flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-xs transition-colors',
                  selectedDomain === domainId
                    ? 'bg-slate-800 text-slate-50'
                    : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-100'
                )}
              >
                <span className="truncate">{meta.label}</span>
                <span className="flex items-center gap-1.5">
                  {hasIssues && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
                  <span className={cn(
                    'text-[10px]',
                    coverage >= 75 ? 'text-emerald-400' :
                    coverage >= 50 ? 'text-amber-400' :
                    'text-slate-500'
                  )}>
                    {coverage}%
                  </span>
                </span>
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-800">
          <button
            onClick={() => setDiagnosticsDrawerOpen(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            View Diagnostics
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header with View Toggle */}
        <header className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-6 py-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">
              {viewMode === 'editor' ? domainMeta.label : 'What AI Sees'}
            </div>
            {viewMode === 'editor' && domainMeta.description && (
              <div className="text-sm text-slate-300">{domainMeta.description}</div>
            )}
            {viewMode === 'ai' && (
              <div className="text-sm text-slate-300">
                AI-scoped view of company context
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* View Toggle */}
            <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('editor')}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  viewMode === 'editor'
                    ? 'bg-slate-700 text-slate-100'
                    : 'text-slate-400 hover:text-slate-200'
                )}
              >
                Graph Editor
              </button>
              <button
                onClick={() => setViewMode('ai')}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  viewMode === 'ai'
                    ? 'bg-slate-700 text-slate-100'
                    : 'text-slate-400 hover:text-slate-200'
                )}
              >
                What AI Sees
              </button>
            </div>

            {/* Quick Stats */}
            {viewMode === 'editor' && (
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span
                  className={cn(
                    'font-medium',
                    healthScore.overallScore >= 75 && 'text-emerald-400',
                    healthScore.overallScore >= 50 && healthScore.overallScore < 75 && 'text-amber-400',
                    healthScore.overallScore < 50 && 'text-red-400'
                  )}
                >
                  {Math.round(healthScore.overallScore)}% Health
                </span>
                {missingCriticalCount > 0 && (
                  <span className="text-red-400">
                    {missingCriticalCount} missing
                  </span>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Content Area */}
        {viewMode === 'editor' ? (
          <div className="flex-1 overflow-y-auto">
            {/* Filters Bar */}
            <div className="px-6 py-3 border-b border-slate-800 flex items-center gap-4">
              <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOnlyMissing}
                  onChange={(e) => setShowOnlyMissing(e.target.checked)}
                  className="h-3 w-3 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500/30"
                />
                Missing only
              </label>
              <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOnlyStale}
                  onChange={(e) => setShowOnlyStale(e.target.checked)}
                  className="h-3 w-3 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500/30"
                />
                Needs refresh
              </label>
              <div className="ml-auto text-xs text-slate-500">
                {filteredFields.length} field{filteredFields.length !== 1 ? 's' : ''}
              </div>
            </div>

            {/* Fields List */}
            <div className="p-6 space-y-3">
              {filteredFields.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-700 p-8 text-center">
                  <p className="text-sm text-slate-500">
                    {searchTerm || showOnlyMissing || showOnlyStale
                      ? 'No fields match the current filters.'
                      : 'No fields in this domain.'}
                  </p>
                </div>
              ) : (
                filteredFields.map((field) => {
                  const issue = needsRefreshByPath.get(field.path);
                  const isSaving = savingField === field.path;
                  const isSaveSuccess = saveSuccess === field.path;

                  return (
                    <div key={field.path} className="relative">
                      {/* Save status indicator */}
                      {isSaving && (
                        <div className="absolute inset-0 bg-slate-950/50 rounded-lg flex items-center justify-center z-10">
                          <div className="flex items-center gap-2 text-xs text-amber-400">
                            <div className="w-4 h-4 rounded-full border-2 border-amber-400/30 border-t-amber-400 animate-spin" />
                            Saving...
                          </div>
                        </div>
                      )}
                      {isSaveSuccess && (
                        <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-500/20 text-[10px] text-emerald-400">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Saved
                        </div>
                      )}
                      <FieldCard
                        field={field}
                        issue={issue}
                        companyId={companyId}
                        onOpenProvenance={handleOpenProvenance}
                        onExplainField={handleExplainField}
                        onSave={handleSaveField}
                        canEdit={true}
                      />
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6">
            <WhatAISeesView
              companyId={companyId}
              contextData={aiContextData}
            />
          </div>
        )}

        {/* Save Error Toast */}
        {saveError && (
          <div className="fixed bottom-6 right-6 z-50">
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-red-500/20 border border-red-500/30 shadow-lg">
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-red-300">{saveError}</span>
              <button
                onClick={() => setSaveError(null)}
                className="ml-2 text-red-400 hover:text-red-300"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Provenance Drawer */}
      {provenanceField && (
        <ContextProvenanceDrawer
          isOpen={provenanceDrawerOpen}
          onClose={() => {
            setProvenanceDrawerOpen(false);
            setProvenanceField(null);
          }}
          companyId={companyId}
          fieldPath={provenanceField.path}
          fieldLabel={provenanceField.label}
          currentValue={provenanceField.value}
          provenance={provenanceField.provenance}
          onRevertToSource={handleRevertToSource}
          onLockField={handleLockField}
        />
      )}

      {/* Diagnostics Drawer */}
      <ContextDiagnosticsDrawer
        isOpen={diagnosticsDrawerOpen}
        onClose={() => setDiagnosticsDrawerOpen(false)}
        companyId={companyId}
        healthScore={healthScore}
        diagnostics={diagnostics}
      />
    </div>
  );
}

export default ContextEditorClient;
