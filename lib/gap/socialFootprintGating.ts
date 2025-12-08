// lib/gap/socialFootprintGating.ts
//
// Social Footprint Gating for GAP Output
//
// NOTE: This module gates digitalFootprint scores + narratives based on socialFootprint
// detection to prevent contradictions. For example, if detection shows GBP is present,
// we should NOT say "No Google Business Profile" or recommend "Establish a GBP".
//
// The model is allowed to generate whatever it wants, but we SANITIZE the output
// at the mapping layer to ensure it doesn't contradict detection signals.
//
// Previous behavior: estimateSubscore() used random variance (+/- 10%) around the
// overall dimension score - completely ignoring actual detection data.
//
// New behavior: Subscores are derived from socialFootprint detection, and narratives
// are sanitized to remove/rewrite contradictory recommendations.

import type { SocialFootprintSnapshot } from './socialDetection';

// ============================================================================
// Types
// ============================================================================

export interface DigitalFootprintSubscores {
  googleBusinessProfile: number;
  linkedinPresence: number;
  socialPresence: number;
  reviewsReputation: number;
}

export interface SanitizedNarratives {
  oneLiner: string;
  issues: string[];
}

export interface SanitizedRecommendations {
  quickWins: string[];
  topOpportunities: string[];
}

// ============================================================================
// Subscore Computation from socialFootprint
// ============================================================================

/**
 * Compute GBP subscore from socialFootprint detection
 *
 * Scoring:
 * - present:      80 + 20*confidence → 80–100
 * - probable:     60 + 20*confidence → 60–80
 * - inconclusive: 30 + 20*confidence → 30–50
 * - missing:      0
 *
 * If socialFootprint is undefined, returns 0 (unknown)
 */
export function computeGoogleBusinessProfileSubscore(
  socialFootprint: SocialFootprintSnapshot | undefined
): number {
  if (!socialFootprint?.gbp) return 0;

  const { status, confidence } = socialFootprint.gbp;

  if (status === 'present') return Math.round(80 + 20 * confidence);
  if (status === 'probable') return Math.round(60 + 20 * confidence);
  if (status === 'inconclusive') return Math.round(30 + 20 * confidence);
  return 0; // missing
}

/**
 * Compute social presence subscore from socialFootprint detection
 *
 * Scoring based on number of active networks (present or probable):
 * - 0 networks: 0
 * - 1 network:  40 + avg_confidence * 15 → ~40-55
 * - 2 networks: 55 + avg_confidence * 15 → ~55-70
 * - 3 networks: 70 + avg_confidence * 15 → ~70-85
 * - 4+ networks: 85 + avg_confidence * 15 → ~85-100
 */
export function computeSocialPresenceSubscore(
  socialFootprint: SocialFootprintSnapshot | undefined
): number {
  if (!socialFootprint) return 0;

  const activeSocials = socialFootprint.socials.filter(
    s => s.status === 'present' || s.status === 'probable'
  );

  if (activeSocials.length === 0) return 0;

  const avgConfidence =
    activeSocials.reduce((sum, s) => sum + s.confidence, 0) / activeSocials.length;

  // Base score + per-network bonus + confidence bonus
  const baseScores = [0, 40, 55, 70, 85]; // for 0, 1, 2, 3, 4+ networks
  const baseScore = baseScores[Math.min(activeSocials.length, 4)];
  const confidenceBonus = avgConfidence * 15;

  return Math.round(Math.min(100, baseScore + confidenceBonus));
}

/**
 * Compute LinkedIn subscore from socialFootprint detection
 *
 * Uses the linkedin social entry from socialFootprint
 */
export function computeLinkedInSubscore(
  socialFootprint: SocialFootprintSnapshot | undefined
): number {
  if (!socialFootprint) return 0;

  const linkedin = socialFootprint.socials.find(s => s.network === 'linkedin');
  if (!linkedin) return 0;

  const { status, confidence } = linkedin;

  if (status === 'present') return Math.round(75 + 25 * confidence);
  if (status === 'probable') return Math.round(50 + 25 * confidence);
  if (status === 'inconclusive') return Math.round(25 + 25 * confidence);
  return 0;
}

