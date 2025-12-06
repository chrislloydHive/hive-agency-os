'use client';

// components/competitive/PositioningMapCore.tsx
// Style 1: Hive OS Default Positioning Map - EXPANDED
//
// Used in Brain → Context → Competitive section
// Clean, minimal, analytic visual style with editing capabilities
//
// Now supports:
// - Market clusters (shaded regions)
// - Whitespace opportunities (dashed target areas)
// - Confidence-based point sizing
// - Threat level color gradients

import { useState, useCallback, useMemo, useRef } from 'react';
import {
  mapPositionToSvgCoordinates,
  type CompetitorPoint,
  type BrandPosition,
} from './positioningMapUtils';

// ============================================================================
// Types
// ============================================================================

export interface MarketClusterDisplay {
  name: string;
  position: { x: number; y: number }; // 0-100
  competitors: string[];
  threatLevel: number; // 0-100
  color?: string;
}

export interface WhitespaceMarker {
  name: string;
  position: { x: number; y: number }; // 0-100
  size: number; // 0-100
  strategicFit?: number; // 0-100
}

export interface PositioningMapCoreProps {
  /** Primary axis label (e.g., "Premium ↔ Affordable") */
  primaryAxisLabel: string;
  /** Secondary axis label (e.g., "Simple ↔ Complex") */
  secondaryAxisLabel: string;
  /** Low end of primary axis */
  primaryAxisLow?: string;
  /** High end of primary axis */
  primaryAxisHigh?: string;
  /** Low end of secondary axis */
  secondaryAxisLow?: string;
  /** High end of secondary axis */
  secondaryAxisHigh?: string;
  /** Our brand position (0-100 each) */
  brandPosition?: BrandPosition | null;
  /** Competitor positions */
  competitors?: CompetitorPoint[];
  /** Market clusters to display */
  clusters?: MarketClusterDisplay[];
  /** Whitespace opportunity markers */
  whitespaceMarkers?: WhitespaceMarker[];
  /** Width of the SVG */
  width?: number;
  /** Height of the SVG */
  height?: number;
  /** Whether to show competitor tooltips */
  showTooltips?: boolean;
  /** Company name for brand label */
  companyName?: string;
  /** Show clusters overlay */
  showClusters?: boolean;
  /** Show whitespace overlay */
  showWhitespace?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const COLORS = {
  background: '#0f0f0f',
  gridLines: '#2c2c2c',
  crosshair: '#333333',
  quadrantFill: 'rgba(255, 255, 255, 0.04)',
  brandFill: '#FFD84A',
  brandStroke: '#FFFFFF',
  competitorFill: '#A0A0A0',
  textMuted: '#888888',
  textLight: '#CCCCCC',
  tooltipBg: '#1a1a1a',
  tooltipBorder: '#333333',
};

const BRAND_RADIUS = 7;
const COMPETITOR_RADIUS = 5;
const PADDING = 50;

// ============================================================================
// Helper Functions
// ============================================================================

function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

function getThreatColor(threatLevel?: 'low' | 'medium' | 'high'): string {
  switch (threatLevel) {
    case 'high':
      return '#EF4444'; // red
    case 'medium':
      return '#F59E0B'; // amber
    case 'low':
    default:
      return '#A0A0A0'; // gray
  }
}

// ============================================================================
// Tooltip Component
// ============================================================================

interface TooltipProps {
  competitor: CompetitorPoint;
  x: number;
  y: number;
  onClose: () => void;
}

function Tooltip({ competitor, x, y, onClose }: TooltipProps) {
  // Adjust position to keep tooltip in view
  const adjustedX = x > 200 ? x - 160 : x + 10;
  const adjustedY = y > 150 ? y - 90 : y + 10;

  return (
    <foreignObject x={adjustedX} y={adjustedY} width="160" height="90">
      <div
        className="rounded-md border p-2 text-xs shadow-lg"
        style={{
          backgroundColor: COLORS.tooltipBg,
          borderColor: COLORS.tooltipBorder,
        }}
      >
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-white">{competitor.name}</span>
          {competitor.autoSeeded && (
            <span className="text-[9px] px-1 py-0.5 bg-violet-500/20 text-violet-400 rounded">
              AI
            </span>
          )}
        </div>
        {competitor.category && (
          <div className="mt-0.5 text-gray-400 capitalize">{competitor.category}</div>
        )}
        {competitor.positioning && (
          <div className="mt-1 line-clamp-2 text-gray-500">{competitor.positioning}</div>
        )}
      </div>
    </foreignObject>
  );
}

// ============================================================================
// Main Component
// ============================================================================

// Cluster colors for visualization
const CLUSTER_COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899'];

function getClusterColor(index: number, customColor?: string): string {
  if (customColor) return customColor;
  return CLUSTER_COLORS[index % CLUSTER_COLORS.length];
}

function getThreatOpacity(threatLevel: number): number {
  // Map 0-100 threat level to 0.1-0.3 opacity for clusters
  return 0.1 + (threatLevel / 100) * 0.2;
}

export function PositioningMapCore({
  primaryAxisLabel,
  secondaryAxisLabel,
  primaryAxisLow,
  primaryAxisHigh,
  secondaryAxisLow,
  secondaryAxisHigh,
  brandPosition,
  competitors = [],
  clusters = [],
  whitespaceMarkers = [],
  width = 400,
  height = 400,
  showTooltips = true,
  companyName = 'Our Brand',
  showClusters = true,
  showWhitespace = true,
}: PositioningMapCoreProps) {
  const [hoveredCompetitor, setHoveredCompetitor] = useState<CompetitorPoint | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);

