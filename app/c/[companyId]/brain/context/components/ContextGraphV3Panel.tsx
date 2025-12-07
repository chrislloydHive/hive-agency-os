'use client';

// app/c/[companyId]/brain/context/components/ContextGraphV3Panel.tsx
// Context Graph v3 Panel - Main visualization container
//
// Features:
// - Top control bar (snapshot selector, compare toggle, highlight overrides)
// - Legend for status/domain colors
// - Main graph canvas with detail panel
// - Loading and error states

import { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  ContextGraphV3Snapshot,
  ContextGraphNode,
  ContextHealthSummary,
  ContextNodeStatus,
} from '@/lib/contextGraph/contextGraphV3Types';
import { ContextGraphV3Canvas } from './ContextGraphV3Canvas';
import { ContextNodeDetailPanel } from './ContextNodeDetailPanel';

// Client-side health summary calculation (mirrors server-side logic)
function summarizeContextHealth(
  snapshot: ContextGraphV3Snapshot
): ContextHealthSummary {
  const { nodes, summary } = snapshot;

  // Calculate health score (weighted by importance)
  let weightedOk = 0;
  let totalWeight = 0;

  for (const node of nodes) {
    const weight = node.importance;
    totalWeight += weight;

    if (node.status === 'ok') {
      weightedOk += weight;
    } else if (node.status === 'low_confidence') {
      weightedOk += weight * 0.6; // Partial credit
    } else if (node.status === 'stale') {
      weightedOk += weight * 0.4; // Less credit
    }
    // conflicted and missing get 0 credit
  }

  const healthScore = totalWeight > 0
    ? Math.round((weightedOk / totalWeight) * 100)
    : 0;

  return {
    total: summary.totalNodes,
    ok: summary.byStatus.ok,
    conflicted: summary.byStatus.conflicted,
    stale: summary.byStatus.stale,
    lowConfidence: summary.byStatus.low_confidence,
    missing: summary.byStatus.missing,
    humanOverrides: summary.humanOverrides,
    healthScore,
  };
}

// ============================================================================
// Types
// ============================================================================

interface ContextGraphV3PanelProps {
  companyId: string;
}

interface SnapshotOption {
  id: string;
  label: string;
  createdAt: string;
}

// ============================================================================
// Component
// ============================================================================

