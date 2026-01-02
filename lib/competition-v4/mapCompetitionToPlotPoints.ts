// lib/competition-v4/mapCompetitionToPlotPoints.ts
// Transforms Competition V4 data into plot points for 2D visualization
//
// HARDENED VERSION - Plot Map Final Hardening
//
// Key changes:
// 1. All primary competitors MUST be plotted (no silent filtering)
// 2. Weighted continuous scoring instead of bucket-based positioning
// 3. Confidence-aware dispersion (jitter) for low-confidence runs
// 4. Visual uncertainty encoding for inferred positions
//
// Axes:
// - X: Price Positioning (weighted: pricePositioning 50%, retailVsInstall 30%, overlap 20%)
// - Y: Brand Recognition (weighted: brand 40%, geoReach 30%, marketPresence 20%, confidence 10%)
// - Size: Overlap Score (0-100)
// - Color: Tier (primary, contextual, alternatives, excluded)

import type {
  CompetitionV4Result,
  ScoredCompetitor,
  ExcludedCompetitorRecord,
} from './types';
import {
  computePerceptionCoordinatesBatch,
  validatePlotMapData,
  PLOT_MAP_HELPER_TEXT,
  type Competitor as PerceptionCompetitor,
  type PlotContext,
  type PerceptionPoint,
} from '@/lib/os/competition/plotMapPerception';

// ============================================================================
// Types
// ============================================================================

export type CompetitorTier = 'primary' | 'contextual' | 'alternatives' | 'excluded';
export type CompetitorModality = 'install-first' | 'retail-hybrid';

export interface PlotPoint {
  id: string;
  name: string;
  domain: string | null;
  tier: CompetitorTier;

  // Position values
  x: number; // 0-100 (price positioning)
  y: number; // 0-100 (brand recognition)

  // Bubble size
  size: number; // 0-100 (overlap score)

  // Uncertainty fields (for visual encoding)
  confidence: number; // 0-100 overall confidence
  uncertaintyRadius: number; // Visual halo radius (higher = more uncertain)
  isLowConfidence: boolean; // true if confidence < 70
  jitterApplied: boolean; // true if position was jittered

  // Modality for visual distinction
  modality: CompetitorModality;

  // Metadata for display
  pricePositioning: 'budget' | 'mid' | 'premium' | 'unknown';
  priceAssumed: boolean;
  brandRecognition: number;
  brandAssumed: boolean;
  overlapScore: number;

  // Rich details for tooltip/panel
  whyThisMatters?: string;
  reasons?: string[];
  signalsUsed?: Record<string, unknown>;
  serviceCategories?: string[];
  productCategories?: string[];
  geographicReach?: 'local' | 'regional' | 'national' | 'unknown';
  isRetailer?: boolean;
  isServiceProvider?: boolean;
  hasInstallation?: boolean;
  hasNationalReach?: boolean;
  isLocal?: boolean;

  // For subject company highlighting
  isSubject?: boolean;

  // Estimation flag for perception map
  estimated: boolean;
}

export interface PlotMapData {
  points: PlotPoint[];
  subjectCompany?: PlotPoint;
  modality: string | null;
  modalityConfidence: number; // 0-100
  helperText: string; // Perception map framing text
  axisLabels: {
    x: { label: string; low: string; high: string };
    y: { label: string; low: string; high: string };
  };
  quadrantLabels: {
    topLeft: string;
    topRight: string;
    bottomLeft: string;
    bottomRight: string;
  };
  // Validation metadata
  validation: {
    primaryCount: number;
    plottedPrimaryCount: number;
    duplicateCoordinates: Array<{ x: number; y: number; names: string[] }>;
    warnings: string[];
  };
}

// ============================================================================
// Constants
// ============================================================================

const LOW_CONFIDENCE_THRESHOLD = 70;
const JITTER_MAX = 8; // Maximum jitter in either direction

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Normalize a value to 0-100 range
 */
