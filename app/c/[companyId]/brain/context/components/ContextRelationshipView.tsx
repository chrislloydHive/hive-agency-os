'use client';

// app/c/[companyId]/brain/context/components/ContextRelationshipView.tsx
// Context Map V4 - Full Interactive Graph with Story Mode
//
// Features:
// - Three interaction modes: Explore, Edit, Story
// - AI-assisted auto-layout (Category, Funnel, Semantic)
// - Story Mode with narrative stages
// - Insight overlays (Risks, Opportunities, Missing Links)
// - Node pinning with right-click context menu
// - Full zoom/pan with minimap
// - Ghost edges for missing relationships

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { RelationshipGraph, RelationshipNode, RelationshipEdge, NodePosition } from '@/lib/os/context';
import type { DomainName } from '@/lib/contextGraph/companyContextGraph';
import {
  CANVAS_SIZE,
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_SENSITIVITY,
  MINIMAP_SIZE,
  MINIMAP_SCALE,
  getNodeSize,
  computeClusteredLayout,
  resolveCollisions,
  calculateClusterZones,
  getInitialViewport,
  zoomAtPoint,
  screenToCanvas,
  getMinimapViewport,
  minimapClickToViewport,
  type ViewportTransform,
  type LayoutNode,
  type ClusterZone,
} from './GraphUtils';
import {
  autoLayoutByCategory,
  autoLayoutByFunnel,
  autoLayoutSemantic,
  STORY_STAGES,
  getNodesForStage,
  getCameraForStage,
  generateInsightOverlays,
  type InsightOverlayType,
  type InsightOverlay,
  type GhostEdge,
} from '@/lib/os/context/layout';

// ============================================================================
// Types
// ============================================================================

interface ContextRelationshipViewProps {
  companyId: string;
  relationshipData?: RelationshipGraph | null;
  onSelectNode?: (nodeId: string) => void;
  selectedNodeId?: string | null;
}

type InteractionMode = 'explore' | 'edit' | 'story';
type LayoutType = 'default' | 'category' | 'funnel' | 'semantic';

interface DragState {
  nodeId: string;
  startCanvasX: number;
  startCanvasY: number;
  offsetX: number;
  offsetY: number;
}

interface PanState {
  startX: number;
  startY: number;
  startTransformX: number;
  startTransformY: number;
}

interface ContextMenuState {
  nodeId: string;
  x: number;
  y: number;
}

// ============================================================================
// Constants
// ============================================================================

const STATUS_COLORS: Record<string, string> = {
  healthy: '#10b981',
  lowConfidence: '#f59e0b',
  conflict: '#ef4444',
  missing: '#64748b',
  stale: '#f97316',
};

const DOMAIN_COLORS: Record<string, string> = {
  identity: '#3b82f6',
  brand: '#f59e0b',
  audience: '#ec4899',
  objectives: '#f97316',
  website: '#10b981',
  seo: '#06b6d4',
  content: '#6366f1',
  competitive: '#ef4444',
  social: '#f43f5e',
  digitalInfra: '#14b8a6',
  performanceMedia: '#ef4444',
  ops: '#78716c',
  budgetOps: '#84cc16',
  creative: '#d946ef',
  historical: '#64748b',
  productOffer: '#8b5cf6',
  operationalConstraints: '#a3a3a3',
  storeRisk: '#dc2626',
  historyRefs: '#9ca3af',
  channels: '#22c55e',
};

const DOMAIN_LABELS: Record<string, string> = {
  identity: 'Identity',
  brand: 'Brand',
  audience: 'Audience',
  objectives: 'Objectives',
  website: 'Website',
  seo: 'SEO',
  content: 'Content',
  competitive: 'Competitive',
  social: 'Social',
  digitalInfra: 'Digital Infra',
  performanceMedia: 'Performance Media',
  ops: 'Operations',
  budgetOps: 'Budget',
  creative: 'Creative',
  historical: 'Historical',
  productOffer: 'Product/Offer',
  operationalConstraints: 'Constraints',
  storeRisk: 'Store Risk',
  historyRefs: 'History Refs',
  channels: 'Channels',
};

const EDGE_COLORS: Record<RelationshipEdge['type'], string> = {
  dependency: '#3b82f6',
  correlated: '#8b5cf6',
  derived: '#10b981',
};

const OVERLAY_COLORS: Record<InsightOverlayType, string> = {
  risks: '#ef4444',
  opportunities: '#10b981',
  missing: '#8b5cf6',
};

// ============================================================================
// Mode Toggle Component
// ============================================================================

interface ModeToggleProps {
  mode: InteractionMode;
  onChange: (mode: InteractionMode) => void;
}

