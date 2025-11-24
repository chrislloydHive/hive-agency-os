// lib/gap-ia/stackup.ts
// Compute "How You Stack Up" comparison data for GAP-IA reports

import {
  getBenchmarksForBusinessType,
  getBusinessTypeLabel,
  type DimensionId,
} from './benchmarks';

/**
 * Relative performance labels
 * - below: Significantly below category average
 * - average: Typical for this category
 * - strong: Above average, approaching leaders
 * - leader: At or near category leader level
 */
export type RelativeLabel = 'below' | 'average' | 'strong' | 'leader';

/**
 * Dimension comparison row for stack-up table
 */
export interface DimensionStackupRow {
  dimensionId: DimensionId;
  dimensionLabel: string;
  you: number;
  avg: number;
  leader: number;
  relativeLabel: RelativeLabel;
  relativeLabelText: string;
}

/**
 * Complete stack-up result for an IA report
 */
export interface StackupResult {
  businessType: string;
  businessTypeLabel: string;
  rows: DimensionStackupRow[];
  hasData: boolean; // False if no valid dimension scores
}

/**
 * Dimension display labels
 */
const DIMENSION_LABELS: Record<DimensionId, string> = {
  brand: 'Brand & Positioning',
  content: 'Content & Messaging',
  seo: 'SEO & Visibility',
  website: 'Website & Conversion',
  digitalFootprint: 'Digital Footprint',
  authority: 'Authority & Trust',
};

/**
 * Relative label display text
 */
const RELATIVE_LABEL_TEXT: Record<RelativeLabel, string> = {
  below: 'Below category average',
  average: 'In line with peers',
  strong: 'Above average',
  leader: 'Approaching category leaders',
};

/**
 * Compute relative performance label
 *
 * Thresholds:
 * - below: you < avg - 8
 * - average: you within ±8 of avg
 * - strong: you > avg + 8 but < leader - 5
 * - leader: you >= leader - 5
 */
function computeRelativeLabel(you: number, avg: number, leader: number): RelativeLabel {
  if (you < avg - 8) {
    return 'below';
  } else if (you >= leader - 5) {
    return 'leader';
  } else if (you > avg + 8) {
    return 'strong';
  } else {
    return 'average';
  }
}

/**
 * Build stack-up comparison data for an IA report
 *
 * @param dimensionScores - IA dimension scores (brand, content, seo, website, digitalFootprint, authority)
 * @param businessType - Business type from businessContext.businessType
 * @returns Stack-up result with comparison rows for each dimension
 */
export function buildStackupResult(
  dimensionScores: {
    brand?: number;
    content?: number;
    seo?: number;
    website?: number;
    digitalFootprint?: number;
    authority?: number;
  },
  businessType?: string
): StackupResult {
  const benchmarks = getBenchmarksForBusinessType(businessType);
  const businessTypeLabel = getBusinessTypeLabel(businessType);

  const rows: DimensionStackupRow[] = [];

  // Build a row for each dimension (only if score exists and is > 0)
  const dimensions: DimensionId[] = [
    'brand',
    'content',
    'seo',
    'website',
    'digitalFootprint',
    'authority',
  ];

  for (const dimensionId of dimensions) {
    const you = dimensionScores[dimensionId];

    // Skip if score is missing or zero
    if (!you || you <= 0) {
      continue;
    }

    const benchmark = benchmarks[dimensionId];
    const relativeLabel = computeRelativeLabel(you, benchmark.avg, benchmark.leader);

    rows.push({
      dimensionId,
      dimensionLabel: DIMENSION_LABELS[dimensionId],
      you,
      avg: benchmark.avg,
      leader: benchmark.leader,
      relativeLabel,
      relativeLabelText: RELATIVE_LABEL_TEXT[relativeLabel],
    });
  }

  return {
    businessType: businessType || 'other',
    businessTypeLabel,
    rows,
    hasData: rows.length > 0,
  };
}
