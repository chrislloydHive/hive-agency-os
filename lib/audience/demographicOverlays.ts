// lib/audience/demographicOverlays.ts
// Demographic Overlays - Behavior-First, Guardrailed
//
// CORE PRINCIPLE: Demographics are overlays, not facts.
// They must be:
// - Segment-specific
// - Explicitly inferred
// - Low confidence by default
// - Never primary segmentation
// - Never auto-confirmed into Context Graph
//
// If you cannot support a demographic inference, do not generate it.

import { z } from 'zod';
import type { AudienceSegment } from './model';
import type { AudienceSignals } from './signals';

// ============================================================================
// Constants
// ============================================================================

/** Base demographic confidence - conservative starting point */
export const BASE_DEMOGRAPHIC_CONFIDENCE = 50;

/** Maximum allowed confidence for demographic overlays */
export const MAX_DEMOGRAPHIC_CONFIDENCE = 70;

/** Minimum confidence threshold - overlays below this are discarded */
export const MIN_DEMOGRAPHIC_CONFIDENCE = 40;

// ============================================================================
// Types
// ============================================================================

/**
 * Evidence type for demographic inference
 */
export const DemographicEvidenceType = z.enum([
  'category',         // Category type (e.g., high-ticket installed services)
  'cta',              // Call-to-action signals
  'behavior_pattern', // Research depth, buying guides, etc.
  'industry_norm',    // Industry-wide norms (reduces confidence)
]);

export type DemographicEvidenceType = z.infer<typeof DemographicEvidenceType>;

/**
 * Single piece of evidence for a demographic inference
 */
export const DemographicEvidence = z.object({
  type: DemographicEvidenceType,
  sourceUrl: z.string().optional(),
  snippet: z.string(),
});

export type DemographicEvidence = z.infer<typeof DemographicEvidence>;

/**
 * Inferred demographic attributes
 * All strings should end with "(inferred)" to indicate they are not facts
 */
export const InferredAttributes = z.object({
  ageRange: z.string().optional(),        // e.g., "25-54 (inferred)"
  incomeTier: z.string().optional(),      // e.g., "Mid to upper income (inferred)"
  householdType: z.string().optional(),   // e.g., "Vehicle-owning households (inferred)"
  genderSkew: z.string().optional(),      // e.g., "Male-skewing (inferred)"
  lifestyleContext: z.string().optional(), // e.g., "Automotive hobbyist / enthusiast (inferred)"
});

export type InferredAttributes = z.infer<typeof InferredAttributes>;

/**
 * Demographic overlay for a single segment
 */
export const DemographicOverlay = z.object({
  /** Key of the segment this overlay applies to */
  appliesToSegmentKey: z.string(),

  /** Inferred demographic attributes */
  inferredAttributes: InferredAttributes,

  /** Confidence score (40-70, never higher) */
  confidence: z.number().min(MIN_DEMOGRAPHIC_CONFIDENCE).max(MAX_DEMOGRAPHIC_CONFIDENCE),

  /** 1-2 sentence rationale explaining why this inference exists */
  rationale: z.string(),

  /** Evidence supporting the inference */
  evidence: z.array(DemographicEvidence).min(1),
});

export type DemographicOverlay = z.infer<typeof DemographicOverlay>;

/**
 * Result of demographic inference for a segment
 */
export interface DemographicInferenceResult {
  overlay: DemographicOverlay | null;
  rejected: boolean;
  rejectReason?: string;
  rawConfidence?: number;
}

// ============================================================================
// Behavioral Signal Analysis
// ============================================================================

/**
 * Behavioral signals extracted from audience signals
 */
export interface BehavioralSignalSet {
  hasDIYSignals: boolean;
  hasBuyingGuides: boolean;
  hasInstalledServices: boolean;
  hasLocalUrgency: boolean;
  hasHighTicketServices: boolean;
  hasProfessionalInstallation: boolean;
  hasEnthusiastContent: boolean;
  hasComparisonContent: boolean;
  hasB2BSignals: boolean;
  categoryType: string | null;
  urgencyType: 'clear' | 'mixed' | 'none';
  signalCount: number;
}

/**
 * Extract behavioral signals from audience data
 */