function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div className="flex items-center bg-slate-800/80 rounded-lg p-1 border border-slate-700">
      {(['explore', 'edit', 'story'] as InteractionMode[]).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
            mode === m
              ? 'bg-amber-500 text-slate-900'
              : 'text-slate-400 hover:text-white hover:bg-slate-700'
          }`}
        >
          {m.charAt(0).toUpperCase() + m.slice(1)}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// Layout Dropdown Component
// ============================================================================

interface LayoutDropdownProps {
  onApply: (layout: LayoutType) => void;
  disabled?: boolean;
}

function LayoutDropdown({ onApply, disabled }: LayoutDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800/80 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors disabled:opacity-50"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
        Organize
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-40 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 overflow-hidden">
            <button
              onClick={() => { onApply('category'); setIsOpen(false); }}
              className="w-full px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
            >
              By Category
            </button>
            <button
              onClick={() => { onApply('funnel'); setIsOpen(false); }}
              className="w-full px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
            >
              By Funnel
            </button>
            <button
              onClick={() => { onApply('semantic'); setIsOpen(false); }}
              className="w-full px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
            >
              Semantic
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Overlay Toggle Component
// ============================================================================

interface OverlayToggleProps {
  activeOverlay: InsightOverlayType | null;
  onChange: (overlay: InsightOverlayType | null) => void;
  counts?: { risks: number; opportunities: number; missing: number };
}

function OverlayToggle({ activeOverlay, onChange, counts }: OverlayToggleProps) {
  const overlays: { type: InsightOverlayType; label: string; color: string; bgActive: string }[] = [
    { type: 'risks', label: 'Risks', color: 'text-red-400', bgActive: 'bg-red-500/20' },
    { type: 'opportunities', label: 'Opportunities', color: 'text-emerald-400', bgActive: 'bg-emerald-500/20' },
    { type: 'missing', label: 'Missing', color: 'text-purple-400', bgActive: 'bg-purple-500/20' },
  ];

  return (
    <div className="flex items-center gap-1 bg-slate-800/80 rounded-lg p-1 border border-slate-700">
      <span className="px-2 text-[10px] text-slate-500 uppercase">Highlights</span>
      {overlays.map(({ type, label, color, bgActive }) => {
        const count = counts?.[type] ?? 0;
        return (
          <button
            key={type}
            onClick={() => onChange(activeOverlay === type ? null : type)}
            className={`px-2 py-1 text-xs font-medium rounded transition-all flex items-center gap-1.5 ${
              activeOverlay === type
                ? `${bgActive} ${color}`
                : 'text-slate-500 hover:text-slate-300'
            }`}
            title={`Show ${label.toLowerCase()} (${count})`}
          >
            {label}
            {count > 0 && (
              <span className={`text-[10px] px-1 py-0.5 rounded-full ${
                activeOverlay === type ? 'bg-slate-800' : 'bg-slate-700'
              }`}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// Story Mode Navigation Component
// ============================================================================

interface StoryNavigationProps {
  currentStage: number;
  totalStages: number;
  stageName: string;
  stageDescription: string;
  onPrev: () => void;
  onNext: () => void;
  onExit: () => void;
}

function StoryNavigation({
  currentStage,
  totalStages,
  stageName,
  stageDescription,
  onPrev,
  onNext,
  onExit,
}: StoryNavigationProps) {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur-sm rounded-xl border border-slate-700 shadow-2xl p-4 max-w-md">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-white">{stageName}</h3>
        <button
          onClick={onExit}
          className="text-slate-500 hover:text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <p className="text-xs text-slate-400 mb-4">{stageDescription}</p>

      <div className="flex items-center justify-between">
        <button
          onClick={onPrev}
          disabled={currentStage === 0}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors disabled:opacity-30"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <div className="flex items-center gap-1">
          {Array.from({ length: totalStages }).map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all ${
                i === currentStage ? 'bg-amber-500 w-4' : 'bg-slate-600'
              }`}
            />
          ))}
        </div>

        <button
          onClick={onNext}
          disabled={currentStage === totalStages - 1}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-500 text-slate-900 hover:bg-amber-400 transition-colors disabled:opacity-30"
        >
          Next
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Context Menu Component
// ============================================================================

interface ContextMenuProps {
  state: ContextMenuState;
  isPinned: boolean;
  onPin: () => void;
  onUnpin: () => void;
  onClose: () => void;
}

function ContextMenu({ state, isPinned, onPin, onUnpin, onClose }: ContextMenuProps) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 min-w-[140px]"
        style={{ left: state.x, top: state.y }}
      >
        {isPinned ? (
          <button
            onClick={onUnpin}
            className="w-full px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-700 hover:text-white flex items-center gap-2"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
            </svg>
            Unpin Position
          </button>
        ) : (
          <button
            onClick={onPin}
            className="w-full px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-700 hover:text-white flex items-center gap-2"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            Pin Position
          </button>
        )}
      </div>
    </>
  );
}

// ============================================================================
// Graph Node Component
// ============================================================================

