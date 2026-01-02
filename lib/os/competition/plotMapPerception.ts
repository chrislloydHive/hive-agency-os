// lib/os/competition/plotMapPerception.ts
// Perception Map Coordinates for Competition Lab Plot Map
//
// This utility computes composite perception coordinates for the Plot Map.
// The Plot Map is a PERCEPTION map (how customers perceive the landscape),
// not a capability map.
//
// Axes:
// - X: Price Positioning (Perceived price/value) → 0–100
// - Y: Brand Gravity (Perceived brand pull/trust/visibility) → 0–100
//
// Key principles:
// 1. COMPLETE: All Primary competitors must appear (no drops)
// 2. CONTINUOUS: No bucket snapping / stacking
// 3. HONEST: Uncertainty encoded visually
// 4. DETERMINISTIC: Same run always renders same points

// ============================================================================
// Types
// ============================================================================

export interface Competitor {
  name: string;
  domain: string;
  classification?: 'primary' | 'contextual' | 'alternatives' | 'excluded';
  overlapScore?: number;
  brandRecognition?: number;
  pricePositioning?: 'budget' | 'mid' | 'premium' | string;
  geographicReach?: 'local' | 'regional' | 'national' | string;
  isRetailer?: boolean;
  isServiceProvider?: boolean;
  signalsUsed?: {
    marketReach?: string;
    geographicOverlap?: string;
    pricePositioning?: string;
  };
}

export interface PerceptionPoint {
  domain: string;
  name: string;
  x: number; // 0-100
  y: number; // 0-100
  estimated: boolean;
  uncertaintyRadius: number; // normalized value-space units
  // Additional metadata
  classification: 'primary' | 'contextual' | 'alternatives' | 'excluded';
  archetype: 'install-first' | 'retail-hybrid';
}

