'use client';

// app/c/[companyId]/brain/map/StrategicMapClient.tsx
// Strategic Map 2.0 - Full-featured strategic intelligence visualization
//
// Features:
// - Domain cluster backgrounds for visual grouping
// - Mode switching (Structure, Insights, Actions, Signals)
// - Heatmap overlay for quick visual assessment
// - Focus mode for deep diving into node circuits
// - Rich node cards with health, provenance, and metadata
// - Ghost nodes for empty domains
// - Enhanced sidebar with filters and legend
// - Semantic edge styling
// - AI-powered analysis (explain, gaps, opportunities)
// - Timeline slider for historical views

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Map,
  AlertCircle,
  Info,
  X,
  Sparkles,
  Keyboard,
  ChevronDown,
  ChevronUp,
  Circle,
} from 'lucide-react';
import type {
  StrategicMapGraph,
  StrategicMapNode,
  StrategicMapNodeDomain,
} from '@/lib/contextGraph/strategicMap';
import {
  DOMAIN_COLORS,
  DOMAIN_LABELS,
  getNodePosition,
  hasEnoughData,
  getActiveDomains,
  getEdgeVisualProps,
} from '@/lib/contextGraph/strategicMap';
import type { ContextHealthScore } from '@/lib/contextGraph/health';
import type { ClientInsight } from '@/lib/types/clientBrain';
import {
  StrategicMapProvider,
  useStrategicMap,
  filterNodes,
  type GhostNode,
  type StrategicMapMode,
} from './StrategicMapContext';
import { generateGhostNodes, getGhostNodePosition } from './ghostNodes';
import { MapToolbar } from './MapToolbar';
import { FilterPanel } from './FilterPanel';
import { NodeDrawer } from './NodeDrawer';
import { MapNode, GhostMapNode, NODE_WIDTH, NODE_HEIGHT, GHOST_NODE_WIDTH, GHOST_NODE_HEIGHT } from './MapNode';
import { useNodeAI } from './useNodeAI';

// ============================================================================
// Types
// ============================================================================

interface StrategicMapClientProps {
  companyId: string;
  companyName: string;
  mapGraph: StrategicMapGraph;
  healthScore: ContextHealthScore;
  isNewGraph: boolean;
  focusNodeId?: string;
  globalInsights?: ClientInsight[];
}

// ============================================================================
// Constants
// ============================================================================

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 700;

// Domain cluster positions for background rendering
const DOMAIN_CLUSTER_BOUNDS: Record<StrategicMapNodeDomain, { x: number; y: number; w: number; h: number }> = {
  identity: { x: 0.35, y: 0.02, w: 0.30, h: 0.15 },
  audience: { x: 0.05, y: 0.15, w: 0.28, h: 0.20 },
  brand: { x: 0.60, y: 0.15, w: 0.28, h: 0.20 },
  productOffer: { x: 0.35, y: 0.32, w: 0.30, h: 0.18 },
  competitive: { x: 0.72, y: 0.32, w: 0.25, h: 0.18 },
  website: { x: 0.22, y: 0.50, w: 0.25, h: 0.18 },
  content: { x: 0.02, y: 0.45, w: 0.22, h: 0.20 },
  seo: { x: 0.10, y: 0.65, w: 0.25, h: 0.18 },
  media: { x: 0.52, y: 0.50, w: 0.25, h: 0.18 },
  ops: { x: 0.72, y: 0.62, w: 0.25, h: 0.18 },
  objectives: { x: 0.35, y: 0.82, w: 0.30, h: 0.16 },
};

// ============================================================================
// Domain Cluster Component
// ============================================================================

