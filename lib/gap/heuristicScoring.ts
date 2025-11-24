/**
 * GAP Heuristic Scoring Layer
 *
 * CORE ENGINE LOCATION NOTE:
 * This module applies signal-based scoring adjustments to IA/GAP outputs.
 * It runs AFTER LLM scoring but BEFORE final calibration in lib/gap/scoring.ts
 *
 * Key responsibilities:
 * - Core SEO scoring for IA (brand-tier-based baselines + signal adjustments)
 * - Core Authority scoring for IA (brand-tier-based baselines + explicit signals)
 * - GBP penalty enforcement for LOCAL businesses ONLY (not global/enterprise)
 * - SEO sub-factor expansion and distribution widening
 * - Edge case detection (minimal-but-famous sites)
 * - Local/SMB score separation and overall adjustments
 *
 * Called from: app/api/gap-ia/run/route.ts (IA engine)
 *
 * CALIBRATION NOTES (2025-01-24):
 * - Brand tier baselines added to prevent global leaders scoring like local SMBs
 * - GBP penalties now exempt global/enterprise/mid-market brands
 * - SEO/Authority baselines tunable via BRAND_TIER_*_BASELINES constants below
 */

import type { BusinessContext } from './contextualHeuristics';
import type { DigitalFootprint } from '@/lib/digital-footprint/collectDigitalFootprint';
import type { BrandTier } from './contextualHeuristics';

// ============================================================================
// Brand Tier Baseline Constants (Tunable)
// ============================================================================

/**
 * SEO baseline scores by brand tier
 * These are starting points that get adjusted by actual technical signals
 */
const BRAND_TIER_SEO_BASELINES: Record<string, number> = {
  'global_category_leader': 70,
  'enterprise': 65,
  'mid_market': 55,
  'startup': 45,
  'smb': 40,
  'local_business': 35,
  'nonprofit': 35,
  'other': 40,
};

/**
 * Authority baseline scores by brand tier
 * These reflect expected market presence and trust
 */
const BRAND_TIER_AUTHORITY_BASELINES: Record<string, number> = {
  'global_category_leader': 80,
  'enterprise': 75,
  'mid_market': 65,
  'startup': 45,
  'smb': 40,
  'local_business': 35,
  'nonprofit': 35,
  'other': 40,
};

// ============================================================================
// Type Definitions
// ============================================================================

export interface DimensionScores {
  brandStrength: number;
  contentQuality: number;
  seoFoundation: number;
  websiteExperience: number;
  digitalFootprint: number;
  authorityTrust: number;
}

export interface HeuristicScoringInput {
  // Initial scores from LLM
  llmScores: Partial<DimensionScores>;
  overallScore?: number;

  // Business context
  businessContext: BusinessContext;
  domain: string;

  // Explicit signals
  digitalFootprint: DigitalFootprint;
  htmlSignals: {
    title?: string;
    h1s: string[];
    metaDescription?: string;
    hasNav: boolean;
    hasBlog: boolean;
    hasSchema?: boolean;
    hasStructuredData?: boolean;
    wordCount?: number;
    internalLinkCount?: number;
  };

  // Multi-page data (if available)
  multiPageData?: {
    pagesDiscovered: number;
    blogPostCount?: number;
    contentDepth?: 'shallow' | 'medium' | 'deep';
  };
}

export interface HeuristicScoringOutput {
  adjustedScores: DimensionScores;
  overallScore: number;
  adjustments: ScoringAdjustment[];
  flags: string[];
}

