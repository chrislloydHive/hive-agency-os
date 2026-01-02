// lib/competition-v4/overlapScoring.ts
// Competition V4 - Trait-Based Overlap Scoring Model
//
// Key principles:
// 1. NO hardcoded brand names - all decisions based on traits
// 2. Intent-match inclusion prevents exclusion when competitive intent is high
// 3. Confidence reflects signal completeness, not arbitrary boosts
// 4. Classification: primary | contextual | alternative | excluded

import type {
  CompetitiveModality,
  CompetitorClassification,
} from '@/lib/contextGraph/domains/competitive';

// ============================================================================
// Types
// ============================================================================

/** Normalized overlap scores (0-1 scale) */
export interface NormalizedOverlapScores {
  /** How much do installation/service capabilities overlap? */
  installationCapabilityOverlap: number;
  /** How much do geographic service areas overlap? */
  geographicPresenceOverlap: number;
  /** How much do product categories overlap? */
  productCategoryOverlap: number;
  /** Can the competitor substitute "done-for-me" services? */
  serviceSubstitutionOverlap: number;
  /** How similar is brand trust/recognition level? */
  brandTrustOverlap: number;
  /** How similar is market reach (local/regional/national)? */
  marketReachOverlap: number;
  /** How similar is price positioning? */
  pricePositioningOverlap: number;
}

/** Competitor traits for scoring */
export interface CompetitorTraits {
  /** Competitor name */
  name: string;
  /** Competitor domain */
  domain: string;
  /** Does competitor offer installation/service capability? */
  hasServiceCapability: boolean;
  /** Confidence in service capability signal (0-1) */
  serviceCapabilityConfidence: number;
  /** Geographic reach: local | regional | national | unknown */
  geographicReach: 'local' | 'regional' | 'national' | 'unknown';
  /** Service areas if known (cities, regions) */
  serviceAreas: string[];
  /** Product categories offered */
  productCategories: string[];
  /** Service categories offered */
  serviceCategories: string[];
  /** Estimated brand recognition level (0-1) */
  brandRecognition: number;
  /** Price positioning */
  pricePositioning: 'budget' | 'mid' | 'premium' | 'unknown';
  /** Is this a retail business with products? */
  isRetailer: boolean;
  /** Is this primarily a service provider? */
  isServiceProvider: boolean;
  /** Signal completeness: how many traits are known vs unknown (0-1) */
  signalCompleteness: number;
}

/** Subject business profile */
export interface SubjectProfile {
  /** Subject company name */
  name: string;
  /** Subject's competitive modality */
  modality: CompetitiveModality;
  /** Subject's primary product categories */
  productCategories: string[];
  /** Subject's service categories */
  serviceCategories: string[];
  /** Subject offers installation/services? */
  hasServiceCapability: boolean;
  /** Subject's geographic scope */
  geographicScope: 'local' | 'regional' | 'national';
  /** Subject's service areas if local/regional */
  serviceAreas: string[];
  /** Subject's price positioning */
  pricePositioning: 'budget' | 'mid' | 'premium';
  /** Subject's estimated brand recognition (0-1) */
  brandRecognition: number;
  /** How important is service/installation to subject's business (0-1) */
  serviceEmphasis: number;
  /** How important is product retail to subject's business (0-1) */
  productEmphasis: number;
}

/** Dimension weights for scoring */
export interface OverlapWeights {
  installationCapabilityOverlap: number;
  geographicPresenceOverlap: number;
  productCategoryOverlap: number;
  serviceSubstitutionOverlap: number;
  brandTrustOverlap: number;
  marketReachOverlap: number;
  pricePositioningOverlap: number;
}

/** Extended classification with more granularity */
export type ExtendedClassification = 'primary' | 'contextual' | 'alternative' | 'excluded';

