/**
 * Maturity Detection Module
 * 
 * Analyzes SiteFeatures to detect enterprise SaaS maturity signals
 * and prevents enterprise sites from being incorrectly classified as "Emerging" or "Developing".
 */

import type { SiteFeatures } from '@/lib/eval/siteFeatures';

/**
 * Maturity levels detected from site signals
 */
export type MaturityLevel =
  | 'early-stage'
  | 'growing'
  | 'established'
  | 'mature'
  | 'category-leader';

/**
 * Display names for maturity levels
 */
export const MATURITY_DISPLAY_NAMES: Record<MaturityLevel, string> = {
  'early-stage': 'Early Stage',
  'growing': 'Growing',
  'established': 'Established',
  'mature': 'Mature',
  'category-leader': 'Category Leader',
};

/**
 * Detect maturity level based on enterprise SaaS signals
 * 
 * Analyzes SiteFeatures for signs of enterprise SaaS scale and sophistication.
 * Enterprise sites (HubSpot, Shopify, Stripe, Notion, Webflow) will be classified
 * as "established", "mature", or "category-leader" regardless of temporary scoring issues.
 * 
 * @param features - SiteFeatures object containing all detected signals
 * @returns Detected maturity level
 */
export function detectMaturity(features: SiteFeatures): MaturityLevel {
  let strongEnterpriseSignals = 0;

  // 1. Multi-product nav (>5 top-level nav items)
  const navItemCount = features.navigation.navItemLabels.length;
  if (navItemCount > 5) {
    strongEnterpriseSignals++;
  }

  // 2. Product mega-menu (detected via multiple product/solution nav items)
  const hasProductNav = features.navigation.hasProductNav;
  const hasSolutionsNav = features.navigation.hasSolutionsNav;
  if (hasProductNav && hasSolutionsNav) {
    strongEnterpriseSignals++;
  }

  // 3. Blog present with blogPostCount >= 40
  if (features.content.hasBlog && features.content.blogPostCount >= 40) {
    strongEnterpriseSignals++;
  }

  // 4. Resources hub or Academy detected
  if (features.content.hasResourcesHub) {
    strongEnterpriseSignals++;
  }

  // 5. Case study library link detected
  if (features.content.hasCaseStudiesSection || features.content.caseStudyCount >= 10) {
    strongEnterpriseSignals++;
  }

  // 6. Testimonials or customer logos present
  if (features.authority.testimonialCount > 0 || features.authority.customerLogoCount > 0) {
    strongEnterpriseSignals++;
  }

  // 7. "Trusted by X companies" present (detected via hasTrustedBySection)
  if (features.authority.hasTrustedBySection) {
    strongEnterpriseSignals++;
  }

  // 8. Enterprise intent keywords on homepage
  // Note: This would require analyzing heroHeadlineText, but we can infer from nav structure
  // Multiple solution verticals in nav (e.g., "Marketing / Sales / Service / Ops")
  const solutionNavCount = [
    features.navigation.hasProductNav,
    features.navigation.hasSolutionsNav,
    features.navigation.hasResourcesNav,
    features.navigation.hasPricingNav,
  ].filter(Boolean).length;
  if (solutionNavCount >= 3) {
    strongEnterpriseSignals++;
  }

  // 9. Global language selector in nav (detected via localization signals)
  if (features.localization.hasLanguageSwitcher || features.localization.detectedLocales.length > 1) {
    strongEnterpriseSignals++;
  }

  // 10. Footer links to: Academy, Docs, API, Developers, Partners
  // Detected via hasDocsOrGuides and resources hub
  if (features.content.hasDocsOrGuides && features.content.hasResourcesHub) {
    strongEnterpriseSignals++;
  }

  // 11. Multiple content types (blog + resources + docs + case studies)
  const contentTypeCount = [
    features.content.hasBlog,
    features.content.hasResourcesHub,
    features.content.hasDocsOrGuides,
    features.content.hasCaseStudiesSection,
  ].filter(Boolean).length;
  if (contentTypeCount >= 3) {
    strongEnterpriseSignals++;
  }

  // 12. Strong authority signals (awards, press, review badges)
  const authoritySignalCount = [
    features.authority.hasAwardsOrBadges,
    features.authority.hasPressLogos,
    features.authority.hasG2OrReviewBadges,
    features.authority.hasCustomerLogoStrip,
    features.authority.hasTrustedBySection,
  ].filter(Boolean).length;
  if (authoritySignalCount >= 3) {
    strongEnterpriseSignals++;
  }

  // NOTE: Facebook and Instagram presence are NOT included in enterprise maturity signals.
  // Only LinkedIn + deep site features + multi-product nav contribute to "established" and above.
  // FB/IG should only help SMBs not get unfairly penalized, not boost enterprise maturity.

  // Classification Rules
  if (strongEnterpriseSignals >= 5) {
    return 'category-leader';
  }
  if (strongEnterpriseSignals >= 3) {
    return 'mature';
  }
  if (strongEnterpriseSignals >= 1) {
    return 'established';
  }

  // Fallback to scoring-driven maturity for SMBs
  // This will be handled by the caller based on overall score
  return 'growing';
}

/**
 * Compute maturity stage with floors based on detected maturity
 * 
 * Applies maturity floors to prevent enterprise sites from being classified too low.
 * 
 * @param overallScore - Overall score from scorecard (0-100)
 * @param detectedMaturity - Detected maturity level from detectMaturity()
 * @returns Final maturity stage display name
 */
export function computeMaturityStage(
  overallScore: number | undefined,
  detectedMaturity: MaturityLevel
): string {
  // Score-based maturity (fallback for SMBs)
  let scoreBasedMaturity: string;
  if (overallScore === undefined) {
    scoreBasedMaturity = 'Not evaluated';
  } else if (overallScore <= 40) {
    scoreBasedMaturity = 'Early Stage';
  } else if (overallScore <= 70) {
    scoreBasedMaturity = 'Growing';
  } else {
    scoreBasedMaturity = 'Established';
  }

  // Apply maturity floors based on detection
  if (detectedMaturity === 'category-leader') {
    return 'Category Leader';
  }

  if (detectedMaturity === 'mature') {
    // Mature sites cannot be below "Mature"
    if (scoreBasedMaturity === 'Early Stage' || scoreBasedMaturity === 'Growing' || scoreBasedMaturity === 'Established') {
      return 'Mature';
    }
    return scoreBasedMaturity; // Could be "Mature" or higher
  }

  if (detectedMaturity === 'established') {
    // Established sites cannot be below "Established"
    if (scoreBasedMaturity === 'Early Stage' || scoreBasedMaturity === 'Growing') {
      return 'Established';
    }
    return scoreBasedMaturity; // Could be "Established" or higher
  }

  // For "growing" or "early-stage", use score-based maturity
  // But ensure "growing" maps to "Growing" and "early-stage" maps to "Early Stage"
  if (detectedMaturity === 'growing') {
    if (scoreBasedMaturity === 'Early Stage') {
      return 'Growing';
    }
    return scoreBasedMaturity;
  }

  if (detectedMaturity === 'early-stage') {
    return 'Early Stage';
  }

  // Fallback
  return scoreBasedMaturity;
}