function DomainCluster({
  domain,
  canvasWidth,
  canvasHeight,
  isActive,
  isHighlighted,
}: {
  domain: StrategicMapNodeDomain;
  canvasWidth: number;
  canvasHeight: number;
  isActive: boolean;
  isHighlighted: boolean;
}) {
  const bounds = DOMAIN_CLUSTER_BOUNDS[domain];
  const color = DOMAIN_COLORS[domain];
  const label = DOMAIN_LABELS[domain];

  const x = bounds.x * canvasWidth;
  const y = bounds.y * canvasHeight;
  const w = bounds.w * canvasWidth;
  const h = bounds.h * canvasHeight;

  if (!isActive) return null;

  return (
    <div
      className="absolute pointer-events-none transition-all duration-300"
      style={{
        left: x,
        top: y,
        width: w,
        height: h,
      }}
    >
      {/* Background blob */}
      <div
        className="absolute inset-0 rounded-2xl transition-opacity duration-300"
        style={{
          backgroundColor: color,
          opacity: isHighlighted ? 0.08 : 0.04,
        }}
      />
      {/* Label */}
      <div
        className="absolute left-3 top-2 text-[10px] font-medium uppercase tracking-wider transition-opacity duration-300"
        style={{
          color: color,
          opacity: isHighlighted ? 0.9 : 0.5,
        }}
      >
        {label}
      </div>
    </div>
  );
}

// ============================================================================
// Legend Component
// ============================================================================

