'use client';

// app/c/[companyId]/context/ContextGraphPanel.tsx
// Force-directed graph visualization panel for the Context Graph Explorer

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { ContextGraphToolbar } from './ContextGraphToolbar';
import {
  type GraphNode,
  type GraphLink,
  type GraphData,
  type GraphMode,
  type SnapshotInfo,
  SECTION_COLORS,
  SOURCE_COLORS,
  getInitialNodePositions,
} from '@/lib/contextGraph/graphView';
import type { DomainName } from '@/lib/contextGraph/companyContextGraph';

// Dynamically import react-force-graph-2d to avoid SSR issues
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="w-6 h-6 rounded-full border-2 border-slate-700 border-t-amber-500 animate-spin" />
    </div>
  ),
});

// ============================================================================
// Types
// ============================================================================

interface ContextGraphPanelProps {
  companyId: string;
  sectionId: DomainName;
  sectionLabel: string;
  graphData: GraphData;
  snapshots: SnapshotInfo[];
  activeSnapshotId: string;
  onSnapshotChange: (snapshotId: string) => void;
  onModeChange: (mode: GraphMode) => void;
  mode: GraphMode;
  onNodeClick?: (node: GraphNode) => void;
  highlightedFieldPath?: string | null;
}

interface TooltipData {
  node: GraphNode;
  x: number;
  y: number;
}

// ============================================================================
// Legend Component
// ============================================================================

function GraphLegend({ mode, sectionId }: { mode: GraphMode; sectionId: DomainName }) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-3 py-2 border-b border-slate-800 bg-slate-900/30">
      {mode === 'field' ? (
        <>
          <div className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: SECTION_COLORS[sectionId] }}
            />
            <span className="text-[10px] text-slate-400">Current Section</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-slate-500" />
            <span className="text-[10px] text-slate-400">Related Field</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full border-2 border-amber-400 bg-transparent" />
            <span className="text-[10px] text-slate-400">Human Override</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full border-2 border-dashed border-red-400 bg-transparent" />
            <span className="text-[10px] text-slate-400">Conflicted</span>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: SECTION_COLORS[sectionId] }}
            />
            <span className="text-[10px] text-slate-400">Field</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-500" />
            <span className="text-[10px] text-slate-400">Variant</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-blue-500" />
            <span className="text-[10px] text-slate-400">Source</span>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Tooltip Component
// ============================================================================

