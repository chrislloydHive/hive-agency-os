// components/competition/PositioningMapV3.tsx
// V3 Positioning Map with Value Model vs ICP axes
//
// X-axis: Value Model Similarity (0-100)
// Y-axis: ICP Alignment (0-100)
//
// Quadrants:
// - Top Right: Direct Threats (high ICP + high value)
// - Top Left: Different Value (high ICP + low value)
// - Bottom Right: Different ICP (low ICP + high value)
// - Bottom Left: Distant (low overlap)
//
// Features:
// - Zoom controls (+/- buttons and scroll wheel)
// - Pan support (drag to move when zoomed)
// - Reset to fit view

'use client';

import { useState, useRef, useCallback } from 'react';
import type { CompetitionCompetitor } from '@/lib/competition-v3/ui-types';
import { MAP_AXES, QUADRANT_LABELS } from '@/lib/competition-v3/ui-types';
import {
  getUiTypeModelForContext,
  getTypeTailwindClasses,
  getTypeLabel,
  getTypeHexColor as getUiTypeHexColor,
  mapTypeForContext,
  type BusinessModelCategory,
  type VerticalCategory,
} from '@/lib/competition-v3/uiTypeModel';

interface Props {
  companyName: string;
  competitors: CompetitionCompetitor[];
  selectedCompetitorId: string | null;
  hoveredCompetitorId?: string | null;
  onSelectCompetitor: (id: string | null) => void;
  onHoverCompetitor?: (id: string | null) => void;
  // Vertical-aware context
  businessModelCategory?: BusinessModelCategory | null;
  verticalCategory?: VerticalCategory | string | null;
}

