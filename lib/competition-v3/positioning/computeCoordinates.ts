// lib/competition-v3/positioning/computeCoordinates.ts
// Positioning Map Coordinate Computation for Competition Lab V3
//
// Converts multi-dimension scores to 2D map positions:
// - X-axis: Value Model Alignment (0-100)
// - Y-axis: ICP Alignment (0-100)
//
// Quadrants:
// - Top-Right: Direct Threats (high ICP + high value alignment)
// - Top-Left: Different Value Model (high ICP + low value alignment)
// - Bottom-Right: Different ICP (low ICP + high value alignment)
// - Bottom-Left: Distant Competitors (low on both)

import type {
  CompetitorProfileV3,
  PositioningCoordinates,
  MapQuadrant,
  CompetitorScores,
  ClassificationResult,
} from '../types';

// ============================================================================
// Coordinate Computation
// ============================================================================

/**
 * Compute positioning coordinates for all competitors
 */
export function computePositioningCoordinates(
  competitors: CompetitorProfileV3[]
): CompetitorProfileV3[] {
  console.log(`[competition-v3/positioning] Computing coordinates for ${competitors.length} competitors`);

  return competitors.map(competitor => {
    const coordinates = computeCoordinates(competitor.scores, competitor.classification);
    return { ...competitor, positioning: coordinates };
  });
}

/**
 * Compute coordinates for a single competitor
 */
function computeCoordinates(
  scores: CompetitorScores,
  classification: ClassificationResult
): PositioningCoordinates {
  // X-axis: Value Model Alignment
  // Combines: businessModelFit, valueModelFit, serviceOverlap
  const xRaw = computeValueModelAlignment(scores);

  // Y-axis: ICP Alignment
  // Combines: icpFit, icpStageMatch, geographyFit
  const yRaw = computeICPAlignment(scores);

  // Apply jitter for visual separation (small random offset)
  const jitter = getJitter(classification.type);
  const x = clamp(xRaw + jitter.x, 0, 100);
  const y = clamp(yRaw + jitter.y, 0, 100);

  // Determine quadrant
  const quadrant = getQuadrant(x, y);

  // Compute bubble size based on threat score
  const bubbleSize = computeBubbleSize(scores.threatScore, classification);

  return {
    x,
    y,
    quadrant,
    bubbleSize,
    clusterGroup: classification.type,
  };
}

/**
 * Compute X-axis value (Value Model Alignment)
 */
function computeValueModelAlignment(scores: CompetitorScores): number {
  // Weighted combination of value-related scores
  const weights = {
    businessModelFit: 0.30,
    valueModelFit: 0.35,
    serviceOverlap: 0.25,
    aiOrientation: 0.10,
  };

  const weighted =
    scores.businessModelFit * weights.businessModelFit +
    scores.valueModelFit * weights.valueModelFit +
    scores.serviceOverlap * weights.serviceOverlap +
    scores.aiOrientation * weights.aiOrientation;

  return Math.round(weighted);
}

/**
 * Compute Y-axis value (ICP Alignment)
 */
function computeICPAlignment(scores: CompetitorScores): number {
  // Weighted combination of ICP-related scores
  const weights = {
    icpFit: 0.45,
    icpStageMatch: 0.30,
    geographyFit: 0.25,
  };

  const weighted =
    scores.icpFit * weights.icpFit +
    scores.icpStageMatch * weights.icpStageMatch +
    scores.geographyFit * weights.geographyFit;

  return Math.round(weighted);
}

/**
 * Determine quadrant based on coordinates
 */
function getQuadrant(x: number, y: number): MapQuadrant {
  const midpoint = 50;

  if (x >= midpoint && y >= midpoint) {
    return 'direct-threat';
  } else if (x < midpoint && y >= midpoint) {
    return 'different-value';
  } else if (x >= midpoint && y < midpoint) {
    return 'different-icp';
  } else {
    return 'distant';
  }
}

/**
 * Compute bubble size for visualization
 */
function computeBubbleSize(
  threatScore: number,
  classification: ClassificationResult
): 'small' | 'medium' | 'large' {
  // Type-based adjustments
  let adjustedScore = threatScore;

  switch (classification.type) {
    case 'direct':
      adjustedScore *= 1.2; // Boost direct competitors
      break;
    case 'partial':
      adjustedScore *= 1.0;
      break;
    case 'fractional':
      adjustedScore *= 0.9;
      break;
    case 'platform':
      adjustedScore *= 0.95;
      break;
    case 'internal':
      adjustedScore *= 0.85;
      break;
    default:
      adjustedScore *= 0.8;
  }

  // Also factor in confidence
  adjustedScore *= (0.7 + classification.confidence * 0.3);

  if (adjustedScore >= 70) return 'large';
  if (adjustedScore >= 45) return 'medium';
  return 'small';
}

