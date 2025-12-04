'use client';

// app/c/[companyId]/context/ContextExplorerClient.tsx
// Context Explorer with 2-column layout: Table + Force-Directed Graph
//
// This component extends the existing ContextGraphViewer with a
// force-directed graph visualization panel.

import { useState, useCallback, useMemo, useEffect } from 'react';
import Link from 'next/link';
import type { CompanyContextGraph, DomainName } from '@/lib/contextGraph/companyContextGraph';
import { DOMAIN_NAMES } from '@/lib/contextGraph/companyContextGraph';
import type { ContextGraphHealth } from '@/lib/contextGraph/health';
import type { NeedsRefreshReport } from '@/lib/contextGraph/needsRefresh';
import type { GraphFieldUi } from '@/lib/contextGraph/uiHelpers';
import { CONTEXT_DOMAIN_META } from '@/lib/contextGraph/uiHelpers';
import {
  type GraphMode,
  type GraphData,
  type GraphNode,
  type SnapshotInfo,
  getContextGraphForSection,
} from '@/lib/contextGraph/graphView';
import { ContextGraphPanel } from './ContextGraphPanel';

// ============================================================================
// Types
// ============================================================================

interface ContextExplorerClientProps {
  companyId: string;
  companyName: string;
  initialGraph: CompanyContextGraph;
  isNewGraph: boolean;
  health: ContextGraphHealth;
  domainCoverage: Record<DomainName, number>;
  refreshReport: NeedsRefreshReport | null;
  fields: GraphFieldUi[];
  snapshots: SnapshotInfo[];
}

// ============================================================================
// Helper Functions
// ============================================================================

function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

// ============================================================================
// Main Component
// ============================================================================