/** Complete scoring result */
export interface ScoringResult {
  /** Normalized dimension scores (0-1) */
  dimensionScores: NormalizedOverlapScores;
  /** Weighted overall score (0-100) */
  overallScore: number;
  /** Classification based on score and intent */
  classification: ExtendedClassification;
  /** Simplified classification for backward compatibility */
  legacyClassification: CompetitorClassification;
  /** Confidence in the scoring (0-100) based on signal completeness */
  confidence: number;
  /** Was exclusion prevented due to high intent match? */
  exclusionPrevented: boolean;
  /** Reason for inclusion if exclusion was prevented */
  inclusionReason: string | null;
  /** Which trait rules affected the scoring */
  traitRulesApplied: string[];
  /** What signals were missing that reduced confidence */
  missingSignals: string[];
  /** Why this competitor matters (for UI explanation) */
  whyThisMatters: string;
}

// ============================================================================
// Weight Profiles by Modality
// ============================================================================

/**
 * Get normalized weights for each modality.
 * Weights sum to 1.0 for proper weighted average.
 */
export function getWeightsForModality(modality: CompetitiveModality): OverlapWeights {
  switch (modality) {
    case 'Retail+Installation':
      // Hybrid: balance service capability and product overlap
      return {
        installationCapabilityOverlap: 0.22,
        geographicPresenceOverlap: 0.15,
        productCategoryOverlap: 0.15,
        serviceSubstitutionOverlap: 0.18,
        brandTrustOverlap: 0.12,
        marketReachOverlap: 0.10,
        pricePositioningOverlap: 0.08,
      };

    case 'InstallationOnly':
      // Service-focused: geographic and service substitution key
      return {
        installationCapabilityOverlap: 0.28,
        geographicPresenceOverlap: 0.22,
        productCategoryOverlap: 0.05,
        serviceSubstitutionOverlap: 0.22,
        brandTrustOverlap: 0.10,
        marketReachOverlap: 0.08,
        pricePositioningOverlap: 0.05,
      };

    case 'RetailWithInstallAddon':
      // Retail primary, service secondary
      return {
        installationCapabilityOverlap: 0.15,
        geographicPresenceOverlap: 0.10,
        productCategoryOverlap: 0.25,
        serviceSubstitutionOverlap: 0.12,
        brandTrustOverlap: 0.15,
        marketReachOverlap: 0.13,
        pricePositioningOverlap: 0.10,
      };

    case 'ProductOnly':
      // Pure retail: product and brand matter most
      return {
        installationCapabilityOverlap: 0.05,
        geographicPresenceOverlap: 0.05,
        productCategoryOverlap: 0.30,
        serviceSubstitutionOverlap: 0.05,
        brandTrustOverlap: 0.22,
        marketReachOverlap: 0.18,
        pricePositioningOverlap: 0.15,
      };

    case 'InternalAlternative':
      // DIY alternatives: service substitution matters
      return {
        installationCapabilityOverlap: 0.10,
        geographicPresenceOverlap: 0.05,
        productCategoryOverlap: 0.20,
        serviceSubstitutionOverlap: 0.28,
        brandTrustOverlap: 0.12,
        marketReachOverlap: 0.10,
        pricePositioningOverlap: 0.15,
      };

    default:
      // Balanced default
      return {
        installationCapabilityOverlap: 0.15,
        geographicPresenceOverlap: 0.15,
        productCategoryOverlap: 0.15,
        serviceSubstitutionOverlap: 0.15,
        brandTrustOverlap: 0.15,
        marketReachOverlap: 0.13,
        pricePositioningOverlap: 0.12,
      };
  }
}

// ============================================================================
// Dimension Scoring Functions (Normalized 0-1)
// ============================================================================

/**
 * Score installation/service capability overlap (0-1)
 */
function scoreServiceCapabilityOverlap(
  competitor: CompetitorTraits,
  subject: SubjectProfile
): number {
  // If subject doesn't emphasize service, this dimension is less relevant
  if (subject.serviceEmphasis < 0.2) {
    // Subject doesn't care much about service
    // Penalize competitors with service (they're not substitutes)
    return competitor.hasServiceCapability ? 0.3 : 0.5;
  }

  // Subject emphasizes service
  if (competitor.hasServiceCapability) {
    // Both have service capability - high overlap
    // Scale by confidence in the signal
    return 0.7 + (0.3 * competitor.serviceCapabilityConfidence);
  }

  // Competitor doesn't have service capability
  if (competitor.isRetailer && subject.modality === 'Retail+Installation') {
    // Retailer might have service via partners - moderate overlap
    return 0.4;
  }

  return 0.15;
}