export function extractBehavioralSignals(
  segment: AudienceSegment,
  signals: AudienceSignals
): BehavioralSignalSet {
  const result: BehavioralSignalSet = {
    hasDIYSignals: false,
    hasBuyingGuides: false,
    hasInstalledServices: false,
    hasLocalUrgency: false,
    hasHighTicketServices: false,
    hasProfessionalInstallation: false,
    hasEnthusiastContent: false,
    hasComparisonContent: false,
    hasB2BSignals: false,
    categoryType: null,
    urgencyType: 'none',
    signalCount: 0,
  };

  // Combine all text sources for analysis
  const textSources: string[] = [
    segment.description || '',
    segment.name || '',
    ...(segment.jobsToBeDone || []),
    ...(segment.keyPains || []),
    ...(segment.keyGoals || []),
    ...(segment.behavioralDrivers || []),
    segment.mediaHabits || '',
    ...(segment.creativeAngles || []),
    signals.gapNarrative || '',
    signals.contentNarrative || '',
    signals.seoNarrative || '',
    ...(signals.seoFindings?.keywordThemes || []),
    ...(signals.contentFindings?.keyTopics || []),
  ].filter(Boolean);

  const combinedText = textSources.join(' ').toLowerCase();

  // DIY signals
  const diyPatterns = ['diy', 'do it yourself', 'self-install', 'hands-on', 'home improvement', 'project'];
  result.hasDIYSignals = diyPatterns.some(p => combinedText.includes(p));

  // Buying guides / research behavior
  const buyingGuidePatterns = ['buying guide', 'comparison', 'vs', 'best of', 'how to choose', 'what to look for', 'review'];
  result.hasBuyingGuides = buyingGuidePatterns.some(p => combinedText.includes(p));

  // Installed services
  const installedPatterns = ['installation', 'installed', 'installer', 'technician', 'professional service', 'on-site'];
  result.hasInstalledServices = installedPatterns.some(p => combinedText.includes(p));

  // Local urgency
  const localUrgencyPatterns = ['near me', 'local', 'same day', 'emergency', 'urgent', 'asap', 'quick response'];
  result.hasLocalUrgency = localUrgencyPatterns.some(p => combinedText.includes(p));

  // High-ticket signals
  const highTicketPatterns = ['premium', 'luxury', 'high-end', 'investment', 'financing', 'custom', 'professional grade'];
  result.hasHighTicketServices = highTicketPatterns.some(p => combinedText.includes(p));

  // Professional installation emphasis
  const proInstallPatterns = ['certified', 'licensed', 'warranty', 'professional installation', 'expert installation', 'trained'];
  result.hasProfessionalInstallation = proInstallPatterns.some(p => combinedText.includes(p));

  // Enthusiast / hobbyist content
  const enthusiastPatterns = ['enthusiast', 'hobbyist', 'aficionado', 'collector', 'passionate', 'dedicated'];
  result.hasEnthusiastContent = enthusiastPatterns.some(p => combinedText.includes(p));

  // Comparison / research behavior
  const comparisonPatterns = ['compare', 'versus', 'vs.', 'alternative', 'difference between', 'pros and cons'];
  result.hasComparisonContent = comparisonPatterns.some(p => combinedText.includes(p));

  // B2B signals
  const b2bPatterns = ['business', 'b2b', 'enterprise', 'company', 'fleet', 'commercial', 'corporate', 'wholesale'];
  result.hasB2BSignals = b2bPatterns.some(p => combinedText.includes(p));

  // Detect category type from content
  const categoryPatterns: Record<string, string[]> = {
    'automotive': ['vehicle', 'car', 'truck', 'auto', 'automotive', 'tire', 'wheel', 'brake'],
    'home_services': ['home', 'house', 'property', 'roof', 'hvac', 'plumbing', 'electrical'],
    'professional_services': ['consulting', 'advisory', 'agency', 'professional', 'service provider'],
    'retail': ['shop', 'store', 'retail', 'ecommerce', 'buy', 'purchase', 'order'],
    'healthcare': ['health', 'medical', 'clinic', 'doctor', 'patient', 'wellness'],
  };

  for (const [category, patterns] of Object.entries(categoryPatterns)) {
    if (patterns.some(p => combinedText.includes(p))) {
      result.categoryType = category;
      break;
    }
  }

  // Determine urgency type
  const urgencySignals = result.hasLocalUrgency ? 1 : 0;
  const researchSignals = (result.hasBuyingGuides ? 1 : 0) + (result.hasComparisonContent ? 1 : 0);

  if (urgencySignals > 0 && researchSignals > 0) {
    result.urgencyType = 'mixed';
  } else if (urgencySignals > 0) {
    result.urgencyType = 'clear';
  } else {
    result.urgencyType = 'none';
  }

  // Count total strong signals
  const signalChecks = [
    result.hasDIYSignals,
    result.hasBuyingGuides,
    result.hasInstalledServices,
    result.hasLocalUrgency,
    result.hasHighTicketServices,
    result.hasProfessionalInstallation,
    result.hasEnthusiastContent,
    result.hasComparisonContent,
  ];
  result.signalCount = signalChecks.filter(Boolean).length;

  return result;
}