function normalize(value: number, min: number, max: number): number {
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

/**
 * Deterministic pseudo-random jitter based on name hash
 * Returns value between -1 and 1
 */
function deterministicJitter(name: string, seed: number): number {
  let hash = seed;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash = hash & hash;
  }
  return ((hash % 1000) / 500) - 1; // -1 to 1
}

/**
 * Apply confidence-aware jitter to a coordinate
 * Low confidence = more jitter to show uncertainty
 */
function applyJitter(
  value: number,
  confidence: number,
  name: string,
  seed: number
): { value: number; jitterApplied: boolean } {
  if (confidence >= LOW_CONFIDENCE_THRESHOLD) {
    return { value, jitterApplied: false };
  }

  // Scale jitter inversely with confidence
  // At 0 confidence, max jitter. At 70, no jitter.
  const jitterScale = (LOW_CONFIDENCE_THRESHOLD - confidence) / LOW_CONFIDENCE_THRESHOLD;
  const jitter = deterministicJitter(name, seed) * JITTER_MAX * jitterScale;

  return {
    value: Math.max(5, Math.min(95, value + jitter)), // Keep within bounds
    jitterApplied: true,
  };
}

// ============================================================================
// Weighted Axis Scoring (Continuous, Multi-Signal)
// ============================================================================

/**
 * Compute X-axis score using weighted continuous scoring
 *
 * Formula:
 * priceScore = enum(pricePositioning) * 0.5 +
 *              retailVsInstallModifier * 0.3 +
 *              overlapScore * 0.2
 */
function computePriceScore(
  competitor: ScoredCompetitor
): { x: number; position: 'budget' | 'mid' | 'premium' | 'unknown'; assumed: boolean } {
  let priceBase = 50; // Default mid-market
  let position: 'budget' | 'mid' | 'premium' | 'unknown' = 'unknown';
  let assumed = true;

  // Component 1: Direct price positioning (weight: 0.5)
  if (competitor.pricePositioning) {
    position = competitor.pricePositioning;
    priceBase = position === 'budget' ? 25 : position === 'premium' ? 75 : 50;
    assumed = false;
  } else if (competitor.signalsUsed?.pricePositioning) {
    const signalPos = competitor.signalsUsed.pricePositioning as string;
    if (signalPos === 'budget' || signalPos === 'mid' || signalPos === 'premium') {
      position = signalPos;
      priceBase = signalPos === 'budget' ? 25 : signalPos === 'premium' ? 75 : 50;
      assumed = false;
    }
  }

  // Component 2: Retail vs Install modifier (weight: 0.3)
  // Retail-Hybrid naturally skews toward mid-market
  let retailModifier = 0;
  if (competitor.isMajorRetailer && !competitor.hasInstallation) {
    // Pure retail: tends toward budget-mid
    retailModifier = -10;
  } else if (competitor.hasInstallation && !competitor.isMajorRetailer) {
    // Service-first: can command premium
    retailModifier = 10;
  } else if (competitor.isMajorRetailer && competitor.hasInstallation) {
    // Retail-hybrid: mid-market anchor
    retailModifier = 0;
  }

  // Component 3: Overlap score influence (weight: 0.2)
  // Higher overlap competitors tend to be more similar in price
  const overlapInfluence = ((competitor.overlapScore ?? 50) - 50) * 0.1;

  // Combine with weights
  const rawScore = priceBase * 0.5 + (50 + retailModifier) * 0.3 + (50 + overlapInfluence) * 0.2;

  return {
    x: Math.max(5, Math.min(95, rawScore)),
    position,
    assumed,
  };
}

/**
 * Compute Y-axis score using weighted continuous scoring
 *
 * Formula:
 * brandScore = normalize(brandRecognition) * 0.4 +
 *              normalize(geographicReach) * 0.3 +
 *              normalize(marketPresence) * 0.2 +
 *              confidencePenalty * 0.1
 */