export interface PlotContext {
  modalityConfidence: number; // 0-100
  seed: string; // runId or companyId for deterministic jitter
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Clamp value to 0-1 range
 */
function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * Clamp value to 0-100 range
 */
function clamp100(x: number): number {
  return Math.max(0, Math.min(100, x));
}

/**
 * Normalize to 0-100 (assumes x already 0-100 but clamps)
 */
function normalize0to100(x: number): number {
  return clamp100(x);
}

/**
 * Price enum to score
 */
function enumPriceScore(price: string | undefined): number {
  switch (price?.toLowerCase()) {
    case 'budget':
      return 25;
    case 'mid':
      return 50;
    case 'premium':
      return 75;
    default:
      return 50; // unknown defaults to mid
  }
}

/**
 * Geographic reach enum to score
 */
function enumReachScore(reach: string | undefined): number {
  switch (reach?.toLowerCase()) {
    case 'local':
      return 30;
    case 'regional':
      return 55;
    case 'national':
      return 80;
    default:
      return 50; // unknown
  }
}

/**
 * Detect retail-hybrid archetype
 * National retailers with service capability
 */
function isRetailHybrid(c: Competitor): boolean {
  return (
    Boolean(c.isRetailer) &&
    Boolean(c.isServiceProvider) &&
    (c.geographicReach === 'national' || c.signalsUsed?.marketReach === 'national')
  );
}

/**
 * Detect install-first archetype
 * Service providers without major retail presence
 */
function isInstallFirst(c: Competitor): boolean {
  return Boolean(c.isServiceProvider) && !Boolean(c.isRetailer);
}

/**
 * Deterministic hash to unit value (0-1)
 * Uses simple string hashing for reproducibility
 */
function hashToUnit(input: string, salt: number = 0): number {
  let hash = salt;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Normalize to 0-1
  return ((hash >>> 0) % 10000) / 10000;
}

// ============================================================================
// Composite Axis Formulas (Exact per spec)
// ============================================================================

/**
 * Compute X-axis: Price Positioning (Perceived price/value)
 *
 * Formula:
 * base = enumPriceScore(c.pricePositioning)  // 25/50/75/50
 * overlap = clamp100(c.overlapScore ?? 60)   // default 60 if missing
 * retailMod = retailHybrid ? -5 : 0          // retail skews perceived mid
 * reachMod = national ? -5 : 0               // national compresses toward mid
 * overlapMod = (overlap - 60) * 0.10         // range roughly -6..+4
 *
 * x = clamp100(base + retailMod + reachMod + overlapMod)
 */
function computePriceX(c: Competitor): number {
  const base = enumPriceScore(c.pricePositioning);
  const overlap = clamp100(c.overlapScore ?? 60);
  const retailMod = isRetailHybrid(c) ? -5 : 0;
  const reachMod = enumReachScore(c.geographicReach) >= 80 ? -5 : 0;
  const overlapMod = (overlap - 60) * 0.10;

  return clamp100(base + retailMod + reachMod + overlapMod);
}

/**
 * Compute Y-axis: Brand Gravity (Perceived brand pull/trust/visibility)
 *
 * Formula:
 * brandBase = c.brandRecognition (clamped) or null if missing
 * reach = enumReachScore(c.geographicReach)
 * overlap = clamp100(c.overlapScore ?? 60)
 *
 * retailBoost = retailHybrid ? 10 : 0
 * nationalBoost = reach >= 80 ? 10 : 0
 * overlapBoost = (overlap - 60) * 0.08
 *
 * If brandBase available:
 *   y = clamp100(0.65 * brandBase + 0.20 * reach + 0.15 * (retailBoost + overlapBoost))
 * Else (inferred):
 *   y = clamp100(0.55 * reach + 0.25 * (retailBoost + nationalBoost + 40) + 0.20 * overlap)
 */
function computeBrandY(c: Competitor): { y: number; inferred: boolean } {
  const brandBase = c.brandRecognition != null ? clamp100(c.brandRecognition) : null;
  const reach = enumReachScore(c.geographicReach);
  const overlap = clamp100(c.overlapScore ?? 60);

  const retailBoost = isRetailHybrid(c) ? 10 : 0;
  const nationalBoost = reach >= 80 ? 10 : 0;
  const overlapBoost = (overlap - 60) * 0.08;

  if (brandBase != null) {
    // Direct computation with brand recognition
    const y = clamp100(
      0.65 * brandBase + 0.20 * reach + 0.15 * (retailBoost + overlapBoost)
    );
    return { y, inferred: false };
  } else {
    // Inferred from reach + retail signals
    const y = clamp100(
      0.55 * reach + 0.25 * (retailBoost + nationalBoost + 40) + 0.20 * overlap
    );
    return { y, inferred: true };
  }
}

/**
 * Determine if position is estimated (any missing core signals)
 */
function isEstimated(c: Competitor): boolean {
  return (
    c.brandRecognition == null ||
    c.pricePositioning == null ||
    c.geographicReach == null
  );
}

// ============================================================================
// Deterministic Jitter + Anti-Stacking
// ============================================================================

/**
 * Apply deterministic jitter based on confidence
 *
 * jitterMax = 6 + 10 * uncertainty
 * where uncertainty = 1 - (confidence / 100)
 */
function applyJitter(
  x: number,
  y: number,
  domain: string,
  ctx: PlotContext
): { x: number; y: number } {
  const conf = clamp100(ctx.modalityConfidence);
  const uncertainty = 1 - conf / 100; // 0..1
  const jitterMax = 6 + 10 * uncertainty; // 6..16 value-space units

  const hash1 = hashToUnit(domain + ctx.seed, 1);
  const hash2 = hashToUnit(domain + ctx.seed, 2);

  const jx = (hash1 - 0.5) * (jitterMax / 2);
  const jy = (hash2 - 0.5) * (jitterMax / 2);

  return {
    x: clamp100(x + jx),
    y: clamp100(y + jy),
  };
}

/**
 * Separation pass to prevent stacking
 * If two points are within threshold, nudge them apart deterministically
 */
function applySeparation(
  points: Array<{ domain: string; x: number; y: number }>,
  threshold: number = 2
): Array<{ domain: string; x: number; y: number }> {
  // Sort by domain for deterministic order
  const sorted = [...points].sort((a, b) => a.domain.localeCompare(b.domain));
  const result = sorted.map(p => ({ ...p }));

  // O(n²) but n is small (typically <20 competitors)
  for (let i = 0; i < result.length; i++) {
    for (let j = i + 1; j < result.length; j++) {
      const dx = result[j].x - result[i].x;
      const dy = result[j].y - result[i].y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < threshold && dist > 0) {
        // Nudge apart along the line between them
        const nudge = (threshold - dist) / 2 + 0.5;
        const angle = Math.atan2(dy, dx);

        result[i].x = clamp100(result[i].x - nudge * Math.cos(angle));
        result[i].y = clamp100(result[i].y - nudge * Math.sin(angle));
        result[j].x = clamp100(result[j].x + nudge * Math.cos(angle));
        result[j].y = clamp100(result[j].y + nudge * Math.sin(angle));
      } else if (dist === 0) {
        // Exactly overlapping - use deterministic offset
        const offset = 1.5;
        result[j].x = clamp100(result[j].x + offset);
        result[j].y = clamp100(result[j].y + offset);
      }
    }
  }

  return result;
}

// ============================================================================
// Uncertainty Radius Computation
// ============================================================================

/**
 * Compute uncertainty radius for visual encoding
 *
 * baseRadius = 18 * (1 - conf/100)  // 0..18
 * estRadius = estimated ? 10 : 0
 * uncertaintyRadius = baseRadius + estRadius
 */
function computeUncertaintyRadius(
  estimated: boolean,
  modalityConfidence: number
): number {
  const conf = clamp100(modalityConfidence);
  const baseRadius = 18 * (1 - conf / 100);
  const estRadius = estimated ? 10 : 0;

  return baseRadius + estRadius;
}

