// components/competitive/positioningMapUtils.ts
// Shared utilities for positioning map components

import type { CompetitorProfile, PositioningAxes } from '@/lib/contextGraph/domains/competitive';

// ============================================================================
// Types
// ============================================================================

/**
 * Competitor point for positioning map
 */
export interface CompetitorPoint {
  id: string;
  name: string;
  x: number; // 0-100
  y: number; // 0-100
  category?: 'direct' | 'indirect' | 'aspirational' | 'emerging' | 'own' | null;
  threatLevel?: 'low' | 'medium' | 'high';
  confidence?: number; // 0-1
  positioning?: string | null;
  autoSeeded?: boolean; // Whether this was AI-generated
}

/**
 * Brand position point
 */
export interface BrandPosition {
  x: number; // 0-100
  y: number; // 0-100
}

/**
 * Positioning map data extracted from Context Graph
 */
export interface PositioningMapData {
  primaryAxisLabel: string;
  secondaryAxisLabel: string;
  primaryAxisLow?: string;
  primaryAxisHigh?: string;
  secondaryAxisLow?: string;
  secondaryAxisHigh?: string;
  brandPosition: BrandPosition | null;
  competitors: CompetitorPoint[];
  positioningSummary?: string | null;
  /** True if all competitors are AI-seeded (none verified) */
  isAiSeededOnly: boolean;
  /** Number of verified competitors */
  verifiedCount: number;
  /** Number of AI-seeded competitors */
  autoSeededCount: number;
}

// ============================================================================
// Coordinate Mapping
// ============================================================================

/**
 * Map a 0-100 position to SVG coordinates
 * @param posX - Position on primary axis (0-100)
 * @param posY - Position on secondary axis (0-100)
 * @param width - SVG width
 * @param height - SVG height
 * @param padding - Padding from edges
 */
export function mapPositionToSvgCoordinates(
  posX: number,
  posY: number,
  width: number,
  height: number,
  padding: number = 40
): { x: number; y: number } {
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  return {
    x: padding + (posX / 100) * innerWidth,
    // Invert Y because SVG origin is top-left
    y: padding + (1 - posY / 100) * innerHeight,
  };
}

/**
 * Map SVG coordinates back to 0-100 position
 */
export function mapSvgToPosition(
  svgX: number,
  svgY: number,
  width: number,
  height: number,
  padding: number = 40
): { x: number; y: number } {
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  return {
    x: Math.max(0, Math.min(100, ((svgX - padding) / innerWidth) * 100)),
    y: Math.max(0, Math.min(100, (1 - (svgY - padding) / innerHeight) * 100)),
  };
}

// ============================================================================
// Data Extraction
// ============================================================================

/**
 * Options for extracting positioning map data
 */
export interface ExtractPositioningMapOptions {
  /** If true, include AI-seeded competitors (default: false - only verified) */
  includeAutoSeeded?: boolean;
}

/**
 * Extract positioning map data from Context Graph competitive domain
 *
 * By default, only verified (non-autoSeeded) competitors are included in the map.
 * This ensures the positioning map shows human-verified data only.
 */
export function extractPositioningMapData(
  positioningAxes: PositioningAxes | null | undefined,
  ownPositionPrimary: number | null | undefined,
  ownPositionSecondary: number | null | undefined,
  primaryCompetitors: CompetitorProfile[] | null | undefined,
  positioningSummary: string | null | undefined,
  options: ExtractPositioningMapOptions = {}
): PositioningMapData {
  const { includeAutoSeeded = false } = options;

  // Extract axis labels
  const primaryAxis = positioningAxes?.primaryAxis;
  const secondaryAxis = positioningAxes?.secondaryAxis;

  const primaryAxisLabel = primaryAxis?.label || 'Primary Axis';
  const secondaryAxisLabel = secondaryAxis?.label || 'Secondary Axis';

  // Extract brand position
  const brandPosition: BrandPosition | null =
    ownPositionPrimary != null && ownPositionSecondary != null
      ? { x: ownPositionPrimary, y: ownPositionSecondary }
      : null;

  // Count autoSeeded vs verified (from all competitors with positions)
  const allWithPositions = (primaryCompetitors || []).filter(
    (c) => c.positionPrimary != null && c.positionSecondary != null
  );
  const autoSeededCount = allWithPositions.filter((c) => c.autoSeeded).length;
  const verifiedCount = allWithPositions.filter((c) => !c.autoSeeded).length;
  const isAiSeededOnly = allWithPositions.length > 0 && verifiedCount === 0;

  // Extract competitor positions - filter based on options
  const competitors: CompetitorPoint[] = (primaryCompetitors || [])
    .filter((c): c is CompetitorProfile & { positionPrimary: number; positionSecondary: number } =>
      c.positionPrimary != null && c.positionSecondary != null &&
      // Only include if verified OR if includeAutoSeeded is true
      (includeAutoSeeded || !c.autoSeeded)
    )
    .map((c, idx) => ({
      id: c.domain || c.name || `competitor-${idx}`,
      name: c.name,
      x: c.positionPrimary,
      y: c.positionSecondary,
      category: c.category,
      positioning: c.positioning,
      // Derive threat level from category
      threatLevel: deriveThreatLevel(c.category),
      confidence: 0.8, // Default confidence
      autoSeeded: c.autoSeeded ?? false,
    }));

  return {
    primaryAxisLabel,
    secondaryAxisLabel,
    primaryAxisLow: primaryAxis?.lowLabel,
    primaryAxisHigh: primaryAxis?.highLabel,
    secondaryAxisLow: secondaryAxis?.lowLabel,
    secondaryAxisHigh: secondaryAxis?.highLabel,
    brandPosition,
    competitors,
    positioningSummary,
    isAiSeededOnly,
    verifiedCount,
    autoSeededCount,
  };
}