function NodeTooltip({ data, containerRef }: { data: TooltipData; containerRef: React.RefObject<HTMLDivElement | null> }) {
  const { node, x, y } = data;

  // Calculate position relative to container
  const containerRect = containerRef.current?.getBoundingClientRect();
  const tooltipX = x - (containerRect?.left ?? 0);
  const tooltipY = y - (containerRect?.top ?? 0);

  return (
    <div
      className="absolute z-50 pointer-events-none"
      style={{
        left: tooltipX + 10,
        top: tooltipY - 10,
        transform: 'translateY(-100%)',
      }}
    >
      <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-3 max-w-xs">
        <div className="text-sm font-medium text-slate-100 mb-1">{node.label}</div>

        {node.type === 'field' && (
          <div className="space-y-1.5 text-[11px]">
            {node.path && (
              <div className="font-mono text-slate-500 text-[10px]">{node.path}</div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Status:</span>
              <StatusBadge status={node.status} />
            </div>
            {node.confidence !== undefined && (
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Confidence:</span>
                <span className="text-slate-200">{Math.round(node.confidence * 100)}%</span>
              </div>
            )}
            {node.freshnessScore !== undefined && (
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Freshness:</span>
                <span className="text-slate-200">{Math.round(node.freshnessScore * 100)}%</span>
              </div>
            )}
            {node.isHumanOverride && (
              <div className="flex items-center gap-1.5 text-amber-400">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
                Human Override
              </div>
            )}
          </div>
        )}

        {node.type === 'source' && (
          <div className="space-y-1.5 text-[11px]">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Type:</span>
              <span className="text-slate-200">{node.sourceType}</span>
            </div>
            {node.connectedFieldCount !== undefined && (
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Connected fields:</span>
                <span className="text-slate-200">{node.connectedFieldCount}</span>
              </div>
            )}
          </div>
        )}

        {node.type === 'valueVariant' && (
          <div className="space-y-1.5 text-[11px]">
            {node.confidence !== undefined && (
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Confidence:</span>
                <span className="text-slate-200">{Math.round(node.confidence * 100)}%</span>
              </div>
            )}
            {node.variantTimestamp && (
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Updated:</span>
                <span className="text-slate-200">
                  {new Date(node.variantTimestamp).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    fresh: { bg: 'bg-emerald-500/20', text: 'text-emerald-300', label: 'Fresh' },
    stale: { bg: 'bg-amber-500/20', text: 'text-amber-300', label: 'Stale' },
    missing: { bg: 'bg-slate-500/20', text: 'text-slate-400', label: 'Missing' },
    conflicted: { bg: 'bg-red-500/20', text: 'text-red-300', label: 'Conflicted' },
  };

  const statusConfig = config[status ?? 'missing'] ?? config.missing;

  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusConfig.bg} ${statusConfig.text}`}>
      {statusConfig.label}
    </span>
  );
}

// ============================================================================
// Empty State Component
// ============================================================================

function EmptyState({ sectionLabel }: { sectionLabel: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      </div>
      <h3 className="text-sm font-medium text-slate-300 mb-2">No context graph yet for {sectionLabel}</h3>
      <p className="text-xs text-slate-500 max-w-xs">
        Run Labs or add fields manually to populate this view.
      </p>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ContextGraphPanel({
  companyId,
  sectionId,
  sectionLabel,
  graphData,
  snapshots,
  activeSnapshotId,
  onSnapshotChange,
  onModeChange,
  mode,
  onNodeClick,
  highlightedFieldPath,
}: ContextGraphPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 400, height: 300 });
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [highlightHumanOverrides, setHighlightHumanOverrides] = useState(false);
  const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(new Set());
  const [engineStopped, setEngineStopped] = useState(false);

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: rect.width,
          height: rect.height - 80, // Account for toolbar and legend
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Get initial positions for deterministic layout
  const initialPositions = useMemo(() => {
    return getInitialNodePositions(graphData.nodes, dimensions.width, dimensions.height);
  }, [graphData.nodes, dimensions]);

  // Apply initial positions to nodes
  const nodesWithPositions = useMemo(() => {
    return graphData.nodes.map(node => {
      const pos = initialPositions.get(node.id);
      return {
        ...node,
        x: pos?.x ?? dimensions.width / 2,
        y: pos?.y ?? dimensions.height / 2,
      };
    });
  }, [graphData.nodes, initialPositions, dimensions]);

  // Highlight nodes when a field path is provided
  useEffect(() => {
    if (highlightedFieldPath) {
      const nodeId = `field:${highlightedFieldPath}`;
      setHighlightedNodes(new Set([nodeId]));

      // Find and highlight connected nodes
      const connectedIds = new Set<string>([nodeId]);
      graphData.links.forEach(link => {
        if (link.source === nodeId || (typeof link.source === 'object' && (link.source as any).id === nodeId)) {
          connectedIds.add(typeof link.target === 'string' ? link.target : (link.target as any).id);
        }
        if (link.target === nodeId || (typeof link.target === 'object' && (link.target as any).id === nodeId)) {
          connectedIds.add(typeof link.source === 'string' ? link.source : (link.source as any).id);
        }
      });
      setHighlightedNodes(connectedIds);
    } else {
      setHighlightedNodes(new Set());
    }
  }, [highlightedFieldPath, graphData.links]);

  // Stop physics after initial layout
  const handleEngineStop = useCallback(() => {
    setEngineStopped(true);
  }, []);

  // Node painting callback
  const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const nodeData = node as GraphNode & { x: number; y: number };
    const isHighlighted = highlightedNodes.has(nodeData.id);
    const shouldHighlightHuman = highlightHumanOverrides && nodeData.isHumanOverride;

    // Determine base color
    let fillColor: string;
    if (nodeData.type === 'field') {
      fillColor = nodeData.section ? SECTION_COLORS[nodeData.section] : '#6b7280';
    } else if (nodeData.type === 'source') {
      fillColor = SOURCE_COLORS[nodeData.sourceType ?? 'default'] ?? SOURCE_COLORS.default;
    } else {
      fillColor = '#64748b'; // valueVariant - gray
    }

    // Calculate radius
    let radius: number;
    if (nodeData.type === 'field') {
      const confidence = nodeData.confidence ?? 0;
      const freshness = nodeData.freshnessScore ?? 1;
      radius = Math.max(6, 6 + 10 * confidence * freshness);
    } else if (nodeData.type === 'source') {
      radius = 8;
    } else {
      radius = 4;
    }

    // Adjust for highlight
    if (isHighlighted) {
      radius *= 1.3;
    }

    // Draw node
    ctx.beginPath();

    if (nodeData.type === 'source') {
      // Square for source nodes
      const size = radius * 1.5;
      ctx.rect(nodeData.x - size / 2, nodeData.y - size / 2, size, size);
    } else {
      // Circle for field and variant nodes
      ctx.arc(nodeData.x, nodeData.y, radius, 0, 2 * Math.PI);
    }

    ctx.fillStyle = fillColor;
    ctx.fill();

    // Draw borders
    if (shouldHighlightHuman) {
      // Bright yellow border for human overrides
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    } else if (nodeData.status === 'conflicted') {
      // Dashed red border for conflicted
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (isHighlighted) {
      // White border for highlighted nodes
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Draw label for field nodes at larger scales
    if (nodeData.type === 'field' && globalScale > 0.8) {
      ctx.font = `${10 / globalScale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(nodeData.label, nodeData.x, nodeData.y + radius + 2);
    }
  }, [highlightHumanOverrides, highlightedNodes]);

  // Link painting callback
  const paintLink = useCallback((link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const linkData = link as GraphLink & { source: { x: number; y: number }; target: { x: number; y: number } };

    ctx.beginPath();
    ctx.moveTo(linkData.source.x, linkData.source.y);
    ctx.lineTo(linkData.target.x, linkData.target.y);

    // Style based on link kind
    switch (linkData.kind) {
      case 'fieldRelation':
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)'; // slate-400 with low opacity
        ctx.lineWidth = 1;
        break;
      case 'fieldHasVariant':
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
        ctx.lineWidth = 0.75;
        break;
      case 'variantFromSource':
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)';
        ctx.lineWidth = 0.5;
        break;
      default:
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
        ctx.lineWidth = 0.5;
    }

    ctx.stroke();
  }, []);

  // Event handlers
  const handleNodeHover = useCallback((node: any, prevNode: any) => {
    if (node) {
      const nodeData = node as GraphNode & { x: number; y: number };
      // Get screen coordinates
      if (graphRef.current) {
        const coords = graphRef.current.graph2ScreenCoords(nodeData.x, nodeData.y);
        const containerRect = containerRef.current?.getBoundingClientRect();
        setTooltip({
          node: nodeData,
          x: coords.x + (containerRect?.left ?? 0),
          y: coords.y + (containerRect?.top ?? 0) + 80, // Offset for toolbar/legend
        });
      }
    } else {
      setTooltip(null);
    }
  }, []);

  const handleNodeClick = useCallback((node: any) => {
    const nodeData = node as GraphNode;
    if (nodeData.type === 'field' && onNodeClick) {
      onNodeClick(nodeData);
    }
  }, [onNodeClick]);

  // Empty state
  if (graphData.nodes.length === 0) {
    return (
      <div ref={containerRef} className="flex flex-col h-full bg-slate-950 border-l border-slate-800">
        <div className="px-3 py-2 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-200">Context Graph</h3>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-400">
              {sectionLabel}
            </span>
          </div>
        </div>
        <ContextGraphToolbar
          mode={mode}
          onModeChange={onModeChange}
          snapshots={snapshots}
          activeSnapshotId={activeSnapshotId}
          onSnapshotChange={onSnapshotChange}
          highlightHumanOverrides={highlightHumanOverrides}
          onHighlightHumanOverridesChange={setHighlightHumanOverrides}
        />
        <EmptyState sectionLabel={sectionLabel} />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col h-full bg-slate-950 border-l border-slate-800 relative">
      {/* Header */}
      <div className="px-3 py-2 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-200">Context Graph</h3>
          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-400">
            {sectionLabel}
          </span>
        </div>
      </div>

      {/* Toolbar */}
      <ContextGraphToolbar
        mode={mode}
        onModeChange={onModeChange}
        snapshots={snapshots}
        activeSnapshotId={activeSnapshotId}
        onSnapshotChange={onSnapshotChange}
        highlightHumanOverrides={highlightHumanOverrides}
        onHighlightHumanOverridesChange={setHighlightHumanOverrides}
      />

      {/* Legend */}
      <GraphLegend mode={mode} sectionId={sectionId} />

      {/* Graph Canvas */}
      <div className="flex-1 relative">
        <ForceGraph2D
          ref={graphRef}
          graphData={{
            nodes: nodesWithPositions,
            links: graphData.links,
          }}
          width={dimensions.width}
          height={dimensions.height}
          nodeCanvasObject={paintNode}
          linkCanvasObject={paintLink}
          onNodeHover={handleNodeHover}
          onNodeClick={handleNodeClick}
          onEngineStop={handleEngineStop}
          cooldownTicks={100}
          warmupTicks={50}
          d3AlphaDecay={0.02}
          d3VelocityDecay={0.3}
          backgroundColor="transparent"
          nodeRelSize={6}
          linkDirectionalParticles={0}
          enableNodeDrag={!engineStopped}
          enableZoomInteraction={true}
          enablePanInteraction={true}
        />

        {/* Tooltip */}
        {tooltip && <NodeTooltip data={tooltip} containerRef={containerRef} />}
      </div>
    </div>
  );
}
