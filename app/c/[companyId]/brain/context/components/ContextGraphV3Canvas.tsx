'use client';

// app/c/[companyId]/brain/context/components/ContextGraphV3Canvas.tsx
// Context Graph v3 Canvas - Static clustered layout visualization
//
// Features:
// - Domain clustering (nodes grouped by domain)
// - Importance-based sizing
// - Status-based coloring
// - Human override ring indicator
// - Change highlighting (glow for changed nodes)
// - Pan/zoom interaction

import { useMemo, useRef, useCallback, useState, useEffect } from 'react';
import type {
  ContextGraphV3Snapshot,
  ContextGraphNode,
  ContextGraphEdge,
  ContextNodeStatus,
  DomainClusterConfig,
} from '@/lib/contextGraph/contextGraphV3Types';

// Domain names - inlined to avoid server-side imports
type DomainName =
  | 'identity'
  | 'brand'
  | 'objectives'
  | 'audience'
  | 'productOffer'
  | 'digitalInfra'
  | 'website'
  | 'content'
  | 'seo'
  | 'ops'
  | 'performanceMedia'
  | 'historical'
  | 'creative'
  | 'competitive'
  | 'budgetOps'
  | 'operationalConstraints'
  | 'storeRisk'
  | 'historyRefs'
  | 'social';

type DomainClusterLayout = Record<DomainName, DomainClusterConfig>;