function computeBrandScore(
  competitor: ScoredCompetitor
): { y: number; value: number; assumed: boolean } {
  let brandBase = 50;
  let assumed = true;

  // Component 1: Direct brand trust score (weight: 0.4)
  if (typeof competitor.brandTrustScore === 'number') {
    brandBase = Math.max(0, Math.min(100, competitor.brandTrustScore));
    assumed = false;
  } else {
    // Infer from signals
    if (competitor.isMajorRetailer) {
      brandBase = 80;
    } else if (competitor.hasNationalReach) {
      brandBase = 65;
    } else if (competitor.isLocal) {
      brandBase = 35;
    }
  }

  // Component 2: Geographic reach (weight: 0.3)
  // Local < Regional < National
  let geoScore = 50;
  if (competitor.hasNationalReach || competitor.isMajorRetailer) {
    geoScore = 85;
  } else if (competitor.isLocal) {
    geoScore = 25;
  } else {
    geoScore = 55; // Regional default
  }

  // Component 3: Market presence signals (weight: 0.2)
  let marketPresence = 50;
  if (competitor.isMajorRetailer) {
    marketPresence = 90;
  } else if (competitor.hasInstallation && competitor.hasNationalReach) {
    marketPresence = 70;
  } else if (competitor.hasInstallation) {
    marketPresence = 55;
  }

  // Component 4: Confidence penalty (weight: 0.1)
  // Lower confidence increases variance, not flattening
  const confidence = competitor.confidence ?? 50;
  const confidenceModifier = (confidence - 50) * 0.2; // +/- 10 points

  // Combine with weights
  const rawScore = brandBase * 0.4 + geoScore * 0.3 + marketPresence * 0.2 + (50 + confidenceModifier) * 0.1;

  return {
    y: Math.max(5, Math.min(95, rawScore)),
    value: Math.round(rawScore),
    assumed,
  };
}

/**
 * Determine competitor modality
 */
function getModality(competitor: ScoredCompetitor): CompetitorModality {
  if (competitor.hasInstallation && !competitor.isMajorRetailer) {
    return 'install-first';
  }
  return 'retail-hybrid';
}

/**
 * Determine geographic reach from competitor data
 */
function getGeographicReach(
  competitor: ScoredCompetitor
): 'local' | 'regional' | 'national' | 'unknown' {
  if (competitor.signalsUsed?.geographicOverlap) {
    return competitor.signalsUsed.geographicOverlap as 'local' | 'regional' | 'national';
  }
  if (competitor.hasNationalReach || competitor.isMajorRetailer) {
    return 'national';
  }
  if (competitor.isLocal) {
    return 'local';
  }
  return 'unknown';
}

/**
 * Calculate uncertainty radius based on confidence
 * Lower confidence = larger uncertainty halo
 */
function calculateUncertaintyRadius(confidence: number): number {
  if (confidence >= LOW_CONFIDENCE_THRESHOLD) {
    return 0;
  }
  // Scale from 0 to 12 as confidence goes from 70 to 0
  return Math.round(((LOW_CONFIDENCE_THRESHOLD - confidence) / LOW_CONFIDENCE_THRESHOLD) * 12);
}

/**
 * Convert a ScoredCompetitor to a PlotPoint
 * Uses weighted continuous scoring with confidence-aware jitter
 */