/**
 * Compute all digitalFootprint subscores from socialFootprint
 *
 * For reviewsReputation, we don't have detection data, so we use a neutral default
 * or pass through any existing value.
 */
export function computeDigitalFootprintSubscores(
  socialFootprint: SocialFootprintSnapshot | undefined,
  existingReviewsScore?: number
): DigitalFootprintSubscores {
  return {
    googleBusinessProfile: computeGoogleBusinessProfileSubscore(socialFootprint),
    linkedinPresence: computeLinkedInSubscore(socialFootprint),
    socialPresence: computeSocialPresenceSubscore(socialFootprint),
    // Reviews: use existing or neutral default (50)
    reviewsReputation: existingReviewsScore ?? 50,
  };
}

/**
 * Compute overall digitalFootprint score from subscores
 *
 * Weighting:
 * - GBP: 35% (critical for local businesses)
 * - Social: 35% (engagement channels)
 * - LinkedIn: 15% (B2B relevance)
 * - Reviews: 15% (reputation)
 */
export function computeDigitalFootprintScore(subscores: DigitalFootprintSubscores): number {
  const weights = {
    googleBusinessProfile: 0.35,
    socialPresence: 0.35,
    linkedinPresence: 0.15,
    reviewsReputation: 0.15,
  };

  const score =
    (subscores.googleBusinessProfile ?? 0) * weights.googleBusinessProfile +
    (subscores.socialPresence ?? 0) * weights.socialPresence +
    (subscores.linkedinPresence ?? 0) * weights.linkedinPresence +
    (subscores.reviewsReputation ?? 0) * weights.reviewsReputation;

  return Math.round(score);
}

// ============================================================================
// Narrative Sanitization
// ============================================================================

/**
 * Check if socialFootprint indicates GBP is present/probable
 */
export function hasGbpPresent(socialFootprint: SocialFootprintSnapshot | undefined): boolean {
  if (!socialFootprint?.gbp) return false;
  return socialFootprint.gbp.status === 'present' || socialFootprint.gbp.status === 'probable';
}

/**
 * Check if socialFootprint indicates Instagram is present/probable
 */
export function hasInstagramPresent(socialFootprint: SocialFootprintSnapshot | undefined): boolean {
  if (!socialFootprint) return false;
  const ig = socialFootprint.socials.find(s => s.network === 'instagram');
  return ig?.status === 'present' || ig?.status === 'probable';
}

/**
 * Check if socialFootprint indicates any social network is present/probable
 */
export function hasSocialPresent(socialFootprint: SocialFootprintSnapshot | undefined): boolean {
  if (!socialFootprint) return false;
  return socialFootprint.socials.some(
    s => s.status === 'present' || s.status === 'probable'
  );
}

/**
 * Get list of present/probable social networks
 */
export function getActiveSocialNetworks(
  socialFootprint: SocialFootprintSnapshot | undefined
): string[] {
  if (!socialFootprint) return [];
  return socialFootprint.socials
    .filter(s => s.status === 'present' || s.status === 'probable')
    .map(s => s.network);
}

/**
 * Sanitize digitalFootprint narrative (oneLiner and issues)
 *
 * Rules:
 * - If GBP is present/probable, rewrite "no GBP" to "under-optimized GBP"
 * - If social is present/probable, rewrite "weak/no social" to "under-leveraged"
 */
export function sanitizeDigitalFootprintNarrative(
  socialFootprint: SocialFootprintSnapshot | undefined,
  rawOneLiner: string,
  rawIssues: string[]
): SanitizedNarratives {
  let oneLiner = rawOneLiner;
  let issues = [...rawIssues];

  const gbpPresent = hasGbpPresent(socialFootprint);
  const igPresent = hasInstagramPresent(socialFootprint);
  const socialPresent = hasSocialPresent(socialFootprint);

  // GBP rewrites
  if (gbpPresent) {
    oneLiner = rewriteNoGbpText(oneLiner);
    issues = issues.map(issue => rewriteNoGbpText(issue));
  }

  // Social/Instagram rewrites
  if (socialPresent || igPresent) {
    oneLiner = rewriteWeakSocialText(oneLiner);
    issues = issues.map(issue => rewriteWeakSocialText(issue));
  }

  return { oneLiner, issues };
}