/**
 * Score geographic presence overlap (0-1)
 */
function scoreGeographicOverlap(
  competitor: CompetitorTraits,
  subject: SubjectProfile
): number {
  // If competitor reach is unknown, apply neutral score with confidence penalty
  if (competitor.geographicReach === 'unknown') {
    return 0.5; // Neutral - will be penalized via confidence
  }

  // National subject competes with everyone
  if (subject.geographicScope === 'national') {
    return competitor.geographicReach === 'national' ? 0.9 :
           competitor.geographicReach === 'regional' ? 0.6 : 0.4;
  }

  // Regional subject
  if (subject.geographicScope === 'regional') {
    if (competitor.geographicReach === 'national') return 0.85;
    if (competitor.geographicReach === 'regional') {
      // Check service area overlap
      const areaOverlap = calculateAreaOverlap(competitor.serviceAreas, subject.serviceAreas);
      return 0.5 + (0.4 * areaOverlap);
    }
    if (competitor.geographicReach === 'local') return 0.6;
    return 0.5;
  }

  // Local subject
  if (competitor.geographicReach === 'local') {
    const areaOverlap = calculateAreaOverlap(competitor.serviceAreas, subject.serviceAreas);
    return 0.5 + (0.5 * areaOverlap);
  }
  if (competitor.geographicReach === 'national') return 0.75;
  if (competitor.geographicReach === 'regional') return 0.5;
  return 0.4;
}

/**
 * Calculate overlap between two sets of service areas
 */
function calculateAreaOverlap(areas1: string[], areas2: string[]): number {
  if (areas1.length === 0 || areas2.length === 0) return 0.5; // Unknown

  const normalized1 = new Set(areas1.map(a => a.toLowerCase().trim()));
  const normalized2 = new Set(areas2.map(a => a.toLowerCase().trim()));

  let matches = 0;
  for (const area of normalized1) {
    if (normalized2.has(area)) matches++;
    // Fuzzy match - check if one contains the other
    for (const area2 of normalized2) {
      if (area.includes(area2) || area2.includes(area)) {
        matches += 0.5;
      }
    }
  }

  const minSize = Math.min(normalized1.size, normalized2.size);
  return Math.min(1, matches / minSize);
}

/**
 * Score product category overlap (0-1)
 */
function scoreProductCategoryOverlap(
  competitor: CompetitorTraits,
  subject: SubjectProfile
): number {
  if (subject.productCategories.length === 0) return 0.5;
  if (competitor.productCategories.length === 0) return 0.3;

  const subjectProducts = new Set(subject.productCategories.map(p => p.toLowerCase()));
  const competitorProducts = competitor.productCategories.map(p => p.toLowerCase());

  // Count exact and fuzzy matches
  let exactMatches = 0;
  let fuzzyMatches = 0;

  for (const cp of competitorProducts) {
    if (subjectProducts.has(cp)) {
      exactMatches++;
    } else {
      // Fuzzy match - check word overlap
      for (const sp of subjectProducts) {
        const cpWords = cp.split(/\s+/);
        const spWords = sp.split(/\s+/);
        const commonWords = cpWords.filter(w => spWords.includes(w));
        if (commonWords.length > 0) {
          fuzzyMatches += 0.5;
          break;
        }
      }
    }
  }

  const totalMatches = exactMatches + (fuzzyMatches * 0.5);
  const overlapRatio = totalMatches / subject.productCategories.length;

  return Math.min(1, overlapRatio);
}

/**
 * Score service substitution likelihood (0-1)
 */
