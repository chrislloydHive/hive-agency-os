/**
 * Scoring Module for Growth Acceleration Plan (GAP)
 * 
 * Provides a structured, component-based scoring system that produces
 * meaningfully different scores across different websites.
 * 
 * Score Bands:
 * - 0–29 = "Early" / significant issues
 * - 30–59 = "Developing" / mixed performance
 * - 60–79 = "Strong" / generally good with some gaps
 * - 80–100 = "Leading" / best-in-class, rare
 * 
 * Scoring Guidance:
 * - If multiple sections repeatedly mention missing content, weak trust signals,
 *   unclear CTAs, or major structural issues, those dimensions should be < 40.
 * - Only give 80+ when the relevant sectionAnalysis is overwhelmingly positive
 *   and calls out few or no major issues.
 * - overallScore is derived from dimension scores via weighted average:
 *   overall = round(weighted average of website, content, seo, brand, authority)
 */

import type { SiteElementContext } from './html-context';
import type { TechnicalSeoSignals, PositioningAnalysis, DataAvailability } from './types';
import type { ContentInventory } from './analyzeContentInventory';
import type { AssessmentResult } from '@/lib/unified-assessment';
import { scoreBrandFromSignals, applyBrandFloors } from './brandScoring';
import type { SiteFeatures } from '@/lib/eval/siteFeatures';

export interface ComponentScore {
  name: string;
  score: number;
  max: number;
}

export interface DimensionScore {
  name: string;
  weight: number; // as percentage: 0.25 = 25%
  components: ComponentScore[];
  score?: number; // Added by score() function
}

export interface ScoringResult {
  overallScore: number;
  dimensionScores: DimensionScore[];
}

/**
 * Score a single dimension from its components
 * 
 * Calculates weighted average of components, scaled 0-100
 * 
 * Score Bands: 0–29 Early, 30–59 Developing, 60–79 Strong, 80–100 Leading
 * 
 * @param components - Array of component scores for the dimension
 * @returns Dimension score as integer (0-100)
 */
export function scoreDimension(components: ComponentScore[]): number {
  if (components.length === 0) {
    return 0;
  }
  
  const total = components.reduce((sum, c) => sum + c.score, 0);
  const max = components.reduce((sum, c) => sum + c.max, 0);
  
  if (max === 0) {
    return 0;
  }
  
  // Calculate weighted average and scale to 0-100
  // This produces scores across the full 0-100 range based on component quality
  const normalized = (total / max) * 100;
  return Math.round(normalized);
}

/**
 * Score all dimensions and calculate overall score
 * 
 * Overall score is derived from dimension scores via weighted average.
 * Do not override dimension scores to force an arbitrary overall.
 * 
 * Formula: overall = round(weighted average of website, content, seo, brand, authority)
 * 
 * Score Bands: 0–29 Early, 30–59 Developing, 60–79 Strong, 80–100 Leading
 * 
 * @param dimensions - Array of dimension scores with weights
 * @returns Object with overallScore and dimensionScores record
 */