/**
 * Rewrite text that falsely claims no GBP exists
 */
function rewriteNoGbpText(text: string): string {
  return text
    .replace(/no Google Business Profile/gi, 'an under-optimized Google Business Profile')
    .replace(/No Google Business Profile/g, 'An under-optimized Google Business Profile')
    .replace(/absence of (?:a )?Google Business Profile/gi, 'under-optimized Google Business Profile')
    .replace(/Absence of (?:a )?Google Business Profile/g, 'Under-optimized Google Business Profile')
    .replace(/lacks? (?:a )?Google Business Profile/gi, 'has an under-optimized Google Business Profile')
    .replace(/without (?:a )?Google Business Profile/gi, 'with an under-optimized Google Business Profile')
    .replace(/missing (?:a )?Google Business Profile/gi, 'under-optimized Google Business Profile');
}

/**
 * Rewrite text that falsely claims weak/no social presence
 */
function rewriteWeakSocialText(text: string): string {
  return text
    .replace(/weak social media presence/gi, 'under-leveraged social media presence')
    .replace(/Weak social media presence/g, 'Under-leveraged social media presence')
    .replace(/no social media presence/gi, 'under-leveraged social media presence')
    .replace(/No social media presence/g, 'Under-leveraged social media presence')
    .replace(/lacks? (?:a )?social media presence/gi, 'has under-leveraged social media')
    .replace(/absence of (?:a )?social media/gi, 'under-leveraged social media')
    .replace(/Absence of (?:a )?social media/g, 'Under-leveraged social media')
    .replace(/limited social presence/gi, 'under-leveraged social presence')
    .replace(/weak social presence/gi, 'under-leveraged social presence');
}

// ============================================================================
// QuickWins and TopOpportunities Sanitization
// ============================================================================

// Patterns that suggest "establish/create/set up GBP"
const GBP_ESTABLISH_PATTERNS = [
  /establish\s+(?:a\s+|an?\s+)?google\s+business\s+profile/i,
  /set\s+up\s+(?:a\s+|an?\s+)?google\s+business\s+profile/i,
  /create\s+(?:a\s+|an?\s+)?(?:and\s+optimize\s+)?google\s+business\s+profile/i,
  /create\s+(?:and\s+)?optimize\s+(?:a\s+)?google\s+business\s+profile/i,
  /claim\s+(?:a\s+|an?\s+)?google\s+business\s+profile/i,
  /claim\s+(?:and\s+)?optimize\s+(?:a\s+)?google\s+business\s+profile/i,
  /start\s+(?:a\s+|an?\s+)?google\s+business\s+profile/i,
  /establish\s+(?:a\s+)?gbp/i,
  /set\s+up\s+(?:a\s+)?gbp/i,
  /create\s+(?:a\s+)?gbp/i,
];

// Patterns that suggest "start/begin/develop Instagram"
const IG_START_PATTERNS = [
  /begin\s+posting\s+(?:regularly\s+)?on\s+instagram/i,
  /start\s+(?:an?\s+)?instagram\s+presence/i,
  /establish\s+(?:an?\s+)?instagram\s+presence/i,
  /create\s+(?:an?\s+)?instagram\s+(?:presence|account)/i,
  /launch\s+(?:an?\s+)?instagram/i,
  /develop\s+(?:a\s+|an?\s+)?(?:robust\s+|active\s+)?instagram\s+presence/i,
  /develop\s+(?:a\s+)?robust\s+social\s+media\s+strategy\s+on\s+(?:platforms\s+like\s+)?instagram/i,
];