// ============================================================================
// Demographic Inference Rules
// ============================================================================

/**
 * Check if demographic inference is allowed for a segment
 *
 * Rules:
 * - A behavioral segment must already exist
 * - At least two strong behavioral signals must be present
 *
 * Disallowed sources:
 * - Brand name alone
 * - Generic navigation
 * - Assumptions without behavioral grounding
 */
export function canInferDemographicsForSegment(
  segment: AudienceSegment,
  behavioralSignals: BehavioralSignalSet
): { allowed: boolean; reason: string } {
  // Must have a segment with actual behavioral data
  if (!segment.id || !segment.name) {
    return { allowed: false, reason: 'No valid segment provided' };
  }

  // Must have behavioral drivers or other behavioral data
  const hasBehavioralData =
    (segment.behavioralDrivers?.length ?? 0) > 0 ||
    (segment.jobsToBeDone?.length ?? 0) > 0 ||
    (segment.keyPains?.length ?? 0) > 0;

  if (!hasBehavioralData) {
    return { allowed: false, reason: 'Segment lacks behavioral data (jobs, pains, or drivers)' };
  }

  // Must have at least 2 strong behavioral signals
  if (behavioralSignals.signalCount < 2) {
    return {
      allowed: false,
      reason: `Insufficient behavioral signals (${behavioralSignals.signalCount}/2 required)`,
    };
  }

  return { allowed: true, reason: 'Segment meets behavioral requirements' };
}

/**
 * Safe demographic inference examples:
 * - DIY + buying guides → enthusiast / hobbyist
 * - Installed services + local urgency → adult vehicle/home owners
 * - High-ticket services → mid to upper income (inferred)
 *
 * Unsafe inferences (do NOT do):
 * - Exact ages
 * - Household size
 * - Parental status
 * - Explicit gender targeting
 */
