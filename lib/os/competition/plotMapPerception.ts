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
  classification: 'primary' | 'contextual' | 'alternatives' | 'excluded' | 'subject';
  archetype: 'install-first' | 'retail-hybrid';
  isSubject?: boolean;
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
      return 35;
    case 'mid':
      return 55;
    case 'premium':
      return 78;
    default:
      return 55; // unknown defaults to mid-ish
  }
}

function enumReachScore(reach: string | undefined): number {
  switch (reach?.toLowerCase()) {
    case 'local':
      return 30;
    case 'regional':
      return 55;
    case 'national':
      return 80;
    default:
      return 55; // unknown
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
  const reach = enumReachScore(c.geographicReach);

  // Pull mid when national retail hybrid; push premium when install-first + high overlap
  const retailMod = isRetailHybrid(c) ? -6 : 0;
  const reachMod = reach >= 80 ? -4 : 0;
  const overlapMod = (overlap - 60) * 0.12;
  const installBias = isInstallFirst(c) ? 4 : 0;

  return clamp100(base + retailMod + reachMod + overlapMod + installBias);
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

  const retailBoost = isRetailHybrid(c) ? 12 : 0;
  const nationalBoost = reach >= 80 ? 10 : 0;
  const overlapBoost = (overlap - 60) * 0.1;

  if (brandBase != null) {
    const y = clamp100(
      0.70 * brandBase + 0.15 * reach + 0.15 * (retailBoost + overlapBoost)
    );
    return { y, inferred: false };
  }

  const y = clamp100(
    0.60 * reach + 0.25 * (retailBoost + nationalBoost + 35) + 0.15 * overlap
  );
  return { y, inferred: true };
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
  // Only jitter when collisions are detected; baseline no jitter
  return { x, y };
}

/**
 * Separation pass to prevent stacking
 * If two points are within threshold, nudge them apart deterministically
 */
function applySeparation(
  points: Array<{ domain: string; x: number; y: number }>,
  seed: string,
  threshold: number = 2.5
): Array<{ domain: string; x: number; y: number }> {
  const sorted = [...points].sort((a, b) => a.domain.localeCompare(b.domain));
  const result = sorted.map(p => ({ ...p }));

  for (let i = 0; i < result.length; i++) {
    for (let j = i + 1; j < result.length; j++) {
      const dx = result[j].x - result[i].x;
      const dy = result[j].y - result[i].y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= threshold) {
        const jitter = 3;
        const angleHash = hashToUnit(result[i].domain + result[j].domain + seed, 7);
        const angle = angleHash * Math.PI * 2;
        const offsetX = Math.cos(angle) * jitter;
        const offsetY = Math.sin(angle) * jitter;

        result[i].x = clamp100(result[i].x - offsetX / 2);
        result[i].y = clamp100(result[i].y - offsetY / 2);
        result[j].x = clamp100(result[j].x + offsetX / 2);
        result[j].y = clamp100(result[j].y + offsetY / 2);
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

  // Determine estimation status
  const estimated = isEstimated(competitor) || brandResult.inferred;

  // Compute uncertainty radius
  const uncertaintyRadius = computeUncertaintyRadius(estimated, ctx.modalityConfidence);

  // Determine archetype
  const archetype = isInstallFirst(competitor) ? 'install-first' : 'retail-hybrid';

  return {
    domain: competitor.domain,
    name: competitor.name,
    x: rawX,
    y: rawY,
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

    return {
      competitor: c,
      domain: c.domain,
      x: rawX,
      y: rawY,
      brandInferred: brandResult.inferred,
    };
  });

  // Apply separation pass
  const separated = applySeparation(
    rawPoints.map(p => ({ domain: p.domain, x: p.x, y: p.y })),
    ctx.seed
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
      isSubject: raw.competitor.classification === 'subject',
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