// Patterns that suggest "start/establish social media presence" generically
const SOCIAL_START_PATTERNS = [
  /develop\s+(?:a\s+)?(?:robust\s+)?social\s+media\s+strategy/i,
  /establish\s+(?:a\s+)?social\s+media\s+presence/i,
  /create\s+social\s+media\s+(?:presence|profiles)/i,
  /start\s+(?:a\s+)?social\s+media\s+presence/i,
  /build\s+(?:a\s+)?social\s+media\s+presence/i,
];

/**
 * Check if a recommendation is about establishing GBP
 */
function isGbpEstablishRecommendation(text: string): boolean {
  return GBP_ESTABLISH_PATTERNS.some(pattern => pattern.test(text));
}

/**
 * Check if a recommendation is about starting Instagram
 */
function isIgStartRecommendation(text: string): boolean {
  return IG_START_PATTERNS.some(pattern => pattern.test(text));
}

/**
 * Check if a recommendation is about starting social media generally
 */
function isSocialStartRecommendation(text: string): boolean {
  return SOCIAL_START_PATTERNS.some(pattern => pattern.test(text));
}

/**
 * Rewrite a GBP "establish" recommendation to "optimize"
 */
function rewriteGbpRecommendation(text: string): string {
  // Replace common establish patterns with optimize language
  return text
    .replace(/establish\s+(?:and\s+optimize\s+)?(?:a\s+)?google\s+business\s+profile/gi,
      'Optimize the existing Google Business Profile')
    .replace(/set\s+up\s+(?:a\s+)?google\s+business\s+profile/gi,
      'Optimize the existing Google Business Profile')
    .replace(/create\s+(?:and\s+)?optimize\s+(?:a\s+)?google\s+business\s+profile/gi,
      'Optimize the existing Google Business Profile')
    .replace(/create\s+(?:a\s+|an?\s+)?(?:and\s+optimize\s+)?google\s+business\s+profile/gi,
      'Optimize the existing Google Business Profile')
    .replace(/claim\s+(?:and\s+)?optimize\s+(?:a\s+)?google\s+business\s+profile/gi,
      'Optimize the existing Google Business Profile')
    .replace(/establish\s+a\s+gbp/gi, 'Optimize the existing GBP');
}

/**
 * Rewrite an Instagram "start" recommendation to "strengthen"
 */
function rewriteIgRecommendation(text: string): string {
  return text
    .replace(/begin\s+posting\s+(?:regularly\s+)?on\s+instagram/gi,
      'strengthen the existing Instagram presence')
    .replace(/start\s+(?:an?\s+)?instagram\s+presence/gi,
      'strengthen the existing Instagram presence')
    .replace(/develop\s+(?:a\s+|an?\s+)?(?:robust\s+|active\s+)?instagram\s+presence/gi,
      'strengthen the existing Instagram presence')
    .replace(/develop\s+(?:a\s+)?robust\s+social\s+media\s+strategy\s+on\s+(?:platforms\s+like\s+)?instagram/gi,
      'strengthen Instagram content and engagement strategy');
}

/**
 * Rewrite a social media "start" recommendation to "strengthen"
 */
function rewriteSocialRecommendation(text: string, activeNetworks: string[]): string {
  const networkList = activeNetworks.length > 0
    ? activeNetworks.slice(0, 3).join(', ')
    : 'social media';

  return text
    .replace(/develop\s+(?:a\s+)?(?:robust\s+)?social\s+media\s+strategy/gi,
      `Strengthen the existing ${networkList} presence and content strategy`)
    .replace(/establish\s+(?:a\s+)?social\s+media\s+presence/gi,
      `Strengthen the existing ${networkList} presence`)
    .replace(/create\s+social\s+media\s+(?:presence|profiles)/gi,
      `Optimize the existing ${networkList} presence`);
}

/**
 * Sanitize quickWins and topOpportunities arrays
 *
 * Rules:
 * - If GBP is present/probable:
 *   - Remove or rewrite "establish GBP" recommendations to "optimize GBP"
 * - If Instagram is present/probable:
 *   - Remove or rewrite "start Instagram" recommendations to "strengthen Instagram"
 * - If any social is present:
 *   - Rewrite generic "start social media" to "strengthen social media"
 *
 * If GBP/social is missing AND dataConfidence >= 0.7: allow "establish" phrasing
 * If missing AND dataConfidence < 0.7: soften to conditional language
 */