export function scoreAll(dimensions: DimensionScore[]): {
  overallScore: number;
  dimensionScores: Record<string, number>;
} {
  const dimensionScores: Record<string, number> = {};
  let overall = 0;
  
  for (const dim of dimensions) {
    // Score this dimension (produces 0-100 based on component quality)
    const dimScore = scoreDimension(dim.components);
    dimensionScores[dim.name] = dimScore;
    
    // Add weighted contribution to overall score
    // Weights: website=0.25, content=0.25, seo=0.25, brand=0.15, authority=0.10
    overall += dimScore * dim.weight;
  }
  
  // Round to integer - this is the weighted average of all dimension scores
  return {
    overallScore: Math.round(overall),
    dimensionScores,
  };
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use scoreAll() instead
 */
export function score(dimensions: DimensionScore[]): ScoringResult {
  const result = scoreAll(dimensions);
  
  return {
    overallScore: result.overallScore,
    dimensionScores: dimensions.map(dim => ({
      ...dim,
      score: result.dimensionScores[dim.name],
    })),
  };
}

/**
 * Build component scores for Website & Conversion dimension (weight: 0.25)
 * 
 * Scoring Guidance:
 * - If sectionAnalysis mentions missing CTAs, unclear navigation, or conversion issues,
 *   component scores should be low, resulting in dimension score < 40.
 * - Only score 80+ if CTAs are clear, navigation is excellent, and conversion flow is strong.
 * 
 * Score Bands: 0–29 Early, 30–59 Developing, 60–79 Strong, 80–100 Leading
 */
function buildWebsiteConversionComponents(
  siteElementContext: SiteElementContext,
  assessment: AssessmentResult,
  dataAvailability: DataAvailability,
  technicalSeoSignals: TechnicalSeoSignals
): ComponentScore[] {
  const components: ComponentScore[] = [];
  const extraction = assessment.extraction;
  const homepage = siteElementContext.pages.find(p => p.type === 'home') || siteElementContext.pages[0];
  
  // heroClarity (0-5 points)
  const hasHeroHeadline = extraction.hero_section?.headline_text ? true : false;
  const hasHeroSubheadline = extraction.hero_section?.subheadline_text ? true : false;
  const heroClarityScore = (hasHeroHeadline ? 2 : 0) + (hasHeroSubheadline ? 2 : 0) + (extraction.hero_section?.cta_buttons?.length > 0 ? 1 : 0);
  components.push({ name: 'heroClarity', score: Math.min(5, heroClarityScore), max: 5 });
  
  // navigationClarity (0-5 points)
  const navItems = homepage?.navItems?.length || extraction.navigation?.primary_nav_items?.length || 0;
  const navigationClarityScore = navItems >= 5 ? 5 : navItems >= 3 ? 3 : navItems >= 1 ? 1 : 0;
  components.push({ name: 'navigationClarity', score: navigationClarityScore, max: 5 });
  
  // primaryCtaVisibility (0-5 points)
  const heroCtaCount = extraction.hero_section?.cta_buttons?.length || 0;
  const allCtasCount = extraction.all_ctas?.length || 0;
  const primaryCtaVisibilityScore = heroCtaCount > 0 ? 5 : allCtasCount >= 3 ? 3 : allCtasCount >= 1 ? 1 : 0;
  components.push({ name: 'primaryCtaVisibility', score: primaryCtaVisibilityScore, max: 5 });
  
  // mobileExperience (0-5 points) - infer from technical SEO performance score, else 0
  const performanceScore = technicalSeoSignals.lighthousePerformanceScore ?? 0;
  const mobileExperienceScore = performanceScore > 0 
    ? (performanceScore >= 80 ? 5 : performanceScore >= 60 ? 3 : performanceScore >= 40 ? 1 : 0)
    : 0;
  components.push({ name: 'mobileExperience', score: mobileExperienceScore, max: 5 });
  
  // conversionFlowPresent (0-5 points) - detect contact/lead forms, pricing pages, etc.
  const hasPricing = siteElementContext.pages.some(p => p.type === 'pricing');
  const hasServices = siteElementContext.pages.some(p => p.type === 'services');
  const hasContact = siteElementContext.pages.some(p => 
    p.type === 'other' && (
      p.pageUrl.toLowerCase().includes('contact') || 
      p.pageUrl.toLowerCase().includes('get-started') ||
      p.pageUrl.toLowerCase().includes('book') ||
      p.pageUrl.toLowerCase().includes('schedule')
    )
  );
  // Check for form-like CTAs
  const hasFormCtas = siteElementContext.pages.some(p => 
    p.ctaLabels?.some(cta => 
      cta.toLowerCase().includes('form') || 
      cta.toLowerCase().includes('submit') ||
      cta.toLowerCase().includes('apply')
    )
  );
  const conversionFlowPresentScore = (hasPricing ? 2 : 0) + (hasServices ? 1 : 0) + (hasContact ? 1 : 0) + (hasFormCtas ? 1 : 0);
  components.push({ name: 'conversionFlowPresent', score: Math.min(5, conversionFlowPresentScore), max: 5 });
  
  return components;
}

/**
 * Build component scores for Content Depth & Velocity dimension (weight: 0.25)
 * 
 * Updated to use improved SiteFeatures.content signals that detect content ecosystems
 * from navigation and links, not just current page content.
 * 
 * Scoring Guidance:
 * - Rewards depth, breadth, and funnel coverage before critiquing narrative gaps
 * - Content-rich sites (HubSpot, Intercom) should score 75-95
 * - Small sites with basic blog (5-10 posts) should score 30-60
 * 
 * Score Bands: 0–29 Early, 30–59 Developing, 60–79 Strong, 80–100 Leading
 */
function buildContentDepthComponents(
  contentInventory: ContentInventory,
  siteElementContext: SiteElementContext,
  dataAvailability: DataAvailability,
  features?: SiteFeatures
): ComponentScore[] {
  const components: ComponentScore[] = [];
  
  // Use SiteFeatures.content if available (has improved detection), otherwise fall back to contentInventory
  const c = features?.content;
  const blogDetected = c?.hasBlog ?? dataAvailability.contentInventory.blogDetected;
  const blogPostCount = c?.blogPostCount ?? contentInventory.blogPostsFound;
  const caseStudiesDetected = c?.hasCaseStudiesSection ?? dataAvailability.contentInventory.caseStudiesDetected;
  const caseStudyCount = c?.caseStudyCount ?? contentInventory.caseStudiesFound;
  const hasResourcesHub = c?.hasResourcesHub ?? false;
  const hasDocsOrGuides = c?.hasDocsOrGuides ?? false;
  
  // blogDetected → 0 or 3 (use SiteFeatures if available)
  components.push({ name: 'blogDetected', score: blogDetected ? 3 : 0, max: 3 });
  
  // caseStudiesDetected → 0 or 3 (use SiteFeatures if available)
  components.push({ name: 'caseStudiesDetected', score: caseStudiesDetected ? 3 : 0, max: 3 });
  
  // blogPostCount → 0-4 (improved thresholds for content-rich sites)
  // 50+ posts = 4, 40+ = 4, 20+ = 3, 10+ = 2, 5+ = 1, 1+ = 1, 0 = 0
  const blogPostCountScore = blogPostCount >= 50 ? 4 
    : blogPostCount >= 40 ? 4 
    : blogPostCount >= 20 ? 3 
    : blogPostCount >= 10 ? 2 
    : blogPostCount >= 5 ? 1 
    : blogPostCount >= 1 ? 1 
    : 0;
  components.push({ name: 'blogPostCount', score: blogPostCountScore, max: 4 });
  
  // blogRecency → 0-4 (infer from content volume - if high volume, likely recent)
  const blogRecencyScore = contentInventory.contentVolume === 'high' ? 4 
    : contentInventory.contentVolume === 'medium' ? 2 
    : contentInventory.contentVolume === 'low' && blogPostCount > 0 ? 1 
    : 0;
  components.push({ name: 'blogRecency', score: blogRecencyScore, max: 4 });
  
  // Resources hub presence → 0-3 (new component for content-rich sites)
  const resourcesHubScore = hasResourcesHub ? 3 : 0;
  components.push({ name: 'resourcesHub', score: resourcesHubScore, max: 3 });
  
  // Case study count → 0-3 (improved thresholds)
  // 15+ = 3, 10+ = 2, 5+ = 1, 1+ = 1, 0 = 0
  const caseStudyCountScore = caseStudyCount >= 15 ? 3
    : caseStudyCount >= 10 ? 2
    : caseStudyCount >= 5 ? 1
    : caseStudyCount >= 1 ? 1
    : 0;
  components.push({ name: 'caseStudyCount', score: caseStudyCountScore, max: 3 });
  
  // aboutDepth → 0-3
  const aboutPage = siteElementContext.pages.find(p => p.type === 'about');
  const aboutDepth = aboutPage?.rawTextSample?.length || 0;
  const aboutDepthScore = aboutDepth > 1000 ? 3 : aboutDepth > 500 ? 2 : aboutDepth > 0 ? 1 : 0;
  components.push({ name: 'aboutDepth', score: aboutDepthScore, max: 3 });
  
  // contentVariety → 0-5 (blog + case studies + resources + docs + FAQs etc.)
  const themeCount = contentInventory.contentThemes?.length || 0;
  const hasBlog = blogDetected;
  const hasCaseStudies = caseStudiesDetected;
  const hasFAQ = dataAvailability.contentInventory.faqDetected;
  const funnelCoverage = contentInventory.funnelStageCoverage;
  const funnelVariety = (funnelCoverage.topOfFunnel === 'strong' ? 1 : 0) + 
                        (funnelCoverage.middleOfFunnel === 'strong' ? 1 : 0) + 
                        (funnelCoverage.bottomOfFunnel === 'strong' ? 1 : 0);
  const contentVarietyScore = Math.min(5, 
    (hasBlog ? 1 : 0) + 
    (hasCaseStudies ? 1 : 0) + 
    (hasResourcesHub ? 1 : 0) +  // Add resources hub to variety
    (hasDocsOrGuides ? 0.5 : 0) +  // Add docs to variety
    (hasFAQ ? 0.5 : 0) + 
    Math.floor(themeCount / 2) + 
    funnelVariety
  );
  components.push({ name: 'contentVariety', score: contentVarietyScore, max: 5 });
  
  return components;
}

/**
 * Build component scores for SEO & Visibility dimension (weight: 0.25)
 * 
 * Scoring Guidance:
 * - If sectionAnalysis mentions technical SEO issues, missing meta tags, poor performance,
 *   or visibility gaps, dimension score should be < 40.
 * - Only score 80+ if technical SEO is excellent, performance is strong, and visibility is high.
 * 
 * Score Bands: 0–29 Early, 30–59 Developing, 60–79 Strong, 80–100 Leading
 */
function buildSeoVisibilityComponents(
  technicalSeoSignals: TechnicalSeoSignals,
  dataAvailability: DataAvailability,
  siteElementContext: SiteElementContext,
  positioningAnalysis: PositioningAnalysis
): ComponentScore[] {
  const components: ComponentScore[] = [];
  
  // lighthousePerformanceScore → scale to 0-10
  const lighthousePerformanceScore = technicalSeoSignals.lighthousePerformanceScore ?? 0;
  const lighthousePerformanceScoreScaled = Math.round((lighthousePerformanceScore / 100) * 10);
  components.push({ name: 'lighthousePerformanceScore', score: lighthousePerformanceScoreScaled, max: 10 });
  
  // headingStructureHealth (H1 issues) → 0-5 (inverse: no multiple H1s = good)
  const hasMultipleH1 = technicalSeoSignals.hasMultipleH1 ?? false;
  const homepage = siteElementContext.pages.find(p => p.type === 'home') || siteElementContext.pages[0];
  const headingCount = homepage?.headings?.length || 0;
  const hasH1 = headingCount > 0;
  const headingStructureHealthScore = hasH1 && !hasMultipleH1 ? 5 
    : hasH1 && hasMultipleH1 ? 2 
    : headingCount >= 5 ? 3 
    : headingCount >= 1 ? 1 
    : 0;
  components.push({ name: 'headingStructureHealth', score: headingStructureHealthScore, max: 5 });
  
  // internalLinkingPresence → 0-5
  const internalLinkCount = technicalSeoSignals.internalLinkCount ?? 0;
  const internalLinkingPresenceScore = internalLinkCount >= 50 ? 5 : internalLinkCount >= 30 ? 4 : internalLinkCount >= 20 ? 3 : internalLinkCount >= 10 ? 2 : internalLinkCount >= 1 ? 1 : 0;
  components.push({ name: 'internalLinkingPresence', score: internalLinkingPresenceScore, max: 5 });
  
  // metaTagsPresent → 0-3
  const metaTagsPresentScore = technicalSeoSignals.metaTagsPresent ? 3 : 0;
  components.push({ name: 'metaTagsPresent', score: metaTagsPresentScore, max: 3 });
  
  // localSeoSignals (for local businesses) → 0-2
  // Check positioning analysis for hyper-local signals
  const hasLocalSearchLanguage = positioningAnalysis?.localSearchLanguage && positioningAnalysis.localSearchLanguage.length > 0;
  const hasGeographicFocus = positioningAnalysis?.geographicFocus && 
    (positioningAnalysis.geographicFocus.toLowerCase().includes('local') || 
     positioningAnalysis.geographicFocus.toLowerCase().includes('neighborhood') ||
     positioningAnalysis.geographicFocus.toLowerCase().includes('city'));
  const localSeoSignalsScore = (hasLocalSearchLanguage ? 1 : 0) + (hasGeographicFocus ? 1 : 0);
  components.push({ name: 'localSeoSignals', score: Math.min(2, localSeoSignalsScore), max: 2 });
  
  return components;
}

/**
 * Build component scores for Brand & Positioning dimension (weight: 0.15)
 * 
 * Uses the new deterministic brand scoring rubric from brandScoring.ts
 * No LLM involvement - purely signal-based scoring.
 * 
 * Score Bands: 0–29 Early, 30–59 Developing, 60–79 Strong, 80–100 Leading
 */
function buildBrandPositioningComponents(
  positioningAnalysis: PositioningAnalysis,
  siteElementContext: SiteElementContext,
  dataAvailability: DataAvailability,
  assessment: AssessmentResult,
  contentInventory: ContentInventory
): ComponentScore[] {
  // Calculate raw brand score from signals (deterministic, no LLM)
  const rawBrandScore = scoreBrandFromSignals({
    siteElementContext,
    positioningAnalysis,
    assessment,
    contentInventory,
  });
  
  // Apply brand floors
  const finalBrandScore = applyBrandFloors(rawBrandScore, {
    siteElementContext,
    positioningAnalysis,
    assessment,
    contentInventory,
  });
  
  // Convert to component format for consistency with other dimensions
  // Brand score is already 0-100, so we create a single component representing the full score
  // The scoreDimension function will normalize this correctly (score/max * 100)
  const components: ComponentScore[] = [
    {
      name: 'brandScore',
      score: finalBrandScore,
      max: 100,
    },
  ];
  
  // Log brand scoring details
  console.log(`📊 Brand & Positioning scoring:`);
  console.log(`   - Raw rubric score: ${rawBrandScore}/100`);
  console.log(`   - After floors: ${finalBrandScore}/100`);
  
  return components;
}

/**
 * Build component scores for Authority & Trust dimension (weight: 0.10)
 * 
 * Updated to use improved SiteFeatures.authority signals that detect trust assets
 * from navigation, links, and text patterns, not just visible elements.
 * 
 * Scoring Guidance:
 * - Rewards social proof depth, credibility markers, scale signals, and integration
 * - Category leaders (HubSpot, Stripe, Notion, Intercom) should score 75-90
 * - Small, low-proof sites should score 0-50
 * 
 * Score Bands: 0–29 Early, 30–59 Developing, 60–79 Strong, 80–100 Leading
 */
function buildAuthorityTrustComponents(
  assessment: AssessmentResult,
  siteElementContext: SiteElementContext,
  contentInventory: ContentInventory,
  features?: SiteFeatures
): ComponentScore[] {
  const components: ComponentScore[] = [];
  const trustSignals = assessment.extraction.trust_signals;
  const brandAuthority = assessment.extraction.brandAuthority;
  
  // Use SiteFeatures.authority if available (has improved detection), otherwise fall back to legacy sources
  const a = features?.authority;
  const c = features?.content;
  
  // testimonialsPresent → 0-3 (improved thresholds)
  const testimonialsCount = a?.testimonialCount ?? trustSignals?.testimonials_visible?.length ?? 0;
  const testimonialsPresentScore = testimonialsCount >= 8 ? 3 
    : testimonialsCount >= 5 ? 3 
    : testimonialsCount >= 3 ? 2 
    : testimonialsCount >= 1 ? 1 
    : 0;
  components.push({ name: 'testimonialsPresent', score: testimonialsPresentScore, max: 3 });
  
  // caseStudyDepth (if present) → 0-3 (improved thresholds)
  const caseStudyCount = c?.caseStudyCount ?? contentInventory.caseStudiesFound;
  const caseStudyDepthScore = caseStudyCount >= 15 ? 3
    : caseStudyCount >= 10 ? 3
    : caseStudyCount >= 5 ? 2 
    : caseStudyCount >= 1 ? 1 
    : 0;
  components.push({ name: 'caseStudyDepth', score: caseStudyDepthScore, max: 3 });
  
  // thirdPartyTrust (logos, badges, reviews) → 0-3 (improved thresholds)
  const logosCount = a?.customerLogoCount ?? trustSignals?.logos_visible?.length ?? 0;
  const awardsCount = trustSignals?.awards_visible?.length ?? 0;
  const hasReviewCounts = trustSignals?.review_counts_visible ? true : false;
  const hasAwards = a?.hasAwardsOrBadges ?? false;
  const hasPress = a?.hasPressLogos ?? false;
  const hasReviewBadges = a?.hasG2OrReviewBadges ?? false;
  
  // Combine legacy awards with SiteFeatures credibility markers
  const credibilityMarkers = (hasAwards ? 1 : 0) + (hasPress ? 1 : 0) + (hasReviewBadges ? 1 : 0);
  const thirdPartyTrustScore = (logosCount >= 20 || credibilityMarkers >= 2) ? 3 
    : (logosCount >= 10 || credibilityMarkers >= 1 || awardsCount >= 3 || hasReviewCounts) ? 3
    : (logosCount >= 5 || awardsCount >= 2) ? 2 
    : (logosCount >= 1 || awardsCount >= 1) ? 1 
    : 0;
  components.push({ name: 'thirdPartyTrust', score: thirdPartyTrustScore, max: 3 });
  
  // customerLogoStrip → 0-2 (new component for logo strips)
  const hasLogoStrip = a?.hasCustomerLogoStrip ?? false;
  const logoStripScore = hasLogoStrip ? 2 : 0;
  components.push({ name: 'customerLogoStrip', score: logoStripScore, max: 2 });
  
  // trustedBySection → 0-2 (new component for "trusted by" sections)
  const hasTrustedBy = a?.hasTrustedBySection ?? false;
  const trustedByScore = hasTrustedBy ? 2 : 0;
  components.push({ name: 'trustedBySection', score: trustedByScore, max: 2 });
  
  // socialPresenceSignal → 0-7 (weighted: LinkedIn 3, Facebook 2, Instagram 2)
  // Use SiteFeatures social signals if available, otherwise fall back to legacy detection
  const social = features?.social;
  let socialPresenceSignalScore = 0;
  
  if (social) {
    // Use SiteFeatures social signals (preferred)
    socialPresenceSignalScore = (
      (social.hasLinkedIn ? 3 : 0) +
      (social.hasFacebook ? 2 : 0) +
      (social.hasInstagram ? 2 : 0)
    );
  } else {
    // Fallback to legacy detection from siteElementContext
    const hasSocialLinks = siteElementContext.pages.some(p => 
      p.navItems?.some(item => 
        item.toLowerCase().includes('twitter') ||
        item.toLowerCase().includes('linkedin') ||
        item.toLowerCase().includes('facebook') ||
        item.toLowerCase().includes('instagram') ||
        item.toLowerCase().includes('social')
      ) ||
      p.ctaLabels?.some(cta => 
        cta.toLowerCase().includes('follow') ||
        cta.toLowerCase().includes('connect')
      )
    );
    const hasSocialProof = logosCount > 0 || awardsCount > 0 || hasAwards || hasPress || hasReviewBadges;
    socialPresenceSignalScore = (hasSocialLinks ? 1 : 0) + (hasSocialProof ? 1 : 0);
    // Scale legacy score to match new 0-7 range (rough approximation)
    socialPresenceSignalScore = socialPresenceSignalScore * 3.5;
  }
  
  components.push({ name: 'socialPresenceSignal', score: Math.min(7, socialPresenceSignalScore), max: 7 });
  
  // brandAuthoritySignal → 0-2 (LinkedIn, Google Business Profile)
  const hasLinkedIn = brandAuthority?.linkedin?.url ? true : false;
  const hasGBP = brandAuthority?.gbp?.url ? true : false;
  const brandAuthorityScore = (hasLinkedIn ? 1 : 0) + (hasGBP ? 1 : 0);
  components.push({ name: 'brandAuthoritySignal', score: brandAuthorityScore, max: 2 });
  
  // namedCustomerStories → 0-2 (new component for named testimonials)
  const hasNamedStories = a?.hasNamedCustomerStories ?? false;
  const namedStoriesScore = hasNamedStories ? 2 : 0;
  components.push({ name: 'namedCustomerStories', score: namedStoriesScore, max: 2 });
  
  // baselineTrust → 0-1 (give baseline if site has basic structure, even without explicit trust signals)
  // This ensures sites with basic structure get at least a minimal score
  const hasHomepage = siteElementContext.pages.some(p => p.type === 'home');
  const hasAboutPage = siteElementContext.pages.some(p => p.type === 'about');
  const hasBasicStructure = hasHomepage && (hasAboutPage || siteElementContext.pages.length >= 3);
  // Give baseline if site has basic structure OR if there are any trust signals
  // Check for social links from siteElementContext if social signals not available
  const hasSocialLinks = social ? (social.hasLinkedIn || social.hasFacebook || social.hasInstagram) : siteElementContext.pages.some(p => 
    p.navItems?.some(item => 
      item.toLowerCase().includes('twitter') ||
      item.toLowerCase().includes('linkedin') ||
      item.toLowerCase().includes('facebook') ||
      item.toLowerCase().includes('instagram') ||
      item.toLowerCase().includes('social')
    ) ||
    p.ctaLabels?.some(cta => 
      cta.toLowerCase().includes('follow') ||
      cta.toLowerCase().includes('connect')
    )
  );
  const hasSocialProof = logosCount > 0 || awardsCount > 0 || hasAwards || hasPress || hasReviewBadges;
  const hasAnyTrustSignals = testimonialsCount > 0 || caseStudyCount > 0 || logosCount > 0 || 
                              awardsCount > 0 || hasReviewCounts || hasSocialLinks || hasLinkedIn || hasGBP ||
                              hasAwards || hasPress || hasReviewBadges || hasLogoStrip || hasTrustedBy || hasSocialProof;
  const baselineTrustScore = (hasBasicStructure || hasAnyTrustSignals) ? 1 : 0;
  components.push({ name: 'baselineTrust', score: baselineTrustScore, max: 1 });
  
  // Log authority components for debugging
  console.log(`📊 Authority & Trust components:`);
  console.log(`   - Testimonials: ${testimonialsPresentScore}/3 (${testimonialsCount} found)`);
  console.log(`   - Case Studies: ${caseStudyDepthScore}/3 (${caseStudyCount} found)`);
  console.log(`   - Third Party Trust: ${thirdPartyTrustScore}/3 (logos: ${logosCount}, awards: ${awardsCount}, reviews: ${hasReviewCounts}, credibility markers: ${credibilityMarkers})`);
  console.log(`   - Customer Logo Strip: ${logoStripScore}/2 (${hasLogoStrip})`);
  console.log(`   - Trusted By Section: ${trustedByScore}/2 (${hasTrustedBy})`);
  console.log(`   - Social Presence: ${socialPresenceSignalScore}/7 (LinkedIn: ${social?.hasLinkedIn || false}, Facebook: ${social?.hasFacebook || false}, Instagram: ${social?.hasInstagram || false})`);
  console.log(`   - Brand Authority: ${brandAuthorityScore}/2 (LinkedIn: ${hasLinkedIn}, GBP: ${hasGBP})`);
  console.log(`   - Named Customer Stories: ${namedStoriesScore}/2 (${hasNamedStories})`);
  console.log(`   - Baseline Trust: ${baselineTrustScore}/1 (basic structure: ${hasBasicStructure}, trust signals: ${hasAnyTrustSignals})`);
  
  return components;
}

/**
 * Apply score floors based on strong signals
 * 
 * Ensures that sites with strong content, authority, or brand signals
 * don't get unfairly low scores. This prevents high-quality sites from
 * scoring below thresholds due to rubric component weighting.
 * 
 * @param rubricScores - Raw rubric scores from component calculation
 * @param features - SiteFeatures object containing all detected signals
 * @param siteElementContext - Site structure and elements (legacy, will be replaced by features)
 * @param contentInventory - Content inventory data (legacy, will be replaced by features)
 * @param assessment - Assessment result with trust signals
 * @returns Adjusted scores with floors applied
 */
export function applyScoreFloors(
  rubricScores: Record<string, number>,
  features: SiteFeatures,
  siteElementContext: SiteElementContext,
  contentInventory: ContentInventory,
  assessment: AssessmentResult
): Record<string, number> {
  let { websiteAndConversion, contentDepthAndVelocity, seoAndVisibility, brandAndPositioning, authorityAndTrust } = rubricScores;

  // Extract signal counts from SiteFeatures (preferred) or fallback to legacy sources
  const blogPostCount = features.content.blogPostCount || contentInventory.blogPostsFound || 0;
  const caseStudyCount = features.content.caseStudyCount || contentInventory.caseStudiesFound || 0;
  const trustSignals = assessment.extraction.trust_signals;
  const testimonialsCount = features.authority.testimonialCount || trustSignals?.testimonials_visible?.length || 0;
  const logosCount = features.authority.customerLogoCount || trustSignals?.logos_visible?.length || 0;
  const brandAuthority = assessment.extraction.brandAuthority;
  const hasLinkedIn = brandAuthority?.linkedin?.url ? true : false;
  const hasGBP = brandAuthority?.gbp?.url ? true : false;

  // Strong content signals: Apply floors based on improved SiteFeatures signals
  const hasResourcesHub = features.content.hasResourcesHub;
  const hasBlog = features.content.hasBlog;
  
  // Floor 1: Sites with substantial blog (40+ posts) should score at least 70
  if (hasBlog && blogPostCount >= 40 && contentDepthAndVelocity !== undefined) {
    contentDepthAndVelocity = Math.max(contentDepthAndVelocity, 70);
    console.log(`📊 Applied content floor (blog 40+): ${contentDepthAndVelocity} (was ${rubricScores.contentDepthAndVelocity}, signals: ${blogPostCount} blogs)`);
  }
  
  // Floor 2: Sites with 15+ case studies OR resources hub should score at least 75
  if ((caseStudyCount >= 15 || hasResourcesHub) && contentDepthAndVelocity !== undefined) {
    contentDepthAndVelocity = Math.max(contentDepthAndVelocity, 75);
    console.log(`📊 Applied content floor (case studies/resources): ${contentDepthAndVelocity} (was ${rubricScores.contentDepthAndVelocity}, signals: ${caseStudyCount} case studies, resources hub: ${hasResourcesHub})`);
  }
  
  // Floor 3: Sites with both substantial blog AND resources hub should score at least 80
  if (hasBlog && blogPostCount >= 40 && hasResourcesHub && contentDepthAndVelocity !== undefined) {
    contentDepthAndVelocity = Math.max(contentDepthAndVelocity, 80);
    console.log(`📊 Applied content floor (blog + resources): ${contentDepthAndVelocity} (was ${rubricScores.contentDepthAndVelocity}, signals: ${blogPostCount} blogs, resources hub: ${hasResourcesHub})`);
  }
  
  // Floor 4: Social-first content floor for consumer-facing brands
  // Gyms, salons, venues, influencers, etc. may not have blogs but have strong Instagram presence
  const hasInstagram = features.social.hasInstagram;
  if (!hasBlog && hasInstagram && contentDepthAndVelocity !== undefined) {
    contentDepthAndVelocity = Math.max(contentDepthAndVelocity, 40);
    console.log(`📊 Applied content floor (social-first): ${contentDepthAndVelocity} (was ${rubricScores.contentDepthAndVelocity}, signals: Instagram presence, no blog)`);
  }

  // Strong authority signals: Apply floors based on improved SiteFeatures signals
  const hasLogoStrip = features.authority.hasCustomerLogoStrip;
  const hasTrustedBy = features.authority.hasTrustedBySection;
  const hasAwards = features.authority.hasAwardsOrBadges;
  const hasPress = features.authority.hasPressLogos;
  const hasReviewBadges = features.authority.hasG2OrReviewBadges;
  const hasCaseStudiesSection = features.content.hasCaseStudiesSection;
  
  // Floor 1: Sites with strong logos AND case studies should score at least 70
  const strongLogos = logosCount >= 20 || hasLogoStrip;
  const strongCaseStudies = caseStudyCount >= 10 || hasCaseStudiesSection;
  if (strongLogos && strongCaseStudies && authorityAndTrust !== undefined) {
    authorityAndTrust = Math.max(authorityAndTrust, 70);
    console.log(`📊 Applied authority floor (logos + case studies): ${authorityAndTrust} (was ${rubricScores.authorityAndTrust}, signals: ${logosCount} logos, ${caseStudyCount} case studies)`);
  }
  
  // Floor 2: Sites with strong logos, case studies, AND credibility badges should score at least 80
  const strongBadges = hasAwards || hasPress || hasReviewBadges;
  if (strongLogos && strongCaseStudies && strongBadges && authorityAndTrust !== undefined) {
    authorityAndTrust = Math.max(authorityAndTrust, 80);
    console.log(`📊 Applied authority floor (logos + case studies + badges): ${authorityAndTrust} (was ${rubricScores.authorityAndTrust}, signals: ${logosCount} logos, ${caseStudyCount} case studies, badges: ${strongBadges})`);
  }
  
  // Floor 3: Sites with strong logos, case studies, testimonials, AND badges should score at least 75
  const strongTestimonials = testimonialsCount >= 5;
  if (strongLogos && strongCaseStudies && strongTestimonials && strongBadges && authorityAndTrust !== undefined) {
    authorityAndTrust = Math.max(authorityAndTrust, 75);
    console.log(`📊 Applied authority floor (all signals): ${authorityAndTrust} (was ${rubricScores.authorityAndTrust}, signals: ${logosCount} logos, ${caseStudyCount} case studies, ${testimonialsCount} testimonials, badges: ${strongBadges})`);
  }
  
  // Sanity check: If we have 20+ logos, 10+ case studies, 5+ testimonials, and any badges,
  // the score should be at least 75
  if (logosCount >= 20 && caseStudyCount >= 10 && testimonialsCount >= 5 && strongBadges && authorityAndTrust !== undefined) {
    authorityAndTrust = Math.max(authorityAndTrust, 75);
    console.log(`📊 Applied authority floor (sanity check): ${authorityAndTrust} (was ${rubricScores.authorityAndTrust}, signals: ${logosCount} logos, ${caseStudyCount} case studies, ${testimonialsCount} testimonials, badges: ${strongBadges})`);
  }

  // Brand floors are now handled in brandScoring.ts via applyBrandFloors()
  // No need to apply brand floors here since they're already applied during component scoring

  return {
    websiteAndConversion,
    contentDepthAndVelocity,
    seoAndVisibility,
    brandAndPositioning,
    authorityAndTrust,
  };
}

/**
 * RubricScores type
 * 
 * Simple record of dimension scores computed directly from SiteFeatures
 */
export interface RubricScores {
  website: number;
  content: number;
  seo: number;
  brand: number;
  authority: number;
}

/**
 * Compute rubric scores directly from SiteFeatures
 * 
 * This provides an explicit, easy-to-tune mapping from SiteFeatures to scores.
 * Each dimension is computed using simple weighted formulas over SiteFeatures fields.
 * 
 * @param features - SiteFeatures object containing all detected signals
 * @returns RubricScores with all dimension scores (0-100)
 */
export function computeRubricScores(features: SiteFeatures): RubricScores {
  const website = scoreWebsite(features);
  const content = scoreContent(features);
  const seo = scoreSEO(features);
  const brand = scoreBrand(features);
  const authority = scoreAuthority(features);

  // Debug logging (dev mode only)
  if (process.env.NODE_ENV !== 'production') {
    console.info('[computeRubricScores]', features.url, {
      website,
      content,
      seo,
      brand,
      authority,
    });
  }

  return { website, content, seo, brand, authority };
}

/**
 * Score Website & Conversion dimension from SiteFeatures
 * 
 * Evaluates UX signals, CTAs, navigation, and conversion elements.
 */
function scoreWebsite(features: SiteFeatures): number {
  const ux = features.ux;
  const nav = features.navigation;
  const conv = features.conversions;

  let score = 0;
  let weightSum = 0;

  const add = (value: number, weight: number) => {
    score += value * weight;
    weightSum += weight;
  };

  // Primary CTAs (normalize to 0-1, cap at 5+ CTAs = 1.0)
  const ctaScore = Math.min(ux.primaryCtaCount / 5, 1);
  add(ctaScore, 3);

  // Above-the-fold CTA
  add(ux.hasAboveTheFoldCTA ? 1 : 0, 2);

  // Clear contact/demo entry
  add(conv.hasSignupOrDemoCTA ? 1 : 0, 2);

  // Structured navigation (5+ nav items = good structure)
  const navStructureScore = Math.min(nav.navItemLabels.length / 5, 1);
  add(navStructureScore, 2);

  // Hero headline presence and quality
  const headlineScore = ux.heroHeadlineTextLength > 0 
    ? Math.min(ux.heroHeadlineTextLength / 50, 1) // 50+ chars = good
    : 0;
  add(headlineScore, 1.5);

  // Hero subheadline
  add(ux.heroHasSubheadline ? 1 : 0, 1);

  // Forms (lead capture)
  const formScore = Math.min(conv.formCount / 2, 1); // 2+ forms = good
  add(formScore, 1);

  // Free trial/get started presence
  add(conv.hasFreeTrialOrGetStarted ? 1 : 0, 0.5);

  if (weightSum === 0) return 0;
  const normalized = (score / weightSum) * 100;
  return Math.round(Math.max(0, Math.min(100, normalized)));
}

/**
 * Score Content Depth & Velocity dimension from SiteFeatures
 * 
 * Evaluates blog presence, case studies, content variety, and key pages.
 */
function scoreContent(features: SiteFeatures): number {
  const content = features.content;

  let score = 0;
  let weightSum = 0;

  const add = (value: number, weight: number) => {
    score += value * weight;
    weightSum += weight;
  };

  // Blog presence and count (normalize: 50+ posts = 1.0)
  const blogScore = content.hasBlog 
    ? Math.min(content.blogPostCount / 50, 1)
    : 0;
  add(blogScore, 3);

  // Case studies presence and count (normalize: 10+ = 1.0)
  const caseStudyScore = content.hasCaseStudiesSection
    ? Math.min(content.caseStudyCount / 10, 1)
    : 0;
  add(caseStudyScore, 2.5);

  // Key pages presence
  const keyPagesCount = [
    content.hasPricingPage,
    content.hasAboutPage,
    content.hasFeatureOrProductPages,
    content.hasDocsOrGuides,
    content.hasResourcesHub,
    content.hasCareersPage,
  ].filter(Boolean).length;
  const keyPagesScore = keyPagesCount / 6; // 6 key page types
  add(keyPagesScore, 2);

  // Content variety (blog + case studies + docs + resources)
  const varietyCount = [
    content.hasBlog,
    content.hasCaseStudiesSection,
    content.hasDocsOrGuides,
    content.hasResourcesHub,
  ].filter(Boolean).length;
  const varietyScore = varietyCount / 4;
  add(varietyScore, 1.5);

  // Newsletter/lead magnet (from conversions)
  add(features.conversions.hasNewsletterOrLeadMagnet ? 1 : 0, 1);

  if (weightSum === 0) return 0;
  const normalized = (score / weightSum) * 100;
  let contentScore = Math.round(Math.max(0, Math.min(100, normalized)));

  // Social-first content floor for consumer-facing brands
  // Gyms, salons, venues, influencers, etc. may not have blogs but have strong Instagram presence
  // This prevents them from scoring 0-20 content scores unfairly
  const social = features.social;
  if (!content.hasBlog && social.hasInstagram) {
    contentScore = Math.max(contentScore, 40);
    if (process.env.NODE_ENV !== 'production') {
      console.info('[contentScoring:socialFirst]', features.url, {
        hasBlog: content.hasBlog,
        hasInstagram: social.hasInstagram,
        contentScoreAfterFloor: contentScore,
      });
    }
  }

  return contentScore;
}

/**
 * Score SEO & Visibility dimension from SiteFeatures
 * 
 * Evaluates technical SEO signals, meta tags, heading structure, and internal linking.
 */
function scoreSEO(features: SiteFeatures): number {
  const seo = features.seo;
  const technical = features.technical;

  let score = 0;
  let weightSum = 0;

  const add = (value: number, weight: number) => {
    score += value * weight;
    weightSum += weight;
  };

  // Meta tags (title + description)
  const metaScore = (seo.hasMetaTitle ? 0.5 : 0) + (seo.hasMetaDescription ? 0.5 : 0);
  add(metaScore, 2);

  // Heading structure (single H1 = good, multiple H1s = bad)
  const h1Score = seo.h1Count === 1 ? 1 : seo.h1Count > 1 ? 0.3 : 0;
  add(h1Score, 2);

  // Internal linking (normalize: 50+ links = 1.0)
  const internalLinkScore = Math.min(seo.internalLinkCount / 50, 1);
  add(internalLinkScore, 2);

  // Canonical tag
  add(seo.hasCanonicalTag ? 1 : 0, 1);

  // Lang attribute
  add(seo.hasLangAttribute ? 1 : 0, 1);

  // Open Graph tags
  add(seo.hasOpenGraphTags ? 1 : 0, 1);

  // Responsive viewport
  add(technical.hasResponsiveMetaViewport ? 1 : 0, 1);

  // HTTPS
  add(technical.usesHttps ? 1 : 0, 1);

  if (weightSum === 0) return 0;
  const normalized = (score / weightSum) * 100;
  return Math.round(Math.max(0, Math.min(100, normalized)));
}

/**
 * Score Brand & Positioning dimension from SiteFeatures
 * 
 * Evaluates visual identity, logo consistency, navigation structure, and brand signals.
 */
function scoreBrand(features: SiteFeatures): number {
  const branding = features.branding;
  const nav = features.navigation;

  let score = 0;
  let weightSum = 0;

  const add = (value: number, weight: number) => {
    score += value * weight;
    weightSum += weight;
  };

  // Logo presence (header + footer)
  const logoScore = (branding.hasLogoInHeader ? 0.5 : 0) + 
                    (branding.hasLogoInFooter ? 0.5 : 0);
  add(logoScore, 2);

  // Structured navigation (5+ nav items = good structure)
  const navStructureScore = branding.hasStructuredNav ? 1 : 
    Math.min(nav.navItemLabels.length / 5, 1);
  add(navStructureScore, 2.5);

  // Navigation variety (product, solutions, resources, pricing, blog, docs)
  const navVarietyCount = [
    nav.hasProductNav,
    nav.hasSolutionsNav,
    nav.hasResourcesNav,
    nav.hasPricingNav,
    nav.hasBlogNav,
    nav.hasDocsNav,
  ].filter(Boolean).length;
  const navVarietyScore = navVarietyCount / 6;
  add(navVarietyScore, 2);

  // Visual identity consistency (logo + colors + typography)
  // Logo consistency: logo appears in header and/or footer
  const hasConsistentLogo = branding.hasLogoInHeader || branding.hasLogoInFooter;
  const visualIdentityScore = (hasConsistentLogo ? 0.33 : 0) +
                             (branding.hasConsistentBrandColors ? 0.33 : 0) +
                             (branding.hasConsistentTypography ? 0.34 : 0);
  add(visualIdentityScore, 2);

  // Hero illustration/visual
  add(branding.hasHeroIllustrationOrVisual ? 1 : 0, 1);

  // Distinct product illustrations
  add(branding.hasDistinctProductIllustrations ? 1 : 0, 0.5);

  if (weightSum === 0) return 0;
  const normalized = (score / weightSum) * 100;
  return Math.round(Math.max(0, Math.min(100, normalized)));
}

/**
 * Score Authority & Trust dimension from SiteFeatures
 * 
 * Evaluates testimonials, customer logos, case studies, awards, and trust signals.
 */
function scoreAuthority(features: SiteFeatures): number {
  const s = features.authority;
  const content = features.content;

  let score = 0;
  let weightSum = 0;

  const add = (value: number, weight: number) => {
    score += value * weight;
    weightSum += weight;
  };

  // Normalize counts roughly to 0–1
  const testimonialScore = Math.min(s.testimonialCount / 5, 1);
  const logoScore = Math.min(s.customerLogoCount / 20, 1);
  const caseStudyScore = Math.min(content.caseStudyCount / 10, 1);

  add(testimonialScore, 3);
  add(logoScore, 3);
  add(caseStudyScore, 2);
  add(s.hasCustomerLogoStrip ? 1 : 0, 1);
  add(s.hasAwardsOrBadges ? 1 : 0, 1);
  add(s.hasPressLogos ? 1 : 0, 1);
  add(s.hasG2OrReviewBadges ? 1 : 0, 1);
  add(s.hasTrustedBySection ? 1 : 0, 0.5);
  add(s.hasNamedCustomerStories ? 1 : 0, 0.5);

  if (weightSum === 0) return 0;
  const normalized = (score / weightSum) * 100;
  return Math.round(Math.max(0, Math.min(100, normalized)));
}

/**
 * Build all dimension scores from available data
 * 
 * Creates 5 DimensionScore objects using real signals:
 * - websiteAndConversion (weight: 0.25)
 * - contentDepthAndVelocity (weight: 0.25)
 * - seoAndVisibility (weight: 0.25)
 * - brandAndPositioning (weight: 0.15)
 * - authorityAndTrust (weight: 0.10)
 * 
 * @param features - SiteFeatures object containing all detected signals
 * @param siteElementContext - Site structure and elements (legacy, will be replaced by features)
 * @param contentInventory - Content inventory data (legacy, will be replaced by features)
 * @param technicalSeoSignals - Technical SEO signals (legacy, will be replaced by features)
 * @param positioningAnalysis - Positioning analysis
 * @param assessment - Assessment result
 * @param dataAvailability - Data availability tracking
 */
export function buildDimensionScores(
  features: SiteFeatures,
  siteElementContext: SiteElementContext,
  contentInventory: ContentInventory,
  technicalSeoSignals: TechnicalSeoSignals,
  positioningAnalysis: PositioningAnalysis,
  assessment: AssessmentResult,
  dataAvailability: DataAvailability
): DimensionScore[] {
  return [
    {
      name: 'websiteAndConversion',
      weight: 0.25,
      components: buildWebsiteConversionComponents(siteElementContext, assessment, dataAvailability, technicalSeoSignals),
    },
    {
      name: 'contentDepthAndVelocity',
      weight: 0.25,
      components: buildContentDepthComponents(contentInventory, siteElementContext, dataAvailability, features),
    },
    {
      name: 'seoAndVisibility',
      weight: 0.25,
      components: buildSeoVisibilityComponents(technicalSeoSignals, dataAvailability, siteElementContext, positioningAnalysis),
    },
    {
      name: 'brandAndPositioning',
      weight: 0.15,
      components: buildBrandPositioningComponents(positioningAnalysis, siteElementContext, dataAvailability, assessment, contentInventory),
    },
    {
      name: 'authorityAndTrust',
      weight: 0.10,
      components: buildAuthorityTrustComponents(assessment, siteElementContext, contentInventory, features),
    },
  ];
}