export function inferDemographicsForSegment(
  segment: AudienceSegment,
  signals: AudienceSignals
): DemographicInferenceResult {
  // Extract behavioral signals
  const behavioralSignals = extractBehavioralSignals(segment, signals);

  // Check if inference is allowed
  const { allowed, reason } = canInferDemographicsForSegment(segment, behavioralSignals);

  if (!allowed) {
    return {
      overlay: null,
      rejected: true,
      rejectReason: reason,
    };
  }

  // Build inferred attributes based on behavioral signals
  const inferredAttributes: InferredAttributes = {};
  const evidence: DemographicEvidence[] = [];
  let confidenceAdjustment = 0;

  // DIY + buying guides → enthusiast / hobbyist lifestyle
  if (behavioralSignals.hasDIYSignals && behavioralSignals.hasBuyingGuides) {
    inferredAttributes.lifestyleContext = 'Hands-on enthusiast / hobbyist (inferred)';
    evidence.push({
      type: 'behavior_pattern',
      snippet: 'DIY content and buying guides indicate hands-on research behavior',
    });
  }

  // Installed services + local urgency → property owners
  if (behavioralSignals.hasInstalledServices && behavioralSignals.hasLocalUrgency) {
    if (behavioralSignals.categoryType === 'automotive') {
      inferredAttributes.householdType = 'Vehicle-owning households (inferred)';
      evidence.push({
        type: 'category',
        snippet: 'Local service urgency combined with automotive category indicates vehicle ownership',
      });
    } else if (behavioralSignals.categoryType === 'home_services') {
      inferredAttributes.householdType = 'Property-owning households (inferred)';
      evidence.push({
        type: 'category',
        snippet: 'Local service urgency combined with home services indicates property ownership',
      });
    }
  }

  // High-ticket services → income tier inference
  if (behavioralSignals.hasHighTicketServices) {
    inferredAttributes.incomeTier = 'Mid to upper income (inferred)';
    evidence.push({
      type: 'category',
      snippet: 'High-ticket service focus suggests mid to upper income purchasing power',
    });
  }

  // Professional installation + enthusiast → age range (broad only)
  if (behavioralSignals.hasProfessionalInstallation && behavioralSignals.hasEnthusiastContent) {
    inferredAttributes.ageRange = '25-54 (inferred)';
    evidence.push({
      type: 'behavior_pattern',
      snippet: 'Professional service preference with enthusiast behavior typical of established adults',
    });
  }

  // DIY + enthusiast content → hobbyist lifestyle
  if (behavioralSignals.hasDIYSignals && behavioralSignals.hasEnthusiastContent) {
    if (!inferredAttributes.lifestyleContext) {
      inferredAttributes.lifestyleContext = 'Active hobbyist / DIY enthusiast (inferred)';
      evidence.push({
        type: 'behavior_pattern',
        snippet: 'DIY signals combined with enthusiast content indicate active hobbyist behavior',
      });
    }
  }

  // Check if we generated any attributes
  const hasAttributes = Object.values(inferredAttributes).some(Boolean);
  if (!hasAttributes) {
    return {
      overlay: null,
      rejected: true,
      rejectReason: 'No safe demographic inferences could be made from available signals',
    };
  }

  // Calculate confidence score
  let confidence = BASE_DEMOGRAPHIC_CONFIDENCE;

  // +5 if ≥3 strong behavioral signals align
  if (behavioralSignals.signalCount >= 3) {
    confidence += 5;
    confidenceAdjustment += 5;
  }

  // -10 if evidence relies on industry norms
  const hasIndustryNorm = evidence.some(e => e.type === 'industry_norm');
  if (hasIndustryNorm) {
    confidence -= 10;
    confidenceAdjustment -= 10;
  }

  // -10 if urgencyType is MIXED
  if (behavioralSignals.urgencyType === 'mixed') {
    confidence -= 10;
    confidenceAdjustment -= 10;
  }

  // Cap at MAX and check MIN
  confidence = Math.min(confidence, MAX_DEMOGRAPHIC_CONFIDENCE);

  // Discard if below minimum
  if (confidence < MIN_DEMOGRAPHIC_CONFIDENCE) {
    return {
      overlay: null,
      rejected: true,
      rejectReason: `Confidence too low (${confidence}% < ${MIN_DEMOGRAPHIC_CONFIDENCE}% threshold)`,
      rawConfidence: confidence,
    };
  }

  // Build rationale
  const rationaleParts: string[] = [];
  if (inferredAttributes.lifestyleContext) {
    rationaleParts.push(`Lifestyle inferred from behavioral patterns`);
  }
  if (inferredAttributes.householdType) {
    rationaleParts.push(`household type inferred from category and urgency signals`);
  }
  if (inferredAttributes.incomeTier) {
    rationaleParts.push(`income tier inferred from service tier focus`);
  }
  if (inferredAttributes.ageRange) {
    rationaleParts.push(`age range inferred from professional preferences`);
  }

  const rationale = `Demographic overlay derived from ${behavioralSignals.signalCount} behavioral signals. ${rationaleParts.join('; ')}.`;

  const overlay: DemographicOverlay = {
    appliesToSegmentKey: segment.id,
    inferredAttributes,
    confidence,
    rationale,
    evidence,
  };

  return {
    overlay,
    rejected: false,
    rawConfidence: confidence,
  };
}

// ============================================================================
// Batch Processing
// ============================================================================

/**
 * Generate demographic overlays for all segments in an audience model
 *
 * Constraints:
 * - Max 1 overlay per segment
 * - Overlays are optional (segments without strong signals get none)
 * - Returns only valid overlays (confidence >= 40, evidence-backed)
 */