function scoreServiceSubstitution(
  competitor: CompetitorTraits,
  subject: SubjectProfile
): number {
  // If subject doesn't provide services, this dimension is less relevant
  if (subject.serviceEmphasis < 0.2 || subject.serviceCategories.length === 0) {
    return 0.5;
  }

  // Check service category overlap
  const subjectServices = new Set(subject.serviceCategories.map(s => s.toLowerCase()));
  const competitorServices = competitor.serviceCategories.map(s => s.toLowerCase());

  let matches = 0;
  for (const cs of competitorServices) {
    if (subjectServices.has(cs)) {
      matches++;
    } else {
      // Fuzzy match
      for (const ss of subjectServices) {
        if (cs.includes(ss) || ss.includes(cs)) {
          matches += 0.5;
          break;
        }
      }
    }
  }

  const overlapRatio = subjectServices.size > 0 ? matches / subjectServices.size : 0;
  let score = overlapRatio * 0.7;

  // Boost if competitor has service capability and subject emphasizes service
  if (competitor.hasServiceCapability && subject.serviceEmphasis > 0.5) {
    score += 0.2;
  }

  // Boost for retail+service if competitor is also hybrid
  if (subject.modality === 'Retail+Installation' &&
      competitor.isRetailer &&
      competitor.hasServiceCapability) {
    score += 0.15;
  }

  return Math.min(1, score);
}

/**
 * Score brand trust overlap (0-1)
 */
function scoreBrandTrustOverlap(
  competitor: CompetitorTraits,
  subject: SubjectProfile
): number {
  // Score based on how close brand recognition levels are
  const diff = Math.abs(competitor.brandRecognition - subject.brandRecognition);

  // If competitor has higher brand recognition, they're a threat
  if (competitor.brandRecognition >= subject.brandRecognition) {
    return 0.6 + (0.4 * competitor.brandRecognition);
  }

  // Competitor has lower brand recognition
  return 0.5 - (diff * 0.3);
}

/**
 * Score market reach overlap (0-1)
 */
function scoreMarketReachOverlap(
  competitor: CompetitorTraits,
  subject: SubjectProfile
): number {
  const reachValues = { local: 1, regional: 2, national: 3, unknown: 2 };
  const scopeValues = { local: 1, regional: 2, national: 3 };

  const competitorReach = reachValues[competitor.geographicReach];
  const subjectScope = scopeValues[subject.geographicScope];

  // National reach is always threatening
  if (competitor.geographicReach === 'national') return 0.9;

  // Match or greater reach
  if (competitorReach >= subjectScope) {
    return 0.7 + (0.1 * competitorReach / 3);
  }

  // Lesser reach
  return 0.3 + (0.3 * competitorReach / subjectScope);
}

/**
 * Score price positioning overlap (0-1)
 */
function scorePricePositioningOverlap(
  competitor: CompetitorTraits,
  subject: SubjectProfile
): number {
  if (competitor.pricePositioning === 'unknown') return 0.5;

  if (competitor.pricePositioning === subject.pricePositioning) return 0.9;

  const positions = ['budget', 'mid', 'premium'] as const;
  const subjectIdx = positions.indexOf(subject.pricePositioning);
  const competitorIdx = positions.indexOf(competitor.pricePositioning);
  const distance = Math.abs(subjectIdx - competitorIdx);

  if (distance === 1) return 0.6;
  return 0.3;
}

// ============================================================================
// Trait-Based Intent Rules (NO hardcoded brands)
// ============================================================================

interface IntentRule {
  name: string;
  check: (competitor: CompetitorTraits, subject: SubjectProfile) => boolean;
  intentScore: number; // 0-1, how strongly this rule indicates competitive intent
  explanation: (competitor: CompetitorTraits, subject: SubjectProfile) => string;
}