// ============================================================================
// Main Export
// ============================================================================

/**
 * Compute perception coordinates for a single competitor
 */
export function computePerceptionCoordinates(
  competitor: Competitor,
  ctx: PlotContext
): PerceptionPoint {
  // Compute raw coordinates
  const rawX = computePriceX(competitor);
  const brandResult = computeBrandY(competitor);
  const rawY = brandResult.y;

  // Apply jitter
  const jittered = applyJitter(rawX, rawY, competitor.domain, ctx);

  // Determine estimation status
  const estimated = isEstimated(competitor) || brandResult.inferred;

  // Compute uncertainty radius
  const uncertaintyRadius = computeUncertaintyRadius(estimated, ctx.modalityConfidence);

  // Determine archetype
  const archetype = isInstallFirst(competitor) ? 'install-first' : 'retail-hybrid';

  return {
    domain: competitor.domain,
    name: competitor.name,
    x: jittered.x,
    y: jittered.y,
    estimated,
    uncertaintyRadius,
    classification: competitor.classification ?? 'primary',
    archetype,
  };
}

/**
 * Compute perception coordinates for multiple competitors with separation
 */
export function computePerceptionCoordinatesBatch(
  competitors: Competitor[],
  ctx: PlotContext
): PerceptionPoint[] {
  // Compute raw coordinates for all
  const rawPoints = competitors.map(c => {
    const rawX = computePriceX(c);
    const brandResult = computeBrandY(c);
    const rawY = brandResult.y;
    const jittered = applyJitter(rawX, rawY, c.domain, ctx);

    return {
      competitor: c,
      domain: c.domain,
      x: jittered.x,
      y: jittered.y,
      brandInferred: brandResult.inferred,
    };
  });

  // Apply separation pass
  const separated = applySeparation(
    rawPoints.map(p => ({ domain: p.domain, x: p.x, y: p.y }))
  );

  // Map back to PerceptionPoint with separation applied
  const separatedMap = new Map(separated.map(p => [p.domain, { x: p.x, y: p.y }]));

  return rawPoints.map(raw => {
    const sep = separatedMap.get(raw.domain) || { x: raw.x, y: raw.y };
    const estimated = isEstimated(raw.competitor) || raw.brandInferred;
    const uncertaintyRadius = computeUncertaintyRadius(estimated, ctx.modalityConfidence);
    const archetype = isInstallFirst(raw.competitor) ? 'install-first' : 'retail-hybrid';

    return {
      domain: raw.domain,
      name: raw.competitor.name,
      x: sep.x,
      y: sep.y,
      estimated,
      uncertaintyRadius,
      classification: raw.competitor.classification ?? 'primary',
      archetype,
    };
  });
}

// ============================================================================
// Validation Utilities
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  warnings: string[];
}

/**
 * Validate plot map data for dev warnings
 */
export function validatePlotMapData(
  primaryCount: number,
  plottedPrimaryCount: number,
  points: PerceptionPoint[]
): ValidationResult {
  const warnings: string[] = [];

  // Check for missing primaries
  if (primaryCount > plottedPrimaryCount) {
    warnings.push(
      `[PlotMap] ERROR: ${primaryCount} primary competitors but only ${plottedPrimaryCount} plotted. Missing: ${primaryCount - plottedPrimaryCount}`
    );
  }

  // Check for stacked points (identical x or y after processing)
  const xCounts = new Map<number, string[]>();
  const yCounts = new Map<number, string[]>();

  for (const point of points) {
    const roundedX = Math.round(point.x);
    const roundedY = Math.round(point.y);

    if (!xCounts.has(roundedX)) xCounts.set(roundedX, []);
    if (!yCounts.has(roundedY)) yCounts.set(roundedY, []);

    xCounts.get(roundedX)!.push(point.name);
    yCounts.get(roundedY)!.push(point.name);
  }

  for (const [x, names] of xCounts) {
    if (names.length > 2) {
      warnings.push(
        `[PlotMap] WARNING: ${names.length} points share X=${x}: ${names.join(', ')}`
      );
    }
  }

  for (const [y, names] of yCounts) {
    if (names.length > 2) {
      warnings.push(
        `[PlotMap] WARNING: ${names.length} points share Y=${y}: ${names.join(', ')}`
      );
    }
  }

  // Check for out-of-bounds
  for (const point of points) {
    if (point.x < 0 || point.x > 100 || point.y < 0 || point.y > 100) {
      warnings.push(
        `[PlotMap] ERROR: Point "${point.name}" out of bounds: (${point.x}, ${point.y})`
      );
    }
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

// ============================================================================
// Helper Text
// ============================================================================

export const PLOT_MAP_HELPER_TEXT =
  'Positions are inferred from multiple signals to reflect customer perception. Distance indicates relative positioning, not exact pricing or brand rank.';

export const PLOT_MAP_ESTIMATED_TOOLTIP = 'Estimated positioning';