interface GraphNodeProps {
  node: RelationshipNode;
  position: NodePosition;
  transform: ViewportTransform;
  isSelected: boolean;
  isHighlighted: boolean;
  isDragging: boolean;
  isHovered: boolean;
  isPinned: boolean;
  isDimmed: boolean;
  overlayColor?: string;
  mode: InteractionMode;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onDragStart: (e: React.MouseEvent | React.TouchEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

function GraphNode({
  node,
  position,
  transform,
  isSelected,
  isHighlighted,
  isDragging,
  isHovered,
  isPinned,
  isDimmed,
  overlayColor,
  mode,
  onClick,
  onMouseEnter,
  onMouseLeave,
  onDragStart,
  onContextMenu,
}: GraphNodeProps) {
  const size = getNodeSize(node.importance);
  const radius = size / 2;
  const opacity = isDimmed ? 0.2 : node.isGhost ? 0.5 : 1;
  const statusColor = STATUS_COLORS[node.status] || STATUS_COLORS.missing;

  const screenX = position.x * transform.scale + transform.x;
  const screenY = position.y * transform.scale + transform.y;
  const screenRadius = radius * transform.scale;

  // Skip if off-screen
  const margin = 100;
  if (
    screenX < -margin ||
    screenY < -margin ||
    screenX > window.innerWidth + margin ||
    screenY > window.innerHeight + margin
  ) {
    return null;
  }

  const scale = isDragging ? 1.1 : isHovered ? 1.05 : 1;
  const canDrag = mode === 'edit';

  return (
    <g
      transform={`translate(${screenX}, ${screenY}) scale(${scale})`}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseDown={canDrag ? (e) => { e.stopPropagation(); onDragStart(e); } : undefined}
      onTouchStart={canDrag ? (e) => { e.stopPropagation(); onDragStart(e); } : undefined}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(e); }}
      style={{ cursor: canDrag ? (isDragging ? 'grabbing' : 'grab') : 'pointer' }}
    >
      {/* Insight overlay halo */}
      {overlayColor && !isDimmed && (
        <circle
          r={screenRadius + 15}
          fill="none"
          stroke={overlayColor}
          strokeWidth={4}
          strokeOpacity={0.6}
          strokeDasharray="8 4"
        >
          <animate
            attributeName="stroke-dashoffset"
            values="0;24"
            dur="1s"
            repeatCount="indefinite"
          />
        </circle>
      )}

      {/* Selection ring */}
      {isSelected && (
        <circle r={screenRadius + 10} fill="none" stroke="#f59e0b" strokeWidth={3} />
      )}

      {/* Highlight ring */}
      {isHighlighted && !isSelected && (
        <circle
          r={screenRadius + 7}
          fill="none"
          stroke="#f59e0b"
          strokeWidth={1.5}
          strokeDasharray="6 3"
          strokeOpacity={0.7}
        />
      )}

      {/* Drag shadow */}
      {isDragging && (
        <circle r={screenRadius + 4} fill="rgba(0,0,0,0.3)" transform="translate(3, 3)" />
      )}

      {/* Status ring */}
      <circle
        r={screenRadius}
        fill="none"
        stroke={statusColor}
        strokeWidth={node.status === 'missing' ? 2 : 3}
        strokeDasharray={node.status === 'missing' ? '4 4' : 'none'}
        strokeOpacity={opacity}
      />

      {/* Main circle */}
      <circle
        r={screenRadius - 3}
        fill={DOMAIN_COLORS[node.domain] || '#666'}
        opacity={opacity}
      />

      {/* Pin indicator */}
      {isPinned && (
        <g transform={`translate(${screenRadius * 0.6}, ${-screenRadius * 0.6})`}>
          <circle r={6} fill="#f59e0b" />
          <text y={3} textAnchor="middle" fill="#0f172a" fontSize={8} fontWeight="bold">
            P
          </text>
        </g>
      )}

      {/* Ghost indicator */}
      {node.isGhost && (
        <text y={4} textAnchor="middle" fill="white" fontSize={screenRadius * 0.8} fontWeight="bold">
          ?
        </text>
      )}

      {/* Label on hover */}
      {(isHovered || isSelected) && transform.scale > 0.4 && !isDimmed && (
        <g transform={`translate(0, ${screenRadius + 16})`}>
          <rect x={-60} y={-10} width={120} height={20} rx={4} fill="rgba(15, 23, 42, 0.95)" />
          <text textAnchor="middle" fill="white" fontSize={11} y={4}>
            {node.label.length > 16 ? node.label.slice(0, 14) + '...' : node.label}
          </text>
        </g>
      )}

      <title>{`${node.label}\n${DOMAIN_LABELS[node.domain] || node.domain} · ${node.status}${isPinned ? '\nPinned' : ''}`}</title>
    </g>
  );
}

// ============================================================================
// Graph Edge Component
// ============================================================================

interface GraphEdgeProps {
  edge: RelationshipEdge;
  fromPos: NodePosition;
  toPos: NodePosition;
  transform: ViewportTransform;
  isHighlighted: boolean;
  isDimmed: boolean;
  fromNodeImportance: number;
  toNodeImportance: number;
}

function GraphEdge({
  edge,
  fromPos,
  toPos,
  transform,
  isHighlighted,
  isDimmed,
  fromNodeImportance,
  toNodeImportance,
}: GraphEdgeProps) {
  const color = EDGE_COLORS[edge.type];
  const opacity = isDimmed ? 0.1 : edge.isGhost ? 0.2 : isHighlighted ? 0.9 : 0.4;
  const strokeWidth = isHighlighted ? 2.5 : 1.5;
  const dashArray = edge.type === 'correlated' ? '8 4' : edge.type === 'derived' ? '3 3' : undefined;

  const fromScreen = {
    x: fromPos.x * transform.scale + transform.x,
    y: fromPos.y * transform.scale + transform.y,
  };
  const toScreen = {
    x: toPos.x * transform.scale + transform.x,
    y: toPos.y * transform.scale + transform.y,
  };

  const dx = toScreen.x - fromScreen.x;
  const dy = toScreen.y - fromScreen.y;
  const len = Math.sqrt(dx * dx + dy * dy);

  if (len === 0) return null;

  const fromRadius = (getNodeSize(fromNodeImportance) / 2) * transform.scale;
  const toRadius = (getNodeSize(toNodeImportance) / 2) * transform.scale;

  const startX = fromScreen.x + (dx / len) * fromRadius;
  const startY = fromScreen.y + (dy / len) * fromRadius;
  const endX = toScreen.x - (dx / len) * (toRadius + 8);
  const endY = toScreen.y - (dy / len) * (toRadius + 8);

  return (
    <line
      x1={startX}
      y1={startY}
      x2={endX}
      y2={endY}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeOpacity={opacity}
      strokeDasharray={dashArray}
      markerEnd={`url(#arrowhead-${edge.type})`}
    />
  );
}

// ============================================================================
// Ghost Edge Component
// ============================================================================

interface GhostEdgeComponentProps {
  edge: GhostEdge;
  fromPos: NodePosition | undefined;
  toPos: NodePosition | undefined;
  transform: ViewportTransform;
}

function GhostEdgeComponent({ edge, fromPos, toPos, transform }: GhostEdgeComponentProps) {
  if (!fromPos || !toPos) return null;

  const fromScreen = {
    x: fromPos.x * transform.scale + transform.x,
    y: fromPos.y * transform.scale + transform.y,
  };
  const toScreen = {
    x: toPos.x * transform.scale + transform.x,
    y: toPos.y * transform.scale + transform.y,
  };

  const dx = toScreen.x - fromScreen.x;
  const dy = toScreen.y - fromScreen.y;
  const len = Math.sqrt(dx * dx + dy * dy);

  if (len === 0) return null;

  const midX = (fromScreen.x + toScreen.x) / 2;
  const midY = (fromScreen.y + toScreen.y) / 2;

  return (
    <g>
      <line
        x1={fromScreen.x}
        y1={fromScreen.y}
        x2={toScreen.x}
        y2={toScreen.y}
        stroke={OVERLAY_COLORS.missing}
        strokeWidth={2}
        strokeOpacity={0.4}
        strokeDasharray="10 5"
      >
        <animate
          attributeName="stroke-dashoffset"
          values="0;30"
          dur="1.5s"
          repeatCount="indefinite"
        />
      </line>
      {edge.label && (
        <g transform={`translate(${midX}, ${midY})`}>
          <rect x={-40} y={-8} width={80} height={16} rx={4} fill="rgba(139, 92, 246, 0.9)" />
          <text textAnchor="middle" fill="white" fontSize={9} y={3}>
            {edge.label}
          </text>
        </g>
      )}
    </g>
  );
}