  // Calculate center point
  const centerX = width / 2;
  const centerY = height / 2;

  // Grid line positions (quarters)
  const gridPositions = [25, 50, 75];

  // Handle competitor hover
  const handleCompetitorHover = useCallback(
    (competitor: CompetitorPoint, event: React.MouseEvent<SVGCircleElement>) => {
      if (!showTooltips) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const svgRect = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
      if (svgRect) {
        setTooltipPosition({
          x: rect.left - svgRect.left + COMPETITOR_RADIUS,
          y: rect.top - svgRect.top + COMPETITOR_RADIUS,
        });
      }
      setHoveredCompetitor(competitor);
    },
    [showTooltips]
  );

  const handleCompetitorLeave = useCallback(() => {
    setHoveredCompetitor(null);
    setTooltipPosition(null);
  }, []);

  // Map brand position to SVG coordinates
  const brandSvgPos = useMemo(() => {
    if (!brandPosition) return null;
    return mapPositionToSvgCoordinates(brandPosition.x, brandPosition.y, width, height, PADDING);
  }, [brandPosition, width, height]);

  // Map competitor positions to SVG coordinates
  const competitorSvgPositions = useMemo(() => {
    return competitors.map((c) => ({
      ...c,
      svgPos: mapPositionToSvgCoordinates(c.x, c.y, width, height, PADDING),
    }));
  }, [competitors, width, height]);

  // Map cluster positions to SVG coordinates
  const clusterSvgPositions = useMemo(() => {
    return clusters.map((cluster, idx) => ({
      ...cluster,
      svgPos: mapPositionToSvgCoordinates(cluster.position.x, cluster.position.y, width, height, PADDING),
      color: getClusterColor(idx, cluster.color),
      // Cluster radius based on number of competitors (min 40, max 80)
      radius: Math.max(40, Math.min(80, 40 + cluster.competitors.length * 10)),
    }));
  }, [clusters, width, height]);

  // Map whitespace markers to SVG coordinates
  const whitespaceSvgPositions = useMemo(() => {
    return whitespaceMarkers.map((ws) => ({
      ...ws,
      svgPos: mapPositionToSvgCoordinates(ws.position.x, ws.position.y, width, height, PADDING),
      // Whitespace radius based on size (min 20, max 50)
      radius: Math.max(20, Math.min(50, 20 + (ws.size / 100) * 30)),
    }));
  }, [whitespaceMarkers, width, height]);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="rounded-lg"
      style={{ backgroundColor: COLORS.background }}
    >
      {/* Quadrant fills */}
      <rect
        x={PADDING}
        y={PADDING}
        width={(width - PADDING * 2) / 2}
        height={(height - PADDING * 2) / 2}
        fill={COLORS.quadrantFill}
      />
      <rect
        x={centerX}
        y={PADDING}
        width={(width - PADDING * 2) / 2}
        height={(height - PADDING * 2) / 2}
        fill={COLORS.quadrantFill}
      />
      <rect
        x={PADDING}
        y={centerY}
        width={(width - PADDING * 2) / 2}
        height={(height - PADDING * 2) / 2}
        fill={COLORS.quadrantFill}
      />
      <rect
        x={centerX}
        y={centerY}
        width={(width - PADDING * 2) / 2}
        height={(height - PADDING * 2) / 2}
        fill={COLORS.quadrantFill}
      />