const INTENT_RULES: IntentRule[] = [
  {
    name: 'national-retailer-with-service-in-hybrid-market',
    check: (c, s) =>
      s.modality === 'Retail+Installation' &&
      c.geographicReach === 'national' &&
      c.isRetailer &&
      c.hasServiceCapability,
    intentScore: 0.85,
    explanation: (c) =>
      `${c.name} is a national retailer offering services, competing directly for hybrid retail+service customers`,
  },
  {
    name: 'local-service-provider-in-service-market',
    check: (c, s) =>
      (s.modality === 'Retail+Installation' || s.modality === 'InstallationOnly') &&
      c.geographicReach === 'local' &&
      c.hasServiceCapability,
    intentScore: 0.80,
    explanation: (c) =>
      `${c.name} is a local service provider directly competing for installation/service work`,
  },
  {
    name: 'national-reach-in-any-retail',
    check: (c, s) =>
      (s.modality !== 'InstallationOnly') &&
      c.geographicReach === 'national' &&
      c.isRetailer,
    intentScore: 0.70,
    explanation: (c) =>
      `${c.name} has national retail presence competing for product sales`,
  },
  {
    name: 'service-provider-with-product-overlap',
    check: (c, s) =>
      c.hasServiceCapability &&
      s.hasServiceCapability &&
      c.productCategories.length > 0 &&
      s.productCategories.length > 0 &&
      hasAnyOverlap(c.productCategories, s.productCategories),
    intentScore: 0.75,
    explanation: (c, s) =>
      `${c.name} offers both services and overlapping products, competing on multiple fronts`,
  },
  {
    name: 'same-geographic-same-service',
    check: (c, s) =>
      c.hasServiceCapability &&
      s.hasServiceCapability &&
      (c.geographicReach === s.geographicScope || c.geographicReach === 'national') &&
      hasAnyOverlap(c.serviceCategories, s.serviceCategories),
    intentScore: 0.85,
    explanation: (c) =>
      `${c.name} offers similar services in the same geographic area`,
  },
];

function hasAnyOverlap(arr1: string[], arr2: string[]): boolean {
  const set1 = new Set(arr1.map(s => s.toLowerCase()));
  return arr2.some(s => set1.has(s.toLowerCase()));
}

/**
 * Check intent rules and return the highest matching intent score
 */
function evaluateIntentRules(
  competitor: CompetitorTraits,
  subject: SubjectProfile
): { maxIntent: number; matchedRules: string[]; explanations: string[] } {
  let maxIntent = 0;
  const matchedRules: string[] = [];
  const explanations: string[] = [];

  for (const rule of INTENT_RULES) {
    if (rule.check(competitor, subject)) {
      if (rule.intentScore > maxIntent) {
        maxIntent = rule.intentScore;
      }
      matchedRules.push(rule.name);
      explanations.push(rule.explanation(competitor, subject));
    }
  }

  return { maxIntent, matchedRules, explanations };
}

// ============================================================================
// Confidence Calculation
// ============================================================================

/**
 * Calculate confidence based on signal completeness
 */
function calculateConfidence(competitor: CompetitorTraits): { confidence: number; missingSignals: string[] } {
  const missingSignals: string[] = [];
  let signalCount = 0;
  let knownSignals = 0;

  // Check each signal
  const signals: Array<{ name: string; isKnown: boolean }> = [
    { name: 'service_capability', isKnown: competitor.serviceCapabilityConfidence > 0.5 },
    { name: 'geographic_reach', isKnown: competitor.geographicReach !== 'unknown' },
    { name: 'product_categories', isKnown: competitor.productCategories.length > 0 },
    { name: 'service_categories', isKnown: competitor.serviceCategories.length > 0 },
    { name: 'price_positioning', isKnown: competitor.pricePositioning !== 'unknown' },
    { name: 'brand_recognition', isKnown: competitor.brandRecognition > 0 },
    { name: 'business_type', isKnown: competitor.isRetailer || competitor.isServiceProvider },
  ];

  for (const signal of signals) {
    signalCount++;
    if (signal.isKnown) {
      knownSignals++;
    } else {
      missingSignals.push(signal.name);
    }
  }

  // Also factor in the competitor's own signal completeness
  const baseConfidence = (knownSignals / signalCount) * 100;
  const adjustedConfidence = baseConfidence * (0.5 + 0.5 * competitor.signalCompleteness);

  return {
    confidence: Math.round(Math.min(100, Math.max(10, adjustedConfidence))),
    missingSignals,
  };
}

