'use client';

// app/c/[companyId]/brain/context/ContextPageClient.tsx
// Context Page Client - Main Client Component for the Context Page
//
// This is the revamped Context Graph experience with:
// - 3-tab layout: Coverage View | Relationship View | Form View
// - URL param-driven state (?view=coverage|relationships|form)
// - Clear separation of visualization and editing concerns
// - Resizable inspector panel with collapse/expand
//
// See the page.tsx header for the full page description.

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import type { CompanyContextGraph, DomainName } from '@/lib/contextGraph/companyContextGraph';
import type { GraphFieldUi, GraphDiffItem } from '@/lib/contextGraph/uiHelpers';
import type { NeedsRefreshFlag } from '@/lib/contextGraph/contextHealth';
import type { ContextGraphSnapshot } from '@/lib/contextGraph/history';
import type { ContextHealthScore } from '@/lib/contextGraph/health';
import type { CoverageGraph, RelationshipGraph } from '@/lib/os/context';

// Sub-components
import { ContextSubTabs, type ContextViewMode, parseViewMode, viewModeToParam } from './components/ContextSubTabs';
import { ContextCoverageView } from './components/ContextCoverageView';
import { ContextRelationshipView } from './components/ContextRelationshipView';
import { ContextFormView } from './components/ContextFormView';
import { ContextNodeInspector } from './components/ContextNodeInspector';

// ============================================================================
// Types
// ============================================================================

interface ContextPageClientProps {
  companyId: string;
  companyName: string;
  graph: CompanyContextGraph | null;
  fields: GraphFieldUi[];
  needsRefresh: NeedsRefreshFlag[];
  healthScore: ContextHealthScore;
  snapshots: ContextGraphSnapshot[];
  diff: GraphDiffItem[];
  coveragePercent?: number;
  /** Initial view from URL */
  initialView?: string;
  /** Initial domain from URL */
  initialDomain?: string;
  /** Initial node ID from URL */
  initialNodeId?: string;
  /** Initial panel tab from URL */
  initialPanel?: string;
  /** Pre-computed coverage graph data */
  coverageData?: CoverageGraph;
  /** Pre-computed relationship graph data */
  relationshipData?: RelationshipGraph;
}

// ============================================================================
// Utility
// ============================================================================

function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

// ============================================================================
// Main Component
// ============================================================================

