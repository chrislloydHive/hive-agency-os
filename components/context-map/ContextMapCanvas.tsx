// components/context-map/ContextMapCanvas.tsx
// Main SVG canvas for the Context Map with pan/zoom

'use client';

import { useRef, useCallback, useState, useEffect } from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import type { ComputedZone, ComputedEdge, Transform, PositionedNode, MapFilters } from './types';
import { LAYOUT, COLORS } from './constants';
import { ContextMapZone } from './ContextMapZone';
import { ContextMapEdges } from './ContextMapEdges';

interface ContextMapCanvasProps {
  zones: ComputedZone[];
  edges: ComputedEdge[];
  selectedNode: PositionedNode | null;
  hoveredNode: PositionedNode | null;
  hoveredZone: string | null;
  transform: Transform;
  filters: MapFilters;
  /** Enable focus mode: dim all zones except the focused one */
  focusMode?: boolean;
  /** Zone to focus on (if null, uses selectedNode's zone) */
  focusedZone?: string | null;
  /** Zone currently loading AI suggestions */
  loadingZoneId?: string | null;
  onNodeClick: (node: PositionedNode) => void;
  onNodeHover: (node: PositionedNode | null) => void;
  onZoneHover: (zoneId: string | null) => void;
  onTransformChange: (transform: Transform) => void;
  onResetView: () => void;
  onSuggestWithAI?: (zoneId: string) => void;
  onQuickConfirm?: (node: PositionedNode) => void;
  /** Called when user wants to edit a node's value */
  onEditNode?: (node: PositionedNode) => void;
  /** Called when user wants to view node details (same as click by default) */
  onViewNode?: (node: PositionedNode) => void;
  /** Called when user wants to delete a node */
  onDeleteNode?: (node: PositionedNode) => void;
  /** Called when user wants to add a new node (AI-assisted or manual) */
  onAddNode?: (zoneId: string, mode: 'ai' | 'manual') => void;
}

export function ContextMapCanvas({
  zones,
  edges,
  selectedNode,
  hoveredNode,
  hoveredZone,
  transform,
  filters,
  focusMode = false,
  focusedZone: focusedZoneProp,
  loadingZoneId,
  onNodeClick,
  onNodeHover,
  onZoneHover,
  onTransformChange,
  onResetView,
  onSuggestWithAI,
  onQuickConfirm,
  onEditNode,
  onViewNode,
  onDeleteNode,
  onAddNode,
}: ContextMapCanvasProps) {
  // Determine the focused zone (from prop or from selected node)
  const focusedZone = focusMode
    ? (focusedZoneProp ?? selectedNode?.zoneId ?? null)
    : null;
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Handle resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      setContainerSize({
        width: container.clientWidth,
        height: container.clientHeight,
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  // Calculate canvas dimensions
  const canvasWidth = Math.max(containerSize.width, 1200);
  const canvasHeight = Math.max(containerSize.height, 800);

  // Pan/Zoom handlers
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();

      const delta = e.deltaY > 0 ? 1 - LAYOUT.ZOOM_STEP : 1 + LAYOUT.ZOOM_STEP;
      const newScale = Math.max(
        LAYOUT.MIN_SCALE,
        Math.min(LAYOUT.MAX_SCALE, transform.scale * delta)
      );

      // Zoom toward cursor position
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      const scaleChange = newScale / transform.scale;
      const newX = cursorX - (cursorX - transform.x) * scaleChange;
      const newY = cursorY - (cursorY - transform.y) * scaleChange;

      onTransformChange({
        x: newX,
        y: newY,
        scale: newScale,
      });
    },
    [transform, onTransformChange]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return; // Only left click
      setIsPanning(true);
      setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    },
    [transform]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning) return;
      onTransformChange({
        ...transform,
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    },
    [isPanning, panStart, transform, onTransformChange]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsPanning(false);
    onNodeHover(null);
    onZoneHover(null);
  }, [onNodeHover, onZoneHover]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    const newScale = Math.min(LAYOUT.MAX_SCALE, transform.scale + LAYOUT.ZOOM_STEP);
    const centerX = containerSize.width / 2;
    const centerY = containerSize.height / 2;
    const scaleChange = newScale / transform.scale;
    onTransformChange({
      x: centerX - (centerX - transform.x) * scaleChange,
      y: centerY - (centerY - transform.y) * scaleChange,
      scale: newScale,
    });
  }, [transform, containerSize, onTransformChange]);

  const handleZoomOut = useCallback(() => {
    const newScale = Math.max(LAYOUT.MIN_SCALE, transform.scale - LAYOUT.ZOOM_STEP);
    const centerX = containerSize.width / 2;
    const centerY = containerSize.height / 2;
    const scaleChange = newScale / transform.scale;
    onTransformChange({
      x: centerX - (centerX - transform.x) * scaleChange,
      y: centerY - (centerY - transform.y) * scaleChange,
      scale: newScale,
    });
  }, [transform, containerSize, onTransformChange]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-slate-950"
      style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {/* SVG Canvas */}
      <svg
        width={containerSize.width}
        height={containerSize.height}
        className="select-none"
      >
        {/* Transform group */}
        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
          {/* Edges layer (behind zones) */}
          {filters.showEdges && (
            <ContextMapEdges
              edges={edges}
              hoveredZone={hoveredZone}
            />
          )}

          {/* Zones layer */}
          {zones.map((zone) => {
            // In focus mode, dim zones that aren't the focused zone
            const isDimmed = focusedZone !== null && focusedZone !== zone.id;

            return (
              <ContextMapZone
                key={zone.id}
                zone={zone}
                selectedNode={selectedNode}
                hoveredNode={hoveredNode}
                isHovered={hoveredZone === zone.id}
                isDimmed={isDimmed}
                onNodeClick={onNodeClick}
                onNodeHover={onNodeHover}
                onZoneHover={onZoneHover}
                onSuggestWithAI={onSuggestWithAI}
                onQuickConfirm={onQuickConfirm}
                onEditNode={onEditNode}
                onViewNode={onViewNode || onNodeClick}
                onDeleteNode={onDeleteNode}
                onAddNode={onAddNode}
                loadingZoneId={loadingZoneId}
              />
            );
          })}
        </g>
      </svg>

      {/* Zoom Controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1">
        <button
          onClick={handleZoomIn}
          className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 text-slate-300 transition-colors"
          title="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 text-slate-300 transition-colors"
          title="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={onResetView}
          className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 text-slate-300 transition-colors"
          title="Reset view"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Scale indicator */}
      <div className="absolute bottom-4 left-4 text-xs text-slate-500">
        {Math.round(transform.scale * 100)}%
      </div>
    </div>
  );
}