/**
 * Get jitter values for visual separation
 */
function getJitter(type: string): { x: number; y: number } {
  // Deterministic jitter based on type (so same type clusters together)
  const typeJitter: Record<string, { x: number; y: number }> = {
    direct: { x: 2, y: 2 },
    partial: { x: -3, y: 3 },
    fractional: { x: 4, y: -2 },
    platform: { x: -4, y: -3 },
    internal: { x: 3, y: -4 },
    irrelevant: { x: 0, y: 0 },
  };

  const base = typeJitter[type] || { x: 0, y: 0 };

  // Add small random variation
  const random = () => (Math.random() - 0.5) * 4;

  return {
    x: base.x + random(),
    y: base.y + random(),
  };
}

// ============================================================================
// Cluster Analysis
// ============================================================================

/**
 * Identify clusters of competitors for visualization
 */
export function identifyClusters(
  competitors: CompetitorProfileV3[]
): Map<string, CompetitorProfileV3[]> {
  const clusters = new Map<string, CompetitorProfileV3[]>();

  // Group by quadrant and type
  for (const competitor of competitors) {
    const key = `${competitor.positioning.quadrant}:${competitor.classification.type}`;

    if (!clusters.has(key)) {
      clusters.set(key, []);
    }
    clusters.get(key)!.push(competitor);
  }

  return clusters;
}

/**
 * Get quadrant summary statistics
 */
export function getQuadrantStats(
  competitors: CompetitorProfileV3[]
): Record<MapQuadrant, { count: number; avgThreat: number; topCompetitor: string | null }> {
  const quadrants: MapQuadrant[] = ['direct-threat', 'different-value', 'different-icp', 'distant'];

  const stats: Record<MapQuadrant, { count: number; avgThreat: number; topCompetitor: string | null }> = {
    'direct-threat': { count: 0, avgThreat: 0, topCompetitor: null },
    'different-value': { count: 0, avgThreat: 0, topCompetitor: null },
    'different-icp': { count: 0, avgThreat: 0, topCompetitor: null },
    'distant': { count: 0, avgThreat: 0, topCompetitor: null },
  };

  for (const quadrant of quadrants) {
    const inQuadrant = competitors.filter(c => c.positioning.quadrant === quadrant);

    if (inQuadrant.length > 0) {
      stats[quadrant].count = inQuadrant.length;
      stats[quadrant].avgThreat = Math.round(
        inQuadrant.reduce((sum, c) => sum + c.scores.threatScore, 0) / inQuadrant.length
      );

      // Find top competitor by threat score
      const top = inQuadrant.reduce((best, current) =>
        current.scores.threatScore > (best?.scores.threatScore || 0) ? current : best
      , inQuadrant[0]);

      stats[quadrant].topCompetitor = top?.name || null;
    }
  }

  return stats;
}

// ============================================================================
// Visualization Helpers
// ============================================================================

/**
 * Get axis labels for the positioning map
 */
export function getAxisLabels(): {
  x: { label: string; low: string; high: string };
  y: { label: string; low: string; high: string };
} {
  return {
    x: {
      label: 'Value Model Alignment',
      low: 'Different Value Delivery',
      high: 'Similar Value Delivery',
    },
    y: {
      label: 'ICP Alignment',
      low: 'Different Target Customer',
      high: 'Same Target Customer',
    },
  };
}

/**
 * Get quadrant descriptions
 */
export function getQuadrantDescriptions(): Record<MapQuadrant, { name: string; description: string; action: string }> {
  return {
    'direct-threat': {
      name: 'Direct Threats',
      description: 'Competitors targeting the same customers with similar value propositions',
      action: 'Differentiate aggressively; win on positioning and execution',
    },
    'different-value': {
      name: 'Different Value Model',
      description: 'Targeting similar customers but delivering value differently',
      action: 'Highlight your unique value delivery approach',
    },
    'different-icp': {
      name: 'Different ICP',
      description: 'Similar offerings but targeting different customer segments',
      action: 'Monitor for market expansion; potential future threats',
    },
    'distant': {
      name: 'Distant Competitors',
      description: 'Different customers and different value models',
      action: 'Lower priority; monitor but don\'t actively counter',
    },
  };
}

/**
 * Get color scheme for competitor types
 */
export function getTypeColors(): Record<string, { bg: string; border: string; text: string }> {
  return {
    direct: { bg: '#FEE2E2', border: '#EF4444', text: '#991B1B' },
    partial: { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E' },
    fractional: { bg: '#DBEAFE', border: '#3B82F6', text: '#1E40AF' },
    platform: { bg: '#E0E7FF', border: '#6366F1', text: '#3730A3' },
    internal: { bg: '#D1FAE5', border: '#10B981', text: '#065F46' },
  };
}

// ============================================================================
// Helpers
// ============================================================================

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