function scoredCompetitorToPlotPoint(
  competitor: ScoredCompetitor,
  tier: CompetitorTier,
  modalityConfidence: number
): PlotPoint {
  const priceMapping = computePriceScore(competitor);
  const brandMapping = computeBrandScore(competitor);
  const overlapScore = competitor.overlapScore ?? 40;
  const confidence = competitor.confidence ?? modalityConfidence;
  const isLowConfidence = confidence < LOW_CONFIDENCE_THRESHOLD;

  // Apply jitter for low-confidence positions
  const xJittered = applyJitter(priceMapping.x, confidence, competitor.name, 1);
  const yJittered = applyJitter(brandMapping.y, confidence, competitor.name, 2);

  return {
    id: competitor.domain || competitor.name.toLowerCase().replace(/\s+/g, '-'),
    name: competitor.name,
    domain: competitor.domain || null,
    tier,

    x: xJittered.value,
    y: yJittered.value,
    size: overlapScore,

    // Uncertainty fields
    confidence,
    uncertaintyRadius: calculateUncertaintyRadius(confidence),
    isLowConfidence,
    jitterApplied: xJittered.jitterApplied || yJittered.jitterApplied,

    // Modality
    modality: getModality(competitor),

    pricePositioning: priceMapping.position,
    priceAssumed: priceMapping.assumed,
    brandRecognition: brandMapping.value,
    brandAssumed: brandMapping.assumed,
    overlapScore,

    whyThisMatters: competitor.whyThisMatters,
    reasons: competitor.reasons,
    signalsUsed: competitor.signalsUsed as Record<string, unknown> | undefined,
    serviceCategories: competitor.serviceCategories,
    productCategories: competitor.productCategories,
    geographicReach: getGeographicReach(competitor),
    isRetailer: competitor.isMajorRetailer,
    isServiceProvider: competitor.hasInstallation,
    hasInstallation: competitor.hasInstallation,
    hasNationalReach: competitor.hasNationalReach,
    isLocal: competitor.isLocal,

    // Estimation flag
    estimated: priceMapping.assumed || brandMapping.assumed,
  };
}

/**
 * Convert an ExcludedCompetitorRecord to a minimal PlotPoint
 * Excluded competitors get jittered positions to avoid clustering at center
 */
function excludedCompetitorToPlotPoint(
  competitor: ExcludedCompetitorRecord
): PlotPoint {
  // Apply deterministic jitter to avoid all excluded points stacking at 50,50
  const baseX = 50 + deterministicJitter(competitor.name, 1) * 15;
  const baseY = 50 + deterministicJitter(competitor.name, 2) * 15;

  return {
    id: competitor.domain || competitor.name.toLowerCase().replace(/\s+/g, '-'),
    name: competitor.name,
    domain: competitor.domain || null,
    tier: 'excluded',

    // Jittered positioning for excluded competitors
    x: Math.max(10, Math.min(90, baseX)),
    y: Math.max(10, Math.min(90, baseY)),
    size: 20, // Smaller size

    // Uncertainty fields - excluded are inherently uncertain
    confidence: 30,
    uncertaintyRadius: 8,
    isLowConfidence: true,
    jitterApplied: true,

    // Modality - default to retail-hybrid for excluded
    modality: 'retail-hybrid',

    pricePositioning: 'unknown',
    priceAssumed: true,
    brandRecognition: 50,
    brandAssumed: true,
    overlapScore: 20,

    // Reason for exclusion stored in whyThisMatters
    whyThisMatters: competitor.reason,
    reasons: [competitor.reason],

    // Excluded competitors are always estimated
    estimated: true,
  };
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Find duplicate coordinates after rounding
 */
function findDuplicateCoordinates(
  points: PlotPoint[]
): Array<{ x: number; y: number; names: string[] }> {
  const coordMap = new Map<string, string[]>();

  for (const point of points) {
    // Round to nearest integer for comparison
    const key = `${Math.round(point.x)},${Math.round(point.y)}`;
    if (!coordMap.has(key)) {
      coordMap.set(key, []);
    }
    coordMap.get(key)!.push(point.name);
  }

  const duplicates: Array<{ x: number; y: number; names: string[] }> = [];
  for (const [key, names] of coordMap) {
    if (names.length > 1) {
      const [x, y] = key.split(',').map(Number);
      duplicates.push({ x, y, names });
    }
  }

  return duplicates;
}

/**
 * Emit dev-time validation warnings
 */
function emitValidationWarnings(
  primaryCount: number,
  plottedPrimaryCount: number,
  duplicates: Array<{ x: number; y: number; names: string[] }>
): string[] {
  const warnings: string[] = [];

  if (primaryCount > plottedPrimaryCount) {
    warnings.push(
      `[PlotMap] VALIDATION ERROR: ${primaryCount} primary competitors but only ${plottedPrimaryCount} plotted. Silent filtering detected!`
    );
  }

  for (const dup of duplicates) {
    warnings.push(
      `[PlotMap] VALIDATION WARNING: ${dup.names.length} competitors share coordinates (${dup.x}, ${dup.y}): ${dup.names.join(', ')}`
    );
  }

  // Log warnings in development
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    for (const warning of warnings) {
      console.warn(warning);
    }
  }

  return warnings;
}