export function ContextGraphV3Panel({ companyId }: ContextGraphV3PanelProps) {
  // State
  const [graph, setGraph] = useState<ContextGraphV3Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<ContextGraphNode | null>(null);

  // Controls state
  const [snapshotId, setSnapshotId] = useState<string>('live');
  const [compareTo, setCompareTo] = useState<string | undefined>(undefined);
  const [highlightOverrides, setHighlightOverrides] = useState(true);
  const [showLegend, setShowLegend] = useState(true);

  // Available snapshots
  const [snapshots, setSnapshots] = useState<SnapshotOption[]>([
    { id: 'live', label: 'Current (Live)', createdAt: new Date().toISOString() },
  ]);

  // Fetch graph data
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const url = new URL(`/api/os/companies/${companyId}/context/graph`, window.location.origin);
    url.searchParams.set('snapshot', snapshotId);
    if (compareTo) {
      url.searchParams.set('compareTo', compareTo);
    }

    fetch(url.toString())
      .then(res => {
        if (!res.ok) throw new Error('Failed to load graph');
        return res.json();
      })
      .then((data: ContextGraphV3Snapshot) => {
        if (!cancelled) {
          setGraph(data);
          setLoading(false);
        }
      })
      .catch(err => {
        if (!cancelled) {
          console.error('[ContextGraphV3] Load error:', err);
          setError('Failed to load context graph');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [companyId, snapshotId, compareTo]);

  // Fetch available snapshots
  useEffect(() => {
    fetch(`/api/os/companies/${companyId}/context/graph/snapshots`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.snapshots) {
          setSnapshots(data.snapshots);
        }
      })
      .catch(() => {
        // Ignore - use default
      });
  }, [companyId]);

  // Compute health summary
  const healthSummary = useMemo((): ContextHealthSummary | null => {
    if (!graph) return null;
    return summarizeContextHealth(graph);
  }, [graph]);

  // Handle node selection
  const handleSelectNode = useCallback((node: ContextGraphNode | null) => {
    setSelectedNode(node);
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="flex h-[calc(100vh-200px)] items-center justify-center bg-slate-950 rounded-lg border border-slate-800">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-slate-700 border-t-amber-500 animate-spin" />
          <p className="text-sm text-slate-400">Loading context graph...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex h-[calc(100vh-200px)] items-center justify-center bg-slate-950 rounded-lg border border-slate-800">
        <div className="text-center">
          <p className="text-sm text-red-400 mb-3">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-1.5 text-xs border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-800"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (!graph || graph.nodes.length === 0) {
    return (
      <div className="flex h-[calc(100vh-200px)] flex-col items-center justify-center bg-slate-950 rounded-lg border border-slate-800">
        <div className="mb-4 p-4 rounded-full bg-slate-800">
          <svg className="h-8 w-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </div>
        <h3 className="text-sm font-medium text-slate-300 mb-2">No Context Data</h3>
        <p className="text-xs text-slate-500 text-center max-w-md">
          Run Labs or add fields manually to build the context graph.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-200px)] flex-col bg-slate-950 rounded-lg border border-slate-800 overflow-hidden">
      {/* Control Bar */}
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2 bg-slate-900/50">
        {/* Left: Snapshot controls */}
        <div className="flex items-center gap-4">
          {/* Snapshot selector */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-slate-500 uppercase tracking-wide">
              Viewing
            </label>
            <select
              value={snapshotId}
              onChange={(e) => setSnapshotId(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              {snapshots.map(snap => (
                <option key={snap.id} value={snap.id}>
                  {snap.label}
                </option>
              ))}
            </select>
          </div>

          {/* Compare selector */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-slate-500 uppercase tracking-wide">
              Compare to
            </label>
            <select
              value={compareTo || ''}
              onChange={(e) => setCompareTo(e.target.value || undefined)}
              className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="">None</option>
              {snapshots.filter(s => s.id !== snapshotId).map(snap => (
                <option key={snap.id} value={snap.id}>
                  {snap.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Center: Health summary */}
        {healthSummary && (
          <div className="flex items-center gap-4">
            <HealthBadge
              label="Health"
              value={`${healthSummary.healthScore}%`}
              color={
                healthSummary.healthScore >= 70 ? 'emerald' :
                healthSummary.healthScore >= 50 ? 'amber' : 'red'
              }
            />
            <HealthBadge
              label="Nodes"
              value={graph.summary.totalNodes.toString()}
              color="slate"
            />
            {compareTo && graph.summary.changedNodes > 0 && (
              <HealthBadge
                label="Changed"
                value={graph.summary.changedNodes.toString()}
                color="cyan"
              />
            )}
            {healthSummary.conflicted > 0 && (
              <HealthBadge
                label="Conflicts"
                value={healthSummary.conflicted.toString()}
                color="red"
              />
            )}
          </div>
        )}

        {/* Right: View controls */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={highlightOverrides}
              onChange={(e) => setHighlightOverrides(e.target.checked)}
              className="h-3 w-3 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500/30"
            />
            <span className="text-[10px] text-slate-400">Human overrides</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showLegend}
              onChange={(e) => setShowLegend(e.target.checked)}
              className="h-3 w-3 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500/30"
            />
            <span className="text-[10px] text-slate-400">Legend</span>
          </label>
        </div>
      </div>

      {/* Legend */}
      {showLegend && <GraphLegend />}

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* Graph Canvas */}
        <div className="flex-1 min-w-0">
          <ContextGraphV3Canvas
            graph={graph}
            highlightOverrides={highlightOverrides}
            selectedNode={selectedNode}
            onSelectNode={handleSelectNode}
          />
        </div>

        {/* Detail Panel */}
        <div className="w-80 flex-shrink-0">
          <ContextNodeDetailPanel
            node={selectedNode}
            graph={graph}
            companyId={companyId}
            onClose={() => setSelectedNode(null)}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function HealthBadge({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: 'emerald' | 'amber' | 'red' | 'cyan' | 'slate';
}) {
  const colorClasses = {
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    red: 'text-red-400',
    cyan: 'text-cyan-400',
    slate: 'text-slate-300',
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] text-slate-500 uppercase tracking-wide">
        {label}
      </span>
      <span className={`text-xs font-semibold ${colorClasses[color]}`}>
        {value}
      </span>
    </div>
  );
}

function GraphLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 px-4 py-2 border-b border-slate-800 bg-slate-900/30">
      {/* Status legend */}
      <div className="flex items-center gap-3">
        <span className="text-[9px] text-slate-500 uppercase tracking-wide">Status:</span>
        <LegendItem color="bg-emerald-500" label="Healthy" />
        <LegendItem color="bg-yellow-500" label="Stale" />
        <LegendItem color="bg-orange-500" label="Low Conf" />
        <LegendItem color="bg-red-500" label="Conflict" />
        <LegendItem color="bg-slate-500" label="Missing" />
      </div>

      <div className="h-3 w-px bg-slate-700" />

      {/* Indicator legend */}
      <div className="flex items-center gap-3">
        <span className="text-[9px] text-slate-500 uppercase tracking-wide">Indicators:</span>
        <div className="flex items-center gap-1">
          <div className="h-2.5 w-2.5 rounded-full border-2 border-dashed border-amber-400" />
          <span className="text-[10px] text-slate-400">Human</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-2.5 w-2.5 rounded-full border-2 border-cyan-400" style={{ boxShadow: '0 0 4px #22d3ee' }} />
          <span className="text-[10px] text-slate-400">Changed</span>
        </div>
      </div>

      <div className="h-3 w-px bg-slate-700" />

      {/* Size legend */}
      <div className="flex items-center gap-2">
        <span className="text-[9px] text-slate-500 uppercase tracking-wide">Size = Importance:</span>
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-slate-500" />
          <span className="text-[10px] text-slate-500">1</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-4 w-4 rounded-full bg-slate-500" />
          <span className="text-[10px] text-slate-500">5</span>
        </div>
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <div className={`h-2 w-2 rounded-full ${color}`} />
      <span className="text-[10px] text-slate-400">{label}</span>
    </div>
  );
}