      {/* Market Clusters (rendered behind other elements) */}
      {showClusters && clusterSvgPositions.map((cluster, idx) => (
        <g key={`cluster-${idx}`} className="pointer-events-none">
          {/* Cluster region - gradient circle */}
          <defs>
            <radialGradient id={`cluster-gradient-${idx}`}>
              <stop offset="0%" stopColor={cluster.color} stopOpacity={getThreatOpacity(cluster.threatLevel) * 1.5} />
              <stop offset="100%" stopColor={cluster.color} stopOpacity={0} />
            </radialGradient>
          </defs>
          <circle
            cx={cluster.svgPos.x}
            cy={cluster.svgPos.y}
            r={cluster.radius}
            fill={`url(#cluster-gradient-${idx})`}
          />
          {/* Cluster label */}
          <text
            x={cluster.svgPos.x}
            y={cluster.svgPos.y - cluster.radius - 5}
            textAnchor="middle"
            fill={cluster.color}
            fontSize={9}
            opacity={0.7}
          >
            {cluster.name}
          </text>
        </g>
      ))}

      {/* Whitespace Opportunity Markers */}
      {showWhitespace && whitespaceSvgPositions.map((ws, idx) => (
        <g key={`whitespace-${idx}`} className="pointer-events-none">
          {/* Dashed circle target area */}
          <circle
            cx={ws.svgPos.x}
            cy={ws.svgPos.y}
            r={ws.radius}
            fill="none"
            stroke="#10B981"
            strokeWidth={2}
            strokeDasharray="6,4"
            opacity={0.5}
          />
          {/* Inner fill */}
          <circle
            cx={ws.svgPos.x}
            cy={ws.svgPos.y}
            r={ws.radius - 2}
            fill="#10B981"
            opacity={0.08}
          />
          {/* Crosshair in center */}
          <line
            x1={ws.svgPos.x - 6}
            y1={ws.svgPos.y}
            x2={ws.svgPos.x + 6}
            y2={ws.svgPos.y}
            stroke="#10B981"
            strokeWidth={1}
            opacity={0.5}
          />
          <line
            x1={ws.svgPos.x}
            y1={ws.svgPos.y - 6}
            x2={ws.svgPos.x}
            y2={ws.svgPos.y + 6}
            stroke="#10B981"
            strokeWidth={1}
            opacity={0.5}
          />
          {/* Label */}
          <text
            x={ws.svgPos.x}
            y={ws.svgPos.y + ws.radius + 12}
            textAnchor="middle"
            fill="#10B981"
            fontSize={8}
            opacity={0.7}
          >
            {ws.name}
          </text>
        </g>
      ))}

      {/* Grid lines */}
      {gridPositions.map((pos) => {
        const svgPos = mapPositionToSvgCoordinates(pos, pos, width, height, PADDING);
        return (
          <g key={pos}>
            {/* Vertical line */}
            <line
              x1={svgPos.x}
              y1={PADDING}
              x2={svgPos.x}
              y2={height - PADDING}
              stroke={pos === 50 ? COLORS.crosshair : COLORS.gridLines}
              strokeWidth={pos === 50 ? 1.5 : 1}
              strokeDasharray={pos === 50 ? undefined : '4,4'}
            />
            {/* Horizontal line */}
            <line
              x1={PADDING}
              y1={svgPos.y}
              x2={width - PADDING}
              y2={svgPos.y}
              stroke={pos === 50 ? COLORS.crosshair : COLORS.gridLines}
              strokeWidth={pos === 50 ? 1.5 : 1}
              strokeDasharray={pos === 50 ? undefined : '4,4'}
            />
          </g>
        );
      })}

      {/* Border */}
      <rect
        x={PADDING}
        y={PADDING}
        width={width - PADDING * 2}
        height={height - PADDING * 2}
        fill="none"
        stroke={COLORS.gridLines}
        strokeWidth={1}
      />

      {/* Axis labels */}
      {/* Primary axis (horizontal) - bottom */}
      <text
        x={centerX}
        y={height - 12}
        textAnchor="middle"
        fill={COLORS.textMuted}
        fontSize={11}
        fontWeight={500}
      >
        {primaryAxisLabel}
      </text>

