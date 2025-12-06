'use client';

// components/competitive/PositioningMapBrandHalo.tsx
// Style 4: Brand Halo Positioning Map
//
// Premium visual version for QBR / export-oriented views
// Features: gradient background, hexagon brand mark, glow effects, annotations

import { useState, useMemo } from 'react';
import {
  mapPositionToSvgCoordinates,
  getQuadrant,
  findWhitespaceZones,
  findCrowdedZones,
  type CompetitorPoint,
  type BrandPosition,
} from './positioningMapUtils';

// ============================================================================
// Types
// ============================================================================

export interface PositioningMapBrandHaloProps {
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
  /** Width of the SVG */
  width?: number;
  /** Height of the SVG */
  height?: number;
  /** Whether to show annotations */
  showAnnotations?: boolean;
  /** Positioning summary text */
  positioningSummary?: string | null;
  /** Company name for brand label */
  companyName?: string;
}

// ============================================================================
// Constants
// ============================================================================

const COLORS = {
  brandFill: '#FFD84A',
  brandGlow: 'rgba(255, 216, 74, 0.22)',
  brandGlowStrong: 'rgba(255, 216, 74, 0.4)',
  textWhite: '#FFFFFF',
  textMuted: '#888888',
  textLight: '#CCCCCC',
  gridLines: '#2a2a2a',
  crosshair: '#3a3a3a',
};

const COMPETITOR_COLORS = {
  direct: { fill: '#EF4444', gradient: ['#EF4444', '#B91C1C'] },
  indirect: { fill: '#F59E0B', gradient: ['#F59E0B', '#D97706'] },
  aspirational: { fill: '#3B82F6', gradient: ['#3B82F6', '#1D4ED8'] },
  emerging: { fill: '#8B5CF6', gradient: ['#8B5CF6', '#6D28D9'] },
  default: { fill: '#6B7280', gradient: ['#6B7280', '#4B5563'] },
};

const BRAND_SIZE = 12;
const COMPETITOR_SIZE = 8;
const PADDING = 60;

// ============================================================================
// Helper Functions
// ============================================================================

function getCompetitorColor(category?: string | null) {
  if (!category) return COMPETITOR_COLORS.default;
  return COMPETITOR_COLORS[category as keyof typeof COMPETITOR_COLORS] || COMPETITOR_COLORS.default;
}

/**
 * Generate hexagon path for brand mark
 */
function getHexagonPath(cx: number, cy: number, size: number): string {
  const points: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    points.push([cx + size * Math.cos(angle), cy + size * Math.sin(angle)]);
  }
  return `M ${points.map((p) => p.join(',')).join(' L ')} Z`;
}

/**
 * Generate diamond path for competitor mark
 */
function getDiamondPath(cx: number, cy: number, size: number): string {
  return `M ${cx} ${cy - size} L ${cx + size} ${cy} L ${cx} ${cy + size} L ${cx - size} ${cy} Z`;
}

// ============================================================================
// Annotation Component
// ============================================================================

interface AnnotationProps {
  x: number;
  y: number;
  label: string;
  type: 'whitespace' | 'crowded';
}