// ============================================================================
// Classification Logic
// ============================================================================

/**
 * Determine classification based on score and intent
 * Uses intent to prevent exclusion, not to boost scores
 */
function classifyCompetitor(
  overallScore: number,
  intentResult: { maxIntent: number; matchedRules: string[]; explanations: string[] },
  confidence: number,
  thresholds: { primary: number; contextual: number; alternative: number }
): { classification: ExtendedClassification; exclusionPrevented: boolean; reason: string | null } {
  // High score = primary
  if (overallScore >= thresholds.primary) {
    return { classification: 'primary', exclusionPrevented: false, reason: null };
  }

  // Medium-high score = contextual
  if (overallScore >= thresholds.contextual) {
    return { classification: 'contextual', exclusionPrevented: false, reason: null };
  }

  // Low score but high intent = prevent exclusion
  // Intent score of 0.7+ can prevent exclusion if score is at least 25
  if (intentResult.maxIntent >= 0.7 && overallScore >= 25) {
    const reason = intentResult.explanations[0] || 'High competitive intent detected';
    // Promote to contextual (not primary - score still matters)
    return {
      classification: 'contextual',
      exclusionPrevented: true,
      reason,
    };
  }

  // Intent score of 0.8+ can prevent exclusion even with lower score
  if (intentResult.maxIntent >= 0.8 && overallScore >= 15) {
    const reason = intentResult.explanations[0] || 'Very high competitive intent detected';
    return {
      classification: 'alternative',
      exclusionPrevented: true,
      reason,
    };
  }

  // Medium-low score = alternative
  if (overallScore >= thresholds.alternative) {
    return { classification: 'alternative', exclusionPrevented: false, reason: null };
  }

  // Very low confidence + low score = alternative instead of excluded
  if (confidence < 40 && overallScore >= 15) {
    return {
      classification: 'alternative',
      exclusionPrevented: false,
      reason: 'Low confidence - may warrant review',
    };
  }

  // Low score and confidence = excluded
  return { classification: 'excluded', exclusionPrevented: false, reason: null };
}

// ============================================================================
// Main Scoring Function
// ============================================================================

export interface ScoringOptions {
  /** Primary threshold (default 55) */
  primaryThreshold?: number;
  /** Contextual threshold (default 35) */
  contextualThreshold?: number;
  /** Alternative threshold (default 20) */
  alternativeThreshold?: number;
}

/**
 * Calculate trait-based overlap score for a competitor
 */
export function calculateOverlapScore(
  competitor: CompetitorTraits,
  subject: SubjectProfile,
  options: ScoringOptions = {}
): ScoringResult {
  const thresholds = {
    primary: options.primaryThreshold ?? 55,
    contextual: options.contextualThreshold ?? 35,
    alternative: options.alternativeThreshold ?? 20,
  };

  // Calculate normalized dimension scores (0-1)
  const dimensionScores: NormalizedOverlapScores = {
    installationCapabilityOverlap: scoreServiceCapabilityOverlap(competitor, subject),
    geographicPresenceOverlap: scoreGeographicOverlap(competitor, subject),
    productCategoryOverlap: scoreProductCategoryOverlap(competitor, subject),
    serviceSubstitutionOverlap: scoreServiceSubstitution(competitor, subject),
    brandTrustOverlap: scoreBrandTrustOverlap(competitor, subject),
    marketReachOverlap: scoreMarketReachOverlap(competitor, subject),
    pricePositioningOverlap: scorePricePositioningOverlap(competitor, subject),
  };

  // Get weights for subject's modality
  const weights = getWeightsForModality(subject.modality);

  // Calculate weighted overall score (0-100)
  const overallScore = Math.round(
    (dimensionScores.installationCapabilityOverlap * weights.installationCapabilityOverlap +
      dimensionScores.geographicPresenceOverlap * weights.geographicPresenceOverlap +
      dimensionScores.productCategoryOverlap * weights.productCategoryOverlap +
      dimensionScores.serviceSubstitutionOverlap * weights.serviceSubstitutionOverlap +
      dimensionScores.brandTrustOverlap * weights.brandTrustOverlap +
      dimensionScores.marketReachOverlap * weights.marketReachOverlap +
      dimensionScores.pricePositioningOverlap * weights.pricePositioningOverlap) * 100
  );

  // Evaluate intent rules
  const intentResult = evaluateIntentRules(competitor, subject);

  // Calculate confidence
  const { confidence, missingSignals } = calculateConfidence(competitor);

  // Determine classification (with intent-based exclusion prevention)
  const classificationResult = classifyCompetitor(
    overallScore,
    intentResult,
    confidence,
    thresholds
  );

  // Map to legacy classification for backward compatibility
  const legacyClassification: CompetitorClassification =
    classificationResult.classification === 'primary' || classificationResult.classification === 'contextual'
      ? classificationResult.classification
      : 'contextual'; // Map alternative -> contextual for legacy

  // Generate explanation
  const whyThisMatters = generateExplanation(
    competitor,
    subject,
    dimensionScores,
    classificationResult.classification,
    intentResult.explanations
  );

  return {
    dimensionScores,
    overallScore,
    classification: classificationResult.classification,
    legacyClassification,
    confidence,
    exclusionPrevented: classificationResult.exclusionPrevented,
    inclusionReason: classificationResult.reason,
    traitRulesApplied: intentResult.matchedRules,
    missingSignals,
    whyThisMatters,
  };
}