export function PositioningMapV3({
  companyName,
  competitors,
  selectedCompetitorId,
  hoveredCompetitorId,
  onSelectCompetitor,
  onHoverCompetitor,
  businessModelCategory,
  verticalCategory,
}: Props) {
  // Get vertical-aware type model
  const typeModel = getUiTypeModelForContext({ businessModelCategory, verticalCategory });
  const typeContext = { businessModelCategory, verticalCategory };

  // Zoom and pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const minZoom = 1;
  const maxZoom = 3;
  const zoomStep = 0.5;

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev + zoomStep, maxZoom));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => {
      const newZoom = Math.max(prev - zoomStep, minZoom);
      if (newZoom === 1) {
        setPan({ x: 0, y: 0 });
      }
      return newZoom;
    });
  }, []);

  const handleReset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.2 : -0.2;
    setZoom(prev => {
      const newZoom = Math.max(minZoom, Math.min(maxZoom, prev + delta));
      if (newZoom === 1) {
        setPan({ x: 0, y: 0 });
      }
      return newZoom;
    });
  }, []);

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom > 1) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [zoom, pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning && zoom > 1) {
      const newX = e.clientX - panStart.x;
      const newY = e.clientY - panStart.y;

      // Calculate max pan based on zoom and container size
      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        const maxPanX = (rect.width * (zoom - 1)) / 2;
        const maxPanY = (rect.height * (zoom - 1)) / 2;
        setPan({
          x: Math.max(-maxPanX, Math.min(maxPanX, newX)),
          y: Math.max(-maxPanY, Math.min(maxPanY, newY)),
        });
      }
    }
  }, [isPanning, zoom, panStart]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsPanning(false);
  }, []);

  if (competitors.length === 0) {
    return (
      <div className="h-full flex items-center justify-center px-8">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center">
            <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <p className="text-slate-300 text-sm font-medium mb-2">No competitors to display</p>
          <p className="text-slate-500 text-xs leading-relaxed">
            Run Competition Analysis to populate the positioning map.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header row: Legend + Zoom Controls */}
      <div className="flex items-center justify-between mb-2 shrink-0">
        {/* Inline Legend - vertical-aware */}
        <div className="flex flex-wrap items-center gap-2 text-[10px]">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white/50" />
            <span className="text-slate-400">{companyName}</span>
          </div>
          <div className="w-px h-3 bg-slate-700" />
          {typeModel.legendOrder.map(type => (
            <div key={type} className="flex items-center gap-1">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: getUiTypeHexColor(type) }}
              />
              <span className="text-slate-500">{getTypeLabel(type)}</span>
            </div>
          ))}
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleZoomOut}
            disabled={zoom <= minZoom}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Zoom out"
          >
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>

          <span className="text-[10px] text-slate-500 w-8 text-center tabular-nums">
            {Math.round(zoom * 100)}%
          </span>

          <button
            onClick={handleZoomIn}
            disabled={zoom >= maxZoom}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Zoom in"
          >
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>

          {zoom > 1 && (
            <button
              onClick={handleReset}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-800 transition-colors ml-0.5"
              title="Reset view"
            >
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Map Container - clips the zoomed content */}
      <div
        ref={containerRef}
        className={`flex-1 relative overflow-hidden rounded-lg border border-slate-700 ${zoom > 1 ? 'cursor-grab' : ''} ${isPanning ? 'cursor-grabbing' : ''}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {/* Zoomable/pannable content */}
        <div
          className="absolute bg-slate-900/80"
          style={{
            width: `${100 * zoom}%`,
            height: `${100 * zoom}%`,
            left: `${50 - (50 * zoom) + (pan.x / (containerRef.current?.clientWidth || 1)) * 100}%`,
            top: `${50 - (50 * zoom) + (pan.y / (containerRef.current?.clientHeight || 1)) * 100}%`,
            transition: isPanning ? 'none' : 'all 0.2s ease-out',
          }}
        >
          {/* Grid lines */}
          <div className="absolute inset-0">
            {/* Center cross */}
            <div className="absolute w-px h-full left-1/2 bg-slate-700" />
            <div className="absolute h-px w-full top-1/2 bg-slate-700" />
            {/* Quarter lines */}
            <div className="absolute w-px h-full left-1/4 bg-slate-800/50" />
            <div className="absolute w-px h-full left-3/4 bg-slate-800/50" />
            <div className="absolute h-px w-full top-1/4 bg-slate-800/50" />
            <div className="absolute h-px w-full top-3/4 bg-slate-800/50" />
          </div>

          {/* Quadrant labels */}
          <div className="absolute top-2 left-2 text-[10px] max-w-[100px]" style={{ fontSize: `${10 / zoom}px` }}>
            <div className="font-medium text-slate-500">{QUADRANT_LABELS.topLeft.name}</div>
            <div className="text-slate-600 leading-tight">{QUADRANT_LABELS.topLeft.description}</div>
          </div>
          <div className="absolute top-2 right-2 text-[10px] text-right max-w-[100px]" style={{ fontSize: `${10 / zoom}px` }}>
            <div className="font-medium text-red-400/80">{QUADRANT_LABELS.topRight.name}</div>
            <div className="text-slate-600 leading-tight">{QUADRANT_LABELS.topRight.description}</div>
          </div>
          <div className="absolute bottom-2 left-2 text-[10px] max-w-[100px]" style={{ fontSize: `${10 / zoom}px` }}>
            <div className="font-medium text-slate-500">{QUADRANT_LABELS.bottomLeft.name}</div>
            <div className="text-slate-600 leading-tight">{QUADRANT_LABELS.bottomLeft.description}</div>
          </div>
          <div className="absolute bottom-2 right-2 text-[10px] text-right max-w-[100px]" style={{ fontSize: `${10 / zoom}px` }}>
            <div className="font-medium text-slate-500">{QUADRANT_LABELS.bottomRight.name}</div>
            <div className="text-slate-600 leading-tight">{QUADRANT_LABELS.bottomRight.description}</div>
          </div>

          {/* Competitor bubbles */}
          {competitors.map(comp => {
            const x = comp.coordinates.valueModelFit;
            const y = 100 - comp.coordinates.icpFit;

            // Size based on threat score - scale down when zoomed so they don't get huge
            const baseSize = 24;
            const maxSize = 48;
            const rawSize = baseSize + ((comp.scores.threat / 100) * (maxSize - baseSize));
            const size = rawSize / zoom; // Keep visual size constant

            const isSelected = comp.id === selectedCompetitorId;
            const isHovered = comp.id === hoveredCompetitorId;
            // Map backend type to UI type for this context
            const mappedType = mapTypeForContext(comp.type, typeContext);
            const colors = getTypeTailwindClasses(mappedType);

            return (
              <div
                key={comp.id}
                className="absolute group cursor-pointer"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: 'translate(-50%, -50%)',
                  zIndex: isSelected ? 10 : isHovered ? 9 : 1,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectCompetitor(comp.id);
                }}
                onMouseEnter={() => onHoverCompetitor?.(comp.id)}
                onMouseLeave={() => onHoverCompetitor?.(null)}
              >
                {/* Bubble */}
                <div
                  className={`rounded-full border-2 flex items-center justify-center text-white font-bold shadow-lg transition-all duration-200 ${
                    isSelected ? 'ring-2 ring-white/30 border-white scale-110' :
                    isHovered ? 'ring-2 ring-amber-400/50 border-amber-400 scale-110' :
                    'border-white/50 hover:scale-110'
                  }`}
                  style={{
                    width: size,
                    height: size,
                    fontSize: `${10 / zoom}px`,
                    backgroundColor: getUiTypeHexColor(mappedType),
                  }}
                >
                  {comp.name.slice(0, 2).toUpperCase()}
                </div>

                {/* Hover tooltip */}
                <div
                  className={`absolute left-1/2 -translate-x-1/2 transition-opacity bg-slate-800 p-2.5 rounded-lg text-slate-200 whitespace-nowrap z-20 shadow-xl border border-slate-700 pointer-events-none ${
                    isHovered ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}
                  style={{
                    top: `-${96 / zoom}px`,
                    fontSize: `${10 / zoom}px`,
                  }}
                >
                  <p className="font-semibold text-white" style={{ fontSize: `${12 / zoom}px` }}>{comp.name}</p>
                  {comp.domain && <p className="text-slate-400">{comp.domain}</p>}
                  <div className="mt-1.5 space-y-0.5">
                    <p>Type: <span className={colors.text}>{getTypeLabel(mappedType)}</span></p>
                    <p>Threat: <span className={comp.scores.threat >= 60 ? 'text-red-400' : 'text-slate-400'}>{comp.scores.threat}</span></p>
                    {comp.signals?.jtbdMatches != null && (
                      <p>JTBD: <span className="text-slate-300">{Math.round(comp.signals.jtbdMatches * 100)}%</span></p>
                    )}
                    {comp.signals?.offerOverlapScore != null && (
                      <p>Overlap: <span className="text-slate-300">{Math.round(comp.signals.offerOverlapScore * 100)}%</span></p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Center: "YOU" marker */}
          <div
            className="absolute"
            style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)', zIndex: 5 }}
          >
            <div
              className="rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-white font-bold shadow-lg"
              style={{
                width: `${36 / zoom}px`,
                height: `${36 / zoom}px`,
                fontSize: `${10 / zoom}px`,
              }}
            >
              YOU
            </div>
          </div>
        </div>

        {/* Axis labels - fixed position outside zoom */}
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-slate-500 bg-slate-900/90 px-2 py-0.5 rounded pointer-events-none">
          {MAP_AXES.x.label}
        </div>
        <div className="absolute left-1 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] text-slate-500 whitespace-nowrap origin-center bg-slate-900/90 px-2 py-0.5 rounded pointer-events-none">
          {MAP_AXES.y.label}
        </div>

        {/* Zoom hint */}
        {zoom === 1 && (
          <div className="absolute bottom-1 right-1 text-[9px] text-slate-600 bg-slate-900/70 px-1.5 py-0.5 rounded pointer-events-none">
            Scroll to zoom
          </div>
        )}
      </div>
    </div>
  );
}