// Domain cluster layout generator - inlined to avoid server-side imports
function generateDomainClusterLayout(
  width: number,
  height: number
): DomainClusterLayout {
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

  const domainColors: Record<DomainName, string> = {
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

  const domainLabels: Record<DomainName, string> = {
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

  const layout: Partial<DomainClusterLayout> = {};

  for (const domain of Object.keys(domainAngles) as DomainName[]) {
    const angle = domainAngles[domain];
    layout[domain] = {
      center: {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      },
      color: domainColors[domain],
      label: domainLabels[domain],
      angle,
    };
  }

  return layout as DomainClusterLayout;
}

// ============================================================================
// Types
// ============================================================================

interface ContextGraphV3CanvasProps {
  graph: ContextGraphV3Snapshot;
  highlightOverrides: boolean;
  selectedNode: ContextGraphNode | null;
  onSelectNode: (node: ContextGraphNode | null) => void;
  width?: number;
  height?: number;
}

interface LayoutNode extends ContextGraphNode {
  x: number;
  y: number;
}

// ============================================================================
// Constants
// ============================================================================

const STATUS_COLORS: Record<ContextNodeStatus, string> = {
  ok: '#22c55e',           // green-500
  conflicted: '#ef4444',   // red-500
  low_confidence: '#f97316', // orange-500
  stale: '#eab308',        // yellow-500
  missing: '#4b5563',      // gray-600
};

const DOMAIN_COLORS: Record<DomainName, string> = {
  identity: '#14b8a6',        // teal-500
  brand: '#8b5cf6',           // violet-500
  objectives: '#f59e0b',      // amber-500
  audience: '#ec4899',        // pink-500
  productOffer: '#06b6d4',    // cyan-500
  digitalInfra: '#6366f1',    // indigo-500
  website: '#22c55e',         // green-500
  content: '#f97316',         // orange-500
  seo: '#0ea5e9',             // sky-500
  ops: '#64748b',             // slate-500
  performanceMedia: '#d946ef', // fuchsia-500
  historical: '#78716c',      // stone-500
  creative: '#a855f7',        // purple-500
  competitive: '#ef4444',     // red-500
  budgetOps: '#84cc16',       // lime-500
  operationalConstraints: '#f43f5e', // rose-500
  storeRisk: '#eab308',       // yellow-500
  historyRefs: '#71717a',     // zinc-500
  social: '#10b981',          // emerald-500
};

// ============================================================================
// Layout Computation
// ============================================================================

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
// Component
// ============================================================================

export function ContextGraphV3Canvas({
  graph,
  highlightOverrides,
  selectedNode,
  onSelectNode,
  width = 1200,
  height = 700,
}: ContextGraphV3CanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Compute layout
  const layout = useMemo(() => {
    return computeClusterLayout(graph.nodes, width, height);
  }, [graph.nodes, width, height]);

  // Get domain labels for cluster headers
  const clusterLayout = useMemo(() => {
    return generateDomainClusterLayout(width, height);
  }, [width, height]);

  // Handle zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.5, Math.min(3, transform.scale * delta));

    // Zoom toward cursor
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
    if (e.button === 0) { // Left click
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

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-950">
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        className="cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleBackgroundClick}
      >
        <defs>
          {/* Glow filter for changed nodes */}
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Gradient for edges */}
          <linearGradient id="edgeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#334155" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#334155" stopOpacity="0.1" />
          </linearGradient>
        </defs>

        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
          {/* Domain cluster labels */}
          {Object.entries(clusterLayout).map(([domain, config]) => {
            const nodeCount = graph.nodes.filter(n => n.domain === domain).length;
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

          {/* Edges */}
          <g className="edges">
            {graph.edges.map((edge) => {
              const source = layout.nodeById[edge.source];
              const target = layout.nodeById[edge.target];
              if (!source || !target) return null;

              const isHighlighted =
                selectedNode?.id === edge.source ||
                selectedNode?.id === edge.target;

              return (
                <line
                  key={`${edge.source}-${edge.target}`}
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke={isHighlighted ? '#60a5fa' : '#1e293b'}
                  strokeWidth={isHighlighted ? 1.5 : 0.8 * edge.weight}
                  strokeOpacity={isHighlighted ? 0.8 : 0.4}
                />
              );
            })}
          </g>

          {/* Nodes */}
          <g className="nodes">
            {layout.nodes.map((node) => {
              const isSelected = selectedNode?.id === node.id;
              const isHovered = hoveredNode === node.id;
              const isRelated = selectedNode?.neighbors.includes(node.id);

              // Size based on importance (5 = 16px, 1 = 6px)
              const radius = 4 + node.importance * 2.5;

              // Color based on domain (not status for better clustering visual)
              const fillColor = DOMAIN_COLORS[node.domain] || '#64748b';

              // Status indicator (border color)
              const borderColor = STATUS_COLORS[node.status];

              // Human override ring
              const showOverrideRing = highlightOverrides && node.isHumanOverride;

              // Changed glow
              const showChangedGlow = node.hasChangedSinceSnapshot;

              // Dim unrelated nodes when something is selected
              const isDimmed = selectedNode && !isSelected && !isRelated;

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  className="cursor-pointer transition-transform"
                  style={{
                    transform: `translate(${node.x}px, ${node.y}px)`,
                    opacity: isDimmed ? 0.3 : 1,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectNode(node);
                  }}
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                >
                  {/* Changed glow effect */}
                  {showChangedGlow && (
                    <circle
                      r={radius + 6}
                      fill="none"
                      stroke="#22d3ee"
                      strokeWidth={2}
                      opacity={0.6}
                      filter="url(#glow)"
                    />
                  )}

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

                  {/* Selection ring */}
                  {isSelected && (
                    <circle
                      r={radius + 4}
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth={2}
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
          className="flex h-8 w-8 items-center justify-center rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
        >
          +
        </button>
        <button
          onClick={() => setTransform(prev => ({
            ...prev,
            scale: Math.max(0.5, prev.scale / 1.2),
          }))}
          className="flex h-8 w-8 items-center justify-center rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
        >
          −
        </button>
        <button
          onClick={() => setTransform({ x: 0, y: 0, scale: 1 })}
          className="flex h-8 w-8 items-center justify-center rounded bg-slate-800 text-slate-300 hover:bg-slate-700 text-[10px]"
          title="Reset view"
        >
          ⟲
        </button>
      </div>

      {/* Hover tooltip */}
      {hoveredNode && !selectedNode && (
        <HoverTooltip
          node={layout.nodeById[hoveredNode]}
          containerRef={svgRef}
          transform={transform}
        />
      )}
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
        <div className="flex flex-wrap gap-1 text-[9px]">
          <span className={`px-1.5 py-0.5 rounded ${
            node.status === 'ok' ? 'bg-emerald-500/20 text-emerald-300' :
            node.status === 'conflicted' ? 'bg-red-500/20 text-red-300' :
            node.status === 'stale' ? 'bg-yellow-500/20 text-yellow-300' :
            node.status === 'low_confidence' ? 'bg-orange-500/20 text-orange-300' :
            'bg-slate-500/20 text-slate-400'
          }`}>
            {node.status}
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