/**
 * Generate a human-readable explanation of why this competitor matters
 */
function generateExplanation(
  competitor: CompetitorTraits,
  subject: SubjectProfile,
  scores: NormalizedOverlapScores,
  classification: ExtendedClassification,
  intentExplanations: string[]
): string {
  const parts: string[] = [];

  // Use intent explanation if available
  if (intentExplanations.length > 0) {
    parts.push(intentExplanations[0]);
  } else {
    // Generate based on highest scoring dimensions
    const dimensions = [
      { name: 'service capability', score: scores.installationCapabilityOverlap },
      { name: 'geographic presence', score: scores.geographicPresenceOverlap },
      { name: 'product category', score: scores.productCategoryOverlap },
      { name: 'service substitution', score: scores.serviceSubstitutionOverlap },
      { name: 'brand trust', score: scores.brandTrustOverlap },
    ].sort((a, b) => b.score - a.score);

    const top = dimensions[0];
    if (top.score >= 0.7) {
      parts.push(`High ${top.name} overlap with ${subject.name}`);
    } else if (top.score >= 0.5) {
      parts.push(`Moderate ${top.name} overlap`);
    }
  }

  // Add classification context
  if (classification === 'primary') {
    parts.push('Direct competitive threat');
  } else if (classification === 'contextual') {
    parts.push('Relevant comparison point');
  } else if (classification === 'alternative') {
    parts.push('Secondary consideration');
  }

  return parts.join('. ') || 'Competitor identified through analysis';
}

// ============================================================================
// Helper: Convert from old input format
// ============================================================================

export interface LegacyOverlapScoringInput {
  name: string;
  domain: string;
  hasInstallation: boolean;
  hasNationalReach: boolean;
  isLocal: boolean;
  productCategories: string[];
  serviceCategories: string[];
  brandTrustScore: number;
  pricePositioning: 'budget' | 'mid' | 'premium';
  isMajorRetailer: boolean;
}

/**
 * Convert legacy input format to new CompetitorTraits format
 */
export function convertLegacyInput(input: LegacyOverlapScoringInput): CompetitorTraits {
  return {
    name: input.name,
    domain: input.domain,
    hasServiceCapability: input.hasInstallation,
    serviceCapabilityConfidence: input.hasInstallation ? 0.8 : 0.2,
    geographicReach: input.hasNationalReach ? 'national' : input.isLocal ? 'local' : 'regional',
    serviceAreas: [],
    productCategories: input.productCategories,
    serviceCategories: input.serviceCategories,
    brandRecognition: input.brandTrustScore / 100,
    pricePositioning: input.pricePositioning,
    isRetailer: input.isMajorRetailer || input.productCategories.length > 0,
    isServiceProvider: input.hasInstallation || input.serviceCategories.length > 0,
    signalCompleteness: 0.7, // Legacy input assumed to be reasonably complete
  };
}