// ============================================================================
// Conversion: ScoredCompetitor → PerceptionCompetitor
// ============================================================================

function toPerceptionCompetitor(
  competitor: ScoredCompetitor,
  classification: 'primary' | 'contextual' | 'alternatives' | 'excluded'
): PerceptionCompetitor {
  return {
    name: competitor.name,
    domain: competitor.domain || competitor.name.toLowerCase().replace(/\s+/g, '-'),
    classification,
    overlapScore: competitor.overlapScore,
    brandRecognition: competitor.brandTrustScore,
    pricePositioning: competitor.pricePositioning,
    geographicReach: getGeographicReach(competitor),
    isRetailer: competitor.isMajorRetailer,
    isServiceProvider: competitor.hasInstallation,
    signalsUsed: competitor.signalsUsed ? {
      marketReach: competitor.signalsUsed.geographicOverlap as string | undefined,
      geographicOverlap: competitor.signalsUsed.geographicOverlap as string | undefined,
      pricePositioning: competitor.signalsUsed.pricePositioning as string | undefined,
    } : undefined,
  };
}

function toPerceptionCompetitorFromExcluded(
  competitor: ExcludedCompetitorRecord
): PerceptionCompetitor {
  return {
    name: competitor.name,
    domain: competitor.domain || competitor.name.toLowerCase().replace(/\s+/g, '-'),
    classification: 'excluded',
    // Minimal signals for excluded
    overlapScore: 30,
    brandRecognition: undefined,
    pricePositioning: undefined,
    geographicReach: undefined,
    isRetailer: false,
    isServiceProvider: false,
  };
}

// ============================================================================
// Main Export
// ============================================================================

/**
 * Transform Competition V4 result into plot map data
 *
 * Uses Perception Map coordinates for honest, complete visualization.
 * CRITICAL: All primary competitors MUST be plotted. No silent filtering allowed.
 */