export interface ScoringAdjustment {
  dimension: keyof DimensionScores | 'overall';
  delta: number;
  reason: string;
  category: 'gbp_penalty' | 'seo_recalc' | 'authority_correction' | 'edge_case' | 'local_separation' | 'other';
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Determine if this is a local/service business that REQUIRES GBP
 *
 * CRITICAL: Global/enterprise/mid-market brands should NOT be penalized for missing GBP
 */
function isLocalOrServiceBusiness(context: BusinessContext): boolean {
  // Exempt large brands from GBP requirements
  if (context.brandTier === 'global_category_leader' ||
      context.brandTier === 'enterprise' ||
      context.brandTier === 'mid_market') {
    return false;
  }

  // Check for local business indicators
  return context.brandTier === 'local_business' ||
         context.businessType === 'local-consumer' ||
         context.businessType === 'b2c-services' ||
         (context.businessType === 'nonprofit' && context.signals.hasPhysicalLocation) ||
         context.signals.isLocal ||
         context.signals.hasPhysicalLocation;
}

// ============================================================================
// Step 1: Local Business GBP Penalty (HEAVY - LOCAL ONLY)
// ============================================================================

/**
 * Apply local business adjustments, especially for missing Google Business Profile
 *
 * IMPORTANT: Only applies to actual local businesses (not global/enterprise brands)
 * For local/location-driven businesses, missing GBP is a MAJOR visibility issue.
 */
function applyLocalBusinessAdjustments(
  scores: Partial<DimensionScores>,
  context: BusinessContext,
  footprint: DigitalFootprint,
  adjustments: ScoringAdjustment[]
): void {
  // Only apply GBP penalties to actual local/service businesses
  if (!isLocalOrServiceBusiness(context)) {
    return;
  }

  // Check for missing Google Business Profile
  if (!footprint.gbp || !footprint.gbp.found) {
    // CRITICAL PENALTY for local businesses without GBP
    // Local businesses rely heavily on Google Maps and local search

    // Digital Footprint: -15 to -20 points (severe)
    const digitalPenalty = -18;
    scores.digitalFootprint = Math.max(0, (scores.digitalFootprint || 50) + digitalPenalty);
    adjustments.push({
      dimension: 'digitalFootprint',
      delta: digitalPenalty,
      reason: 'Missing Google Business Profile = near-invisibility in local search for local businesses',
      category: 'gbp_penalty'
    });

    // SEO: -8 points (local SEO requires GBP)
    const seoPenalty = -8;
    scores.seoFoundation = Math.max(0, (scores.seoFoundation || 50) + seoPenalty);
    adjustments.push({
      dimension: 'seoFoundation',
      delta: seoPenalty,
      reason: 'Local SEO impossible without GBP',
      category: 'gbp_penalty'
    });

    // Authority: -5 points (GBP provides trust signals)
    const authorityPenalty = -5;
    scores.authorityTrust = Math.max(0, (scores.authorityTrust || 50) + authorityPenalty);
    adjustments.push({
      dimension: 'authorityTrust',
      delta: authorityPenalty,
      reason: 'GBP provides critical trust signals (reviews, verification) for local businesses',
      category: 'gbp_penalty'
    });
  }

  // Additional local signal checks
  const hasSocial = footprint.linkedin?.found || footprint.otherSocials?.instagram ||
                     footprint.otherSocials?.facebook || footprint.otherSocials?.youtube;
  if (!hasSocial) {
    // Local businesses heavily rely on social for customer engagement
    const socialPenalty = -5;
    scores.digitalFootprint = Math.max(0, (scores.digitalFootprint || 50) + socialPenalty);
    adjustments.push({
      dimension: 'digitalFootprint',
      delta: socialPenalty,
      reason: 'Local businesses need social presence (Facebook/Instagram) for community engagement',
      category: 'gbp_penalty'
    });
  }
}

// ============================================================================
// Step 2: SEO Scoring with Brand Tier Baselines
// ============================================================================

/**
 * Calculate SEO score using brand-tier baseline + technical signal adjustments
 *
 * CALIBRATION (2025-01-24):
 * - Start from brand tier baseline (global: 70, enterprise: 65, etc.)
 * - Adjust up/down based on actual technical signals
 * - Global leaders cannot drop below 50 unless catastrophic failure
 * - Local/SMB can range 10-70 based on signals
 */
function calculateExpandedSeoScore(
  htmlSignals: HeuristicScoringInput['htmlSignals'],
  footprint: DigitalFootprint,
  context: BusinessContext,
  multiPageData?: HeuristicScoringInput['multiPageData'],
  llmScores?: Partial<DimensionScores>
): { score: number; breakdown: Record<string, number> } {
  const breakdown: Record<string, number> = {};

  // Start from brand tier baseline
  const baseline = BRAND_TIER_SEO_BASELINES[context.brandTier] || 40;
  breakdown.brandTierBaseline = baseline;

  // Sub-factor 1: Metadata Quality (0-100, weighted 20%)
  let metadataScore = 0;
  if (htmlSignals.title && htmlSignals.title.length > 10) metadataScore += 30;
  if (htmlSignals.metaDescription && htmlSignals.metaDescription.length > 50) metadataScore += 30;
  if (htmlSignals.title && htmlSignals.title.length >= 30 && htmlSignals.title.length <= 60) metadataScore += 20; // optimal length
  if (htmlSignals.metaDescription && htmlSignals.metaDescription.length >= 120 && htmlSignals.metaDescription.length <= 160) metadataScore += 20;
  breakdown.metadata = metadataScore;

  // Sub-factor 2: Structure Quality (0-100, weighted 15%)
  let structureScore = 0;
  if (htmlSignals.h1s && htmlSignals.h1s.length > 0) structureScore += 40;
  if (htmlSignals.h1s && htmlSignals.h1s.length === 1) structureScore += 20; // best practice: single H1
  if (htmlSignals.hasNav) structureScore += 20;
  if (htmlSignals.internalLinkCount && htmlSignals.internalLinkCount > 5) structureScore += 20;
  breakdown.structure = structureScore;

  // Sub-factor 3: Schema/Structured Data (0-100, weighted 10%)
  let schemaScore = 0;
  if (htmlSignals.hasSchema) schemaScore += 60;
  if (htmlSignals.hasStructuredData) schemaScore += 40;
  breakdown.schema = schemaScore;

  // Sub-factor 4: Local SEO (only relevant for local businesses)
  let localSeoScore = 0;
  if (isLocalOrServiceBusiness(context)) {
    if (footprint.gbp?.found) localSeoScore += 60;
    if (htmlSignals.hasSchema || htmlSignals.hasStructuredData) localSeoScore += 20;
    if (htmlSignals.wordCount && htmlSignals.wordCount > 100) localSeoScore += 10;
    if (htmlSignals.hasSchema || htmlSignals.hasStructuredData) localSeoScore += 10;
  }
  breakdown.localSeo = localSeoScore;

  // Sub-factor 5: Content Depth (0-100)
  let contentDepthScore = 0;
  if (htmlSignals.hasBlog) contentDepthScore += 40;
  if (multiPageData?.blogPostCount) {
    if (multiPageData.blogPostCount > 20) contentDepthScore += 40;
    else if (multiPageData.blogPostCount > 10) contentDepthScore += 30;
    else if (multiPageData.blogPostCount > 5) contentDepthScore += 20;
    else contentDepthScore += 10;
  }
  if (htmlSignals.wordCount && htmlSignals.wordCount > 500) contentDepthScore += 20;
  breakdown.contentDepth = contentDepthScore;

  // Sub-factor 6: Technical Hints (0-100)
  let technicalScore = 50; // baseline
  if (htmlSignals.metaDescription) technicalScore += 25;
  if (htmlSignals.hasNav && htmlSignals.h1s.length > 0) technicalScore += 25;
  breakdown.technical = Math.min(100, technicalScore);

  // Calculate signal-based adjustment from sub-factors
  const isLocal = isLocalOrServiceBusiness(context);

  const weights = isLocal ? {
    metadata: 0.25,
    structure: 0.20,
    schema: 0.10,
    localSeo: 0.25,  // Heavy weight for local
    contentDepth: 0.15,
    technical: 0.05
  } : {
    metadata: 0.25,
    structure: 0.20,
    schema: 0.15,
    localSeo: 0.00,  // Irrelevant for non-local
    contentDepth: 0.30,
    technical: 0.10
  };

  const signalScore =
    breakdown.metadata * weights.metadata +
    breakdown.structure * weights.structure +
    breakdown.schema * weights.schema +
    breakdown.localSeo * weights.localSeo +
    breakdown.contentDepth * weights.contentDepth +
    breakdown.technical * weights.technical;

  // Combine baseline + signal adjustment (signals can add/subtract from baseline)
  // For signals: 0-40 = penalize, 40-60 = neutral, 60-100 = boost
  const signalAdjustment = (signalScore - 50) * 0.6; // Scale signals to ±30 range
  let finalScore = baseline + signalAdjustment;

  // Apply floor for global leaders (must be catastrophic to drop below 50)
  if (context.brandTier === 'global_category_leader') {
    const hasCatastrophicFailure =
      !htmlSignals.title ||
      (!htmlSignals.metaDescription && !htmlSignals.h1s.length);

    if (!hasCatastrophicFailure) {
      finalScore = Math.max(finalScore, 60); // Floor at 60 for healthy global leaders
    } else {
      finalScore = Math.max(finalScore, 50); // Floor at 50 even with issues
    }
  }

  // Clamp to valid range
  finalScore = Math.round(Math.max(0, Math.min(100, finalScore)));

  breakdown.signalScore = Math.round(signalScore);
  breakdown.signalAdjustment = Math.round(signalAdjustment);
  breakdown.finalScore = finalScore;

  return {
    score: finalScore,
    breakdown
  };
}

// ============================================================================
// Step 3: Authority Scoring with Brand Tier Baselines
// ============================================================================

/**
 * Calculate authority from brand tier baseline + explicit signals
 *
 * CALIBRATION (2025-01-24):
 * - Start from brand tier baseline (global: 80, enterprise: 75, etc.)
 * - Adjust based on explicit signals only (reviews, social, content)
 * - No LLM hallucination rewards
 * - Local/nonprofit without signals cannot exceed ~35
 */
function calculateExplicitAuthorityScore(
  footprint: DigitalFootprint,
  context: BusinessContext,
  htmlSignals: HeuristicScoringInput['htmlSignals']
): { score: number; signals: string[] } {
  // Start from brand tier baseline
  let score = BRAND_TIER_AUTHORITY_BASELINES[context.brandTier] || 40;
  const signals: string[] = [];
  signals.push(`Brand tier baseline: ${score}`);

  // Track if we have ANY explicit signals
  let hasExplicitSignals = false;

  // Signal 1: Reviews (adjust from baseline)
  if (footprint.gbp?.found && footprint.gbp.hasReviews) {
    hasExplicitSignals = true;
    const reviewCountBucket = footprint.gbp.reviewCountBucket;
    const ratingBucket = footprint.gbp.ratingBucket;

    if (reviewCountBucket === 'many' && ratingBucket === 'strong') {
      score += 10;
      signals.push(`+10: Many reviews with strong ratings`);
    } else if (reviewCountBucket === 'moderate' && (ratingBucket === 'strong' || ratingBucket === 'mixed')) {
      score += 6;
      signals.push(`+6: Moderate reviews with ${ratingBucket} ratings`);
    } else if (reviewCountBucket === 'few') {
      score += 3;
      signals.push(`+3: Few reviews`);
    }
  }

  // Signal 2: Social following (adjust from baseline)
  const linkedInBucket = footprint.linkedin?.followerBucket;
  const hasInstagram = footprint.otherSocials?.instagram;
  const hasFacebook = footprint.otherSocials?.facebook;
  const hasYoutube = footprint.otherSocials?.youtube;

  if (linkedInBucket === '10k+') {
    hasExplicitSignals = true;
    score += 8;
    signals.push(`+8: Large LinkedIn following (10k+)`);
  } else if (linkedInBucket === '1k-10k') {
    hasExplicitSignals = true;
    score += 5;
    signals.push(`+5: Solid LinkedIn following (1k-10k)`);
  } else if (linkedInBucket === '100-1k' || linkedInBucket === '0-100') {
    hasExplicitSignals = true;
    score += 2;
    signals.push(`+2: Growing LinkedIn following (${linkedInBucket})`);
  }

  // Additional social presence bonuses
  if (hasInstagram || hasFacebook || hasYoutube) {
    hasExplicitSignals = true;
    score += 3;
    const platforms = [hasInstagram && 'Instagram', hasFacebook && 'Facebook', hasYoutube && 'YouTube'].filter(Boolean);
    signals.push(`+3: Active on ${platforms.join(', ')}`);
  }

  // Signal 3: Content authority (blog, resources)
  if (htmlSignals.hasBlog) {
    hasExplicitSignals = true;
    score += 5;
    signals.push('+5: Content hub/blog present');
  }

  // Signal 4: Trust indicators (schema)
  if (htmlSignals.hasSchema || htmlSignals.hasStructuredData) {
    hasExplicitSignals = true;
    score += 3;
    signals.push('+3: Structured data (schema.org)');
  }

  // Cap local/nonprofit authority if no explicit signals
  if ((context.brandTier === 'local_business' ||
       context.brandTier === 'nonprofit' ||
       context.brandTier === 'smb') &&
      !hasExplicitSignals) {
    // Without signals, local/nonprofit/smb should not exceed baseline much
    score = Math.min(score, 35);
    signals.push('Capped at 35 (no explicit authority signals for local/smb/nonprofit)');
  }

  // Clamp to valid range
  score = Math.round(Math.max(0, Math.min(100, score)));

  return { score, signals };
}

// ============================================================================
// Step 4: Edge Case Detection (Minimal-But-Famous)
// ============================================================================

/**
 * Detect "minimal but famous" sites (Craigslist, Berkshire Hathaway style)
 *
 * These sites should NOT score like "average modern SMB marketing"
 * They get low Website/SEO/Content scores but can have higher Authority
 */
function detectMinimalLegendarySite(
  domain: string,
  htmlSignals: HeuristicScoringInput['htmlSignals'],
  context: BusinessContext
): boolean {
  // Hardcoded minimal-but-famous domains
  // TODO: Move to external config or database
  const minimalFamousDomains = [
    'berkshirehathaway.com',
    'craigslist.org',
    // Add more as discovered
  ];

  if (minimalFamousDomains.some(d => domain.includes(d))) {
    return true;
  }

  // Heuristic detection: extremely minimal HTML structure
  const isExtremelyMinimal =
    !htmlSignals.metaDescription &&
    (!htmlSignals.title || htmlSignals.title.length < 20) &&
    !htmlSignals.hasNav &&
    htmlSignals.h1s.length === 0 &&
    !htmlSignals.hasBlog;

  return isExtremelyMinimal;
}

/**
 * Apply edge case adjustments for minimal-but-famous sites
 */
function applyEdgeCaseAdjustments(
  scores: Partial<DimensionScores>,
  context: BusinessContext,
  htmlSignals: HeuristicScoringInput['htmlSignals'],
  adjustments: ScoringAdjustment[],
  flags: string[],
  domain: string
): void {
  const isMinimalFamous = detectMinimalLegendarySite(domain, htmlSignals, context);

  if (!isMinimalFamous) return;

  flags.push('EDGE_CASE: Minimal-but-famous site detected');

  // Keep scores low for modern marketing dimensions
  // These sites don't do modern marketing, so scores should reflect that

  if ((scores.seoFoundation || 50) > 35) {
    const delta = 30 - (scores.seoFoundation || 50);
    scores.seoFoundation = 30;
    adjustments.push({
      dimension: 'seoFoundation',
      delta,
      reason: 'Minimal-famous site: no modern SEO infrastructure',
      category: 'edge_case'
    });
  }

  if ((scores.websiteExperience || 50) > 35) {
    const delta = 30 - (scores.websiteExperience || 50);
    scores.websiteExperience = 30;
    adjustments.push({
      dimension: 'websiteExperience',
      delta,
      reason: 'Minimal-famous site: no modern website/conversion optimization',
      category: 'edge_case'
    });
  }

  if ((scores.contentQuality || 50) > 30) {
    const delta = 25 - (scores.contentQuality || 50);
    scores.contentQuality = 25;
    adjustments.push({
      dimension: 'contentQuality',
      delta,
      reason: 'Minimal-famous site: no modern content marketing',
      category: 'edge_case'
    });
  }

  // Authority can stay mid-high if earned (brand is known)
  // But add note that marketing system is intentionally spartan
  adjustments.push({
    dimension: 'authorityTrust',
    delta: 0,
    reason: 'Authority may be high (known brand) but marketing system is intentionally minimal',
    category: 'edge_case'
    });
}

// ============================================================================
// Step 6: Local/SMB Score Separation (WIDEN SPREAD)
// ============================================================================

/**
 * Apply final separation adjustment for weak local/SMB sites
 *
 * Goal: Prevent clustering in 30-45 range. Weak sites should drop to teens/20s.
 */
function applyLocalSmbSeparationAdjustment(
  scores: Partial<DimensionScores>,
  overallScore: number,
  context: BusinessContext,
  adjustments: ScoringAdjustment[]
): number {
  const isLocalOrSmallService =
    context.brandTier === 'local_business' ||
    context.brandTier === 'smb' ||
    context.businessType === 'local-consumer' ||
    context.businessType === 'b2b-services' ||
    context.businessType === 'b2c-services';

  if (!isLocalOrSmallService) return overallScore;

  // If overall is > 35 but everything is weak, apply extra penalty
  const isEverythingWeak =
    (scores.digitalFootprint || 0) < 35 &&
    (scores.seoFoundation || 0) < 35 &&
    (scores.authorityTrust || 0) < 35;

  if (overallScore > 35 && isEverythingWeak) {
    const penalty = -8;
    adjustments.push({
      dimension: 'overall',
      delta: penalty,
      reason: 'Local/SMB with uniformly weak signals should score clearly low, not mid-range',
      category: 'local_separation'
    });
    return Math.max(15, overallScore + penalty);
  }

  return overallScore;
}

// ============================================================================
// Step 7: Sanity Check Adjustments (Prevent Obviously Inverted Scores)
// ============================================================================

/**
 * Apply final sanity checks to catch obviously wrong score relationships
 *
 * CALIBRATION (2025-01-24):
 * - Global leaders cannot have authority < 60 or SEO < 50
 * - Local/nonprofit cannot have authority > 50 without explicit signals
 * - Ensures brand tier baselines are respected even if LLM/signals drift
 */
function applyScoreSanityAdjustments(
  scores: DimensionScores,
  context: BusinessContext,
  llmScores: Partial<DimensionScores>,
  adjustments: ScoringAdjustment[]
): void {
  // Global category leaders: enforce minimum floors
  if (context.brandTier === 'global_category_leader') {
    if (scores.authorityTrust < 70) {
      const delta = 70 - scores.authorityTrust;
      scores.authorityTrust = 70;
      adjustments.push({
        dimension: 'authorityTrust',
        delta,
        reason: 'Global category leader floor: authority cannot be below 70',
        category: 'other'
      });
    }

    if (scores.seoFoundation < 60) {
      const delta = 60 - scores.seoFoundation;
      scores.seoFoundation = 60;
      adjustments.push({
        dimension: 'seoFoundation',
        delta,
        reason: 'Global category leader floor: SEO cannot be below 60 (unless catastrophic failure detected)',
        category: 'other'
      });
    }
  }

  // Local/nonprofit/SMB: cap authority if it's suspiciously high
  if ((context.brandTier === 'local_business' ||
       context.brandTier === 'nonprofit' ||
       context.brandTier === 'smb') &&
      scores.authorityTrust > 50) {

    // Check if we have strong brand/content scores that might justify higher authority
    const hasStrongBrand = (llmScores.brandStrength || 0) >= 70;
    const hasStrongContent = (llmScores.contentQuality || 0) >= 70;

    if (!hasStrongBrand && !hasStrongContent) {
      const delta = 40 - scores.authorityTrust;
      scores.authorityTrust = 40;
      adjustments.push({
        dimension: 'authorityTrust',
        delta,
        reason: 'Local/SMB/nonprofit cap: authority capped at 40 without strong brand/content signals',
        category: 'other'
      });
    }
  }
}

// ============================================================================
// Main Heuristic Scoring Function
// ============================================================================

/**
 * Apply all heuristic scoring adjustments
 *
 * This is the main entry point called from the IA engine
 */
export function applyHeuristicScoring(
  input: HeuristicScoringInput
): HeuristicScoringOutput {
  const adjustments: ScoringAdjustment[] = [];
  const flags: string[] = [];

  // Start with LLM scores
  const scores: Partial<DimensionScores> = { ...input.llmScores };

  // Step 1: Local business GBP penalties
  applyLocalBusinessAdjustments(
    scores,
    input.businessContext,
    input.digitalFootprint,
    adjustments
  );

  // Step 2: Recalculate SEO with brand tier baseline + signal adjustments
  const seoResult = calculateExpandedSeoScore(
    input.htmlSignals,
    input.digitalFootprint,
    input.businessContext,
    input.multiPageData,
    input.llmScores
  );

  const seoScoreBefore = scores.seoFoundation || 50;
  scores.seoFoundation = seoResult.score;

  if (Math.abs(seoResult.score - seoScoreBefore) > 5) {
    adjustments.push({
      dimension: 'seoFoundation',
      delta: seoResult.score - seoScoreBefore,
      reason: `SEO recalculated with brand baseline (${seoResult.breakdown.brandTierBaseline}) + signals`,
      category: 'seo_recalc'
    });
  }

  // Step 3: Recalculate Authority from brand tier baseline + explicit signals
  const authorityResult = calculateExplicitAuthorityScore(
    input.digitalFootprint,
    input.businessContext,
    input.htmlSignals
  );

  const authorityScoreBefore = scores.authorityTrust || 50;
  scores.authorityTrust = authorityResult.score;

  if (Math.abs(authorityResult.score - authorityScoreBefore) > 5) {
    adjustments.push({
      dimension: 'authorityTrust',
      delta: authorityResult.score - authorityScoreBefore,
      reason: `Authority recalculated: ${authorityResult.signals.join('; ')}`,
      category: 'authority_correction'
    });
  }

  // Step 4: Edge case detection and adjustments
  applyEdgeCaseAdjustments(
    scores,
    input.businessContext,
    input.htmlSignals,
    adjustments,
    flags,
    input.domain
  );

  // Ensure all dimensions have values
  const finalScores: DimensionScores = {
    brandStrength: scores.brandStrength || 50,
    contentQuality: scores.contentQuality || 50,
    seoFoundation: scores.seoFoundation || 50,
    websiteExperience: scores.websiteExperience || 50,
    digitalFootprint: scores.digitalFootprint || 50,
    authorityTrust: scores.authorityTrust || 50,
  };

  // Step 7: Apply sanity check adjustments
  applyScoreSanityAdjustments(
    finalScores,
    input.businessContext,
    input.llmScores,
    adjustments
  );

  // Calculate overall as weighted average
  let overallScore = Math.round(
    (finalScores.brandStrength +
     finalScores.contentQuality +
     finalScores.seoFoundation +
     finalScores.websiteExperience +
     finalScores.digitalFootprint +
     finalScores.authorityTrust) / 6
  );

  // Step 6: Local/SMB separation adjustment
  overallScore = applyLocalSmbSeparationAdjustment(
    finalScores,
    overallScore,
    input.businessContext,
    adjustments
  );

  // Clamp all scores to [0, 100]
  Object.keys(finalScores).forEach(key => {
    finalScores[key as keyof DimensionScores] = Math.max(0, Math.min(100, finalScores[key as keyof DimensionScores]));
  });
  overallScore = Math.max(0, Math.min(100, overallScore));

  return {
    adjustedScores: finalScores,
    overallScore,
    adjustments,
    flags
  };
}