export interface LegacySubjectProfile {
  name: string;
  modality: CompetitiveModality;
  productCategories: string[];
  serviceCategories: string[];
  hasInstallation: boolean;
  geographicScope: 'local' | 'regional' | 'national';
  pricePositioning: 'budget' | 'mid' | 'premium';
  customerComparisonModes: string[];
}

/**
 * Convert legacy subject profile to new SubjectProfile format
 */
export function convertLegacySubjectProfile(input: LegacySubjectProfile): SubjectProfile {
  // Infer emphasis from modality
  let serviceEmphasis = 0.5;
  let productEmphasis = 0.5;

  switch (input.modality) {
    case 'Retail+Installation':
      serviceEmphasis = 0.6;
      productEmphasis = 0.5;
      break;
    case 'InstallationOnly':
      serviceEmphasis = 0.9;
      productEmphasis = 0.1;
      break;
    case 'ProductOnly':
      serviceEmphasis = 0.1;
      productEmphasis = 0.9;
      break;
    case 'RetailWithInstallAddon':
      serviceEmphasis = 0.3;
      productEmphasis = 0.7;
      break;
  }

  return {
    name: input.name,
    modality: input.modality,
    productCategories: input.productCategories,
    serviceCategories: input.serviceCategories,
    hasServiceCapability: input.hasInstallation,
    geographicScope: input.geographicScope,
    serviceAreas: [],
    pricePositioning: input.pricePositioning,
    brandRecognition: 0.5, // Default
    serviceEmphasis,
    productEmphasis,
  };
}

// ============================================================================
// Backward Compatibility Wrapper
// ============================================================================

/**
 * Legacy interface for backward compatibility
 * @deprecated Use calculateOverlapScore with new types instead
 */
export function calculateOverlapScoreLegacy(
  competitor: LegacyOverlapScoringInput,
  subject: LegacySubjectProfile,
  threshold: number = 40
): {
  scores: {
    installationCapability: number;
    geographicProximity: number;
    brandTrust: number;
    marketReach: number;
    serviceSubstitution: number;
    productOverlap: number;
    pricePositioning: number;
  };
  overallScore: number;
  classification: CompetitorClassification;
  rulesApplied: string[];
  inclusionReason: string | null;
} {
  const newCompetitor = convertLegacyInput(competitor);
  const newSubject = convertLegacySubjectProfile(subject);

  const result = calculateOverlapScore(newCompetitor, newSubject, {
    primaryThreshold: threshold + 15,
    contextualThreshold: threshold,
    alternativeThreshold: threshold - 15,
  });

  // Map new dimension scores to legacy format (convert 0-1 to 0-100)
  const scores = {
    installationCapability: Math.round(result.dimensionScores.installationCapabilityOverlap * 100),
    geographicProximity: Math.round(result.dimensionScores.geographicPresenceOverlap * 100),
    brandTrust: Math.round(result.dimensionScores.brandTrustOverlap * 100),
    marketReach: Math.round(result.dimensionScores.marketReachOverlap * 100),
    serviceSubstitution: Math.round(result.dimensionScores.serviceSubstitutionOverlap * 100),
    productOverlap: Math.round(result.dimensionScores.productCategoryOverlap * 100),
    pricePositioning: Math.round(result.dimensionScores.pricePositioningOverlap * 100),
  };

  return {
    scores,
    overallScore: result.overallScore,
    classification: result.legacyClassification,
    rulesApplied: result.traitRulesApplied,
    inclusionReason: result.inclusionReason,
  };
}

// Export the legacy function as the default for backward compatibility
export { calculateOverlapScoreLegacy as applyBestBuyRule };
export { calculateOverlapScoreLegacy as applyLocalInstallerRule };
export { getWeightsForModality as getWeightsForModalityLegacy };