export function ContextPageClient({
  companyId,
  companyName,
  graph,
  fields,
  needsRefresh,
  healthScore,
  snapshots,
  diff,
  coveragePercent,
  initialView,
  initialDomain,
  initialNodeId,
  initialPanel,
  coverageData,
  relationshipData,
}: ContextPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // State
  const [viewMode, setViewMode] = useState<ContextViewMode>(parseViewMode(initialView));
  const [selectedDomain, setSelectedDomain] = useState<DomainName | null>(
    initialDomain as DomainName | null
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(initialNodeId || null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(!!initialNodeId);

  // Inspector resize state
  const [inspectorWidth, setInspectorWidth] = useState(384); // Default 96 * 4 = 384px
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  // Load inspector width from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`contextGraph:${companyId}:inspectorWidth`);
      if (saved) {
        const width = parseInt(saved, 10);
        if (width >= 280 && width <= 540) {
          setInspectorWidth(width);
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [companyId]);

  // Inspector resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeRef.current = { startX: e.clientX, startWidth: inspectorWidth };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizeRef.current) return;
      const deltaX = resizeRef.current.startX - moveEvent.clientX;
      const newWidth = Math.max(280, Math.min(540, resizeRef.current.startWidth + deltaX));
      setInspectorWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      // Save to localStorage
      try {
        localStorage.setItem(`contextGraph:${companyId}:inspectorWidth`, String(inspectorWidth));
      } catch {
        // Ignore localStorage errors
      }
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [inspectorWidth, companyId]);

  // URL update helper
  const updateUrlParams = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(newUrl, { scroll: false });
  }, [pathname, router, searchParams]);

  // Handlers
  const handleViewChange = useCallback((newView: ContextViewMode) => {
    setViewMode(newView);
    updateUrlParams({ view: viewModeToParam(newView) });
  }, [updateUrlParams]);

  const handleDomainChange = useCallback((domain: DomainName | null) => {
    setSelectedDomain(domain);
    updateUrlParams({ domain: domain });
  }, [updateUrlParams]);

  const handleSelectNode = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
    setIsInspectorOpen(true);
    updateUrlParams({ nodeId });
  }, [updateUrlParams]);

  const handleCloseInspector = useCallback(() => {
    setIsInspectorOpen(false);
    setSelectedNodeId(null);
    updateUrlParams({ nodeId: null });
  }, [updateUrlParams]);

  // Find selected field data
  const selectedField = useMemo(() => {
    if (!selectedNodeId) return null;
    return fields.find(f => f.path === selectedNodeId) || null;
  }, [fields, selectedNodeId]);

  // Empty state check
  const hasData = fields.length > 0 || graph !== null;

  return (
    <div className="flex flex-col h-full">
      {/* Page header with tabs */}
      <header className="shrink-0 border-b border-slate-800 bg-slate-950/50">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-white">Context Graph</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              What Hive knows about this company, how it connects, and where the gaps are.
            </p>
          </div>

          {/* Quick actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                // TODO: Trigger autocomplete
                fetch(`/api/os/companies/${companyId}/context/auto-fill`, { method: 'POST' })
                  .then(() => router.refresh())
                  .catch(console.error);
              }}
              className="px-3 py-1.5 text-sm font-medium rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors"
            >
              Run Autocomplete
            </button>
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="px-6 pb-4">
          <ContextSubTabs
            activeView={viewMode}
            onViewChange={handleViewChange}
          />
        </div>
      </header>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* View content */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          {viewMode === 'coverage' && (
            <ContextCoverageView
              companyId={companyId}
              coverageData={coverageData}
              onSelectNode={handleSelectNode}
              selectedNodeId={selectedNodeId}
              selectedDomain={selectedDomain}
              onDomainChange={handleDomainChange}
            />
          )}

          {viewMode === 'relationships' && (
            <ContextRelationshipView
              companyId={companyId}
              relationshipData={relationshipData}
              onSelectNode={handleSelectNode}
              selectedNodeId={selectedNodeId}
            />
          )}

          {viewMode === 'form' && (
            <ContextFormView
              companyId={companyId}
              companyName={companyName}
              fields={fields}
              selectedDomain={selectedDomain}
              onDomainChange={handleDomainChange}
              onSelectField={handleSelectNode}
              selectedFieldPath={selectedNodeId}
              coveragePercent={coveragePercent}
            />
          )}
        </div>

        {/* Right panel - Field Inspector */}
        {isInspectorOpen && selectedNodeId && (
          <aside
            className="relative shrink-0 border-l border-slate-800 bg-slate-950 overflow-y-auto"
            style={{ width: inspectorWidth }}
          >
            {/* Resize handle */}
            <div
              className={cn(
                'absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize group z-10',
                isResizing && 'bg-amber-500/30'
              )}
              onMouseDown={handleResizeStart}
            >
              <div
                className={cn(
                  'absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 rounded-full transition-colors',
                  isResizing ? 'bg-amber-500' : 'bg-slate-700 group-hover:bg-slate-500'
                )}
              />
            </div>

            <div className="p-4">
              {/* Collapse button in header */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Inspector</span>
                <button
                  onClick={handleCloseInspector}
                  className="p-1 text-slate-500 hover:text-white hover:bg-slate-800 rounded transition-colors"
                  title="Close inspector"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {selectedField ? (
                <ContextNodeInspector
                  field={selectedField}
                  companyId={companyId}
                  issue={needsRefresh.find(n => `${n.domain}.${n.field}` === selectedNodeId)}
                  onClose={handleCloseInspector}
                />
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-slate-500">Field not found</p>
                  <p className="text-xs text-slate-600 mt-1">{selectedNodeId}</p>
                </div>
              )}

              {/* Related links section */}
              {selectedField && (
                <div className="mt-6 pt-6 border-t border-slate-800">
                  <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
                    Related
                  </h4>
                  <div className="space-y-2">
                    <Link
                      href={`/c/${companyId}/diagnostics?field=${selectedNodeId}`}
                      className="block text-sm text-slate-400 hover:text-white transition-colors"
                    >
                      View related findings
                    </Link>
                    <Link
                      href={`/c/${companyId}/work?field=${selectedNodeId}`}
                      className="block text-sm text-slate-400 hover:text-white transition-colors"
                    >
                      View related work items
                    </Link>
                    <Link
                      href={`/c/${companyId}/brain/history?field=${selectedNodeId}`}
                      className="block text-sm text-slate-400 hover:text-white transition-colors"
                    >
                      View field history
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
