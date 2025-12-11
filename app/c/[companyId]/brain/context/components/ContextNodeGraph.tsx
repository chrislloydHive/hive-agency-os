'use client';

// app/c/[companyId]/brain/context/components/ContextNodeGraph.tsx
// Context Node Graph - Adapter component that renders GraphFieldUi as an interactive graph
//
// This component adapts the existing GraphFieldUi[] data from ContextGraphViewer
// into the format expected by ContextGraphV3Canvas, providing a visual graph view
// that integrates with the existing selection/deep-linking system.

import { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import type { GraphFieldUi, ContextDomainId } from '@/lib/contextGraph/uiHelpers';
import type { NeedsRefreshFlag } from '@/lib/contextGraph/contextHealth';
import type {
  ContextGraphNode,
  ContextGraphEdge,
  ContextGraphV3Snapshot,
  ContextNodeStatus,
} from '@/lib/contextGraph/contextGraphV3Types';
import type { DomainName } from '@/lib/contextGraph/companyContextGraph';

// ============================================================================
// Types
// ============================================================================

export interface ContextNodeGraphProps {
  /** All fields to display as nodes */
  fields: GraphFieldUi[];
  /** Needs refresh flags for status indication */
  needsRefresh: Map<string, NeedsRefreshFlag>;
  /** Company ID for the graph */
  companyId: string;
  /** Currently selected node path */
  selectedNodeId: string | null;
  /** Callback when a node is selected */
  onSelectNode: (nodeId: string | null) => void;
}

// ============================================================================
// Domain Configuration (mirrored from ContextGraphV3Canvas)
// ============================================================================

const DOMAIN_COLORS: Record<DomainName, string> = {
  identity: '#14b8a6',
  brand: '#8b5cf6',
  objectives: '#f59e0b',
  audience: '#ec4899',
  productOffer: '#06b6d4',
  digitalInfra: '#6366f1',
  website: '#22c55e',
  content: '#f97316',
  seo: '#0ea5e9',
  ops: '#64748b',
  performanceMedia: '#d946ef',
  historical: '#78716c',
  creative: '#a855f7',
  competitive: '#ef4444',
  budgetOps: '#84cc16',
  operationalConstraints: '#f43f5e',
  storeRisk: '#eab308',
  historyRefs: '#71717a',
  social: '#10b981',
};

const DOMAIN_LABELS: Record<DomainName, string> = {
  identity: 'Identity',
  brand: 'Brand',
  objectives: 'Objectives',
  audience: 'Audience',
  productOffer: 'Product/Offer',
  digitalInfra: 'Digital Infra',
  website: 'Website',
  content: 'Content',
  seo: 'SEO',
  ops: 'Operations',
  performanceMedia: 'Media',
  historical: 'Historical',
  creative: 'Creative',
  competitive: 'Competitive',
  budgetOps: 'Budget',
  operationalConstraints: 'Constraints',
  storeRisk: 'Risk',
  historyRefs: 'History',
  social: 'Social & Local',
};

const STATUS_COLORS: Record<ContextNodeStatus, string> = {
  ok: '#22c55e',
  conflicted: '#ef4444',
  low_confidence: '#f97316',
  stale: '#eab308',
  missing: '#4b5563',
};

// ============================================================================
// Layout Types & Computation
// ============================================================================

interface LayoutNode extends ContextGraphNode {
  x: number;
  y: number;
}

interface DomainClusterConfig {
  center: { x: number; y: number };
  color: string;
  label: string;
  angle: number;
}

function generateDomainClusterLayout(
  width: number,
  height: number
): Record<DomainName, DomainClusterConfig> {
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.38;

  const domainAngles: Record<DomainName, number> = {
    identity: -Math.PI / 2,
    brand: -Math.PI / 3,
    objectives: -2 * Math.PI / 3,
    audience: -Math.PI / 6,
    competitive: Math.PI / 6,
    productOffer: -5 * Math.PI / 6,
    budgetOps: 5 * Math.PI / 6,
    creative: Math.PI / 3,
    content: Math.PI / 2.5,
    website: Math.PI / 2,
    seo: 2 * Math.PI / 3,
    performanceMedia: 3 * Math.PI / 4,
    ops: 5 * Math.PI / 6,
    digitalInfra: 11 * Math.PI / 12,
    historical: Math.PI,
    operationalConstraints: -Math.PI,
    storeRisk: 7 * Math.PI / 8,
    historyRefs: -7 * Math.PI / 8,
    social: Math.PI / 4,
  };

  const layout: Partial<Record<DomainName, DomainClusterConfig>> = {};

  for (const domain of Object.keys(domainAngles) as DomainName[]) {
    const angle = domainAngles[domain];
    layout[domain] = {
      center: {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      },
      color: DOMAIN_COLORS[domain],
      label: DOMAIN_LABELS[domain],
      angle,
    };
  }

  return layout as Record<DomainName, DomainClusterConfig>;
}

function computeClusterLayout(
  nodes: ContextGraphNode[],
  width: number,
  height: number
): { nodes: LayoutNode[]; nodeById: Record<string, LayoutNode> } {
  const clusterLayout = generateDomainClusterLayout(width, height);

  // Group nodes by domain
  const nodesByDomain: Record<string, ContextGraphNode[]> = {};
  for (const node of nodes) {
    const domain = node.domain ?? 'identity';
    if (!nodesByDomain[domain]) nodesByDomain[domain] = [];
    nodesByDomain[domain].push(node);
  }

  const laidOutNodes: LayoutNode[] = [];
  const nodeById: Record<string, LayoutNode> = {};

  // Sort domains by node count for better layout
  const sortedDomains = Object.entries(nodesByDomain)
    .sort(([, a], [, b]) => b.length - a.length)
    .map(([domain]) => domain);

  for (const domain of sortedDomains) {
    const domainNodes = nodesByDomain[domain];
    const config = clusterLayout[domain as DomainName];

    if (!config || !domainNodes) continue;

    const center = config.center;

    // Sort nodes by importance (higher importance = closer to center)
    const sorted = [...domainNodes].sort((a, b) => b.importance - a.importance);

    // Spiral layout for nodes within domain
    const baseRadius = Math.min(40 + domainNodes.length * 6, 120);

    sorted.forEach((node, idx) => {
      // Use golden angle for even distribution
      const goldenAngle = Math.PI * (3 - Math.sqrt(5));
      const angle = idx * goldenAngle;

      // Higher importance = smaller radius (closer to center)
      const importanceOffset = (5 - node.importance) * 8;
      const spiralRadius = baseRadius * 0.3 + importanceOffset + (idx * 3);

      const x = center.x + Math.cos(angle) * spiralRadius;
      const y = center.y + Math.sin(angle) * spiralRadius;

      const extended: LayoutNode = { ...node, x, y };
      laidOutNodes.push(extended);
      nodeById[node.id] = extended;
    });
  }

  return { nodes: laidOutNodes, nodeById };
}

// ============================================================================
// Field to Node Conversion
// ============================================================================

function convertFieldToNode(
  field: GraphFieldUi,
  needsRefreshMap: Map<string, NeedsRefreshFlag>
): ContextGraphNode {
  // Determine status from field data
  let status: ContextNodeStatus = 'ok';
  const refreshFlag = needsRefreshMap.get(field.path);

  if (field.value === null || field.value === '') {
    status = 'missing';
  } else if (refreshFlag) {
    if (refreshFlag.reason === 'expired') {
      status = 'stale';
    } else if (refreshFlag.reason === 'stale') {
      status = 'stale';
    }
  } else if (field.freshness && field.freshness.normalized < 0.5) {
    status = 'stale';
  }

  // Calculate importance based on domain criticality
  const criticalDomains = ['identity', 'audience', 'objectives', 'brand'];
  const moderateDomains = ['competitive', 'productOffer', 'creative'];
  let importance = 2;
  if (criticalDomains.includes(field.domain)) {
    importance = 4;
  } else if (moderateDomains.includes(field.domain)) {
    importance = 3;
  }

  // Check for manual override from provenance
  const isHumanOverride = field.provenance?.some(p => p.source === 'manual') ?? false;

  // Calculate confidence from freshness
  const confidence = field.freshness
    ? Math.round(field.freshness.normalized * 100)
    : field.value ? 70 : 0;

  return {
    id: field.path,
    key: field.path,
    label: field.label,
    domain: field.domain as DomainName,
    importance,
    status,
    confidence,
    freshness: field.freshness ? Math.round(field.freshness.normalized * 100) : 0,
    isHumanOverride,
    hasChangedSinceSnapshot: false,
    neighbors: [],
    value: field.value,
    provenance: field.provenance ? {
      sources: field.provenance.map(p => ({
        source: p.source,
        confidence: p.confidence ?? 0.8,
        timestamp: p.updatedAt ?? new Date().toISOString(),
        notes: p.notes,
      })),
    } : undefined,
  };
}

// ============================================================================
// Component
// ============================================================================

export function ContextNodeGraph({
  fields,
  needsRefresh,
  companyId,
  selectedNodeId,
  onSelectNode,
}: ContextNodeGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [dimensions, setDimensions] = useState({ width: 1200, height: 700 });
  const [edges, setEdges] = useState<ContextGraphEdge[]>([]);
  const [showEdges, setShowEdges] = useState(true);

  // Fetch edges from the V3 API
  useEffect(() => {
    async function fetchEdges() {
      try {
        const response = await fetch(`/api/os/companies/${companyId}/context/graph`);
        if (response.ok) {
          const snapshot: ContextGraphV3Snapshot = await response.json();
          setEdges(snapshot.edges || []);
        }
      } catch (error) {
        console.error('[ContextNodeGraph] Failed to fetch edges:', error);
      }
    }
    fetchEdges();
  }, [companyId]);

  // Measure container size
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: Math.max(800, entry.contentRect.width),
          height: Math.max(500, entry.contentRect.height),
        });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Convert fields to graph nodes
  const nodes = useMemo(() => {
    return fields.map(field => convertFieldToNode(field, needsRefresh));
  }, [fields, needsRefresh]);

  // Find the selected node
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return nodes.find(n => n.id === selectedNodeId) ?? null;
  }, [nodes, selectedNodeId]);

  // Compute layout
  const layout = useMemo(() => {
    return computeClusterLayout(nodes, dimensions.width, dimensions.height);
  }, [nodes, dimensions.width, dimensions.height]);

  // Get domain labels for cluster headers
  const clusterLayout = useMemo(() => {
    return generateDomainClusterLayout(dimensions.width, dimensions.height);
  }, [dimensions.width, dimensions.height]);

  // Handle zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.5, Math.min(3, transform.scale * delta));

    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;

    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    const scaleDiff = newScale - transform.scale;
    const newX = transform.x - (cursorX - transform.x) * (scaleDiff / transform.scale);
    const newY = transform.y - (cursorY - transform.y) * (scaleDiff / transform.scale);

    setTransform({ x: newX, y: newY, scale: newScale });
  }, [transform]);

  // Handle pan start
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    }
  }, [transform]);

  // Handle pan move
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setTransform(prev => ({
        ...prev,
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      }));
    }
  }, [isPanning, panStart]);

  // Handle pan end
  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Handle background click
  const handleBackgroundClick = useCallback(() => {
    onSelectNode(null);
  }, [onSelectNode]);

  // Handle node click
  const handleNodeClick = useCallback((nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectNode(nodeId);
  }, [onSelectNode]);

  // Empty state
  if (fields.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="w-16 h-16 mb-4 rounded-full bg-slate-800 flex items-center justify-center">
          <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </div>
        <h3 className="text-sm font-medium text-slate-300 mb-1">No nodes to display</h3>
        <p className="text-xs text-slate-500 max-w-sm">
          As Context fills in, this view will visualize how your company context is connected.
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-slate-950 rounded-lg border border-slate-800">
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        className="cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleBackgroundClick}
      >
        <defs>
          {/* Glow filter for selected nodes */}
          <filter id="glow-selected" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
          {/* Domain cluster labels */}
          {Object.entries(clusterLayout).map(([domain, config]) => {
            const nodeCount = nodes.filter(n => n.domain === domain).length;
            if (nodeCount === 0) return null;

            return (
              <text
                key={`label-${domain}`}
                x={config.center.x}
                y={config.center.y - 80}
                textAnchor="middle"
                className="fill-slate-500 text-[10px] font-medium uppercase tracking-wide"
                style={{ pointerEvents: 'none' }}
              >
                {config.label}
              </text>
            );
          })}

          {/* Edges - rendered before nodes so nodes appear on top */}
          {showEdges && edges.length > 0 && (
            <g className="edges">
              {edges.map((edge, idx) => {
                const sourceNode = layout.nodeById[edge.source];
                const targetNode = layout.nodeById[edge.target];

                // Skip edges where we don't have both nodes in the layout
                if (!sourceNode || !targetNode) return null;

                // Determine if edge is related to selected node
                const isHighlighted = selectedNodeId === edge.source || selectedNodeId === edge.target;
                const isDimmed = selectedNodeId && !isHighlighted;

                // Edge styling based on kind
                const edgeColors: Record<string, string> = {
                  dependency: '#f59e0b',   // Amber
                  correlation: '#8b5cf6',  // Purple
                  derived: '#06b6d4',      // Cyan
                };
                const edgeColor = edgeColors[edge.kind] || '#64748b';

                // Stroke width based on weight
                const strokeWidth = isHighlighted
                  ? 2.5
                  : (0.5 + edge.weight * 1.5);

                return (
                  <line
                    key={`edge-${idx}`}
                    x1={sourceNode.x}
                    y1={sourceNode.y}
                    x2={targetNode.x}
                    y2={targetNode.y}
                    stroke={edgeColor}
                    strokeWidth={strokeWidth}
                    strokeOpacity={isDimmed ? 0.1 : isHighlighted ? 0.9 : 0.3}
                    style={{
                      transition: 'stroke-opacity 0.2s ease',
                    }}
                  />
                );
              })}
            </g>
          )}

          {/* Nodes */}
          <g className="nodes">
            {layout.nodes.map((node) => {
              const isSelected = selectedNodeId === node.id;
              const isHovered = hoveredNode === node.id;
              const isRelated = selectedNode?.neighbors.includes(node.id);

              // Size based on importance (5 = 16px, 1 = 6px)
              const radius = 4 + node.importance * 2.5;

              // Color based on domain
              const fillColor = DOMAIN_COLORS[node.domain] || '#64748b';

              // Status indicator (border color)
              const borderColor = STATUS_COLORS[node.status];

              // Human override ring
              const showOverrideRing = node.isHumanOverride;

              // Dim unrelated nodes when something is selected
              const isDimmed = selectedNode && !isSelected && !isRelated;

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  className="cursor-pointer"
                  style={{
                    opacity: isDimmed ? 0.3 : 1,
                    transition: 'opacity 0.2s ease',
                  }}
                  onClick={(e) => handleNodeClick(node.id, e)}
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                >
                  {/* Human override ring */}
                  {showOverrideRing && (
                    <circle
                      r={radius + 3}
                      fill="none"
                      stroke="#fbbf24"
                      strokeWidth={2}
                      strokeDasharray="4 2"
                    />
                  )}

                  {/* Selection ring (amber to match FieldCard) */}
                  {isSelected && (
                    <circle
                      r={radius + 5}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth={2.5}
                      filter="url(#glow-selected)"
                    />
                  )}

                  {/* Main node circle */}
                  <circle
                    r={radius}
                    fill={fillColor}
                    stroke={isHovered || isSelected ? '#ffffff' : borderColor}
                    strokeWidth={isHovered || isSelected ? 2 : 1.5}
                    opacity={0.9}
                  />

                  {/* Status indicator dot (for non-ok status) */}
                  {node.status !== 'ok' && (
                    <circle
                      cx={radius * 0.7}
                      cy={-radius * 0.7}
                      r={3}
                      fill={borderColor}
                      stroke="#0f172a"
                      strokeWidth={1}
                    />
                  )}

                  {/* Label (show for high importance or hovered/selected) */}
                  {(node.importance >= 4 || isHovered || isSelected) && (
                    <text
                      y={radius + 12}
                      textAnchor="middle"
                      className={`text-[9px] ${
                        isSelected || isHovered
                          ? 'fill-slate-100'
                          : 'fill-slate-400'
                      }`}
                      style={{ pointerEvents: 'none' }}
                    >
                      {node.label.length > 18
                        ? `${node.label.slice(0, 16)}...`
                        : node.label}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </g>
      </svg>

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1">
        <button
          onClick={() => setTransform(prev => ({
            ...prev,
            scale: Math.min(3, prev.scale * 1.2),
          }))}
          className="flex h-8 w-8 items-center justify-center rounded bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
        >
          +
        </button>
        <button
          onClick={() => setTransform(prev => ({
            ...prev,
            scale: Math.max(0.5, prev.scale / 1.2),
          }))}
          className="flex h-8 w-8 items-center justify-center rounded bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
        >
          −
        </button>
        <button
          onClick={() => setTransform({ x: 0, y: 0, scale: 1 })}
          className="flex h-8 w-8 items-center justify-center rounded bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700 text-[10px]"
          title="Reset view"
        >
          ⟲
        </button>
      </div>

      {/* Hover tooltip */}
      {hoveredNode && !selectedNodeId && (
        <HoverTooltip
          node={layout.nodeById[hoveredNode]}
          containerRef={svgRef}
          transform={transform}
        />
      )}

      {/* Legend */}
      <div className="absolute top-4 left-4 bg-slate-900/90 border border-slate-800 rounded-lg p-3 text-[10px] space-y-3">
        {/* Node Status Legend */}
        <div>
          <div className="text-slate-400 font-medium mb-2 uppercase tracking-wide">Node Status</div>
          <div className="space-y-1">
            {Object.entries(STATUS_COLORS).map(([status, color]) => (
              <div key={status} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-slate-300 capitalize">{status.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Edge Types Legend */}
        {edges.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 font-medium uppercase tracking-wide">Edges</span>
              <button
                onClick={() => setShowEdges(!showEdges)}
                className={`px-1.5 py-0.5 rounded text-[9px] transition-colors ${
                  showEdges
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'bg-slate-700 text-slate-400'
                }`}
              >
                {showEdges ? 'ON' : 'OFF'}
              </button>
            </div>
            {showEdges && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5" style={{ backgroundColor: '#f59e0b' }} />
                  <span className="text-slate-300">Dependency</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5" style={{ backgroundColor: '#8b5cf6' }} />
                  <span className="text-slate-300">Correlation</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5" style={{ backgroundColor: '#06b6d4' }} />
                  <span className="text-slate-300">Derived</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Edge count */}
        {edges.length > 0 && showEdges && (
          <div className="pt-2 border-t border-slate-700 text-slate-500">
            {edges.length} relationship{edges.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Hover Tooltip
// ============================================================================

function HoverTooltip({
  node,
  containerRef,
  transform,
}: {
  node: LayoutNode | undefined;
  containerRef: React.RefObject<SVGSVGElement | null>;
  transform: { x: number; y: number; scale: number };
}) {
  if (!node) return null;

  // Calculate screen position
  const screenX = (node.x * transform.scale) + transform.x;
  const screenY = (node.y * transform.scale) + transform.y;

  // Get container width to determine if tooltip should flip to left side
  const containerWidth = containerRef.current?.clientWidth ?? 1200;
  const isNearRightEdge = screenX > containerWidth - 250;

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: isNearRightEdge ? screenX - 220 : screenX + 20,
        top: screenY - 10,
        zIndex: 9999,
      }}
    >
      <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-2 max-w-[200px]">
        <div className="text-[11px] font-medium text-slate-100 mb-1">
          {node.label}
        </div>
        <div className="text-[9px] text-slate-500 font-mono mb-1.5">
          {node.key}
        </div>
        <div className="flex flex-wrap gap-1 text-[9px]">
          <span className={`px-1.5 py-0.5 rounded ${
            node.status === 'ok' ? 'bg-emerald-500/20 text-emerald-300' :
            node.status === 'conflicted' ? 'bg-red-500/20 text-red-300' :
            node.status === 'stale' ? 'bg-yellow-500/20 text-yellow-300' :
            node.status === 'low_confidence' ? 'bg-orange-500/20 text-orange-300' :
            'bg-slate-500/20 text-slate-400'
          }`}>
            {node.status.replace('_', ' ')}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
            {node.confidence}% conf
          </span>
          {node.isHumanOverride && (
            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
              Human
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default ContextNodeGraph;