/**
 * Derive threat level from competitor category
 */
function deriveThreatLevel(
  category: 'direct' | 'indirect' | 'aspirational' | 'emerging' | 'own' | null | undefined
): 'low' | 'medium' | 'high' {
  switch (category) {
    case 'direct':
      return 'high';
    case 'indirect':
    case 'emerging':
      return 'medium';
    case 'aspirational':
    default:
      return 'low';
  }
}

// ============================================================================
// Quadrant Analysis
// ============================================================================

/**
 * Determine which quadrant a point is in
 */
export function getQuadrant(x: number, y: number): 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' {
  const isRight = x >= 50;
  const isTop = y >= 50;

  if (isTop && isRight) return 'top-right';
  if (isTop && !isRight) return 'top-left';
  if (!isTop && isRight) return 'bottom-right';
  return 'bottom-left';
}

/**
 * Count competitors per quadrant
 */
export function getQuadrantCounts(competitors: CompetitorPoint[]): Record<string, number> {
  const counts: Record<string, number> = {
    'top-left': 0,
    'top-right': 0,
    'bottom-left': 0,
    'bottom-right': 0,
  };

  for (const c of competitors) {
    const quadrant = getQuadrant(c.x, c.y);
    counts[quadrant]++;
  }

  return counts;
}

/**
 * Find whitespace zones (quadrants with few competitors)
 */
export function findWhitespaceZones(
  competitors: CompetitorPoint[],
  brandPosition: BrandPosition | null
): string[] {
  const counts = getQuadrantCounts(competitors);
  const whitespace: string[] = [];

  for (const [quadrant, count] of Object.entries(counts)) {
    if (count <= 1) {
      whitespace.push(quadrant);
    }
  }

  return whitespace;
}

/**
 * Find crowded zones (quadrants with many competitors)
 */
export function findCrowdedZones(competitors: CompetitorPoint[]): string[] {
  const counts = getQuadrantCounts(competitors);
  const crowded: string[] = [];

  for (const [quadrant, count] of Object.entries(counts)) {
    if (count >= 3) {
      crowded.push(quadrant);
    }
  }

  return crowded;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Check if positioning data is complete enough to render
 */
export function hasPositioningData(data: PositioningMapData): boolean {
  return data.brandPosition !== null || data.competitors.length > 0;
}

/**
 * Check if positioning map should show a placeholder message
 * This returns true if there are AI-seeded competitors but no verified ones
 */
export function shouldShowPositioningPlaceholder(data: PositioningMapData): {
  show: boolean;
  message: string;
} {
  // If we have verified competitors, show the map
  if (data.verifiedCount > 0) {
    return { show: false, message: '' };
  }

  // If all competitors are AI-seeded, show placeholder
  if (data.isAiSeededOnly) {
    return {
      show: true,
      message: `Positioning Map requires at least one reviewed competitor. ${data.autoSeededCount} AI-suggested competitor${data.autoSeededCount !== 1 ? 's' : ''} pending review.`,
    };
  }

  // If no competitors at all
  if (data.autoSeededCount === 0) {
    return {
      show: true,
      message: 'Run Competitor Lab to discover and analyze competitors.',
    };
  }

  return { show: false, message: '' };
}

/**
 * Check if axes are properly configured
 */
export function hasAxesConfigured(data: PositioningMapData): boolean {
  return (
    data.primaryAxisLabel !== 'Primary Axis' &&
    data.secondaryAxisLabel !== 'Secondary Axis'
  );
}