// ============================================================================
// Cluster Background Component
// ============================================================================

function ClusterBackground({ zones, transform }: { zones: ClusterZone[]; transform: ViewportTransform }) {
  return (
    <g>
      {zones.map((zone, i) => {
        const screenX = zone.centerX * transform.scale + transform.x;
        const screenY = zone.centerY * transform.scale + transform.y;
        const screenRadius = zone.radius * transform.scale;
        return (
          <circle
            key={`cluster-${i}`}
            cx={screenX}
            cy={screenY}
            r={screenRadius}
            fill={zone.color}
            stroke={zone.color.replace('0.08', '0.15')}
            strokeWidth={1}
          />
        );
      })}
    </g>
  );
}

// ============================================================================
// Minimap Component
// ============================================================================

function Minimap({
  nodes,
  positions,
  transform,
  containerWidth,
  containerHeight,
  onNavigate,
}: {
  nodes: RelationshipNode[];
  positions: Map<string, NodePosition>;
  transform: ViewportTransform;
  containerWidth: number;
  containerHeight: number;
  onNavigate: (transform: ViewportTransform) => void;
}) {
  const viewport = getMinimapViewport(transform, containerWidth, containerHeight);

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    onNavigate(minimapClickToViewport(clickX, clickY, containerWidth, containerHeight, transform.scale));
  };

  return (
    <div className="absolute bottom-4 right-4 bg-slate-900/90 rounded-lg border border-slate-700 overflow-hidden shadow-lg">
      <svg width={MINIMAP_SIZE} height={MINIMAP_SIZE} onClick={handleClick} style={{ cursor: 'crosshair' }}>
        <rect width={MINIMAP_SIZE} height={MINIMAP_SIZE} fill="#0f172a" />
        <g opacity={0.1}>
          <line x1={MINIMAP_SIZE / 2} y1={0} x2={MINIMAP_SIZE / 2} y2={MINIMAP_SIZE} stroke="white" />
          <line x1={0} y1={MINIMAP_SIZE / 2} x2={MINIMAP_SIZE} y2={MINIMAP_SIZE / 2} stroke="white" />
        </g>
        {nodes.map((node) => {
          const pos = positions.get(node.id);
          if (!pos) return null;
          return (
            <circle
              key={node.id}
              cx={pos.x * MINIMAP_SCALE}
              cy={pos.y * MINIMAP_SCALE}
              r={2}
              fill={DOMAIN_COLORS[node.domain] || '#666'}
            />
          );
        })}
        <rect
          x={viewport.x}
          y={viewport.y}
          width={Math.max(10, viewport.width)}
          height={Math.max(10, viewport.height)}
          fill="rgba(245, 158, 11, 0.2)"
          stroke="#f59e0b"
          strokeWidth={1}
          rx={2}
        />
      </svg>
    </div>
  );
}

// ============================================================================
// Zoom Controls Component
// ============================================================================