export function mapCompetitionToPlotPoints(
  data: CompetitionV4Result,
  subjectCompanyName?: string,
  runId?: string
): PlotMapData {
  const sc = data.scoredCompetitors;
  const emptyResult: PlotMapData = {
    points: [],
    modality: null,
    modalityConfidence: 0,
    helperText: PLOT_MAP_HELPER_TEXT,
    axisLabels: {
      x: { label: 'Price Positioning', low: 'Budget', high: 'Premium' },
      y: { label: 'Brand Gravity', low: 'Low', high: 'High' },
    },
    quadrantLabels: {
      topLeft: 'Budget + Strong Brand',
      topRight: 'Premium + Strong Brand',
      bottomLeft: 'Budget + Low Brand',
      bottomRight: 'Premium + Low Brand',
    },
    validation: {
      primaryCount: 0,
      plottedPrimaryCount: 0,
      duplicateCoordinates: [],
      warnings: [],
    },
  };

  if (!sc) {
    return emptyResult;
  }

  // Get modality confidence (default 50 if not specified)
  const modalityConfidence = sc.modalityConfidence ?? 50;

  // Build perception context
  const ctx: PlotContext = {
    modalityConfidence,
    seed: runId || data.runId || 'default-seed',
  };

  // Collect all competitors for batch processing
  const allPerceptionCompetitors: PerceptionCompetitor[] = [];
  const seenDomains = new Set<string>();

  // Track primary count for validation
  const primaryCompetitors = sc.primary || [];
  const primaryCount = primaryCompetitors.length;

  // Process in priority order (primary > contextual > alternatives)
  const tiers: Array<{ competitors: ScoredCompetitor[]; classification: 'primary' | 'contextual' | 'alternatives' }> = [
    { competitors: primaryCompetitors, classification: 'primary' },
    { competitors: sc.contextual || [], classification: 'contextual' },
    { competitors: sc.alternatives || [], classification: 'alternatives' },
  ];

  for (const { competitors, classification } of tiers) {
    for (const competitor of competitors) {
      const perceptionComp = toPerceptionCompetitor(competitor, classification);
      const key = perceptionComp.domain.toLowerCase();

      if (!seenDomains.has(key)) {
        seenDomains.add(key);
        allPerceptionCompetitors.push(perceptionComp);
      }
    }
  }

  // Add excluded competitors
  const excludedCompetitors = sc.excluded || [];
  for (const competitor of excludedCompetitors) {
    const perceptionComp = toPerceptionCompetitorFromExcluded(competitor);
    const key = perceptionComp.domain.toLowerCase();

    if (!seenDomains.has(key)) {
      seenDomains.add(key);
      allPerceptionCompetitors.push(perceptionComp);
    }
  }

  // Compute perception coordinates with batch processing (includes separation)
  const perceptionPoints = computePerceptionCoordinatesBatch(allPerceptionCompetitors, ctx);

  // Convert PerceptionPoints to PlotPoints
  const points: PlotPoint[] = perceptionPoints.map((pp, idx) => {
    const originalComp = allPerceptionCompetitors[idx];
    const scoredComp = findOriginalScoredCompetitor(sc, originalComp.domain);

    return {
      id: pp.domain,
      name: pp.name,
      domain: pp.domain,
      tier: pp.classification as CompetitorTier,

      x: pp.x,
      y: pp.y,
      size: originalComp.overlapScore ?? 40,

      // Uncertainty fields
      confidence: ctx.modalityConfidence,
      uncertaintyRadius: pp.uncertaintyRadius,
      isLowConfidence: pp.uncertaintyRadius > 10,
      jitterApplied: true, // All non-subject points get jitter

      // Modality
      modality: pp.archetype,

      // Metadata
      pricePositioning: normalizePrice(originalComp.pricePositioning),
      priceAssumed: !originalComp.pricePositioning,
      brandRecognition: Math.round(pp.y),
      brandAssumed: originalComp.brandRecognition == null,
      overlapScore: originalComp.overlapScore ?? 40,

      // Rich details from scored competitor
      whyThisMatters: scoredComp?.whyThisMatters,
      reasons: scoredComp?.reasons,
      signalsUsed: scoredComp?.signalsUsed as Record<string, unknown> | undefined,
      serviceCategories: scoredComp?.serviceCategories,
      productCategories: scoredComp?.productCategories,
      geographicReach: originalComp.geographicReach as 'local' | 'regional' | 'national' | 'unknown' | undefined,
      isRetailer: originalComp.isRetailer,
      isServiceProvider: originalComp.isServiceProvider,
      hasInstallation: originalComp.isServiceProvider,
      hasNationalReach: originalComp.geographicReach === 'national',
      isLocal: originalComp.geographicReach === 'local',

      estimated: pp.estimated,
    };
  });

  // Count how many primary competitors were actually plotted
  const plottedPrimaryCount = points.filter(p => p.tier === 'primary').length;

  // Find subject company if name provided
  let subjectCompany: PlotPoint | undefined;
  if (subjectCompanyName) {
    const subjectKey = subjectCompanyName.toLowerCase();
    const existingSubject = points.find(
      p => p.name.toLowerCase() === subjectKey || p.domain?.toLowerCase().includes(subjectKey)
    );

    if (existingSubject) {
      existingSubject.isSubject = true;
      // Subject gets no jitter and minimal uncertainty
      existingSubject.jitterApplied = false;
      existingSubject.uncertaintyRadius = 2; // Minimal ring
      existingSubject.isLowConfidence = false;
      subjectCompany = existingSubject;
    } else {
      // Create a synthetic subject point if not in competitors
      // Subject company gets NO jitter (zero uncertainty)
      subjectCompany = {
        id: 'subject-company',
        name: subjectCompanyName,
        domain: subjectCompanyName.toLowerCase().replace(/\s+/g, '-'),
        tier: 'primary',
        x: 65, // Slightly premium
        y: 60, // Moderate brand
        size: 100, // Full size (it's the subject)
        confidence: 100, // Full confidence for subject
        uncertaintyRadius: 2, // Minimal ring
        isLowConfidence: false,
        jitterApplied: false,
        modality: 'install-first', // Assume service-first for subject
        pricePositioning: 'mid',
        priceAssumed: true,
        brandRecognition: 60,
        brandAssumed: true,
        overlapScore: 100,
        isSubject: true,
        estimated: false,
      };
      points.push(subjectCompany);
    }
  }

  // Run validation using the perception utility
  const perceptionValidation = validatePlotMapData(
    primaryCount,
    plottedPrimaryCount,
    perceptionPoints
  );

  // Also run local validation for duplicate coordinates
  const duplicateCoordinates = findDuplicateCoordinates(points);

  // Merge warnings
  const allWarnings = [...perceptionValidation.warnings];
  const oldWarnings = emitValidationWarnings(primaryCount, plottedPrimaryCount, duplicateCoordinates);
  for (const w of oldWarnings) {
    if (!allWarnings.includes(w)) {
      allWarnings.push(w);
    }
  }

  return {
    points,
    subjectCompany,
    modality: sc.modality || null,
    modalityConfidence,
    helperText: PLOT_MAP_HELPER_TEXT,
    axisLabels: {
      x: { label: 'Price Positioning', low: 'Budget', high: 'Premium' },
      y: { label: 'Brand Gravity', low: 'Low', high: 'High' },
    },
    quadrantLabels: {
      topLeft: 'Budget + Strong Brand',
      topRight: 'Premium + Strong Brand',
      bottomLeft: 'Budget + Low Brand',
      bottomRight: 'Premium + Low Brand',
    },
    validation: {
      primaryCount,
      plottedPrimaryCount,
      duplicateCoordinates,
      warnings: allWarnings,
    },
  };
}