function Legend({
  mode,
  isExpanded,
  onToggle,
  onClose,
}: {
  mode: StrategicMapMode;
  isExpanded: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  return (
    <div className="bg-slate-900/60 backdrop-blur-sm border border-slate-800 rounded-xl overflow-hidden">
      <div
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-800/30 transition-colors cursor-pointer"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onToggle()}
      >
        <span className="text-xs font-medium text-slate-300">Legend</span>
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-0.5 hover:bg-slate-700 rounded"
          >
            <X className="w-3 h-3 text-slate-500" />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-3 space-y-3 text-[11px]">
          {/* Edge Styles */}
          <div>
            <p className="text-slate-500 uppercase tracking-wider text-[10px] mb-2">Connections</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-0.5 bg-emerald-500 rounded" />
                <span className="text-slate-400">Strong alignment</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-0.5 bg-blue-500 rounded" />
                <span className="text-slate-400">Human verified</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-0.5 bg-violet-500/60 rounded" style={{ boxShadow: '0 0 6px rgba(139, 92, 246, 0.5)' }} />
                <span className="text-slate-400">AI inferred</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-px border-t-2 border-dashed border-red-500" />
                <span className="text-slate-400">Gap link</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-px border-t border-dashed border-slate-500" />
                <span className="text-slate-400">Weak link</span>
              </div>
            </div>
          </div>

          {/* Source */}
          <div>
            <p className="text-slate-500 uppercase tracking-wider text-[10px] mb-2">Source</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <span className="text-[8px] font-bold text-emerald-400">H</span>
                </div>
                <span className="text-slate-400">Human-verified</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-full bg-violet-500/20 flex items-center justify-center">
                  <Sparkles className="w-2.5 h-2.5 text-violet-400" />
                </div>
                <span className="text-slate-400">AI-generated</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <span className="text-[8px] font-bold text-amber-400">M</span>
                </div>
                <span className="text-slate-400">Mixed sources</span>
              </div>
            </div>
          </div>

          {/* Completeness */}
          <div>
            <p className="text-slate-500 uppercase tracking-wider text-[10px] mb-2">Completeness</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5">
                <div className="w-5 h-5 border-2 border-solid border-slate-500 rounded bg-slate-800/50" />
                <span className="text-slate-400">Full data</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-5 h-5 border-2 border-dashed border-slate-500 rounded bg-slate-800/30" />
                <span className="text-slate-400">Partial data</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-5 h-5 border-2 border-dotted border-slate-600 rounded bg-slate-800/20" />
                <span className="text-slate-400">Empty</span>
              </div>
            </div>
          </div>

          {/* Mode-specific */}
          {mode === 'signals' && (
            <div>
              <p className="text-slate-500 uppercase tracking-wider text-[10px] mb-2">Freshness</p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-5 bg-slate-700 rounded opacity-100" />
                  <span className="text-slate-400">Recent update</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-5 bg-slate-700 rounded opacity-50" />
                  <span className="text-slate-400">Older data</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Empty Selection State
// ============================================================================

function EmptySelectionHint() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-6 py-8">
      <div className="w-12 h-12 rounded-xl bg-slate-800/50 flex items-center justify-center mb-4">
        <Map className="w-6 h-6 text-slate-500" />
      </div>
      <h3 className="text-sm font-medium text-slate-300 mb-2">
        Select a node
      </h3>
      <p className="text-xs text-slate-500 leading-relaxed">
        Click on any node to see details, insights, and recommended actions.
      </p>
      <p className="text-[10px] text-slate-600 mt-3">
        Double-click for focus mode
      </p>
    </div>
  );
}

// ============================================================================
// Inner Component (uses context)
// ============================================================================

function StrategicMapInner({
  focusNodeId,
}: {
  focusNodeId?: string;
}) {
  const router = useRouter();
  const canvasRef = useRef<HTMLDivElement>(null);

  const {
    mapGraph,
    selectedNode,
    setSelectedNode,
    hoveredNode,
    setHoveredNode,
    showGhostNodes,
    ghostNodes,
    showHeatmap,
    focusMode,
    enterFocusMode,
    exitFocusMode,
    filters,
    nodeInsights,
    mode,
    companyId,
    healthScore,
    setNodeSummary,
    setNodeInsights,
  } = useStrategicMap();

  const [zoom, setZoom] = useState(1);
  const [showLegend, setShowLegend] = useState(true);
  const [legendExpanded, setLegendExpanded] = useState(true);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);

  // AI hooks
  const { loadNodeAI, isNodeLoading } = useNodeAI({
    companyId,
    onSummaryGenerated: setNodeSummary,
    onInsightsGenerated: setNodeInsights,
  });

  // Auto-focus on initial load
  useEffect(() => {
    if (focusNodeId) {
      const node = mapGraph.nodes.find(n => n.id === focusNodeId);
      if (node) {
        setSelectedNode(node);
        setTimeout(() => {
          const nodeElement = document.getElementById(`node-${focusNodeId}`);
          nodeElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    }
  }, [focusNodeId, mapGraph.nodes, setSelectedNode]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to deselect or exit focus mode
      if (e.key === 'Escape') {
        if (focusMode.isActive) {
          exitFocusMode();
        } else {
          setSelectedNode(null);
        }
        return;
      }

      // Arrow keys to navigate between nodes
      if (selectedNode && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const filteredNodes = filterNodes(mapGraph.nodes, filters, nodeInsights);
        const currentIndex = filteredNodes.findIndex(n => n.id === selectedNode.id);
        let newIndex = currentIndex;

        switch (e.key) {
          case 'ArrowUp':
          case 'ArrowLeft':
            newIndex = (currentIndex - 1 + filteredNodes.length) % filteredNodes.length;
            break;
          case 'ArrowDown':
          case 'ArrowRight':
            newIndex = (currentIndex + 1) % filteredNodes.length;
            break;
        }

        setSelectedNode(filteredNodes[newIndex]);
      }

      // 'f' for focus mode
      if (e.key === 'f' && selectedNode && !e.metaKey && !e.ctrlKey) {
        enterFocusMode(selectedNode.id);
      }

      // 'h' to toggle heatmap
      if (e.key === 'h' && !e.metaKey && !e.ctrlKey) {
        // Handled by context
      }

      // '+' / '-' to zoom
      if (e.key === '+' || e.key === '=') {
        setZoom(z => Math.min(1.5, z + 0.1));
      }
      if (e.key === '-') {
        setZoom(z => Math.max(0.5, z - 0.1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNode, mapGraph.nodes, setSelectedNode, focusMode, exitFocusMode, enterFocusMode, filters, nodeInsights]);

  // Load AI data when node is selected
  useEffect(() => {
    if (selectedNode && !isNodeLoading(selectedNode.id)) {
      loadNodeAI(selectedNode);
    }
  }, [selectedNode?.id]);

  // Calculate node positions
  const nodePositions = useMemo(() => {
    const positions: Record<string, { x: number; y: number }> = {};
    mapGraph.nodes.forEach((node, index) => {
      positions[node.id] = getNodePosition(
        node,
        index,
        mapGraph.nodes.length,
        CANVAS_WIDTH,
        CANVAS_HEIGHT
      );
    });
    return positions;
  }, [mapGraph.nodes]);

  // Calculate ghost node positions
  const ghostNodePositions = useMemo(() => {
    const positions: Record<string, { x: number; y: number }> = {};
    ghostNodes.forEach(ghost => {
      positions[ghost.id] = getGhostNodePosition(
        ghost,
        nodePositions,
        CANVAS_WIDTH,
        CANVAS_HEIGHT
      );
    });
    return positions;
  }, [ghostNodes, nodePositions]);

  // Filter nodes
  const filteredNodes = useMemo(() => {
    return filterNodes(mapGraph.nodes, filters, nodeInsights);
  }, [mapGraph.nodes, filters, nodeInsights]);

  // Filter ghost nodes
  const filteredGhostNodes = useMemo(() => {
    if (!showGhostNodes) return [];
    if (filters.domain === 'all') return ghostNodes;
    return ghostNodes.filter(g => g.domain === filters.domain);
  }, [ghostNodes, showGhostNodes, filters.domain]);

  // Get connected edges for highlighting
  const getConnectedNodeIds = useCallback((nodeId: string) => {
    const edges = mapGraph.edges.filter(e => e.from === nodeId || e.to === nodeId);
    return new Set(edges.flatMap(e => [e.from, e.to]).filter(id => id !== nodeId));
  }, [mapGraph.edges]);

  // Active domains
  const activeDomains = useMemo(() => getActiveDomains(mapGraph.nodes), [mapGraph.nodes]);

  // Highlighted domain (from hovered/selected node)
  const highlightedDomain = hoveredNode
    ? mapGraph.nodes.find(n => n.id === hoveredNode)?.domain
    : selectedNode?.domain;

  // Handle node click
  const handleNodeClick = (node: StrategicMapNode) => {
    setSelectedNode(selectedNode?.id === node.id ? null : node);
  };

  // Handle double click for focus mode
  const handleNodeDoubleClick = (node: StrategicMapNode) => {
    enterFocusMode(node.id);
  };

  // Handle ghost node click
  const handleGhostClick = (ghost: GhostNode) => {
    router.push(`/c/${companyId}/brain/context?section=${ghost.domain}`);
  };

  // Handle canvas background click
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setSelectedNode(null);
    }
  };

  // Center map function
  const centerMap = () => {
    if (canvasRef.current) {
      canvasRef.current.scrollTo({
        left: (CANVAS_WIDTH * zoom - canvasRef.current.clientWidth) / 2,
        top: (CANVAS_HEIGHT * zoom - canvasRef.current.clientHeight) / 2,
        behavior: 'smooth',
      });
    }
  };

  // Reset layout (placeholder)
  const handleResetLayout = () => {
    // Could reset pinned positions, zoom, etc.
    setZoom(1);
    centerMap();
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">
      {/* Left Panel: Filters & Controls */}
      <div className="lg:w-64 shrink-0 space-y-3">
        {/* Health Summary */}
        <div className="bg-slate-900/60 backdrop-blur-sm border border-slate-800 rounded-xl p-3.5">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-medium text-slate-400">Context Health</span>
            <span className={`text-base font-bold ${
              healthScore.overallScore >= 70 ? 'text-emerald-400' :
              healthScore.overallScore >= 40 ? 'text-amber-400' :
              'text-red-400'
            }`}>
              {healthScore.overallScore}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                healthScore.overallScore >= 70 ? 'bg-emerald-500' :
                healthScore.overallScore >= 40 ? 'bg-amber-500' :
                'bg-red-500'
              }`}
              style={{ width: `${healthScore.overallScore}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-2 text-[10px] text-slate-500">
            <span>{mapGraph.stats.completeNodes} complete</span>
            <span>{mapGraph.stats.partialNodes} partial</span>
            <span>{mapGraph.stats.emptyNodes} empty</span>
          </div>
        </div>

        {/* Filter Panel */}
        <FilterPanel />

        {/* Legend */}
        {showLegend && (
          <Legend
            mode={mode}
            isExpanded={legendExpanded}
            onToggle={() => setLegendExpanded(!legendExpanded)}
            onClose={() => setShowLegend(false)}
          />
        )}

        {!showLegend && (
          <button
            onClick={() => setShowLegend(true)}
            className="w-full text-left px-3.5 py-2 text-xs text-slate-500 hover:text-slate-400 bg-slate-900/40 border border-slate-800/50 rounded-xl flex items-center gap-2"
          >
            <Info className="w-3.5 h-3.5" />
            Show Legend
          </button>
        )}

        {/* Keyboard Shortcuts */}
        <button
          onClick={() => setShowKeyboardHelp(!showKeyboardHelp)}
          className="w-full text-left px-3.5 py-2 text-xs text-slate-500 hover:text-slate-400 bg-slate-900/30 border border-slate-800/50 rounded-xl flex items-center gap-2"
        >
          <Keyboard className="w-3.5 h-3.5" />
          Keyboard Shortcuts
        </button>

        {showKeyboardHelp && (
          <div className="bg-slate-900/60 backdrop-blur-sm border border-slate-800 rounded-xl p-3 text-[11px] space-y-1.5">
            <div className="flex justify-between text-slate-400">
              <span>Navigate</span>
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px]">←→↑↓</kbd>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Deselect / Exit focus</span>
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px]">Esc</kbd>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Focus mode</span>
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px]">F</kbd>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Zoom</span>
              <span>
                <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px]">+</kbd>
                {' '}
                <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px]">-</kbd>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Main Canvas */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden flex-1 flex flex-col">
          {/* Toolbar */}
          <MapToolbar
            zoom={zoom}
            onZoomIn={() => setZoom(Math.min(1.5, zoom + 0.1))}
            onZoomOut={() => setZoom(Math.max(0.5, zoom - 0.1))}
            onResetZoom={() => setZoom(1)}
            onCenterMap={centerMap}
            onResetLayout={handleResetLayout}
            nodeCount={filteredNodes.length}
            ghostCount={filteredGhostNodes.length}
          />

          {/* Canvas */}
          <div
            ref={canvasRef}
            className="relative flex-1 overflow-auto"
            style={{ minHeight: '500px' }}
            onClick={handleCanvasClick}
          >
            {/* Subtle top shadow for depth */}
            <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-slate-900/50 to-transparent pointer-events-none z-30" />

            <div
              className="relative"
              style={{
                width: CANVAS_WIDTH * zoom,
                height: CANVAS_HEIGHT * zoom,
                transform: `scale(${zoom})`,
                transformOrigin: 'top left',
              }}
            >
              {/* Domain cluster backgrounds */}
              {(Object.keys(DOMAIN_CLUSTER_BOUNDS) as StrategicMapNodeDomain[]).map(domain => (
                <DomainCluster
                  key={domain}
                  domain={domain}
                  canvasWidth={CANVAS_WIDTH}
                  canvasHeight={CANVAS_HEIGHT}
                  isActive={filters.domain === 'all' || filters.domain === domain}
                  isHighlighted={highlightedDomain === domain}
                />
              ))}

              {/* SVG for edges */}
              <svg
                className="absolute inset-0 pointer-events-none z-5"
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
              >
                <defs>
                  {/* Glow filter for AI edges */}
                  <filter id="edge-glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="2" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  {/* Highlight glow */}
                  <filter id="edge-highlight" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                {mapGraph.edges.map(edge => {
                  const fromPos = nodePositions[edge.from];
                  const toPos = nodePositions[edge.to];
                  if (!fromPos || !toPos) return null;

                  const fromNode = mapGraph.nodes.find(n => n.id === edge.from);
                  const toNode = mapGraph.nodes.find(n => n.id === edge.to);

                  // Skip edges if nodes are filtered out
                  const fromFiltered = filteredNodes.find(n => n.id === edge.from);
                  const toFiltered = filteredNodes.find(n => n.id === edge.to);
                  if (!fromFiltered && !toFiltered) {
                    return null;
                  }

                  // Highlight edges connected to hovered/selected node
                  const isHighlighted =
                    hoveredNode === edge.from ||
                    hoveredNode === edge.to ||
                    selectedNode?.id === edge.from ||
                    selectedNode?.id === edge.to;

                  // In focus mode, dim unrelated edges
                  const isInFocus = !focusMode.isActive ||
                    focusMode.focusedNodeId === edge.from ||
                    focusMode.focusedNodeId === edge.to ||
                    focusMode.upstreamIds.includes(edge.from) ||
                    focusMode.upstreamIds.includes(edge.to) ||
                    focusMode.downstreamIds.includes(edge.from) ||
                    focusMode.downstreamIds.includes(edge.to);

                  // Get semantic edge visual properties
                  const edgeProps = getEdgeVisualProps(edge);

                  return (
                    <line
                      key={edge.id}
                      x1={fromPos.x + NODE_WIDTH / 2}
                      y1={fromPos.y + NODE_HEIGHT / 2}
                      x2={toPos.x + NODE_WIDTH / 2}
                      y2={toPos.y + NODE_HEIGHT / 2}
                      stroke={isHighlighted ? '#f59e0b' : edgeProps.strokeColor}
                      strokeWidth={isHighlighted ? 2.5 : edgeProps.strokeWidth}
                      strokeDasharray={edgeProps.strokeDasharray}
                      opacity={isInFocus ? (isHighlighted ? 0.9 : edgeProps.opacity) : 0.15}
                      filter={isHighlighted ? 'url(#edge-highlight)' : edgeProps.glowFilter ? 'url(#edge-glow)' : undefined}
                      className="transition-all duration-200"
                    />
                  );
                })}
              </svg>

              {/* Ghost Nodes */}
              {filteredGhostNodes.map(ghost => {
                const pos = ghostNodePositions[ghost.id];
                if (!pos) return null;

                return (
                  <GhostMapNode
                    key={ghost.id}
                    ghost={ghost}
                    position={pos}
                    onClick={() => handleGhostClick(ghost)}
                  />
                );
              })}

              {/* Nodes */}
              {filteredNodes.map(node => {
                const pos = nodePositions[node.id];
                if (!pos) return null;

                const isSelected = selectedNode?.id === node.id;
                const isHovered = hoveredNode === node.id;
                const isConnected = hoveredNode
                  ? getConnectedNodeIds(hoveredNode).has(node.id)
                  : false;
                const isFocusedNode = focusNodeId === node.id;

                return (
                  <MapNode
                    key={node.id}
                    node={node}
                    position={pos}
                    isSelected={isSelected}
                    isHovered={isHovered}
                    isConnected={isConnected}
                    isFocused={isFocusedNode}
                    onClick={() => handleNodeClick(node)}
                    onDoubleClick={() => handleNodeDoubleClick(node)}
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel: Node Drawer */}
      <div className="lg:w-80 shrink-0">
        {selectedNode ? (
          <NodeDrawer className="sticky top-4" />
        ) : (
          <div className="bg-slate-900/40 border border-slate-800 rounded-xl h-[400px]">
            <EmptySelectionHint />
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component (with Provider)
// ============================================================================

export function StrategicMapClient({
  companyId,
  companyName,
  mapGraph,
  healthScore,
  isNewGraph,
  focusNodeId,
  globalInsights = [],
}: StrategicMapClientProps) {
  // Generate ghost nodes based on current graph state
  const ghostNodes = useMemo(
    () => generateGhostNodes(mapGraph, healthScore),
    [mapGraph, healthScore]
  );

  // Check if graph has enough data
  const hasData = hasEnoughData(mapGraph.nodes);

  // Empty state
  if (isNewGraph || !hasData) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="p-4 bg-slate-800/50 rounded-full mb-6">
          <Map className="w-12 h-12 text-slate-500" />
        </div>
        <h2 className="text-xl font-semibold text-slate-200 mb-2">
          Not enough context to render Strategic Map
        </h2>
        <p className="text-slate-400 text-center max-w-md mb-6">
          We need more data to create a useful visualization. Try auto-filling your company context or running key diagnostics.
        </p>
        <div className="flex gap-3">
          <Link
            href={`/c/${companyId}/brain/context`}
            className="px-4 py-2 bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors text-sm font-medium"
          >
            Go to Context
          </Link>
          <Link
            href={`/c/${companyId}/brain/setup`}
            className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors text-sm font-medium"
          >
            Run Setup Wizard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <StrategicMapProvider
      companyId={companyId}
      companyName={companyName}
      mapGraph={mapGraph}
      healthScore={healthScore}
      ghostNodes={ghostNodes}
      globalInsights={globalInsights}
      initialNodeId={focusNodeId}
    >
      <StrategicMapInner focusNodeId={focusNodeId} />
    </StrategicMapProvider>
  );
}