export function sanitizeSocialQuickWinsAndOpportunities(
  socialFootprint: SocialFootprintSnapshot | undefined,
  quickWins: string[],
  topOpportunities: string[]
): SanitizedRecommendations {
  const gbpPresent = hasGbpPresent(socialFootprint);
  const igPresent = hasInstagramPresent(socialFootprint);
  const socialPresent = hasSocialPresent(socialFootprint);
  const activeNetworks = getActiveSocialNetworks(socialFootprint);
  const dataConfidence = socialFootprint?.dataConfidence ?? 0;

  const sanitizeItem = (item: string): string | null => {
    // GBP recommendations
    if (isGbpEstablishRecommendation(item)) {
      if (gbpPresent) {
        // GBP exists - rewrite to optimize
        return rewriteGbpRecommendation(item);
      } else if (dataConfidence < 0.7) {
        // Low confidence - soften language
        return item.replace(
          /establish\s+(?:a\s+)?google\s+business\s+profile/gi,
          'Verify and, if needed, establish a Google Business Profile'
        );
      }
      // High confidence + missing = allow as-is
    }

    // Instagram recommendations
    if (isIgStartRecommendation(item)) {
      if (igPresent) {
        return rewriteIgRecommendation(item);
      } else if (dataConfidence < 0.7 && socialPresent) {
        // If we have other socials but low confidence on IG, soften
        return item.replace(
          /begin\s+posting\s+(?:regularly\s+)?on\s+instagram/gi,
          'If not already active on Instagram, begin posting regularly'
        );
      }
    }

    // Generic social recommendations
    if (isSocialStartRecommendation(item)) {
      if (socialPresent) {
        return rewriteSocialRecommendation(item, activeNetworks);
      }
    }

    return item;
  };

  return {
    quickWins: quickWins.map(item => sanitizeItem(item)).filter((item): item is string => item !== null),
    topOpportunities: topOpportunities.map(item => sanitizeItem(item)).filter((item): item is string => item !== null),
  };
}

/**
 * Sanitize core.quickSummary string
 *
 * Applies same rules as quickWins/topOpportunities but to a single string
 */
export function sanitizeQuickSummary(
  socialFootprint: SocialFootprintSnapshot | undefined,
  quickSummary: string
): string {
  const gbpPresent = hasGbpPresent(socialFootprint);
  const igPresent = hasInstagramPresent(socialFootprint);
  const socialPresent = hasSocialPresent(socialFootprint);
  const activeNetworks = getActiveSocialNetworks(socialFootprint);
  const dataConfidence = socialFootprint?.dataConfidence ?? 0;

  let result = quickSummary;

  // GBP rewrites
  if (gbpPresent) {
    result = rewriteGbpRecommendation(result);
    result = rewriteNoGbpText(result);
  } else if (dataConfidence < 0.7) {
    result = result.replace(
      /establish\s+(?:a\s+)?google\s+business\s+profile/gi,
      'Verify and, if needed, establish a Google Business Profile'
    );
  }

  // Instagram rewrites
  if (igPresent) {
    result = rewriteIgRecommendation(result);
  }

  // Generic social rewrites
  if (socialPresent) {
    result = rewriteSocialRecommendation(result, activeNetworks);
    result = rewriteWeakSocialText(result);
  }

  return result;
}

// ============================================================================
// Exports for Testing
// ============================================================================

export const _testing = {
  rewriteNoGbpText,
  rewriteWeakSocialText,
  isGbpEstablishRecommendation,
  isIgStartRecommendation,
  isSocialStartRecommendation,
  rewriteGbpRecommendation,
  rewriteIgRecommendation,
  rewriteSocialRecommendation,
  GBP_ESTABLISH_PATTERNS,
  IG_START_PATTERNS,
  SOCIAL_START_PATTERNS,
};