// Helper to find original scored competitor by domain
function findOriginalScoredCompetitor(
  sc: NonNullable<CompetitionV4Result['scoredCompetitors']>,
  domain: string
): ScoredCompetitor | undefined {
  const domainLower = domain.toLowerCase();
  return (
    sc.primary?.find(c => c.domain?.toLowerCase() === domainLower) ||
    sc.contextual?.find(c => c.domain?.toLowerCase() === domainLower) ||
    sc.alternatives?.find(c => c.domain?.toLowerCase() === domainLower)
  );
}

// Helper to normalize price positioning
function normalizePrice(price: string | undefined): 'budget' | 'mid' | 'premium' | 'unknown' {
  if (!price) return 'unknown';
  const lower = price.toLowerCase();
  if (lower === 'budget') return 'budget';
  if (lower === 'mid') return 'mid';
  if (lower === 'premium') return 'premium';
  return 'unknown';
}

/**
 * Get tier color for a plot point
 */
export function getTierColor(tier: CompetitorTier): string {
  switch (tier) {
    case 'primary':
      return '#ef4444'; // red-500
    case 'contextual':
      return '#f59e0b'; // amber-500
    case 'alternatives':
      return '#64748b'; // slate-500
    case 'excluded':
      return '#374151'; // gray-700
    default:
      return '#64748b';
  }
}

/**
 * Get tier label for display
 */
export function getTierLabel(tier: CompetitorTier): string {
  switch (tier) {
    case 'primary':
      return 'Primary';
    case 'contextual':
      return 'Contextual';
    case 'alternatives':
      return 'Alternative';
    case 'excluded':
      return 'Excluded';
    default:
      return tier;
  }
}