function Annotation({ x, y, label, type }: AnnotationProps) {
  const bgColor = type === 'whitespace' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)';
  const borderColor = type === 'whitespace' ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)';
  const textColor = type === 'whitespace' ? '#22C55E' : '#EF4444';

  return (
    <g>
      <rect
        x={x - 45}
        y={y - 10}
        width={90}
        height={20}
        rx={4}
        fill={bgColor}
        stroke={borderColor}
        strokeWidth={1}
      />
      <text
        x={x}
        y={y + 4}
        textAnchor="middle"
        fill={textColor}
        fontSize={8}
        fontWeight={600}
        letterSpacing="0.05em"
      >
        {label.toUpperCase()}
      </text>
    </g>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function PositioningMapBrandHalo({
  primaryAxisLabel,
  secondaryAxisLabel,
  primaryAxisLow,
  primaryAxisHigh,
  secondaryAxisLow,
  secondaryAxisHigh,
  brandPosition,
  competitors = [],
  width = 500,
  height = 500,
  showAnnotations = false,
  positioningSummary,
  companyName = 'Our Brand',
}: PositioningMapBrandHaloProps) {
  const [hoveredCompetitor, setHoveredCompetitor] = useState<CompetitorPoint | null>(null);

  // Calculate center point
  const centerX = width / 2;
  const centerY = height / 2;

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

  // Calculate annotations if enabled
  const annotations = useMemo(() => {
    if (!showAnnotations) return [];

    const result: { quadrant: string; type: 'whitespace' | 'crowded'; label: string }[] = [];
    const whitespaceZones = findWhitespaceZones(competitors, brandPosition ?? null);
    const crowdedZones = findCrowdedZones(competitors);

    // Add whitespace annotations
    for (const zone of whitespaceZones) {
      // Check if brand is in or near this zone
      const brandQuadrant = brandPosition ? getQuadrant(brandPosition.x, brandPosition.y) : null;
      if (brandQuadrant === zone) {
        result.push({ quadrant: zone, type: 'whitespace', label: 'Opportunity Zone' });
      }
    }

    // Add crowded annotations
    for (const zone of crowdedZones) {
      result.push({ quadrant: zone, type: 'crowded', label: 'Crowded Market' });
    }

    return result;
  }, [showAnnotations, competitors, brandPosition]);

  // Get annotation position based on quadrant
  const getAnnotationPosition = (quadrant: string) => {
    const innerWidth = width - PADDING * 2;
    const innerHeight = height - PADDING * 2;
    const qw = innerWidth / 2;
    const qh = innerHeight / 2;

    switch (quadrant) {
      case 'top-left':
        return { x: PADDING + qw / 2, y: PADDING + qh / 2 };
      case 'top-right':
        return { x: PADDING + qw + qw / 2, y: PADDING + qh / 2 };
      case 'bottom-left':
        return { x: PADDING + qw / 2, y: PADDING + qh + qh / 2 };
      case 'bottom-right':
        return { x: PADDING + qw + qw / 2, y: PADDING + qh + qh / 2 };
      default:
        return { x: centerX, y: centerY };
    }
  };

  // Unique IDs for gradients and filters
  const gradientId = useMemo(() => `brand-halo-gradient-${Math.random().toString(36).slice(2)}`, []);
  const glowId = useMemo(() => `brand-glow-${Math.random().toString(36).slice(2)}`, []);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="rounded-xl"
    >
      {/* Defs for gradients and filters */}
      <defs>
        {/* Background gradient */}
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#0E0E0E" />
          <stop offset="100%" stopColor="#1A1A1A" />
        </linearGradient>

        {/* Brand glow filter */}
        <filter id={glowId} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Competitor gradients */}
        {Object.entries(COMPETITOR_COLORS).map(([key, { gradient }]) => (
          <linearGradient
            key={key}
            id={`competitor-gradient-${key}`}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor={gradient[0]} />
            <stop offset="100%" stopColor={gradient[1]} />
          </linearGradient>
        ))}
      </defs>

      {/* Background */}
      <rect width={width} height={height} fill={`url(#${gradientId})`} rx={12} />

      {/* Subtle quadrant fills with hover effect */}
      {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((quadrant) => {
        const qw = (width - PADDING * 2) / 2;
        const qh = (height - PADDING * 2) / 2;
        const qx =
          quadrant.includes('left') ? PADDING : PADDING + qw;
        const qy =
          quadrant.includes('top') ? PADDING : PADDING + qh;

        return (
          <rect
            key={quadrant}
            x={qx}
            y={qy}
            width={qw}
            height={qh}
            fill="rgba(255, 255, 255, 0.02)"
            className="transition-all duration-200 hover:fill-[rgba(255,255,255,0.05)]"
          />
        );
      })}

      {/* Grid lines */}
      {[25, 50, 75].map((pos) => {
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
              strokeWidth={pos === 50 ? 2 : 1}
              opacity={pos === 50 ? 1 : 0.5}
            />
            {/* Horizontal line */}
            <line
              x1={PADDING}
              y1={svgPos.y}
              x2={width - PADDING}
              y2={svgPos.y}
              stroke={pos === 50 ? COLORS.crosshair : COLORS.gridLines}
              strokeWidth={pos === 50 ? 2 : 1}
              opacity={pos === 50 ? 1 : 0.5}
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
        strokeWidth={2}
        rx={4}
      />

      {/* Axis labels - Hero style */}
      {/* Primary axis (horizontal) - bottom */}
      <text
        x={centerX}
        y={height - 18}
        textAnchor="middle"
        fill={COLORS.textLight}
        fontSize={13}
        fontWeight={600}
        letterSpacing="0.15em"
      >
        {primaryAxisLabel.toUpperCase()}
      </text>

      {/* Primary axis low/high labels */}
      {primaryAxisLow && (
        <text
          x={PADDING}
          y={height - 18}
          textAnchor="start"
          fill={COLORS.textMuted}
          fontSize={10}
          letterSpacing="0.1em"
        >
          {primaryAxisLow.toUpperCase()}
        </text>
      )}
      {primaryAxisHigh && (
        <text
          x={width - PADDING}
          y={height - 18}
          textAnchor="end"
          fill={COLORS.textMuted}
          fontSize={10}
          letterSpacing="0.1em"
        >
          {primaryAxisHigh.toUpperCase()}
        </text>
      )}

      {/* Secondary axis (vertical) - left, rotated */}
      <text
        x={18}
        y={centerY}
        textAnchor="middle"
        fill={COLORS.textLight}
        fontSize={13}
        fontWeight={600}
        letterSpacing="0.15em"
        transform={`rotate(-90, 18, ${centerY})`}
      >
        {secondaryAxisLabel.toUpperCase()}
      </text>

      {/* Secondary axis low/high labels */}
      {secondaryAxisLow && (
        <text
          x={18}
          y={height - PADDING}
          textAnchor="middle"
          fill={COLORS.textMuted}
          fontSize={10}
          letterSpacing="0.1em"
          transform={`rotate(-90, 18, ${height - PADDING})`}
        >
          {secondaryAxisLow.toUpperCase()}
        </text>
      )}
      {secondaryAxisHigh && (
        <text
          x={18}
          y={PADDING}
          textAnchor="middle"
          fill={COLORS.textMuted}
          fontSize={10}
          letterSpacing="0.1em"
          transform={`rotate(-90, 18, ${PADDING})`}
        >
          {secondaryAxisHigh.toUpperCase()}
        </text>
      )}

      {/* Annotations */}
      {showAnnotations &&
        annotations.map((ann, idx) => {
          const pos = getAnnotationPosition(ann.quadrant);
          return (
            <Annotation
              key={`${ann.quadrant}-${idx}`}
              x={pos.x}
              y={pos.y}
              label={ann.label}
              type={ann.type}
            />
          );
        })}

      {/* Competitor points - Diamond glyphs */}
      {competitorSvgPositions.map((competitor) => {
        const colors = getCompetitorColor(competitor.category);
        const isHovered = hoveredCompetitor?.id === competitor.id;

        return (
          <g
            key={competitor.id}
            className="cursor-pointer"
            onMouseEnter={() => setHoveredCompetitor(competitor)}
            onMouseLeave={() => setHoveredCompetitor(null)}
          >
            {/* Shadow */}
            <path
              d={getDiamondPath(
                competitor.svgPos.x + 2,
                competitor.svgPos.y + 2,
                COMPETITOR_SIZE
              )}
              fill="rgba(0, 0, 0, 0.3)"
            />
            {/* Main diamond */}
            <path
              d={getDiamondPath(competitor.svgPos.x, competitor.svgPos.y, COMPETITOR_SIZE)}
              fill={`url(#competitor-gradient-${competitor.category || 'default'})`}
              opacity={isHovered ? 1 : (competitor.confidence ?? 0.8)}
              className="transition-opacity duration-150"
            />
            {/* Label on hover */}
            {isHovered && (
              <text
                x={competitor.svgPos.x}
                y={competitor.svgPos.y - COMPETITOR_SIZE - 8}
                textAnchor="middle"
                fill={COLORS.textWhite}
                fontSize={10}
                fontWeight={600}
              >
                {competitor.name}
              </text>
            )}
          </g>
        );
      })}

      {/* Brand mark - Hexagon with glow */}
      {brandSvgPos && (
        <g>
          {/* Outer glow pulse animation */}
          <circle
            cx={brandSvgPos.x}
            cy={brandSvgPos.y}
            r={BRAND_SIZE + 20}
            fill={COLORS.brandGlow}
            className="animate-pulse"
            style={{ animationDuration: '3s' }}
          />
          {/* Inner glow */}
          <circle
            cx={brandSvgPos.x}
            cy={brandSvgPos.y}
            r={BRAND_SIZE + 8}
            fill={COLORS.brandGlowStrong}
          />
          {/* Hexagon outline */}
          <path
            d={getHexagonPath(brandSvgPos.x, brandSvgPos.y, BRAND_SIZE)}
            fill="none"
            stroke={COLORS.brandFill}
            strokeWidth={2}
          />
          {/* Inner dot */}
          <circle
            cx={brandSvgPos.x}
            cy={brandSvgPos.y}
            r={4}
            fill={COLORS.brandFill}
            filter={`url(#${glowId})`}
          />
          {/* Brand label */}
          <text
            x={brandSvgPos.x}
            y={brandSvgPos.y - BRAND_SIZE - 12}
            textAnchor="middle"
            fill={COLORS.textWhite}
            fontSize={12}
            fontWeight={700}
            letterSpacing="0.1em"
          >
            {companyName.toUpperCase()}
          </text>
        </g>
      )}

      {/* Legend - bottom right corner */}
      <g transform={`translate(${width - PADDING - 80}, ${PADDING + 10})`}>
        <rect
          x={0}
          y={0}
          width={70}
          height={85}
          rx={4}
          fill="rgba(0, 0, 0, 0.4)"
          stroke={COLORS.gridLines}
          strokeWidth={1}
        />
        <text x={8} y={14} fill={COLORS.textMuted} fontSize={8} fontWeight={600}>
          LEGEND
        </text>

        {/* Brand */}
        <g transform="translate(8, 24)">
          <path d={getHexagonPath(6, 6, 5)} fill="none" stroke={COLORS.brandFill} strokeWidth={1.5} />
          <text x={18} y={9} fill={COLORS.textMuted} fontSize={8}>
            You
          </text>
        </g>

        {/* Direct */}
        <g transform="translate(8, 40)">
          <path d={getDiamondPath(6, 6, 4)} fill={COMPETITOR_COLORS.direct.fill} />
          <text x={18} y={9} fill={COLORS.textMuted} fontSize={8}>
            Direct
          </text>
        </g>

        {/* Indirect */}
        <g transform="translate(8, 56)">
          <path d={getDiamondPath(6, 6, 4)} fill={COMPETITOR_COLORS.indirect.fill} />
          <text x={18} y={9} fill={COLORS.textMuted} fontSize={8}>
            Indirect
          </text>
        </g>

        {/* Emerging */}
        <g transform="translate(8, 72)">
          <path d={getDiamondPath(6, 6, 4)} fill={COMPETITOR_COLORS.emerging.fill} />
          <text x={18} y={9} fill={COLORS.textMuted} fontSize={8}>
            Emerging
          </text>
        </g>
      </g>
    </svg>
  );
}

// ============================================================================
// QBR Card Wrapper
// ============================================================================

interface PositioningMapQBRCardProps extends PositioningMapBrandHaloProps {
  /** Additional insights to show beside the map */
  insights?: string[];
}

export function PositioningMapQBRCard({
  insights = [],
  positioningSummary,
  ...mapProps
}: PositioningMapQBRCardProps) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gradient-to-b from-gray-900 to-gray-950 p-6">
      <h3 className="mb-4 text-lg font-semibold text-white">Competitive Positioning</h3>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Map */}
        <div className="flex justify-center">
          <PositioningMapBrandHalo
            {...mapProps}
            positioningSummary={positioningSummary}
            width={420}
            height={420}
          />
        </div>

        {/* Summary & Insights */}
        <div className="flex flex-col justify-center space-y-4">
          {positioningSummary && (
            <div>
              <h4 className="mb-2 text-sm font-medium text-gray-400">Positioning Summary</h4>
              <p className="text-sm leading-relaxed text-gray-300">{positioningSummary}</p>
            </div>
          )}

          {insights.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-medium text-gray-400">Key Insights</h4>
              <ul className="space-y-2">
                {insights.map((insight, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-gray-300">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-yellow-500" />
                    {insight}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!positioningSummary && insights.length === 0 && (
            <p className="text-sm text-gray-500">
              Run Brand Lab or GAP to generate positioning insights.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