export function generateDemographicOverlays(
  segments: AudienceSegment[],
  signals: AudienceSignals
): {
  overlays: DemographicOverlay[];
  rejections: Array<{ segmentId: string; reason: string }>;
} {
  const overlays: DemographicOverlay[] = [];
  const rejections: Array<{ segmentId: string; reason: string }> = [];

  for (const segment of segments) {
    const result = inferDemographicsForSegment(segment, signals);

    if (result.overlay) {
      overlays.push(result.overlay);
    } else if (result.rejected) {
      rejections.push({
        segmentId: segment.id,
        reason: result.rejectReason || 'Unknown reason',
      });
    }
  }

  console.log('[DemographicOverlays] Generated overlays:', {
    segmentCount: segments.length,
    overlayCount: overlays.length,
    rejectionCount: rejections.length,
    avgConfidence: overlays.length > 0
      ? Math.round(overlays.reduce((sum, o) => sum + o.confidence, 0) / overlays.length)
      : 0,
  });

  return { overlays, rejections };
}

// ============================================================================
// Validation & Formatting
// ============================================================================

/**
 * Validate a demographic overlay meets all constraints
 */
export function validateDemographicOverlay(overlay: unknown): {
  valid: boolean;
  errors: string[];
  overlay: DemographicOverlay | null;
} {
  const result = DemographicOverlay.safeParse(overlay);

  if (!result.success) {
    return {
      valid: false,
      errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
      overlay: null,
    };
  }

  const validated = result.data;
  const errors: string[] = [];

  // Check confidence bounds
  if (validated.confidence > MAX_DEMOGRAPHIC_CONFIDENCE) {
    errors.push(`Confidence ${validated.confidence}% exceeds maximum ${MAX_DEMOGRAPHIC_CONFIDENCE}%`);
  }
  if (validated.confidence < MIN_DEMOGRAPHIC_CONFIDENCE) {
    errors.push(`Confidence ${validated.confidence}% below minimum ${MIN_DEMOGRAPHIC_CONFIDENCE}%`);
  }

  // Check attributes end with "(inferred)"
  const attrs = validated.inferredAttributes;
  const attrChecks = [
    ['ageRange', attrs.ageRange],
    ['incomeTier', attrs.incomeTier],
    ['householdType', attrs.householdType],
    ['genderSkew', attrs.genderSkew],
    ['lifestyleContext', attrs.lifestyleContext],
  ] as const;

  for (const [name, value] of attrChecks) {
    if (value && !value.includes('(inferred)')) {
      errors.push(`${name} must include "(inferred)" suffix`);
    }
  }

  // Check evidence exists
  if (!validated.evidence || validated.evidence.length === 0) {
    errors.push('At least one evidence item required');
  }

  return {
    valid: errors.length === 0,
    errors,
    overlay: errors.length === 0 ? validated : null,
  };
}

/**
 * Format demographic overlay for display
 */
export function formatDemographicOverlayForDisplay(overlay: DemographicOverlay): {
  segmentKey: string;
  attributes: Array<{ label: string; value: string }>;
  confidenceLabel: string;
  confidenceClass: 'low' | 'medium';
  rationale: string;
  evidenceCount: number;
} {
  const attrs = overlay.inferredAttributes;
  const attributes: Array<{ label: string; value: string }> = [];

  if (attrs.ageRange) {
    attributes.push({ label: 'Age Range', value: attrs.ageRange });
  }
  if (attrs.incomeTier) {
    attributes.push({ label: 'Income Tier', value: attrs.incomeTier });
  }
  if (attrs.householdType) {
    attributes.push({ label: 'Household Type', value: attrs.householdType });
  }
  if (attrs.genderSkew) {
    attributes.push({ label: 'Gender Skew', value: attrs.genderSkew });
  }
  if (attrs.lifestyleContext) {
    attributes.push({ label: 'Lifestyle', value: attrs.lifestyleContext });
  }

  return {
    segmentKey: overlay.appliesToSegmentKey,
    attributes,
    confidenceLabel: `${overlay.confidence}% confidence`,
    confidenceClass: overlay.confidence >= 55 ? 'medium' : 'low',
    rationale: overlay.rationale,
    evidenceCount: overlay.evidence.length,
  };
}