      {/* Primary axis low/high labels */}
      {primaryAxisLow && (
        <text
          x={PADDING + 5}
          y={height - 12}
          textAnchor="start"
          fill={COLORS.textMuted}
          fontSize={9}
        >
          {primaryAxisLow}
        </text>
      )}
      {primaryAxisHigh && (
        <text
          x={width - PADDING - 5}
          y={height - 12}
          textAnchor="end"
          fill={COLORS.textMuted}
          fontSize={9}
        >
          {primaryAxisHigh}
        </text>
      )}

      {/* Secondary axis (vertical) - left, rotated */}
      <text
        x={12}
        y={centerY}
        textAnchor="middle"
        fill={COLORS.textMuted}
        fontSize={11}
        fontWeight={500}
        transform={`rotate(-90, 12, ${centerY})`}
      >
        {secondaryAxisLabel}
      </text>

      {/* Secondary axis low/high labels */}
      {secondaryAxisLow && (
        <text
          x={12}
          y={height - PADDING - 5}
          textAnchor="middle"
          fill={COLORS.textMuted}
          fontSize={9}
          transform={`rotate(-90, 12, ${height - PADDING - 5})`}
        >
          {secondaryAxisLow}
        </text>
      )}
      {secondaryAxisHigh && (
        <text
          x={12}
          y={PADDING + 5}
          textAnchor="middle"
          fill={COLORS.textMuted}
          fontSize={9}
          transform={`rotate(-90, 12, ${PADDING + 5})`}
        >
          {secondaryAxisHigh}
        </text>
      )}

      {/* Competitor points */}
      {competitorSvgPositions.map((competitor) => (
        <g key={competitor.id}>
          <circle
            cx={competitor.svgPos.x}
            cy={competitor.svgPos.y}
            r={COMPETITOR_RADIUS}
            fill={getThreatColor(competitor.threatLevel)}
            opacity={competitor.confidence ?? 0.7}
            className="cursor-pointer transition-opacity hover:opacity-100"
            onMouseEnter={(e) => handleCompetitorHover(competitor, e)}
            onMouseLeave={handleCompetitorLeave}
          />
          {/* Small label below competitor point */}
          <text
            x={competitor.svgPos.x}
            y={competitor.svgPos.y + COMPETITOR_RADIUS + 10}
            textAnchor="middle"
            fill={COLORS.textMuted}
            fontSize={8}
            className="pointer-events-none"
          >
            {competitor.name.length > 12
              ? competitor.name.slice(0, 10) + '...'
              : competitor.name}
          </text>
        </g>
      ))}

      {/* Brand point */}
      {brandSvgPos && (
        <g>
          {/* Outer glow */}
          <circle
            cx={brandSvgPos.x}
            cy={brandSvgPos.y}
            r={BRAND_RADIUS + 4}
            fill="none"
            stroke={COLORS.brandFill}
            strokeWidth={1}
            opacity={0.3}
          />
          {/* Main point */}
          <circle
            cx={brandSvgPos.x}
            cy={brandSvgPos.y}
            r={BRAND_RADIUS}
            fill={COLORS.brandFill}
            stroke={COLORS.brandStroke}
            strokeWidth={2}
          />
          {/* Label */}
          <text
            x={brandSvgPos.x}
            y={brandSvgPos.y - BRAND_RADIUS - 8}
            textAnchor="middle"
            fill={COLORS.textLight}
            fontSize={10}
            fontWeight={600}
          >
            {companyName}
          </text>
        </g>
      )}

      {/* Tooltip */}
      {showTooltips && hoveredCompetitor && tooltipPosition && (
        <Tooltip
          competitor={hoveredCompetitor}
          x={tooltipPosition.x}
          y={tooltipPosition.y}
          onClose={handleCompetitorLeave}
        />
      )}
    </svg>
  );
}

// ============================================================================
// Empty State Component
// ============================================================================

export function PositioningMapEmptyState() {
  return (
    <div className="flex h-[300px] flex-col items-center justify-center rounded-lg border border-dashed border-gray-700 bg-gray-900/50">
      <svg
        className="mb-3 h-12 w-12 text-gray-600"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      </svg>
      <p className="mb-1 text-sm font-medium text-gray-400">Positioning Map Not Configured</p>
      <p className="max-w-xs text-center text-xs text-gray-500">
        Set up positioning axes and coordinates to visualize your market position.
      </p>
    </div>
  );
}