export function ContextExplorerClient({
  companyId,
  companyName,
  initialGraph,
  isNewGraph,
  health,
  domainCoverage,
  refreshReport,
  fields,
  snapshots,
}: ContextExplorerClientProps) {
  const [graph] = useState<CompanyContextGraph>(initialGraph);
  const [selectedDomain, setSelectedDomain] = useState<DomainName>('identity');
  const [graphMode, setGraphMode] = useState<GraphMode>('field');
  const [activeSnapshotId, setActiveSnapshotId] = useState<string>('now');
  const [highlightedFieldPath, setHighlightedFieldPath] = useState<string | null>(null);
  const [showOnlyWithValue, setShowOnlyWithValue] = useState(false);
  const [showGraphPanel, setShowGraphPanel] = useState(true);
  const [highlightedRowPath, setHighlightedRowPath] = useState<string | null>(null);

  // Group fields by domain
  const fieldsByDomain = useMemo(() => {
    const map = new Map<DomainName, GraphFieldUi[]>();
    DOMAIN_NAMES.forEach((d) => map.set(d, []));
    fields.forEach((f) => {
      const arr = map.get(f.domain as DomainName);
      if (arr) arr.push(f);
    });
    map.forEach((arr) => arr.sort((a, b) => a.label.localeCompare(b.label)));
    return map;
  }, [fields]);

  // Get refresh flags for current domain
  const domainNeedsRefresh = useMemo(() => {
    if (!refreshReport) return [];
    const domainReport = refreshReport.domains.find(d => d.domain === selectedDomain);
    return domainReport?.fields ?? [];
  }, [refreshReport, selectedDomain]);

  // Filter fields for current domain
  const filteredFields = useMemo(() => {
    let domainFields = fieldsByDomain.get(selectedDomain) ?? [];

    if (showOnlyWithValue) {
      domainFields = domainFields.filter((f) => f.value !== null && f.value !== '');
    }

    return domainFields;
  }, [fieldsByDomain, selectedDomain, showOnlyWithValue]);

  // Generate graph data for current section and mode
  const graphData: GraphData = useMemo(() => {
    return getContextGraphForSection(graph, selectedDomain, graphMode);
  }, [graph, selectedDomain, graphMode]);

  const domainMeta = CONTEXT_DOMAIN_META[selectedDomain];

  // Handle graph node click - scroll table to field
  const handleGraphNodeClick = useCallback((node: GraphNode) => {
    if (node.type === 'field' && node.path) {
      setHighlightedRowPath(node.path);

      // Scroll to the row
      const rowElement = document.getElementById(`field-row-${node.path}`);
      if (rowElement) {
        rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      // Clear highlight after animation
      setTimeout(() => setHighlightedRowPath(null), 2000);
    }
  }, []);

  // Handle table row click - highlight in graph
  const handleTableRowClick = useCallback((fieldPath: string) => {
    setHighlightedFieldPath(fieldPath);
    setTimeout(() => setHighlightedFieldPath(null), 2000);
  }, []);

  return (
    <div className="flex h-screen bg-slate-950 text-slate-50">
      {/* Sidebar */}
      <aside className="w-56 border-r border-slate-900 bg-slate-950/80 flex flex-col flex-shrink-0">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-900">
          <Link
            href={`/c/${companyId}`}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            ← {companyName}
          </Link>
          <h1 className="mt-2 text-sm font-semibold text-slate-100">Context Explorer</h1>
          <p className="mt-1 text-[10px] text-slate-500">
            Force-directed graph visualization
          </p>
        </div>

        {/* Context Health */}
        <div className="p-4 border-b border-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wide text-slate-500">Health</span>
            <span
              className={cn(
                'text-sm font-semibold',
                health.completenessScore >= 75 && 'text-emerald-400',
                health.completenessScore >= 50 && health.completenessScore < 75 && 'text-amber-400',
                health.completenessScore < 50 && 'text-red-400'
              )}
            >
              {health.completenessScore}%
            </span>
          </div>
          {refreshReport && refreshReport.totalStaleFields > 0 && (
            <p className="mt-1 text-[10px] text-amber-400">
              {refreshReport.totalStaleFields} stale fields
            </p>
          )}
        </div>

        {/* Domain Navigation */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {DOMAIN_NAMES.map((domainId) => {
            const meta = CONTEXT_DOMAIN_META[domainId];
            const domainFields = fieldsByDomain.get(domainId) ?? [];
            const populatedCount = domainFields.filter((f) => f.value !== null && f.value !== '').length;
            const coverage = domainCoverage[domainId] ?? 0;

            return (
              <button
                key={domainId}
                type="button"
                onClick={() => setSelectedDomain(domainId)}
                className={cn(
                  'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[11px] transition-colors',
                  selectedDomain === domainId
                    ? 'bg-slate-900 text-slate-50'
                    : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-100'
                )}
              >
                <span className="truncate">{meta.label}</span>
                <span className="flex items-center gap-1">
                  {coverage < 30 && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
                  <span className="text-[9px] text-slate-500">
                    {populatedCount}/{domainFields.length}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>

        {/* Graph Toggle */}
        <div className="p-4 border-t border-slate-900">
          <button
            onClick={() => setShowGraphPanel(!showGraphPanel)}
            className={cn(
              'w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors',
              showGraphPanel
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            )}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            {showGraphPanel ? 'Hide Graph' : 'Show Graph'}
          </button>
        </div>
      </aside>

      {/* Main Content Area - Split View */}
      <main className="flex-1 flex min-w-0 overflow-hidden">
        {/* Left: Table View */}
        <section className={cn(
          'flex-1 flex flex-col min-w-0 overflow-hidden transition-all duration-300',
          showGraphPanel ? 'xl:w-[60%] xl:flex-none' : 'w-full'
        )}>
          {/* Header */}
          <header className="flex items-center justify-between border-b border-slate-900 bg-slate-950/80 px-6 py-3 flex-shrink-0">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">
                {domainMeta.label}
              </div>
              {domainMeta.description && (
                <div className="text-sm text-slate-300">{domainMeta.description}</div>
              )}
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOnlyWithValue}
                  onChange={(e) => setShowOnlyWithValue(e.target.checked)}
                  className="h-3 w-3 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500/30"
                />
                With values only
              </label>
              <span className="text-[11px] text-slate-500">
                {filteredFields.length} field{filteredFields.length !== 1 ? 's' : ''}
              </span>
            </div>
          </header>

          {/* Table Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {isNewGraph && (
              <div className="mb-6 rounded-lg border border-slate-800 bg-slate-900/50 p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-slate-200">No context graph yet</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Run Labs or add fields manually to build the context graph.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {filteredFields.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-800 bg-slate-950/60 p-8 text-center">
                <p className="text-sm text-slate-500">
                  {showOnlyWithValue
                    ? 'No fields with values in this domain.'
                    : 'No fields in this domain.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredFields.map((field) => {
                  const needsRefresh = domainNeedsRefresh.some(f => f.field === field.path.split('.').pop());
                  const isHighlighted = highlightedRowPath === field.path;

                  return (
                    <div
                      key={field.path}
                      id={`field-row-${field.path}`}
                      onClick={() => handleTableRowClick(field.path)}
                      className={cn(
                        'rounded-lg border p-3 cursor-pointer transition-all duration-300',
                        isHighlighted
                          ? 'border-amber-500 bg-amber-500/10'
                          : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-200">{field.label}</span>
                            {needsRefresh && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-500/20 text-amber-300">
                                Stale
                              </span>
                            )}
                            {field.provenance.some(p => p.source === 'manual' || p.source === 'user') && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-yellow-500/20 text-yellow-300">
                                Human
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">{field.path}</div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          {field.freshness && (
                            <div className="text-[10px] text-slate-500">
                              {Math.round(field.freshness.normalized * 100)}% fresh
                            </div>
                          )}
                        </div>
                      </div>

                      {field.value ? (
                        <div className="mt-2 text-xs text-slate-300 bg-slate-800/50 rounded px-2 py-1.5 font-mono truncate">
                          {field.value.length > 150 ? `${field.value.slice(0, 150)}...` : field.value}
                        </div>
                      ) : (
                        <div className="mt-2 text-xs text-slate-500 italic">No value</div>
                      )}

                      {field.provenance.length > 0 && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-[10px] text-slate-500">Source:</span>
                          <span className="text-[10px] text-slate-400">{field.provenance[0].source}</span>
                          {field.provenance[0].confidence !== undefined && (
                            <span className="text-[10px] text-slate-500">
                              ({Math.round(field.provenance[0].confidence * 100)}% confidence)
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Right: Graph Panel */}
        {showGraphPanel && (
          <section className="hidden xl:flex w-[40%] flex-shrink-0">
            <ContextGraphPanel
              companyId={companyId}
              sectionId={selectedDomain}
              sectionLabel={domainMeta.label}
              graphData={graphData}
              snapshots={snapshots}
              activeSnapshotId={activeSnapshotId}
              onSnapshotChange={setActiveSnapshotId}
              onModeChange={setGraphMode}
              mode={graphMode}
              onNodeClick={handleGraphNodeClick}
              highlightedFieldPath={highlightedFieldPath}
            />
          </section>
        )}
      </main>
    </div>
  );
}