function ZoomControls({
  transform,
  onZoomIn,
  onZoomOut,
  onFit,
  onReset,
  isLayoutLocked,
  onToggleLock,
}: {
  transform: ViewportTransform;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onReset: () => void;
  isLayoutLocked: boolean;
  onToggleLock: () => void;
}) {
  return (
    <div className="absolute bottom-4 right-44 flex items-center gap-1 bg-slate-900/90 rounded-lg border border-slate-700 p-1 shadow-lg">
      <button
        onClick={onZoomOut}
        disabled={transform.scale <= MIN_ZOOM}
        className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors disabled:opacity-30"
        title="Zoom out"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
        </svg>
      </button>
      <span className="w-12 text-center text-xs text-slate-400 tabular-nums">
        {Math.round(transform.scale * 100)}%
      </span>
      <button
        onClick={onZoomIn}
        disabled={transform.scale >= MAX_ZOOM}
        className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors disabled:opacity-30"
        title="Zoom in"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>
      <div className="w-px h-5 bg-slate-700 mx-1" />
      <button
        onClick={onFit}
        className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
        title="Fit to view"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
      </button>
      <button
        onClick={onReset}
        className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
        title="Reset view"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
      <div className="w-px h-5 bg-slate-700 mx-1" />
      <button
        onClick={onToggleLock}
        className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
          isLayoutLocked
            ? 'text-amber-400 bg-amber-500/20 hover:bg-amber-500/30'
            : 'text-slate-400 hover:text-white hover:bg-slate-800'
        }`}
        title={isLayoutLocked ? 'Unlock layout (currently locked)' : 'Lock layout'}
      >
        {isLayoutLocked ? (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
          </svg>
        )}
      </button>
    </div>
  );
}

// ============================================================================
// Toast Component
// ============================================================================

function Toast({ message, visible }: { message: string; visible: boolean }) {
  return (
    <div
      className={`fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 bg-slate-800 text-white text-sm rounded-lg shadow-lg transition-all duration-300 z-50 flex items-center gap-2 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
      }`}
    >
      <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
      {message}
    </div>
  );
}

// ============================================================================
// Legend Component
// ============================================================================

const RELATIONSHIP_TOOLTIPS: Record<string, string> = {
  dependency: 'One field requires another to be complete',
  correlated: 'Fields that tend to change together',
  derived: 'Field value computed from other fields',
};

const STATUS_TOOLTIPS: Record<string, string> = {
  healthy: 'Field is complete and up to date',
  lowConfidence: 'AI is uncertain about this value',
  conflict: 'Multiple conflicting values detected',
  missing: 'No value found for this field',
  stale: 'Value may be outdated',
};

const DOMAIN_TOOLTIPS: Record<string, string> = {
  identity: 'Company identity and positioning',
  brand: 'Brand assets and guidelines',
  audience: 'Target customers and segments',
  content: 'Content strategy and assets',
  competitive: 'Competitor landscape',
  ops: 'Operational constraints and processes',
};

function RelationshipLegend() {
  const domainSamples = ['identity', 'brand', 'audience', 'content', 'competitive', 'ops'];
  return (
    <div className="shrink-0 border-t border-slate-800 bg-slate-900/80 backdrop-blur-sm">
      <div className="px-4 py-3">
        <div className="flex flex-wrap items-start gap-6">
          <div className="space-y-1.5">
            <span className="text-[10px] text-slate-500 uppercase tracking-wide">Relationships</span>
            <div className="flex items-center gap-4">
              {[
                { type: 'dependency', color: 'text-blue-500', dash: '' },
                { type: 'correlated', color: 'text-purple-500', dash: '6 3' },
                { type: 'derived', color: 'text-emerald-500', dash: '3 3' },
              ].map(({ type, color, dash }) => (
                <div
                  key={type}
                  className="flex items-center gap-1.5 cursor-help"
                  title={RELATIONSHIP_TOOLTIPS[type]}
                >
                  <svg width="24" height="8" className={color}>
                    <line x1="0" y1="4" x2="24" y2="4" stroke="currentColor" strokeWidth="2" strokeDasharray={dash} />
                  </svg>
                  <span className="text-xs text-slate-400 capitalize">{type}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <span className="text-[10px] text-slate-500 uppercase tracking-wide">Status</span>
            <div className="flex items-center gap-3">
              {Object.entries(STATUS_COLORS).slice(0, 4).map(([status, color]) => (
                <div
                  key={status}
                  className="flex items-center gap-1 cursor-help"
                  title={STATUS_TOOLTIPS[status]}
                >
                  <div className="w-2.5 h-2.5 rounded-full border-2" style={{ borderColor: color }} />
                  <span className="text-xs text-slate-400 capitalize">{status}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <span className="text-[10px] text-slate-500 uppercase tracking-wide">Domains</span>
            <div className="flex items-center gap-3">
              {domainSamples.map((domain) => (
                <div
                  key={domain}
                  className="flex items-center gap-1 cursor-help"
                  title={DOMAIN_TOOLTIPS[domain]}
                >
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: DOMAIN_COLORS[domain] }} />
                  <span className="text-xs text-slate-400">{DOMAIN_LABELS[domain]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ContextRelationshipView({
  companyId,
  relationshipData,
  onSelectNode,
  selectedNodeId = null,
}: ContextRelationshipViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [fetchedData, setFetchedData] = useState<RelationshipGraph | null>(null);
  const [isLoading, setIsLoading] = useState(!relationshipData);
  const [error, setError] = useState<string | null>(null);

  // Mode and UI state
  const [mode, setMode] = useState<InteractionMode>('explore');
  const [activeOverlay, setActiveOverlay] = useState<InsightOverlayType | null>(null);
  const [storyStage, setStoryStage] = useState(0);

  // Transform state
  const [transform, setTransform] = useState<ViewportTransform>({ x: 0, y: 0, scale: 1 });

  // Interaction states
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [panState, setPanState] = useState<PanState | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Node state
  const [nodePositions, setNodePositions] = useState<Map<string, NodePosition>>(new Map());
  const [pinnedNodes, setPinnedNodes] = useState<Set<string>>(new Set());
  const [isDirty, setIsDirty] = useState(false);
  const [isLayoutLocked, setIsLayoutLocked] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });

  const layoutInitializedRef = useRef(false);
  const data = relationshipData || fetchedData;

  // Load layout lock preference from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`contextGraph:${companyId}:layoutLocked`);
      if (saved) setIsLayoutLocked(JSON.parse(saved));
    } catch {
      // Ignore localStorage errors
    }
  }, [companyId]);

  // Show toast helper
  const showToast = useCallback((message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast({ message: '', visible: false }), 2000);
  }, []);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setDimensions({ width: rect.width, height: rect.height });
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry && entry.contentRect.width > 0 && entry.contentRect.height > 0) {
        setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Fetch data
  useEffect(() => {
    if (relationshipData) {
      setIsLoading(false);
      return;
    }
    async function fetchData() {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/os/companies/${companyId}/context/graph`);
        if (!response.ok) throw new Error('Failed to load relationship data');
        const result = await response.json();
        if (result.success && result.snapshot) {
          const nodes: RelationshipNode[] = result.snapshot.nodes.map((n: Record<string, unknown>) => ({
            id: n.id as string,
            label: n.label as string,
            domain: n.domain as DomainName,
            status: (n.status as string) === 'ok' ? 'healthy' :
                    (n.status as string) === 'low_confidence' ? 'lowConfidence' :
                    (n.status as string) || 'missing',
            confidence: typeof n.confidence === 'number' ? n.confidence / 100 : 0.8,
            freshness: typeof n.freshness === 'number' ? n.freshness / 100 : 0.9,
            importance: typeof n.importance === 'number' ? n.importance : 3,
            isGhost: n.status === 'missing',
            value: n.value as string | null,
            position: n.position as NodePosition | undefined,
          }));
          const edges: RelationshipEdge[] = (result.snapshot.edges || []).map((e: Record<string, unknown>, i: number) => ({
            id: `edge-${i}`,
            fromNodeId: e.source as string,
            toNodeId: e.target as string,
            type: (e.kind as string) === 'dependency' ? 'dependency' :
                  (e.kind as string) === 'correlation' ? 'correlated' : 'derived',
            strength: typeof e.weight === 'number' ? e.weight : 0.5,
            isGhost: false,
          }));
          setFetchedData({ nodes, edges });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [companyId, relationshipData]);

  // Compute initial layout
  useEffect(() => {
    if (!data?.nodes || layoutInitializedRef.current) return;
    const layoutNodes: LayoutNode[] = data.nodes.map((n) => ({
      id: n.id,
      label: n.label,
      domain: n.domain,
      importance: n.importance,
      position: n.position,
    }));
    let positions = computeClusteredLayout(layoutNodes, 500);
    positions = resolveCollisions(layoutNodes, positions);
    setNodePositions(positions);
    const initialViewport = getInitialViewport(dimensions.width, dimensions.height, positions);
    setTransform(initialViewport);
    layoutInitializedRef.current = true;
  }, [data?.nodes, dimensions.width, dimensions.height]);

  // Cluster zones
  const clusterZones = useMemo<ClusterZone[]>(() => {
    if (!data?.nodes) return [];
    const layoutNodes: LayoutNode[] = data.nodes.map((n) => ({
      id: n.id,
      label: n.label,
      domain: n.domain,
      importance: n.importance,
    }));
    return calculateClusterZones(layoutNodes, nodePositions);
  }, [data?.nodes, nodePositions]);

  // Connected nodes for highlighting
  const connectedNodeIds = useMemo(() => {
    if (!selectedNodeId || !data?.edges) return new Set<string>();
    const connected = new Set<string>();
    for (const edge of data.edges) {
      if (edge.fromNodeId === selectedNodeId) connected.add(edge.toNodeId);
      if (edge.toNodeId === selectedNodeId) connected.add(edge.fromNodeId);
    }
    return connected;
  }, [selectedNodeId, data?.edges]);

  // Node importance map
  const nodeImportanceMap = useMemo(() => {
    const map = new Map<string, number>();
    if (data?.nodes) {
      for (const node of data.nodes) {
        map.set(node.id, node.importance);
      }
    }
    return map;
  }, [data?.nodes]);

  // Insight overlays
  const { overlays: insightOverlays, ghostEdges } = useMemo(() => {
    if (!activeOverlay || !data?.nodes) return { overlays: [], ghostEdges: [] };
    const layoutNodes: LayoutNode[] = data.nodes.map((n) => ({
      id: n.id,
      label: n.label,
      domain: n.domain,
      importance: n.importance,
    }));
    return generateInsightOverlays(layoutNodes, activeOverlay);
  }, [activeOverlay, data?.nodes]);

  // Create overlay map for quick lookup
  const overlayMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const overlay of insightOverlays) {
      map.set(overlay.nodeId, OVERLAY_COLORS[overlay.type]);
    }
    return map;
  }, [insightOverlays]);

  // Story mode: nodes to highlight
  const storyNodeIds = useMemo(() => {
    if (mode !== 'story' || !data?.nodes) return new Set<string>();
    const stage = STORY_STAGES[storyStage];
    if (!stage) return new Set<string>();
    return new Set(
      data.nodes.filter((n) => stage.domains.includes(n.domain)).map((n) => n.id)
    );
  }, [mode, storyStage, data?.nodes]);

  // Overlay counts for badges
  const overlayCounts = useMemo(() => {
    if (!data?.nodes) return { risks: 0, opportunities: 0, missing: 0 };
    const layoutNodes: LayoutNode[] = data.nodes.map((n) => ({
      id: n.id,
      label: n.label,
      domain: n.domain,
      importance: n.importance,
    }));
    // Count nodes that would be highlighted for each overlay type
    const risks = generateInsightOverlays(layoutNodes, 'risks').overlays.length;
    const opportunities = generateInsightOverlays(layoutNodes, 'opportunities').overlays.length;
    const missing = generateInsightOverlays(layoutNodes, 'missing').ghostEdges.length;
    return { risks, opportunities, missing };
  }, [data?.nodes]);

  // Keyboard handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isSpacePressed) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
        setPanState(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isSpacePressed]);

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const delta = -e.deltaY * ZOOM_SENSITIVITY * (e.ctrlKey ? 3 : 1);
    setTransform((prev) => zoomAtPoint(prev, delta, mouseX, mouseY));
  }, []);

  // Pan handlers
  const handlePanStart = useCallback((clientX: number, clientY: number) => {
    setPanState({
      startX: clientX,
      startY: clientY,
      startTransformX: transform.x,
      startTransformY: transform.y,
    });
  }, [transform]);

  const handlePanMove = useCallback((clientX: number, clientY: number) => {
    if (!panState) return;
    setTransform((prev) => ({
      ...prev,
      x: panState.startTransformX + (clientX - panState.startX),
      y: panState.startTransformY + (clientY - panState.startY),
    }));
  }, [panState]);

  const handlePanEnd = useCallback(() => setPanState(null), []);

  // Node drag handlers
  const handleNodeDragStart = useCallback((nodeId: string, clientX: number, clientY: number) => {
    // Don't allow drag if layout is locked
    if (isLayoutLocked) {
      showToast('Layout is locked');
      return;
    }
    const position = nodePositions.get(nodeId);
    if (!position) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const canvasPos = screenToCanvas(clientX - rect.left, clientY - rect.top, transform);
    setDragState({
      nodeId,
      startCanvasX: canvasPos.x,
      startCanvasY: canvasPos.y,
      offsetX: position.x - canvasPos.x,
      offsetY: position.y - canvasPos.y,
    });
  }, [nodePositions, transform, isLayoutLocked, showToast]);

  const handleNodeDragMove = useCallback((clientX: number, clientY: number) => {
    if (!dragState) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const canvasPos = screenToCanvas(clientX - rect.left, clientY - rect.top, transform);
    setNodePositions((prev) => {
      const next = new Map(prev);
      next.set(dragState.nodeId, {
        x: canvasPos.x + dragState.offsetX,
        y: canvasPos.y + dragState.offsetY,
      });
      return next;
    });
    setIsDirty(true);
  }, [dragState, transform]);

  const handleNodeDragEnd = useCallback(() => {
    setDragState(null);
  }, []);

  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 2 || (e.button === 0 && isSpacePressed)) {
      e.preventDefault();
      handlePanStart(e.clientX, e.clientY);
    }
  }, [isSpacePressed, handlePanStart]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (panState) handlePanMove(e.clientX, e.clientY);
    else if (dragState) handleNodeDragMove(e.clientX, e.clientY);
  }, [panState, dragState, handlePanMove, handleNodeDragMove]);

  const handleMouseUp = useCallback(() => {
    if (panState) handlePanEnd();
    if (dragState) handleNodeDragEnd();
  }, [panState, dragState, handlePanEnd, handleNodeDragEnd]);

  // Layout handlers
  const handleApplyLayout = useCallback((layout: LayoutType) => {
    if (!data?.nodes) return;
    const layoutNodes: LayoutNode[] = data.nodes.map((n) => ({
      id: n.id,
      label: n.label,
      domain: n.domain,
      importance: n.importance,
      pinned: pinnedNodes.has(n.id),
      position: nodePositions.get(n.id),
    }));

    let result;
    switch (layout) {
      case 'category':
        result = autoLayoutByCategory(layoutNodes);
        break;
      case 'funnel':
        result = autoLayoutByFunnel(layoutNodes);
        break;
      case 'semantic':
        result = autoLayoutSemantic(layoutNodes);
        break;
      default:
        return;
    }

    setNodePositions(result.positions);
    setIsDirty(true);
    showToast('Layout updated');
  }, [data?.nodes, pinnedNodes, nodePositions, showToast]);

  // Pin/Unpin handlers
  const handlePinNode = useCallback((nodeId: string) => {
    setPinnedNodes((prev) => new Set(prev).add(nodeId));
    setContextMenu(null);
    showToast('Position pinned');
  }, [showToast]);

  const handleUnpinNode = useCallback((nodeId: string) => {
    setPinnedNodes((prev) => {
      const next = new Set(prev);
      next.delete(nodeId);
      return next;
    });
    setContextMenu(null);
    showToast('Position unpinned');
  }, [showToast]);

  // Save/Reset handlers
  const handleSaveLayout = useCallback(() => {
    setIsDirty(false);
    showToast('Layout saved');
  }, [showToast]);

  const handleResetLayout = useCallback(() => {
    layoutInitializedRef.current = false;
    if (data?.nodes) {
      const layoutNodes: LayoutNode[] = data.nodes.map((n) => ({
        id: n.id,
        label: n.label,
        domain: n.domain,
        importance: n.importance,
        position: n.position,
      }));
      let positions = computeClusteredLayout(layoutNodes, 500);
      positions = resolveCollisions(layoutNodes, positions);
      setNodePositions(positions);
      setIsDirty(false);
      showToast('Layout reset');
    }
  }, [data?.nodes, showToast]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;
    setTransform((prev) => zoomAtPoint(prev, 0.2, centerX, centerY));
  }, [dimensions]);

  const handleZoomOut = useCallback(() => {
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;
    setTransform((prev) => zoomAtPoint(prev, -0.2, centerX, centerY));
  }, [dimensions]);

  const handleCenter = useCallback(() => {
    const initialViewport = getInitialViewport(dimensions.width, dimensions.height, nodePositions);
    setTransform(initialViewport);
  }, [dimensions, nodePositions]);

  const handleFitToView = useCallback(() => {
    const viewport = getInitialViewport(dimensions.width, dimensions.height, nodePositions);
    setTransform(viewport);
    showToast('Fit to view');
  }, [dimensions, nodePositions, showToast]);

  const handleResetView = useCallback(() => {
    setTransform({ x: 0, y: 0, scale: 1 });
    // Re-center on content
    const viewport = getInitialViewport(dimensions.width, dimensions.height, nodePositions);
    setTransform(viewport);
    showToast('View reset');
  }, [dimensions, nodePositions, showToast]);

  const handleToggleLock = useCallback(() => {
    setIsLayoutLocked((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(`contextGraph:${companyId}:layoutLocked`, JSON.stringify(next));
      } catch {
        // Ignore localStorage errors
      }
      showToast(next ? 'Layout locked' : 'Layout unlocked');
      return next;
    });
  }, [companyId, showToast]);

  // Story mode navigation
  const handleStoryPrev = useCallback(() => {
    setStoryStage((prev) => Math.max(0, prev - 1));
  }, []);

  const handleStoryNext = useCallback(() => {
    setStoryStage((prev) => Math.min(STORY_STAGES.length - 1, prev + 1));
  }, []);

  const handleExitStory = useCallback(() => {
    setMode('explore');
    setStoryStage(0);
  }, []);

  // Focus camera on story stage
  useEffect(() => {
    if (mode !== 'story' || !data?.nodes) return;
    const layoutNodes: LayoutNode[] = data.nodes.map((n) => ({
      id: n.id,
      label: n.label,
      domain: n.domain,
      importance: n.importance,
    }));
    const stage = STORY_STAGES[storyStage];
    if (!stage) return;
    const camera = getCameraForStage(nodePositions, layoutNodes, stage.id);
    setTransform({
      x: dimensions.width / 2 - camera.x * camera.scale,
      y: dimensions.height / 2 - camera.y * camera.scale,
      scale: camera.scale,
    });
  }, [mode, storyStage, nodePositions, dimensions, data?.nodes]);

  // Render loading/error/empty states
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-slate-400">Loading context map...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-red-400">
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!data || data.nodes.length < 2 || data.edges.length < 1) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center">
            <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-white mb-2">Not enough relationships to map yet</h3>
          <p className="text-sm text-slate-400">As you run diagnostics and add context, dependencies will appear here.</p>
        </div>
      </div>
    );
  }

  const cursor = panState ? 'grabbing' : isSpacePressed ? 'grab' : dragState ? 'grabbing' : 'default';
  const currentStage = STORY_STAGES[storyStage];

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Toolbar */}
      <div className="shrink-0 px-4 py-2 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ModeToggle mode={mode} onChange={setMode} />
          {mode === 'edit' && (
            <>
              <LayoutDropdown onApply={handleApplyLayout} />
              <div className="h-4 w-px bg-slate-700" />
              <button
                onClick={handleResetLayout}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
              >
                Reset
              </button>
              <button
                onClick={handleSaveLayout}
                disabled={!isDirty}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-500 text-slate-900 hover:bg-amber-400 transition-colors disabled:opacity-50"
              >
                Save Layout
              </button>
              {isDirty && <span className="text-xs text-amber-400">Unsaved changes</span>}
            </>
          )}
        </div>
        {mode !== 'story' && (
          <OverlayToggle activeOverlay={activeOverlay} onChange={setActiveOverlay} counts={overlayCounts} />
        )}
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="flex-1 bg-slate-950 min-h-0 overflow-hidden relative"
        style={{ minHeight: '500px', cursor }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        <svg width={dimensions.width} height={dimensions.height} style={{ display: 'block' }}>
          <defs>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <marker id="arrowhead-dependency" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill={EDGE_COLORS.dependency} />
            </marker>
            <marker id="arrowhead-correlated" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill={EDGE_COLORS.correlated} />
            </marker>
            <marker id="arrowhead-derived" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill={EDGE_COLORS.derived} />
            </marker>
          </defs>

          {/* Cluster backgrounds */}
          <ClusterBackground zones={clusterZones} transform={transform} />

          {/* Ghost edges (missing links overlay) */}
          {activeOverlay === 'missing' && (
            <g>
              {ghostEdges.map((edge, i) => (
                <GhostEdgeComponent
                  key={`ghost-${i}`}
                  edge={edge}
                  fromPos={nodePositions.get(edge.fromNodeId)}
                  toPos={nodePositions.get(edge.toNodeId)}
                  transform={transform}
                />
              ))}
            </g>
          )}

          {/* Edges */}
          <g>
            {data.edges.map((edge) => {
              const fromPos = nodePositions.get(edge.fromNodeId);
              const toPos = nodePositions.get(edge.toNodeId);
              if (!fromPos || !toPos) return null;
              const isHighlighted = selectedNodeId === edge.fromNodeId || selectedNodeId === edge.toNodeId;
              const isDimmed = mode === 'story' && !storyNodeIds.has(edge.fromNodeId) && !storyNodeIds.has(edge.toNodeId);
              return (
                <GraphEdge
                  key={edge.id}
                  edge={edge}
                  fromPos={fromPos}
                  toPos={toPos}
                  transform={transform}
                  isHighlighted={isHighlighted}
                  isDimmed={isDimmed}
                  fromNodeImportance={nodeImportanceMap.get(edge.fromNodeId) || 3}
                  toNodeImportance={nodeImportanceMap.get(edge.toNodeId) || 3}
                />
              );
            })}
          </g>

          {/* Nodes */}
          <g>
            {data.nodes.map((node) => {
              const position = nodePositions.get(node.id);
              if (!position) return null;
              const isDimmed = mode === 'story' && !storyNodeIds.has(node.id);
              return (
                <GraphNode
                  key={node.id}
                  node={node}
                  position={position}
                  transform={transform}
                  isSelected={selectedNodeId === node.id}
                  isHighlighted={connectedNodeIds.has(node.id)}
                  isDragging={dragState?.nodeId === node.id}
                  isHovered={hoveredNodeId === node.id}
                  isPinned={pinnedNodes.has(node.id)}
                  isDimmed={isDimmed}
                  overlayColor={overlayMap.get(node.id)}
                  mode={mode}
                  onClick={() => onSelectNode?.(node.id)}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  onDragStart={(e) => {
                    if ('touches' in e) {
                      handleNodeDragStart(node.id, e.touches[0].clientX, e.touches[0].clientY);
                    } else {
                      handleNodeDragStart(node.id, e.clientX, e.clientY);
                    }
                  }}
                  onContextMenu={(e) => setContextMenu({ nodeId: node.id, x: e.clientX, y: e.clientY })}
                />
              );
            })}
          </g>
        </svg>

        {/* Title card */}
        <div className="absolute top-4 left-4 bg-slate-900/90 backdrop-blur-sm rounded-lg px-3 py-2 border border-slate-800">
          <h3 className="text-sm font-medium text-white">Context Map</h3>
          <p className="text-xs text-slate-500">{data.nodes.length} nodes · {data.edges.length} relationships</p>
        </div>

        {/* Zoom controls */}
        <ZoomControls
          transform={transform}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onFit={handleFitToView}
          onReset={handleResetView}
          isLayoutLocked={isLayoutLocked}
          onToggleLock={handleToggleLock}
        />

        {/* Minimap */}
        <Minimap
          nodes={data.nodes}
          positions={nodePositions}
          transform={transform}
          containerWidth={dimensions.width}
          containerHeight={dimensions.height}
          onNavigate={setTransform}
        />

        {/* Story navigation */}
        {mode === 'story' && currentStage && (
          <StoryNavigation
            currentStage={storyStage}
            totalStages={STORY_STAGES.length}
            stageName={currentStage.title}
            stageDescription={currentStage.description}
            onPrev={handleStoryPrev}
            onNext={handleStoryNext}
            onExit={handleExitStory}
          />
        )}
      </div>

      {/* Legend */}
      <RelationshipLegend />

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          state={contextMenu}
          isPinned={pinnedNodes.has(contextMenu.nodeId)}
          onPin={() => handlePinNode(contextMenu.nodeId)}
          onUnpin={() => handleUnpinNode(contextMenu.nodeId)}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Toast */}
      <Toast message={toast.message} visible={toast.visible} />
    </div>
  );
}
