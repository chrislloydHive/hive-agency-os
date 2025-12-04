'use client';

// app/c/[companyId]/context-graph/ContextGraphClient.tsx
// Context Graph Viewer & Editor - Main Client Component

import { useState, useCallback } from 'react';
import Link from 'next/link';
import type { CompanyContextGraph, DomainName } from '@/lib/contextGraph/companyContextGraph';
import type { ContextGraphHealth } from '@/lib/contextGraph/health';
import type { NeedsRefreshReport } from '@/lib/contextGraph/needsRefresh';
import { DomainNav, DOMAIN_CONFIG } from './components/DomainNav';
import { FieldTable } from './components/FieldTable';
import { FieldEditorDrawer } from './components/FieldEditorDrawer';
import { ProvenanceDrawer } from './components/ProvenanceDrawer';
import { RawJsonView } from './components/RawJsonView';
import { DataUnavailableBanner } from '@/components/ui/DataUnavailableBanner';

interface ContextGraphClientProps {
  companyId: string;
  companyName: string;
  initialGraph: CompanyContextGraph;
  isNewGraph: boolean;
  health: ContextGraphHealth;
  domainCoverage: Record<DomainName, number>;
  refreshReport: NeedsRefreshReport | null;
}

export function ContextGraphClient({
  companyId,
  companyName,
  initialGraph,
  isNewGraph,
  health,
  domainCoverage,
  refreshReport,
}: ContextGraphClientProps) {
  const [graph, setGraph] = useState<CompanyContextGraph>(initialGraph);
  const [selectedDomain, setSelectedDomain] = useState<string>('identity');
  const [showRawJson, setShowRawJson] = useState(false);
  const [editingField, setEditingField] = useState<{ path: string; value: unknown; provenance: unknown[] } | null>(null);
  const [viewingHistory, setViewingHistory] = useState<{ path: string; provenance: unknown[] } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  // Handle running fusion to populate graph from real data
  const handleRunFusion = useCallback(async () => {
    if (!confirm('Build context graph from company data, diagnostics, and insights? This may take a few seconds.')) {
      return;
    }

    setIsSeeding(true);
    try {
      const response = await fetch(`/api/context-graph/${companyId}/fusion`, {
        method: 'POST',
      });

      if (response.ok) {
        // Reload the page to get fresh data
        window.location.reload();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to build context graph');
      }
    } catch (error) {
      console.error('Failed to build context graph:', error);
      alert('Failed to build context graph');
    } finally {
      setIsSeeding(false);
    }
  }, [companyId]);

  // Build domain stats from refresh report
  const domainStats = DOMAIN_CONFIG.map(domain => {
    const coverage = domainCoverage[domain.id as DomainName] ?? 0;
    const domainFlags = refreshReport?.domains.find(d => d.domain === domain.id);

    return {
      ...domain,
      coverage,
      staleCount: domainFlags?.staleFieldCount ?? 0,
      missingCount: coverage === 0 ? 1 : 0, // Simplified - domain is "missing" if 0% coverage
    };
  });

  // Handle field edit
  const handleEdit = useCallback((path: string, value: unknown, provenance: unknown[]) => {
    setEditingField({ path, value, provenance });
  }, []);

  // Handle field clear
  const handleClear = useCallback(async (path: string) => {
    if (!confirm(`Clear value for "${path}"? This will set it to null but keep previous provenance.`)) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/context-graph/${companyId}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path,
          value: null,
          action: 'clear',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.graph) {
          setGraph(data.graph);
        }
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to clear field');
      }
    } catch (error) {
      console.error('Failed to clear field:', error);
      alert('Failed to clear field');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  // Handle view history
  const handleViewHistory = useCallback((path: string, provenance: unknown[]) => {
    setViewingHistory({ path, provenance });
  }, []);

  // Handle save from editor
  const handleSave = useCallback(async (path: string, newValue: unknown) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/context-graph/${companyId}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path,
          value: newValue,
          action: 'edit',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.graph) {
          setGraph(data.graph);
        }
        setEditingField(null);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to save field');
      }
    } catch (error) {
      console.error('Failed to save field:', error);
      alert('Failed to save field');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  // Get health status colors
  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-emerald-400 bg-emerald-500/20';
      case 'partial': return 'text-amber-400 bg-amber-500/20';
      case 'empty': return 'text-slate-400 bg-slate-500/20';
      case 'unavailable': return 'text-red-400 bg-red-500/20';
      default: return 'text-slate-400 bg-slate-500/20';
    }
  };

  return (
    <div className="flex h-[calc(100vh-60px)]">
      {/* Left Sidebar - Domain Navigation */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-800">
          <Link
            href={`/c/${companyId}`}
            className="text-sm text-slate-500 hover:text-slate-300 flex items-center gap-1"
          >
            ← Back to Overview
          </Link>
          <h1 className="text-lg font-semibold text-slate-100 mt-3">
            Context Graph
          </h1>
          <p className="text-sm text-slate-500 mt-1">{companyName}</p>
        </div>

        {/* Health Summary */}
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 uppercase tracking-wide">Health</span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getHealthColor(health.status)}`}>
              {health.completenessScore}%
            </span>
          </div>
          {refreshReport && refreshReport.totalStaleFields > 0 && (
            <p className="text-xs text-amber-400">
              {refreshReport.totalStaleFields} fields need refresh
            </p>
          )}
        </div>

        {/* Domain Navigation */}
        <DomainNav
          domains={domainStats}
          selectedDomainId={selectedDomain}
          onSelect={setSelectedDomain}
        />

        {/* Actions */}
        <div className="mt-auto p-4 border-t border-slate-800">
          <button
            onClick={() => setShowRawJson(true)}
            className="w-full px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            View Raw JSON
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-slate-950 p-6">
        <div className="max-w-5xl mx-auto">
          {/* New Graph Banner */}
          {isNewGraph && (
            <div className="mb-6">
              <DataUnavailableBanner
                title="No context graph exists yet"
                description="It will be created as you run Labs or edit fields here. You can also manually add values below."
                variant="info"
              />
              <button
                  onClick={handleRunFusion}
                  disabled={isSeeding}
                  className="mt-3 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  {isSeeding ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Building...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Build from Company Data
                    </>
                  )}
                </button>
            </div>
          )}

          {/* Domain Header */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-slate-100 capitalize">
              {DOMAIN_CONFIG.find(d => d.id === selectedDomain)?.label || selectedDomain}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {domainCoverage[selectedDomain as DomainName] ?? 0}% coverage
              {domainStats.find(d => d.id === selectedDomain)?.staleCount ? (
                <span className="text-amber-400 ml-2">
                  • {domainStats.find(d => d.id === selectedDomain)?.staleCount} stale fields
                </span>
              ) : null}
            </p>
          </div>

          {/* Field Table */}
          <FieldTable
            domainId={selectedDomain}
            graph={graph}
            refreshReport={refreshReport}
            onEdit={handleEdit}
            onClear={handleClear}
            onViewHistory={handleViewHistory}
            isLoading={isLoading}
          />
        </div>
      </main>

      {/* Editor Drawer */}
      {editingField && (
        <FieldEditorDrawer
          path={editingField.path}
          value={editingField.value}
          provenance={editingField.provenance}
          onSave={handleSave}
          onClose={() => setEditingField(null)}
          isLoading={isLoading}
        />
      )}

      {/* History Drawer */}
      {viewingHistory && (
        <ProvenanceDrawer
          path={viewingHistory.path}
          provenance={viewingHistory.provenance}
          onClose={() => setViewingHistory(null)}
        />
      )}

      {/* Raw JSON Modal */}
      {showRawJson && (
        <RawJsonView
          graph={graph}
          onClose={() => setShowRawJson(false)}
        />
      )}
    </div>
  );
}
